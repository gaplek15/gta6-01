// Vehicles: curved car bodies swept from a side-profile spline (no boxy
// slabs), plus arcade driving physics with steering, handbrake and
// collisions. Six body styles: sedan, hatchback, pickup, taxi, police and
// the red Komet Merah sports car.
import * as THREE from 'three';
import { TUNE, PALETTE } from './config.js';
import { carBodyFromProfile, makeWheel } from './shapes.js';

// Side profiles: [x, y] from the front bumper over the hood, roof and trunk
// to the rear. x is metres from the centre, y is height above the ground.
const PROFILES = {
  sedan: [[2.2, 0.28], [2.05, 0.62], [1.25, 0.78], [0.55, 0.86], [0.15, 1.28], [-0.75, 1.3], [-1.35, 0.9], [-2.05, 0.82], [-2.2, 0.3]],
  hatch: [[1.95, 0.28], [1.8, 0.6], [1.1, 0.8], [0.5, 0.88], [0.1, 1.32], [-0.9, 1.34], [-1.6, 1.05], [-1.95, 0.35]],
  pickup: [[2.4, 0.3], [2.25, 0.62], [1.5, 0.8], [0.9, 0.86], [0.55, 1.42], [-0.45, 1.44], [-0.7, 0.92], [-2.4, 0.88], [-2.4, 0.32]],
  sports: [[2.15, 0.22], [2.0, 0.5], [1.2, 0.66], [0.55, 0.74], [0.2, 1.12], [-0.7, 1.14], [-1.4, 0.78], [-2.05, 0.68], [-2.15, 0.26]],
};

const SPECS = {
  sedan: { profile: 'sedan', width: 1.86, length: 4.4, maxSpeed: 34, accel: 15 },
  hatch: { profile: 'hatch', width: 1.78, length: 3.9, maxSpeed: 30, accel: 14 },
  pickup: { profile: 'pickup', width: 1.95, length: 4.8, maxSpeed: 31, accel: 13 },
  taxi: { profile: 'sedan', width: 1.86, length: 4.4, maxSpeed: 33, accel: 15 },
  police: { profile: 'sedan', width: 1.88, length: 4.4, maxSpeed: 36, accel: 17 },
  sports: { profile: 'sports', width: 1.9, length: 4.3, maxSpeed: 40, accel: 19 },
};

function paintMaterial(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.55 });
}
function glassMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x141c26, roughness: 0.12, metalness: 0.75 });
}
function darkMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x1c1e20, roughness: 0.7, metalness: 0.3 });
}

export function createCar(game, type, colorHex) {
  const spec = SPECS[type];
  const color = colorHex !== undefined ? colorHex : 0;
  const paint = type === 'police' ? paintMaterial(0xf2f3f4)
    : type === 'taxi' ? paintMaterial(0xf7c600)
    : paintMaterial(color);
  const group = new THREE.Group();
  const glass = glassMaterial();
  const dark = darkMaterial();

  // Main body from the spline profile (curved flanks, not a box).
  const body = carBodyFromProfile(PROFILES[spec.profile], spec.width, paint);
  body.position.y = 0.12;
  group.add(body);

  // Glasshouse: glass sides + body-colour roof, running along the car's
  // length (local Z; the nose points at -Z).
  const cabinLen = spec.length * 0.42;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.62, 0.42, cabinLen), glass);
  cabin.position.set(0, 1.02, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  // Roof panel in body colour over the glasshouse (glass only on the sides).
  const roof = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.5, 0.1, cabinLen + 0.1), paint);
  roof.position.set(0, 1.26, -0.25);
  roof.castShadow = true;
  group.add(roof);

  // Grille + headlights (nose, -Z) + taillights (tail, +Z). The details sit
  // proud of the body's bevel (which extends ~0.14 past the profile ends).
  const grille = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.5, 0.22, 0.12), dark);
  grille.position.set(0, 0.5, -spec.length / 2 - 0.22);
  group.add(grille);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffe9a8, emissiveIntensity: 0.9 });
  for (const s of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), headMat);
    head.scale.set(1.4, 1, 0.6);
    head.position.set(s * spec.width * 0.32, 0.62, -spec.length / 2 - 0.22);
    group.add(head);
    // Side mirrors.
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.06), dark);
    stalk.position.set(s * (spec.width / 2 + 0.08), 0.98, -0.9);
    group.add(stalk);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.1), paint);
    mirror.position.set(s * (spec.width / 2 + 0.2), 1.0, -0.9);
    group.add(mirror);
  }

  // Full-width rear light bar + plate so the tail reads from behind.
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.78, 0.12, 0.06), new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xdd2222, emissiveIntensity: 1.4 }));
  tailBar.position.set(0, 0.62, spec.length / 2 + 0.22);
  group.add(tailBar);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.04), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4, metalness: 0.2 }));
  plate.position.set(0, 0.42, spec.length / 2 + 0.22);
  group.add(plate);

  // Bumpers (front and rear, spanning the width).
  for (const sz of [-1, 1]) {
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.86, 0.22, 0.18), dark);
    bumper.position.set(0, 0.32, sz * (spec.length / 2 + 0.14));
    bumper.castShadow = true;
    group.add(bumper);
  }

  // Wheels with steering pivots at the front.
  const wheels = [];
  const wheelR = 0.38;
  const wheelX = spec.width / 2 - 0.02;
  for (const [wx, wz, front] of [
    [-wheelX, -1.35, true], [wheelX, -1.35, true],
    [-wheelX, 1.35, false], [wheelX, 1.35, false],
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, wheelR, wz);
    const spin = new THREE.Group();
    const wheel = makeWheel(wheelR, 0.26);
    spin.add(wheel);
    pivot.add(spin);
    group.add(pivot);
    wheels.push({ pivot, spin, front });
  }

  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffc600, emissiveIntensity: 0.8 }));
    sign.position.set(0, 1.4, -0.25);
    group.add(sign);
  }
  if (type === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.28), dark);
    bar.position.set(0, 1.4, -0.25);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.3), new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff1a1a, emissiveIntensity: 2.4 }));
    red.position.set(-0.26, 1.42, -0.25);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.3), new THREE.MeshStandardMaterial({ color: 0x000033, emissive: 0x2266ff, emissiveIntensity: 2.4 }));
    blue.position.set(0.26, 1.42, -0.25);
    group.add(red, blue);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x1a3a8a, roughness: 0.4, metalness: 0.4 }));
    door.position.set(-spec.width / 2 - 0.01, 0.62, -0.3);
    door.rotation.y = -Math.PI / 2;
    group.add(door);
    const door2 = door.clone();
    door2.position.x = spec.width / 2 + 0.01;
    door2.rotation.y = Math.PI / 2;
    group.add(door2);
  }
  if (type === 'sports') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.1), dark);
    spoiler.position.set(0, 1.02, spec.length / 2 - 0.15);
    group.add(spoiler);
    for (const s of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), dark);
      strut.position.set(s * 0.6, 0.86, spec.length / 2 - 0.15);
      group.add(strut);
    }
  }

  group.traverse((m) => { if (m.isMesh) m.receiveShadow = true; });

  const car = {
    type, group, wheels, spec,
    speed: 0,
    heading: 0,
    steer: 0,
    pos: new THREE.Vector3(),
    isPlayer: false,
    isPolice: type === 'police',
    driver: null, // traffic driver state
    color,
  };
  return car;
}

