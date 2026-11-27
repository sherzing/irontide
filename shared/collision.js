// Analytic collision world shared by client, bots and the server.
// Everything solid in a level is a box that may be rotated around Y.
export const PLAYER = { radius: 0.38, height: 1.8, crouchHeight: 1.25, eye: 1.62, crouchEye: 1.05, step: 0.5 };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const CELL = 8, PAD = 1;      // broadphase cell size and the widest query one cell answers, metres

export class World {
  /** boxes: [{c:[x,y,z], h:[hx,hy,hz], yaw, surf, solid, bullet, sight}] (c = centre, h = half extents) */
  constructor(boxes, killY = -1.2) {
    this.killY = killY;
    this.boxes = boxes.map((b, i) => {
      const yaw = b.yaw || 0;
      return {
        i, cx: b.c[0], cy: b.c[1], cz: b.c[2], hx: b.h[0], hy: b.h[1], hz: b.h[2],
        cos: Math.cos(yaw), sin: Math.sin(yaw), br: Math.hypot(b.h[0], b.h[2]),
        minY: b.c[1] - b.h[1], maxY: b.c[1] + b.h[1],
        surf: b.surf || 'concrete',
        solid: b.solid !== false, bullet: b.bullet !== false, sight: b.sight !== false, q: 0,
      };
    });
    this.stamp = 0;
    this.buildGrid();
  }

