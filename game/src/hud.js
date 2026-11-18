// HUD: money, health, XP, clock, wanted stars, objective pill, speedometer,
// context prompts, dialogues, toasts, the minimap canvas and the menu
// screens (title / pause / busted / wasted).
import { PLACES } from './config.js';

export function createHud(game) {
  const $ = (id) => document.getElementById(id);
  const els = {
    money: $('money'),
    healthFill: $('healthfill'),
    level: $('level'),
    clock: $('clock'),
    stars: $('stars'),
    objective: $('objective'),
    objectiveText: $('objectivetext'),
    speed: $('speed'),
    speedName: $('speedname'),
    prompt: $('prompt'),
    dialog: $('dialog'),
    dialogName: $('dialogname'),
    dialogText: $('dialogtext'),
    toasts: $('toasts'),
    minimap: $('minimap'),
    crosshair: $('crosshair'),
    title: $('screen-title'),
    pause: $('screen-pause'),
    busted: $('screen-busted'),
    wasted: $('screen-wasted'),
    bustedText: $('bustedtext'),
    wastedText: $('wastedtext'),
  };
  const mm = els.minimap.getContext('2d');

  const hud = {
    dialogOpen: false,
    objectiveTarget: null,
    flashStars() {
      els.stars.classList.remove('flash');
      void els.stars.offsetWidth;
      els.stars.classList.add('flash');
    },
    setObjective(text, target, distance) {
      this.objectiveTarget = target || null;
      els.objectiveText.textContent = text;
      els.objective.style.display = text ? 'block' : 'none';
      if (distance !== undefined) this.setObjectiveDistance(distance);
    },
    setObjectiveDistance(d) {
      if (this.objectiveTarget) {
        els.objectiveText.textContent = els.objectiveText.textContent.replace(/ • [\d,]+ m$/, '') + ` • ${Math.round(d)} m`;
      }
    },
    setPrompt(text) {
      els.prompt.textContent = text;
      els.prompt.style.display = text ? 'block' : 'none';
    },
    showDialog(name, text) {
      this.dialogOpen = true;
      els.dialogName.textContent = name;
      els.dialogText.textContent = text;
      els.dialog.style.display = 'block';
    },
    hideDialog() {
      this.dialogOpen = false;
      els.dialog.style.display = 'none';
    },
    toast(msg) {
      const div = document.createElement('div');
      div.className = 'toast';
      div.textContent = msg;
      els.toasts.appendChild(div);
      while (els.toasts.children.length > 3) els.toasts.removeChild(els.toasts.firstChild);
      setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 3600);
    },
    showScreen(name) {
      for (const s of [els.title, els.pause, els.busted, els.wasted]) s.style.display = 'none';
      if (name === 'title') els.title.style.display = 'flex';
      if (name === 'pause') els.pause.style.display = 'flex';
      if (name === 'busted') els.busted.style.display = 'flex';
      if (name === 'wasted') els.wasted.style.display = 'flex';
    },
    hideScreens() {
      for (const s of [els.title, els.pause, els.busted, els.wasted]) s.style.display = 'none';
    },
    update() {
      els.money.textContent = `$${game.money.toLocaleString('en-US')}`;
      els.healthFill.style.width = `${Math.max(0, Math.min(100, game.player.health))}%`;
      els.healthFill.style.background = game.player.health > 50 ? '#2ecc71' : game.player.health > 25 ? '#f39c12' : '#e74c3c';
      els.level.textContent = `Level ${game.level} • ${game.xp} XP`;
      // In-game clock: starts 09:00, one game minute per 1.5 real seconds.
      const mins = 9 * 60 + Math.floor(game.elapsed / 1.5);
      const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
      const mm2 = String(mins % 60).padStart(2, '0');
      els.clock.textContent = `${hh}:${mm2}`;
      let stars = '';
      for (let i = 0; i < 5; i += 1) stars += `<span class="${i < game.police.wanted ? 'on' : 'off'}">★</span>`;
      els.stars.innerHTML = stars;
      const car = game.player.inCar;
      if (car) {
        els.speed.textContent = `${Math.round(Math.abs(car.speed) * 3.6)}`;
        els.speedName.textContent = car.type === 'sports' ? 'Komet Merah' : car.type === 'police' ? 'Mobil Polisi' : car.type === 'taxi' ? 'Taksi' : car.type === 'pickup' ? 'Pickup' : car.type === 'hatch' ? 'Hatchback' : 'Sedan Kota';
        els.speed.style.display = 'block';
      } else {
        els.speed.style.display = 'none';
      }
      els.crosshair.style.display = game.ownsPistol && !car && game.state === 'play' ? 'block' : 'none';
      this.drawMinimap();
    },
    drawMinimap() {
      const W = 220;
      const H = 220;
      const scale = W / 520; // world -260..260 maps onto the canvas
      const toX = (x) => W / 2 + x * scale;
      const toY = (z) => H / 2 + z * scale;
      mm.clearRect(0, 0, W, H);
      mm.fillStyle = 'rgba(16,20,26,0.92)';
      mm.beginPath();
      mm.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
      mm.fill();
      mm.save();
      mm.beginPath();
      mm.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
      mm.clip();
      // Sea (south).
      mm.fillStyle = '#2e7f9e';
      mm.fillRect(0, toY(196), W, H - toY(196));
      // Roads.
      mm.strokeStyle = '#8a8f96';
      mm.lineWidth = 4;
      for (const c of game.world.roads) {
        mm.beginPath(); mm.moveTo(toX(c), 0); mm.lineTo(toX(c), H); mm.stroke();
        mm.beginPath(); mm.moveTo(0, toY(c)); mm.lineTo(W, toY(c)); mm.stroke();
      }
      // Blocks (faint).
      mm.fillStyle = 'rgba(120,110,90,0.5)';
      for (let i = 0; i < 7; i += 1) {
        for (let j = 0; j < 7; j += 1) {
          const bx = -196 + 14 + 21 + i * 56;
          const bz = -196 + 14 + 21 + j * 56;
          mm.fillRect(toX(bx - 21), toY(bz - 21), 42 * scale, 42 * scale);
        }
      }
      // Coins.
      mm.fillStyle = '#ffd23c';
      for (const coin of game.world.coins) {
        if (coin.taken) continue;
        mm.beginPath(); mm.arc(toX(coin.x), toY(coin.z), 2, 0, Math.PI * 2); mm.fill();
      }
      // Mission target.
      if (this.objectiveTarget) {
        const pulse = 5 + Math.sin(game.elapsed * 4) * 2;
        mm.strokeStyle = '#ffd23c';
        mm.lineWidth = 2;
        mm.beginPath(); mm.arc(toX(this.objectiveTarget.x), toY(this.objectiveTarget.z), pulse, 0, Math.PI * 2); mm.stroke();
        mm.fillStyle = '#ffd23c';
        mm.beginPath(); mm.arc(toX(this.objectiveTarget.x), toY(this.objectiveTarget.z), 3, 0, Math.PI * 2); mm.fill();
      }
      // Traffic cars.
      mm.fillStyle = 'rgba(255,255,255,0.85)';
      for (const t of game.traffic.cars) {
        if (t.parked) continue;
        mm.beginPath(); mm.arc(toX(t.car.pos.x), toY(t.car.pos.z), 1.8, 0, Math.PI * 2); mm.fill();
      }
      // Police.
      for (const pc of game.police.cars) {
        mm.fillStyle = '#ff3b30';
        mm.beginPath(); mm.arc(toX(pc.car.pos.x), toY(pc.car.pos.z), 3, 0, Math.PI * 2); mm.fill();
      }
      for (const cop of game.police.cops) {
        mm.fillStyle = '#4a90ff';
        mm.beginPath(); mm.arc(toX(cop.pos.x), toY(cop.pos.z), 2.4, 0, Math.PI * 2); mm.fill();
      }
      // Player arrow.
      const px = toX(game.player.pos.x);
      const py = toY(game.player.pos.z);
      const heading = game.player.inCar ? game.player.inCar.heading : game.player.heading;
      mm.save();
      mm.translate(px, py);
      mm.rotate(Math.atan2(-Math.sin(heading), -Math.cos(heading)) + Math.PI / 2);
      mm.fillStyle = '#ffffff';
      mm.beginPath();
      mm.moveTo(0, -7);
      mm.lineTo(5, 6);
      mm.lineTo(-5, 6);
      mm.closePath();
      mm.fill();
      mm.restore();
      mm.restore();
      // Gold ring.
      mm.strokeStyle = '#c9a227';
      mm.lineWidth = 3;
      mm.beginPath();
      mm.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
      mm.stroke();
    },
  };
  return hud;
}
