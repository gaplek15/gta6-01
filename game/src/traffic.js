// Traffic: AI cars cruising the road grid (axis-aligned, right-hand side,
// stopping at red lights, keeping distance) and pedestrians strolling the
// sidewalks who flee when scared.
import * as THREE from 'three';
import { CITY, roadCoord, TRAFFIC, PALETTE } from './config.js';
import { createCar, placeCar } from './vehicles.js';
import { makeHuman, walkSecondary, SKIN_TONES, HAIR_COLORS } from './human.js';

// A person built by human.js: real proportions (~1.76 m tall, head ~1/7.6),
// two-segment limbs with knees and elbows, a face, hair/caps, varied
// outfits. Same { group, parts } shape the walk code already uses
// (legL/legR hip pivots, armL/armR shoulder pivots), so every caller
// (pedestrians, cops, taxi passenger) gets a human for free.
export function makePerson(game, opts = {}) {
  const h = makeHuman(game, opts);
  return { group: h.group, parts: h.parts };
}

const PED_SHIRTS = [0xd35400, 0x2471a3, 0x1e8449, 0x7d3c98, 0xc0392b, 0x2e86c1, 0xd4ac0d, 0xecf0f1, 0x16a085, 0x943126];
const PED_PANTS = [0x2c3e50, 0x5d6d7e, 0x1a1a1a, 0x6e5100, 0x4a235a];

export function createTraffic(game) {
  const traffic = { cars: [], peds: [] };
  const rng = game.rng;
  const lines = game.world.roads;

  // --- AI cars ------------------------------------------------------------
  const types = ['sedan', 'hatch', 'sedan', 'pickup', 'taxi', 'sedan', 'hatch', 'taxi', 'sedan', 'pickup', 'sedan', 'hatch'];
  for (let i = 0; i < TRAFFIC.cars; i += 1) {
    const type = types[i % types.length];
    const color = type === 'taxi' || type === 'police' ? undefined : rng.pick(PALETTE.carPaint);
    const car = createCar(game, type, color);
    const road = rng.pick(lines);
    const along = rng.range(-170, 170);
    const vertical = rng.chance(0.5);
    const dir = rng.sign();
    const x = vertical ? road + dir * 2.8 : along;
    const z = vertical ? along : road + dir * 2.8;
    // Heading: forward is local -Z, so heading = atan2(-fx, -fz).
    const fx = vertical ? 0 : dir;
    const fz = vertical ? dir : 0;
    const heading = Math.atan2(-fx, -fz);
    placeCar(game, car, x, z, heading);
    car.speed = rng.range(7, 11);
    traffic.cars.push({
      car,
      speed: car.speed,
      target: pickNextIntersection(game, x, z),
      wait: 0,
      vertical,
      dir,
    });
  }

  // --- Parked cars --------------------------------------------------------
  for (const spot of game.world.parkedSpots) {
    const type = rng.pick(['sedan', 'hatch', 'pickup']);
    const car = createCar(game, type, rng.pick(PALETTE.carPaint));
    placeCar(game, car, spot.x, spot.z, spot.rotY);
    car.speed = 0;
    traffic.cars.push({ car, speed: 0, target: null, wait: 0, vertical: true, dir: 1, parked: true });
  }
  // The red Komet Merah sports car at the mall (mission 2 target).
  const sports = createCar(game, 'sports', 0xc0392b);
  placeCar(game, sports, 188, -28, Math.PI / 2);
  sports.speed = 0;
  traffic.cars.push({ car: sports, speed: 0, target: null, wait: 0, vertical: true, dir: 1, parked: true, missionCar: true });
  game.missionCar = sports;

  // --- Pedestrians --------------------------------------------------------
  for (let i = 0; i < TRAFFIC.peds; i += 1) {
    const road = rng.pick(lines);
    const along = rng.range(-170, 170);
    const side = rng.sign();
    const vertical = rng.chance(0.5);
    const x = vertical ? road + side * 9.2 : along;
    const z = vertical ? along : road + side * 9.2;
    const female = rng.chance(0.3);
    const headwear = rng.chance(0.3)
      ? { hat: rng.pick([0x2c3e50, 0x7d3c98, 0xd4ac0d]) }
      : rng.chance(0.25) ? { cap: rng.pick([0xc0392b, 0x2471a3, 0x1e8449]) } : {};
    const person = makePerson(game, {
      skin: rng.pick(SKIN_TONES),
      shirt: rng.pick(PED_SHIRTS),
      pants: rng.pick(PED_PANTS),
      hair: rng.pick(HAIR_COLORS),
      longHair: female && rng.chance(0.7),
      shortSleeve: rng.chance(0.5),
      scale: rng.range(0.94, 1.06),
      ...headwear,
    });
    person.group.position.set(x, 0, z);
    traffic.peds.push({
      ...person,
      pos: new THREE.Vector3(x, 0, z),
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.1, 1.8),
      target: null,
      phase: rng.range(0, Math.PI * 2),
      health: 100,
      down: false,
      fled: false,
      fleeTimer: 0,
      stagger: 0,
    });
  }
  return traffic;
}