  /**
   * Broadphase: a uniform grid over x/z. Every box is listed in each cell its footprint touches, grown by PAD, so a
   * query no wider than PAD only has to look at the one cell it stands in. Keeps large levels as cheap as small ones.
   */
  buildGrid() {
    this.grid = null;
    if (!this.boxes.length) return;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const b of this.boxes) {
      b.ex = Math.abs(b.hx * b.cos) + Math.abs(b.hz * b.sin); b.ez = Math.abs(b.hx * b.sin) + Math.abs(b.hz * b.cos);
      x0 = Math.min(x0, b.cx - b.ex); x1 = Math.max(x1, b.cx + b.ex); z0 = Math.min(z0, b.cz - b.ez); z1 = Math.max(z1, b.cz + b.ez);
    }
    x0 -= PAD; z0 -= PAD; x1 += PAD; z1 += PAD;
    const nx = Math.max(1, Math.ceil((x1 - x0) / CELL)), nz = Math.max(1, Math.ceil((z1 - z0) / CELL));
    const cells = Array.from({ length: nx * nz }, () => []);
    for (const b of this.boxes) {
      const i0 = Math.max(0, Math.floor((b.cx - b.ex - PAD - x0) / CELL)), i1 = Math.min(nx - 1, Math.floor((b.cx + b.ex + PAD - x0) / CELL));
      const j0 = Math.max(0, Math.floor((b.cz - b.ez - PAD - z0) / CELL)), j1 = Math.min(nz - 1, Math.floor((b.cz + b.ez + PAD - z0) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cells[j * nx + i].push(b);
    }
    this.grid = { x0, z0, x1: x0 + nx * CELL, z1: z0 + nz * CELL, nx, nz, cells };
  }
  /** The boxes that can touch a vertical cylinder of the given radius standing at (x, z). */
  near(x, z, radius = 0) {
    const g = this.grid;
    if (!g || radius > PAD) return this.boxes;
    const i = Math.max(0, Math.min(g.nx - 1, Math.floor((x - g.x0) / CELL))), j = Math.max(0, Math.min(g.nz - 1, Math.floor((z - g.z0) / CELL)));
    return g.cells[j * g.nx + i];
  }

  /** Moves a vertical cylinder (feet at p). Mutates p and v. Returns {grounded, surf}. */
  moveCharacter(p, v, dt, height, wasGrounded, radius = PLAYER.radius) {
    const R = radius, R2 = R * R;
    let grounded = false, surf = null;
    const dist = Math.hypot(v.x, v.y, v.z) * dt;
    const steps = Math.max(1, Math.min(8, Math.ceil(dist / 0.2)));
    const sdt = dt / steps;
    for (let s = 0; s < steps; s++) {
      p.x += v.x * sdt; p.y += v.y * sdt; p.z += v.z * sdt;
      const list = this.near(p.x, p.z, R);
      for (let iter = 0; iter < 2; iter++) {
        for (const b of list) {
          if (!b.solid) continue;
          if (p.y >= b.maxY || p.y + height <= b.minY) continue;
          const dx = p.x - b.cx, dz = p.z - b.cz;
          const reach = b.br + R;
          if (dx > reach || dx < -reach || dz > reach || dz < -reach) continue;
          let lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos;
          const qx = clamp(lx, -b.hx, b.hx), qz = clamp(lz, -b.hz, b.hz);
          const ex = lx - qx, ez = lz - qz, d2 = ex * ex + ez * ez;
          if (d2 >= R2) continue;
          const top = b.maxY - p.y;
          const allow = ((wasGrounded || grounded) ? PLAYER.step : 0.12) + Math.max(0, -v.y * sdt) + 0.02;
          if (v.y <= 0.01 && top <= allow) {            // land on / step onto
            p.y = b.maxY; v.y = 0; grounded = true; surf = b.surf; continue;
          }
          if (v.y > 0 && p.y + height - b.minY < 0.35) { // head bump
            p.y = b.minY - height; v.y = 0; continue;
          }
          let nx, nz;
          if (d2 < 1e-10) {                               // centre inside footprint
            const px = b.hx - Math.abs(lx), pz = b.hz - Math.abs(lz);
            if (px < pz) { nx = lx < 0 ? -1 : 1; nz = 0; lx = nx * (b.hx + R); }
            else { nz = lz < 0 ? -1 : 1; nx = 0; lz = nz * (b.hz + R); }
          } else {
            const d = Math.sqrt(d2); nx = ex / d; nz = ez / d;
            lx = qx + nx * R; lz = qz + nz * R;
          }
          p.x = b.cx + lx * b.cos + lz * b.sin;
          p.z = b.cz - lx * b.sin + lz * b.cos;
          const wnx = nx * b.cos + nz * b.sin, wnz = -nx * b.sin + nz * b.cos;
          const vn = v.x * wnx + v.z * wnz;
          if (vn < 0) { v.x -= vn * wnx; v.z -= vn * wnz; }
        }
      }
    }
    return { grounded, surf };
  }

  /** True if a standing cylinder at p would intersect something solid (ignores floors below `lift`). */
  blocked(x, y, z, height, radius = PLAYER.radius, lift = 0.05) {
    const R2 = radius * radius;
    for (const b of this.near(x, z, radius)) {
      if (!b.solid) continue;
      if (y + lift >= b.maxY || y + height <= b.minY) continue;
      const dx = x - b.cx, dz = z - b.cz, reach = b.br + radius;
      if (dx > reach || dx < -reach || dz > reach || dz < -reach) continue;
      const lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos;
      const ex = lx - clamp(lx, -b.hx, b.hx), ez = lz - clamp(lz, -b.hz, b.hz);
      if (ex * ex + ez * ez < R2) return true;
    }
    return false;
  }

  /** Ray vs world. kind: 'bullet' | 'sight' | 'solid'. Returns {t,nx,ny,nz,surf} or null. */
  raycast(ox, oy, oz, dx, dy, dz, maxT = 1e9, kind = 'bullet') {
    const hit = { t: -1, nx: 0, ny: 0, nz: 0, surf: null }, g = this.grid, stamp = ++this.stamp;
    if (!g) { this.rayList(this.boxes, ox, oy, oz, dx, dy, dz, maxT, kind, hit, stamp); return hit.t < 0 ? null : hit; }
    // clip the ray to the grid, then walk the cells it crosses, nearest first
    let t0 = 0, t1 = maxT;
    if (Math.abs(dx) < 1e-9) { if (ox < g.x0 || ox > g.x1) return null; }
    else { const inv = 1 / dx, a = (g.x0 - ox) * inv, c = (g.x1 - ox) * inv; t0 = Math.max(t0, Math.min(a, c)); t1 = Math.min(t1, Math.max(a, c)); }
    if (Math.abs(dz) < 1e-9) { if (oz < g.z0 || oz > g.z1) return null; }
    else { const inv = 1 / dz, a = (g.z0 - oz) * inv, c = (g.z1 - oz) * inv; t0 = Math.max(t0, Math.min(a, c)); t1 = Math.min(t1, Math.max(a, c)); }
    if (t0 > t1) return null;
    const sx = ox + dx * t0, sz = oz + dz * t0;
    let i = Math.max(0, Math.min(g.nx - 1, Math.floor((sx - g.x0) / CELL))), j = Math.max(0, Math.min(g.nz - 1, Math.floor((sz - g.z0) / CELL)));
    const stepI = dx > 0 ? 1 : -1, stepJ = dz > 0 ? 1 : -1;
    const dtx = Math.abs(dx) < 1e-9 ? Infinity : CELL / Math.abs(dx), dtz = Math.abs(dz) < 1e-9 ? Infinity : CELL / Math.abs(dz);
    let tx = dtx === Infinity ? Infinity : ((g.x0 + (i + (dx > 0 ? 1 : 0)) * CELL) - ox) / dx, tz = dtz === Infinity ? Infinity : ((g.z0 + (j + (dz > 0 ? 1 : 0)) * CELL) - oz) / dz;
    let best = maxT;
    for (;;) {
      best = this.rayList(g.cells[j * g.nx + i], ox, oy, oz, dx, dy, dz, best, kind, hit, stamp);
      const leave = Math.min(tx, tz);
      if (best <= leave || leave > t1) break;                       // nothing in a later cell can be nearer
      if (tx < tz) { i += stepI; tx += dtx; if (i < 0 || i >= g.nx) break; } else { j += stepJ; tz += dtz; if (j < 0 || j >= g.nz) break; }
    }
    return hit.t < 0 ? null : hit;
  }
  /** Tests the ray against a list of boxes; fills `hit` and returns the nearest distance found so far. */
  rayList(list, ox, oy, oz, dx, dy, dz, best, kind, hit, stamp) {
    for (const b of list) {
      if (!b[kind] || b.q === stamp) continue;
      b.q = stamp;
      const rx = ox - b.cx, rz = oz - b.cz;
      const lox = rx * b.cos - rz * b.sin, loz = rx * b.sin + rz * b.cos, loy = oy - b.cy;
      const ldx = dx * b.cos - dz * b.sin, ldz = dx * b.sin + dz * b.cos;
      let t0 = 0, t1 = best, axis = -1, sign = 0;
      // X slab
      if (Math.abs(ldx) < 1e-9) { if (lox < -b.hx || lox > b.hx) continue; }
      else {
        const inv = 1 / ldx; let a = (-b.hx - lox) * inv, c = (b.hx - lox) * inv, sg = -1;
        if (a > c) { const t = a; a = c; c = t; sg = 1; }
        if (a > t0) { t0 = a; axis = 0; sign = sg; }
        if (c < t1) t1 = c;
        if (t0 > t1) continue;
      }
      if (Math.abs(dy) < 1e-9) { if (loy < -b.hy || loy > b.hy) continue; }
      else {
        const inv = 1 / dy; let a = (-b.hy - loy) * inv, c = (b.hy - loy) * inv, sg = -1;
        if (a > c) { const t = a; a = c; c = t; sg = 1; }
        if (a > t0) { t0 = a; axis = 1; sign = sg; }
        if (c < t1) t1 = c;
        if (t0 > t1) continue;
      }
      if (Math.abs(ldz) < 1e-9) { if (loz < -b.hz || loz > b.hz) continue; }
      else {
        const inv = 1 / ldz; let a = (-b.hz - loz) * inv, c = (b.hz - loz) * inv, sg = -1;
        if (a > c) { const t = a; a = c; c = t; sg = 1; }
        if (a > t0) { t0 = a; axis = 2; sign = sg; }
        if (c < t1) t1 = c;
        if (t0 > t1) continue;
      }
      if (axis < 0) continue; // origin inside the box
      best = t0; hit.t = t0; hit.surf = b.surf;
      if (axis === 1) { hit.nx = 0; hit.ny = sign; hit.nz = 0; }
      else {
        const lnx = axis === 0 ? sign : 0, lnz = axis === 2 ? sign : 0;
        hit.nx = lnx * b.cos + lnz * b.sin; hit.ny = 0; hit.nz = -lnx * b.sin + lnz * b.cos;
      }
    }
    return best;
  }

  /** Line of sight between two points. */
  los(ax, ay, az, bx, by, bz, kind = 'sight') {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-4) return true;
    return !this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d - 0.02, kind);
  }

  /** Height of the walkable floor under (x,z) looking down from y, or null. */
  floorAt(x, y, z, maxDrop = 3) {
    const h = this.raycast(x, y, z, 0, -1, 0, maxDrop, 'solid');
    return h ? y - h.t : null;
  }
}

