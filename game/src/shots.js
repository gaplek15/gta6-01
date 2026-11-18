// Screenshot staging: ?shot=<scene>&seed=<n> puts the game into a fixed,
// deterministic frame — a real gameplay moment, not a posed still. The
// scenes are: cover (on foot in a busy street), drive (Komet Merah at
// speed), chase (three stars, police on the tail) and mission (Darma's
// briefing beside the target car).
import { MISSIONS, PLACES } from './config.js';

function dressStreet(game, specs) {
  // Reuse the existing traffic cars / pedestrians, placing some of them
  // exactly where the frame needs them.
  let ci = 0;
  let pi = 0;
  for (const s of specs) {
    if (s.kind === 'car' && ci < game.traffic.cars.length) {
      const t = game.traffic.cars[ci];
      ci += 1;
      if (t.parked) continue;
      const fx = s.dir === 'north' ? 0 : s.dir === 'south' ? 0 : s.dir === 'east' ? 1 : -1;
      const fz = s.dir === 'north' ? -1 : s.dir === 'south' ? 1 : 0;
      t.car.pos.set(s.x, 0, s.z);
      t.car.heading = Math.atan2(-fx, -fz);
      t.car.speed = s.speed !== undefined ? s.speed : 8;
      t.speed = t.car.speed;
      t.car.group.position.copy(t.car.pos);
      t.car.group.rotation.y = t.car.heading;
      t.target = null;
    }
    if (s.kind === 'ped' && pi < game.traffic.peds.length) {
      const p = game.traffic.peds[pi];
      pi += 1;
      p.pos.set(s.x, 0, s.z);
      p.heading = s.heading || 0;
      p.target = { x: s.x, z: s.z };
      p.group.position.copy(p.pos);
      p.group.rotation.y = p.heading;
    }
  }
}

function setMissionScene(game, index, phase) {
  const m = MISSIONS[index];
  const ms = game.missions;
  ms.index = index;
  ms.phase = phase;
  ms.objective = m.objective;
  ms.target = { ...m.target };
  ms.marker.visible = true;
  ms.marker.position.set(m.target.x, 0, m.target.z);
  game.hud.setObjective(m.objective, ms.target);
}

export function stageShot(game, name) {
  const player = game.player;
  game.state = 'play';
  game.hud.hideScreens();

  if (name === 'drive') {
    setMissionScene(game, 0, 'active');
    // Raka in the red Komet Merah, northbound on the avenue at 92 km/h.
    // Staged a little further north so the frame's top-left corner is open sky.
    const car = game.missionCar;
    player.inCar = car;
    car.pos.set(35, 0, 50);
    car.heading = 0; // facing -z (north)
    car.speed = 25.5;
    car.group.position.copy(car.pos);
    car.group.rotation.y = 0;
    player.pos.copy(car.pos);
    player.group.visible = false;
    game.camYaw = 0;
    game.camPitch = 0.1;
    dressStreet(game, [
      { kind: 'car', x: 35, z: 10, dir: 'north', speed: 9 },
      { kind: 'car', x: 32.2, z: 28, dir: 'north', speed: 8 },
      { kind: 'car', x: -21, z: -40, dir: 'south', speed: 9 },
      { kind: 'ped', x: 44, z: 30, heading: 1.5 },
      { kind: 'ped', x: 26, z: 90, heading: -1.2 },
    ]);
    return { screen: 'play' };
  }

  if (name === 'chase') {
    setMissionScene(game, 2, 'active');
    game.police.wanted = 3;
    game.police.decayTimer = 99;
    // Raka in a blue sedan, northbound, police closing in behind.
    const sedan = game.traffic.cars.find((t) => t.car.type === 'sedan' && !t.parked);
    const car = sedan ? sedan.car : game.missionCar;
    player.inCar = car;
    car.pos.set(-77, 0, 110);
    car.heading = 0;
    car.speed = 10;
    car.group.position.copy(car.pos);
    car.group.rotation.y = 0;
    player.pos.copy(car.pos);
    player.group.visible = false;
    game.camYaw = 0;
    game.camPitch = 0.22;
    // Two police cars on the tail.
    const pc1 = game.police.cars[0];
    const pc2 = game.police.cars[1];
    if (pc1) {
      pc1.car.pos.set(-77, 0, 132);
      pc1.car.heading = 0;
      pc1.car.speed = 14;
      pc1.car.group.position.copy(pc1.car.pos);
      pc1.car.group.rotation.y = 0;
    }
    if (pc2) {
      pc2.car.pos.set(-74.2, 0, 148);
      pc2.car.heading = 0;
      pc2.car.speed = 13;
      pc2.car.group.position.copy(pc2.car.pos);
      pc2.car.group.rotation.y = 0;
    }
    dressStreet(game, [
      { kind: 'car', x: -77, z: 82, dir: 'north', speed: 8 },
      { kind: 'car', x: -79.8, z: 60, dir: 'south', speed: 8 },
      { kind: 'ped', x: -68, z: 118, heading: 2.4 },
      { kind: 'ped', x: -86, z: 100, heading: -0.8 },
    ]);
    return { screen: 'play' };
  }

  if (name === 'mission') {
    setMissionScene(game, 1, 'active');
    game.hud.showDialog('Darma', MISSIONS[1].text);
    player.inCar = null;
    // Raka faces the Komet Merah (north-east of him); the camera sits
    // south-west so the car is centre-frame above the dialog.
    player.pos.set(180, 0, -20);
    player.heading = -Math.PI / 4;
    player.group.position.copy(player.pos);
    player.group.rotation.y = player.heading;
    player.group.visible = true;
    game.camYaw = -0.7;
    game.camPitch = 0.25;
    game.camDist = 6.2;
    dressStreet(game, [
      { kind: 'ped', x: 170, z: -40, heading: 0.6 },
      { kind: 'ped', x: 196, z: -8, heading: 2.8 },
    ]);
    return { screen: 'play' };
  }

  // Default: cover — Raka on foot in a busy street at golden hour.
  // Closer camera than normal play so Raka fills the frame.
  setMissionScene(game, 0, 'active');
  player.inCar = null;
  player.pos.set(-21, 0, 40);
  player.heading = Math.PI;
  player.group.position.copy(player.pos);
  player.group.rotation.y = player.heading;
  player.group.visible = true;
  game.camYaw = 0.6;
  game.camPitch = 0.08;
  game.camDist = 5.4;
  dressStreet(game, [
    { kind: 'car', x: -21, z: -6, dir: 'north', speed: 8 },
    { kind: 'car', x: -18.2, z: 84, dir: 'south', speed: 9 },
    { kind: 'car', x: 35, z: 20, dir: 'north', speed: 8 },
    { kind: 'car', x: -21, z: 18, dir: 'north', speed: 7 },
    { kind: 'ped', x: -30, z: 52, heading: 1.2 },
    { kind: 'ped', x: -12, z: 26, heading: -2.2 },
    { kind: 'ped', x: 44, z: 60, heading: 2.6 },
    { kind: 'ped', x: -28, z: 28, heading: 0.4 },
  ]);
  return { screen: 'play' };
}

// The scenes shots.json advertises.
export const SHOT_LIST = [
  { name: '1-cover.jpg', query: '?shot=cover&seed=1' },
  { name: '2-drive.jpg', query: '?shot=drive&seed=1' },
  { name: '3-chase.jpg', query: '?shot=chase&seed=1' },
  { name: '4-mission.jpg', query: '?shot=mission&seed=1' },
];
