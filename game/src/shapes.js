// Organic geometry helpers: the anti-box toolkit. Every mesh the city is
// made of goes through here so nothing is a plain cube: rounded corners,
// sloped roofs, curved car bodies, soft tree canopies, real limbs.
// One job: turn numbers into shapes that read like the real world.
import * as THREE from 'three';

// A rectangle with rounded corners, in the shape's local XY plane.
export function roundedRectShape(w, d, r) {
  const hw = w / 2;
  const hd = d / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hd);
  s.lineTo(hw - r, -hd);
  s.quadraticCurveTo(hw, -hd, hw, -hd + r);
  s.lineTo(hw, hd - r);
  s.quadraticCurveTo(hw, hd, hw - r, hd);
  s.lineTo(-hw + r, hd);
  s.quadraticCurveTo(-hw, hd, -hw, hd - r);
  s.lineTo(-hw, -hd + r);
  s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  return s;
}

// A vertical slab with rounded corners and softened edges: the building
// block. `lidMat` colours the flat top/bottom caps, `sideMat` the walls
// (its texture maps once across each face).
export function roundedSlab(w, h, d, r, sideMat, lidMat) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, d, r), {
    depth: h,
    bevelEnabled: true,
    bevelThickness: 0.45,
    bevelSize: 0.45,
    bevelSegments: 2,
    steps: 1,
  });
  geo.rotateX(-Math.PI / 2); // shape XY -> ground plane, depth becomes height
  geo.translate(0, 0.45, 0); // lift the bevel so the slab sits on y = 0
  const mesh = new THREE.Mesh(geo, lidMat ? [lidMat, sideMat] : sideMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A gable (pitched) roof: a triangular prism that sits on a footprint.
export function gableRoof(w, d, h, mat) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: d,
    bevelEnabled: true,
    bevelThickness: 0.25,
    bevelSize: 0.25,
    bevelSegments: 1,
    steps: 1,
  });
  geo.translate(0, 0, -d / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A hip (pyramid) roof: a four-sided cone, squashed to the footprint.
export function hipRoof(w, d, h, mat) {
  const geo = new THREE.ConeGeometry(1, h, 4, 1);
  geo.rotateY(Math.PI / 4);
  geo.scale(w / 2 + 0.4, 1, d / 2 + 0.4);
  geo.translate(0, h / 2, 0); // base sits on y = 0
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A curved car body: the side silhouette (hood, cabin line, trunk) drawn
// as a smooth spline and extruded across the width, bevelled so every edge
// is soft. `profile` is an array of [x, y] points along the top, front to
// rear; the bottom stays flat at y = 0.
export function carBodyGeometry(length, width, topPoints, yBase = 0.3) {
  const L = length;
  const s = new THREE.Shape();
  s.moveTo(-L / 2, yBase);
  s.lineTo(L / 2, yBase);
  s.lineTo(L / 2, topPoints[0][1]);
  s.splineThru(topPoints.map(([x, y]) => new THREE.Vector2(x, y)));
  s.lineTo(-L / 2, yBase);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: width - 0.16,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
    steps: 1,
  });
  geo.translate(0, 0, -(width - 0.16) / 2);
  return geo;
}

// A soft tree canopy: a cluster of overlapping spheres, never a cone.
export function canopyCluster(rng, radius, color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });
  const blobs = 5;
  for (let i = 0; i < blobs; i += 1) {
    const r = radius * (0.5 + rng() * 0.5);
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
    const a = (i / blobs) * Math.PI * 2 + rng() * 0.8;
    const dist = radius * 0.55;
    b.position.set(Math.cos(a) * dist, (rng() - 0.35) * radius * 0.5, Math.sin(a) * dist);
    b.scale.y = 0.6;
    b.castShadow = true;
    g.add(b);
  }
  const crown = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.75, 10, 8), mat);
  crown.position.y = radius * 0.3;
  crown.scale.y = 0.65;
  crown.castShadow = true;
  g.add(crown);
  return g;
}

// A limb: a capsule whose pivot sits at the joint (top), so a rotation
// swings it like a real arm or leg. Returns a Group; the capsule hangs
// below the group's origin.
export function limb(radius, length, mat) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), mat);
  m.position.y = -(length / 2 + radius * 0.5);
  m.castShadow = true;
  g.add(m);
  return g;
}

// A wheel: a torus tyre with a hub disc, axle along local X. Spin it on
// local X (after steering on Y, with rotation order YXZ).
export function wheel(radius = 0.36) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const tyre = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.72, radius * 0.3, 10, 18),
    new THREE.MeshLambertMaterial({ color: 0x16181c }),
  );
  tyre.rotation.y = Math.PI / 2;
  tyre.castShadow = true;
  g.add(tyre);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.5, radius * 0.5, 0.1, 12),
    new THREE.MeshLambertMaterial({ color: 0xb8bec6 }),
  );
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, 0.12, 8),
    new THREE.MeshLambertMaterial({ color: 0x3a3f46 }),
  );
  cap.rotation.z = Math.PI / 2;
  g.add(cap);
  return g;
}

// A small rounded bar: the same extrusion with a fine bevel, for car
// parts, signs and furniture — never the 0.45 m building bevel.
export function roundedBar(w, h, d, r, mat) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, d, r), {
    depth: h,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 1,
    steps: 1,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.03, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A soft radial-gradient blob texture, for clouds and glows. Drawn once on
// a canvas, reused everywhere; no external files.
export function blobTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