function pickNextIntersection(game, x, z) {
  // Nearest road crossing, then a random neighbour along the grid.
  const lines = game.world.roads;
  let nx = lines[0];
  let nz = lines[0];
  for (const l of lines) {
    if (Math.abs(l - x) < Math.abs(nx - x)) nx = l;
    if (Math.abs(l - z) < Math.abs(nz - z)) nz = l;
  }
  const ix = lines.indexOf(nx);
  const iz = lines.indexOf(nz);
  const horiz = game.rng.chance(0.5);
  let tx = nx;
  let tz = nz;
  if (horiz) {
    const ni = Math.max(0, Math.min(lines.length - 1, ix + game.rng.sign()));
    tx = lines[ni];
  } else {
    const ni = Math.max(0, Math.min(lines.length - 1, iz + game.rng.sign()));
    tz = lines[ni];
  }
  return { x: tx, z: tz };
}

export function updateTraffic(game, dt) {
  const { traffic, world } = game;
  const player = game.player;

  for (const t of traffic.cars) {
    if (t.parked) continue;
    const car = t.car;
    if (t.wait > 0) {
      t.wait -= dt;
      car.speed = Math.max(0, car.speed - 20 * dt);
    } else {
      car.speed += (t.speed - car.speed) * Math.min(1, dt * 0.8);
    }
    // Red light ahead? Hold before the intersection.
    const ahead = lightAhead(game, car);
    if (ahead === 'red') {
      car.speed = Math.max(0, car.speed - 26 * dt);
      if (car.speed < 0.4) t.wait = 0.6;
    }
    // Keep distance from the car ahead and from the player's car.
    for (const o of traffic.cars) {
      if (o === t || o.parked) continue;
      const dx = o.car.pos.x - car.pos.x;
      const dz = o.car.pos.z - car.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 7 && d > 0.01) {
        const fx = -Math.sin(car.heading);
        const fz = -Math.cos(car.heading);
        if (dx * fx + dz * fz > 0) car.speed = Math.min(car.speed, Math.max(0, o.car.speed - 1));
      }
    }
    if (player.inCar) {
      const pc = player.inCar;
      const dx = pc.pos.x - car.pos.x;
      const dz = pc.pos.z - car.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 8) {
        const fx = -Math.sin(car.heading);
        const fz = -Math.cos(car.heading);
        if (dx * fx + dz * fz > 0) car.speed = Math.min(car.speed, 2);
      }
    }
    // Steer toward the target intersection, axis-aligned with a right-side offset.
    if (t.target) {
      const right = { x: -Math.cos(car.heading), z: Math.sin(car.heading) };
      const tx = t.target.x + right.x * 2.8;
      const tz = t.target.z + right.z * 2.8;
      const dx = tx - car.pos.x;
      const dz = tz - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) {
        t.target = pickNextIntersection(game, car.pos.x, car.pos.z);
      } else {
        // Move along the dominant axis only, so the car stays on roads.
        let mx = 0;
        let mz = 0;
        if (Math.abs(dx) > Math.abs(dz)) mx = Math.sign(dx);
        else mz = Math.sign(dz);
        const wantHeading = Math.atan2(-mx, -mz);
        let d = wantHeading - car.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        car.heading += d * Math.min(1, dt * 2.2);
        const fx = -Math.sin(car.heading);
        const fz = -Math.cos(car.heading);
        car.pos.x += fx * car.speed * dt;
        car.pos.z += fz * car.speed * dt;
      }
    }
    const [cx, cz] = world.collide(car.pos.x, car.pos.z, 1.7);
    car.pos.x = cx;
    car.pos.z = cz;
    car.group.position.copy(car.pos);
    car.group.rotation.y = car.heading;
    for (const w of car.wheels) w.spin.rotation.x += (car.speed * dt) / 0.36;
  }

  // --- Pedestrians ----------------------------------------------------------
  for (const ped of traffic.peds) {
    if (ped.down) continue;
    if (ped.stagger > 0) {
      ped.stagger -= dt;
      continue;
    }
    // Flee from the player when crimes happen nearby.
    const dp = Math.hypot(ped.pos.x - player.pos.x, ped.pos.z - player.pos.z);
    if (game.police.wanted > 0 && dp < 14 && !ped.fled) {
      ped.fled = true;
      ped.fleeTimer = 4;
    }
    if (ped.fleeTimer > 0) {
      ped.fleeTimer -= dt;
      const away = Math.atan2(ped.pos.x - player.pos.x, ped.pos.z - player.pos.z);
      ped.pos.x += Math.sin(away) * 4.4 * dt;
      ped.pos.z += Math.cos(away) * 4.4 * dt;
      ped.heading = away + Math.PI;
      if (ped.fleeTimer <= 0) ped.fled = false;
    } else {
      if (!ped.target || Math.hypot(ped.target.x - ped.pos.x, ped.target.z - ped.pos.z) < 3) {
        const road = game.rng.pick(game.world.roads);
        const along = game.rng.range(-170, 170);
        const side = game.rng.sign();
        const vertical = game.rng.chance(0.5);
        ped.target = {
          x: vertical ? road + side * 9.2 : along,
          z: vertical ? along : road + side * 9.2,
        };
      }
      const dx = ped.target.x - ped.pos.x;
      const dz = ped.target.z - ped.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.05) {
        ped.pos.x += (dx / d) * ped.speed * dt;
        ped.pos.z += (dz / d) * ped.speed * dt;
        ped.heading = Math.atan2(dx, dz) + Math.PI;
      }
    }
    const [cx, cz] = world.collide(ped.pos.x, ped.pos.z, 0.5);
    ped.pos.x = cx;
    ped.pos.z = cz;
    ped.phase += dt * ped.speed * 4.4;
    const swing = Math.sin(ped.phase) * 0.5;
    ped.parts.legL.rotation.x = swing;
    ped.parts.legR.rotation.x = -swing;
    ped.parts.armL.rotation.x = -swing * 0.7;
    ped.parts.armR.rotation.x = swing * 0.7;
    // Knees bend, elbows keep a soft bend, the body bobs (human.js).
    walkSecondary(ped.parts, ped.phase, ped.fleeTimer > 0 ? 0.7 : 0.5);
    ped.group.position.copy(ped.pos);
    ped.group.rotation.y = ped.heading;
  }
}

