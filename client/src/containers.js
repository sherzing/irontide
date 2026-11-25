// Shipping containers: one modelled 20 ft box (corrugated walls and roof, corner castings, doors with lock
// rods) drawn with GPU instancing, plus a layered paint / rust / livery shader.
import * as THREE from 'three';
import { CONTAINER, DOOR, openLeaves } from '../../shared/props.js';
import { loadTex, canvasTex, SURF_VERT_PARS, SURF_VERT, SURF_FRAG_PARS, surfUniforms } from './materials.js';

const { L, H, W } = CONTAINER;
const POST = 0.16, HINGE_X = DOOR.hingeX, HINGE_Z = DOOR.hingeZ, LEAF = DOOR.leaf;

// ------------------------------------------------------------------ tiny flat-shaded mesh builder
class Soup {
  constructor() { this.p = []; this.n = []; this.uv = []; this.part = []; this.liv = []; this.idx = []; this.count = 0; }
  /** Quad a,b,c,d counter-clockwise seen from outside. part: 0 paint, 1 galvanised, 2 black, 3 plywood. liv: fn(x,y,z)->[u,v], kind */
  quad(a, b, c, d, part = 0, liv = null, kind = 0) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = Math.hypot(...n) || 1; n = n.map((v) => v / l);
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
    for (const v of [a, b, c, d]) {
      this.p.push(...v); this.n.push(...n);
      if (ay >= ax && ay >= az) this.uv.push(v[0], v[2]); else if (ax >= az) this.uv.push(v[2], v[1]); else this.uv.push(v[0], v[1]);
      this.part.push(part);
      if (liv) { const t = liv(v[0], v[1], v[2]); this.liv.push(t[0], t[1], kind); } else this.liv.push(0, 0, 0);
    }
    const i = this.count; this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3); this.count += 4;
  }
  box(cx, cy, cz, sx, sy, sz, part = 0, liv = null, kind = 0) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], part, liv, kind);     // +x
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], part);                 // -x
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], part);                 // +y
    this.quad([x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], part);                 // -y
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], part);                 // +z
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], part);                 // -z
  }
  /** Vertical cylinder (flat facets are fine at this size). */
  rod(x, z, y0, y1, r, part = 1, seg = 7) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p0 = [x + Math.sin(a0) * r, z + Math.cos(a0) * r], p1 = [x + Math.sin(a1) * r, z + Math.cos(a1) * r];
      this.quad([p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]], part);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aPart', new THREE.Float32BufferAttribute(this.part, 1));
    g.setAttribute('aLiv', new THREE.Float32BufferAttribute(this.liv, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

/** Trapezoid corrugation profile: [t along one pitch 0..1, 0 = outer face / 1 = pressed in]. */
const PROFILE = [[0, 0], [0.27, 0], [0.5, 1], [0.77, 1]];
function profile(a, b, n) {
  const pts = [], pitch = (b - a) / n;
  for (let i = 0; i < n; i++) for (const [t, d] of PROFILE) pts.push([a + (i + t) * pitch, d]);
  pts.push([b, 0]);
  return pts;
}

function buildShell() {
  const m = new Soup();
  // corner posts and castings
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    m.box(sx * (L / 2 - POST / 2), H / 2, sz * (W / 2 - POST / 2), POST, H - 0.236, POST);
    for (const y of [0.059, H - 0.059]) {
      const cx = sx * (L / 2 - 0.089), cz = sz * (W / 2 - 0.081);
      m.box(cx, y, cz, 0.182, 0.118, 0.166);
      // the oval lifting apertures read as dark insets
      const ex = sx * (L / 2 + 0.002), ez = sz * (W / 2 + 0.002);
      if (sx > 0) m.quad([ex, y - 0.03, cz + 0.04], [ex, y - 0.03, cz - 0.04], [ex, y + 0.03, cz - 0.04], [ex, y + 0.03, cz + 0.04], 2);
      else m.quad([ex, y - 0.03, cz - 0.04], [ex, y - 0.03, cz + 0.04], [ex, y + 0.03, cz + 0.04], [ex, y + 0.03, cz - 0.04], 2);
      if (sz > 0) m.quad([cx - 0.045, y - 0.03, ez], [cx + 0.045, y - 0.03, ez], [cx + 0.045, y + 0.03, ez], [cx - 0.045, y + 0.03, ez], 2);
      else m.quad([cx + 0.045, y - 0.03, ez], [cx - 0.045, y - 0.03, ez], [cx - 0.045, y + 0.03, ez], [cx + 0.045, y + 0.03, ez], 2);
    }
  }
  // side rails, end headers and sills
  for (const sz of [-1, 1]) {
    m.box(0, 0.08, sz * (W / 2 - 0.035), L - 0.36, 0.16, 0.07);
    m.box(0, H - 0.04, sz * (W / 2 - 0.035), L - 0.36, 0.08, 0.07);
    for (const fx of [-1.03, 1.03]) {                                             // fork-lift pockets
      const z = sz * (W / 2 + 0.002), a = fx - 0.18, b = fx + 0.18;
      if (sz > 0) m.quad([a, 0.03, z], [b, 0.03, z], [b, 0.13, z], [a, 0.13, z], 2); else m.quad([b, 0.03, z], [a, 0.03, z], [a, 0.13, z], [b, 0.13, z], 2);
    }
  }
  for (const sx of [-1, 1]) { m.box(sx * (L / 2 - 0.045), H - 0.065, 0, 0.09, 0.13, W - 2 * POST); m.box(sx * (L / 2 - 0.045), 0.06, 0, 0.09, 0.12, W - 2 * POST); }
  // corrugated side walls
  const xa = -L / 2 + POST, xb = L / 2 - POST, y0 = 0.16, y1 = H - 0.08, px = profile(xa, xb, 21);
  for (const sz of [-1, 1]) {
    const zo = sz * (W / 2 - 0.012), zi = sz * (W / 2 - 0.048);
    const liv = (x, y) => [sz > 0 ? (x - xa) / (xb - xa) : 1 - (x - xa) / (xb - xa), (y - y0) / (y1 - y0)];
    for (let k = 0; k < px.length - 1; k++) {
      const [xA, dA] = px[k], [xB, dB] = px[k + 1], zA = dA ? zi : zo, zB = dB ? zi : zo;
      if (sz > 0) m.quad([xA, y0, zA], [xB, y0, zB], [xB, y1, zB], [xA, y1, zA], 0, liv, 1);
      else m.quad([xB, y0, zB], [xA, y0, zA], [xA, y1, zA], [xB, y1, zB], 0, liv, 1);
    }
  }
  // corrugated roof (ribs run across the width)
  const pr = profile(xa, xb, 26), za = -W / 2 + 0.07, zb = W / 2 - 0.07;
  for (let k = 0; k < pr.length - 1; k++) {
    const [xA, dA] = pr[k], [xB, dB] = pr[k + 1], yA = H - 0.008 - dA * 0.022, yB = H - 0.008 - dB * 0.022;
    m.quad([xA, yA, za], [xA, yA, zb], [xB, yB, zb], [xB, yB, za], 0);
  }
  // plywood floor and the steel underside
  m.quad([xa - 0.1, 0.17, za], [xa - 0.1, 0.17, zb], [xb + 0.1, 0.17, zb], [xb + 0.1, 0.17, za], 3);
  m.quad([xa, 0.03, zb], [xa, 0.03, za], [xb, 0.03, za], [xb, 0.03, zb], 2);
  for (let i = 0; i < 9; i++) m.box(xa + 0.3 + i * ((xb - xa - 0.6) / 8), 0.075, 0, 0.05, 0.11, W - 0.2, 2);   // cross members
  return m.geometry();
}

function buildEndWall() {
  const m = new Soup();
  const za = -W / 2 + POST, zb = W / 2 - POST, y0 = 0.12, y1 = H - 0.13, pz = profile(za, zb, 9);
  const xo = -L / 2 + 0.012, xi = -L / 2 + 0.048;
  const liv = (x, y, z) => [(z - za) / (zb - za), (y - y0) / (y1 - y0)];
  for (let k = 0; k < pz.length - 1; k++) {
    const [zA, dA] = pz[k], [zB, dB] = pz[k + 1], xA = dA ? xi : xo, xB = dB ? xi : xo;
    m.quad([xA, y0, zA], [xB, y0, zB], [xB, y1, zB], [xA, y1, zA], 0, liv, 3);
  }
  return m.geometry();
}

/** A door leaf in hinge space: hinge axis on local (0, y, 0), the leaf extends toward `dir`·z. */
function buildLeaf(dir) {
  const m = new Soup();
  const y0 = DOOR.y0, y1 = DOOR.y1, hgt = y1 - y0, cy = (y0 + y1) / 2, zc = dir * LEAF / 2;
  // door-end livery space: u runs left to right for a viewer standing in front of the doors
  const liv = (x, y, z) => [(W / 2 - (dir < 0 ? HINGE_Z + z : -HINGE_Z + z)) / W, y / H];
  m.box(-0.02, cy, zc, 0.04, hgt, LEAF, 0, liv, 2);
  for (let i = 0; i < 5; i++) m.box(0.006, y0 + 0.21 + i * ((hgt - 0.42) / 4), zc, 0.014, 0.3, LEAF - 0.14, 0, liv, 2);   // pressed panels
  m.box(0.002, cy, dir * 0.022, 0.012, hgt, 0.03, 2); m.box(0.002, cy, dir * (LEAF - 0.012), 0.012, hgt, 0.024, 2);          // rubber gaskets
  m.box(0.002, y0 + 0.012, zc, 0.012, 0.024, LEAF, 2); m.box(0.002, y1 - 0.012, zc, 0.012, 0.024, LEAF, 2);
  for (const f of [0.3, 0.72]) {
    const z = dir * LEAF * f;
    m.rod(0.036, z, 0.02, H - 0.03, 0.0165, 1);                                                // lock rod
    for (const y of [0.42, 1.3, 2.18]) m.box(0.026, y, z, 0.03, 0.06, 0.075, 1);               // guides
    for (const y of [0.05, H - 0.06]) m.box(0.03, y, z, 0.05, 0.085, 0.085, 1);                // cam keepers
    m.box(0.045, 1.02, z - dir * 0.17, 0.014, 0.034, 0.36, 1);                                 // handle
    m.box(0.034, 1.02, z - dir * 0.33, 0.04, 0.07, 0.06, 1);                                   // handle catch
  }
  for (let i = 0; i < 4; i++) m.rod(0.012, -dir * 0.012, y0 + 0.16 + i * ((hgt - 0.32) / 3) - 0.055, y0 + 0.16 + i * ((hgt - 0.32) / 3) + 0.055, 0.02, 1, 6);   // hinges
  return m.geometry();
}

/** Medium detail: corrugated sides, flat roof and ends, no door hardware (stacks a row or two back, deck cargo). */
function buildMid() {
  const m = new Soup();
  const xa = -L / 2 + POST, xb = L / 2 - POST, y0 = 0.16, y1 = H - 0.08, px = profile(xa, xb, 21);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box(sx * (L / 2 - POST / 2), H / 2, sz * (W / 2 - POST / 2), POST, H, POST);
  for (const sz of [-1, 1]) {
    m.box(0, 0.08, sz * (W / 2 - 0.035), L - 0.32, 0.16, 0.07); m.box(0, H - 0.04, sz * (W / 2 - 0.035), L - 0.32, 0.08, 0.07);
    const zo = sz * (W / 2 - 0.012), zi = sz * (W / 2 - 0.048);
    const liv = (x, y) => [sz > 0 ? (x - xa) / (xb - xa) : 1 - (x - xa) / (xb - xa), (y - y0) / (y1 - y0)];
    for (let k = 0; k < px.length - 1; k++) {
      const [xA, dA] = px[k], [xB, dB] = px[k + 1], zA = dA ? zi : zo, zB = dB ? zi : zo;
      if (sz > 0) m.quad([xA, y0, zA], [xB, y0, zB], [xB, y1, zB], [xA, y1, zA], 0, liv, 1);
      else m.quad([xB, y0, zB], [xA, y0, zA], [xA, y1, zA], [xB, y1, zB], 0, liv, 1);
    }
  }
  const za = -W / 2, zb = W / 2, xe = L / 2 - 0.03;
  m.quad([-L / 2, H - 0.01, za], [-L / 2, H - 0.01, zb], [L / 2, H - 0.01, zb], [L / 2, H - 0.01, za], 0);
  m.quad([-L / 2, 0.02, zb], [-L / 2, 0.02, za], [L / 2, 0.02, za], [L / 2, 0.02, zb], 2);
  m.quad([xe, 0, zb], [xe, 0, za], [xe, H, za], [xe, H, zb], 0, (x, y, z) => [(W / 2 - z) / W, y / H], 2);
  m.quad([-xe, 0, za], [-xe, 0, zb], [-xe, H, zb], [-xe, H, za], 0, (x, y, z) => [(z + W / 2 - POST) / (W - 2 * POST), (y - 0.12) / (H - 0.25)], 3);
  for (const f of [-0.72, -0.28, 0.28, 0.72]) m.box(L / 2 - 0.01, H / 2, f * W / 2, 0.03, H - 0.1, 0.035, 1);
  return m.geometry();
}

/** Far detail: a plain painted box (distant stacks). */
function buildFar() {
  const m = new Soup(), x = L / 2, z = W / 2;
  m.quad([-x, 0, z], [x, 0, z], [x, H, z], [-x, H, z], 0, (px, py) => [(px + x) / L, py / H], 1);
  m.quad([x, 0, -z], [-x, 0, -z], [-x, H, -z], [x, H, -z], 0, (px, py) => [1 - (px + x) / L, py / H], 1);
  m.quad([x, 0, z], [x, 0, -z], [x, H, -z], [x, H, z], 0, (px, py, pz) => [(z - pz) / W, py / H], 2);
  m.quad([-x, 0, -z], [-x, 0, z], [-x, H, z], [-x, H, -z], 0);
  m.quad([-x, H, -z], [-x, H, z], [x, H, z], [x, H, -z], 0);
  return m.geometry();
}

// ------------------------------------------------------------------ liveries (fictional lines)
const BRANDS = ['TIDEWAY', 'OSTRAL', 'HALCYON', 'BOREAS', 'CALDERA', 'PELAGIC', 'IRONGATE', 'VARDE'];
const ATLAS = 2048, LOGO_W = 1024, LOGO_H = 256, ID_W = 512, ID_H = 96;
function liveryAtlas() {
  const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  return canvasTex(ATLAS, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, ATLAS, ATLAS); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.textBaseline = 'middle';
    const fam = '"Arial Black", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
    BRANDS.forEach((name, i) => {
      const x = (i % 2) * LOGO_W, y = (i >> 1) * LOGO_H, cy = y + LOGO_H / 2;
      g.save(); g.beginPath(); g.rect(x + 8, y + 8, LOGO_W - 16, LOGO_H - 16); g.clip();
      // a simple mark, different per line
      const mx = x + 120;
      g.lineWidth = 22;
      if (i % 4 === 0) { g.beginPath(); g.arc(mx, cy, 70, 0.2, Math.PI * 2 - 0.2); g.stroke(); g.fillRect(mx - 12, cy - 40, 24, 80); }
      else if (i % 4 === 1) { g.beginPath(); g.moveTo(mx - 80, cy + 70); g.lineTo(mx, cy - 75); g.lineTo(mx + 80, cy + 70); g.closePath(); g.stroke(); }
      else if (i % 4 === 2) { for (let k = 0; k < 3; k++) g.fillRect(mx - 80, cy - 70 + k * 52, 160 - k * 34, 30); }
      else { g.beginPath(); g.moveTo(mx, cy - 82); g.lineTo(mx + 78, cy); g.lineTo(mx, cy + 82); g.lineTo(mx - 78, cy); g.closePath(); g.stroke(); g.fillRect(mx - 16, cy - 16, 32, 32); }
      let size = 170; g.font = `900 ${size}px ${fam}`;
      const max = LOGO_W - 290; const w = g.measureText(name).width; if (w > max) { size *= max / w; g.font = `900 ${size}px ${fam}`; }
      g.fillText(name, x + 250, cy + 6);
      g.restore();
    });
    // id blocks: owner code + serial + check digit, size/type code underneath
    g.font = `700 50px "DejaVu Sans Mono", Menlo, Consolas, monospace`;
    for (let i = 0; i < 16; i++) {
      const x = (i % 4) * ID_W, y = 4 * LOGO_H + (i >> 2) * ID_H;
      const code = BRANDS[i % 8].replace(/[^A-Z]/g, '').slice(0, 3) + 'U';
      g.fillText(`${code} ${String(100000 + Math.floor(rnd() * 899999))} ${Math.floor(rnd() * 10)}`, x + 14, y + 30);
      g.font = `700 34px "DejaVu Sans Mono", Menlo, Consolas, monospace`; g.fillText(['22G1', '22G1', '2210', '22U1'][i % 4], x + 330, y + 74); g.font = `700 50px "DejaVu Sans Mono", Menlo, Consolas, monospace`;
    }
    // weight panel (door)
    const ty = 4 * LOGO_H + 4 * ID_H; g.font = `700 26px "DejaVu Sans Mono", Menlo, Consolas, monospace`;
    ['MAX GROSS   30,480 KG   67,200 LB', 'TARE         2,230 KG    4,920 LB', 'NET         28,250 KG   62,280 LB', 'CU. CAP.      33.2 CU.M  1,172 CU.FT'].forEach((s, k) => g.fillText(s, 14, ty + 22 + k * 30));
    g.lineWidth = 3; g.strokeRect(520, ty + 8, 150, 112); g.font = `700 24px ${fam}`; g.fillText('CAUTION', 536, ty + 34); g.font = `700 60px ${fam}`; g.fillText("9'6\"", 532, ty + 84);
  }, false);
}

