// Raka, on foot: a person with real proportions — capsule torso and
// limbs, a round head, shoes, and a cap — never a stack of boxes.
// One job: move the hero around the city and let him fight back.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { limb } from './shapes.js';

const SHIRT_COLORS = [0x3d7ad9, 0xd94f3d, 0x3d9a5a, 0xe8a83d];

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

export function makePersonMesh(shirt, skin = 0xc98a5a, pants = 0x2c3e50, capColor = null) {
  const g = new THREE.Group();
  const shirtMat = lambert(shirt);
  const skinMat = lambert(skin);
  const pantsMat = lambert(pants);

  // Legs: capsules pivoted at the hips, with rounded shoes.
  const legL = limb(0.085, 0.55, pantsMat);
  legL.position.set(-0.11, 0.86, 0);
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.32), lambert(0x2a2320));
  shoeL.position.set(0, -0.82, 0.05);
  shoeL.castShadow = true;
  legL.add(shoeL);
  g.add(legL);
  const legR = limb(0.085, 0.55, pantsMat);
  legR.position.set(0.11, 0.86, 0);
  const shoeR = shoeL.clone();
  legR.add(shoeR);
  g.add(legR);

  // Torso: a capsule, slightly wider at the shoulders via a second short
  // capsule, so the silhouette reads as a person, not a tube.
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 4, 12), shirtMat);
  body.position.y = 1.16;
  body.castShadow = true;
  g.add(body);
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 8), shirtMat);
  shoulders.position.y = 1.42;
  shoulders.scale.set(1.15, 0.6, 0.8);
  shoulders.castShadow = true;
  g.add(shoulders);

  // Arms: capsules pivoted at the shoulders, small round hands.
  const armL = limb(0.065, 0.42, shirtMat);
  armL.position.set(-0.27, 1.44, 0);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), skinMat);
  handL.position.y = -0.55;
  armL.add(handL);
  g.add(armL);
  const armR = limb(0.065, 0.42, shirtMat);
  armR.position.set(0.27, 1.44, 0);
  const handR = handL.clone();
  armR.add(handR);
  g.add(armR);

  // Head: a round head with a neck, hair, and an optional cap with a brim.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 10), skinMat);
  neck.position.y = 1.52;
  g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), skinMat);
  head.position.y = 1.66;
  head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.155, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    lambert(0x241a12),
  );
  hair.position.set(0, 1.68, -0.015);
  g.add(hair);
  if (capColor !== null) {
    const capMat = lambert(capColor);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      capMat,
    );
    cap.position.y = 1.7;
    g.add(cap);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.025, 14), capMat);
    brim.position.set(0, 1.7, 0.1);
    brim.scale.set(1, 1, 1.25);
    g.add(brim);
  }
  g.userData = { legL, legR, armL, armR, body, head };
  return g;
}

export function createPlayer(scene, x, z) {
  // Raka stands out: an orange shirt and a red cap, so the player is never
  // mistaken for a pedestrian.
  const mesh = makePersonMesh(0xff8c1a, 0xc98a5a, 0x2c3e50, 0xd94f3d);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const p = {
    mesh,
    pos: mesh.position,
    yaw: 0,
    vy: 0,
    grounded: true,
    health: PLAYER.maxHealth,
    money: 0,
    walkPhase: 0,
    punchTimer: 0,
    punchCooldown: 0,
    hurtTimer: 0,
    pistol: false,
    ammo: 0,
    inCar: null,
    xp: 0,
    remove() { scene.remove(mesh); },
  };
  return p;
}

// Move on foot. `move` is {x, z} in world space (already camera-relative),
// `run` and `jump` are booleans. Returns distance moved.
export function walkPlayer(p, dt, move, run, jump, world) {
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const mx = move.x;
  const mz = move.z;
  const len = Math.hypot(mx, mz);
  let moved = 0;
  if (len > 0.01) {
    const nx = (mx / len) * speed * dt;
    const nz = (mz / len) * speed * dt;
    p.pos.x += nx;
    p.pos.z += nz;
    moved = Math.hypot(nx, nz);
    p.yaw = Math.atan2(mx, mz);
    p.walkPhase += dt * (run ? 13 : 9);
  }
  if (jump && p.grounded) {
    p.vy = PLAYER.jumpSpeed;
    p.grounded = false;
  }
  if (!p.grounded) {
    p.vy -= PLAYER.gravity * dt;
    p.pos.y += p.vy * dt;
    if (p.pos.y <= 0) {
      p.pos.y = 0;
      p.vy = 0;
      p.grounded = true;
    }
  }
  world.resolveCircle(p.pos, PLAYER.radius);
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = p.yaw;
  // Walk swing: legs and arms counter-swing with the walk phase.
  const swing = len > 0.01 ? Math.sin(p.walkPhase) * (run ? 0.8 : 0.55) : 0;
  const u = p.mesh.userData;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8;
  u.armR.rotation.x = swing * 0.8;
  if (p.punchTimer > 0) {
    p.punchTimer -= dt;
    u.armR.rotation.x = -1.6 * Math.min(1, p.punchTimer * 4);
  }
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.hurtTimer > 0) p.hurtTimer -= dt;
  return moved;
}

export function damagePlayer(p, amount) {
  if (p.hurtTimer > 0) return false;
  p.health = Math.max(0, p.health - amount);
  p.hurtTimer = 0.6;
  return true;
}

export function healPlayer(p, amount) {
  p.health = Math.min(PLAYER.maxHealth, p.health + amount);
}

export { SHIRT_COLORS };
