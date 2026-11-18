// Synthesized sound with WebAudio — no audio files, no network.
// One job: every sound the game makes (engine, siren, punches, coins,
// gunshots, UI, and a low background groove) is built from oscillators.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let musicOn = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: a sawtooth through a low-pass filter, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a square wave that alternates between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
  }

  // A lazy bass groove: root notes of a I–VI–IV–V loop in A minor, quiet.
  const BASS_LINE = [55, 55, 43.65, 43.65, 49, 49, 61.74, 61.74];
  function startMusic() {
    if (!ctx || musicOn || musicTimer) return;
    musicOn = true;
    let step = 0;
    musicTimer = window.setInterval(() => {
      if (muted || !musicOn) return;
      const f = BASS_LINE[step % BASS_LINE.length];
      blip(f, 0.5, 'triangle', 0.07);
      if (step % 4 === 0) blip(f * 2, 0.12, 'sine', 0.03);
      step += 1;
    }, 320);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); startMusic(); },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted() { return muted; },
    setEngine(speed01, on) {
      if (!ctx) return;
      engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 110, ctx.currentTime, 0.1);
    },
    setSiren(on, phase) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.2);
      sirenOsc.frequency.setTargetAtTime(phase ? 880 : 660, ctx.currentTime, 0.05);
    },
    play(name) {
      if (!ensure()) return;
      if (name === 'coin') { blip(880, 0.1, 'sine', 0.2); blip(1320, 0.18, 'sine', 0.2, 0.08); }
      else if (name === 'punch') { noise(0.12, 0.35, 500); blip(90, 0.12, 'sine', 0.3); }
      else if (name === 'shot') { noise(0.15, 0.5, 3000); blip(160, 0.08, 'square', 0.15); }
      else if (name === 'crash') { noise(0.3, 0.5, 800); blip(60, 0.25, 'sine', 0.35); }
      else if (name === 'click') { blip(700, 0.05, 'sine', 0.12); }
      else if (name === 'mission') { [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.22, 'triangle', 0.2, i * 0.11)); }
      else if (name === 'fail') { [392, 330, 262].forEach((f, i) => blip(f, 0.25, 'triangle', 0.18, i * 0.13)); }
      else if (name === 'pickup') { blip(520, 0.08, 'sine', 0.18); blip(780, 0.12, 'sine', 0.18, 0.06); }
      else if (name === 'busted') { [330, 262, 196].forEach((f, i) => blip(f, 0.3, 'sawtooth', 0.12, i * 0.16)); }
    },
  };
}
