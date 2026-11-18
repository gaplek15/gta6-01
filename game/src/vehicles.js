// Vehicles: low-poly car and scooter meshes plus arcade driving physics.
// One job: build a vehicle, drive it, and crash it into the city.
import * as THREE from 'three';
import { CAR } from './config.js';

export const CAR_TYPES = {
  sedan: { name: 'Sedan Kota', maxSpeed: 26, accel: 14, length: 4.2, width: 1.9 },
  taxi: { name: 'Taksi Cahaya', maxSpeed: 27, accel: 15, length: 4.2, width: 1.9 },
  sports: { name: 'Komet Merah', maxSpeed: 36, accel: 20, length: 4.4, width: 2.0 },
  van: { name: 'Van Angkut', maxSpeed: 22, accel: 11, length: 5.0, width: 2.1 },
  police: { name: 'Mobil Polisi', maxSpeed: 32, accel: 18, length: 4.4, width: 2.0 },
  scooter: { name: 'Ojek Beat', maxSpeed: 24, accel: 16, length: 2.2, width: 0.9 },
};

const CAR_COLORS = [0xd94f3d, 0x3d7ad9, 0x3d9a5a, 0xe8d44d, 0x8a5a9a, 0xe8e8e8, 0x5a5a5a, 0xd98a3d];

export function randomCarColor(rng) {
  return CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
}

function makeWheel() {
  const w = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
  );
  w.rotation.z = Math.PI / 2;
  w.castShadow = true;
  return w;
}

function makeCarMesh(type, color) {
  const def = CAR_TYPES[type];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
  const lightMat = new THREE.MeshLambertMaterial({
    color: 0xfff2b0, emissive: 0xffedb0, emissiveIntensity: 0.6,
  });
  const tailMat = new THREE.MeshLambertMaterial({
    color: 0xcc2222, emissive: 0xcc2222, emissiveIntensity: 0.5,
  });

  if (type === 'scooter') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.9), bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    g.add(body);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.15, 0.8), darkMat);
    seat.position.set(0, 0.85, -0.2);
    g.add(seat);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), darkMat);
    bar.position.set(0, 1.0, 0.85);
    g.add(bar);
    const w1 = makeWheel();
    w1.position.set(0, 0.36, 0.85);
    g.add(w1);
    const w2 = makeWheel();
    w2.position.set(0, 0.36, -0.85);
    g.add(w2);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.1), lightMat);
    head.position.set(0, 0.7, 1.0);
    g.add(head);
    g.userData.wheels = [w1, w2];
    return g;
  }

  const L = def.length;
  const W = def.width;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, 0.75, L), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.85, 0.65, L * 0.5), darkMat);
  cabin.position.set(0, 1.3, -L * 0.05);
  cabin.castShadow = true;
  g.add(cabin);
  if (type === 'sports') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.08, 0.4), darkMat);
    spoiler.position.set(0, 1.15, -L / 2 + 0.1);
    g.add(spoiler);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.25, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xffd94d, emissive: 0xffd94d, emissiveIntensity: 0.8 }),
    );
    sign.position.set(0, 1.75, -L * 0.05);
    g.add(sign);
  }
  if (type === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(W * 0.6, 0.18, 0.5), darkMat);
    bar.position.set(0, 1.72, -L * 0.05);
    g.add(bar);
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.2, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1 }),
    );
    red.position.set(-W * 0.18, 1.85, -L * 0.05);
    g.add(red);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.2, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 1 }),
    );
    blue.position.set(W * 0.18, 1.85, -L * 0.05);
    g.add(blue);
    g.userData.sirenRed = red;
    g.userData.sirenBlue = blue;
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.18, 0.1), lightMat);
  head.position.set(0, 0.7, L / 2 + 0.02);
  g.add(head);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.18, 0.1), tailMat);
  tail.position.set(0, 0.7, -L / 2 - 0.02);
  g.add(tail);

  const wheels = [];
  for (const [wx, wz] of [[-W / 2, L / 2 - 0.8], [W / 2, L / 2 - 0.8], [-W / 2, -L / 2 + 0.8], [W / 2, -L / 2 + 0.8]]) {
    const w = makeWheel();
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}

