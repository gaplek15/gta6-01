// TELUK CAHAYA — bootstrap, game state, the main loop, input actions
// (enter/exit car, punch, shoot, taxi, shops), busted/wasted, XP, saving
// and the deterministic self-test (?selftest=1).
import * as THREE from 'three';
import { GAME, ECONOMY, PLACES, TUNE, MISSIONS } from './config.js';
import { makeRng } from './random.js';
import { createSky } from './sky.js';
import { buildWorld } from './world.js';
import { driveCar } from './vehicles.js';
import { createPlayer, updatePlayer, updateCamera, tryPunch, tryShoot } from './player.js';
import { createTraffic, updateTraffic, updateTrafficLights } from './traffic.js';
import { createPolice, updatePolice } from './police.js';
import { createMissions, startMissions, updateMissions, beginMission } from './missions.js';
import { createActivities, updateActivities, startFare, interactPrompt, doInteract } from './activities.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { saveGame, loadGame } from './save.js';
import { stageShot } from './shots.js';

window.addEventListener('error', (e) => {
  const el = document.getElementById('errlog');
  if (el) el.textContent += `${e.message}\n`;
});

const params = new URLSearchParams(location.search);
const SEED = parseInt(params.get('seed') || String(GAME.seed), 10);
const SHOT = params.get('shot');
const SELFTEST = params.get('selftest') === '1';

