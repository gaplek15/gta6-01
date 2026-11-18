// HUD and menus: wanted stars, money, health, a live minimap, objective,
// speed, toasts, dialogue, interaction prompts — and the title, pause,
// busted and wasted screens.
// One job: everything the player reads, drawn in the DOM over the canvas.
import { CITY, GAME_SUBTITLE, GAME_TITLE, PLAYER, STORY } from './config.js';

const MINIMAP_SIZE = 190;

export function createHud() {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="hud-top-left">
      <div id="hud-money">$0</div>
      <div id="hud-health"><div id="hud-health-fill"></div></div>
      <div id="hud-xp">Level 1</div>
    </div>
    <div id="hud-top-right">
      <div id="hud-stars">☆☆☆☆☆</div>
      <div id="hud-clock"></div>
    </div>
    <div id="hud-objective"></div>
    <div id="hud-toast"></div>
    <div id="hud-dialogue"><div id="hud-dialogue-name"></div><div id="hud-dialogue-text"></div><div id="hud-dialogue-hint">E / klik — lanjut</div></div>
    <div id="hud-prompt"></div>
    <div id="hud-crosshair">+</div>
    <div id="hud-speed"></div>
    <canvas id="hud-minimap" width="${MINIMAP_SIZE}" height="${MINIMAP_SIZE}"></canvas>
    <div id="hud-screen"></div>
  `;
  const moneyEl = document.getElementById('hud-money');
  const healthFill = document.getElementById('hud-health-fill');
  const xpEl = document.getElementById('hud-xp');
  const starsEl = document.getElementById('hud-stars');
  const clockEl = document.getElementById('hud-clock');
  const objectiveEl = document.getElementById('hud-objective');
  const toastEl = document.getElementById('hud-toast');
  const dialogueEl = document.getElementById('hud-dialogue');
  const dialogueName = document.getElementById('hud-dialogue-name');
  const dialogueText = document.getElementById('hud-dialogue-text');
  const promptEl = document.getElementById('hud-prompt');
  const crosshairEl = document.getElementById('hud-crosshair');
  const speedEl = document.getElementById('hud-speed');
  const minimap = document.getElementById('hud-minimap');
  const mctx = minimap.getContext('2d');
  const screenEl = document.getElementById('hud-screen');

  let toastTimer = null;
  let toastQueue = [];
  let screen = null;
  let dialoguePinned = false;

  function toast(msg) {
    toastQueue.push(msg);
    if (toastQueue.length > 3) toastQueue.shift();
    toastEl.innerHTML = toastQueue.map((m) => `<div>${m}</div>`).join('');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastQueue = []; toastEl.innerHTML = ''; }, 5000);
  }

  function setObjective(text, dist) {
    objectiveEl.textContent = dist !== undefined && dist !== null
      ? `${text}  •  ${Math.round(dist)} m`
      : text;
  }

  function showDialogue(name, text) {
    dialogueName.textContent = name;
    dialogueText.textContent = text;
    dialogueEl.style.display = 'block';
  }

  function hideDialogue() {
    if (dialoguePinned) return;
    dialogueEl.style.display = 'none';
  }

  // Keep a dialogue on screen even when the game would hide it (used by
  // the mission screenshot, where the line is part of the frame).
  function pinDialogue(on) {
    dialoguePinned = on;
  }

  function setPrompt(text) {
    promptEl.textContent = text || '';
    promptEl.style.display = text ? 'block' : 'none';
  }

  function setCrosshair(on) {
    crosshairEl.style.display = on ? 'block' : 'none';
  }

  function setSpeed(kmh, name) {
    if (kmh === null) {
      speedEl.style.display = 'none';
      return;
    }
    speedEl.style.display = 'block';
    speedEl.innerHTML = `<b>${Math.round(kmh)}</b> km/h<div>${name}</div>`;
  }

  function update(game, dt) {
    const p = game.player;
    moneyEl.textContent = `$${Math.floor(p.money)}`;
    healthFill.style.width = `${Math.max(0, p.health)}%`;
    healthFill.style.background = p.health > 50 ? '#2ecc71' : p.health > 25 ? '#f39c12' : '#e74c3c';
    xpEl.textContent = `Level ${1 + Math.floor(p.xp / 200)}  •  ${p.xp} XP`;
    const stars = game.police.state.stars;
    starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    starsEl.style.color = stars === 0 ? '#8899aa' : stars < 3 ? '#ffd94d' : '#ff5a3c';
    // In-game clock: one game day is 4 real minutes, starting at 09:00.
    const mins = 9 * 60 + Math.floor(game.time * 6) % (24 * 60);
    const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    clockEl.textContent = `${hh}:${mm}`;
    drawMinimap(game);
  }

  function toMap(x, z) {
    const s = MINIMAP_SIZE / (CITY.half * 2 + 40);
    return [(x + CITY.half + 20) * s, (z + CITY.half + 20) * s];
  }

  function drawMinimap(game) {
    const W = MINIMAP_SIZE;
    mctx.clearRect(0, 0, W, W);
    // Sea and sand.
    mctx.fillStyle = '#2a7fa8';
    mctx.fillRect(0, W - 14, W, 14);
    mctx.fillStyle = '#e8d5a0';
    mctx.fillRect(0, W - 20, W, 6);
    // Blocks.
    mctx.fillStyle = '#6a6a62';
    for (let bx = -270; bx <= 210; bx += 60) {
      for (let bz = -270; bz <= 210; bz += 60) {
        const [x, y] = toMap(bx + 7, bz + 7);
        mctx.fillRect(x, y, 46 * (W / 640), 46 * (W / 640));
      }
    }
    // Roads.
    mctx.strokeStyle = '#3a3a40';
    mctx.lineWidth = 4;
    for (let c = -270; c <= 270; c += 60) {
      const [x1, y1] = toMap(c, -300);
      const [x2, y2] = toMap(c, 300);
      mctx.beginPath(); mctx.moveTo(x1, y1); mctx.lineTo(x2, y2); mctx.stroke();
      const [x3, y3] = toMap(-300, c);
      const [x4, y4] = toMap(300, c);
      mctx.beginPath(); mctx.moveTo(x3, y3); mctx.lineTo(x4, y4); mctx.stroke();
    }
    // Coins.
    mctx.fillStyle = '#ffd94d';
    for (const c of game.activities.coins) {
      if (c.got) continue;
      const [x, y] = toMap(c.x, c.z);
      mctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Mission marker.
    const obj = game.missions.objectivePos();
    if (obj) {
      const [x, y] = toMap(obj.x, obj.z);
      const pulse = 6 + Math.sin(performance.now() / 200) * 2;
      mctx.strokeStyle = '#ffd94d';
      mctx.lineWidth = 2;
      mctx.beginPath(); mctx.arc(x, y, pulse, 0, Math.PI * 2); mctx.stroke();
      mctx.fillStyle = '#ffd94d';
      mctx.beginPath(); mctx.arc(x, y, 3.5, 0, Math.PI * 2); mctx.fill();
    }
    // Taxi marker.
    const taxi = game.activities.taxiObjective();
    if (taxi) {
      const [x, y] = toMap(taxi.pos.x, taxi.pos.z);
      mctx.fillStyle = '#2ecc71';
      mctx.beginPath(); mctx.arc(x, y, 3.5, 0, Math.PI * 2); mctx.fill();
    }
    // Police.
    for (const v of game.police.state.cars) {
      const [x, y] = toMap(v.pos.x, v.pos.z);
      mctx.fillStyle = '#3d7ad9';
      mctx.beginPath(); mctx.arc(x, y, 3.5, 0, Math.PI * 2); mctx.fill();
    }
    for (const c of game.police.state.cops) {
      if (c.dead) continue;
      const [x, y] = toMap(c.pos.x, c.pos.z);
      mctx.fillStyle = '#7ab3ff';
      mctx.fillRect(x - 2, y - 2, 4, 4);
    }
    // Traffic.
    mctx.fillStyle = '#e8e8e8';
    for (const v of game.traffic.cars) {
      const [x, y] = toMap(v.pos.x, v.pos.z);
      mctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Player arrow.
    const pp = game.player.inCar ? game.player.inCar.pos : game.player.pos;
    const [px, py] = toMap(pp.x, pp.z);
    const yaw = game.player.inCar ? game.player.inCar.heading : game.player.yaw;
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(Math.atan2(Math.sin(yaw), Math.cos(yaw)) * -1 + Math.PI);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(0, -7);
    mctx.lineTo(5, 6);
    mctx.lineTo(-5, 6);
    mctx.closePath();
    mctx.fill();
    mctx.restore();
    // North.
    mctx.fillStyle = '#ffffff';
    mctx.font = 'bold 11px system-ui, sans-serif';
    mctx.fillText('N', W - 12, 14);
  }

  function showScreen(kind, data, callbacks) {
    screen = kind;
    if (kind === 'title') {
      screenEl.innerHTML = `
        <div class="panel">
          <h1>${GAME_TITLE}</h1>
          <h2>${GAME_SUBTITLE}</h2>
          <p class="story">${STORY.intro.join('<br>')}</p>
          <div class="controls">
            <div><b>W A S D</b> — jalan / nyetir</div>
            <div><b>Mouse</b> — putar kamera (drag)</div>
            <div><b>Shift</b> — lari &nbsp; <b>Spasi</b> — lompat</div>
            <div><b>E</b> — masuk / keluar mobil, interaksi</div>
            <div><b>F</b> — pukul &nbsp; <b>Klik kiri</b> — tembak (kalau punya pistol)</div>
            <div><b>P / Esc</b> — pause &nbsp; <b>M</b> — suara</div>
          </div>
          <button id="btn-start">MULAI — Kerja untuk Darma</button>
          ${data && data.hasSave ? '<button id="btn-load" class="secondary">Lanjutkan save terakhir</button>' : ''}
          <p class="fine">Kota, karakter, dan cerita orisinal. Bukan game komersial apa pun.</p>
        </div>`;
      document.getElementById('btn-start').addEventListener('click', () => callbacks.start(false));
      const loadBtn = document.getElementById('btn-load');
      if (loadBtn) loadBtn.addEventListener('click', () => callbacks.start(true));
    } else if (kind === 'pause') {
      screenEl.innerHTML = `
        <div class="panel">
          <h1>PAUSE</h1>
          <p class="story">Teluk Cahaya menunggu.</p>
          <button id="btn-resume">Lanjutkan</button>
          <button id="btn-save" class="secondary">Simpan game</button>
          <button id="btn-quit" class="secondary">Kembali ke judul</button>
        </div>`;
      document.getElementById('btn-resume').addEventListener('click', callbacks.resume);
      document.getElementById('btn-save').addEventListener('click', callbacks.save);
      document.getElementById('btn-quit').addEventListener('click', callbacks.quit);
    } else if (kind === 'busted') {
      screenEl.innerHTML = `
        <div class="panel">
          <h1>TANGKAP!</h1>
          <p class="story">Polisi Teluk menangkapmu. Denda $${data.fine}.<br>Barang bukti disita, tapi Raka bebas lagi.</p>
          <button id="btn-resume">Keluar dari Polsek</button>
        </div>`;
      document.getElementById('btn-resume').addEventListener('click', callbacks.resume);
    } else if (kind === 'wasted') {
      screenEl.innerHTML = `
        <div class="panel">
          <h1>TUMBANG!</h1>
          <p class="story">Raka pingsan dan dibawa ke RS Cahaya.<br>Tagihan rumah sakit $${data.fine}.</p>
          <button id="btn-resume">Bangun di RS Cahaya</button>
        </div>`;
      document.getElementById('btn-resume').addEventListener('click', callbacks.resume);
    } else {
      screenEl.innerHTML = '';
    }
    screenEl.style.display = kind ? 'flex' : 'none';
  }

  function hideScreen() {
    screen = null;
    screenEl.innerHTML = '';
    screenEl.style.display = 'none';
  }

  return {
    toast,
    setObjective,
    showDialogue,
    hideDialogue,
    pinDialogue,
    setPrompt,
    setCrosshair,
    setSpeed,
    update,
    showScreen,
    hideScreen,
    get screen() { return screen; },
  };
}

export { PLAYER };
