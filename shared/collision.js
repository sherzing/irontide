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
function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const mx = ox - cx, my = oy - cy, mz = oz - cz;
  const b = mx * dx + my * dy + mz * dz, c = mx * mx + my * my + mz * mz - r * r;
  if (c > 0 && b > 0) return -1;
  const disc = b * b - c;
  if (disc < 0) return -1;
  return Math.max(0, -b - Math.sqrt(disc));
}
// Ray vs vertical capsule (segment from y0 to y1 at x,z).
function rayVCapsule(ox, oy, oz, dx, dy, dz, x, z, y0, y1, r) {
  // closest approach between ray and vertical segment (iterative clamp, exact enough for hitscan)
  const hxz = dx * dx + dz * dz;
  let t = hxz > 1e-9 ? ((x - ox) * dx + (z - oz) * dz) / hxz : 0;
  if (t < 0) t = 0;
  let y = clamp(oy + dy * t, y0, y1);
  t = Math.max(0, (x - ox) * dx + (y - oy) * dy + (z - oz) * dz);
  y = clamp(oy + dy * t, y0, y1);
  return raySphere(ox, oy, oz, dx, dy, dz, x, y, z, r);
}
/** Returns {t, zone} for a ray against a character whose feet are at (fx,fy,fz), or null. */
export function hitCharacter(ox, oy, oz, dx, dy, dz, maxT, fx, fy, fz, crouch) {
  const k = crouch ? 0.7 : 1;
  let best = maxT, zone = null;
  let t = raySphere(ox, oy, oz, dx, dy, dz, fx, fy + 1.66 * k, fz, 0.15);
  if (t >= 0 && t < best) { best = t; zone = 'head'; }
  t = rayVCapsule(ox, oy, oz, dx, dy, dz, fx, fz, fy + 1.0 * k, fy + 1.36 * k, 0.25);
  if (t >= 0 && t < best) { best = t; zone = 'body'; }
  t = rayVCapsule(ox, oy, oz, dx, dy, dz, fx, fz, fy + 0.2, fy + 0.8 * k, 0.2);
  if (t >= 0 && t < best) { best = t; zone = 'legs'; }
  return zone ? { t: best, zone } : null;
}
