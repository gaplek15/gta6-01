// Synthesised sound: no audio files. Engine hum follows speed, a two-tone
// police siren, gunshots, coins, punches, crashes and mission jingles — all
// built from oscillators and filtered noise.
export function createAudio(game) {
  const audio = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenOn: false,
    sirenTimer: 0,
    sirenHigh: false,
    ensure() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Engine: detuned saws through a lowpass.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'square';
      this.engineOsc2.frequency.value = 28;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filt);
      this.engineOsc2.connect(filt);
      filt.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.engineOsc2.start();
      // Siren: a sine that alternates pitch.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 780;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    },
    setEngine(speed01) {
      if (!this.ctx) return;
      const target = speed01 > 0.02 ? 0.05 + speed01 * 0.075 : 0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.ctx.currentTime, 0.08);
      this.engineOsc2.frequency.setTargetAtTime(28 + speed01 * 65, this.ctx.currentTime, 0.08);
    },
    setSiren(on) {
      this.sirenOn = on;
      if (!this.ctx) return;
      this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.15);
    },
    update(dt) {
      if (!this.ctx || !this.sirenOn) return;
      this.sirenTimer += dt;
      if (this.sirenTimer > 0.42) {
        this.sirenTimer = 0;
        this.sirenHigh = !this.sirenHigh;
        this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 1050 : 780, this.ctx.currentTime, 0.03);
      }
    },
    blip(freq, dur, type = 'sine', gain = 0.16, when = 0) {
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    },
    noise(dur, filterFreq, gain = 0.2, type = 'lowpass') {
      if (!this.ctx) return;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filt = this.ctx.createBiquadFilter();
      filt.type = type;
      filt.frequency.value = filterFreq;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(filt);
      filt.connect(g);
      g.connect(this.master);
      src.start();
    },
    gunshot() { this.noise(0.16, 1800, 0.3, 'highpass'); this.blip(160, 0.12, 'square', 0.14); },
    punch() { this.noise(0.1, 300, 0.3); },
    crash() { this.noise(0.35, 500, 0.32); },
    coin() { this.blip(1318, 0.09, 'sine', 0.14); this.blip(1760, 0.16, 'sine', 0.14, 0.08); },
    click() { this.blip(660, 0.06, 'square', 0.08); },
    missionComplete() {
      this.blip(523, 0.12, 'triangle', 0.16);
      this.blip(659, 0.12, 'triangle', 0.16, 0.11);
      this.blip(784, 0.2, 'triangle', 0.16, 0.22);
      this.blip(1046, 0.3, 'triangle', 0.14, 0.33);
    },
  };
  return audio;
}
