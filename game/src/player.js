// The player on foot: Raka built by human.js — real proportions (~1.76 m,
// head ~1/7.6), two-segment limbs, a face, orange ojek shirt, red cap and
// green delivery backpack. Walk/run/jump, punch and pistol combat, entering
// and exiting cars, and the third-person camera.
import * as THREE from 'three';
import { TUNE } from './config.js';
import { makeHuman, walkSecondary, idleBreath } from './human.js';

export function createPlayer(game) {
  // Raka: orange ojek shirt, red cap, green delivery backpack.
  const h = makeHuman(game, {
    skin: 0xc98a5e,
    shirt: 0xe86a1a,
    pants: 0x2c3e50,
    shoes: 0x1a1a1a,
    cap: 0xc0392b,
    backpack: 0x1e8449,
    shortSleeve: true,
  });

  const player = {
    group: h.group,
    parts: h.parts,
    pos: new THREE.Vector3(0, 0, 0),
    vy: 0,
    heading: 0,
    onGround: true,
    inCar: null,
    health: 100,
    walkPhase: 0,
    punchCooldown: 0,
    shootCooldown: 0,
  };
  return player; // makeHuman already added the group to the scene
}

// Move on foot. `input` carries WASD relative to the camera yaw; the camera
// yaw lives on game.camYaw and is driven by the mouse.
export function updatePlayer(game, dt) {
  const p = game.player;
  const input = game.input;
  if (p.inCar) return; // driving is handled by vehicles.js

  const speed = input.run ? TUNE.runSpeed : TUNE.walkSpeed;
  const yaw = game.camYaw;
  // Camera-relative movement: W = away from the camera.
  let mx = 0;
  let mz = 0;
  if (input.forward) { mx += -Math.sin(yaw); mz += -Math.cos(yaw); }
  if (input.back) { mx += Math.sin(yaw); mz += Math.cos(yaw); }
  if (input.left) { mx += -Math.cos(yaw); mz += Math.sin(yaw); }
  if (input.right) { mx += Math.cos(yaw); mz += -Math.sin(yaw); }
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len;
    mz /= len;
    p.pos.x += mx * speed * dt;
    p.pos.z += mz * speed * dt;
    const targetHeading = Math.atan2(mx, mz) + Math.PI;
    // Face the movement direction (character forward is local -Z).
    let d = targetHeading - p.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    p.heading += d * Math.min(1, dt * 12);
    p.walkPhase += dt * speed * 1.9;
    const swing = Math.sin(p.walkPhase) * (input.run ? 0.75 : 0.55);
    p.parts.legL.rotation.x = swing;
    p.parts.legR.rotation.x = -swing;
    p.parts.armL.rotation.x = -swing * 0.8;
    p.parts.armR.rotation.x = swing * 0.8;
    // Knees bend, elbows keep a soft bend, the body bobs (human.js).
    walkSecondary(p.parts, p.walkPhase, input.run ? 0.75 : 0.55);
  } else {
    p.parts.legL.rotation.x *= 0.8;
    p.parts.legR.rotation.x *= 0.8;
    p.parts.armL.rotation.x *= 0.8;
    p.parts.armR.rotation.x *= 0.8;
    // Standing still: soft breathing + the head looking around (human.js).
    idleBreath(p.parts, game.elapsed, 0);
  }

  // Jump + gravity.
  if (input.jump && p.onGround) {
    p.vy = TUNE.jumpSpeed;
    p.onGround = false;
  }
  if (!p.onGround) {
    p.vy -= TUNE.gravity * dt;
    p.pos.y += p.vy * dt;
    if (p.pos.y <= 0) {
      p.pos.y = 0;
      p.vy = 0;
      p.onGround = true;
    }
  }

  // Collisions + bounds.
  const [cx, cz] = game.world.collide(p.pos.x, p.pos.z, 0.55);
  p.pos.x = cx;
  p.pos.z = cz;
  const b = game.world.bounds;
  p.pos.x = Math.max(b.minX, Math.min(b.maxX, p.pos.x));
  p.pos.z = Math.max(b.minZ, Math.min(b.maxZ, p.pos.z));

  p.group.position.copy(p.pos);
  p.group.rotation.y = p.heading;

  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
}