// Place a car in the world.
export function placeCar(game, car, x, z, heading) {
  car.pos.set(x, 0, z);
  car.heading = heading;
  car.group.position.copy(car.pos);
  car.group.rotation.y = heading;
  game.scene.add(car.group);
  return car;
}

// Arcade driving: accelerate / brake / reverse, speed-sensitive steering,
// handbrake for sharper turns, drag, and simple collision push-out.
export function driveCar(game, car, input, dt) {
  const spec = car.spec;
  const fwd = input.forward ? 1 : 0;
  const back = input.back ? 1 : 0;
  if (fwd) car.speed += spec.accel * dt;
  if (back) {
    if (car.speed > 0.5) car.speed -= TUNE.carBrake * dt;
    else car.speed -= spec.accel * 0.55 * dt;
  }
  if (!fwd && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  // Drag + rolling resistance.
  car.speed -= car.speed * 0.35 * dt;
  car.speed = Math.max(-TUNE.carReverseMax, Math.min(spec.maxSpeed, car.speed));

  const speedFactor = Math.min(1, Math.abs(car.speed) / 12);
  const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const turnRate = input.handbrake ? TUNE.handbrakeTurn : TUNE.carTurn;
  const dir = car.speed >= 0 ? 1 : -1;
  car.heading += steerInput * turnRate * speedFactor * dir * dt;
  car.steer += ((steerInput * 0.42) - car.steer) * Math.min(1, dt * 8);

  const fx = -Math.sin(car.heading);
  const fz = -Math.cos(car.heading);
  car.pos.x += fx * car.speed * dt;
  car.pos.z += fz * car.speed * dt;

  // Collisions with buildings + world bounds.
  const [cx, cz] = game.world.collide(car.pos.x, car.pos.z, 1.7);
  if (cx !== car.pos.x || cz !== car.pos.z) {
    car.pos.x = cx;
    car.pos.z = cz;
    car.speed *= 0.35;
  }
  const b = game.world.bounds;
  car.pos.x = Math.max(b.minX, Math.min(b.maxX, car.pos.x));
  car.pos.z = Math.max(b.minZ, Math.min(b.maxZ, car.pos.z));

  // Body lean + wheel spin / steer.
  car.group.position.copy(car.pos);
  car.group.rotation.y = car.heading;
  car.group.rotation.z = -steerInput * speedFactor * 0.045;
  car.group.rotation.x = Math.max(-0.03, Math.min(0.03, (fwd ? -0.02 : 0) + (back && car.speed > 0 ? 0.02 : 0)));
  for (const w of car.wheels) {
    w.spin.rotation.x += (car.speed * dt) / 0.38;
    if (w.front) w.pivot.rotation.y = car.steer;
  }
  return car;
}

// Forward vector for a heading (three.js: forward is local -Z).
export function forwardOf(heading) {
  return { x: -Math.sin(heading), z: -Math.cos(heading) };
}
