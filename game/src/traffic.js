// Traffic: AI cars that drive the road grid and pedestrians that walk the
// sidewalks, flee from trouble, and sometimes hail a taxi.
// One job: make the city feel alive around the player.
import * as THREE from 'three';
import { CAR, WANTED } from './config.js';
import { createVehicle, driveVehicle, randomCarColor } from './vehicles.js';
import { makePersonMesh, SHIRT_COLORS } from './player.js';
import { ROAD_COORDS } from './world.js';
import { pick, range } from './random.js';

const TRAFFIC_COUNT = 12;
const PED_COUNT = 18;

function nearestRoadCoord(v) {
  let best = ROAD_COORDS[0];
  let bestD = Infinity;
  for (const c of ROAD_COORDS) {
    const d = Math.abs(c - v);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function createTraffic(scene, world, rng) {
  const cars = [];
  const peds = [];

  function spawnCar(useRng) {
    const r = useRng || rng;
    const p = world.randomRoadPoint();
    const horizontal = Math.abs(p.z - nearestRoadCoord(p.z)) < 1;
    const heading = horizontal ? (r() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (r() < 0.5 ? 0 : Math.PI);
    const type = r() < 0.14 ? 'taxi' : (r() < 0.12 ? 'van' : 'sedan');
    const color = type === 'taxi' ? 0xffd94d : randomCarColor(r);
    const v = createVehicle(scene, type, color, p.x, p.z, heading);
    v.kind = 'traffic';
    v.cruise = range(r, 8, 12);
    v.wait = 0;
    cars.push(v);
    return v;
  }

  function spawnPed(x, z) {
    const mesh = makePersonMesh(pick(rng, SHIRT_COLORS), pick(rng, [0xc98a5a, 0x8a5a3a, 0xe8b88a]), pick(rng, [0x2c3e50, 0x5a4a3a, 0x3a3a3a]));
    mesh.position.set(x, 0, z);
    mesh.scale.y = range(rng, 0.92, 1.08);
    scene.add(mesh);
    const ped = {
      mesh,
      pos: mesh.position,
      yaw: range(rng, 0, Math.PI * 2),
      speed: range(rng, 1.2, 2.2),
      walkPhase: range(rng, 0, 6),
      flee: 0,
      fleeFrom: new THREE.Vector3(),
      taxi: false, // wants a taxi ride
      health: 30,
      dead: false,
    };
    peds.push(ped);
    return ped;
  }

  function reset(newRng) {
    const useRng = newRng || rng;
    for (const c of cars) c.remove();
    for (const p of peds) scene.remove(p.mesh);
    cars.length = 0;
    peds.length = 0;
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) spawnCar(useRng);
    for (let i = 0; i < PED_COUNT; i += 1) {
      const p = world.randomRoadPoint();
      spawnPed(p.x + range(useRng, -12, 12), p.z + range(useRng, -12, 12));
    }
    // One pedestrian always wants a taxi, somewhere near the plaza.
    const taxiPed = peds[0];
    taxiPed.taxi = true;
    taxiPed.pos.set(24, 0, 44);
  }

  // A traffic car follows its road; at each intersection it may turn.
  function updateCar(v, dt, playerCar, police) {
    if (v.wait > 0) {
      v.wait -= dt;
      return;
    }
    // Slow down for the car ahead (player or traffic).
    let ahead = 0;
    const fx = Math.sin(v.heading);
    const fz = Math.cos(v.heading);
    const all = playerCar ? [...cars, playerCar] : cars;
    for (const o of all) {
      if (o === v) continue;
      const dx = o.pos.x - v.pos.x;
      const dz = o.pos.z - v.pos.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < 12 && side < 2.5) ahead = Math.max(ahead, 12 - along);
    }
    const target = Math.max(0, v.cruise - ahead);
    const throttle = v.speed < target ? 0.7 : 0;
    driveVehicle(v, dt, throttle, 0, false, world);
    // At an intersection (near both a vertical and a horizontal road), turn.
    const onX = Math.abs(v.pos.x - nearestRoadCoord(v.pos.x)) < 1.5;
    const onZ = Math.abs(v.pos.z - nearestRoadCoord(v.pos.z)) < 1.5;
    if (onX && onZ && rng() < dt * 0.5) {
      const options = [0, Math.PI / 2, -Math.PI / 2, Math.PI];
      const current = Math.round(v.heading / (Math.PI / 2)) % 4;
      const turn = pick(rng, options.filter((o) => o !== options[current]));
      v.heading = turn;
      v.wait = range(rng, 0, 1.5);
    }
    // Respawns far from the player so traffic never runs out.
    if (police && police.playerPos) {
      const d = Math.hypot(v.pos.x - police.playerPos.x, v.pos.z - police.playerPos.z);
      if (d > 320) {
        const p = world.randomRoadPoint();
        v.pos.set(p.x, 0, p.z);
        v.speed = 0;
      }
    }
  }

  function updatePed(ped, dt, dangerPos, dangerRadius) {
    if (ped.dead) return;
    const u = ped.mesh.userData;
    if (dangerPos && ped.pos.distanceTo(dangerPos) < dangerRadius) {
      ped.flee = 2.5;
      ped.fleeFrom.copy(dangerPos);
    }
    let mx = 0;
    let mz = 0;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const dx = ped.pos.x - ped.fleeFrom.x;
      const dz = ped.pos.z - ped.fleeFrom.z;
      const len = Math.hypot(dx, dz) || 1;
      mx = (dx / len) * 5;
      mz = (dz / len) * 5;
    } else {
      mx = Math.sin(ped.yaw) * ped.speed;
      mz = Math.cos(ped.yaw) * ped.speed;
      if (rng() < dt * 0.08) ped.yaw = range(rng, 0, Math.PI * 2);
    }
    ped.pos.x += mx * dt;
    ped.pos.z += mz * dt;
    world.resolveCircle(ped.pos, 0.5);
    if (mx !== 0 || mz !== 0) ped.yaw = Math.atan2(mx, mz);
    ped.walkPhase += dt * (ped.flee > 0 ? 12 : 7);
    const swing = Math.sin(ped.walkPhase) * 0.5;
    ped.mesh.position.copy(ped.pos);
    ped.mesh.rotation.y = ped.yaw;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.7;
    u.armR.rotation.x = swing * 0.7;
  }

  function nearestPed(pos, maxDist, filter) {
    let best = null;
    let bestD = maxDist;
    for (const p of peds) {
      if (p.dead || (filter && !filter(p))) continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function scarePeds(pos, radius) {
    for (const p of peds) {
      if (p.dead) continue;
      if (p.pos.distanceTo(pos) < radius) {
        p.flee = 2.5;
        p.fleeFrom.copy(pos);
      }
    }
  }

  function update(dt, playerCar, playerPos, danger) {
    for (const v of cars) updateCar(v, dt, playerCar, { playerPos });
    for (const p of peds) updatePed(p, dt, danger ? danger.pos : null, danger ? danger.radius : 0);
    // Car-car bumps: push overlapping traffic cars apart.
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.01 && d < CAR.radius * 2) {
          const push = (CAR.radius * 2 - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          a.pos.x -= nx * push;
          a.pos.z -= nz * push;
          b.pos.x += nx * push;
          b.pos.z += nz * push;
        }
      }
    }
  }

  reset();
  return {
    cars,
    peds,
    reset,
    spawnCar,
    spawnPed,
    update,
    nearestPed,
    scarePeds,
    removeCar(v) {
      const i = cars.indexOf(v);
      if (i >= 0) cars.splice(i, 1);
      v.remove();
    },
    removePed(ped) {
      const i = peds.indexOf(ped);
      if (i >= 0) peds.splice(i, 1);
      scene.remove(ped.mesh);
    },
  };
}

export { WANTED };
