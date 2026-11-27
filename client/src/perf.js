// Frame-rate readout: what this machine makes of the game. P, the setting or ?perf=1 turns it on.
// It times the gap between frames, so it shows what the screen got, hitches included.
const BARS = 240;                   // frames in the graph; "slowest" is its tallest bar
const TOP = 40;                     // ms at the graph's top edge; a slower frame fills the height
const GOOD = 20, FAIR = 36;         // ms: up to GOOD is fluid (50 a second and more), up to FAIR playable (a steady 30 a second is 33.3), beyond that slow
const INK = { good: '#4fd8c4', fair: '#ffb347', slow: '#ff5a3c', rule: 'rgba(242, 239, 232, 0.24)' };

/** The graphics chip as the browser names it, unwrapped: "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, ...)" gives "Apple M2". */
export function gpuName(gl) {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const raw = String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
  const angle = /^ANGLE \((.*)\)$/.exec(raw), name = angle ? angle[1].split(', ')[1] || angle[1] : raw;
  return name.replace(/^ANGLE Metal Renderer: /, '').replace(/ \(0x[0-9a-f]+\)/i, '').replace(/ (Direct3D|OpenGL).*$/, '').trim() || 'unknown';
}

export class Perf {
  constructor(el, engine) {
    this.el = el; this.engine = engine; this.on = false;
    const $ = (s) => el.querySelector(s);
    this.d = { fps: $('b'), ms: $('.ms'), res: $('.res'), gpu: $('.gpu'), cv: $('canvas') };
    this.ctx = this.d.cv.getContext('2d');
    this.times = new Float32Array(BARS); this.at = 0;         // the last frames' times in ms, a ring
    this.last = 0; this.sum = 0; this.count = 0;              // since the numbers were last written
    addEventListener('resize', () => this.size());
  }
  show(on) {
    if (on === this.on) return;
    this.on = on; this.el.classList.toggle('hidden', !on);
    if (!on) return;
    this.times.fill(0); this.last = this.sum = this.count = 0;
    this.d.fps.textContent = '–'; this.d.ms.textContent = this.d.res.textContent = '';
    this.d.gpu.textContent = this.gpu ??= gpuName(this.engine.renderer.getContext());
    this.size();
  }
  size() {
    const cv = this.d.cv, k = Math.min(devicePixelRatio || 1, 2), W = Math.round(cv.clientWidth * k), H = Math.round(cv.clientHeight * k);
    if (W && H && (cv.width !== W || cv.height !== H)) { cv.width = W; cv.height = H; }
  }
  /** Once per frame, with the time requestAnimationFrame hands over. */
  frame(now) {
    if (!this.on) return;
    const ms = now - this.last, first = !this.last; this.last = now;
    if (first || ms > 1000) return;                           // nothing to compare with, or the tab was in the background
    this.times[this.at] = ms; this.at = (this.at + 1) % BARS;
    this.sum += ms; this.count++;
    if (this.sum >= 500) this.write();
    this.draw();
  }
  write() {
    const e = this.engine, mean = this.sum / this.count, slowest = Math.max(...this.times);
    this.sum = this.count = 0;
    this.d.fps.textContent = Math.round(1000 / mean);
    this.d.ms.textContent = `${mean.toFixed(1)} ms · slowest ${Math.round(slowest)}`;
    this.d.res.textContent = `${e.size.W} × ${e.size.H}${e.dyn < 0.99 ? ` · ${Math.round(e.dyn * 100)}% res` : ''} · ${e.qualityName}`;
    this.d.res.classList.toggle('scaled', e.dyn < 0.99);      // the frame rate is held by drawing fewer pixels
    this.el.classList.toggle('fair', mean > GOOD && mean <= FAIR); this.el.classList.toggle('slow', mean > FAIR);
  }
  draw() {
    const c = this.ctx, W = this.d.cv.width, H = this.d.cv.height, w = W / BARS;
    c.clearRect(0, 0, W, H);
    c.fillStyle = INK.rule; for (const ms of [1000 / 60, 1000 / 30]) c.fillRect(0, Math.round(H * (1 - ms / TOP)), W, 1);      // 60 and 30 a second
    let ink = '';
    for (let i = 0; i < BARS; i++) {
      const ms = this.times[(this.at + i) % BARS]; if (!ms) continue;
      const want = ms > FAIR ? INK.slow : ms > GOOD ? INK.fair : INK.good; if (want !== ink) c.fillStyle = ink = want;
      const h = Math.max(1, Math.min(1, ms / TOP) * H); c.fillRect(Math.floor(i * w), H - h, Math.ceil(w), h);
    }
  }
}