const FRAG = /* glsl */`
  vec3 wN = gl_FrontFacing ? vWNrm : -vWNrm;
  gUp = smoothstep(0.3, 0.9, wN.y);
  float sExp = rainExposure(vWPos, wN);
  gWet = uWet * sExp * mix(0.62, 1.0, gUp);
  float seed = vData.y;
  vec3 paint = diffuseColor.rgb;
  float lum = dot(paint, vec3(0.3, 0.6, 0.1));
  // sun-bleached, chalky variation across the panel
  float mac = fbm(vWPos.xz * 0.5 + vWPos.y * 0.7 + seed * 17.0);
  paint = mix(paint, vec3(lum) * 1.05 + 0.015, 0.06 + 0.14 * mac) * mix(0.78, 1.06, mac);
  // handling wear: fine pitting, long horizontal scuffs from fork-lifts and neighbouring boxes, vertical dirt runs
  float pit = vnoise(vWPos.xy * 140.0 + vWPos.z * 123.0);
  float scuff = smoothstep(0.82, 0.9, vnoise(vec2(dot(vWPos.xz, vec2(0.7, 0.6)) * 0.9 + seed * 9.0, vWPos.y * 55.0))) * (1.0 - gUp);
  float runs = fbm(vec2(dot(vWPos.xz, vec2(1.0, 0.85)) * 9.0 + seed * 4.0, vWPos.y * 0.5));
  paint *= (0.94 + 0.1 * pit) * mix(1.0, 0.8, smoothstep(0.5, 0.8, runs) * 0.6 * (1.0 - gUp));
  paint = mix(paint, vec3(lum * 0.8 + 0.12), scuff * 0.45);
  // livery, painted over the corrugation
  if (gl_FrontFacing && vLiv.z > 0.5) {
    vec3 ink = lum > 0.3 ? vec3(0.035, 0.05, 0.09) : vec3(0.82, 0.8, 0.76);
    float a = 0.0; float idc = floor(seed * 15.99);
    vec4 idCell = vec4(mod(idc, 4.0) * ${(ID_W / ATLAS).toFixed(5)}, ${(4 * LOGO_H / ATLAS).toFixed(5)} + floor(idc / 4.0) * ${(ID_H / ATLAS).toFixed(5)}, ${(ID_W / ATLAS).toFixed(5)}, ${(ID_H / ATLAS).toFixed(5)});
    if (vLiv.z < 1.5) {
      if (vData.x >= 0.0) a = livery(vLiv.xy, vec4(0.15, 0.36, 0.85, 0.785), vec4(mod(vData.x, 2.0) * 0.5, floor(vData.x / 2.0) * ${(LOGO_H / ATLAS).toFixed(5)}, 0.5, ${(LOGO_H / ATLAS).toFixed(5)}));
      a = max(a, livery(vLiv.xy, vec4(0.745, 0.855, 0.972, 0.959), idCell));
    } else if (vLiv.z < 2.5) {
      a = livery(vLiv.xy, vec4(0.565, 0.8, 0.955, 0.869), idCell);
      a = max(a, livery(vLiv.xy, vec4(0.565, 0.45, 0.955, 0.59), vec4(0.0, ${((4 * LOGO_H + 4 * ID_H) / ATLAS).toFixed(5)}, ${(700 / ATLAS).toFixed(5)}, ${(128 / ATLAS).toFixed(5)})));
    } else a = livery(vLiv.xy, vec4(0.5, 0.82, 0.948, 0.896), idCell);
    float chip = smoothstep(0.25, 0.5, vnoise(vWPos.xy * 67.0 + vWPos.z * 59.0 + seed * 5.0));     // flaking stencil paint
    paint = mix(paint, ink * (0.9 + 0.2 * pit), a * (0.93 + 0.07 * chip));
  }
  vec3 col = paint; gRoughC = 0.52; gMetal = 0.0;
  if (vPart > 2.5) { col = vec3(0.21, 0.15, 0.1) * (0.6 + 0.6 * vnoise(vec2(vWPos.x * 40.0, vWPos.z * 2.0) + vWPos.y)); gRoughC = 0.85; }
  else if (vPart > 1.5) { col = vec3(0.015); gRoughC = 0.7; }
  else if (vPart > 0.5) { col = vec3(0.34, 0.35, 0.35) * (0.8 + 0.4 * mac); gRoughC = 0.42; gMetal = 0.85; }
  if (vPart < 1.5) {
    // rust: creeps up from the bottom rail, down from the roof line, and blooms in patches
    float low = 1.0 - smoothstep(0.0, 0.55, vLPos.y), top = smoothstep(${(H - 0.4).toFixed(2)}, ${H.toFixed(2)}, vLPos.y);
    float rn = fbm(vec2(dot(vWPos.xz, vec2(0.9, 0.7)) * 1.3 + seed * 7.0, vWPos.y * 1.7 + seed * 3.0));
    float fine = vnoise(vWPos.xy * 43.0 + vWPos.z * 37.0);
    float age = vData.z * vData.z;                                               // most boxes are fairly clean, a few are wrecks
    float rth = 0.86 - low * 0.3 - top * 0.12 - age * 0.24;
    float rust = smoothstep(rth, rth + 0.07, rn + (fine - 0.5) * 0.16) * (1.0 - gUp * 0.7);
    float stain = smoothstep(rth - 0.12, rth + 0.05, rn) * 0.35;                 // brown halo bleeding out of each patch
    float drip = fbm(vec2(dot(vWPos.xz, vec2(1.0, 0.8)) * 7.0 + seed * 3.0, vWPos.y * 0.22));
    stain = max(stain, smoothstep(0.62, 0.9, drip) * smoothstep(0.1, 0.9, 1.0 - vLPos.y / ${H.toFixed(2)}) * (0.12 + age * 0.5) * (1.0 - gUp));
    gRust = rust;
    col = mix(col, col * vec3(0.5, 0.36, 0.26), stain);
    col = mix(col, mix(vec3(0.07, 0.03, 0.016), vec3(0.15, 0.068, 0.032), fine), rust);
    // road grime rising from the base, dust on the roof
    col *= mix(1.0, 0.55, low * 0.7) * mix(1.0, 0.8, gUp * 0.6);
    gRoughC = mix(gRoughC, 0.9, rust); gMetal *= 1.0 - rust;
  }
  col *= mix(1.0, 0.82, gWet);
  diffuseColor.rgb = col;
`;