// ---- character hit volumes -------------------------------------------------------------------
/** Ray (unit direction) vs sphere: the distance to the hit (0 from inside), or -1. */
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const mx = ox - cx, my = oy - cy, mz = oz - cz;
  const b = mx * dx + my * dy + mz * dz, c = mx * mx + my * my + mz * mz - r * r;
  if (c > 0 && b > 0) return -1;
  const disc = b * b - c;
  if (disc < 0) return -1;
  return Math.max(0, -b - Math.sqrt(disc));
}
/** Ray (unit direction) vs a capsule: every point within r of the segment a-b. Returns the distance to the hit, or -1. */
export function rayCapsule(ox, oy, oz, dx, dy, dz, ax, ay, az, bx, by, bz, r) {
  let nx = bx - ax, ny = by - ay, nz = bz - az; const len = Math.hypot(nx, ny, nz);
  let best = raySphere(ox, oy, oz, dx, dy, dz, ax, ay, az, r);
  if (len < 1e-6) return best;
  const t1 = raySphere(ox, oy, oz, dx, dy, dz, bx, by, bz, r);
  if (t1 >= 0 && (best < 0 || t1 < best)) best = t1;
  nx /= len; ny /= len; nz /= len;
  const mx = ox - ax, my = oy - ay, mz = oz - az, mn = mx * nx + my * ny + mz * nz, dn = dx * nx + dy * ny + dz * nz;
  const a = 1 - dn * dn, b = mx * dx + my * dy + mz * dz - mn * dn, c = mx * mx + my * my + mz * mz - mn * mn - r * r;      // the side: distance to the axis = r
  if (c <= 0) { if (mn >= 0 && mn <= len) return 0; }                                                                        // the ray starts inside it
  else if (a > 1e-9 && b < 0) {
    const disc = b * b - a * c;
    if (disc >= 0) { const t = (-b - Math.sqrt(disc)) / a, along = mn + t * dn; if (along >= 0 && along <= len && (best < 0 || t < best)) best = t; }
  }
  return best;
}
export const CROUCH_SCALE = 0.74;      // a crouching soldier is this much shorter: the model is squashed by it, and so are the volumes