function boot() {
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5dd);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2200);

  const game = {
    scene,
    camera,
    renderer,
    rng: makeRng(SEED),
    elapsed: 0,
    state: 'title', // title | play | pause | busted | wasted
    money: ECONOMY.startMoney,
    xp: 0,
    level: 1,
    ownsPistol: false,
    camYaw: 0.6,
    camPitch: 0.12,
    missionCar: null,
    missionsStarted: false,
  };
  game.sky = createSky(scene, game.rng);
  game.world = buildWorld(game);
  game.player = createPlayer(game);
  game.player.pos.set(0, 0, 60);
  game.traffic = createTraffic(game);
  game.police = createPolice(game);
  game.missions = createMissions(game);
  game.activities = createActivities(game);
  game.hud = createHud(game);
  game.audio = createAudio(game);
  game.input = createInput(game);

  game.addXp = (n) => {
    game.xp += n;
    const nl = 1 + Math.floor(game.xp / 400);
    if (nl > game.level) {
      game.level = nl;
      game.hud.toast(`Naik ke Level ${nl}!`);
      game.audio.missionComplete();
    }
  };
  game.saveGame = () => saveGame(game);
  game.loadSave = () => {
    const s = loadGame();
    if (!s) return false;
    game.money = s.money || 0;
    game.xp = s.xp || 0;
    game.level = s.level || 1;
    game.ownsPistol = !!s.ownsPistol;
    game.player.health = s.health || 100;
    if (s.x !== undefined) game.player.pos.set(s.x, 0, s.z || 0);
    return true;
  };

  game.startGame = () => {
    game.audio.ensure();
    game.audio.click();
    if (game.state === 'title') {
      if (!game.missionsStarted) {
        game.missionsStarted = true;
        startMissions(game);
      }
    }
    game.state = 'play';
    game.hud.hideScreens();
  };
  game.togglePause = () => {
    if (game.state === 'play') {
      game.state = 'pause';
      game.hud.showScreen('pause');
    } else if (game.state === 'pause') {
      game.state = 'play';
      game.hud.hideScreens();
    }
  };
  game.busted = () => {
    if (game.state !== 'play') return;
    game.state = 'busted';
    const fine = Math.min(game.money, ECONOMY.bustedFine);
    game.money -= fine;
    game.police.wanted = 0;
    game.police.decayTimer = TUNE.wantedDecaySeconds;
    for (const pc of game.police.cars) game.scene.remove(pc.car.group);
    for (const cop of game.police.cops) game.scene.remove(cop.group);
    game.police.cars = [];
    game.police.cops = [];
    game.audio.setSiren(false);
    document.getElementById('bustedtext').textContent = `Kamu ditangkap polisi. Denda $${fine}.`;
    game.hud.showScreen('busted');
    game.saveGame();
  };
  game.wasted = () => {
    if (game.state !== 'play') return;
    game.state = 'wasted';
    const loss = Math.min(game.money, ECONOMY.wastedLoss);
    game.money -= loss;
    game.police.wanted = 0;
    document.getElementById('wastedtext').textContent = `Kamu pingsan. Biaya klinik $${loss}.`;
    game.hud.showScreen('wasted');
    game.saveGame();
  };
  game.respawn = (place) => {
    const p = place || PLACES.policeStation;
    if (game.player.inCar) {
      game.player.inCar.speed = 0;
      game.player.inCar = null;
      game.player.group.visible = true;
    }
    game.player.pos.set(p.x, 0, p.z);
    game.player.health = 100;
    game.state = 'play';
    game.hud.hideScreens();
  };

  // --- Enter / exit car -----------------------------------------------------
  function nearestCar(maxD) {
    let best = null;
    let bestD = maxD;
    const consider = (car) => {
      const d = Math.hypot(car.pos.x - game.player.pos.x, car.pos.z - game.player.pos.z);
      if (d < bestD) { best = car; bestD = d; }
    };
    for (const t of game.traffic.cars) consider(t.car);
    for (const pc of game.police.cars) consider(pc.car);
    return best;
  }
  function enterCar(car) {
    const player = game.player;
    // Carjacking a moving traffic car: its driver flees, heat rises.
    for (const t of game.traffic.cars) {
      if (t.car === car && !t.parked) {
        t.parked = true;
        game.police.addWanted(1);
        game.hud.toast('Mobil dibajak! Polisi mengejarmu.');
      }
    }
    if (car === game.missionCar && game.missions.index === 1 && game.missions.phase === 'active') {
      // The mission itself adds the heat when the theft registers.
    } else if (car === game.missionCar) {
      game.police.addWanted(1);
    }
    player.inCar = car;
    car.isPlayer = true;
    player.group.visible = false;
    game.audio.ensure();
  }
  function exitCar() {
    const player = game.player;
    const car = player.inCar;
    if (!car) return;
    car.speed = 0;
    car.isPlayer = false;
    const side = 2.4;
    const sx = -Math.cos(car.heading) * side;
    const sz = Math.sin(car.heading) * side;
    player.pos.set(car.pos.x + sx, 0, car.pos.z + sz);
    player.inCar = null;
    player.group.visible = true;
    player.group.position.copy(player.pos);
  }

  // --- Input actions (wired from input.js) ----------------------------------
  game.onPressE = () => {
    game.audio.ensure();
    if (game.hud.dialogOpen) { game.hud.hideDialog(); return; }
    if (game.state !== 'play') return;
    if (game.player.inCar) { exitCar(); return; }
    if (doInteract(game)) return;
    const car = nearestCar(3.6);
    if (car) enterCar(car);
  };
  game.onPressF = () => {
    if (game.state === 'play') tryPunch(game);
  };
  game.onPressT = () => {
    if (game.state === 'play') startFare(game);
  };
  game.onPressEsc = () => {
    if (game.state === 'play' || game.state === 'pause') game.togglePause();
  };
  game.onPressEnter = () => {
    if (game.hud.dialogOpen) { game.hud.hideDialog(); return; }
    if (game.state === 'title') game.startGame();
    else if (game.state === 'busted') game.respawn(PLACES.policeStation);
    else if (game.state === 'wasted') game.respawn(PLACES.hospital);
  };

  // Buttons on the menu screens.
  document.getElementById('btn-start').addEventListener('click', () => game.startGame());
  document.getElementById('btn-resume').addEventListener('click', () => game.togglePause());
  document.getElementById('btn-busted').addEventListener('click', () => game.respawn(PLACES.policeStation));
  document.getElementById('btn-wasted').addEventListener('click', () => game.respawn(PLACES.hospital));
  const btnLoad = document.getElementById('btn-load');
  if (btnLoad) {
    btnLoad.style.display = loadGame() ? 'inline-block' : 'none';
    btnLoad.addEventListener('click', () => {
      const s = loadGame();
      if (s && game.loadSave()) {
        game.audio.ensure();
        game.missionsStarted = true;
        beginMission(game, Math.min(2, s.missionIndex || 0));
        game.state = 'play';
        game.hud.hideScreens();
        game.hud.toast('Save dimuat.');
      }
    });
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- Per-frame update ------------------------------------------------------
  function step(dt) {
    if (game.state !== 'play') return;
    game.elapsed += dt;
    const { dx, dy } = game.input.consumeMouse();
    game.camYaw -= dx * 0.0032;
    game.camPitch = Math.max(-0.15, Math.min(0.55, game.camPitch + dy * 0.0022));

    // Click: dismiss dialog, or shoot.
    if (game.input.consumeClick()) {
      if (game.hud.dialogOpen) game.hud.hideDialog();
      else tryShoot(game);
    }
    // Space doubles as jump on foot and handbrake in a car.
    const input = {
      forward: game.input.forward,
      back: game.input.back,
      left: game.input.left,
      right: game.input.right,
      handbrake: game.input.handbrake,
      jump: game.input.jump,
      run: game.input.run,
    };
    if (game.player.inCar) {
      driveCar(game, game.player.inCar, input, dt);
      game.audio.setEngine(Math.abs(game.player.inCar.speed) / 40);
    } else {
      updatePlayer(game, dt);
      game.audio.setEngine(0);
    }
    updateTraffic(game, dt);
    updateTrafficLights(game, dt);
    updatePolice(game, dt);
    updateMissions(game, dt);
    updateActivities(game, dt);
    game.sky.update(dt);
    game.audio.update(dt);

    // Context prompt (priority: mission steal > car > shop).
    let prompt = '';
    if (!game.hud.dialogOpen) {
      const ms = game.missions;
      if (ms.phase === 'active' && MISSIONS[ms.index] && MISSIONS[ms.index].id === 'mobil-pesanan') {
        const d = Math.hypot(game.missionCar.pos.x - game.player.pos.x, game.missionCar.pos.z - game.player.pos.z);
        if (d < 6 && !game.player.inCar) prompt = 'Tekan E untuk mencuri Komet Merah';
      }
      if (!prompt && !game.player.inCar) {
        const car = nearestCar(3.6);
        if (car) prompt = 'Tekan E untuk masuk mobil';
        else prompt = interactPrompt(game);
      }
      if (!prompt && game.player.inCar) prompt = 'E — keluar mobil • Spasi — rem tangan';
    }
    game.hud.setPrompt(prompt);

    // Slow health regen + autosave every ~20s of play.
    if (game.player.health < 100) game.player.health = Math.min(100, game.player.health + dt * 1.2);
    if (Math.floor(game.elapsed) % 20 === 0 && Math.floor(game.elapsed) !== Math.floor(game.elapsed - dt)) game.saveGame();
  }

  // --- Deterministic self-test (?selftest=1) ----------------------------------
  function runSelfTest() {
    const log = [];
    const err = () => document.getElementById('errlog').textContent;
    try {
      game.state = 'play';
      game.missionsStarted = true;
      startMissions(game);
      const dt = 1 / 60;
      // Walk forward.
      game.input.forward = true;
      for (let i = 0; i < 60; i += 1) step(dt);
      game.input.forward = false;
      const walkPos = `${game.player.pos.x.toFixed(1)},${game.player.pos.z.toFixed(1)}`;
      // Enter a parked car and drive.
      const parked = game.traffic.cars.find((t) => t.parked && t.car !== game.missionCar);
      game.player.pos.set(parked.car.pos.x + 2, 0, parked.car.pos.z);
      enterCar(parked.car);
      const inCar = game.player.inCar === parked.car;
      game.input.forward = true;
      for (let i = 0; i < 120; i += 1) step(dt);
      const carSpeed = parked.car.speed.toFixed(1);
      // Wanted + police chase (keep driving so the chase is exercised,
      // not the busted hold).
      game.police.addWanted(3);
      for (let i = 0; i < 120; i += 1) step(dt);
      game.input.forward = false;
      // Mission 1: teleport to the pier target.
      game.player.pos.set(20, 0, 230);
      if (game.player.inCar) { game.player.inCar.pos.set(20, 0, 230); }
      for (let i = 0; i < 5; i += 1) step(dt);
      const missionPhase = `${game.missions.index}:${game.missions.phase}`;
      // Coin pickup (on foot — coins are collected walking).
      exitCar();
      const coin = game.world.coins[0];
      game.player.pos.set(coin.x, 0, coin.z);
      for (let i = 0; i < 5; i += 1) step(dt);
      // Punch a pedestrian standing in front (+x side of the player).
      const ped = game.traffic.peds[0];
      ped.pos.set(game.player.pos.x + 1, 0, game.player.pos.z);
      ped.group.position.copy(ped.pos);
      game.player.heading = -Math.PI / 2; // face +x
      tryPunch(game);
      const pedHp = ped.health;
      log.push(`steps=600 player=(${walkPos}) traffic=${game.traffic.cars.length} peds=${game.traffic.peds.length} parked=${game.traffic.cars.filter((t) => t.parked).length}`);
      log.push(`inCar=${inCar} carSpeed=${carSpeed} stars=${game.police.wanted} policeCars=${game.police.cars.length} cops=${game.police.cops.length}`);
      log.push(`mission=${missionPhase} coins=${game.world.coins.filter((c) => c.taken).length} money=${game.money} health=${game.player.health} pedHp=${pedHp}`);
      const ok = err().trim() === '';
      const summary = `${ok ? 'SELFTEST OK' : 'SELFTEST FAIL'} | ${log.join(' | ')}${ok ? '' : ` | errors: ${err().trim().slice(0, 200)}`}`;
      document.getElementById('selftest').textContent = summary;
      document.title = summary;
    } catch (e) {
      const summary = `SELFTEST FAIL | exception: ${e.message}`;
      document.getElementById('selftest').textContent = summary;
      document.title = summary;
    }
  }

  // --- Start ------------------------------------------------------------------
  if (SHOT) {
    stageShot(game, SHOT);
    updateCamera(game, 10); // snap the camera to the staged frame
    game.state = 'play';
  } else if (SELFTEST) {
    game.state = 'play';
    runSelfTest();
  } else {
    game.hud.showScreen('title');
  }
  updateCamera(game, 10);

  const clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    step(dt);
    if (game.state === 'play' || game.state === 'pause' || game.state === 'title') {
      updateCamera(game, dt);
      game.hud.update();
    }
    renderer.render(scene, camera);
  }
  loop();
  return game;
}

boot();
