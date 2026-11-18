// Geometry helpers for organic, realistic shapes: rounded boxes, pitched
// roofs, car bodies swept from a side-profile spline, capsule limbs and
// wheel arches. Nothing here is a bare sharp cube.
import * as THREE from 'three';

// A box with softly rounded edges, built by extruding a rounded rectangle.
export function roundedBox(w, h, d, radius, material) {
  const r = Math.min(radius, w / 2 - 0.01, h / 2 - 0.01);
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: d - r * 2,
    bevelEnabled: true,
    bevelThickness: r,
    bevelSize: r,
    bevelSegments: 2,
    steps: 1,
  });
  geo.translate(0, 0, -(d - r * 2) / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A gable (pitched) roof prism for a rectangular footprint.
export function gableRoof(w, d, h, material) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  // The prism's ridge runs along z; rotate so the gable faces the street.
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A low dome (half sphere squashed) for rooftops and kiosks.
export function dome(radius, material, squash = 0.55) {
  const geo = new THREE.SphereGeometry(radius, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.scale.y = squash;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Sweep a car body from a side-profile spline: points are [x, y] pairs from
// the front bumper (x = +length/2) over the hood, roof and trunk to the rear.
// The profile is extruded across the width with a bevel, giving curved
// flanks instead of a box.
export function carBodyFromProfile(points, width, material) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    const [x, y] = points[i];
    const [px, py] = points[i - 1];
    // Smooth the outline with a quadratic through the midpoint.
    const mx = (px + x) / 2;
    const my = (py + y) / 2;
    shape.quadraticCurveTo(px, py, mx, my);
  }
  shape.lineTo(points[points.length - 1][0], 0);
  shape.lineTo(points[0][0], 0);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: 0.16,
    bevelSize: 0.14,
    bevelSegments: 3,
    steps: 1,
    curveSegments: 10,
  });
  geo.translate(0, 0, -width / 2);
  // Extrude runs along z; rotate so the profile's x axis is the car's length.
  geo.rotateY(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A wheel: dark tyre torus + light hubcap disc, mounted on an axle group
// that spins with speed.
export function makeWheel(radius, width) {
  const group = new THREE.Group();
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.95, metalness: 0.0 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.3, metalness: 0.85 });
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(radius, width * 0.42, 10, 20), tyreMat);
  tyre.rotation.y = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 0.5, 16), hubMat);
  hub.rotation.z = Math.PI / 2;
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(width * 0.55, radius * 0.9, radius * 0.16), hubMat);
  group.add(tyre, hub, spoke);
  group.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
  return group;
}

// A capsule limb pivoted at its top joint (shoulder/hip), so walk cycles
// rotate naturally around the joint instead of the centre.
export function limb(radius, length, material) {
  const geo = new THREE.CapsuleGeometry(radius, length, 4, 10);
  geo.translate(0, -length / 2, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

// A palm trunk: gently curved cylinder.
export function palmTrunk(height, material, rng) {
  const geo = new THREE.CylinderGeometry(0.14, 0.24, height, 8, 6);
  const pos = geo.attributes.position;
  const bend = rng ? rng.range(0.4, 0.9) : 0.6;
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i);
    const t = (y + height / 2) / height;
    pos.setX(i, pos.getX(i) + bend * t * t);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

// A drooping palm frond: a flattened, curved cone.
export function palmFrond(length, material) {
  const geo = new THREE.ConeGeometry(0.55, length, 6);
  geo.scale(1, 1, 0.22);
  geo.rotateX(Math.PI / 2.6);
  geo.translate(0, -0.2, length * 0.28);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}
