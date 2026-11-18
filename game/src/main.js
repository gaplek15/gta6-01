// Teluk Cahaya — boot, the one game loop, the camera, and every
// interaction (enter/exit cars, stealing, punching, shooting, missions).
// One job: tie the systems together into a playable game.
import * as THREE from 'three';
import { CITY, GAME_TITLE, MISSIONS, PLAYER, POLICE, STORY } from './config.js';
import { makeRng } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createWorld, PLACES } from './world.js';
import { createPlayer, walkPlayer, damagePlayer, healPlayer } from './player.js';
import { createVehicle, driveVehicle, randomCarColor } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createActivities } from './activities.js';
import { createHud } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { stageShot, scriptedInput } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;
const selftest = params.get('selftest') === '1';

// Error log: window.onerror writes here so a headless run can prove the
// game boots without errors (read it with --dump-dom).
const errlog = document.getElementById('errlog');
window.addEventListener('error', (e) => {
  if (errlog) errlog.textContent += `${e.message} @ ${e.filename}:${e.lineno}\n`;
});

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec4ea); // fallback if the sky dome fails
scene.fog = new THREE.Fog(0xe8d3ae, 150, 620); // warm haze at the horizon

// The sky, all procedural: a gradient dome (deep blue overhead, warm gold
// at the horizon), a glowing sun disc, and soft drifting clouds — no
// external files, so it looks the same offline.
const sunDir = new THREE.Vector3(0.72, 0.42, 0.38).normalize();
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  uniforms: {
    topColor: { value: new THREE.Color(0x3f7fd0) },
    midColor: { value: new THREE.Color(0x8ec4ea) },
    horizonColor: { value: new THREE.Color(0xffd9a6) },
    sunColor: { value: new THREE.Color(0xfff0c0) },
    sunDir: { value: sunDir },
  },
  vertexShader: `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_Position.z = gl_Position.w;
    }`,
  fragmentShader: `
    varying vec3 vDir;
    uniform vec3 topColor, midColor, horizonColor, sunColor;
    uniform vec3 sunDir;
    void main() {
      float h = clamp(vDir.y, -0.1, 1.0);
      vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.22, h));
      col = mix(col, topColor, smoothstep(0.18, 0.65, h));
      float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
      col += sunColor * (pow(s, 600.0) * 1.2 + pow(s, 24.0) * 0.35 + pow(s, 6.0) * 0.12);
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(950, 32, 16), skyMat);
sky.renderOrder = -1;
sky.frustumCulled = false;
scene.add(sky);

// Soft clouds: canvas-drawn puffs on sprites, drifting slowly.
function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  const puffs = [[70, 80, 55], [130, 65, 65], [190, 85, 50], [110, 90, 45], [160, 95, 40]];
  for (const [x, y, r] of puffs) {
    const grad = g.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const clouds = [];
{
  const cloudTex = makeCloudTexture();
  const cloudRng = makeRng(CITY.seed + 41);
  for (let i = 0; i < 9; i += 1) {
    const mat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
    const spr = new THREE.Sprite(mat);
    spr.position.set(-600 + cloudRng() * 1200, 140 + cloudRng() * 80, -600 + cloudRng() * 1200);
    spr.scale.set(140 + cloudRng() * 120, 45 + cloudRng() * 25, 1);
    scene.add(spr);
    clouds.push(spr);
  }
}

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

// Golden-hour sun: warm, low, long shadows.
const sun = new THREE.DirectionalLight(0xffd9a0, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -70;
sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70;
sun.shadow.camera.bottom = -70;
sun.shadow.camera.far = 400;
scene.add(sun);
scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 1.15);
scene.add(hemi);
// A little ambient lift so shadowed streets never read as a black void.
const ambient = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambient);

// Build the game object: every system, one handle.
const rng = makeRng(CITY.seed);
const world = createWorld(scene, rng);
const input = createInput(canvas);
const audio = createAudio();
const hud = createHud();
const player = createPlayer(scene, PLACES.plaza.x, PLACES.plaza.z + 14);
const traffic = createTraffic(scene, world, makeRng(CITY.seed + 7));
const police = createPolice(scene, world, makeRng(CITY.seed + 13));
const missions = createMissions(scene, world, makeRng(CITY.seed + 21));
const activities = createActivities(scene, world, makeRng(CITY.seed + 29));

const game = {
  scene,
  camera: { yaw: Math.PI, pitch: 0.3, dist: 10, target: new THREE.Vector3(PLACES.plaza.x, 1.5, PLACES.plaza.z) },
  world,
  player,
  traffic,
  police,
  missions,
  activities,
  hud,
  audio,
  input,
  time: 0,
  state: 'title',
  playTime: 0,
  _m3heat: false,
  _dragTime: 0,
  _shotTimer: 0,
};

function save() {
  saveGame(game);
}
game.saveGame = save;

// --- entering and leaving cars ----------------------------------------------
function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  const all = [...traffic.cars, ...police.state.cars];
  for (const v of all) {
    const d = Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z);
    if (d < bestD) { bestD = d; best = v; }
  }
  // Parked cars the missions or the city left around.
  for (const v of game.parked || []) {
    const d = Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

function witnessNearby(radiusPed, radiusPolice) {
  let seen = false;
  for (const p of traffic.peds) {
    if (p.dead) continue;
    if (Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z) < radiusPed) { seen = true; break; }
  }
  if (!seen) {
    for (const v of police.state.cars) {
      if (Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z) < radiusPolice) { seen = true; break; }
    }
  }
  return seen;
}

function enterCar(car) {
  if (car.kind === 'traffic') {
    // Hijack: the driver bails and the witnesses call it in.
    traffic.removeCar(car);
    traffic.scarePeds(car.pos, 20);
    if (witnessNearby(25, 60)) {
      police.addHeat(25);
      hud.toast('Pencurian mobil terlihat! Wanted naik.');
    }
  } else if (car.kind === 'police') {
    if (witnessNearby(25, 60)) police.addHeat(25);
    hud.toast('Kamu membajak mobil polisi!');
  } else if (car.kind === 'parked') {
    const i = (game.parked || []).indexOf(car);
    if (i >= 0) game.parked.splice(i, 1);
    if (witnessNearby(20, 50)) {
      police.addHeat(25);
      hud.toast('Pencurian mobil terlihat! Wanted naik.');
    }
  }
  player.inCar = car;
  car.kind = 'player';
  player.mesh.visible = false;
  game.camera.dist = 10.5;
  audio.play('click');
}

function exitCar() {
  const car = player.inCar;
  if (!car) return;
  const side = car.heading + Math.PI / 2;
  player.pos.set(car.pos.x + Math.sin(side) * 2.4, 0, car.pos.z + Math.cos(side) * 2.4);
  world.resolveCircle(player.pos, 0.6);
  player.inCar = null;
  car.kind = 'parked';
  car.speed = 0;
  game.parked = game.parked || [];
  game.parked.push(car);
  player.mesh.visible = true;
  game.camera.dist = 7.5;
  audio.play('click');
}

game.enterCar = enterCar;
game.exitCar = exitCar;

// Parked cars scattered around the city for the player to take.
function spawnParkedCars() {
  game.parked = game.parked || [];
  const spots = [
    { x: 44, z: 30, type: 'sedan' },
    { x: -16, z: 90, type: 'van' },
    { x: 150, z: 44, type: 'scooter' },
    { x: -44, z: -150, type: 'sedan' },
    { x: 90, z: 210, type: 'sedan' },
    { x: -150, z: 30, type: 'taxi' },
  ];
  for (const s of spots) {
    const car = createVehicle(scene, s.type, s.type === 'taxi' ? 0xffd94d : randomCarColor(rng), s.x, s.z, Math.PI / 2);
    car.kind = 'parked';
    game.parked.push(car);
  }
}

// --- combat -------------------------------------------------------------------
function punch() {
  if (player.punchCooldown > 0 || player.inCar) return;
  player.punchCooldown = 0.45;
  player.punchTimer = 0.25;
  audio.play('punch');
  const range = 2.4;
  const fx = Math.sin(player.yaw);
  const fz = Math.cos(player.yaw);
  const targets = [];
  for (const p of traffic.peds) if (!p.dead) targets.push({ kind: 'ped', obj: p, pos: p.pos });
  for (const c of police.state.cops) if (!c.dead) targets.push({ kind: 'cop', obj: c, pos: c.pos });
  for (const t of targets) {
    const dx = t.pos.x - player.pos.x;
    const dz = t.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > range) continue;
    if ((dx * fx + dz * fz) / d < 0.3) continue; // must be roughly in front
    t.obj.health -= 12;
    traffic.scarePeds(player.pos, 15);
    if (t.kind === 'ped') {
      if (t.obj.health <= 0) {
        t.obj.dead = true;
        t.obj.mesh.rotation.x = -Math.PI / 2;
        t.obj.mesh.position.y = 0.3;
        police.addHeat(40);
        hud.toast('Kamu membunuh pejalan kaki! Wanted naik.');
      } else {
        police.addHeat(15);
        t.obj.flee = 3;
        t.obj.fleeFrom.copy(player.pos);
      }
    } else {
      if (t.obj.health <= 0) {
        t.obj.dead = true;
        t.obj.mesh.rotation.x = -Math.PI / 2;
        t.obj.mesh.position.y = 0.3;
        police.addHeat(40);
        hud.toast('Polisi tumbang! Wanted naik.');
      } else {
        police.addHeat(10);
      }
    }
    break; // one target per punch
  }
}

function shoot() {
  if (!player.pistol || player.ammo <= 0 || player.inCar) return;
  player.ammo -= 1;
  audio.play('shot');
  traffic.scarePeds(player.pos, 30);
  police.addHeat(30);
  // Ray from the camera through the centre of the screen.
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = camera.position.clone();
  let best = null;
  let bestD = 70;
  const targets = [];
  for (const p of traffic.peds) if (!p.dead) targets.push({ kind: 'ped', obj: p, pos: p.pos, r: 1 });
  for (const c of police.state.cops) if (!c.dead) targets.push({ kind: 'cop', obj: c, pos: c.pos, r: 1 });
  for (const v of traffic.cars) targets.push({ kind: 'car', obj: v, pos: v.pos, r: 2.2 });
  for (const t of targets) {
    const to = new THREE.Vector3(t.pos.x - origin.x, 1.2 - origin.y, t.pos.z - origin.z);
    const d = to.length();
    if (d > bestD) continue;
    const dot = to.normalize().dot(dir);
    if (dot < 0.985) continue; // within a narrow cone
    best = t;
    bestD = d;
  }
  if (!best) return;
  if (best.kind === 'car') {
    best.obj.health -= 25;
    if (best.obj.health <= 0) {
      best.obj.speed = 0;
      hud.toast('Mobil itu rusak total.');
    }
  } else {
    best.obj.health -= 34;
    if (best.obj.health <= 0) {
      best.obj.dead = true;
      best.obj.mesh.rotation.x = -Math.PI / 2;
      best.obj.mesh.position.y = 0.3;
      police.addHeat(40);
      hud.toast(best.kind === 'cop' ? 'Polisi tumbang!' : 'Pejalan kaki tumbang!');
    }
  }
}

// --- per-frame update ---------------------------------------------------------
function buildInput() {
  const i = input;
  const camYaw = game.camera.yaw;
  const fwd = { x: -Math.sin(camYaw), z: -Math.cos(camYaw) };
  const right = { x: Math.cos(camYaw), z: -Math.sin(camYaw) };
  let mx = 0;
  let mz = 0;
  if (i.isDown('KeyW')) { mx += fwd.x; mz += fwd.z; }
  if (i.isDown('KeyS')) { mx -= fwd.x; mz -= fwd.z; }
  if (i.isDown('KeyD')) { mx += right.x; mz += right.z; }
  if (i.isDown('KeyA')) { mx -= right.x; mz -= right.z; }
  return {
    moveX: mx, moveZ: mz,
    forward: i.isDown('KeyW'),
    back: i.isDown('KeyS'),
    left: i.isDown('KeyA'),
    right: i.isDown('KeyD'),
    run: i.isDown('ShiftLeft') || i.isDown('ShiftRight'),
    jump: i.wasPressed('Space'),
    interact: i.wasPressed('KeyE'),
    punch: i.wasPressed('KeyF'),
    shoot: false,
    cameraDX: i.cameraDX(),
    cameraDY: i.cameraDY(),
  };
}

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0 && game.state === 'playing') {
    if (missions.state.phase === 'briefing') missions.advanceDialogue();
    else shoot();
  }
});

function update(dt, inp) {
  game.time += dt;
  if (game.state === 'playing') game.playTime += dt;

  // Camera orbit (mouse drag or arrow keys).
  if (inp.cameraDX !== 0 || inp.cameraDY !== 0) {
    game.camera.yaw -= inp.cameraDX * 0.005;
    game.camera.pitch = Math.max(0.08, Math.min(1.1, game.camera.pitch + inp.cameraDY * 0.003));
    game._dragTime = 0;
  } else {
    game._dragTime += dt;
  }
  // While driving, the camera settles behind the car unless just dragged
  // (not in screenshot mode, where the shot sets the angle).
  if (player.inCar && game._dragTime > 1.5 && !game.cameraSnap) {
    let want = player.inCar.heading + Math.PI;
    let dh = want - game.camera.yaw;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    game.camera.yaw += dh * Math.min(1, dt * 1.8);
    game.camera.pitch += (0.32 - game.camera.pitch) * Math.min(1, dt * 2);
  }

  world.update(dt, game.time);

  // Dialogue advance.
  if (missions.state.phase === 'briefing') {
    const line = missions.currentLine();
    if (line) hud.showDialogue(line[0], line[1]);
    if (inp.interact) missions.advanceDialogue();
  } else {
    hud.hideDialogue();
  }

  if (player.inCar) {
    const car = player.inCar;
    const throttle = inp.forward ? 1 : inp.back ? -1 : 0;
    // D turns right: heading decreases, so steer is negative for D.
    const steer = inp.left ? 1 : inp.right ? -1 : 0;
    driveVehicle(car, dt, throttle, steer, input.isDown('Space'), world);
    if (car.health <= 0) {
      hud.toast('Mobilmu rusak! Keluar!');
      exitCar();
    }
    // Running over pedestrians.
    for (const p of traffic.peds) {
      if (p.dead) continue;
      const d = Math.hypot(p.pos.x - car.pos.x, p.pos.z - car.pos.z);
      if (d < 2 && Math.abs(car.speed) > 5) {
        p.dead = true;
        p.mesh.rotation.x = -Math.PI / 2;
        p.mesh.position.y = 0.3;
        police.addHeat(20);
        audio.play('crash');
        hud.toast('Kamu menabrak pejalan kaki! Wanted naik.');
      }
    }
    // Bumping traffic cars.
    for (const v of traffic.cars) {
      const d = Math.hypot(v.pos.x - car.pos.x, v.pos.z - car.pos.z);
      if (d > 0.01 && d < 3.4) {
        const push = (3.4 - d) / 2;
        const nx = (v.pos.x - car.pos.x) / d;
        const nz = (v.pos.z - car.pos.z) / d;
        v.pos.x += nx * push;
        v.pos.z += nz * push;
        car.pos.x -= nx * push * 0.5;
        car.pos.z -= nz * push * 0.5;
        if (Math.abs(car.speed) > 8) {
          v.health -= 10;
          audio.play('crash');
          if (v.health <= 0) {
            traffic.removeCar(v);
            hud.toast('Mobil lalu lintas rusak.');
          }
        }
      }
    }
    // Taxi pickup happens from the car: E picks up the passenger, else E exits.
    const tp = traffic.nearestPed(car.pos, 5, (p) => p.taxi && !activities.state.taxi);
    if (tp) {
      hud.setPrompt('[E] Jemput penumpang taksi');
      if (inp.interact) activities.startTaxi(game, tp);
    } else if (inp.interact) {
      exitCar();
    }
  } else {
    // Walk vector: from the camera-relative keys when moveX/moveZ are not
    // given (scripted input, e.g. the screenshot autopilot and self-test).
    let mx = inp.moveX;
    let mz = inp.moveZ;
    if (mx === undefined || mz === undefined) {
      const cy = game.camera.yaw;
      const fwd = { x: -Math.sin(cy), z: -Math.cos(cy) };
      const rgt = { x: Math.cos(cy), z: -Math.sin(cy) };
      mx = 0;
      mz = 0;
      if (inp.forward) { mx += fwd.x; mz += fwd.z; }
      if (inp.back) { mx -= fwd.x; mz -= fwd.z; }
      if (inp.right) { mx += rgt.x; mz += rgt.z; }
      if (inp.left) { mx -= rgt.x; mz -= rgt.z; }
    }
    walkPlayer(player, dt, { x: mx, z: mz }, inp.run, inp.jump, world);
    if (inp.punch) punch();
    // Interaction prompts and actions.
    const car = nearestCar(3.5);
    const taxiPed = traffic.nearestPed(player.pos, 3.5, (p) => p.taxi && !activities.state.taxi);
    if (car) {
      const name = car.def.name;
      hud.setPrompt(`[E] Masuk ${name}${car.missionCar ? ' — Komet Merah!' : ''}`);
      if (inp.interact) enterCar(car);
    } else if (taxiPed) {
      hud.setPrompt('[E] Butuh mobil untuk antar penumpang');
    } else if (activities.nearShop(game)) {
      hud.setPrompt(`[E] Toko Besi — ${player.pistol ? `peluru $${100}` : `pistol $${800}`}`);
      if (inp.interact) activities.buyPistol(game);
    } else if (activities.nearWarung(game)) {
      hud.setPrompt('[E] Makan di Warung Mbak Sari ($20, +darah)');
      if (inp.interact) activities.eatAtWarung(game);
    } else if (missions.state.phase === 'briefing') {
      hud.setPrompt('[E] Lanjut');
    } else {
      hud.setPrompt('');
    }
  }

  // Danger that makes pedestrians flee: gunfire, punching, fast driving.
  const danger = { pos: player.inCar ? player.inCar.pos : player.pos, radius: 0 };
  if (player.punchTimer > 0) danger.radius = 15;
  if (player.inCar && Math.abs(player.inCar.speed) > 14) danger.radius = 12;
  traffic.update(dt, player.inCar, player.pos, danger);
  police.update(dt, player, player.inCar);
  missions.update(dt, game);
  activities.update(dt, game);

  // Mission 3 starts hot: the police are already on Raka.
  if (missions.state.active && missions.state.active.id === 'kabur-dari-razia'
    && missions.state.phase === 'active' && !game._m3heat) {
    game._m3heat = true;
    police.addHeat(60);
    hud.toast('Razia! Polisi mengejarmu — kabur ke Warung Mbak Sari!');
  }

  // Health regen out of trouble; busted / wasted.
  if (police.state.stars === 0 && player.health < PLAYER.maxHealth) {
    healPlayer(player, 2 * dt);
  }
  if (player.health <= 0) {
    wastePlayer();
  } else if (police.state.busted) {
    bustPlayer();
  }

  // Sounds.
  const speed01 = player.inCar ? Math.abs(player.inCar.speed) / player.inCar.def.maxSpeed : 0;
  audio.setEngine(speed01, !!player.inCar);
  const nearPolice = police.state.stars > 0 && police.nearestPoliceDistance(player.inCar ? player.inCar.pos : player.pos) < 70;
  audio.setSiren(nearPolice, Math.floor(game.time * 1.4) % 2 === 0);

  // HUD: objective + speed.
  const obj = missions.objectiveText();
  const objPos = missions.objectivePos();
  const taxiObj = activities.taxiObjective();
  const playerPos = player.inCar ? player.inCar.pos : player.pos;
  if (taxiObj && !objPos) {
    hud.setObjective(taxiObj.text, Math.hypot(playerPos.x - taxiObj.pos.x, playerPos.z - taxiObj.pos.z));
  } else if (objPos) {
    hud.setObjective(obj, Math.hypot(playerPos.x - objPos.x, playerPos.z - objPos.z));
  } else {
    hud.setObjective(obj);
  }
  if (player.inCar) {
    hud.setSpeed(Math.abs(player.inCar.speed) * 3.6, player.inCar.def.name);
    hud.setCrosshair(false);
  } else {
    hud.setSpeed(null);
    hud.setCrosshair(player.pistol);
  }
  hud.update(game, dt);
}

function wastePlayer() {
  const fine = Math.min(200, Math.floor(player.money * 0.2));
  player.money -= fine;
  player.health = PLAYER.maxHealth;
  police.clearWanted();
  if (player.inCar) exitCar();
  player.pos.set(PLACES.hospital.x, 0, PLACES.hospital.z + 16);
  player.mesh.position.copy(player.pos);
  game.state = 'wasted';
  audio.play('busted');
  hud.showScreen('wasted', { fine }, { resume: () => { hud.hideScreen(); game.state = 'playing'; } });
}

function bustPlayer() {
  const fine = Math.min(POLICE.bustFine, Math.floor(player.money * 0.2));
  player.money -= fine;
  player.health = PLAYER.maxHealth;
  police.clearWanted();
  if (player.inCar) exitCar();
  player.pos.set(PLACES.policeStation.x, 0, PLACES.policeStation.z + 16);
  player.mesh.position.copy(player.pos);
  game.state = 'busted';
  audio.play('busted');
  hud.showScreen('busted', { fine }, { resume: () => { hud.hideScreen(); game.state = 'playing'; } });
}

// --- camera and render --------------------------------------------------------
function updateCamera(dt) {
  const target = player.inCar ? player.inCar.pos : player.pos;
  const t = game.camera.target;
  if (game.cameraSnap) {
    // Screenshot mode: hold the camera exactly on the focus, no lerp lag.
    t.set(target.x, target.y + 1.5, target.z);
  } else {
    t.x += (target.x - t.x) * Math.min(1, dt * 6);
    t.y += ((target.y + 1.5) - t.y) * Math.min(1, dt * 6);
    t.z += (target.z - t.z) * Math.min(1, dt * 6);
  }
  const cp = game.camera.pitch;
  const cd = game.camera.dist;
  const cy = game.camera.yaw;
  camera.position.set(
    t.x + Math.sin(cy) * Math.cos(cp) * cd,
    t.y + Math.sin(cp) * cd,
    t.z + Math.cos(cy) * Math.cos(cp) * cd,
  );
  camera.lookAt(t);
  const targetFov = player.inCar ? 62 + Math.abs(player.inCar.speed) * 0.35 : 62;
  if (Math.abs(camera.fov - targetFov) > 0.1) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }
  // The sun follows the player so shadows stay crisp; low and warm for
  // long golden-hour shadows. Clouds drift with the wind.
  sun.position.set(target.x + 130, 95, target.z + 55);
  sun.target.position.set(target.x, 0, target.z);
  sun.target.updateMatrixWorld();
  for (const c of clouds) {
    c.position.x += 0.025;
    if (c.position.x > 650) c.position.x = -650;
  }
}

function render() {
  updateCamera(1 / 60);
  renderer.render(scene, camera);
}

game.render = render;
game.update = update;

// --- reset / start / save -------------------------------------------------------
function reset(seedValue) {
  const r = makeRng(seedValue);
  player.pos.set(PLACES.plaza.x, 0, PLACES.plaza.z + 14);
  player.yaw = 0;
  player.health = PLAYER.maxHealth;
  player.money = 0;
  player.xp = 0;
  player.pistol = false;
  player.ammo = 0;
  player.inCar = null;
  player.mesh.visible = true;
  player.mesh.position.copy(player.pos);
  traffic.reset(r);
  police.reset();
  missions.state.index = 0;
  missions.state.active = null;
  missions.state.phase = 'none';
  missions.state.completed = [];
  missions.state.allDone = false;
  missions.state.nextTimer = undefined;
  missions.state.stolen = false;
  if (missions.state.targetCar) {
    missions.state.targetCar.remove();
    missions.state.targetCar = null;
  }
  game._m3heat = false;
  game.time = 0;
  game.playTime = 0;
  game.cameraSnap = false;
  hud.pinDialogue(false);
  game.parked = game.parked || [];
  // Parked cars are rebuilt once; reset keeps them.
  hud.setObjective('');
}

game.reset = reset;

function startGame(fromSave) {
  audio.unlock();
  reset(CITY.seed);
  if (fromSave) {
    const data = loadGame();
    if (data) {
      player.money = data.money;
      player.health = data.health;
      player.xp = data.xp;
      player.pistol = data.pistol;
      player.ammo = data.ammo;
      player.pos.set(data.playerPos.x, 0, data.playerPos.z);
      player.mesh.position.copy(player.pos);
      missions.state.index = Math.min(data.missionIndex, MISSIONS.length - 1);
      missions.state.completed = data.missionsDone || [];
      for (let i = 0; i < data.coinsGot; i += 1) {
        const c = activities.coins[i];
        if (c) { c.got = true; c.mesh.visible = false; }
      }
      activities.state.coinsGot = data.coinsGot;
      game.time = data.time || 0;
      hud.toast('Save dimuat. Selamat datang kembali di Teluk Cahaya.');
    }
  }
  hud.hideScreen();
  game.state = 'playing';
  missions.startMission(missions.state.index);
}

function pauseGame() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  hud.showScreen('pause', null, {
    resume: () => { hud.hideScreen(); game.state = 'playing'; },
    save: () => { save(); hud.toast('Game disimpan.'); },
    quit: () => { hud.hideScreen(); game.state = 'title'; showTitle(); },
  });
}

function showTitle() {
  game.state = 'title';
  hud.showScreen('title', { hasSave: hasSave() }, { start: (fromSave) => startGame(fromSave) });
}

// --- the loop -------------------------------------------------------------------
let last = performance.now();
let accumulator = 0;

function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
    if (game.state === 'playing') pauseGame();
    else if (game.state === 'paused') { hud.hideScreen(); game.state = 'playing'; }
  }
  if (input.wasPressed('KeyM')) audio.setMuted(!audio.isMuted());
  if (game.state === 'playing') {
    while (accumulator >= STEP) {
      update(STEP, buildInput());
      accumulator -= STEP;
    }
  } else if (game.state === 'title') {
    // A living backdrop behind the title: traffic rolls on.
    while (accumulator >= STEP) {
      game.time += STEP;
      world.update(STEP, game.time);
      traffic.update(STEP, null, player.pos, null);
      game.camera.yaw += STEP * 0.05;
      accumulator -= STEP;
    }
  } else {
    accumulator = 0;
  }
  updateCamera(1 / 60);
  renderer.render(scene, camera);
  input.endFrame();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') pauseGame();
});

// --- boot -----------------------------------------------------------------------
spawnParkedCars();
showTitle();

if (shotName) {
  // Screenshot mode: stage the scene, render it, and stop on the title.
  game.state = 'playing';
  hud.hideScreen();
  stageShot(shotName, game, seed);
  // Keep rendering so the canvas stays live for the screenshot.
  requestAnimationFrame(frame);
} else if (selftest) {
  runSelfTest();
} else {
  requestAnimationFrame(frame);
}

// --- self-test (?selftest=1): drive the sim headlessly and report -----------
function runSelfTest() {
  const results = [];
  try {
    reset(CITY.seed);
    game.state = 'playing';
    const inp = scriptedInput({ forward: true });
    for (let i = 0; i < 600; i += 1) update(STEP, inp);
    results.push(`steps=600 player=(${player.pos.x.toFixed(1)},${player.pos.z.toFixed(1)})`);
    results.push(`traffic=${traffic.cars.length} peds=${traffic.peds.length} parked=${(game.parked || []).length}`);
    // Enter a parked car and drive it.
    const car = game.parked[0];
    player.pos.set(car.pos.x + 2, 0, car.pos.z);
    enterCar(car);
    results.push(`inCar=${player.inCar ? player.inCar.def.name : 'NONE'}`);
    for (let i = 0; i < 300; i += 1) update(STEP, scriptedInput({ forward: true }));
    results.push(`carSpeed=${player.inCar.speed.toFixed(1)} carPos=(${player.inCar.pos.x.toFixed(1)},${player.inCar.pos.z.toFixed(1)})`);
    exitCar();
    results.push(`exited inCar=${player.inCar === null}`);
    // Punch, wanted, police.
    police.addHeat(45);
    police.update(0.1, player, null);
    results.push(`stars=${police.state.stars} policeCars=${police.state.cars.length} cops=${police.state.cops.length}`);
    // Missions.
    missions.startMission(0);
    for (let i = 0; i < 400; i += 1) update(STEP, scriptedInput({}));
    results.push(`mission=${missions.state.active ? missions.state.active.id : 'none'} phase=${missions.state.phase}`);
    // Coins and taxi state.
    results.push(`coins=${activities.coins.length} money=${player.money} health=${player.health}`);
    render();
    document.title = `SELFTEST OK | ${results.join(' | ')}`;
    const el = document.getElementById('selftest');
    if (el) el.textContent = document.title;
  } catch (err) {
    document.title = `SELFTEST FAIL: ${err.message}`;
    const el = document.getElementById('selftest');
    if (el) el.textContent = document.title;
    if (errlog) errlog.textContent += `SELFTEST: ${err.stack || err.message}\n`;
  }
}

export { game, GAME_TITLE, STORY };