let shared = null;
async function containerMaterial() {
  if (shared) return shared;
  const nor = await loadTex('rusty_metal_02_nor');
  const atlas = liveryAtlas(); atlas.minFilter = THREE.LinearMipmapLinearFilter; atlas.generateMipmaps = true; atlas.anisotropy = 8;
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0, normalMap: nor, normalScale: new THREE.Vector2(0.35, 0.35), side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    surfUniforms(sh); sh.uniforms.tLivery = { value: atlas };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${SURF_VERT_PARS}\nattribute float aPart; attribute vec3 aLiv; attribute vec4 iData; varying float vPart; varying vec3 vLiv; varying vec4 vData; varying vec3 vLPos;`)
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_NORMALMAP\n vNormalMapUv = uv * 0.9;\n#endif')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${SURF_VERT}\nvPart = aPart; vLiv = aLiv; vData = iData; vLPos = position;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${SURF_FRAG_PARS}
        uniform sampler2D tLivery; varying float vPart; varying vec3 vLiv; varying vec4 vData; varying vec3 vLPos;
        float gRust = 0.0, gMetal = 0.0, gRoughC = 0.5;
        float livery(vec2 uv, vec4 rect, vec4 cell){
          vec2 t = (uv - rect.xy) / (rect.zw - rect.xy);
          float inside = step(0.0, t.x) * step(t.x, 1.0) * step(0.0, t.y) * step(t.y, 1.0);
          t = clamp(t, 0.01, 0.99);
          return texture2D(tLivery, vec2(cell.x + t.x * cell.z, 1.0 - (cell.y + (1.0 - t.y) * cell.w))).r * inside;
        }`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = mix(gRoughC, max(0.08, gRoughC * 0.42), gWet);
        float riv = smoothstep(0.55, 0.8, vnoise(vec2(dot(vWPos.xz, vec2(7.1, 5.3)), vWPos.y * 0.6 + uTime * 0.22)));
        roughnessFactor = mix(roughnessFactor, 0.09, riv * gWet * (1.0 - gUp) * 0.5 * uRain);`)
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = gMetal;');
  };
  m.customProgramCacheKey = () => 'container';
  return (shared = m);
}

const hash = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };

/**
 * Builds instanced meshes for a list of containers: {x, y?, z, yaw, color, open?, logo?, rust?, lod?}.
 * `open` = tunnel container: both ends are door frames with the leaves swung back.
 * lod: 0 full model · 1 no door hardware · 2 plain box
 */
export async function buildContainers(list, { castShadow = true } = {}) {
  const group = new THREE.Group(); group.name = 'containers';
  if (!list.length) return group;
  const material = await containerMaterial();
  const sets = { shell: [], end: [], leafA: [], leafB: [], mid: [], far: [] };
  const M = new THREE.Matrix4(), T = new THREE.Matrix4(), R = new THREE.Matrix4(), col = new THREE.Color();
  for (const c of list) {
    const y = c.y || 0, seed = hash(c.x, y, c.z), logo = c.logo ?? (hash(c.z, c.x, y + 3) < 0.62 ? Math.floor(hash(y, c.z, c.x) * 8) : -1);
    col.set(c.color);
    const hsl = {}; col.getHSL(hsl); col.setHSL(hsl.h + (seed - 0.5) * 0.02, hsl.s * (0.8 + seed * 0.3), hsl.l * (0.82 + hash(c.z, y, c.x) * 0.3));
    const data = [logo, seed, c.rust ?? hash(c.x + 9, c.z, y), 0], color = col.clone();
    M.makeRotationY(c.yaw || 0).setPosition(c.x, y, c.z);
    if (c.lod) { sets[c.lod > 1 ? 'far' : 'mid'].push({ m: M.clone(), color, data }); continue; }
    sets.shell.push({ m: M.clone(), color, data });
    const leaf = (f) => sets[f.dir < 0 ? 'leafA' : 'leafB'].push({ m: M.clone().multiply(T.makeTranslation(f.x, 0, f.z)).multiply(R.makeRotationY(f.a)), color, data });
    if (c.open) openLeaves(c).forEach(leaf);             // the same leaves the colliders are made from
    else { sets.end.push({ m: M.clone(), color, data }); leaf({ x: HINGE_X, z: HINGE_Z, a: -(c.ajar || 0), dir: -1 }); leaf({ x: HINGE_X, z: -HINGE_Z, a: 0, dir: 1 }); }
  }
  const make = { shell: buildShell, end: buildEndWall, leafA: () => buildLeaf(-1), leafB: () => buildLeaf(1), mid: buildMid, far: buildFar };
  for (const k of Object.keys(sets)) {
    const inst = sets[k]; if (!inst.length) continue;
    const mesh = new THREE.InstancedMesh(make[k](), material, inst.length);
    const d = new Float32Array(inst.length * 4);
    inst.forEach((it, i) => { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, it.color); d.set(it.data, i * 4); });
    mesh.geometry.setAttribute('iData', new THREE.InstancedBufferAttribute(d, 4));
    mesh.castShadow = castShadow; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.name = 'containers:' + k;
    group.add(mesh);
  }
  return group;
}
