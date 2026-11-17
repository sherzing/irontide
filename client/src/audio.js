// Fully synthesised audio (no sample files): gunshots, impacts, footsteps, UI, ambience.
export class GameAudio {
  constructor() { this.ctx = null; this.volume = 0.8; }
  /** Must be called from a user gesture. */
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    // noise buffers
    const mk = (sec, fn) => { const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0); fn(d); return b; };
    this.white = mk(2, (d) => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; });
    this.brown = mk(4, (d) => { let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } });
    // outdoor slap-back / tail
    const ir = ctx.createBuffer(2, ctx.sampleRate * 1.6, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) { const t = i / ctx.sampleRate; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t / 1.6, 3.2) * (t < 0.012 ? 0 : 1) * (1 + 0.8 * Math.exp(-Math.pow((t - 0.11) * 40, 2))); } }
    this.reverb = ctx.createConvolver(); this.reverb.buffer = ir;
    const rg = ctx.createGain(); rg.gain.value = 0.42; this.reverb.connect(rg).connect(this.master);
    // ambience: sea wash + wind
    const amb = ctx.createBufferSource(); amb.buffer = this.brown; amb.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const ag = this.ambGain = ctx.createGain(); ag.gain.value = 0.16;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13; const lg = ctx.createGain(); lg.gain.value = 0.07; lfo.connect(lg).connect(ag.gain); lfo.start();
    amb.connect(lp).connect(ag).connect(this.master); amb.start();
    const wind = ctx.createBufferSource(); wind.buffer = this.white; wind.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
    const wg = ctx.createGain(); wg.gain.value = 0.012; wind.connect(bp).connect(wg).connect(this.master); wind.start();
    // rain: a bright hiss plus a duller patter; both are muffled under a roof
    const rain = ctx.createBufferSource(); rain.buffer = this.white; rain.loop = true;
    const rhp = ctx.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 1500;
    const rlp = this.rainLP = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 9000;
    const rnG = this.rainGain = ctx.createGain(); rnG.gain.value = 0;
    rain.connect(rhp).connect(rlp).connect(rnG).connect(this.master); rain.start(0, 0.7);
    const pat = ctx.createBufferSource(); pat.buffer = this.brown; pat.loop = true;
    const pbp = ctx.createBiquadFilter(); pbp.type = 'bandpass'; pbp.frequency.value = 480; pbp.Q.value = 0.5;
    const pg = this.patterGain = ctx.createGain(); pg.gain.value = 0; pat.connect(pbp).connect(pg).connect(this.master); pat.start(0, 1.3);
    this.setWeather(this.rain || 0);
  }
  /** Rain intensity 0..1 for the current level. */
  setWeather(rain) { this.rain = rain; this.shelter = this.shelter || 0; if (this.rainGain) this.applyRain(); }
  /** 1 = under a roof (rain is muffled and drums on the sheeting), 0 = out in the open. Smoothed. */
  setShelter(target, dt) {
    if (!this.rainGain || !this.rain) return;
    const next = this.shelter + (target - this.shelter) * Math.min(1, dt * 3);
    if (Math.abs(next - this.shelter) < 0.002) return;
    this.shelter = next; this.applyRain();
  }
  applyRain() {
    const t = this.ctx.currentTime, r = this.rain, sh = this.shelter;
    this.rainGain.gain.setTargetAtTime(r * 0.05 * (1 - sh * 0.55), t, 0.1); this.rainLP.frequency.setTargetAtTime(9000 - sh * 7200, t, 0.1);
    this.patterGain.gain.setTargetAtTime(r * (0.16 + sh * 0.3), t, 0.1);
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setListener(pos, fwd) {
    const c = this.ctx; if (!c) return; const l = c.listener;
    if (l.positionX) { l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z; l.forwardX.value = fwd.x; l.forwardY.value = fwd.y; l.forwardZ.value = fwd.z; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
    else { l.setPosition(pos.x, pos.y, pos.z); l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0); }
  }
  /** Output node for a one-shot: direct (2D) or spatialised at pos [x,y,z]. */
  out(pos, gain = 1, wet = 0) {
    const c = this.ctx, g = c.createGain(); g.gain.value = gain;
    let tail = g;
    if (pos) {
      const p = c.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 4; p.rolloffFactor = 1.1; p.maxDistance = 300;
      p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2];
      g.connect(p); tail = p;
    }
    tail.connect(this.master);
    if (wet) { const w = c.createGain(); w.gain.value = wet; tail.connect(w).connect(this.reverb); }
    return g;
  }
  noise(dest, t, dur, { type = 'bandpass', f = 1000, f2 = null, q = 1, gain = 1, attack = 0.001, buf = null } = {}) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = buf || this.white; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  tone(dest, t, dur, { f = 440, f2 = null, gain = 1, type = 'sine', attack = 0.001 } = {}) {
    const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }

  shot(weapon, pos = null) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const far = !!pos, d = this.out(pos, far ? 1.5 : 0.85, far ? 0.9 : 0.5);
    if (weapon === 'marksman') {
      this.noise(d, t, 0.5, { type: 'lowpass', f: 5200, f2: 260, gain: 1.5 });
      this.tone(d, t, 0.34, { f: 150, f2: 34, gain: 1.6 });
      this.noise(d, t, 0.06, { type: 'highpass', f: 2500, gain: 0.9 });
    } else if (weapon === 'pistol') {
      this.noise(d, t, 0.16, { type: 'lowpass', f: 7000, f2: 700, gain: 1.0 });
      this.tone(d, t, 0.11, { f: 300, f2: 80, gain: 0.8 });
      this.noise(d, t, 0.03, { type: 'highpass', f: 3500, gain: 0.7 });
    } else {
      this.noise(d, t, 0.2, { type: 'lowpass', f: 6200, f2: 480, gain: 1.05 });
      this.tone(d, t, 0.14, { f: 210, f2: 52, gain: 1.0 });
      this.noise(d, t, 0.035, { type: 'highpass', f: 3000, gain: 0.75 });
      this.noise(d, t + 0.02, 0.07, { type: 'bandpass', f: 2400, q: 6, gain: 0.25 });   // action clatter
    }
  }
  /** Weapon handling foley. Each kind is a few layered noise bursts / pitched pings: [type, offset s, duration s, options]. */
  click(kind = 'mag', delay = 0) {
    if (!this.ctx) return;
    const R = GameAudio.FOLEY || (GameAudio.FOLEY = {
      // generic (kept for older call sites)
      mag: [['n', 0, 0.045, { f: 1800, q: 5 }], ['t', 0, 0.03, { f: 900, f2: 540, gain: 0.3, type: 'square' }]],
      bolt: [['n', 0, 0.045, { f: 2600, q: 5 }], ['t', 0, 0.03, { f: 1300, f2: 780, gain: 0.3, type: 'square' }]],
      dry: [['n', 0, 0.03, { f: 3400, q: 6 }], ['t', 0, 0.025, { f: 1700, f2: 1100, gain: 0.25, type: 'square' }]],
      slide: [['n', 0, 0.09, { f: 1300, f2: 700, q: 2, gain: 0.7, attack: 0.02 }], ['n', 0.07, 0.04, { f: 2200, q: 5, gain: 0.6 }]],
      // magazine out: catch click, then polymer sliding on metal
      magout: [['n', 0, 0.025, { f: 3100, q: 7, gain: 0.9 }], ['t', 0, 0.02, { f: 1500, f2: 900, gain: 0.25, type: 'square' }], ['n', 0.03, 0.13, { f: 900, f2: 420, q: 1.2, gain: 0.55, attack: 0.03 }], ['n', 0.14, 0.03, { f: 1500, q: 4, gain: 0.35 }]],
      // magazine in: slide up, hard seat, catch
      magin: [['n', 0, 0.09, { f: 520, f2: 1100, q: 1.2, gain: 0.45, attack: 0.04 }], ['n', 0.085, 0.05, { type: 'lowpass', f: 2400, f2: 500, gain: 1.1 }], ['t', 0.085, 0.07, { f: 190, f2: 90, gain: 0.7 }], ['n', 0.1, 0.03, { f: 3300, q: 8, gain: 0.8 }], ['t', 0.1, 0.02, { f: 2100, f2: 1500, gain: 0.2, type: 'square' }]],
      // palm against the magazine floor plate
      tap: [['n', 0, 0.05, { type: 'lowpass', f: 900, f2: 250, gain: 0.8 }], ['t', 0, 0.06, { f: 150, f2: 80, gain: 0.5 }], ['n', 0.004, 0.02, { f: 2400, q: 4, gain: 0.25 }]],
      // charging handle / bolt carrier drawn back against the spring
      boltback: [['n', 0, 0.11, { f: 1500, f2: 800, q: 2.5, gain: 0.75, attack: 0.015 }], ['n', 0.1, 0.03, { f: 2900, q: 7, gain: 0.8 }], ['t', 0.1, 0.03, { f: 1250, f2: 800, gain: 0.25, type: 'square' }]],
      // ... and slamming home into battery
      boltfwd: [['n', 0, 0.035, { f: 1900, f2: 2600, q: 3, gain: 0.5, attack: 0.008 }], ['n', 0.03, 0.06, { type: 'lowpass', f: 4200, f2: 700, gain: 1.25 }], ['t', 0.03, 0.08, { f: 260, f2: 110, gain: 0.75 }], ['t', 0.03, 0.12, { f: 2350, f2: 2250, gain: 0.12 }], ['n', 0.036, 0.02, { type: 'highpass', f: 5000, gain: 0.5 }]],
      // turn-bolt rifle
      boltup: [['n', 0, 0.03, { f: 2500, q: 6, gain: 0.85 }], ['t', 0, 0.035, { f: 980, f2: 700, gain: 0.3, type: 'square' }], ['n', 0.02, 0.05, { f: 1200, q: 2, gain: 0.3 }]],
      boltdown: [['n', 0, 0.04, { type: 'lowpass', f: 3000, f2: 600, gain: 1.0 }], ['t', 0, 0.06, { f: 230, f2: 120, gain: 0.55 }], ['n', 0.006, 0.02, { f: 3000, q: 7, gain: 0.6 }]],
      // single cartridge thumbed into the magazine
      round: [['n', 0, 0.02, { f: 3600, q: 8, gain: 0.7 }], ['t', 0, 0.05, { f: 2900, f2: 2500, gain: 0.14 }], ['n', 0.015, 0.05, { f: 1000, f2: 600, q: 2, gain: 0.4 }], ['n', 0.06, 0.02, { f: 2100, q: 6, gain: 0.5 }]],
      // pistol slide
      slideback: [['n', 0, 0.08, { f: 1700, f2: 950, q: 2.5, gain: 0.7, attack: 0.012 }], ['n', 0.075, 0.025, { f: 3200, q: 7, gain: 0.7 }]],
      slidefwd: [['n', 0, 0.025, { f: 2200, f2: 3000, q: 3, gain: 0.45, attack: 0.006 }], ['n', 0.022, 0.05, { type: 'lowpass', f: 5000, f2: 900, gain: 1.1 }], ['t', 0.022, 0.06, { f: 330, f2: 150, gain: 0.55 }], ['n', 0.028, 0.018, { type: 'highpass', f: 5200, gain: 0.45 }]],
      // cloth + sling rustle when a weapon comes up
      draw: [['n', 0, 0.16, { f: 700, f2: 1500, q: 0.8, gain: 0.35, attack: 0.06 }], ['n', 0.12, 0.03, { f: 2000, q: 5, gain: 0.4 }]],
    });
    const t = this.ctx.currentTime + delay, d = this.out(null, 0.5);
    for (const [type, at, dur, o] of R[kind] || R.mag) {
      if (type === 'n') this.noise(d, t + at, dur, { type: 'bandpass', gain: 1, ...o });
      else this.tone(d, t + at, dur, o);
    }
  }
  step(surf = 'concrete', pos = null, gain = 1) {
    if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(pos, (pos ? 0.9 : 0.34) * gain);
    if (surf === 'metal') { this.noise(d, t, 0.09, { type: 'bandpass', f: 900 + Math.random() * 300, q: 3, gain: 1 }); this.tone(d, t, 0.14, { f: 190 + Math.random() * 40, f2: 150, gain: 0.5 }); }
    else if (surf === 'wood') { this.noise(d, t, 0.08, { type: 'lowpass', f: 700, gain: 1 }); this.tone(d, t, 0.09, { f: 120 + Math.random() * 30, f2: 80, gain: 0.8 }); }
    else { this.noise(d, t, 0.07, { type: 'lowpass', f: 1100 + Math.random() * 500, f2: 300, gain: 1 }); this.noise(d, t, 0.03, { type: 'highpass', f: 3000, gain: 0.12 }); }
  }
  impact(surf, pos) {
    if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(pos, 0.8, 0.2);
    if (surf === 'metal') { this.tone(d, t, 0.22, { f: 1800 + Math.random() * 2400, gain: 0.5 }); this.noise(d, t, 0.05, { type: 'highpass', f: 4000, gain: 0.8 }); }
    else if (surf === 'flesh') { this.noise(d, t, 0.09, { type: 'lowpass', f: 900, f2: 200, gain: 1.2 }); }
    else if (surf === 'wood') { this.noise(d, t, 0.07, { type: 'bandpass', f: 900, q: 2, gain: 1 }); }
    else if (surf === 'water') { this.noise(d, t, 0.25, { type: 'bandpass', f: 1600, f2: 500, q: 1, gain: 0.8 }); }
    else { this.noise(d, t, 0.08, { type: 'bandpass', f: 2600, f2: 900, q: 1, gain: 1 }); }
  }
  whiz(pos) { if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(pos, 0.7); this.noise(d, t, 0.14, { type: 'bandpass', f: 4200, f2: 1200, q: 8, gain: 1, attack: 0.02 }); }
  ui(kind) {
    if (!this.ctx) return; const t = this.ctx.currentTime, d = this.out(null, 0.35);
    if (kind === 'hit') this.tone(d, t, 0.05, { f: 1500, f2: 1100, gain: 0.7, type: 'triangle' });
    else if (kind === 'head') { this.tone(d, t, 0.07, { f: 2300, f2: 1700, gain: 0.8, type: 'triangle' }); }
    else if (kind === 'kill') { this.tone(d, t, 0.08, { f: 880, gain: 0.7, type: 'triangle' }); this.tone(d, t + 0.07, 0.16, { f: 1320, gain: 0.7, type: 'triangle' }); }
    else if (kind === 'hurt') { this.tone(d, t, 0.18, { f: 110, f2: 60, gain: 1.4 }); this.noise(d, t, 0.1, { type: 'lowpass', f: 500, gain: 0.9 }); }
    else if (kind === 'pickup') { this.tone(d, t, 0.07, { f: 660, gain: 0.5, type: 'triangle' }); this.tone(d, t + 0.06, 0.1, { f: 990, gain: 0.5, type: 'triangle' }); this.click('mag', 0.02); }
    else if (kind === 'objective') { this.tone(d, t, 0.14, { f: 523, gain: 0.5, type: 'triangle' }); this.tone(d, t + 0.12, 0.14, { f: 659, gain: 0.5, type: 'triangle' }); this.tone(d, t + 0.24, 0.3, { f: 784, gain: 0.5, type: 'triangle' }); }
    else if (kind === 'radio') { this.noise(d, t, 0.09, { type: 'bandpass', f: 2200, q: 3, gain: 0.5 }); this.tone(d, t + 0.02, 0.05, { f: 1200, gain: 0.3, type: 'square' }); }
    else if (kind === 'death') { this.tone(d, t, 0.6, { f: 220, f2: 40, gain: 1.0, type: 'sawtooth' }); }
    else this.tone(d, t, 0.04, { f: 900, gain: 0.4, type: 'triangle' });
  }
}