// Is the traffic light ahead of this car red for its direction of travel?
function lightAhead(game, car) {
  const fx = -Math.sin(car.heading);
  const fz = -Math.cos(car.heading);
  for (const l of game.world.trafficLights) {
    const dx = l.x - car.pos.x;
    const dz = l.z - car.pos.z;
    const ahead = dx * fx + dz * fz;
    if (ahead > 0 && ahead < 16 && Math.abs(dx * fz - dz * fx) < 8) {
      // phase 0: z-axis (north-south) green; phase 1: x-axis green.
      const travellingZ = Math.abs(fz) > Math.abs(fx);
      const greenForMe = travellingZ ? l.phase === 0 : l.phase === 1;
      return greenForMe ? 'green' : 'red';
    }
  }
  return null;
}

// Cycle the traffic lights.
export function updateTrafficLights(game, dt) {
  for (const l of game.world.trafficLights) {
    l.timer += dt;
    const cycle = l.timer % 15;
    const nextPhase = cycle < 7 ? 0 : 1;
    const amber = (cycle >= 6 && cycle < 7) || (cycle >= 13 && cycle < 14);
    if (nextPhase !== l.phase) {
      l.phase = nextPhase;
    }
    const nsGreen = l.phase === 0;
    l.red.material.emissiveIntensity = nsGreen ? 0.15 : 2.2;
    l.green.material.emissiveIntensity = nsGreen ? 2.2 : 0.15;
    l.amber.material.emissiveIntensity = amber ? 2.2 : 0.15;
  }
}
