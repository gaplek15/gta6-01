// The city of Teluk Cahaya: procedural streets, buildings, beach, sea,
// landmarks, palms, lamps, signs and traffic lights — plus collision.
// Nothing here is a plain cube: buildings have rounded corners, setbacks
// and sloped roofs; trees are soft canopies; roads have sidewalks and
// zebra crossings. One job: build the world the rest of the game lives in,
// and answer "can something stand here?" for everything that moves.
import * as THREE from 'three';
import { CITY, SIGNS } from './config.js';
import { int, pick, range } from './random.js';
import { roundedSlab, roundedBar, gableRoof, hipRoof, canopyCluster } from './shapes.js';

export const ROAD_COORDS = [];
for (let c = -270; c <= 270; c += 60) ROAD_COORDS.push(c);

// Named places the missions and activities point at. Every one sits on a
// block centre (blocks are centred at -240 + k*60) or on open ground.
export const PLACES = {
  plaza: { x: 30, z: 30, name: 'Plaza Cahaya' },
  mall: { x: 180, z: -120, name: 'Mall Cahaya' },
  garage: { x: -180, z: 180, name: 'Bengkel Darma' },
  warung: { x: -60, z: -60, name: 'Warung Mbak Sari' },
  policeStation: { x: 60, z: 240, name: 'Polsek Teluk' },
  hospital: { x: -180, z: -180, name: 'RS Cahaya' },
  pier: { x: -30, z: 265, name: 'Dermaga Teluk' },
  gunshop: { x: 120, z: 120, name: 'Toko Besi' },
  beach: { x: 90, z: 265, name: 'Pantai Cahaya' },
};

// Warm, natural facade colours — sun-bleached plaster, terracotta, sage,
// dusty blue — never flat grey.
const WALL_COLORS = [0xe9dcc3, 0xd9a066, 0x8fae9b, 0xe0b39a, 0xf0e6d2, 0xc7d3c0, 0xd9987f, 0xa9bccb, 0xe6cfa8, 0xcbb59a, 0xdfc9a8, 0xb9c4a8];
const ROOF_COLORS = [0xa8573c, 0x6a6a72, 0x8a5a3a, 0x7a4a3a, 0x9a6a4a];

function canvasTexture(width, height, draw) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  draw(c.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A facade: framed windows with glass — some warm-lit — and floor lines,
// drawn once and tiled across each wall. The material colour tints the
// white wall base, so one texture serves every facade colour.
function facadeTexture(rng) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.07)';
    for (let row = 0; row < 5; row += 1) g.fillRect(0, row * 51, w, 2);
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const x = 14 + col * 60;
        const y = 10 + row * 51;
        g.fillStyle = '#e8e2d4'; // frame
        g.fillRect(x - 3, y - 3, 40, 34);
        const lit = rng() < 0.22;
        g.fillStyle = lit ? '#ffd98a' : '#2e4256'; // glass
        g.fillRect(x, y, 34, 28);
        g.fillStyle = 'rgba(255,255,255,0.28)';
        g.fillRect(x, y, 34, 6); // sky reflection
        g.fillStyle = '#e8e2d4';
        g.fillRect(x + 16, y, 2, 28); // mullion
      }
    }
  });
}

function awningTexture() {
  return canvasTexture(128, 32, (g, w, h) => {
    for (let i = 0; i < 8; i += 1) {
      g.fillStyle = i % 2 === 0 ? '#d94f3d' : '#f5f0e6';
      g.fillRect(i * 16, 0, 16, h);
    }
  });
}

function signTexture(text, bg, fg) {
  return canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = 'bold 26px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 1, w - 16);
  });
}

function zebraTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(245,240,230,0.92)';
    for (let i = 0; i < 5; i += 1) {
      const x = 12 + i * 50;
      g.beginPath();
      g.roundRect(x, 8, 30, h - 16, 6);
      g.fill();
    }
  });
}

