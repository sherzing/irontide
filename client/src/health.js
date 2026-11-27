// What goes oddly on this machine in a multiplayer match, measured and reported to the server every EVERY seconds
// ({ t: 'health', ... }). The server cannot see a player's sound break up, their frames stall or their snapshots arrive
// late; with this it logs them next to what it counts itself (server/index.js).
export const EVERY = 10;      // s between two reports
const SLOW = 100;             // ms: a frame that took longer counts as slow
const WARM = 5000;            // ms after the first frame that are not judged: a level's first frames compile shaders and stall
const DRY = 110;              // ms without a snapshot: by then a soldier on screen has run out of positions to move between (Game.interp)

export class Health {
  constructor(audio) { this.audio = audio; this.snapAt = 0; this.last = 0; this.first = 0; this.begin(performance.now()); }
  begin(now) {
    const c = this.audio.ctx;
    this.t0 = now; this.frames = 0; this.span = 0; this.slow = 0; this.gap = 0; this.dry = 0; this.cut0 = this.audio.cut;
    this.clock = c && c.state === 'running' ? c.currentTime : null;      // the audio clock at the start; null: no sound running to judge
  }
  /** A snapshot arrived. */
  snap(now) {
    const wait = this.snapAt ? now - this.snapAt : 0; this.snapAt = now;
    if (wait > this.gap) this.gap = wait;
    if (wait > DRY) this.dry++;
  }
  /** Once a frame. Returns the report when one is due, otherwise null. */
  frame(now, ping) {
    const ms = this.last ? now - this.last : 0; this.last = now;
    if (ms > 1000) { this.snapAt = 0; this.begin(now); return null; }      // the tab was in the background: nothing to judge
    if (!this.first) this.first = now;
    if (now - this.first < WARM) { this.begin(now); return null; }
    this.frames++; this.span += ms; if (ms > SLOW) this.slow++;
    if (now - this.t0 < EVERY * 1000) return null;
    const c = this.audio.ctx, wall = (now - this.t0) / 1000;
    // sound the audio thread did not get to play shows as its clock falling behind the wall clock
    const snd = this.clock != null && c.state === 'running' ? Math.max(0, wall - (c.currentTime - this.clock)) : 0;
    const report = { t: 'health', snd: Math.round(snd * 1000), fps: Math.round(this.frames / (this.span / 1000 || 1)), slow: this.slow, gap: Math.round(this.gap), dry: this.dry, ping: Math.round(ping || 0), cut: this.audio.cut - this.cut0 };
    this.begin(now);
    return report;
  }
}
