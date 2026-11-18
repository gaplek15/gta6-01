// Human model: real proportions, smooth geometry, two-segment limbs with
// knees and elbows, a simple face, hair/caps, varied outfits. One builder
// for the player, pedestrians, cops and the two story NPCs (Darma, Mbak
// Sari), so every person in the city reads as a person, not a box.
//
// Proportions (scale 1 = ~1.76 m tall): head ~1/7.6 of height, shoulders
// wider than waist, thigh + shin, upper arm + forearm, hands and shoes.
// Character forward is local -Z, same as the player controller.
import * as THREE from 'three';
import { limb, roundedBox } from './shapes.js';

export const SKIN_TONES = [0xc98a5e, 0xb57748, 0x8d5a3b, 0xe0ac69, 0x6e4423];
export const HAIR_COLORS = [0x1a1a1a, 0x2d1a0e, 0x4a2c14, 0x5d4037, 0x7a7a7a];

function mat(color, roughness = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

// opts: skin, shirt, pants, shoes, scale, female, shortSleeve,
// hair (color | false), longHair, cap (color), hat (color),
// backpack (color | false), belt (bool), badge (bool), apron (color | false)
export function makeHuman(game, opts = {}) {
  const scale = opts.scale ?? 1;
  const skin = mat(opts.skin ?? 0xc98a5e, 0.7);
  const shirt = mat(opts.shirt ?? 0x888888, 0.9);
  const pants = mat(opts.pants ?? 0x2c3e50, 0.9);
  const shoeMat = mat(opts.shoes ?? 0x1a1a1a, 0.55);
  const hairMat = mat(opts.hair ?? 0x1a1a1a, 0.9);
  const group = new THREE.Group();

  // --- Legs: hip pivot -> thigh, knee pivot -> shin + shoe ------------------
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(0.10 * side, 0.95, 0);
    hip.add(limb(0.068, 0.34, pants)); // thigh, pivoted at the hip
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    knee.add(limb(0.052, 0.34, pants)); // shin, pivoted at the knee
    const shoe = roundedBox(0.11, 0.07, 0.27, 0.025, shoeMat);
    shoe.position.set(0, -0.46, -0.05); // toe points forward (-Z)
    knee.add(shoe);
    hip.add(knee);
    group.add(hip);
    return { hip, knee };
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // --- Upper body (bobs, breathes and leans as one) ------------------------
  const body = new THREE.Group();
  group.add(body);

  // Tapered torso: smooth lathe profile, wider at the shoulders, narrower
  // at the waist, then scaled wider than deep like a real torso.
  const profile = [
    [0.001, 0.92], [0.150, 0.92], [0.175, 0.98], [0.185, 1.05],
    [0.155, 1.18], [0.165, 1.30], [0.195, 1.42], [0.205, 1.46],
    [0.13, 1.50], [0.06, 1.52], [0.001, 1.52],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(profile, 18), shirt);
  torso.scale.set(1.18, 1, 0.8);
  torso.castShadow = true;
  body.add(torso);

  if (opts.belt) {
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.05, 18), mat(0x14181d, 0.6));
    belt.position.y = 1.03;
    belt.scale.set(1.15, 1, 0.82);
    belt.castShadow = true;
    body.add(belt);
    const buckle = roundedBox(0.06, 0.04, 0.02, 0.008, mat(0xd4ac0d, 0.35));
    buckle.position.set(0, 1.03, -0.155);
    body.add(buckle);
  }
  if (opts.badge) {
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.012, 12), mat(0xd4ac0d, 0.3));
    badge.rotation.x = Math.PI / 2;
    badge.position.set(0.08, 1.38, -0.155);
    body.add(badge);
  }
  if (opts.apron) {
    const apron = roundedBox(0.34, 0.52, 0.03, 0.02, mat(opts.apron, 0.9));
    apron.position.set(0, 1.14, -0.165);
    body.add(apron);
  }

  // --- Arms: shoulder pivot -> upper arm, elbow pivot -> forearm + hand -----
  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.215 * side, 1.44, 0);
    shoulder.add(limb(0.05, 0.20, shirt)); // upper arm
    const elbow = new THREE.Group();
    elbow.position.y = -0.26;
    // Short sleeves show skin forearms; long sleeves keep the shirt.
    elbow.add(limb(0.042, 0.20, opts.shortSleeve ? skin : shirt));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skin);
    hand.position.y = -0.27;
    hand.scale.set(0.85, 1.15, 0.95);
    hand.castShadow = true;
    elbow.add(hand);
    shoulder.add(elbow);
    body.add(shoulder);
    return { shoulder, elbow };
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // --- Neck + head (its own group so it can turn) ---------------------------
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 10), skin);
  neck.position.y = 1.53;
  body.add(neck);

  const head = new THREE.Group();
  head.position.y = 1.55;
  body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 14), skin);
  skull.position.y = 0.085;
  skull.scale.set(1, 1.08, 0.94);
  skull.castShadow = true;
  head.add(skull);
  // Ears.
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), skin);
    ear.position.set(0.108 * s, 0.085, 0);
    ear.scale.set(0.5, 1, 0.8);
    head.add(ear);
  }
  // Face (forward is -Z): small dark eyes, brows, a hint of a nose, a thin mouth.
  const eyeMat = mat(0x1a1a1a, 0.4);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), eyeMat);
    eye.position.set(0.042 * s, 0.11, -0.10);
    head.add(eye);
    const brow = roundedBox(0.05, 0.011, 0.012, 0.005, hairMat);
    brow.position.set(0.042 * s, 0.138, -0.10);
    head.add(brow);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), mat(opts.skin ?? 0xc98a5e, 0.7));
  nose.position.set(0, 0.085, -0.106);
  nose.scale.set(0.8, 1.25, 0.8);
  head.add(nose);
  const mouth = roundedBox(0.05, 0.009, 0.01, 0.004, mat(0x8a4b3a, 0.8));
  mouth.position.set(0, 0.045, -0.102);
  head.add(mouth);

  // Hair, cap or hat.
  if (opts.cap) {
    const capMat = mat(opts.cap, 0.85);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.1), capMat);
    cap.position.y = 0.11;
    head.add(cap);
    const brim = roundedBox(0.15, 0.018, 0.12, 0.008, capMat);
    brim.position.set(0, 0.115, -0.135);
    brim.rotation.x = 0.12;
    head.add(brim);
  } else if (opts.hat) {
    const hatMat = mat(opts.hat, 0.85);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.135, 0.1, 14), hatMat);
    top.position.y = 0.19;
    head.add(top);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 16), hatMat);
    brim.position.y = 0.145;
    head.add(brim);
  } else if (opts.hair !== false) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.122, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    cap.position.set(0, 0.105, 0.012);
    head.add(cap);
    if (opts.longHair) {
      // Long hair down the back + side locks (women).
      const back = roundedBox(0.17, 0.36, 0.07, 0.03, hairMat);
      back.position.set(0, -0.10, 0.10);
      head.add(back);
      for (const s of [-1, 1]) {
        const lock = roundedBox(0.05, 0.22, 0.06, 0.02, hairMat);
        lock.position.set(0.10 * s, -0.02, 0.02);
        head.add(lock);
      }
    }
  }

  // Raka's delivery backpack + shoulder straps.
  if (opts.backpack) {
    const pack = roundedBox(0.30, 0.38, 0.13, 0.05, mat(opts.backpack, 0.9));
    pack.position.set(0, 1.24, 0.24);
    body.add(pack);
    for (const s of [-1, 1]) {
      const strap = roundedBox(0.05, 0.28, 0.02, 0.008, mat(0x1a1a1a, 0.9));
      strap.position.set(0.10 * s, 1.33, -0.165);
      body.add(strap);
    }
  }

  group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  group.scale.setScalar(scale);
  game.scene.add(group);

  return {
    group,
    parts: {
      legL: legL.hip, legR: legR.hip,
      kneeL: legL.knee, kneeR: legR.knee,
      armL: armL.shoulder, armR: armR.shoulder,
      elbowL: armL.elbow, elbowR: armR.elbow,
      torso, head, body,
    },
  };
}

// Secondary joints for a walk cycle: knees bend while the leg swings
// forward, elbows keep a soft bend, the upper body bobs gently.
// `phase` is the same phase the hip swing uses; `amp` its amplitude.
export function walkSecondary(parts, phase, amp) {
  const kneeAmp = 0.85 * amp;
  parts.kneeL.rotation.x = -kneeAmp * Math.max(0, Math.cos(phase));
  parts.kneeR.rotation.x = -kneeAmp * Math.max(0, -Math.cos(phase));
  parts.elbowL.rotation.x = 0.28 + 0.12 * Math.sin(phase);
  parts.elbowR.rotation.x = 0.28 - 0.12 * Math.sin(phase);
  parts.body.position.y = Math.abs(Math.cos(phase)) * 0.028 * amp;
}

// Idle: soft breathing (chest) + the head looking around a little.
export function idleBreath(parts, t, phase = 0) {
  parts.body.scale.y = 1 + Math.sin(t * 2.0 + phase) * 0.012;
  parts.head.rotation.y = Math.sin(t * 0.45 + phase) * 0.3;
  parts.body.position.y = 0;
}
