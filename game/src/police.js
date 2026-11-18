// The wanted system: heat, stars, police cars that chase and ram, foot
// cops that chase and arrest, and the busted screen.
// One job: make crime have consequences.
import * as THREE from 'three';
import { POLICE, WANTED } from './config.js';
import { createVehicle, driveVehicle, flashSiren } from './vehicles.js';
import { makePersonMesh } from './player.js';
import { range } from './random.js';

export function createPolice(scene, world, rng) {
  const state = {
    heat: 0,
    stars: 0,
    cars: [],
    cops: [],
    arrestTimer: 0,
    busted: false,
    sirenOn: false,
  };

  function stars() {
    return Math.min(WANTED.maxStars, Math.floor(state.heat / WANTED.heatPerStar));
  }

  function addHeat(amount) {
    state.heat = Math.min(WANTED.maxStars * WANTED.heatPerStar + 19, state.heat + amount);
  }

  function spawnPoliceCar(playerPos) {
    const angle = range(rng, 0, Math.PI * 2);
    const x = playerPos.x + Math.cos(angle) * POLICE.spawnDistance;
    const z = playerPos.z + Math.sin(angle) * POLICE.spawnDistance;
    const p = world.randomRoadPoint();
    const v = createVehicle(scene, 'police', 0xf2f5f0, p.x, p.z, 0);
    v.kind = 'police';
    v.pos.set(p.x, 0, p.z);
    state.cars.push(v);
    return v;
  }

  function spawnCop(playerPos) {
    const angle = range(rng, 0, Math.PI * 2);
    const x = playerPos.x + Math.cos(angle) * 12;
    const z = playerPos.z + Math.sin(angle) * 12;
    const mesh = makePersonMesh(0x1e4a8a, 0xc98a5a, 0x1e2a3a, 0x1e2a3a); // dark blue cap
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const cop = {
      mesh,
      pos: mesh.position,
      yaw: 0,
      walkPhase: 0,
      punchTimer: 0,
      health: 50,
      dead: false,
    };
    state.cops.push(cop);
    return cop;
  }

  function nearestPoliceDistance(playerPos) {
    let best = Infinity;
    for (const v of state.cars) best = Math.min(best, v.pos.distanceTo(playerPos));
    for (const c of state.cops) {
      if (!c.dead) best = Math.min(best, c.pos.distanceTo(playerPos));
    }
    return best;
  }

  function update(dt, player, playerCar) {
    const playerPos = playerCar ? playerCar.pos : player.pos;
    const s = stars();
    state.stars = s;
    state.sirenOn = s > 0;

    // Heat decays when the police cannot see the player.
    const seen = nearestPoliceDistance(playerPos) < 45;
    const decay = seen ? WANTED.decayPerSec : WANTED.decayHiddenPerSec;
    if (s > 0) state.heat = Math.max(0, state.heat - decay * dt);

    // Spawn to match the wanted level.
    const wantCars = Math.min(POLICE.maxCars, s);
    while (state.cars.length < wantCars) spawnPoliceCar(playerPos);
    while (state.cars.length > wantCars) {
      const v = state.cars.pop();
      v.remove();
    }
    const wantCops = s >= 2 ? Math.min(POLICE.maxCops, s) : 0;
    while (state.cops.filter((c) => !c.dead).length < wantCops) spawnCop(playerPos);

    // Police cars: steer toward the player and ram.
    for (const v of state.cars) {
      const dx = playerPos.x - v.pos.x;
      const dz = playerPos.z - v.pos.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - v.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, dh * 1.6));
      driveVehicle(v, dt, 1, steer, false, world);
      flashSiren(v, dt);
      // Ram the player's car: only a real rear-end hit slows it, and gently
      // (a fixed deceleration while in contact, not a per-frame multiplier).
      if (playerCar && dist < 4.5 && v.speed > playerCar.speed) {
        playerCar.speed = Math.max(0, playerCar.speed - 3 * dt);
        playerCar.health -= 2 * dt;
      }
      // A police car far away despawns and respawns closer.
      if (dist > 240) {
        const p = world.randomRoadPoint();
        v.pos.set(p.x, 0, p.z);
        v.speed = 0;
      }
    }

    // Foot cops: run at the player, punch up close, arrest if they hold on.
    let arresting = false;
    for (const cop of state.cops) {
      if (cop.dead) continue;
      const dx = player.pos.x - cop.pos.x;
      const dz = player.pos.z - cop.pos.z;
      const dist = Math.hypot(dx, dz);
      if (playerCar) {
        // Cops cannot arrest a driver; they run after the car and fall behind,
        // and they never get closer than 4 m — they cannot climb onto a car.
        const dx = playerCar.pos.x - cop.pos.x;
        const dz = playerCar.pos.z - cop.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 50 && dist > 4) {
          cop.pos.x += (dx / dist) * POLICE.copSpeed * dt;
          cop.pos.z += (dz / dist) * POLICE.copSpeed * dt;
          cop.yaw = Math.atan2(dx, dz);
          cop.walkPhase += dt * 12;
          const swing = Math.sin(cop.walkPhase) * 0.7;
          const u = cop.mesh.userData;
          u.legL.rotation.x = swing;
          u.legR.rotation.x = -swing;
        }
        world.resolveCircle(cop.pos, 0.5);
        cop.mesh.position.copy(cop.pos);
        cop.mesh.rotation.y = cop.yaw;
        continue;
      }
      if (dist > 1.8) {
        const speed = POLICE.copSpeed;
        cop.pos.x += (dx / dist) * speed * dt;
        cop.pos.z += (dz / dist) * speed * dt;
        cop.yaw = Math.atan2(dx, dz);
        cop.walkPhase += dt * 12;
        const swing = Math.sin(cop.walkPhase) * 0.7;
        const u = cop.mesh.userData;
        u.legL.rotation.x = swing;
        u.legR.rotation.x = -swing;
        u.armL.rotation.x = -swing * 0.7;
        u.armR.rotation.x = swing * 0.7;
      } else {
        arresting = true;
        cop.punchTimer -= dt;
        if (cop.punchTimer <= 0) {
          cop.punchTimer = 1.0;
          cop.mesh.userData.armR.rotation.x = -1.6;
          player.health = Math.max(0, player.health - 8);
        }
      }
      world.resolveCircle(cop.pos, 0.5);
      cop.mesh.position.copy(cop.pos);
      cop.mesh.rotation.y = cop.yaw;
    }
    if (arresting && !playerCar) {
      state.arrestTimer += dt;
      if (state.arrestTimer >= POLICE.arrestSeconds) {
        state.busted = true;
        state.arrestTimer = 0;
      }
    } else {
      state.arrestTimer = Math.max(0, state.arrestTimer - dt * 2);
    }
    return state;
  }

  function clearWanted() {
    state.heat = 0;
    state.stars = 0;
    state.arrestTimer = 0;
    state.busted = false;
    for (const v of state.cars) v.remove();
    for (const c of state.cops) scene.remove(c.mesh);
    state.cars.length = 0;
    state.cops.length = 0;
  }

  function reset() {
    clearWanted();
  }

  return {
    state,
    stars,
    addHeat,
    update,
    clearWanted,
    reset,
    nearestPoliceDistance,
  };
}
