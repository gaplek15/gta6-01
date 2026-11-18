// Side activities: taxi fares, golden coins to collect, the gun shop and
// a meal at Mbak Sari's warung.
// One job: give the player ways to earn money between missions.
import * as THREE from 'three';
import { COINS, SHOP, TAXI, WARUNG_HEAL } from './config.js';
import { PLACES } from './world.js';
import { range } from './random.js';

export function createActivities(scene, world, rng) {
  const coins = [];
  const state = {
    taxi: null, // {customer, dest, timer, fare}
    taxiCooldown: 0,
    coinsGot: 0,
    coinBonusPaid: false,
  };

  // Ten golden coins at fixed, memorable spots around the city.
  const coinSpots = [
    [30, 44], [-90, -76], [210, -135], [-210, 165], [90, 224],
    [-150, -196], [-30, 250], [150, 104], [60, -210], [-240, 30],
  ];
  for (const [x, z] of coinSpots) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 0.15, 16),
      new THREE.MeshLambertMaterial({ color: 0xffd94d, emissive: 0xffc21e, emissiveIntensity: 0.8 }),
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, 1.2, z);
    scene.add(mesh);
    coins.push({ mesh, x, z, got: false });
  }

  // Taxi destination marker (reused beam, green instead of yellow).
  const taxiMarker = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  taxiMarker.add(beam);
  taxiMarker.visible = false;
  scene.add(taxiMarker);

  function updateCoins(dt, game) {
    const pos = game.player.inCar ? game.player.inCar.pos : game.player.pos;
    for (const c of coins) {
      if (c.got) continue;
      c.mesh.rotation.y += dt * 3;
      c.mesh.position.y = 1.2 + Math.sin(performance.now() / 250 + c.x) * 0.2;
      if (Math.hypot(pos.x - c.x, pos.z - c.z) < 2.5) {
        c.got = true;
        c.mesh.visible = false;
        state.coinsGot += 1;
        game.player.money += COINS.value;
        game.audio.play('coin');
        game.hud.toast(`Koin Teluk! +$${COINS.value} (${state.coinsGot}/${COINS.total})`);
        if (state.coinsGot === COINS.total && !state.coinBonusPaid) {
          state.coinBonusPaid = true;
          game.player.money += COINS.bonusAll;
          game.hud.toast(`SEMUA KOIN! Bonus +$${COINS.bonusAll}`);
        }
      }
    }
  }

  function startTaxi(game, customer) {
    const dest = world.randomRoadPoint();
    const dist = Math.hypot(dest.x - customer.pos.x, dest.z - customer.pos.z);
    const fare = Math.round((TAXI.fareMin + rng() * (TAXI.fareMax - TAXI.fareMin)) + dist * 0.2);
    state.taxi = { customer, dest, timer: dist * TAXI.timePerMetre + 30, fare, pickedUp: false };
    taxiMarker.position.set(dest.x, 0, dest.z);
    taxiMarker.visible = false;
    game.hud.toast('Penumpang naik! Antar ke tujuan hijau.');
    game.audio.play('pickup');
  }

  function updateTaxi(dt, game) {
    if (state.taxiCooldown > 0) state.taxiCooldown -= dt;
    const t = state.taxi;
    if (!t) return;
    const car = game.player.inCar;
    if (!t.pickedUp) {
      // Waiting for the player to drive up in a car.
      if (car) {
        const d = Math.hypot(car.pos.x - t.customer.pos.x, car.pos.z - t.customer.pos.z);
        if (d < 5) {
          t.pickedUp = true;
          game.traffic.removePed(t.customer);
          taxiMarker.visible = true;
          game.hud.toast('Penumpang naik! Antar ke tujuan hijau.');
        }
      }
      return;
    }
    t.timer -= dt;
    if (t.timer <= 0) {
      state.taxi = null;
      taxiMarker.visible = false;
      state.taxiCooldown = 20;
      game.hud.toast('Penumpang kesal dan turun. Taksi gagal.');
      return;
    }
    if (car) {
      const d = Math.hypot(car.pos.x - t.dest.x, car.pos.z - t.dest.z);
      if (d < 7) {
        game.player.money += t.fare;
        game.player.xp += 20;
        game.audio.play('mission');
        game.hud.toast(`Taksi selesai! +$${t.fare}`);
        state.taxi = null;
        taxiMarker.visible = false;
        state.taxiCooldown = 10;
        game.saveGame();
      }
    }
  }

  function taxiObjective() {
    const t = state.taxi;
    if (!t) return null;
    return t.pickedUp
      ? { text: `Antar penumpang (${Math.ceil(t.timer)} dtk)`, pos: t.dest }
      : { text: 'Jemput penumpang (naik mobil dulu)', pos: { x: t.customer.pos.x, z: t.customer.pos.z } };
  }

  // The gun shop and the warung are places the player walks up to and uses.
  function nearShop(game) {
    const p = game.player.pos;
    return Math.hypot(p.x - PLACES.gunshop.x, p.z - PLACES.gunshop.z) < 8;
  }

  function nearWarung(game) {
    const p = game.player.pos;
    return Math.hypot(p.x - PLACES.warung.x, p.z - PLACES.warung.z) < 8;
  }

  function buyPistol(game) {
    if (game.player.pistol) {
      if (game.player.money >= SHOP.ammoPrice) {
        game.player.money -= SHOP.ammoPrice;
        game.player.ammo += SHOP.ammoAmount;
        game.hud.toast(`Beli peluru +${SHOP.ammoAmount} (-$${SHOP.ammoPrice})`);
        game.audio.play('pickup');
      } else {
        game.hud.toast('Uang tidak cukup untuk peluru.');
      }
      return;
    }
    if (game.player.money >= SHOP.pistolPrice) {
      game.player.money -= SHOP.pistolPrice;
      game.player.pistol = true;
      game.player.ammo = SHOP.ammoAmount;
      game.hud.toast(`Pistol dibeli! (-$${SHOP.pistolPrice}) Klik kiri untuk menembak.`);
      game.audio.play('pickup');
    } else {
      game.hud.toast(`Pistol $${SHOP.pistolPrice} — uangmu belum cukup.`);
    }
  }

  function eatAtWarung(game) {
    if (game.player.health >= 100) {
      game.hud.toast('Mbak Sari: "Kamu sehat-sehat saja, Raka."');
      return;
    }
    if (game.player.money < SHOP.mealPrice) {
      game.hud.toast('Makan di warung $20 — uangmu tidak cukup.');
      return;
    }
    game.player.money -= SHOP.mealPrice;
    game.player.health = Math.min(100, game.player.health + WARUNG_HEAL);
    game.hud.toast(`Makan di Warung Mbak Sari +${WARUNG_HEAL} darah (-$${SHOP.mealPrice})`);
    game.audio.play('pickup');
  }

  function update(dt, game) {
    updateCoins(dt, game);
    updateTaxi(dt, game);
  }

  return {
    state,
    coins,
    update,
    startTaxi,
    taxiObjective,
    nearShop,
    nearWarung,
    buyPistol,
    eatAtWarung,
  };
}
