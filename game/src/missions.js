// Missions: three jobs from Darma, in order, with briefing dialogue,
// objective markers, timers and rewards — plus the story-complete state.
// One job: give the player a reason to drive across Teluk Cahaya.
import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { createVehicle } from './vehicles.js';
import { PLACES } from './world.js';

function makeMarker(scene) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  g.add(beam);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshLambertMaterial({ color: 0xffd94d, emissive: 0xffd94d, emissiveIntensity: 0.9 }),
  );
  diamond.position.y = 6;
  g.add(diamond);
  g.userData.diamond = diamond;
  g.visible = false;
  scene.add(g);
  return g;
}

export function createMissions(scene, world, rng) {
  const marker = makeMarker(scene);
  const state = {
    index: 0, // 0..2 active, 3 = story complete
    active: null,
    phase: 'none', // none | briefing | active | done
    lineIndex: 0,
    lineTimer: 0,
    timer: 0,
    targetCar: null, // the red Komet Merah in mission 2
    completed: [],
    allDone: false,
  };

  function currentDef() {
    return MISSIONS[state.index] || null;
  }

  function setMarker(x, z) {
    marker.position.set(x, 0, z);
    marker.visible = true;
  }

  function hideMarker() {
    marker.visible = false;
  }

  function startBriefing() {
    const def = currentDef();
    if (!def) return;
    state.active = def;
    state.phase = 'briefing';
    state.lineIndex = 0;
    state.lineTimer = 0;
    state.timer = def.timer || 0;
    // Mission 2 needs the red sports car parked by the mall.
    if (def.id === 'mobil-pesanan') {
      const car = createVehicle(scene, 'sports', 0xd91e1e, 165, -140, Math.PI / 2);
      car.kind = 'parked';
      car.missionCar = true;
      state.targetCar = car;
    }
    // Mission 3 starts with the police already on the player (main.js
    // adds the heat when the mission goes active).
  }

  function startMission(index) {
    state.index = index;
    startBriefing();
  }

  function advanceDialogue() {
    const def = state.active;
    if (!def) return;
    state.lineIndex += 1;
    state.lineTimer = 0;
    if (state.lineIndex >= def.briefing.length) {
      state.phase = 'active';
      setMarker(def.marker.x, def.marker.z);
      if (def.id === 'mobil-pesanan') setMarker(165, -140);
    }
  }

  function currentLine() {
    const def = state.active;
    if (!def || state.phase !== 'briefing') return null;
    return def.briefing[state.lineIndex] || null;
  }

  function objectiveText() {
    if (state.allDone) return 'Kota ini milikmu — jelajahi Teluk Cahaya sesukamu';
    if (!state.active) return 'Temui Darma untuk pekerjaan pertama';
    if (state.phase === 'briefing') return 'Dengarkan Darma...';
    if (state.active.id === 'mobil-pesanan' && !state.stolen) {
      return 'Curi Komet Merah di Mall Cahaya';
    }
    if (state.active.id === 'mobil-pesanan' && state.stolen) {
      return 'Antar Komet Merah ke Bengkel Darma';
    }
    return state.active.objective;
  }

  function objectivePos() {
    if (state.allDone || !state.active || state.phase !== 'active') return null;
    if (state.active.id === 'mobil-pesanan') {
      return state.stolen ? { x: -180, z: 195 } : { x: 165, z: -140 };
    }
    return { x: state.active.marker.x, z: state.active.marker.z };
  }

  function complete(game) {
    const def = state.active;
    state.completed.push(def.id);
    state.phase = 'done';
    hideMarker();
    game.player.money += def.reward;
    game.player.xp += 100;
    game.hud.toast(`Misi selesai: ${def.title}  +$${def.reward}`);
    game.audio.play('mission');
    if (state.targetCar) {
      state.targetCar.missionCar = false;
      state.targetCar = null;
    }
    state.index += 1;
    state.active = null;
    state.stolen = false;
    if (state.index >= MISSIONS.length) {
      state.allDone = true;
      game.hud.toast('CERITA SELESAI — Teluk Cahaya milikmu sekarang!');
    } else {
      // The next job starts after a short breather.
      state.nextTimer = 4;
    }
    game.saveGame();
  }

  function fail(game, reason) {
    game.hud.toast(reason);
    game.audio.play('fail');
    state.phase = 'briefing';
    state.lineIndex = 0;
    state.lineTimer = 0;
    state.timer = state.active ? state.active.timer || 0 : 0;
    if (state.targetCar) {
      state.targetCar.remove();
      state.targetCar = null;
    }
    hideMarker();
    if (state.active && state.active.id === 'mobil-pesanan') {
      const car = createVehicle(scene, 'sports', 0xd91e1e, 165, -140, Math.PI / 2);
      car.kind = 'parked';
      car.missionCar = true;
      state.targetCar = car;
    }
    state.stolen = false;
  }

  function update(dt, game) {
    // Rotate the marker diamond so it catches the eye.
    if (marker.visible) {
      marker.userData.diamond.rotation.y += dt * 2;
      marker.userData.diamond.position.y = 6 + Math.sin(performance.now() / 300) * 0.5;
    }
    if (state.nextTimer !== undefined && state.nextTimer > 0) {
      state.nextTimer -= dt;
      if (state.nextTimer <= 0) {
        state.nextTimer = undefined;
        startBriefing();
      }
      return;
    }
    const def = state.active;
    if (!def) return;
    if (state.phase === 'briefing') {
      state.lineTimer += dt;
      if (state.lineTimer > 4.5) advanceDialogue();
      return;
    }
    if (state.phase !== 'active') return;
    if (state.timer > 0) {
      state.timer -= dt;
      if (state.timer <= 0) {
        fail(game, 'Waktu habis! Misi diulang.');
        return;
      }
    }
    const playerPos = game.player.inCar ? game.player.inCar.pos : game.player.pos;
    const target = objectivePos();
    if (!target) return;
    const dist = Math.hypot(playerPos.x - target.x, playerPos.z - target.z);
    if (def.id === 'mobil-pesanan' && !state.stolen) {
      // Step one: get into the red car.
      if (game.player.inCar === state.targetCar) {
        state.stolen = true;
        setMarker(-180, 195);
        game.hud.toast('Komet Merah dicuri! Antar ke Bengkel Darma.');
        game.police.addHeat(25);
      }
      return;
    }
    if (dist < 6) {
      // Mission 3 only counts on foot at the warung (hide inside).
      if (def.id === 'kabur-dari-razia' && game.player.inCar) {
        game.hud.toast('Turun dari mobil dan masuk ke warung!');
        return;
      }
      complete(game);
    }
  }

  return {
    state,
    currentDef,
    currentLine,
    objectiveText,
    objectivePos,
    startMission,
    advanceDialogue,
    complete,
    fail,
    update,
    marker,
  };
}

export { PLACES };
