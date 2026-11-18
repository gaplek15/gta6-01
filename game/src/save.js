// Save and load with localStorage — money, health, progress, position.
// One job: keep the player's Teluk Cahaya between visits.
import { SAVE_KEY } from './config.js';

export function saveGame(game) {
  try {
    const data = {
      money: Math.floor(game.player.money),
      health: game.player.health,
      xp: game.player.xp,
      pistol: game.player.pistol,
      ammo: game.player.ammo,
      missionIndex: game.missions.state.index,
      missionsDone: game.missions.state.completed,
      coinsGot: game.activities.state.coinsGot,
      playerPos: { x: game.player.pos.x, z: game.player.pos.z },
      time: game.time,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: nothing to clear.
  }
}