export function createWorld(scene, rng) {
  const colliders = [];
  const animated = { sea: [], lights: [], fountain: null, clouds: [] };
  const facadeTex = facadeTexture(rng);
  const awnTex = awningTexture();
  const zebTex = zebraTexture();

  function addCollider(minX, maxX, minZ, maxZ) {
    colliders.push({ minX, maxX, minZ, maxZ });
  }

  function lambert(color, opts = {}) {
    return new THREE.MeshLambertMaterial({ color, ...opts });
  }

  function box(w, h, d, color, x, y, z, opts = {}) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({
        color,
        map: opts.map || null,
        emissive: opts.emissive || 0x000000,
        emissiveIntensity: opts.emissiveIntensity || 1,
      }),
    );
    m.position.set(x, y, z);
    if (opts.ry) m.rotation.y = opts.ry;
    m.castShadow = opts.shadow !== false;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  function cylinder(rt, rb, h, color, x, y, z, seg = 12) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(rt, rb, h, seg),
      new THREE.MeshLambertMaterial({ color }),
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  // --- ground, beach, sea -------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 400, CITY.half * 2 + 400),
    new THREE.MeshLambertMaterial({ color: 0x8f8672 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2, 48),
    new THREE.MeshLambertMaterial({ color: 0xe8cf9a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.03, CITY.beachZ + 18);
  sand.receiveShadow = true;
  scene.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 400),
    new THREE.MeshLambertMaterial({ color: 0x2a7fa8, transparent: true, opacity: 0.92 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.02, CITY.seaZ + 200);
  sea.receiveShadow = false;
  scene.add(sea);
  animated.sea.push(sea);

  // White foam strips where the waves meet the sand.
  for (let i = 0; i < 5; i += 1) {
    const foam = box(1200, 0.1, 2, 0xffffff, 0, 0.06, CITY.seaZ + 2 + i * 4, { shadow: false });
    foam.material.transparent = true;
    foam.material.opacity = 0.5 - i * 0.08;
    animated.sea.push(foam);
  }

  // --- roads, sidewalks, zebra crossings ------------------------------------
  // A flat plane on the ground: rotZ = 0 runs along X, rotZ = PI/2 runs
  // along Z. (Rotation is applied Z first, then X — so the long side of a
  // plane with rotZ = PI/2 ends up along Z.)
  function flatPlane(w, h, mat, x, y, z, rotZ) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.rotation.x = -Math.PI / 2;
    if (rotZ) m.rotation.z = rotZ;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  const roadMat = new THREE.MeshLambertMaterial({ color: 0x43434a });
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xe8e2d4 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xb5ad9c });
  for (const c of ROAD_COORDS) {
    // East-west road at z = c, north-south road at x = c.
    flatPlane(CITY.half * 2, CITY.roadWidth, roadMat, 0, 0.04, c, 0);
    flatPlane(CITY.half * 2, CITY.roadWidth, roadMat, c, 0.04, 0, Math.PI / 2);
    // Centre dashes along both roads.
    for (let d = -CITY.half + 8; d < CITY.half; d += 16) {
      flatPlane(6, 0.5, dashMat, d, 0.06, c, 0);
      flatPlane(6, 0.5, dashMat, c, 0.06, d, Math.PI / 2);
    }
    // Sidewalks: raised concrete strips on both sides, so the asphalt
    // reads as a street, not an empty plain. The two directions sit at
    // slightly different heights to avoid z-fighting at crossings.
    for (const side of [-1, 1]) {
      flatPlane(CITY.half * 2, 2.6, walkMat, 0, 0.06, c + side * 8.3, 0);
      flatPlane(CITY.half * 2, 2.6, walkMat, c + side * 8.3, 0.07, 0, Math.PI / 2);
    }
  }

  // Zebra crossings at the busiest intersections, one textured plane each.
  const zebraSpots = [
    [30, 30, 0], [30, 90, 1], [-30, -30, 0], [90, 30, 1], [-90, 90, 0],
    [150, -30, 1], [-150, 30, 0], [30, -90, 1], [-30, 150, 0], [90, -90, 1],
  ];
  for (const [zx, zz, rot] of zebraSpots) {
    const z = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 5),
      new THREE.MeshLambertMaterial({ map: zebTex, transparent: true, depthWrite: false }),
    );
    z.rotation.x = -Math.PI / 2;
    z.rotation.z = rot ? Math.PI / 2 : 0;
    z.position.set(zx, 0.08, zz);
    z.receiveShadow = true;
    scene.add(z);
  }

  // --- buildings ------------------------------------------------------------
  const landmarkBlocks = new Set();
  for (const key of Object.keys(PLACES)) {
    const p = PLACES[key];
    const bx = Math.round((p.x + 240) / 60);
    const bz = Math.round((p.z + 240) / 60);
    landmarkBlocks.add(`${bx},${bz}`);
  }

  // One facade material per building: the window texture tiled so a window
  // lands about every 3.5 m across and every 3 m up, whatever the size.
  // (ExtrudeGeometry side UVs are in metres, so the repeat is 1/metre.)
  function facadeMaterial(color, w, d, h) {
    const tex = facadeTex.clone();
    tex.needsUpdate = true;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1 / 14, 1 / 15);
    return new THREE.MeshLambertMaterial({ color, map: tex });
  }

  function buildingAt(bx, bz, w, d, h, color, signText) {
    const cx = -240 + bx * 60;
    const cz = -240 + bz * 60;
    const x = cx + range(rng, -8, 8);
    const z = cz + range(rng, -8, 8);
    const roofColor = pick(rng, ROOF_COLORS);
    const roofMat = lambert(roofColor);
    const lidMat = lambert(color);
    const baseH = h * 0.62;
    const hasUpper = h > 18;
    const upperH = hasUpper ? h * 0.38 : 0;
    const topY = baseH + upperH;

    // Main tier: rounded corners, windowed walls, plain cap.
    const base = roundedSlab(w, baseH, d, 2, facadeMaterial(color, w, d, baseH), lidMat);
    base.position.set(x, 0, z);
    scene.add(base);
    addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    if (hasUpper) {
      const upper = roundedSlab(w * 0.72, upperH, d * 0.72, 2, facadeMaterial(color, w * 0.72, d * 0.72, upperH), lidMat);
      upper.position.set(x, baseH, z);
      scene.add(upper);
    }
    // A sloped roof — gable or hip — so no skyline is a flat box.
    const roofW = hasUpper ? w * 0.72 : w;
    const roofD = hasUpper ? d * 0.72 : d;
    const isGable = rng() < 0.5;
    const roof = isGable
      ? gableRoof(roofW, roofD, 3.2, roofMat)
      : hipRoof(roofW, roofD, 2.8, roofMat);
    roof.position.set(x, topY - 0.2, z);
    if (isGable && rng() < 0.5) roof.rotation.y = Math.PI / 2; // ridge the other way
    scene.add(roof);

    // Ground-floor shopfront on one street side: glass, a striped awning
    // and a sign, so the street reads as shops, not blank walls.
    if (rng() < 0.45) {
      const side = pick(rng, ['+z', '-z', '+x', '-x']);
      const fw = Math.min(w * 0.55, 12);
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(fw, 2.8),
        new THREE.MeshLambertMaterial({ color: 0x2e4256, emissive: 0x1a2a38, emissiveIntensity: 0.4 }),
      );
      const awn = new THREE.Mesh(
        new THREE.PlaneGeometry(fw + 1, 1.8),
        new THREE.MeshLambertMaterial({ map: awnTex, side: THREE.DoubleSide }),
      );
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(16, fw), 2),
        new THREE.MeshLambertMaterial({ map: signTexture(signText || pick(rng, SIGNS), '#20303f', '#ffd94d') }),
      );
      const place = (mesh, dist, y, ry) => {
        mesh.position.set(
          x + (side === '+x' ? dist : side === '-x' ? -dist : 0),
          y,
          z + (side === '+z' ? dist : side === '-z' ? -dist : 0),
        );
        mesh.rotation.y = ry;
        scene.add(mesh);
      };
      const faceRy = side === '+z' ? 0 : side === '-z' ? Math.PI : side === '+x' ? Math.PI / 2 : -Math.PI / 2;
      const faceD = (side === '+z' || side === '-z' ? d : w) / 2 + 0.1;
      place(glass, faceD, 1.6, faceRy);
      awn.position.set(
        x + (side === '+x' ? faceD + 0.7 : side === '-x' ? -faceD - 0.7 : 0),
        3.4,
        z + (side === '+z' ? faceD + 0.7 : side === '-z' ? -faceD - 0.7 : 0),
      );
      awn.rotation.set(-Math.PI / 2 + 0.45, faceRy, 0);
      awn.castShadow = true;
      scene.add(awn);
      place(sign, faceD + 0.15, 4.6, faceRy);
    }

    // Balconies on some taller buildings.
    if (h > 14 && rng() < 0.4) {
      for (let f = 0; f < 2; f += 1) {
        const by = 5 + f * 5 + range(rng, 0, 2);
        const balc = roundedBar(Math.min(w * 0.4, 8), 0.18, 1.4, 0.06, lambert(0xd8d2c4));
        balc.position.set(x + range(rng, -w / 4, w / 4), by, z + d / 2 + 0.5);
        scene.add(balc);
      }
    }
    return { x, z, w, d, h };
  }

  for (let bx = 0; bx < 9; bx += 1) {
    for (let bz = 0; bz < 9; bz += 1) {
      if (landmarkBlocks.has(`${bx},${bz}`)) continue;
      // The beach row stays open.
      if (bz === 8) continue;
      const count = int(rng, 1, 2);
      for (let i = 0; i < count; i += 1) {
        const w = range(rng, 16, 30);
        const d = range(rng, 16, 30);
        const h = range(rng, 8, 34);
        buildingAt(bx, bz, w, d, h, pick(rng, WALL_COLORS), null);
      }
      // A garden patch inside some blocks: lawn, bushes and a bench.
      if (rng() < 0.55) {
        const gx = -240 + bx * 60 + range(rng, -14, 14);
        const gz = -240 + bz * 60 + range(rng, -14, 14);
        const lawn = new THREE.Mesh(
          new THREE.CircleGeometry(7, 20),
          new THREE.MeshLambertMaterial({ color: 0x6a9a4a }),
        );
        lawn.rotation.x = -Math.PI / 2;
        lawn.position.set(gx, 0.05, gz);
        lawn.receiveShadow = true;
        scene.add(lawn);
        const bush = canopyCluster(rng, 1.6, 0x4a7a3a);
        bush.position.set(gx + 3, 1.2, gz - 2);
        scene.add(bush);
        const bush2 = canopyCluster(rng, 1.3, 0x5a8a42);
        bush2.position.set(gx - 3.5, 1, gz + 2.5);
        scene.add(bush2);
      }
    }
  }

  // --- landmarks ------------------------------------------------------------
  function landmark(p, w, d, h, color, signText, signBg, roofKind) {
    const lidMat = lambert(color);
    const m = roundedSlab(w, h, d, 2, facadeMaterial(color, w, d, h), lidMat);
    m.position.set(p.x, 0, p.z);
    scene.add(m);
    addCollider(p.x - w / 2, p.x + w / 2, p.z - d / 2, p.z + d / 2);
    if (roofKind === 'gable') {
      const roof = gableRoof(w, d, 3.5, lambert(pick(rng, ROOF_COLORS)));
      roof.position.set(p.x, h - 0.2, p.z);
      scene.add(roof);
    } else if (roofKind === 'hip') {
      const roof = hipRoof(w, d, 3, lambert(pick(rng, ROOF_COLORS)));
      roof.position.set(p.x, h - 0.2, p.z);
      scene.add(roof);
    }
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(30, w + 4), 5),
      new THREE.MeshLambertMaterial({ map: signTexture(signText, signBg || '#20303f', '#ffd94d') }),
    );
    sign.position.set(p.x, h + 2.8, p.z + d / 2 + 0.2);
    scene.add(sign);
    return m;
  }

  // Mall Cahaya — big rounded box with a curved glass front.
  landmark(PLACES.mall, 34, 26, 16, 0xdde4ea, 'MALL CAHAYA', '#7a2e2e', null);
  const mallGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(16, 16, 11, 24, 1, true, -0.55, 1.1),
    new THREE.MeshLambertMaterial({ color: 0x9fc4d8, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  );
  mallGlass.position.set(PLACES.mall.x, 5.5, PLACES.mall.z + 2);
  scene.add(mallGlass);
  // Bengkel Darma — low garage with a pitched roof and an open bay.
  landmark(PLACES.garage, 26, 20, 8, 0x8a7a5a, 'BENGKEL DARMA', '#3a5a2e', 'gable');
  box(10, 5, 1, 0x222222, PLACES.garage.x - 5, 2.5, PLACES.garage.z + 10.5);
  // Polsek Teluk — blue and white, with a small dome.
  landmark(PLACES.policeStation, 24, 20, 12, 0xdde8f2, 'POLSEK TELUK', '#1e4a8a', 'hip');
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    lambert(0x1e4a8a),
  );
  dome.position.set(PLACES.policeStation.x, 12.5, PLACES.policeStation.z);
  dome.castShadow = true;
  scene.add(dome);
  // RS Cahaya — white with a green cross on the roof.
  landmark(PLACES.hospital, 28, 22, 14, 0xf2f5f0, 'RS CAHAYA', '#2e7a4a', 'hip');
  const cross1 = roundedBar(6, 1.5, 1.5, 0.4, lambert(0x2e9e5a));
  cross1.position.set(PLACES.hospital.x, 15.2, PLACES.hospital.z);
  scene.add(cross1);
  const cross2 = roundedBar(1.5, 6, 1.5, 0.4, lambert(0x2e9e5a));
  cross2.position.set(PLACES.hospital.x, 15.2, PLACES.hospital.z);
  scene.add(cross2);
  // Toko Besi — the gun shop, pitched roof.
  landmark(PLACES.gunshop, 18, 14, 7, 0x6a5a4a, 'TOKO BESI', '#4a2e2e', 'gable');

  // Warung Mbak Sari — small stall with a pitched roof and striped awning.
  const warung = PLACES.warung;
  const warungSlab = roundedSlab(8, 4, 6, 1.2, lambert(0xe8dcc8), lambert(0xe8dcc8));
  warungSlab.position.set(warung.x, 0, warung.z);
  scene.add(warungSlab);
  addCollider(warung.x - 4, warung.x + 4, warung.z - 3, warung.z + 3);
  const warungRoof = gableRoof(9, 7, 2.2, lambert(0xa8573c));
  warungRoof.position.set(warung.x, 4, warung.z);
  scene.add(warungRoof);
  const awn = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 4),
    new THREE.MeshLambertMaterial({ map: awnTex, side: THREE.DoubleSide }),
  );
  awn.rotation.x = -Math.PI / 2 + 0.35;
  awn.position.set(warung.x, 4.6, warung.z + 2);
  awn.castShadow = true;
  scene.add(awn);
  const wsign = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 2.2),
    new THREE.MeshLambertMaterial({ map: signTexture('WARUNG MBAK SARI', '#7a2e2e', '#ffe9a8') }),
  );
  wsign.position.set(warung.x, 5.6, warung.z + 3.2);
  scene.add(wsign);
  // Food carts and tables outside.
  const cart1 = roundedBar(2.4, 1.4, 1.4, 0.2, lambert(0x9a6a3a));
  cart1.position.set(warung.x + 7, 0, warung.z + 2);
  scene.add(cart1);
  const cart2 = roundedBar(2.4, 1.4, 1.4, 0.2, lambert(0x7a8a4a));
  cart2.position.set(warung.x - 7, 0, warung.z + 3);
  scene.add(cart2);

  // Plaza Cahaya — fountain, benches and palms at the spawn.
  const plaza = PLACES.plaza;
  cylinder(7, 8, 1, 0x9aa0a8, plaza.x, 0.5, plaza.z, 20);
  addCollider(plaza.x - 8, plaza.x + 8, plaza.z - 8, plaza.z + 8); // the fountain is a roundabout
  const water = cylinder(6, 6, 0.4, 0x4aa8d8, plaza.x, 1.1, plaza.z, 20);
  animated.fountain = water;
  const bench1 = roundedBar(4, 1, 2, 0.2, lambert(0x8a7a5a));
  bench1.position.set(plaza.x + 12, 0, plaza.z - 8);
  scene.add(bench1);
  const bench2 = roundedBar(4, 1, 2, 0.2, lambert(0x8a7a5a));
  bench2.position.set(plaza.x - 12, 0, plaza.z + 8);
  scene.add(bench2);

  // Dermaga Teluk — wooden pier into the sea.
  const pier = PLACES.pier;
  box(10, 0.6, 40, 0x8a6a3a, pier.x, 0.4, pier.z + 12);
  for (let i = 0; i < 4; i += 1) {
    cylinder(0.5, 0.5, 3, 0x6a4a2a, pier.x - 4, 0.5, pier.z + 2 + i * 8);
    cylinder(0.5, 0.5, 3, 0x6a4a2a, pier.x + 4, 0.5, pier.z + 2 + i * 8);
  }
  // Two little boats bobbing by the pier.
  for (const bx of [-16, 14]) {
    const boat = roundedBar(4, 1.2, 10, 0.4, lambert(0xdde4ea));
    boat.position.set(pier.x + bx, 0.6, pier.z + 18);
    boat.rotation.y = 0.2;
    scene.add(boat);
    animated.sea.push(boat);
  }

  // --- trees, lamps, traffic lights -----------------------------------------
  function palm(x, z) {
    const trunk = cylinder(0.35, 0.55, 7, 0x7a5a3a, x, 3.5, z, 8);
    trunk.rotation.z = range(rng, -0.08, 0.08);
    // A crown of drooping fronds: flattened ellipsoids, never cones.
    const crownMat = lambert(0x4a9a55);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + range(rng, -0.2, 0.2);
      const frond = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), crownMat);
      frond.scale.set(2.4, 0.32, 1.0);
      frond.position.set(x + Math.cos(a) * 1.8, 7.3, z + Math.sin(a) * 1.8);
      frond.rotation.y = -a;
      frond.rotation.z = 0.55;
      frond.castShadow = true;
      scene.add(frond);
    }
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), crownMat);
    top.scale.y = 0.6;
    top.position.set(x, 7.5, z);
    top.castShadow = true;
    scene.add(top);
    addCollider(x - 0.5, x + 0.5, z - 0.5, z + 0.5);
  }

  function tree(x, z) {
    cylinder(0.28, 0.45, 4.5, 0x6a4a2a, x, 2.25, z, 8);
    const canopy = canopyCluster(rng, 2.4, pick(rng, [0x4a7a3a, 0x5a8a42, 0x3a6a3a]));
    canopy.position.set(x, 5.2, z);
    scene.add(canopy);
    addCollider(x - 0.5, x + 0.5, z - 0.5, z + 0.5);
  }

  function lamp(x, z, armDir) {
    cylinder(0.12, 0.18, 6, 0x333333, x, 3, z, 6);
    // A curved arm reaching over the road, and a warm glowing bulb.
    const arm = new THREE.Mesh(
      new THREE.TorusGeometry(1.3, 0.08, 8, 12, Math.PI / 2),
      lambert(0x333333),
    );
    arm.position.set(x, 6, z);
    arm.rotation.y = armDir;
    arm.castShadow = true;
    scene.add(arm);
    const reach = 1.3;
    const bx = x + (armDir === 0 ? reach : armDir === Math.PI ? -reach : 0);
    const bz = z + (armDir === Math.PI / 2 ? reach : armDir === -Math.PI / 2 ? -reach : 0);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffd94d, emissiveIntensity: 0.9 }),
    );
    bulb.position.set(bx, 7.3, bz);
    scene.add(bulb);
    addCollider(x - 0.2, x + 0.2, z - 0.2, z + 0.2);
  }

  function trafficLight(x, z) {
    cylinder(0.12, 0.16, 5, 0x222222, x, 2.5, z, 6);
    const head = roundedBar(0.55, 1.7, 0.55, 0.12, lambert(0x111111));
    head.position.set(x, 5.6, z);
    scene.add(head);
    const red = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1 }),
    );
    red.position.set(x, 6.05, z + 0.3);
    scene.add(red);
    const green = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x22cc44, emissive: 0x22cc44, emissiveIntensity: 0.2 }),
    );
    green.position.set(x, 5.25, z + 0.3);
    scene.add(green);
    animated.lights.push({ red, green, phase: rng() * 10 });
    addCollider(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
  }

  for (const c of ROAD_COORDS) {
    for (let d = -270; d <= 270; d += 60) {
      if (d === 270 && c > 200) continue; // keep the beach clear
      if (rng() < 0.5) palm(c + 9, d + 9);
      else if (rng() < 0.5) tree(c + 9, d + 9);
      if (rng() < 0.4) lamp(c - 9, d - 9, pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]));
    }
  }
  // Beach palms.
  for (let x = -240; x <= 240; x += 40) {
    if (rng() < 0.7) palm(x + range(rng, -8, 8), 258 + range(rng, 0, 12));
  }
  // Traffic lights on the main crossroads.
  trafficLight(38, 38);
  trafficLight(-38, -38);
  trafficLight(158, 38);
  trafficLight(-158, -38);

  // A few billboards with the city's own jokes.
  const billboards = [
    { x: -120, z: 38, text: 'ES KELAPA MUDA', bg: '#2e7a4a' },
    { x: 120, z: -38, text: 'OJEK 24 JAM', bg: '#7a2e2e' },
    { x: -38, z: 158, text: 'TELUK CAHAYA', bg: '#1e4a8a' },
  ];
  for (const b of billboards) {
    box(0.6, 9, 0.6, 0x555555, b.x, 4.5, b.z);
    const frame = roundedBar(18.6, 5.1, 0.4, 0.3, lambert(0x222222));
    frame.position.set(b.x, 10.5, b.z);
    frame.rotation.y = b.x < 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(frame);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 4.5),
      new THREE.MeshLambertMaterial({ map: signTexture(b.text, b.bg, '#ffe9a8') }),
    );
    board.position.set(b.x, 10.5, b.z);
    board.rotation.y = b.x < 0 ? Math.PI / 2 : -Math.PI / 2;
    board.position.x += b.x < 0 ? 0.25 : -0.25;
    scene.add(board);
    addCollider(b.x - 0.5, b.x + 0.5, b.z - 0.5, b.z + 0.5);
  }

  // --- collision and helpers ------------------------------------------------
  function collides(x, z, r) {
    if (Math.abs(x) > CITY.half - 2 || z > 288 || z < -CITY.half + 2) return true;
    for (const c of colliders) {
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
    }
    return false;
  }

  function resolveCircle(pos, r) {
    for (const c of colliders) {
      if (pos.x + r > c.minX && pos.x - r < c.maxX && pos.z + r > c.minZ && pos.z - r < c.maxZ) {
        const pushLeft = pos.x + r - c.minX;
        const pushRight = c.maxX - (pos.x - r);
        const pushUp = pos.z + r - c.minZ;
        const pushDown = c.maxZ - (pos.z - r);
        const m = Math.min(pushLeft, pushRight, pushUp, pushDown);
        if (m === pushLeft) pos.x = c.minX - r;
        else if (m === pushRight) pos.x = c.maxX + r;
        else if (m === pushUp) pos.z = c.minZ - r;
        else pos.z = c.maxZ + r;
      }
    }
    pos.x = Math.max(-CITY.half + 2, Math.min(CITY.half - 2, pos.x));
    pos.z = Math.max(-CITY.half + 2, Math.min(288, pos.z));
  }

  function isRoad(x, z) {
    for (const c of ROAD_COORDS) {
      if (Math.abs(x - c) < CITY.roadWidth / 2) return true;
      if (Math.abs(z - c) < CITY.roadWidth / 2) return true;
    }
    return false;
  }

  function randomRoadPoint() {
    const horizontal = rng() < 0.5;
    const c = pick(rng, ROAD_COORDS);
    const along = range(rng, -270, 270);
    return horizontal ? { x: along, z: c } : { x: c, z: along };
  }

  function update(dt, time) {
    for (const s of animated.sea) {
      s.position.y = 0.02 + Math.sin(time * 0.8 + s.position.x * 0.02) * 0.15;
    }
    if (animated.fountain) animated.fountain.rotation.y = time * 0.5;
    for (const l of animated.lights) {
      const on = Math.sin(time * 0.5 + l.phase) > 0;
      l.red.material.emissiveIntensity = on ? 1 : 0.15;
      l.green.material.emissiveIntensity = on ? 0.15 : 1;
    }
  }

  return {
    colliders,
    collides,
    resolveCircle,
    isRoad,
    randomRoadPoint,
    update,
    places: PLACES,
  };
}
