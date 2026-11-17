// Grid navigation built automatically from a level's collision world (ground layer).
import { PLAYER } from './collision.js';

export class NavGrid {
  constructor(world, bounds, cell = 0.5) {
    this.cell = cell;
    this.minX = bounds.minX; this.minZ = bounds.minZ;
    this.w = Math.ceil((bounds.maxX - bounds.minX) / cell);
    this.h = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
    this.ok = new Uint8Array(this.w * this.h);
    this.open = [];
    const groundY = bounds.groundY || 0;
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const x = this.minX + (i + 0.5) * cell, z = this.minZ + (j + 0.5) * cell;
      const f = world.floorAt(x, groundY + 0.6, z, 1.0);
      if (f === null || Math.abs(f - groundY) > 0.3) continue;
      if (world.blocked(x, f, z, PLAYER.height, PLAYER.radius + 0.12, PLAYER.step + 0.02)) continue;
      this.ok[j * this.w + i] = 1;
    }
    // keep only the largest connected region so bots never target unreachable pockets
    const comp = new Int32Array(this.w * this.h).fill(-1);
    let bestC = -1, bestN = 0, c = 0;
    for (let s = 0; s < comp.length; s++) {
      if (!this.ok[s] || comp[s] >= 0) continue;
      let n = 0; const stack = [s]; comp[s] = c;
      while (stack.length) {
        const k = stack.pop(); n++;
        const i = k % this.w, j = (k / this.w) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const a = i + di, b = j + dj;
          if (a < 0 || b < 0 || a >= this.w || b >= this.h) continue;
          const q = b * this.w + a;
          if (this.ok[q] && comp[q] < 0) { comp[q] = c; stack.push(q); }
        }
      }
      if (n > bestN) { bestN = n; bestC = c; }
      c++;
    }
    for (let s = 0; s < comp.length; s++) { if (comp[s] !== bestC) this.ok[s] = 0; else this.open.push(s); }
    this.g = new Float32Array(this.w * this.h);
    this.from = new Int32Array(this.w * this.h);
    this.mark = new Uint32Array(this.w * this.h);
    this.stamp = 0;
  }
  ci(x) { return Math.floor((x - this.minX) / this.cell); }
  cj(z) { return Math.floor((z - this.minZ) / this.cell); }
  walkable(x, z) {
    const i = this.ci(x), j = this.cj(z);
    return i >= 0 && j >= 0 && i < this.w && j < this.h && this.ok[j * this.w + i] === 1;
  }
  center(k) { return { x: this.minX + ((k % this.w) + 0.5) * this.cell, z: this.minZ + (((k / this.w) | 0) + 0.5) * this.cell }; }
  randomPoint() { return this.center(this.open[(Math.random() * this.open.length) | 0]); }
  nearest(x, z) {
    const i0 = this.ci(x), j0 = this.cj(z);
    for (let r = 0; r < 40; r++) {
      let best = -1, bd = 1e9;
      for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
        if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r) continue;
        if (i < 0 || j < 0 || i >= this.w || j >= this.h || !this.ok[j * this.w + i]) continue;
        const d = (i - i0) ** 2 + (j - j0) ** 2;
        if (d < bd) { bd = d; best = j * this.w + i; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }
  /** Straight walkable line between two points (grid supersampling). */
  clear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / (this.cell * 0.5));
    for (let s = 0; s <= n; s++) {
      const t = n ? s / n : 0;
      if (!this.walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }
  /** A* path; returns [{x,z}...] (smoothed) or null. */
  path(ax, az, bx, bz) {
    const s = this.nearest(ax, az), e = this.nearest(bx, bz);
    if (s < 0 || e < 0) return null;
    if (s === e) return [{ x: bx, z: bz }];
    const w = this.w, stamp = ++this.stamp, g = this.g, from = this.from, mark = this.mark;
    const ei = e % w, ej = (e / w) | 0;
    const heap = [], hf = [];
    const push = (k, f) => {
      let i = heap.length; heap.push(k); hf.push(f);
      while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= f) break; heap[i] = heap[p]; hf[i] = hf[p]; i = p; }
      heap[i] = k; hf[i] = f;
    };
    const pop = () => {
      const top = heap[0], lk = heap.pop(), lf = hf.pop(), n = heap.length;
      if (n) {
        let i = 0;
        for (;;) {
          let c = i * 2 + 1; if (c >= n) break;
          if (c + 1 < n && hf[c + 1] < hf[c]) c++;
          if (hf[c] >= lf) break;
          heap[i] = heap[c]; hf[i] = hf[c]; i = c;
        }
        heap[i] = lk; hf[i] = lf;
      }
      return top;
    };
    const hcost = (k) => { const dx = Math.abs((k % w) - ei), dz = Math.abs(((k / w) | 0) - ej); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    g[s] = 0; mark[s] = stamp; from[s] = -1; push(s, hcost(s));
    let found = false, guard = 0;
    while (heap.length && guard++ < 60000) {
      const k = pop();
      if (k === e) { found = true; break; }
      const i = k % w, j = (k / w) | 0, gk = g[k];
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= w || b >= this.h) continue;
        const q = b * w + a;
        if (!this.ok[q]) continue;
        if (di && dj && (!this.ok[j * w + a] || !this.ok[b * w + i])) continue;
        const ng = gk + (di && dj ? 1.414 : 1);
        if (mark[q] === stamp && g[q] <= ng) continue;
        g[q] = ng; mark[q] = stamp; from[q] = k; push(q, ng + hcost(q));
      }
    }
    if (!found) return null;
    const raw = [];
    for (let k = e; k !== -1; k = from[k]) raw.push(this.center(k));
    raw.reverse();
    // string pulling
    const out = []; let cur = { x: ax, z: az }, i = 0;
    if (!this.walkable(ax, az)) { cur = raw[0]; out.push(raw[0]); }
    while (i < raw.length - 1) {
      let j = raw.length - 1;
      while (j > i + 1 && !this.clear(cur.x, cur.z, raw[j].x, raw[j].z)) j--;
      out.push(raw[j]); cur = raw[j]; i = j;
    }
    if (!out.length) out.push(raw[raw.length - 1]);
    return out;
  }
}