// Third-person camera: behind the player on foot, behind the car when
// driving, smoothed. Mouse orbit adjusts game.camYaw / game.camPitch.
export function updateCamera(game, dt) {
  const cam = game.camera;
  const p = game.player;
  let target;
  let dist;
  let height;
  let lookAt;
  if (p.inCar) {
    const car = p.inCar;
    const fx = -Math.sin(car.heading);
    const fz = -Math.cos(car.heading);
    target = new THREE.Vector3(car.pos.x - fx * 9.5, 3.6, car.pos.z - fz * 9.5);
    lookAt = new THREE.Vector3(car.pos.x + fx * 6, 1.2, car.pos.z + fz * 6);
    dist = 0;
    height = 0;
  } else {
    const yaw = game.camYaw;
    const pitch = game.camPitch;
    dist = game.camDist || 7.2;
    height = 2.6 + pitch * 3.2;
    target = new THREE.Vector3(
      p.pos.x + Math.sin(yaw) * dist,
      p.pos.y + height,
      p.pos.z + Math.cos(yaw) * dist,
    );
    lookAt = new THREE.Vector3(p.pos.x, p.pos.y + 1.4, p.pos.z);
  }
  const k = 1 - Math.exp(-dt * 7);
  cam.position.lerp(target, k);
  cam.lookAt(lookAt);
  game.scene.userData.cameraPosition = cam.position;
}

// Punch: damage the nearest pedestrian or cop in front of the player.
export function tryPunch(game) {
  const p = game.player;
  if (p.punchCooldown > 0 || p.inCar) return false;
  p.punchCooldown = 0.45;
  p.parts.armR.rotation.x = -1.6;
  const fx = -Math.sin(p.heading);
  const fz = -Math.cos(p.heading);
  let best = null;
  let bestD = TUNE.punchRange;
  for (const ped of game.traffic.peds) {
    if (ped.fled) continue;
    const dx = ped.pos.x - p.pos.x;
    const dz = ped.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < bestD && (dx * fx + dz * fz) > 0) { best = ped; bestD = d; }
  }
  for (const cop of game.police.cops) {
    const dx = cop.pos.x - p.pos.x;
    const dz = cop.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < bestD && (dx * fx + dz * fz) > 0) { best = cop; bestD = d; }
  }
  if (best) {
    best.health -= TUNE.punchDamage;
    best.stagger = 0.6;
    game.police.addWanted(1);
    game.audio.punch();
    if (best.health <= 0) {
      best.down = true;
      best.group.visible = false;
    }
    return true;
  }
  game.audio.punch();
  return false;
}

// Pistol: hit the nearest ped/cop/car roughly under the crosshair.
export function tryShoot(game) {
  const p = game.player;
  if (p.shootCooldown > 0 || p.inCar || !game.ownsPistol) return false;
  p.shootCooldown = 0.28;
  game.audio.gunshot();
  const fx = -Math.sin(game.camYaw);
  const fz = -Math.cos(game.camYaw);
  let best = null;
  let bestD = TUNE.pistolRange;
  let bestKind = '';
  const consider = (x, z, obj, kind) => {
    const dx = x - p.pos.x;
    const dz = z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > bestD) return;
    const dot = (dx * fx + dz * fz) / (d || 1);
    if (dot > 0.965) { best = obj; bestD = d; bestKind = kind; }
  };
  for (const ped of game.traffic.peds) if (!ped.down) consider(ped.pos.x, ped.pos.z, ped, 'ped');
  for (const cop of game.police.cops) if (!cop.down) consider(cop.pos.x, cop.pos.z, cop, 'cop');
  for (const car of game.traffic.cars) consider(car.pos.x, car.pos.z, car, 'car');
  if (best) {
    if (bestKind === 'car') {
      best.speed = Math.max(0, best.speed - 6);
    } else {
      best.health -= TUNE.pistolDamage;
      best.stagger = 0.8;
      if (best.health <= 0) {
        best.down = true;
        best.group.visible = false;
      }
    }
    game.police.addWanted(bestKind === 'cop' ? 2 : 1);
    return true;
  }
  return false;
}
