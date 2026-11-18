// The city of Teluk Cahaya: procedural streets, buildings, beach, sea,
// landmarks, palms, lamps, signs and traffic lights — plus collision.
// One job: build the world the rest of the game lives in, and answer
// "can something stand here?" for everything that moves.
import * as THREE from 'three';
import { CITY, SIGNS } from './config.js';
import { int, pick, range } from './random.js';

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

const WALL_COLORS = [0xe8dcc8, 0xd9a066, 0x7fb3a3, 0xe8b4a0, 0xf2ead8, 0xc9d6c5, 0xe0a899, 0x9db8c9];

function canvasTexture(width, height, draw) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  draw(c.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function windowTexture() {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#f5f0e6';
    g.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const lit = Math.random() < 0.25;
        g.fillStyle = lit ? '#ffd98a' : '#2c3e50';
        g.fillRect(10 + col * 30, 12 + row * 30, 20, 18);
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

export function createWorld(scene, rng) {
  const colliders = [];
  const animated = { sea: [], lights: [], fountain: null };
  const winTex = windowTexture();
  const awnTex = awningTexture();

  function addCollider(minX, maxX, minZ, maxZ) {
    colliders.push({ minX, maxX, minZ, maxZ });
  }

  function box(w, h, d, color, x, y, z, opts = {}) {
    const mat = new THREE.MeshLambertMaterial({
      color,
      map: opts.map || null,
      emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.emissiveIntensity || 1,
    });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (opts.ry) m.rotation.y = opts.ry;
    m.castShadow = opts.shadow !== false;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  function cylinder(rt, rb, h, color, x, y, z, seg = 10) {
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
    new THREE.MeshLambertMaterial({ color: 0xa8a294 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2, 48),
    new THREE.MeshLambertMaterial({ color: 0xe8d5a0 }),
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

  // --- roads ----------------------------------------------------------------
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x565660 });
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xf5f0e6 });
  for (const c of ROAD_COORDS) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, CITY.roadWidth), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = horizontal ? Math.PI / 2 : 0;
      road.position.set(horizontal ? 0 : c, 0.04, horizontal ? c : 0);
      road.receiveShadow = true;
      scene.add(road);
      // Centre dashes.
      for (let d = -CITY.half + 8; d < CITY.half; d += 16) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.5), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = horizontal ? Math.PI / 2 : 0;
        dash.position.set(horizontal ? d : c, 0.06, horizontal ? c : d);
        scene.add(dash);
      }
    }
  }

  // --- buildings ------------------------------------------------------------
  const landmarkBlocks = new Set();
  for (const key of Object.keys(PLACES)) {
    const p = PLACES[key];
    const bx = Math.round((p.x + 240) / 60);
    const bz = Math.round((p.z + 240) / 60);
    landmarkBlocks.add(`${bx},${bz}`);
  }

  function buildingAt(bx, bz, w, d, h, color, signText) {
    const cx = -240 + bx * 60;
    const cz = -240 + bz * 60;
    const x = cx + range(rng, -8, 8);
    const z = cz + range(rng, -8, 8);
    const wall = new THREE.MeshLambertMaterial({ color, map: winTex });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    // Roof props: AC box and a water tank.
    if (rng() < 0.7) box(3, 1.2, 2, 0x888888, x + range(rng, -4, 4), h + 0.6, z + range(rng, -4, 4));
    if (rng() < 0.4) cylinder(1.4, 1.4, 2.4, 0x4a6b7a, x + range(rng, -4, 4), h + 1.2, z + range(rng, -4, 4));
    if (signText) {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(22, 5.5),
        new THREE.MeshLambertMaterial({ map: signTexture(signText, '#20303f', '#ffd94d') }),
      );
      sign.position.set(x, h + 3.4, z + d / 2 + 0.2);
      scene.add(sign);
    }
    return m;
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
    }
  }

  // --- landmarks ------------------------------------------------------------
  function landmark(p, w, d, h, color, signText, signBg) {
    const m = box(w, h, d, color, p.x, h / 2, p.z);
    addCollider(p.x - w / 2, p.x + w / 2, p.z - d / 2, p.z + d / 2);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(30, w + 4), 5),
      new THREE.MeshLambertMaterial({ map: signTexture(signText, signBg || '#20303f', '#ffd94d') }),
    );
    sign.position.set(p.x, h + 2.8, p.z + d / 2 + 0.2);
    scene.add(sign);
    return m;
  }

  // Mall Cahaya — big glass-fronted box.
  landmark(PLACES.mall, 34, 26, 16, 0xdde4ea, 'MALL CAHAYA', '#7a2e2e');
  // Bengkel Darma — low garage with an open bay.
  landmark(PLACES.garage, 26, 20, 8, 0x8a7a5a, 'BENGKEL DARMA', '#3a5a2e');
  box(10, 5, 1, 0x222222, PLACES.garage.x - 5, 2.5, PLACES.garage.z + 10.5);
  // Polsek Teluk — blue and white.
  landmark(PLACES.policeStation, 24, 20, 12, 0xdde8f2, 'POLSEK TELUK', '#1e4a8a');
  // RS Cahaya — white with a green cross on the roof.
  landmark(PLACES.hospital, 28, 22, 14, 0xf2f5f0, 'RS CAHAYA', '#2e7a4a');
  box(6, 1.5, 1.5, 0x2e9e5a, PLACES.hospital.x, 15.2, PLACES.hospital.z);
  box(1.5, 6, 1.5, 0x2e9e5a, PLACES.hospital.x, 15.2, PLACES.hospital.z);
  // Toko Besi — the gun shop.
  landmark(PLACES.gunshop, 18, 14, 7, 0x6a5a4a, 'TOKO BESI', '#4a2e2e');

  // Warung Mbak Sari — small stall with a striped awning (the safehouse).
  const warung = PLACES.warung;
  box(8, 4, 6, 0xe8dcc8, warung.x, 2, warung.z);
  addCollider(warung.x - 4, warung.x + 4, warung.z - 3, warung.z + 3);
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
  // A couple of food carts and tables outside.
  box(2.4, 1.4, 1.4, 0x9a6a3a, warung.x + 7, 0.7, warung.z + 2);
  box(2.4, 1.4, 1.4, 0x7a8a4a, warung.x - 7, 0.7, warung.z + 3);

  // Plaza Cahaya — fountain, benches and palms at the spawn.
  const plaza = PLACES.plaza;
  cylinder(7, 8, 1, 0x9aa0a8, plaza.x, 0.5, plaza.z, 20);
  addCollider(plaza.x - 8, plaza.x + 8, plaza.z - 8, plaza.z + 8); // the fountain is a roundabout
  const water = cylinder(6, 6, 0.4, 0x4aa8d8, plaza.x, 1.1, plaza.z, 20);
  animated.fountain = water;
  box(4, 1, 2, 0x8a7a5a, plaza.x + 12, 0.5, plaza.z - 8);
  box(4, 1, 2, 0x8a7a5a, plaza.x - 12, 0.5, plaza.z + 8);

  // Dermaga Teluk — wooden pier into the sea.
  const pier = PLACES.pier;
  box(10, 0.6, 40, 0x8a6a3a, pier.x, 0.4, pier.z + 12);
  for (let i = 0; i < 4; i += 1) {
    cylinder(0.5, 0.5, 3, 0x6a4a2a, pier.x - 4, 0.5, pier.z + 2 + i * 8);
    cylinder(0.5, 0.5, 3, 0x6a4a2a, pier.x + 4, 0.5, pier.z + 2 + i * 8);
  }
  // Two little boats bobbing by the pier.
  for (const bx of [-16, 14]) {
    const boat = box(4, 1.2, 10, 0xdde4ea, pier.x + bx, 0.6, pier.z + 18);
    boat.rotation.y = 0.2;
    animated.sea.push(boat);
  }

  // --- palms, lamps, traffic lights -----------------------------------------
  function palm(x, z) {
    const trunk = cylinder(0.35, 0.5, 7, 0x7a5a3a, x, 3.5, z, 8);
    trunk.rotation.z = range(rng, -0.08, 0.08);
    for (let i = 0; i < 6; i += 1) {
      const frond = new THREE.Mesh(
        new THREE.ConeGeometry(1.1, 4.5, 4),
        new THREE.MeshLambertMaterial({ color: 0x3a8a4a }),
      );
      const a = (i / 6) * Math.PI * 2;
      frond.position.set(x + Math.cos(a) * 1.6, 7.4, z + Math.sin(a) * 1.6);
      frond.rotation.z = Math.cos(a) * 1.1;
      frond.rotation.x = -Math.sin(a) * 1.1;
      frond.castShadow = true;
      scene.add(frond);
    }
    addCollider(x - 0.5, x + 0.5, z - 0.5, z + 0.5);
  }

  function lamp(x, z) {
    cylinder(0.12, 0.18, 6, 0x333333, x, 3, z, 6);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffd94d, emissiveIntensity: 0.7 }),
    );
    bulb.position.set(x, 6.2, z);
    scene.add(bulb);
    addCollider(x - 0.2, x + 0.2, z - 0.2, z + 0.2);
  }

  function trafficLight(x, z) {
    cylinder(0.15, 0.2, 5, 0x222222, x, 2.5, z, 6);
    const head = box(0.9, 2.2, 0.9, 0x111111, x, 5.6, z, { shadow: false });
    const red = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1 }),
    );
    red.position.set(x, 6.2, z + 0.5);
    scene.add(red);
    const green = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0x22cc44, emissive: 0x22cc44, emissiveIntensity: 0.2 }),
    );
    green.position.set(x, 5.2, z + 0.5);
    scene.add(green);
    animated.lights.push({ red, green, phase: rng() * 10 });
    addCollider(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
  }

  for (const c of ROAD_COORDS) {
    for (let d = -270; d <= 270; d += 60) {
      if (d === 270 && c > 200) continue; // keep the beach clear
      if (rng() < 0.55) palm(c + 9, d + 9);
      if (rng() < 0.4) lamp(c - 9, d - 9);
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
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 4.5),
      new THREE.MeshLambertMaterial({ map: signTexture(b.text, b.bg, '#ffe9a8') }),
    );
    board.position.set(b.x, 10.5, b.z);
    board.rotation.y = b.x < 0 ? Math.PI / 2 : -Math.PI / 2;
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
