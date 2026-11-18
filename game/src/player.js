// Raka, on foot: a low-poly walker with run, jump, punch and pistol.
// One job: move the hero around the city and let him fight back.
import * as THREE from 'three';
import { PLAYER } from './config.js';

const SHIRT_COLORS = [0x3d7ad9, 0xd94f3d, 0x3d9a5a, 0xe8a83d];

export function makePersonMesh(shirt, skin = 0xc98a5a, pants = 0x2c3e50, capColor = null) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtMat);
  body.position.y = 1.12;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
  head.position.y = 1.72;
  head.castShadow = true;
  g.add(head);
  if (capColor !== null) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.46), new THREE.MeshLambertMaterial({ color: capColor }));
    cap.position.y = 1.96;
    g.add(cap);
  }
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.24), pantsMat);
  legL.position.set(-0.16, 0.35, 0);
  legL.castShadow = true;
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.24), pantsMat);
  legR.position.set(0.16, 0.35, 0);
  legR.castShadow = true;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirtMat);
  armL.position.set(-0.42, 1.12, 0);
  g.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirtMat);
  armR.position.set(0.42, 1.12, 0);
  g.add(armR);
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
