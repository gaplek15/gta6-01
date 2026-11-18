// Side activities: taxi fares, the ten golden Teluk coins, and the shops
// (warung meals that heal, the gun store that sells the pistol).
import * as THREE from 'three';
import { ECONOMY, PLACES } from './config.js';
import { makePerson } from './traffic.js';
import { idleBreath } from './human.js';

export function createActivities(game) {
  // The waiting taxi passenger at the pangkalan.
  const person = makePerson(game, { shirt: 0xd4ac0d, pants: 0x2c3e50, hat: 0x2c3e50 });
  person.group.position.set(PLACES.taxiStand.x, 0, PLACES.taxiStand.z);
  return {
    passenger: { ...person, pos: new THREE.Vector3(PLACES.taxiStand.x, 0, PLACES.taxiStand.z), waiting: true },
    fare: null, // { dest: {x,z}, pay }
    fareCooldown: 0,
    coinsCollected: 0,
  };
}

export function updateActivities(game, dt) {
  const act = game.activities;
  const player = game.player;
  const px = player.inCar ? player.inCar.pos.x : player.pos.x;
  const pz = player.inCar ? player.inCar.pos.z : player.pos.z;
  act.fareCooldown = Math.max(0, act.fareCooldown - dt);

  // --- Taxi fare ------------------------------------------------------------
  // The waiting passenger breathes and looks around (human.js).
  if (act.passenger.waiting) idleBreath(act.passenger.parts, game.elapsed, 1.3);
  if (act.fare) {
    const d = Math.hypot(act.fare.dest.x - px, act.fare.dest.z - pz);
    game.hud.setObjective(`Antar penumpang ke tujuan`, act.fare.dest, d);
    if (d < 9) {
      game.money += act.fare.pay;
      game.addXp(ECONOMY.xpPerFare);
      game.audio.coin();
      game.hud.toast(`Penumpang diantar  +$${act.fare.pay}`);
      act.fare = null;
      act.fareCooldown = 8;
      act.passenger.waiting = true;
      act.passenger.group.visible = true;
    }
  } else if (act.passenger.waiting && player.inCar && act.fareCooldown <= 0) {
    const d = Math.hypot(act.passenger.pos.x - px, act.passenger.pos.z - pz);
    if (d < 9) game.hud.setPrompt('Tekan T untuk antar penumpang');
  }

  // --- Coins ------------------------------------------------------------------
  for (const coin of game.world.coins) {
    if (coin.taken) continue;
    coin.mesh.rotation.y += dt * 2.4;
    coin.mesh.position.y = 1.1 + Math.sin(game.elapsed * 2 + coin.x) * 0.25;
    const d = Math.hypot(coin.x - px, coin.z - pz);
    if (d < 2.2) {
      coin.taken = true;
      coin.mesh.visible = false;
      game.money += ECONOMY.coinValue;
      game.addXp(ECONOMY.xpPerCoin);
      act.coinsCollected += 1;
      game.audio.coin();
      game.hud.toast(`Koin Teluk  +$${ECONOMY.coinValue} (${act.coinsCollected}/${ECONOMY.coinCount})`);
      if (act.coinsCollected >= ECONOMY.coinCount) {
        game.money += ECONOMY.coinBonus;
        game.hud.toast(`Semua koin terkumpul! Bonus +$${ECONOMY.coinBonus}`);
      }
    }
  }
}

// Start a taxi fare: the passenger gets in, a destination is picked.
export function startFare(game) {
  const act = game.activities;
  if (act.fare || !act.passenger.waiting || !game.player.inCar || act.fareCooldown > 0) return false;
  const lines = game.world.roads;
  const dest = {
    x: game.rng.pick(lines) + game.rng.range(-6, 6),
    z: game.rng.pick(lines) + game.rng.range(-6, 6),
  };
  act.fare = { dest, pay: game.rng.int(ECONOMY.taxiFareMin, ECONOMY.taxiFareMax) };
  act.passenger.waiting = false;
  act.passenger.group.visible = false;
  game.hud.toast('Penumpang naik. Antar ke tujuan!');
  game.audio.coin();
  return true;
}

// The E-key interaction near shops and landmarks. Returns a prompt label or ''.
export function interactPrompt(game) {
  const player = game.player;
  if (player.inCar) return '';
  const px = player.pos.x;
  const pz = player.pos.z;
  const near = (place, r) => Math.hypot(place.x - px, place.z - pz) < r;
  if (near(PLACES.warung, 7)) return `Makan di Warung ($${ECONOMY.mealPrice}, +${ECONOMY.mealHeal} darah)`;
  if (near(PLACES.gunStore, 7)) {
    return game.ownsPistol ? 'Toko Besi — pistol sudah dibeli' : `Beli pistol ($${ECONOMY.pistolPrice})`;
  }
  if (near(PLACES.garage, 7)) return 'Bengkel Darma — tempat servis';
  return '';
}

// Perform the E-key interaction (called from the input handler).
export function doInteract(game) {
  const player = game.player;
  if (player.inCar) return false;
  const px = player.pos.x;
  const pz = player.pos.z;
  const near = (place, r) => Math.hypot(place.x - px, place.z - pz) < r;
  if (near(PLACES.warung, 7)) {
    if (game.money < ECONOMY.mealPrice) {
      game.hud.toast('Uang tidak cukup untuk makan.');
      return false;
    }
    game.money -= ECONOMY.mealPrice;
    player.health = Math.min(100, player.health + ECONOMY.mealHeal);
    game.audio.coin();
    game.hud.toast(`Makan di warung  +${ECONOMY.mealHeal} darah`);
    return true;
  }
  if (near(PLACES.gunStore, 7) && !game.ownsPistol) {
    if (game.money < ECONOMY.pistolPrice) {
      game.hud.toast('Uang tidak cukup untuk pistol.');
      return false;
    }
    game.money -= ECONOMY.pistolPrice;
    game.ownsPistol = true;
    game.audio.coin();
    game.hud.toast('Pistol dibeli! Klik kiri untuk menembak.');
    return true;
  }
  return false;
}
