// Vehicles: cars with curved, real-car bodies — a smooth side silhouette
// extruded across the width, a separate dark glasshouse, torus tyres with
// hubs — plus arcade driving physics. No boxes on wheels.
// One job: build a vehicle, drive it, and crash it into the city.
import * as THREE from 'three';
import { CAR } from './config.js';
import { carBodyGeometry, roundedBar, wheel } from './shapes.js';

export const CAR_TYPES = {
  sedan: { name: 'Sedan Kota', maxSpeed: 26, accel: 14, length: 4.2, width: 1.9 },
  taxi: { name: 'Taksi Cahaya', maxSpeed: 27, accel: 15, length: 4.2, width: 1.9 },
  sports: { name: 'Komet Merah', maxSpeed: 36, accel: 20, length: 4.4, width: 2.0 },
  van: { name: 'Van Angkut', maxSpeed: 22, accel: 11, length: 5.0, width: 2.1 },
  police: { name: 'Mobil Polisi', maxSpeed: 32, accel: 18, length: 4.4, width: 2.0 },
  scooter: { name: 'Ojek Beat', maxSpeed: 24, accel: 16, length: 2.2, width: 0.9 },
};

const CAR_COLORS = [0xc94f3d, 0x3d6a9a, 0x4a7a5a, 0xd8c24d, 0x7a5a8a, 0xd8d8d2, 0x4a4a4e, 0xc98a3d];

// Side silhouette of the lower body, front to rear (x = +L/2 is the nose).
const BODY_TOP = {
  sedan: [[2.05, 0.8], [1.5, 0.93], [0.9, 0.97], [-0.9, 0.97], [-1.7, 0.93], [-2.05, 0.82]],
  taxi: [[2.05, 0.8], [1.5, 0.93], [0.9, 0.97], [-0.9, 0.97], [-1.7, 0.93], [-2.05, 0.82]],
  police: [[2.05, 0.8], [1.5, 0.93], [0.9, 0.97], [-0.9, 0.97], [-1.7, 0.93], [-2.05, 0.82]],
  sports: [[2.15, 0.76], [1.6, 0.88], [0.9, 0.92], [-0.9, 0.92], [-1.8, 0.88], [-2.15, 0.78]],
  van: [[2.45, 0.85], [1.8, 1.12], [0.9, 1.16], [-1.9, 1.16], [-2.3, 1.05], [-2.45, 0.85]],
};

// The glasshouse: [rearX, frontX, rearTopY, frontTopY, baseY].
const CABIN = {
  sedan: [-0.9, 0.5, 1.22, 1.2, 0.92],
  taxi: [-0.9, 0.5, 1.22, 1.2, 0.92],
  police: [-0.9, 0.5, 1.22, 1.2, 0.92],
  sports: [-0.8, 0.45, 1.16, 1.14, 0.88],
  van: [-1.9, 1.5, 1.78, 1.76, 1.1],
};

export function randomCarColor(rng) {
  return CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
}

function lambert(color, emissive = 0, intensity = 1) {
  return new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: intensity });
}

function glasshouse(type, width) {
  const [rx, fx, rt, ft, base] = CABIN[type];
  const s = new THREE.Shape();
  s.moveTo(rx, base);
  s.lineTo(fx, base);
  s.lineTo(fx - 0.18, ft);
  s.lineTo(rx + 0.18, rt);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: width * 0.7,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 2,
    steps: 1,
  });
  geo.translate(0, 0, -(width * 0.7) / 2);
  const m = new THREE.Mesh(geo, lambert(0x1d2a38));
  m.castShadow = true;
  return m;
}

