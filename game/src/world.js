// TELUK CAHAYA — the city itself: ground, sea and beach, the road grid with
// markings and crosswalks, textured buildings with real roofs and shopfronts,
// street furniture, traffic lights and the key places. All geometry is
// generated from the seeded RNG, so the city is identical for a given seed.
import * as THREE from 'three';
import { CITY, roadCoord, blockCoord, PALETTE, PLACES } from './config.js';
import {
  asphaltTexture, sidewalkTexture, facadeTexture, glassTexture,
  grassTexture, sandTexture, roofTexture, awningTexture, billboardTexture,
} from './textures.js';
import { gableRoof, dome, roundedBox, palmTrunk, palmFrond } from './shapes.js';

function std(params) {
  const m = new THREE.MeshStandardMaterial(params);
  return m;
}

// A dashed white centre-line texture (transparent background).
function dashTexture() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 16, 128);
  ctx.fillStyle = 'rgba(240,240,230,0.9)';
  ctx.fillRect(6, 8, 4, 56);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

// A zebra-crossing texture: white bars on transparency.
function zebraTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 64);
  ctx.fillStyle = 'rgba(245,245,240,0.92)';
  for (let i = 0; i < 5; i += 1) ctx.fillRect(8 + i * 24, 4, 14, 56);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildWorld(game) {
  const { scene, rng } = game;
  const world = {
    colliders: [],
    roads: [],
    trafficLights: [],
    coins: [],
    places: PLACES,
  };
  const half = CITY.half;

  // ----- Ground: grass city floor, sand beach, sea -----------------------
  const grassMat = std({ map: grassTexture(rng), roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 80, half * 2 + 80), grassMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 10);
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 80, 44),
    std({ map: sandTexture(rng), roughness: 1, metalness: 0 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.04, half + 22);
  sand.receiveShadow = true;
  scene.add(sand);

  const seaMat = std({ color: PALETTE.sea, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.94 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 500, 500), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.35, half + 44 + 250);
  scene.add(sea);

  // ----- Roads ------------------------------------------------------------
  const asphalt = asphaltTexture(rng);
  const roadMat = std({ map: asphalt, roughness: 0.94, metalness: 0.02 });
  const dashTex = dashTexture();
  const zebraTex = zebraTexture();
  const roadLines = [];
  for (let i = 0; i <= CITY.blocks; i += 1) roadLines.push(roadCoord(i));
  world.roads = roadLines;

  for (const c of roadLines) {
    // Vertical road (runs along z).
    const v = new THREE.Mesh(new THREE.PlaneGeometry(CITY.road, half * 2 + 20), roadMat);
    v.rotation.x = -Math.PI / 2;
    v.position.set(c, 0.02, 0);
    v.receiveShadow = true;
    scene.add(v);
    // Horizontal road (runs along x).
    const h = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 20, CITY.road), roadMat);
    h.rotation.x = -Math.PI / 2;
    h.position.set(0, 0.02, c);
    h.receiveShadow = true;
    scene.add(h);
    // Dashed centre lines.
    const dashMat = new THREE.MeshBasicMaterial({ map: dashTex, transparent: true, depthWrite: false });
    dashTex.repeat.set(1, 22);
    const dv = new THREE.Mesh(new THREE.PlaneGeometry(0.35, half * 2 + 20), dashMat.clone());
    dv.material.map = dashTex.clone();
    dv.material.map.repeat.set(1, 26);
    dv.material.map.needsUpdate = true;
    dv.rotation.x = -Math.PI / 2;
    dv.position.set(c, 0.05, 0);
    scene.add(dv);
    const dh = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 20, 0.35), dashMat.clone());
    dh.material.map = dashTex.clone();
    dh.material.map.repeat.set(26, 1);
    dh.material.map.needsUpdate = true;
    dh.rotation.x = -Math.PI / 2;
    dh.position.set(0, 0.05, c);
    scene.add(dh);
  }

  // Crosswalks at a spread of intersections.
  const crossSpots = [];
  for (let i = 1; i < CITY.blocks; i += 2) {
    for (let j = 1; j < CITY.blocks; j += 2) crossSpots.push([roadCoord(i), roadCoord(j)]);
  }
  for (const [cx, cz] of crossSpots.slice(0, 10)) {
    for (const [dx, dz, w, d] of [[0, -8.5, 12, 4.4], [0, 8.5, 12, 4.4], [-8.5, 0, 4.4, 12], [8.5, 0, 4.4, 12]]) {
      const z = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshBasicMaterial({ map: zebraTex, transparent: true, depthWrite: false }),
      );
      z.rotation.x = -Math.PI / 2;
      z.position.set(cx + dx, 0.06, cz + dz);
      scene.add(z);
    }
  }

  // ----- Buildings --------------------------------------------------------
  const facadeBases = {};
  function facadeMat(color, floors) {
    const key = `${color}_${floors}`;
    if (!facadeBases[key]) {
      facadeBases[key] = facadeTexture(rng, `#${color.toString(16).padStart(6, '0')}`, floors);
    }
    return facadeBases[key];
  }
  const roofMats = PALETTE.roofs.map((c) => std({ map: roofTexture(rng), color: c, roughness: 0.85, metalness: 0.05 }));
  const trimMat = std({ color: 0xf2e6cf, roughness: 0.8 });
  const glassMat = std({ map: glassTexture(rng), roughness: 0.15, metalness: 0.6 });

  function addCollider(x, z, w, d) {
    world.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }

  function makeBuilding(bx, bz, w, d, floors, opts = {}) {
    const h = floors * 3.3;
    const color = opts.downtown ? rng.pick(PALETTE.facadesDowntown) : rng.pick(PALETTE.facades);
    const tex = facadeMat(color, floors).clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(w / 13)), 1);
    const side = std({ map: tex, roughness: 0.9, metalness: 0.02 });
    const top = std({ color: 0x8a7f70, roughness: 1 });
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, [side, side, top, top, side, side]);
    mesh.position.set(bx, h / 2, bz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    addCollider(bx, bz, w, d);

    // Roof: pitched gable for low houses, parapet + props for taller blocks.
    if (floors <= 3 && rng.chance(0.75)) {
      const roof = gableRoof(w + 0.6, d + 0.6, rng.range(1.6, 2.8), rng.pick(roofMats));
      roof.position.set(bx, h, bz);
      roof.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
      scene.add(roof);
    } else {
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.5, d + 0.3), trimMat);
      parapet.position.set(bx, h + 0.25, bz);
      parapet.castShadow = true;
      scene.add(parapet);
      if (rng.chance(0.6)) {
        const tank = new THREE.Mesh(
          new THREE.CylinderGeometry(1.1, 1.1, 1.8, 12),
          std({ color: 0x9aa5a8, roughness: 0.6, metalness: 0.4 }),
        );
        tank.position.set(bx + rng.range(-w / 4, w / 4), h + 1.1, bz + rng.range(-d / 4, d / 4));
        tank.castShadow = true;
        scene.add(tank);
      }
      if (rng.chance(0.5)) {
        const ac = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.0), std({ color: 0xd7dbe0, roughness: 0.5, metalness: 0.5 }));
        ac.position.set(bx + rng.range(-w / 3, w / 3), h + 0.55, bz + rng.range(-d / 3, d / 3));
        ac.castShadow = true;
        scene.add(ac);
      }
      if (rng.chance(0.35)) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 4.5, 6), std({ color: 0x666666, roughness: 0.4, metalness: 0.8 }));
        ant.position.set(bx, h + 2.4, bz);
        scene.add(ant);
      }
      if (rng.chance(0.3)) {
        const cup = dome(Math.min(w, d) * 0.22, std({ color: 0x7d8a94, roughness: 0.5, metalness: 0.3 }), 0.7);
        cup.position.set(bx, h + 0.5, bz);
        scene.add(cup);
      }
    }

    // Setback upper storey for taller buildings.
    if (floors >= 5 && rng.chance(0.6)) {
      const uw = w * rng.range(0.55, 0.7);
      const ud = d * rng.range(0.55, 0.7);
      const uh = rng.range(3, 6.5);
      const utex = facadeMat(rng.pick(PALETTE.facadesDowntown), 2).clone();
      utex.needsUpdate = true;
      utex.repeat.set(Math.max(1, Math.round(uw / 13)), 1);
      const up = new THREE.Mesh(
        new THREE.BoxGeometry(uw, uh, ud),
        [std({ map: utex, roughness: 0.9 }), std({ map: utex, roughness: 0.9 }), top, top, std({ map: utex, roughness: 0.9 }), std({ map: utex, roughness: 0.9 })],
      );
      up.position.set(bx, h + uh / 2, bz);
      up.castShadow = true;
      up.receiveShadow = true;
      scene.add(up);
    }

    // Shopfront on the street side for commercial blocks.
    if (opts.shop) {
      const front = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.72, 2.6), glassMat);
      front.position.set(bx, 1.5, bz + d / 2 + 0.06);
      if (opts.face === 'west') { front.rotation.y = -Math.PI / 2; front.position.set(bx - w / 2 - 0.06, 1.5, bz); }
      if (opts.face === 'east') { front.rotation.y = Math.PI / 2; front.position.set(bx + w / 2 + 0.06, 1.5, bz); }
      if (opts.face === 'north') { front.rotation.y = Math.PI; front.position.set(bx, 1.5, bz - d / 2 - 0.06); }
      scene.add(front);
      // Canopy over the shopfront: a group facing the street, with the
      // tilt applied on the canopy's own axis so it stays horizontal
      // (one mesh with both rotations shears diagonally on some facades).
      const awnG = new THREE.Group();
      awnG.position.copy(front.position);
      awnG.position.y = 3.1;
      awnG.rotation.y = front.rotation.y;
      const awn = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.8, 1.4),
        std({ map: awningTexture(`#${rng.pick(PALETTE.awnings).toString(16).padStart(6, '0')}`, '#f2ede2'), roughness: 0.85, side: THREE.DoubleSide }),
      );
      awn.rotation.x = -0.5;
      awn.position.z = 0.5;
      awnG.add(awn);
      scene.add(awnG);
      if (opts.sign) {
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 0.7, 1.1),
          new THREE.MeshBasicMaterial({ map: billboardTexture(opts.sign, '#20242a', '#ffd76a') }),
        );
        sign.position.copy(front.position);
        sign.position.y = 4.1;
        sign.rotation.y = front.rotation.y;
        scene.add(sign);
      }
    }
    return mesh;
  }

  // Lay out the blocks: downtown in the middle, parks, housing, mall east.
  const parkBlocks = new Set(['1,5', '5,1', '5,5']);
  for (let i = 0; i < CITY.blocks; i += 1) {
    for (let j = 0; j < CITY.blocks; j += 1) {
      const cx = blockCoord(i);
      const cz = blockCoord(j);
      const key = `${i},${j}`;
      // Concrete apron (the sidewalk) around each block.
      const apron = new THREE.Mesh(
        new THREE.PlaneGeometry(CITY.block + 2, CITY.block + 2),
        std({ map: sidewalkTexture(rng), roughness: 1 }),
      );
      apron.rotation.x = -Math.PI / 2;
      apron.position.set(cx, 0.05, cz);
      apron.receiveShadow = true;
      scene.add(apron);

      if (parkBlocks.has(key)) {
        // Park: lawn, trees, benches, a path.
        const lawn = new THREE.Mesh(new THREE.PlaneGeometry(CITY.block - 6, CITY.block - 6), std({ map: grassTexture(rng), roughness: 1 }));
        lawn.rotation.x = -Math.PI / 2;
        lawn.position.set(cx, 0.08, cz);
        lawn.receiveShadow = true;
        scene.add(lawn);
        for (let t = 0; t < 7; t += 1) addTree(cx + rng.range(-16, 16), cz + rng.range(-16, 16));
        for (let b = 0; b < 3; b += 1) {
          const bench = roundedBox(2.2, 0.5, 0.7, 0.08, std({ color: 0x7a5230, roughness: 0.85 }));
          bench.position.set(cx + rng.range(-14, 14), 0.45, cz + rng.range(-14, 14));
          bench.rotation.y = rng.range(0, Math.PI);
          scene.add(bench);
        }
        continue;
      }
      const downtown = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      // Mall block: one big low mall with a sign, east side.
      if (i === 6 && j === 2) {
        makeBuilding(cx, cz, 34, 26, 2, { shop: true, sign: 'MALL CAHAYA', face: 'west', downtown: false });
        continue;
      }
      const n = downtown ? (rng.chance(0.5) ? 1 : 2) : (rng.chance(0.6) ? 2 : 1);
      for (let b = 0; b < n; b += 1) {
        const w = rng.range(11, 19);
        const d = rng.range(10, 17);
        const ox = n === 1 ? 0 : (b === 0 ? -10 : 10);
        const oz = n === 1 ? 0 : rng.range(-6, 6);
        const floors = downtown ? rng.int(5, 9) : rng.int(2, 4);
        const shop = downtown || rng.chance(0.45);
        makeBuilding(cx + ox, cz + oz, w, d, floors, {
          shop,
          downtown,
          face: rng.pick(['south', 'west', 'east', 'north']),
          sign: rng.pick(['WARUNG', 'BENGKEL', 'TOKO BESI', 'OJEK 24 JAM', 'KEDAI KOPI', 'LAUNDRY', 'APOTEK', 'FOTOKOPI']),
        });
      }
    }
  }

  // ----- Trees, palms, streetlights, billboards, bus stops ----------------
  function addTree(x, z) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.26, rng.range(2.6, 3.6), 7),
      std({ color: 0x6b4a2f, roughness: 1 }),
    );
    trunk.position.set(x, 1.5, z);
    trunk.castShadow = true;
    scene.add(trunk);
    const crownMat = std({ color: new THREE.Color().setHSL(0.29 + rng.range(-0.03, 0.03), 0.45, rng.range(0.3, 0.42)), roughness: 1 });
    for (let k = 0; k < 3; k += 1) {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(rng.range(1.3, 2.1), 10, 8), crownMat);
      blob.scale.y = 0.75;
      blob.position.set(x + rng.range(-0.9, 0.9), 3.4 + k * 0.7, z + rng.range(-0.9, 0.9));
      blob.castShadow = true;
      scene.add(blob);
    }
  }
  function addPalm(x, z) {
    const trunk = palmTrunk(rng.range(5, 7), std({ color: 0x8a6b48, roughness: 1 }), rng);
    trunk.position.set(x, 3, z);
    scene.add(trunk);
    const frondMat = std({ color: 0x3f7a34, roughness: 0.9, side: THREE.DoubleSide });
    const topX = x + 0.7;
    const topZ = z;
    for (let k = 0; k < 7; k += 1) {
      const f = palmFrond(rng.range(2.6, 3.4), frondMat);
      f.position.set(topX, 6.1, topZ);
      f.rotation.y = (k / 7) * Math.PI * 2;
      scene.add(f);
    }
  }
  // Palms line the beach road and the main avenue.
  for (let k = 0; k < 12; k += 1) addPalm(-170 + k * 31, half - 2);
  for (let k = 0; k < 8; k += 1) addPalm(roadCoord(4) + 8.5, -170 + k * 48);
  for (let k = 0; k < 10; k += 1) addTree(rng.range(-180, 180), rng.range(-180, 170));

  // Streetlights along the two main avenues.
  const poleMat = std({ color: 0x3c4147, roughness: 0.5, metalness: 0.7 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffc46b, emissiveIntensity: 1.4 });
  function addStreetlight(x, z, face) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 6.4, 8), poleMat);
    pole.position.y = 3.2;
    pole.castShadow = true;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 6), poleMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(1.0, 6.3, 0);
    const head = roundedBox(0.9, 0.22, 0.4, 0.06, poleMat);
    head.position.set(2.0, 6.25, 0);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lampMat);
    bulb.position.set(2.0, 6.1, 0);
    g.add(pole, arm, head, bulb);
    g.position.set(x, 0, z);
    g.rotation.y = face;
    scene.add(g);
  }
  for (const c of [roadCoord(2), roadCoord(4)]) {
    for (let k = 0; k < 9; k += 1) {
      const z = -170 + k * 42;
      addStreetlight(c + 8.6, z, Math.PI);
      addStreetlight(c - 8.6, z + 21, 0);
    }
  }
  for (const c of [roadCoord(3)]) {
    for (let k = 0; k < 9; k += 1) {
      const x = -170 + k * 42;
      addStreetlight(x, c + 8.6, Math.PI / 2);
      addStreetlight(x + 21, c - 8.6, -Math.PI / 2);
    }
  }

  // Billboards.
  function addBillboard(x, z, rotY, text) {
    const g = new THREE.Group();
    const legMat = std({ color: 0x4a4f55, roughness: 0.6, metalness: 0.5 });
    for (const dx of [-3, 3]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 8), legMat);
      leg.position.set(dx, 3.5, 0);
      leg.castShadow = true;
      g.add(leg);
    }
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(9, 3.4, 0.3),
      std({ color: 0x2a2f36, roughness: 0.7 }),
    );
    board.position.y = 8.4;
    board.castShadow = true;
    g.add(board);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(8.6, 3.0),
      new THREE.MeshBasicMaterial({ map: billboardTexture(text) }),
    );
    face.position.set(0, 8.4, 0.18);
    g.add(face);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
  }
  addBillboard(roadCoord(4) + 12, roadCoord(1), Math.PI / 2, 'OJEK 24 JAM');
  addBillboard(roadCoord(1) - 12, roadCoord(5), -Math.PI / 2, 'TELUK CAHAYA');
  addBillboard(roadCoord(6) - 12, half - 12, Math.PI, 'PANTAI TELUK');

  // Bus stops: shelter + bench.
  function addBusStop(x, z, rotY) {
    const g = new THREE.Group();
    const postMat = std({ color: 0x5a6068, roughness: 0.5, metalness: 0.6 });
    for (const dx of [-1.4, 1.4]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), postMat);
      p.position.set(dx, 1.2, 0);
      g.add(p);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 1.6), std({ color: 0x2471a3, roughness: 0.6 }));
    roof.position.y = 2.5;
    roof.castShadow = true;
    g.add(roof);
    const bench = roundedBox(2.6, 0.45, 0.6, 0.07, std({ color: 0x7a5230, roughness: 0.85 }));
    bench.position.set(0, 0.42, 0);
    g.add(bench);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
  }
  addBusStop(roadCoord(3) + 8.8, roadCoord(2) + 20, 0);
  addBusStop(roadCoord(5) - 8.8, roadCoord(4) - 20, Math.PI);

  // ----- Traffic lights ---------------------------------------------------
  const lightPositions = [
    [roadCoord(3), roadCoord(3)],
    [roadCoord(4), roadCoord(3)],
    [roadCoord(3), roadCoord(4)],
    [roadCoord(4), roadCoord(4)],
    [roadCoord(2), roadCoord(5)],
    [roadCoord(5), roadCoord(2)],
  ];
  for (const [lx, lz] of lightPositions) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 5.6, 8), poleMat);
    pole.position.y = 2.8;
    pole.castShadow = true;
    g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.4), std({ color: 0x1c1e20, roughness: 0.6 }));
    head.position.set(0, 5.4, 0);
    g.add(head);
    const lampGeo = new THREE.SphereGeometry(0.16, 10, 8);
    const red = new THREE.Mesh(lampGeo, new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2a1a, emissiveIntensity: 2.2 }));
    red.position.set(0, 5.8, 0.22);
    const amber = new THREE.Mesh(lampGeo, new THREE.MeshStandardMaterial({ color: 0x332200, emissive: 0xffb020, emissiveIntensity: 0.15 }));
    amber.position.set(0, 5.4, 0.22);
    const green = new THREE.Mesh(lampGeo, new THREE.MeshStandardMaterial({ color: 0x002200, emissive: 0x2aff5a, emissiveIntensity: 0.15 }));
    green.position.set(0, 5.0, 0.22);
    g.add(red, amber, green);
    g.position.set(lx + 8.2, 0, lz + 8.2);
    scene.add(g);
    world.trafficLights.push({ x: lx, z: lz, phase: rng.chance(0.5) ? 0 : 1, timer: rng.range(0, 6), red, amber, green });
  }

  // ----- The pier ---------------------------------------------------------
  const pierMat = std({ color: 0x8a6b48, roughness: 0.95 });
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 52), pierMat);
  pierDeck.position.set(PLACES.pier.x, 0.6, half + 20 + 24);
  pierDeck.castShadow = true;
  pierDeck.receiveShadow = true;
  scene.add(pierDeck);
  for (let k = 0; k < 7; k += 1) {
    for (const dx of [-3, 3]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3.2, 8), pierMat);
      post.position.set(PLACES.pier.x + dx, -0.6, half + 8 + k * 8);
      scene.add(post);
    }
  }
  const hut = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3, 4), std({ color: 0xe8dcc8, roughness: 0.9 }));
  hut.position.set(PLACES.pier.x + 6, 1.5, half + 30);
  hut.castShadow = true;
  scene.add(hut);
  const hutRoof = gableRoof(5.2, 4.6, 1.6, std({ color: 0xa8542f, roughness: 0.85 }));
  hutRoof.position.set(PLACES.pier.x + 6, 3, half + 30);
  scene.add(hutRoof);

  // ----- Parked cars (visual) + coins ------------------------------------
  world.parkedSpots = [];
  for (let k = 0; k < 6; k += 1) {
    const road = rng.pick(roadLines);
    const along = rng.range(-160, 160);
    const side = rng.sign();
    world.parkedSpots.push({
      x: road + side * 4.6,
      z: along,
      rotY: side > 0 ? Math.PI / 2 : -Math.PI / 2,
      vertical: true,
    });
  }
  // Golden coins scattered near roads and landmarks.
  const coinSpots = [
    [roadCoord(3) + 9, roadCoord(2) + 30], [roadCoord(5) - 9, roadCoord(4) - 40],
    [roadCoord(2) + 9, roadCoord(5) + 12], [roadCoord(6) - 9, roadCoord(3) + 44],
    [PLACES.warung.x + 12, PLACES.warung.z - 6], [PLACES.mall.x - 22, PLACES.mall.z + 10],
    [roadCoord(4) + 9, roadCoord(6) - 18], [roadCoord(1) - 9, roadCoord(1) + 26],
    [PLACES.pier.x - 10, half + 8], [roadCoord(3) - 9, roadCoord(6) + 30],
  ];
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc93c, roughness: 0.25, metalness: 0.9, emissive: 0x8a6400, emissiveIntensity: 0.5 });
  for (const [cx, cz] of coinSpots) {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20), coinMat);
    coin.rotation.x = Math.PI / 2;
    coin.position.set(cx, 1.1, cz);
    coin.castShadow = true;
    scene.add(coin);
    world.coins.push({ x: cx, z: cz, mesh: coin, taken: false });
  }

  // Collision helper: push a circle (x, z, radius) out of building boxes.
  world.collide = (x, z, radius) => {
    let px = x;
    let pz = z;
    for (const b of world.colliders) {
      const cx = Math.max(b.minX, Math.min(px, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pz, b.maxZ));
      const dx = px - cx;
      const dz = pz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          px = cx + (dx / d) * radius;
          pz = cz + (dz / d) * radius;
        } else {
          // Centre inside the box: push out along the smallest penetration.
          const pl = px - b.minX;
          const pr = b.maxX - px;
          const pt = pz - b.minZ;
          const pb = b.maxZ - pz;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) px = b.minX - radius;
          else if (m === pr) px = b.maxX + radius;
          else if (m === pt) pz = b.minZ - radius;
          else pz = b.maxZ + radius;
        }
      }
    }
    return [px, pz];
  };

  world.bounds = { minX: -half - 8, maxX: half + 8, minZ: -half - 8, maxZ: half + 34 };
  return world;
}
