// Procedural canvas textures — every large surface in the city gets a real
// texture drawn in code, so nothing looks flat. No external image files.
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function speckle(ctx, w, h, rng, n, colors, sizeMin, sizeMax, alphaMin, alphaMax) {
  for (let i = 0; i < n; i += 1) {
    const s = rng.range(sizeMin, sizeMax);
    ctx.globalAlpha = rng.range(alphaMin, alphaMax);
    ctx.fillStyle = rng.pick(colors);
    ctx.fillRect(rng.range(0, w), rng.range(0, h), s, s);
  }
  ctx.globalAlpha = 1;
}

// Asphalt with grain, hairline cracks, patches and worn tyre bands.
// Kept mid-grey (not near-black) so sunlit and shadowed stretches both read.
export function asphaltTexture(rng) {
  const [c, ctx] = canvas(512, 512);
  ctx.fillStyle = '#565a60';
  ctx.fillRect(0, 0, 512, 512);
  speckle(ctx, 512, 512, rng, 9000, ['#4b4f55', '#60646a', '#686c72', '#43464b'], 1, 3, 0.25, 0.7);
  // Patches: darker rectangles with soft edges.
  for (let i = 0; i < 7; i += 1) {
    const x = rng.range(0, 420);
    const y = rng.range(0, 420);
    const w = rng.range(50, 130);
    const h = rng.range(40, 110);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#3c3f44';
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeRect(x, y, w, h);
  }
  // Hairline cracks.
  ctx.strokeStyle = 'rgba(12,12,14,0.55)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i += 1) {
    let x = rng.range(0, 512);
    let y = rng.range(0, 512);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s += 1) {
      x += rng.range(-26, 26);
      y += rng.range(-26, 26);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Worn tyre bands (subtle horizontal lightening).
  for (const y of [128, 384]) {
    const g = ctx.createLinearGradient(0, y - 26, 0, y + 26);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 26, 512, 52);
  }
  return toTexture(c, 6, 6);
}

// Pale concrete sidewalk slabs with joints, stains and grit.
export function sidewalkTexture(rng) {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#b3ac9c';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, rng, 2600, ['#a49d8c', '#c0b9a8', '#9a937f', '#c9c2b2'], 1, 3, 0.2, 0.55);
  ctx.strokeStyle = 'rgba(70,64,52,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i += 1) {
    ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(256, i * 64); ctx.stroke();
  }
  // Weather stains.
  for (let i = 0; i < 10; i += 1) {
    const x = rng.range(0, 256);
    const y = rng.range(0, 256);
    const r = rng.range(12, 42);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(90,80,60,0.20)');
    g.addColorStop(1, 'rgba(90,80,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  return toTexture(c, 8, 8);
}

// Building facade: plaster/brick base, framed windows (some warmly lit),
// a door band at the bottom and grime near the ground.
export function facadeTexture(rng, base, floors, litRatio = 0.28) {
  const W = 256;
  const H = 256;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  // Plaster noise + brick hints.
  speckle(ctx, W, H, rng, 2200, ['rgba(0,0,0,0.06)', 'rgba(255,255,255,0.07)', 'rgba(120,90,60,0.08)'], 1, 4, 0.2, 0.5);
  const cols = 4;
  const rows = Math.max(2, floors);
  const cw = W / cols;
  const ch = H / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = col * cw + cw * 0.22;
      const y = r * ch + ch * 0.22;
      const w = cw * 0.56;
      const h = ch * 0.56;
      // Frame.
      ctx.fillStyle = '#e8e2d4';
      ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
      // Glass: dark reflective, some warmly lit.
      const lit = rng.next() < litRatio;
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      if (lit) {
        g.addColorStop(0, '#f7c873');
        g.addColorStop(1, '#c98f2e');
      } else {
        g.addColorStop(0, '#2b3542');
        g.addColorStop(0.5, '#1a2230');
        g.addColorStop(1, '#33414f');
      }
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      // Sky reflection streak.
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(x + w * 0.12, y, w * 0.18, h);
      // Mullion cross.
      ctx.fillStyle = 'rgba(20,24,30,0.7)';
      ctx.fillRect(x + w / 2 - 1, y, 2, h);
      ctx.fillRect(x, y + h / 2 - 1, w, 2);
    }
  }
  // Grime at the bottom.
  const g2 = ctx.createLinearGradient(0, H - 44, 0, H);
  g2.addColorStop(0, 'rgba(60,50,35,0)');
  g2.addColorStop(1, 'rgba(60,50,35,0.35)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, H - 44, W, 44);
  return toTexture(c, 1, 1);
}