function makeCarMesh(type, color) {
  const def = CAR_TYPES[type];
  const g = new THREE.Group();
  const bodyMat = lambert(color);
  const darkMat = lambert(0x1a2028);
  const lightMat = lambert(0xfff2b0, 0xffedb0, 0.7);
  const tailMat = lambert(0xcc2222, 0xcc2222, 0.5);

  if (type === 'scooter') {
    // A step-through scooter: curved shield, low seat, round wheels.
    const bodyGeo = carBodyGeometry(2.2, 0.55, [
      [1.05, 0.55], [0.9, 0.95], [0.45, 1.02], [0.05, 0.82], [-0.5, 0.78], [-1.0, 0.62], [-1.05, 0.45],
    ], 0.25);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    g.add(body);
    const seat = roundedBar(0.45, 0.12, 0.85, 0.05, darkMat);
    seat.position.set(0, 0.78, -0.35);
    g.add(seat);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8), darkMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 1.0, 0.85);
    g.add(bar);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), lightMat);
    head.position.set(0, 0.72, 1.02);
    head.scale.set(1.4, 0.8, 0.6);
    g.add(head);
    const wheels = [];
    for (const z of [0.82, -0.82]) {
      const w = wheel(0.3);
      w.position.set(0, 0.3, z);
      g.add(w);
      wheels.push(w);
    }
    g.userData.wheels = wheels;
    return g;
  }

  const L = def.length;
  const W = def.width;
  const body = new THREE.Mesh(carBodyGeometry(L, W, BODY_TOP[type]), bodyMat);
  body.castShadow = true;
  g.add(body);
  const cabin = glasshouse(type, W);
  g.add(cabin);

  // Roof panel in body colour over the glasshouse: the roof reads as car
  // body and the glass only on the sides, like a real car.
  const cab = CABIN[type];
  const roof = roundedBar(cab[1] - cab[0], 0.05, W * 0.62, 0.04, bodyMat);
  roof.position.set((cab[0] + cab[1]) / 2, cab[2] + 0.02, 0);
  g.add(roof);
  // Bumpers: soft rounded bars, front and rear.
  const bumperF = roundedBar(W * 0.92, 0.2, 0.3, 0.08, darkMat);
  bumperF.position.set(0, 0.42, L / 2 - 0.05);
  g.add(bumperF);
  const bumperR = roundedBar(W * 0.92, 0.2, 0.3, 0.08, darkMat);
  bumperR.position.set(0, 0.42, -L / 2 + 0.05);
  g.add(bumperR);
  // Grille and headlights up front, a red strip at the rear.
  const grille = roundedBar(W * 0.5, 0.14, 0.08, 0.04, darkMat);
  grille.position.set(0, 0.62, L / 2 + 0.04);
  g.add(grille);
  for (const sx of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), lightMat);
    lamp.position.set(sx * W * 0.32, 0.72, L / 2 - 0.02);
    lamp.scale.set(1.5, 0.7, 0.7);
    g.add(lamp);
    const mirror = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), darkMat);
    mirror.position.set(sx * (W / 2 + 0.06), 1.05, L * 0.14);
    mirror.scale.set(0.6, 1, 1.4);
    g.add(mirror);
  }
  // Two small taillights at the rear corners, not a full-width strip.
  for (const sx of [-1, 1]) {
    const tl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), tailMat);
    tl.position.set(sx * W * 0.32, 0.72, -L / 2 + 0.02);
    tl.scale.set(1.5, 0.7, 0.7);
    g.add(tl);
  }
  if (type === 'sports') {
    const wing = roundedBar(W * 0.6, 0.06, 0.3, 0.03, darkMat);
    wing.position.set(0, 1.12, -L / 2 + 0.15);
    wing.rotation.x = -0.12;
    g.add(wing);
  }
  if (type === 'taxi') {
    const sign = roundedBar(0.9, 0.22, 0.4, 0.06, lambert(0xffd94d, 0xffd94d, 0.8));
    sign.position.set(0, 1.36, 0);
    g.add(sign);
  }
  if (type === 'police') {
    const bar = roundedBar(W * 0.55, 0.14, 0.45, 0.05, darkMat);
    bar.position.set(0, 1.34, 0);
    g.add(bar);
    const red = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      lambert(0xff2222, 0xff2222, 1),
    );
    red.position.set(-W * 0.16, 1.41, 0);
    g.add(red);
    const blue = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      lambert(0x2244ff, 0x2244ff, 1),
    );
    blue.position.set(W * 0.16, 1.41, 0);
    g.add(blue);
    g.userData.sirenRed = red;
    g.userData.sirenBlue = blue;
  }
  const wheels = [];
  for (const [wx, wz] of [[-W / 2 - 0.02, L / 2 - 0.85], [W / 2 + 0.02, L / 2 - 0.85], [-W / 2 - 0.02, -L / 2 + 0.85], [W / 2 + 0.02, -L / 2 + 0.85]]) {
    const w = wheel(0.36);
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
