// Wanted level and police: stars rise with crimes and decay when the
// player lays low; police cars chase and ram, foot cops run the player down
// and bust them. Busted means a fine and a respawn at the police station.
import * as THREE from 'three';
import { TUNE, ECONOMY, PLACES } from './config.js';
import { createCar, placeCar } from './vehicles.js';
import { makePerson } from './traffic.js';
import { walkSecondary } from './human.js';

export function createPolice(game) {
  return {
    wanted: 0,
    decayTimer: TUNE.wantedDecaySeconds,
    cars: [],
    cops: [],
    bustTimer: 0,
    addWanted(n) {
      const before = this.wanted;
      this.wanted = Math.max(0, Math.min(5, this.wanted + n));
      if (this.wanted > before) this.decayTimer = TUNE.wantedDecaySeconds;
      game.hud.flashStars();
    },
  };
}

function spawnPoliceCar(game) {
  const car = createCar(game, 'police');
  // Spawn on a road near the player, a little way off.
  const p = game.player.pos;
  const angle = game.rng.range(0, Math.PI * 2);
  const dist = game.rng.range(45, 70);
  const x = p.x + Math.cos(angle) * dist;
  const z = p.z + Math.sin(angle) * dist;
  const road = game.world.roads.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
  placeCar(game, car, road, z, 0);
  car.speed = 10;
  game.police.cars.push({ car, ramCooldown: 0, holdTime: 0 });
  return car;
}

function spawnCop(game) {
  const p = game.player.pos;
  const angle = game.rng.range(0, Math.PI * 2);
  const dist = game.rng.range(18, 30);
  const person = makePerson(game, {
    shirt: 0x1a3a8a, pants: 0x14181d, cap: 0x1a3a8a, skin: 0xb57748,
    badge: true, belt: true,
  });
  const x = p.x + Math.cos(angle) * dist;
  const z = p.z + Math.sin(angle) * dist;
  person.group.position.set(x, 0, z);
  const cop = {
    ...person,
    pos: new THREE.Vector3(x, 0, z),
    heading: 0,
    phase: 0,
    health: 100,
    down: false,
    stagger: 0,
  };
  game.police.cops.push(cop);
  return cop;
}

export function updatePolice(game, dt) {
  const police = game.police;
  const player = game.player;

  // Wanted decay: lay low and the heat cools off.
  if (police.wanted > 0) {
    let nearest = 1e9;
    for (const c of police.cops) nearest = Math.min(nearest, Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z));
    for (const c of police.cars) nearest = Math.min(nearest, Math.hypot(c.car.pos.x - player.pos.x, c.car.pos.z - player.pos.z));
    if (nearest > 30) {
      police.decayTimer -= dt;
      if (police.decayTimer <= 0) {
        police.wanted = Math.max(0, police.wanted - 1);
        police.decayTimer = TUNE.wantedDecaySeconds;
      }
    } else {
      police.decayTimer = TUNE.wantedDecaySeconds;
    }
  }

  // Keep the right number of police cars and foot cops on the street.
  const wantCars = police.wanted === 0 ? 0 : Math.min(3, police.wanted);
  const wantCops = police.wanted === 0 ? 0 : Math.min(3, police.wanted);
  while (police.cars.length < wantCars) spawnPoliceCar(game);
  while (police.cops.length < wantCops) spawnCop(game);

  // Police cars chase the player and ram.
  for (const pc of [...police.cars]) {
    const car = pc.car;
    pc.ramCooldown = Math.max(0, pc.ramCooldown - dt);
    const tx = player.inCar ? player.inCar.pos.x : player.pos.x;
    const tz = player.inCar ? player.inCar.pos.z : player.pos.z;
    const dx = tx - car.pos.x;
    const dz = tz - car.pos.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(-dx, -dz);
    let d = wantHeading - car.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    car.heading += d * Math.min(1, dt * 1.6);
    car.speed += ((dist > 12 ? TUNE.policeCarSpeed : 16) - car.speed) * Math.min(1, dt * 0.7);
    const fx = -Math.sin(car.heading);
    const fz = -Math.cos(car.heading);
    car.pos.x += fx * car.speed * dt;
    car.pos.z += fz * car.speed * dt;
    const [cx, cz] = game.world.collide(car.pos.x, car.pos.z, 1.7);
    car.pos.x = cx;
    car.pos.z = cz;
    car.group.position.copy(car.pos);
    car.group.rotation.y = car.heading;
    for (const w of car.wheels) w.spin.rotation.x += (car.speed * dt) / 0.36;
    // Ram the player's car or knock the player down.
    if (dist < 4.2 && pc.ramCooldown <= 0) {
      pc.ramCooldown = 1.2;
      if (player.inCar) {
        player.inCar.speed *= 0.45;
        game.audio.crash();
        game.hud.toast('Polisi menabrakmu!');
      } else {
        player.health -= 12;
        player.pos.x += fx * 2.5;
        player.pos.z += fz * 2.5;
        game.audio.crash();
        game.hud.toast('Kamu ditabrak mobil polisi!');
        if (player.health <= 0) game.wasted();
      }
    }
    // Held slow by a police car while wanted = busted: if the player's
    // car is under 3 m/s with a police car right on it for 1.5 s, the
    // chase is over. The player can always floor it to break the hold.
    if (player.inCar && dist < 4.5 && Math.abs(player.inCar.speed) < 3) {
      pc.holdTime += dt;
      if (pc.holdTime > 1.5) { game.busted(); return; }
    } else {
      pc.holdTime = 0;
    }
    // Despawn when the heat is off and the car is far away.
    if (police.wanted === 0 && dist > 90) {
      game.scene.remove(car.group);
      police.cars.splice(police.cars.indexOf(pc), 1);
    }
  }

  // Foot cops run the player down; touching the player on foot = busted.
  for (const cop of [...police.cops]) {
    if (cop.down) continue;
    if (cop.stagger > 0) {
      cop.stagger -= dt;
      continue;
    }
    const dx = player.pos.x - cop.pos.x;
    const dz = player.pos.z - cop.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.1) {
      cop.pos.x += (dx / dist) * TUNE.copRunSpeed * dt;
      cop.pos.z += (dz / dist) * TUNE.copRunSpeed * dt;
      cop.heading = Math.atan2(dx, dz) + Math.PI;
    }
    cop.phase += dt * 9;
    const swing = Math.sin(cop.phase) * 0.7;
    cop.parts.legL.rotation.x = swing;
    cop.parts.legR.rotation.x = -swing;
    cop.parts.armL.rotation.x = -swing * 0.7;
    cop.parts.armR.rotation.x = swing * 0.7;
    // Running knees + elbows (human.js).
    walkSecondary(cop.parts, cop.phase, 0.7);
    cop.group.position.copy(cop.pos);
    cop.group.rotation.y = cop.heading;
    if (!player.inCar && dist < TUNE.copCatchDistance) {
      game.busted();
      return;
    }
    if (police.wanted === 0 && dist > 90) {
      game.scene.remove(cop.group);
      police.cops.splice(police.cops.indexOf(cop), 1);
    }
  }

  game.audio.setSiren(police.wanted > 0);
}