/**
 * Leaning (Q and E). At a full lean the head is `reach` m to the side and the view is tilted by `roll` radians; getting
 * there takes `time` s; the head stays `pad` m off whatever is beside it. The soldier the others see puts his head there
 * (LEAN_POSE in client/src/characters.js). `drop` (m the head comes down) and `chest` and `hips` (how much of the head's
 * way those go) are read off that pose: `node scripts/aim-lab.mjs lean out.jpg` shows it and checks the head.
 */
export const LEAN = { reach: 0.4, drop: 0.07, roll: 0.15, time: 0.2, pad: 0.15, chest: 0.7, hips: 0.5 };
/** A lean as part of a soldier's state flags: bits 5-7 hold how far (sevenths of the full reach), bit 8 is set for the right. */
export const leanBits = (k) => { const n = Math.min(7, Math.round(Math.abs(k) * 7)); return n ? (n << 5) | (k > 0 ? 256 : 0) : 0; };
/** The lean in those flags: -1 (all the way left) to 1 (all the way right). */
export const leanOf = (flags) => ((flags >> 5) & 7) / 7 * (flags & 256 ? 1 : -1);
/**
 * The slide: a crouch pressed in a sprint. The player goes on the way they were running, low and fast, and can shoot.
 * It starts at `speed` m/s and falls evenly to `end` m/s over `time` s (4.5 m of floor); `rest` s pass before the next;
 * the view is `eye` m above the feet. The soldier the others see has his head there (SLIDE_POSE in
 * client/src/characters.js): `node scripts/aim-lab.mjs slide out.jpg` shows it and checks the head.
 */
export const SLIDE = { speed: 8, end: 3.2, time: 0.8, rest: 1, eye: 0.8 };
/** Sliding, as part of a soldier's state flags (bit 9). The crouch bit is set with it: to bots and to the server a slider is a crouching player. */
export const SLIDING = 512;
const UPRIGHT = [0, 0];
/** How far the head of a soldier is to the side of his feet, [x, z] in metres, when he looks along `yaw` with these flags. */
export function leanShift(yaw, flags) {
  if (!(flags & 224)) return UPRIGHT;
  const d = leanOf(flags) * LEAN.reach;
  return [Math.cos(yaw) * d, -Math.sin(yaw) * d];
}

/**
 * Returns {t, zone} for a ray against a character whose feet are at (fx,fy,fz), or null. Three volumes fitted to the
 * soldier model's middle: what bots are shot with. (lx, lz) is how far his head leans to the side (leanShift): the
 * volumes lean with it. A player's own shots are tested against the soldier as he is drawn (client/src/characters.js),
 * arms and stride included.
 */
export function hitCharacter(ox, oy, oz, dx, dy, dz, maxT, fx, fy, fz, crouch, lx = 0, lz = 0) {
  const k = crouch ? CROUCH_SCALE : 1, down = Math.hypot(lx, lz) / LEAN.reach * LEAN.drop * k, c = LEAN.chest, h = LEAN.hips;
  let best = maxT, zone = null;
  let t = raySphere(ox, oy, oz, dx, dy, dz, fx + lx, fy + 1.58 * k - down, fz + lz, 0.14);
  if (t >= 0 && t < best) { best = t; zone = 'head'; }
  t = rayCapsule(ox, oy, oz, dx, dy, dz, fx + lx * h, fy + 1.0 * k, fz + lz * h, fx + lx * c, fy + 1.3 * k - down * c, fz + lz * c, 0.25);
  if (t >= 0 && t < best) { best = t; zone = 'body'; }
  t = rayCapsule(ox, oy, oz, dx, dy, dz, fx, fy + 0.2, fz, fx + lx * h * 0.8, fy + 0.8 * k, fz + lz * h * 0.8, 0.2);
  if (t >= 0 && t < best) { best = t; zone = 'legs'; }
  return zone ? { t: best, zone } : null;
}