// Dark reflective glass for shopfronts and car windows.
export function glassTexture(rng) {
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createLinearGradient(0, 0, 128, 128);
  g.addColorStop(0, '#3a4a5c');
  g.addColorStop(0.45, '#1c2634');
  g.addColorStop(0.55, '#2c3a49');
  g.addColorStop(1, '#141c28');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  ctx.fillRect(18, 0, 14, 128);
  ctx.fillRect(52, 0, 6, 128);
  speckle(ctx, 128, 128, rng, 60, ['rgba(255,255,255,0.10)'], 1, 2, 0.2, 0.4);
  return toTexture(c, 1, 1);
}

// Grass with blades and bare patches.
export function grassTexture(rng) {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#5d8a4a';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, rng, 4200, ['#4c7439', '#6f9c57', '#7fae62', '#557f43'], 1, 3, 0.3, 0.7);
  for (let i = 0; i < 8; i += 1) {
    const x = rng.range(0, 256);
    const y = rng.range(0, 256);
    const r = rng.range(10, 30);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(150,120,70,0.25)');
    g.addColorStop(1, 'rgba(150,120,70,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  return toTexture(c, 10, 10);
}

// Sand with ripples and shells.
export function sandTexture(rng) {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#dcc79a';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, rng, 3200, ['#cbb384', '#e8d5a8', '#d3c08d'], 1, 2, 0.3, 0.6);
  ctx.strokeStyle = 'rgba(160,135,90,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i += 1) {
    const y = rng.range(0, 256);
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 16) ctx.lineTo(x, y + Math.sin(x / 34 + i) * 5);
    ctx.stroke();
  }
  return toTexture(c, 8, 8);
}

// Terracotta roof tiles.
export function roofTexture(rng, base = '#a8542f') {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 8; r += 1) {
    for (let col = 0; col < 8; col += 1) {
      const x = col * 32 + (r % 2 ? 16 : 0);
      const y = r * 32;
      ctx.fillStyle = `rgba(0,0,0,${rng.range(0.05, 0.22)})`;
      ctx.beginPath();
      ctx.arc(x, y + 16, 15, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x - 15, y, 30, 3);
    }
  }
  speckle(ctx, 256, 256, rng, 500, ['rgba(0,0,0,0.15)', 'rgba(255,255,255,0.10)'], 1, 3, 0.2, 0.4);
  return toTexture(c, 3, 3);
}

// Striped awning.
export function awningTexture(colorA, colorB) {
  const [c, ctx] = canvas(128, 64);
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = i % 2 ? colorA : colorB;
    ctx.fillRect(i * 16, 0, 16, 64);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 56, 128, 8);
  return toTexture(c, 2, 1);
}

// Billboard face with big text.
export function billboardTexture(text, bg = '#1d2733', fg = '#f5d76e') {
  const [c, ctx] = canvas(512, 192);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 492, 172);
  ctx.fillStyle = fg;
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 100);
  return toTexture(c, 1, 1);
}

// Soft round cloud sprite (radial gradient puffs).
export function cloudTexture(rng) {
  const [c, ctx] = canvas(256, 128);
  for (let i = 0; i < 9; i += 1) {
    const x = 40 + rng.range(0, 176);
    const y = 44 + rng.range(0, 44);
    const r = rng.range(22, 46);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}
