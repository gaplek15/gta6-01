// Save / load through localStorage: money, XP, mission progress, health,
// pistol ownership and the player's position.
const KEY = 'teluk-cahaya-save-v1';

export function saveGame(game) {
  try {
    const data = {
      money: game.money,
      xp: game.xp,
      level: game.level,
      missionIndex: game.missions.index,
      missionPhase: game.missions.phase,
      health: game.player.health,
      ownsPistol: game.ownsPistol,
      x: game.player.pos.x,
      z: game.player.pos.z,
      coins: game.world.coins.filter((c) => c.taken).length,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