// A vehicle is a mesh plus arcade state. `kind` is 'parked' | 'traffic' |
// 'player' | 'police'. The caller owns steering and throttle each frame.
export function createVehicle(scene, type, color, x, z, heading) {
  const def = CAR_TYPES[type];
  const mesh = makeCarMesh(type, color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  const v = {
    mesh,
    type,
    def,
    pos: mesh.position,
    heading,
    speed: 0,
    steer: 0,
    kind: 'parked',
    driver: null, // a pedestrian object, if this car has one
    health: 100,
    stuck: 0,
    sirenPhase: false,
    sirenTimer: 0,
    remove() { scene.remove(mesh); },
  };
  return v;
}

// Arcade driving: throttle -1..1, steer -1..1, handbrake bool. Returns the
// distance travelled this step (for the speedometer and crash sounds).
export function driveVehicle(v, dt, throttle, steer, handbrake, world) {
  const def = v.def;
  const maxFwd = def.maxSpeed;
  if (throttle > 0) v.speed += def.accel * throttle * dt;
  else if (throttle < 0) {
    if (v.speed > 0.5) v.speed -= CAR.brake * dt;
    else v.speed += def.accel * 0.6 * throttle * dt; // reverse
  }
  v.speed -= v.speed * CAR.drag * dt;
  if (handbrake) v.speed -= Math.sign(v.speed) * CAR.handbrakeDecel * dt;
  v.speed = Math.max(-CAR.maxReverse, Math.min(maxFwd, v.speed));
  if (Math.abs(v.speed) < 0.05 && throttle === 0) v.speed = 0;

  const steerAngle = steer * CAR.steerMax * (handbrake ? 1.4 : 1);
  const turn = steerAngle * (v.speed / maxFwd) * (v.speed < 0 ? -1 : 1) * 2.2;
  v.heading += turn * dt;
  v.steer = steer;

  const dx = Math.sin(v.heading) * v.speed * dt;
  const dz = Math.cos(v.heading) * v.speed * dt;
  const before = { x: v.pos.x, z: v.pos.z };
  v.pos.x += dx;
  v.pos.z += dz;
  // Buildings stop the car: slide along them instead of passing through.
  if (world.collides(v.pos.x, v.pos.z, CAR.radius)) {
    v.pos.x = before.x;
    v.pos.z = before.z;
    if (world.collides(v.pos.x + dx, v.pos.z, CAR.radius)) {
      v.pos.x += dx;
      v.pos.z = before.z;
    } else if (world.collides(v.pos.x, v.pos.z + dz, CAR.radius)) {
      v.pos.x = before.x;
      v.pos.z += dz;
    }
    const impact = Math.abs(v.speed);
    v.speed *= 0.4;
    if (impact > 12) v.health -= (impact - 12) * 1.5;
    v.stuck += dt;
  } else {
    v.stuck = 0;
  }
  v.mesh.position.set(v.pos.x, 0, v.pos.z);
  v.mesh.rotation.y = v.heading;
  // Wheels spin with speed; front wheels yaw with the steering.
  const wheels = v.mesh.userData.wheels || [];
  for (let i = 0; i < wheels.length; i += 1) {
    wheels[i].rotation.x += v.speed * dt * 2;
    if (i < 2) wheels[i].rotation.y = steerAngle * 0.6;
  }
  return Math.abs(v.speed) * dt;
}

export function flashSiren(v, dt) {
  const red = v.mesh.userData.sirenRed;
  const blue = v.mesh.userData.sirenBlue;
  if (!red || !blue) return;
  v.sirenTimer += dt;
  if (v.sirenTimer > 0.35) {
    v.sirenTimer = 0;
    v.sirenPhase = !v.sirenPhase;
  }
  red.material.emissiveIntensity = v.sirenPhase ? 2.2 : 0.15;
  blue.material.emissiveIntensity = v.sirenPhase ? 0.15 : 2.2;
}
