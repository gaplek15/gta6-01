// Missions: a three-job story arc with briefings, objectives, a 3D marker
// beam, distance tracking and rewards. M1 deliver, M2 steal a car, M3
// escape a crackdown.
import * as THREE from 'three';
import { MISSIONS, ECONOMY } from './config.js';

export function createMissions(game) {
  // Marker beam: a tall translucent column + a spinning diamond.
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 16, 1, true), beamMat);
  beam.position.y = 30;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.9 }),
  );
  diamond.position.y = 4.5;
  const group = new THREE.Group();
  group.add(beam, diamond);
  group.visible = false;
  game.scene.add(group);

  return {
    index: 0,
    phase: 'idle', // idle | briefing | active | deliver | done
    target: null,
    objective: '',
    marker: group,
    diamond,
    elapsed: 0,
  };
}

export function startMissions(game) {
  beginMission(game, 0);
}

export function beginMission(game, i) {
  const m = MISSIONS[i];
  const ms = game.missions;
  ms.index = i;
  ms.phase = 'briefing';
  ms.objective = m.objective;
  ms.target = { ...m.target };
  ms.marker.visible = true;
  ms.marker.position.set(m.target.x, 0, m.target.z);
  game.hud.showDialog(m.briefing, m.text);
  if (m.wantedOnStart) game.police.addWanted(m.wantedOnStart);
  game.hud.setObjective(m.objective, ms.target);
}

function completeMission(game) {
  const m = MISSIONS[game.missions.index];
  game.money += m.reward;
  game.addXp(ECONOMY.xpPerMission);
  game.audio.missionComplete();
  game.hud.toast(`Misi selesai: ${m.title}  +$${m.reward}`);
  game.saveGame();
  const next = game.missions.index + 1;
  if (next >= MISSIONS.length) {
    game.missions.phase = 'done';
    game.missions.objective = 'Cerita selesai — Teluk Cahaya milikmu!';
    game.missions.target = null;
    game.missions.marker.visible = false;
    game.hud.setObjective(game.missions.objective, null);
    game.hud.showDialog('Darma', 'Kerja bagus, Raka. Teluk Cahaya sekarang kenal namamu. Istirahat dulu di warung — besok ada kerjaan lagi.');
  } else {
    beginMission(game, next);
  }
}

export function updateMissions(game, dt) {
  const ms = game.missions;
  ms.elapsed += dt;
  if (ms.marker.visible) {
    ms.diamond.rotation.y += dt * 2.2;
    ms.diamond.position.y = 4.5 + Math.sin(ms.elapsed * 2) * 0.6;
  }
  if (ms.phase === 'done' || ms.phase === 'idle') return;
  const player = game.player;
  const px = player.inCar ? player.inCar.pos.x : player.pos.x;
  const pz = player.inCar ? player.inCar.pos.z : player.pos.z;

  // Mission 2: stealing the Komet Merah switches to the delivery leg.
  if (ms.phase === 'active' && MISSIONS[ms.index].id === 'mobil-pesanan') {
    if (player.inCar === game.missionCar) {
      ms.phase = 'deliver';
      ms.objective = MISSIONS[ms.index].deliverObjective;
      ms.target = { ...MISSIONS[ms.index].deliver };
      ms.marker.position.set(ms.target.x, 0, ms.target.z);
      game.hud.setObjective(ms.objective, ms.target);
      game.hud.toast('Komet Merah dicuri! Antar ke Bengkel Darma.');
      game.police.addWanted(1);
    }
  }

  if (!ms.target) return;
  const d = Math.hypot(ms.target.x - px, ms.target.z - pz);
  game.hud.setObjectiveDistance(d);
  const arriveRadius = ms.phase === 'deliver' ? 10 : 9;
  if (d < arriveRadius) {
    // Mission 2's first leg only counts once the car is stolen.
    if (ms.phase === 'active' && MISSIONS[ms.index].id === 'mobil-pesanan') {
      game.hud.setPrompt('Tekan E untuk mencuri Komet Merah');
      return;
    }
    completeMission(game);
  }
}
