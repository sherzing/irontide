// Scenery builders: procedural set dressing a level asks for by name in its `dressing` list
// (see shared/levels/kit.js `dress`). Purely visual — collision always comes from the level's solids.
//   gantry · stsCrane · ship · lightMast · stacks · sign · skyline · breakwater · cones · pallets · bollards
//   fenders · razorWire · rope · rails — plus the shipbreaking-yard set (dressing-yard.js) and the airfield set (dressing-airfield.js)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { getMaterial, canvasTex, patchSurface } from './materials.js';
import { CONTAINER } from '../../shared/props.js';
import { addYardBuilders } from './dressing-yard.js';
import { addAirfieldBuilders } from './dressing-airfield.js';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const UP = new THREE.Vector3(0, 1, 0);
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const PALETTE = ['#8a2f25', '#2f5d7a', '#b4772a', '#3d6b45', '#c9c2b2', '#2f5d7a', '#7a3b2a', '#c8b23a', '#31485c', '#8a2f25'];

/** Collects geometry per material, in the coordinate frame set by push()/pop(). */
export class Kit {
  constructor() { this.buckets = new Map(); this.frames = [{ m: new THREE.Matrix4(), yaw: 0 }]; this.lights = []; this.containers = []; this.signs = []; this.blinkers = []; }
  get M() { return this.frames[this.frames.length - 1].m; }
  get yaw() { return this.frames[this.frames.length - 1].yaw; }
  push(x = 0, y = 0, z = 0, yaw = 0) { const f = this.frames[this.frames.length - 1]; this.frames.push({ m: f.m.clone().multiply(new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z)), yaw: f.yaw + yaw }); }
  /** Enters a frame given by any matrix (a tilt, a roll); signs and containers keep the yaw passed along. */
  pushM(m, yaw = 0) { const f = this.frames[this.frames.length - 1]; this.frames.push({ m: f.m.clone().multiply(m), yaw: f.yaw + yaw }); }
  pop() { this.frames.pop(); }
  world(x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(this.M); }
  put(mat, geo, color, local) {
    const n = geo.attributes.position.count, c = Array.isArray(color) ? new THREE.Color(...color) : new THREE.Color(color ?? '#ffffff'), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (local) geo.applyMatrix4(local);
    geo.applyMatrix4(this.M);
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat).push(geo.index ? geo.toNonIndexed() : geo);
  }
  box(mat, x, y, z, sx, sy, sz, color, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.BoxGeometry(sx, sy, sz), uv = g.attributes.uv, nor = g.attributes.normal, ox = (x * 0.37 + z * 0.61) % 1, oy = (y * 0.53) % 1;
    for (let i = 0; i < uv.count; i++) {
      const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
      const su = nx > 0.5 ? sz : sx, sv = ny > 0.5 ? sz : sy;
      uv.setXY(i, (uv.getX(i) * su) / 2.2 + ox, (uv.getY(i) * sv) / 2.2 + oy);
    }
    this.put(mat, g, color, new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')).setPosition(x, y, z));
  }
  /** Rectangular member from a to b. w = horizontal thickness, h = vertical thickness. */
  beam(mat, a, b, w, h, color) {
    const A = V(a), B = V(b), d = B.clone().sub(A), len = d.length(); if (len < 1e-4) return; d.divideScalar(len);
    const x = new THREE.Vector3().crossVectors(UP, d); if (x.lengthSq() < 1e-6) x.set(1, 0, 0); x.normalize();
    const y = new THREE.Vector3().crossVectors(d, x);
    const g = new THREE.BoxGeometry(w, h, len), uv = g.attributes.uv, nor = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) { const nz = Math.abs(nor.getZ(i)); uv.setXY(i, uv.getX(i) * (nz > 0.5 ? w : len) / 2.2, uv.getY(i) * (Math.abs(nor.getY(i)) > 0.5 ? w : h) / 2.2); }
    this.put(mat, g, color, new THREE.Matrix4().makeBasis(x, y, d).setPosition(A.add(B).multiplyScalar(0.5)));
  }
  cyl(mat, a, b, r0, r1, color, seg = 10) {
    const A = V(a), B = V(b), d = B.clone().sub(A), len = d.length(); if (len < 1e-4) return; d.divideScalar(len);
    const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round((r0 * 6.3) / 2.2)), (uv.getY(i) * len) / 2.2);
    this.put(mat, g, color, new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d)).setPosition(A.add(B).multiplyScalar(0.5)));
  }
  /** Box with rounded edges: pressed panels and mouldings catch the light along them. */
  rbox(mat, x, y, z, sx, sy, sz, r, color, rx = 0, ry = 0, rz = 0) {
    const g = new RoundedBoxGeometry(sx, sy, sz, 2, Math.min(r, sx / 2.02, sy / 2.02, sz / 2.02));
    this.put(mat, g, color, new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')).setPosition(x, y, z));
  }
  /**
   * Surface of revolution about the local x axis: pts = [[x, radius], ...] with x increasing.
   * phi0 / phiLen cut a band out of it (0 = the +z side, PI/2 = underneath, PI = the -z side, 3PI/2 = on top);
   * bend(x) lifts the axis (an upswept tail); squash = [sy, sz] makes the section oval; rot = [rx, ry, rz] turns it and
   * at = [x, y, z] moves it (rot [0, PI/2, 0] lays the axis across the vehicle: a wheel).
   */
  lathe(mat, pts, color, o = {}) {
    const { seg = 24, phi0 = 0, phiLen = Math.PI * 2, bend = null, at = [0, 0, 0], squash = null, rot = null } = o;
    const g = new THREE.LatheGeometry(pts.map(([x, r]) => new THREE.Vector2(Math.max(r, 1e-4), x)), seg, phi0, phiLen); g.rotateZ(-Math.PI / 2);
    if (squash) g.scale(1, squash[0], squash[1]);
    if (bend) { const P = g.attributes.position; for (let i = 0; i < P.count; i++) P.setY(i, P.getY(i) + bend(P.getX(i))); }
    if (bend || squash) g.computeVertexNormals();
    this.put(mat, g, color, (rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')) : new THREE.Matrix4()).setPosition(at[0], at[1], at[2]));
  }
  /** Ball or, with the scale factors, an ellipsoid. */
  sphere(mat, x, y, z, r, color, sx = 1, sy = 1, sz = 1, seg = 12) {
    const g = new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7))), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round((r * 6.3 * sx) / 2.2)), uv.getY(i) * Math.max(1, Math.round((r * 3.1 * sy) / 2.2)));
    this.put(mat, g, color, new THREE.Matrix4().makeScale(sx, sy, sz).setPosition(x, y, z));
  }
  /** Flat quad a,b,c,d (counter-clockwise from the visible side); UVs in metres along its edges. */
  quad(mat, a, b, c, d, color, uvScale = 2.2) {
    const A = V(a), B = V(b), C = V(c), D = V(d), g = new THREE.BufferGeometry();
    const n = new THREE.Vector3().crossVectors(B.clone().sub(A), D.clone().sub(A)).normalize();
    const u = B.clone().sub(A).normalize(), v = new THREE.Vector3().crossVectors(n, u);
    const P = [A, B, C, A, C, D], pos = [], nor = [], uv = [];
    for (const p of P) { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); uv.push(p.dot(u) / uvScale, p.dot(v) / uvScale); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    this.put(mat, g, color);
  }
  /** Sagging rope/cable between two points. */
  rope(a, b, sag = 0.6, r = 0.035, color = '#2a2622', seg = 8, mat = 'dark') {
    let p = a;
    for (let i = 1; i <= seg; i++) { const t = i / seg, q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]; this.cyl(mat, p, q, r, r, color, 5); p = q; }
  }
  light(x, y, z, color, intensity, dist, o = {}) { const p = this.world(x, y, z); this.lights.push({ pos: [p.x, p.y, p.z], color, intensity, dist, shadow: false, ...o }); }
  container(x, y, z, yaw, color, o = {}) { const p = this.world(x, y, z); this.containers.push({ x: p.x, y: p.y, z: p.z, yaw: this.yaw + yaw, color, deco: true, ...o }); }
  /** Small emissive lamp that can blink (period s, duty 0..1). */
  lamp(x, y, z, color, size = 0.25, blink = null) {
    if (!blink) { this.box('glow', x, y, z, size, size, size, color); return; }
    const p = this.world(x, y, z); this.blinkers.push({ pos: p, color, size, ...blink });
  }
  sign(text, x, y, z, o = {}) { const p = this.world(x, y, z); this.signs.push({ text, pos: p, yaw: this.yaw + (o.yaw || 0), ...o }); }

  async build(root) {
    const out = { lights: this.lights, containers: this.containers, update: null };
    for (const [key, geos] of this.buckets) {
      let material;
      if (key === 'glow') material = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
      else if (key === 'glass') material = new THREE.MeshStandardMaterial({ color: 0x0b1116, roughness: 0.06, metalness: 0.92, vertexColors: true, envMapIntensity: 1.3 });
      // untextured paints are scaled down so that a given colour sits beside the textured materials, whose images are darker than their tint
      else if (key === 'gloss') material = patchSurface(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.8, 0.8, 0.8), roughness: 0.42, metalness: 0.15, vertexColors: true }), { macro: false, dark: 0.9 });       // clean paint: aircraft, vehicles
      else if (key === 'matte') material = patchSurface(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.6, 0.6, 0.6), roughness: 1, metalness: 0, vertexColors: true }), { macro: true, dark: 0.8 });      // cloth, foliage, earth
      else if (key === 'chainlink') {
        const map = canvasTex(128, (g, s) => { g.clearRect(0, 0, s, s); g.strokeStyle = '#c9ccd0'; g.lineWidth = 7; for (const d of [1, -1]) for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(s * (i - 0.5), d > 0 ? 0 : s); g.lineTo(s * (i + 0.5), d > 0 ? s : 0); g.stroke(); } });
        map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(2.2 / 0.11, 2.2 / 0.11);      // one diamond every 11 cm
        material = new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.6, vertexColors: true });
      }
      else if (key === 'dark') material = patchSurface(new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.1, vertexColors: true }), { macro: false, dark: 0.85 });
      else if (key === 'hazard') {
        const map = canvasTex(256, (g, s) => { g.fillStyle = '#d6a21a'; g.fillRect(0, 0, s, s); g.strokeStyle = '#16140f'; g.lineWidth = 46; for (let i = -s; i < s * 2; i += 128) { g.beginPath(); g.moveTo(i, s + 8); g.lineTo(i + s + 16, -8); g.stroke(); } });
        map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(2.4, 2.4);
        material = patchSurface(new THREE.MeshStandardMaterial({ map, roughness: 0.62, metalness: 0.1, vertexColors: true }), { dark: 0.85 });
      } else material = await getMaterial(key);
      const mesh = new THREE.Mesh(mergeGeometries(geos, false), material);
      const lit = key !== 'glow';
      mesh.castShadow = lit && key !== 'chainlink'; mesh.receiveShadow = lit; mesh.name = 'dress:' + key;
      root.add(mesh); geos.forEach((g) => g.dispose());
    }
    for (const s of this.signs) root.add(makeSign(s));
    if (this.blinkers.length) {
      const g = new THREE.SphereGeometry(1, 8, 6), items = this.blinkers.map((b) => {
        const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(...b.color), toneMapped: false }));
        m.position.copy(b.pos); m.scale.setScalar(b.size); root.add(m); return { m, b };
      });
      out.update = (t) => { for (const { m, b } of items) m.visible = ((t + (b.phase || 0)) % b.period) < b.period * (b.duty ?? 0.5); };
    }
    return out;
  }
}

// ------------------------------------------------------------------ painted / illuminated text
const signCache = new Map();
function makeSign(s) {
  const { text, h = 0.6, color = '#e9e4d6', flat = false, glow = false, worn = 0.5, font = '900 150px "Arial Black", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif', bg = null } = s;
  const key = [text, color, glow, worn, font, bg].join('|');
  let rec = signCache.get(key);
  if (!rec) {
    const probe = document.createElement('canvas').getContext('2d'); probe.font = font;
    const lines = String(text).split('\n'), tw = Math.max(...lines.map((l) => probe.measureText(l).width)), lh = 170, W = Math.ceil(tw + 60), Hh = lh * lines.length + 30;
    const c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d');
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, Hh); }
    g.font = font; g.fillStyle = color; g.textBaseline = 'middle'; g.textAlign = 'center';
    lines.forEach((l, i) => g.fillText(l, W / 2, 15 + lh * (i + 0.5) + 6));
    if (worn > 0 && !glow) { g.globalCompositeOperation = 'destination-out'; const r = rng(text.length * 77 + 5); for (let i = 0; i < (W * Hh) / 260 * worn; i++) { g.globalAlpha = r() * 0.6; g.beginPath(); g.arc(r() * W, r() * Hh, r() * 5 + 0.6, 0, 7); g.fill(); } }
    const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    const material = glow
      ? new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false, color: new THREE.Color(...(Array.isArray(glow) ? glow : [2.2, 2.2, 2.2])), depthWrite: false })
      : patchSurface(new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.8, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), { macro: false, planar: flat, dark: 0.75 });
    signCache.set(key, rec = { material, aspect: W / Hh, lines: lines.length });
  }
  const hh = h * rec.lines * 1.1, mesh = new THREE.Mesh(new THREE.PlaneGeometry(hh * rec.aspect, hh), rec.material);
  if (flat) mesh.rotation.set(-Math.PI / 2, s.yaw || 0, 0, 'YXZ'); else mesh.rotation.set(0, s.yaw || 0, 0);
  mesh.position.copy(s.pos); mesh.receiveShadow = !glow; mesh.renderOrder = 1; mesh.name = 'sign';
  return mesh;
}

// ------------------------------------------------------------------ builders
const B = {};

/** Rail-mounted gantry crane over the plaza. Footprint: legs at (±span/2, ±base/2). */
B.gantry = (k, o) => {
  const { x, z, yaw = 0, span = 18, base = 9, h = 10, color = '#d9a441', trolley = 2.4, hook = null, id = 'RMG 02' } = o;
  const hs = span / 2, hb = base / 2, C = color, D = '#2b2d2f', G = '#8c9094';
  k.push(x, 0, z, yaw);
  for (const sx of [-1, 1]) {
    const X = sx * hs;
    k.box('hazard', X, 0.185, 0, 1.16, 0.33, base + 1.2, '#ffffff');                       // sill beam
    k.box('steel', X, 0.02, 0, 0.14, 0.04, base + 8.5, '#3b3b3b');                           // rail
    for (const e of [-1, 1]) { k.box('paint', X, 0.3, e * (hb + 4.1), 0.5, 0.6, 0.3, '#b8291e'); k.box('dark', X, 0.26, e * (hb + 0.75), 0.9, 0.5, 0.5, D); }   // buffer stops, bogie housings
    for (const sz of [-1, 1]) {
      const Z = sz * hb;
      k.box('paint', X, h / 2, Z, 0.62, h, 0.62, C);
      k.box('hazard', X, 1.02, Z, 0.66, 1.3, 0.66, '#ffffff');
      k.box('paint', X, 0.44, Z, 0.95, 0.16, 0.95, C);
      k.beam('paint', [X, 0.42, Z - sz * 1.5], [X, 2.0, Z - sz * 0.2], 0.16, 0.16, C);                                          // foot gusset
      k.lamp(X + sx * 0.36, 2.35, Z, [9, 3.2, 0.4], 0.09, { period: 1.3, duty: 0.3, phase: (sx + sz) * 0.2 });
      k.box('dark', X + sx * 0.34, 2.35, Z, 0.08, 0.2, 0.14, D);
    }
    k.box('paint', X, h - 0.3, 0, 0.56, 0.6, base + 0.62, C);                                // top side beam
    k.beam('paint', [X, 5.3, -hb], [X, 5.3, hb], 0.26, 0.26, C);
    k.beam('paint', [X, 5.45, -hb + 0.3], [X, h - 0.65, hb - 0.3], 0.18, 0.18, C);
    k.beam('paint', [X, 5.45, hb - 0.3], [X, h - 0.65, -hb + 0.3], 0.18, 0.18, C);
    k.beam('paint', [X, 0.45, -hb + 0.35], [X, 5.2, 0], 0.16, 0.16, C);
    k.beam('paint', [X, 0.45, hb - 0.35], [X, 5.2, 0], 0.16, 0.16, C);
  }
  // access ladder with hoops on one leg
  { const X = -hs - 0.42, Z = -hb;
    for (const s2 of [-1, 1]) k.cyl('steel', [X, 0.5, Z + s2 * 0.22], [X, h + 2.2, Z + s2 * 0.22], 0.022, 0.022, G, 6);
    for (let y = 0.8; y < h + 1.2; y += 0.3) k.cyl('steel', [X, y, Z - 0.22], [X, y, Z + 0.22], 0.014, 0.014, G, 5);
    for (let y = 2.6; y < h + 2; y += 0.85) { k.beam('steel', [X, y, Z - 0.34], [X - 0.62, y, Z - 0.34], 0.03, 0.05, G); k.beam('steel', [X, y, Z + 0.34], [X - 0.62, y, Z + 0.34], 0.03, 0.05, G); k.beam('steel', [X - 0.62, y, Z - 0.34], [X - 0.62, y, Z + 0.34], 0.03, 0.05, G); }
    for (const s2 of [-1, 1]) k.cyl('steel', [X - 0.62, 2.6, Z + s2 * 0.34], [X - 0.62, h + 1.9, Z + s2 * 0.34], 0.012, 0.012, G, 5);
  }
  // twin bridge girders with web stiffeners, end ties, a service walkway and handrail
  for (const gz of [-0.66, 0.66]) {
    k.box('paint', 0, h + 0.6, gz, span + 3.2, 1.2, 0.46, C);
    k.box('paint', 0, h + 1.22, gz, span + 3.2, 0.06, 0.62, C); k.box('paint', 0, h - 0.02, gz, span + 3.2, 0.06, 0.62, C);
    for (let xx = -hs - 1.2; xx <= hs + 1.2; xx += 1.55) k.box('paint', xx, h + 0.6, gz + Math.sign(gz) * 0.25, 0.05, 1.14, 0.06, C);
    k.box('steel', 0, h + 1.28, gz, span + 3, 0.06, 0.1, '#444');                             // trolley rail
  }
  for (const e of [-1, 1]) k.box('paint', e * (hs + 1.45), h + 0.6, 0, 0.3, 1.1, 1.8, C);
  k.box('grid', 0, h + 1.02, 1.42, span + 2.6, 0.04, 0.76, '#ffffff');
  for (let xx = -hs - 1.2; xx <= hs + 1.21; xx += 1.5) k.cyl('steel', [xx, h + 1.04, 1.78], [xx, h + 2.1, 1.78], 0.02, 0.02, G, 5);
  for (const yy of [1.57, 2.1]) k.cyl('steel', [-hs - 1.2, h + yy, 1.78], [hs + 1.2, h + yy, 1.78], 0.018, 0.018, G, 5);
  for (let xx = -hs + 0.5; xx < hs; xx += 2.2) k.rope([xx, h + 1.9, -1.05], [xx + 2.2, h + 1.9, -1.05], 0.5, 0.03, '#161616', 6);          // festoon cable
  // trolley, machinery house and operator cabin
  k.box('paint', trolley, h + 1.5, 0, 3.4, 0.36, 2.5, D);
  k.box('paint', trolley - 0.5, h + 2.25, 0, 2.0, 1.15, 1.9, '#9a9d9f');
  k.box('dark', trolley + 1.0, h + 1.95, 0, 0.7, 0.6, 1.2, D);
  k.box('paint', trolley + 2.6, h - 0.95, 1.55, 1.6, 1.75, 1.45, '#cfcabd');
  k.box('glass', trolley + 2.6, h - 0.85, 2.29, 1.4, 1.0, 0.04, '#ffffff'); k.box('glass', trolley + 3.41, h - 0.85, 1.55, 0.04, 1.0, 1.25, '#ffffff');
  k.box('glow', trolley + 2.6, h - 0.2, 1.55, 0.5, 0.04, 0.3, [1.6, 1.3, 0.9]);
  k.beam('paint', [trolley + 1.4, h + 1.4, 1.2], [trolley + 2.6, h - 0.1, 1.5], 0.14, 0.14, D);
  // floodlights under the girders
  for (const fx of [-hs + 3, -2.5, 6.2, hs - 3]) { k.box('dark', fx, h - 0.12, 0, 0.6, 0.12, 0.36, D); k.box('glow', fx, h - 0.19, 0, 0.5, 0.02, 0.28, [16, 17, 19]); }
  k.light(-hs + 4.5, h - 1.2, 0, 0xdfe9ff, 150, 30, { glow: 1.6, range: 7, bulb: false, priority: 2 }); k.light(hs - 4.5, h - 1.2, 0, 0xdfe9ff, 150, 30, { glow: 1.6, range: 7, bulb: false, priority: 2 });
  k.sign(id, -3, h + 0.6, 0.9, { h: 0.5, color: '#1c1c1c', worn: 0.6 }); k.sign(id, -3, h + 0.6, -0.9, { h: 0.5, color: '#1c1c1c', worn: 0.6, yaw: Math.PI });
  k.sign('SWL 41 t', 5.5, h + 0.6, 0.9, { h: 0.34, color: '#1c1c1c', worn: 0.6 });
  // hoist ropes and spreader over the load
  if (hook) {
    k.push(trolley, hook.y, 0, hook.yaw || 0);
    const L = CONTAINER.L, W = CONTAINER.W, S = '#c98a1c';
    for (const sz of [-1, 1]) k.box('paint', 0, 0.16, sz * (W / 2 - 0.12), L, 0.22, 0.2, S);
    for (const sx of [-1, 1]) { k.box('paint', sx * (L / 2 - 0.1), 0.16, 0, 0.2, 0.22, W, S); k.box('paint', sx * 1.2, 0.16, 0, 0.16, 0.2, W - 0.3, S); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { k.box('dark', sx * (L / 2 - 0.1), 0.02, sz * (W / 2 - 0.1), 0.24, 0.12, 0.24, D); k.cyl('dark', [sx * 1.25, 0.3, sz * 0.75], [sx * 0.7, h + 1.3 - hook.y, sz * 0.55], 0.018, 0.018, '#111', 5); }
    k.box('paint', 0, 0.42, 0, 2.2, 0.3, 1.3, D);
    k.pop();
  }
  k.pop();
};

/** Ship-to-shore container crane (large backdrop piece). Local +z points out over the water. */
B.stsCrane = (k, o) => {
  const { x, z, yaw = 0, color = '#2f5d7a', boomUp = false, s = 1 } = o, C = color, D = '#2a2c2e';
  k.push(x, 0, z, yaw);
  const gauge = 30 * s, wb = 13.5 * s, HP = 17 * s, HG = 44 * s, out = 50 * s, back = 18 * s, leg = 1.5 * s;
  for (const sx of [-1, 1]) {
    const X = sx * wb;
    for (const Z of [0, -gauge]) { k.box('paint', X, HG / 2, Z, leg, HG, leg, C); k.box('dark', X, 0.7, Z, leg * 1.5, 1.4, leg * 3.2, D); }
    k.box('paint', X, HP, -gauge / 2, leg * 0.8, leg, gauge, C);
    k.beam('paint', [X, HP + 1, -gauge + 1], [X, HG - 2, -1], leg * 0.55, leg * 0.55, C);
    k.beam('paint', [X, 2, -1], [X, HP - 1, -gauge * 0.45], leg * 0.45, leg * 0.45, C);
    k.beam('paint', [X, 2, -gauge + 1], [X, HP - 1, -gauge * 0.55], leg * 0.45, leg * 0.45, C);
  }
  for (const Z of [0, -gauge]) { k.box('paint', 0, 2.2, Z, wb * 2, leg, leg * 0.9, C); k.box('paint', 0, HP, Z, wb * 2, leg, leg * 0.8, C); k.box('paint', 0, HG - 1, Z, wb * 2, leg * 1.2, leg * 0.9, C); }
  k.beam('paint', [-wb, HP + 1, 0], [wb, HG - 2, 0], leg * 0.4, leg * 0.4, C); k.beam('paint', [wb, HP + 1, 0], [-wb, HG - 2, 0], leg * 0.4, leg * 0.4, C);
  // fixed girder (landside) + machinery house
  const gx = 2.6 * s;
  for (const sx of [-1, 1]) k.box('paint', sx * gx, HG + 1.2, (-gauge - back) / 2 + 1, 1.3 * s, 2.6 * s, gauge + back + 2, C);
  for (let zz = -gauge - back + 2; zz < 2; zz += 6 * s) k.box('paint', 0, HG + 0.3, zz, gx * 2, 0.5, 0.6, C);
  k.box('paint', 0, HG + 6.2 * s, -gauge + 3, 12 * s, 7 * s, 11 * s, '#b9b6ad'); k.box('dark', 0, HG + 9.9 * s, -gauge + 3, 12.4 * s, 0.5, 11.4 * s, D);
  for (let i = -2; i <= 2; i++) k.box('glow', i * 2.2 * s, HG + 6.5 * s, -gauge + 3 + 5.52 * s, 0.9 * s, 0.7 * s, 0.05, i % 2 ? [0.02, 0.03, 0.04] : [2.4, 1.9, 1.1]);
  // A-frame and stays
  const apex = [0, HG + 24 * s, -3 * s];
  for (const sx of [-1, 1]) { k.beam('paint', [sx * wb * 0.5, HG, 0], [sx * 1.2, apex[1], apex[2]], leg * 0.6, leg * 0.6, C); k.beam('paint', [sx * wb * 0.5, HG, -gauge], [sx * 1.2, apex[1], apex[2]], leg * 0.42, leg * 0.42, C); }
  k.box('paint', 0, apex[1], apex[2], 3.4 * s, 1.2, 1.4, C);
  // boom: horizontal over the ship, or stowed upright
  const tip = boomUp ? [0, HG + out * 0.985, out * 0.17] : [0, HG + 1.2, out];
  for (const sx of [-1, 1]) k.beam('paint', [sx * gx, HG + 1.2, 1], [sx * gx, tip[1], tip[2]], 1.3 * s, 2.4 * s, C);
  for (let t = 0.12; t < 1; t += 0.11) k.beam('paint', [-gx, HG + 0.4 + (tip[1] - HG - 1.2) * t, 1 + (tip[2] - 1) * t], [gx, HG + 0.4 + (tip[1] - HG - 1.2) * t, 1 + (tip[2] - 1) * t], 0.5, 0.5, C);
  if (!boomUp) {
    for (const sx of [-1, 1]) { k.beam('paint', [sx * 1.2, apex[1], apex[2]], [sx * gx, HG + 2.6, out * 0.93], 0.35 * s, 0.6 * s, C); k.beam('paint', [sx * 1.2, apex[1], apex[2]], [sx * gx, HG + 2.6, out * 0.48], 0.35 * s, 0.6 * s, C); }
    k.box('paint', 0, HG - 1.6, out * 0.36, 4.5 * s, 2.4 * s, 5 * s, D);                                         // trolley
    k.box('paint', 0, HG - 5.2 * s, out * 0.36 + 3.6 * s, 2.6 * s, 2.8 * s, 2.6 * s, '#d0ccc0'); k.box('glass', 0, HG - 5.2 * s, out * 0.36 + 4.92 * s, 2.3 * s, 1.6 * s, 0.06, '#fff');
    for (const zz of [out * 0.2, out * 0.55, out * 0.85]) k.box('glow', 0, HG - 0.15, zz, 1.6, 0.06, 0.6, [14, 15, 17]);
    k.light(0, HG - 3, out * 0.4, 0xdfe9ff, 900, 90, { glow: 0.5, range: 16, bulb: false });
  } else for (const sx of [-1, 1]) k.beam('paint', [sx * 1.2, apex[1], apex[2]], [sx * gx, tip[1] * 0.78, tip[2] * 0.75], 0.3 * s, 0.5 * s, C);
  for (const sx of [-1, 1]) k.beam('paint', [sx * 1.2, apex[1], apex[2]], [sx * gx, HG + 2.4, -gauge - back + 3], 0.35 * s, 0.6 * s, C);
  k.lamp(0, apex[1] + 1.2, apex[2], [14, 0.6, 0.3], 0.5, { period: 2.2, duty: 0.5, phase: x * 0.13 });
  k.lamp(0, tip[1] + 0.8, tip[2], [14, 0.6, 0.3], 0.45, { period: 2.2, duty: 0.5, phase: x * 0.13 + 1.1 });
  k.pop();
};

/** Moored container ship. Local +x = bow, -z = the side facing the quay (port). y = 0 is quay level. */
B.ship = (k, o) => {
  const { x, z, yaw = 0, len = 96, beam = 15.5, deck = 8.4, hull = '#1c2a36', boot = '#6e2b22', house = '#d6d1c4', accent = '#c8452e', name = 'HALCYON TIDE', port = 'VALPARAISO', cargo = 1, seed = 5, water = -1.55, lines = [] } = o;
  const R = rng(seed), L2 = len / 2, hb = beam / 2, top = deck + 1.05, wl = water + 2.4;
  k.push(x, 0, z, yaw);
  // plan outline [x, half-breadth, flare]: square stern, parallel mid-body, a curved bow that is fuller at the deck than at the waterline
  const bowLen = 21, outline = [[-L2, 0.41 * beam, 0], [-L2 + 5, hb, 0], [L2 - bowLen, hb, 0]];
  for (const t of [0.2, 0.38, 0.54, 0.68, 0.8, 0.9, 0.96, 1]) outline.push([L2 - bowLen + t * bowLen, Math.max(0.03 * beam, hb * Math.pow(1 - Math.pow(t, 2.4), 0.8)), t]);
  const zAt = (p, y) => p[1] * (1 - 0.42 * p[2] * Math.max(0, Math.min(1, (top - y) / (top - water))));
  for (let i = 0; i < outline.length - 1; i++) {
    const pa = outline[i], pb = outline[i + 1], [xa, za] = pa, [xb, zb] = pb;
    for (const sz of [-1, 1]) {
      const A = (y) => [xa, y, sz * zAt(pa, y)], Bq = (y) => [xb, y, sz * zAt(pb, y)];
      const q = (y0, y1, c) => (sz > 0 ? k.quad('paint', A(y0), Bq(y0), Bq(y1), A(y1), c) : k.quad('paint', Bq(y0), A(y0), A(y1), Bq(y1), c));
      q(water - 2.5, wl, boot); q(wl, wl + 0.16, '#d9d6cc'); q(wl + 0.16, top, hull);
      (sz > 0 ? k.quad('paint', Bq(top - 1.05), A(top - 1.05), A(top), Bq(top), hull) : k.quad('paint', A(top - 1.05), Bq(top - 1.05), Bq(top), A(top), hull));   // bulwark inside
    }
    k.quad('paint', [xa, deck, -za], [xa, deck, za], [xb, deck, zb], [xb, deck, -zb], '#5c3a31');
    k.quad('paint', [xa, top, -za - 0.02], [xa, top, -za + 0.25], [xb, top, -zb + 0.25], [xb, top, -zb - 0.02], hull); k.quad('paint', [xa, top, za - 0.25], [xa, top, za + 0.02], [xb, top, zb + 0.02], [xb, top, zb - 0.25], hull);
  }
  { const zt = outline[0][1]; k.quad('paint', [-L2, water - 2.5, -zt], [-L2, water - 2.5, zt], [-L2, top, zt], [-L2, top, -zt], hull); }
  for (const sz of [-1, 1]) k.box('paint', -L2 + 5 + (len - bowLen - 5) / 2, deck - 0.9, sz * (hb + 0.07), len - bowLen - 5, 0.22, 0.16, '#141c24');   // rubbing strake
  for (const sz of [-1, 1]) {                                                                                  // name on the forward shoulder, draught marks, strakes, anchors
    k.sign(name, L2 - bowLen - 6, deck - 1.3, sz * (hb + 0.03), { h: 0.78, color: '#d9d6cc', yaw: sz > 0 ? 0 : Math.PI, worn: 0.35 });
    for (const dx of [L2 - bowLen - 13, -L2 + 9]) k.sign('9M\n8M\n7M\n6M', dx, wl + 1.75, sz * (hb + 0.03), { h: 0.34, color: '#d9d6cc', yaw: sz > 0 ? 0 : Math.PI, worn: 0.3 });
    for (const sy of [wl + 2.6, wl + 5.1]) k.box('paint', -5, sy, sz * (hb + 0.012), len - bowLen - 12, 0.05, 0.03, '#10171d');
    const ap = outline[5], ax = ap[0], az = zAt(ap, deck - 1.8);
    k.box('dark', ax, deck - 1.7, sz * (az + 0.02), 1.5, 1.7, 0.5, '#07090b', 0, sz * -0.5, 0);
    k.box('dark', ax + 0.1, deck - 2.5, sz * (az + 0.32), 0.22, 2.4, 0.22, '#1b1b1b'); k.box('dark', ax + 0.1, deck - 3.6, sz * (az + 0.36), 1.5, 0.28, 0.3, '#1b1b1b', 0, sz * -0.5, 0);
  }
  k.sign(`${name}\n${port}`, -L2 - 0.05, deck - 1.6, 0, { h: 0.6, color: '#d9d6cc', yaw: -Math.PI / 2, worn: 0.35 });
  for (let i = 0; i < 9; i++) k.box('dark', -L2 + 20 + i * ((len - 44) / 8), deck - 0.35, -hb - 0.03, 0.5, 0.18, 0.06, '#0c0c0c');   // scuppers
  // accommodation block at the stern
  const hx = -L2 + 10.5, hl = 13, hw = beam - 2.6, decks = 5, dh = 2.75;
  for (let d = 0; d < decks; d++) {
    const y = deck + d * dh, l = hl - d * 0.5, w = hw - (d > 2 ? 1.2 : 0);
    k.box('paint', hx, y + dh / 2, 0, l, dh, w, house);
    k.box('paint', hx, y + dh + 0.04, 0, l + 1.0, 0.1, w + 1.6, '#9c9a92');
    for (let wx = -l / 2 + 1.1; wx < l / 2 - 0.6; wx += 1.7) for (const sz of [-1, 1]) {
      const lit = !o.dead && R() < 0.42; k.box(lit ? 'glow' : 'glass', hx + wx, y + 1.55, sz * (w / 2 + 0.02), 0.8, 0.62, 0.05, lit ? [2.6, 2.0, 1.15] : '#ffffff');
    }
    for (let wz = -w / 2 + 1.0; wz < w / 2 - 0.5; wz += 1.6) { const lit = !o.dead && R() < 0.4; k.box(lit ? 'glow' : 'glass', hx + l / 2 + 0.02, y + 1.55, wz, 0.05, 0.62, 0.8, lit ? [2.6, 2.0, 1.15] : '#ffffff'); }
    for (const sz of [-1, 1]) { for (let rx = -l / 2 - 0.5; rx <= l / 2 + 0.5; rx += 1.9) k.cyl('steel', [hx + rx, y + dh + 0.08, sz * (w / 2 + 0.75)], [hx + rx, y + dh + 1.1, sz * (w / 2 + 0.75)], 0.022, 0.022, '#cfcfcf', 5); k.cyl('steel', [hx - l / 2 - 0.5, y + dh + 1.1, sz * (w / 2 + 0.75)], [hx + l / 2 + 0.5, y + dh + 1.1, sz * (w / 2 + 0.75)], 0.022, 0.022, '#cfcfcf', 5); }
  }
  const by = deck + decks * dh;                                                                                   // bridge
  k.box('paint', hx + 0.6, by + 1.3, 0, hl - 4.5, 2.6, beam + 2.4, house);
  k.box('glass', hx + 0.6 + (hl - 4.5) / 2 + 0.03, by + 1.65, 0, 0.05, 0.9, beam + 1.9, '#ffffff');
  for (const sz of [-1, 1]) k.box('glass', hx + 0.6, by + 1.65, sz * (beam / 2 + 1.22), hl - 5.4, 0.9, 0.05, '#ffffff');
  if (!o.dead) k.box('glow', hx + 0.6, by + 0.9, 0, hl - 5.2, 0.05, beam * 0.6, [0.5, 0.42, 0.3]);
  k.box('paint', hx + 0.6, by + 2.66, 0, hl - 3.6, 0.12, beam + 3, '#9c9a92');
  k.box('paint', hx - 3.2, by + 4.6, 0, 3.4, 6.2, 4.4, hull); k.box('paint', hx - 3.2, by + 5.6, 0, 3.5, 1.5, 4.5, accent);               // funnel
  for (const sz of [-0.9, 0.9]) k.cyl('dark', [hx - 3.4, by + 7.6, sz], [hx - 3.7, by + 9.0, sz], 0.32, 0.28, '#101010', 8);
  k.cyl('paint', [hx + 2.2, by + 2.7, 0], [hx + 2.2, by + 10.5, 0], 0.22, 0.12, house, 8);                                               // mast
  k.box('paint', hx + 2.2, by + 7.6, 0, 0.2, 0.2, 5.2, house); k.box('paint', hx + 2.5, by + 6.4, 0, 0.16, 0.3, 2.8, '#eeeeee');
  if (!o.dead) { k.lamp(hx + 2.2, by + 10.7, 0, [10, 10, 9], 0.14); k.lamp(hx + 2.2, by + 7.8, -2.6, [10, 0.5, 0.3], 0.12); k.lamp(hx + 2.2, by + 7.8, 2.6, [0.4, 9, 2], 0.12); }
  k.push(hx - 0.5, deck + 2 * dh + 1.7, -hw / 2 - 1.6);                                                                               // lifeboat on the quay side
  k.cyl('paint', [-3.1, 0, 0], [3.1, 0, 0], 1.1, 1.1, '#d2551e', 10); k.box('paint', 0, 0.75, 0, 3.4, 0.9, 1.5, '#d2551e');
  for (const e of [-2.4, 2.4]) { k.beam('paint', [e, -1.3, 1.3], [e, 2.2, 0.9], 0.2, 0.2, house); k.beam('paint', [e, 2.2, 0.9], [e, 2.0, -0.5], 0.2, 0.2, house); }
  k.pop();
  if (!o.dead) {                                                                                                                                                // deck working lights (a dead ship shows none)
    k.light(hx + hl / 2 + 3, deck + 6, 0, 0xffe2b8, 500, 46, { glow: 0.6, range: 10, bulb: false });
    k.box('glow', hx + hl / 2 + 0.2, deck + 9.2, -3, 0.2, 0.3, 0.9, [22, 20, 16]); k.box('glow', hx + hl / 2 + 0.2, deck + 9.2, 3, 0.2, 0.3, 0.9, [22, 20, 16]);
  }
  // foredeck: windlasses, mast, anchors
  k.box('paint', L2 - 12, deck + 0.6, 0, 3, 1.2, 5, '#3a3f44'); for (const sz of [-1.6, 1.6]) k.cyl('dark', [L2 - 9, deck + 0.7, sz - 0.8], [L2 - 9, deck + 0.7, sz + 0.8], 0.55, 0.55, '#22262a', 10);
  k.cyl('paint', [L2 - 5, deck, 0], [L2 - 5, deck + 8.5, 0], 0.2, 0.1, house, 8); if (!o.dead) k.lamp(L2 - 5, deck + 8.7, 0, [10, 10, 9], 0.13);
  // deck cranes
  for (const cx of [-8, 20].slice(0, o.cranes ?? 2)) {
    k.cyl('paint', [cx, deck, hb - 1.6], [cx, deck + 9.5, hb - 1.6], 1.0, 0.85, '#c7a12c', 12);
    k.box('paint', cx, deck + 10.8, hb - 1.6, 2.6, 2.6, 2.6, '#c7a12c'); k.box('glass', cx + 1.32, deck + 11.1, hb - 1.6, 0.05, 1.0, 1.9, '#fff');
    k.beam('paint', [cx + 1, deck + 11.6, hb - 1.6], [cx + 19, deck + 15.5, hb - 1.6], 0.7, 1.0, '#c7a12c');
    k.beam('paint', [cx, deck + 12.2, hb - 1.6], [cx - 1.5, deck + 15.8, hb - 1.6], 0.35, 0.35, '#c7a12c'); k.cyl('dark', [cx - 1.5, deck + 15.8, hb - 1.6], [cx + 19, deck + 15.7, hb - 1.6], 0.03, 0.03, '#111', 4);
    k.cyl('dark', [cx + 19, deck + 15.4, hb - 1.6], [cx + 19, deck + 9, hb - 1.6], 0.025, 0.025, '#111', 4); k.box('dark', cx + 19, deck + 8.7, hb - 1.6, 0.5, 0.7, 0.5, '#222');
  }
  // deck cargo
  const CL = CONTAINER.L, CW = CONTAINER.W, CH = CONTAINER.H, rows = Math.floor((beam - 1.6) / (CW + 0.12)), x0 = hx + hl / 2 + 5, x1 = L2 - 19;
  for (let bx = x0; bx + CL / 2 < x1; bx += CL + 0.55) {
    if (R() > cargo) continue;
    const base = 1 + Math.floor(R() * 4);
    for (let r = 0; r < rows; r++) {
      const tiers = Math.max(0, base - (R() < 0.3 ? 1 : 0) + (R() < 0.15 ? 1 : 0));
      for (let t = 0; t < tiers; t++) k.container(bx, deck + 0.35 + t * CH, (r - (rows - 1) / 2) * (CW + 0.12), 0, PALETTE[Math.floor(R() * PALETTE.length)], { shadow: false, lod: o.lod ?? 1 });
    }
    for (let r = 0; r <= rows; r++) k.box('dark', bx, deck + 0.18, (r - rows / 2) * (CW + 0.12), CL + 0.3, 0.35, 0.12, '#30261f');           // hatch-cover stools
  }
  // mooring lines to the quay bollards (given in local coordinates: [x on ship, [bollard x, y, z]])
  for (const [sx, bp] of lines) k.rope([sx, deck - 1.2, -hb - 0.1], bp, 0.9, 0.05, '#3d362a', 9);
  k.pop();
};

/** High-mast floodlight tower. */
B.lightMast = (k, o) => {
  const { x, z, yaw = 0, h = 24, color = 0xdfe9ff, intensity = 700, dist = 60, lit = true, light = true } = o, G = '#8a8f93';
  k.push(x, 0, z, yaw);
  k.box('wall', 0, 0.4, 0, 1.4, 0.8, 1.4, '#ffffff');
  k.cyl('steel', [0, 0.8, 0], [0, h, 0], 0.34, 0.16, G, 10);
  k.box('steel', 0, h + 0.1, 0, 3.4, 0.14, 1.5, G);
  for (const fx of [-1.25, -0.42, 0.42, 1.25]) for (const fz of [-0.5, 0.5]) { k.box('dark', fx, h - 0.1, fz, 0.7, 0.24, 0.5, '#1b1d1f', fz * 0.7); if (lit) k.box('glow', fx, h - 0.24, fz * 1.16, 0.6, 0.03, 0.4, [26, 28, 32], fz * 0.7); }
  for (let y = 1.4; y < h - 0.5; y += 0.4) k.box('steel', 0.3, y, 0, 0.04, 0.03, 0.4, G);
  k.lamp(0, h + 0.5, 0, [12, 0.5, 0.3], 0.14, { period: 1.8, duty: 0.45, phase: x * 0.07 });
  if (lit && light) k.light(0, h - 2, 0, color, intensity, dist, { glow: 1.2, range: 11, bulb: false, priority: o.priority });
  k.pop();
};

/** Field of stacked containers (backdrop terminal). Rows run along local x. `face`: +1 / -1 = which outer row (local z) is seen up close and gets the full model. */
B.stacks = (k, o) => {
  const { x, z, yaw = 0, rows = 2, cols = 4, maxH = 4, minH = 1, seed = 1, gapX = 0.4, gapZ = 0.35, colors = PALETTE, shadow = true, holes = 0.08, face = 0, lod = 2 } = o, R = rng(seed);
  const { L, W, H } = CONTAINER;
  k.push(x, 0, z, yaw);
  for (let c = 0; c < cols; c++) {
    let hgt = minH + Math.floor(R() * (maxH - minH + 1));
    for (let r = 0; r < rows; r++) {
      if (R() < holes) continue;
      const n = Math.max(minH, Math.min(maxH, hgt + (R() < 0.35 ? -1 : 0) + (R() < 0.2 ? 1 : 0)));
      const near = face && r === (face > 0 ? rows - 1 : 0);
      for (let t = 0; t < n; t++) k.container((c - (cols - 1) / 2) * (L + gapX), t * H, (r - (rows - 1) / 2) * (W + gapZ), R() < 0.5 ? 0 : Math.PI, colors[Math.floor(R() * colors.length)], { shadow, lod: near ? 0 : face ? 1 : lod });
    }
  }
  k.pop();
};

B.sign = (k, o) => k.sign(o.text, o.x, o.y ?? 0.012, o.z, o);

/** Distant industrial skyline: sheds, tanks and silos on an arc of bearings around a centre point. */
B.skyline = (k, o) => {
  const { cx = 0, cz = 0, from = 0, to = 90, r0 = 150, r1 = 260, n = 14, seed = 3, hMin = 8, hMax = 30, tanks = 0.25, lit = 0.5, y = 0 } = o, R = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = THREE.MathUtils.degToRad(from + (to - from) * ((i + R() * 0.8) / n)), r = r0 + R() * (r1 - r0), px = cx + Math.sin(a) * r, pz = cz - Math.cos(a) * r, h = hMin + R() * R() * (hMax - hMin);
    k.push(px, y, pz, -a);
    if (R() < tanks) {
      const rad = 6 + R() * 9;
      k.cyl('paint', [0, 0, 0], [0, h * 0.7, 0], rad, rad, R() < 0.5 ? '#bdbab0' : '#8d8f8c', 18); k.cyl('paint', [0, h * 0.7, 0], [0, h * 0.7 + rad * 0.14, 0], rad, rad * 0.2, '#a6a39b', 18);
    } else {
      const w = 14 + R() * 34, d = 12 + R() * 22, c = ['#5b5650', '#6a5a4c', '#4e545a', '#77726a'][Math.floor(R() * 4)];
      k.box(R() < 0.5 ? 'corrugated' : 'wall', 0, h / 2, 0, w, h, d, c);
      if (R() < 0.4) k.cyl('wall', [w * 0.3, h, 0], [w * 0.3, h + 12 + R() * 22, 0], 1.4, 0.9, '#6b665f', 8);
      // sawtooth roof lights and a few lit windows
      if (R() < 0.5) for (let rx = -w / 2 + 3; rx < w / 2 - 2; rx += 6) k.box('corrugated', rx, h + 1.1, 0, 3.2, 2.2, d, c, 0, 0, 0.5);
      for (let wx = -w / 2 + 2; wx < w / 2 - 1; wx += 3.2) if (R() < lit * 0.6) k.box('glow', wx, h * (0.35 + R() * 0.5), d / 2 + 0.05, 0.8, 0.5, 0.05, R() < 0.3 ? [0.5, 0.7, 1.0] : [1.3, 0.9, 0.45]);
    }
    k.pop();
  }
};

/** Rock breakwater with a small light tower at its head. From a to b on the water. */
B.breakwater = (k, o) => {
  const { a, b, h = 2.2, w = 9, water = -1.55, seed = 9 } = o, R = rng(seed);
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), yaw = Math.atan2(-dz, dx), n = Math.ceil(len / 5);
  k.push(a[0], water, a[1], yaw);
  for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) k.box('wall', (i + R()) * (len / n), 0.3 + R() * h * 0.6, (R() - 0.5) * w, 3 + R() * 4, 1.5 + R() * h, 3 + R() * 3, ['#4a4844', '#5c5852', '#3f3d3a'][j], R() * 0.4, R() * 3, R() * 0.4);
  k.cyl('paint', [len - 2, h, 0], [len - 2, h + 9, 0], 1.3, 0.9, '#d8d4c8', 10); k.cyl('paint', [len - 2, h + 3, 0], [len - 2, h + 5.5, 0], 1.2, 1.05, '#b8291e', 10);
  k.cyl('dark', [len - 2, h + 9, 0], [len - 2, h + 10.2, 0], 0.7, 0.7, '#1a1a1a', 8);
  k.lamp(len - 2, h + 9.7, 0, [2, 14, 5], 0.55, { period: 4, duty: 0.25 });
  k.pop();
};

B.cones = (k, o) => {
  for (const [x, z, tip = 0] of o.at) {
    k.push(x, o.y || 0, z, x * 1.7);
    k.box('dark', 0, 0.015, 0, 0.36, 0.03, 0.36, '#17120e');
    if (tip) { k.cyl('paint', [0.05, 0.14, 0], [0.62, 0.1, 0], 0.13, 0.025, '#e2581c', 10); k.cyl('paint', [0.28, 0.125, 0], [0.42, 0.115, 0], 0.092, 0.07, '#e8e6e0', 10); }
    else { k.cyl('paint', [0, 0.03, 0], [0, 0.66, 0], 0.135, 0.025, '#e2581c', 10); k.cyl('paint', [0, 0.3, 0], [0, 0.46, 0], 0.092, 0.066, '#e8e6e0', 10); }
    k.pop();
  }
};

/** Stacks of timber pallets. at: [[x, z, yawDeg, count], ...] */
B.pallets = (k, o) => {
  for (const [x, z, yawDeg = 0, n = 1] of o.at) {
    for (let i = 0; i < n; i++) {
      k.push(x + Math.sin(i * 7.1) * 0.03, (o.y || 0) + i * 0.146, z + Math.cos(i * 3.3) * 0.03, THREE.MathUtils.degToRad(yawDeg + Math.sin(i * 5.7) * 4));
      const c = ['#8b7355', '#7d684e', '#96805f'][i % 3];
      for (let b = 0; b < 7; b++) k.box('wood', -0.555 + b * 0.185, 0.134, 0, 0.1, 0.022, 0.8, c);
      for (const bz of [-0.36, 0, 0.36]) { k.box('wood', 0, 0.112, bz, 1.2, 0.022, 0.1, c); for (const bx of [-0.55, 0, 0.55]) k.box('wood', bx, 0.062, bz, 0.1, 0.08, 0.1, c); k.box('wood', 0, 0.011, bz, 1.2, 0.022, 0.1, c); }
      k.pop();
    }
  }
};

B.bollards = (k, o) => {
  for (const [x, z] of o.at) {
    k.push(x, o.y || 0, z);
    k.cyl('paint', [0, 0, 0], [0, 0.08, 0], 0.34, 0.34, '#1e1e1e', 12); k.cyl('paint', [0, 0.08, 0], [0, 0.5, 0], 0.17, 0.15, '#22201e', 12); k.cyl('paint', [0, 0.5, 0], [0, 0.62, 0], 0.27, 0.24, '#22201e', 12);
    k.pop();
  }
};

/** Tyre fenders hung on the quay face. */
B.fenders = (k, o) => {
  const { from, to, z, y = -0.75, step = 4.5 } = o;
  for (let x = from; x <= to; x += step) {
    const g = new THREE.TorusGeometry(0.42, 0.17, 7, 14); k.put('dark', g, '#0d0d0d', new THREE.Matrix4().setPosition(x, y, z + 0.2));
    k.cyl('dark', [x - 0.2, 0.15, z + 0.02], [x - 0.2, y + 0.4, z + 0.2], 0.012, 0.012, '#4a4a4a', 4); k.cyl('dark', [x + 0.2, 0.15, z + 0.02], [x + 0.2, y + 0.4, z + 0.2], 0.012, 0.012, '#4a4a4a', 4);
  }
};

/** Coiled razor wire on angled brackets along a wall top. */
B.razorWire = (k, o) => {
  const { a, b, y, r = 0.3 } = o, dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), yaw = Math.atan2(-dz, dx);
  k.push(a[0], y, a[1], yaw);
  for (let x = 0; x <= len + 0.01; x += 2.6) { k.beam('steel', [x, -0.05, 0], [x, 0.55, 0], 0.05, 0.05, '#6f7377'); }
  for (const yy of [0.2, 0.5]) k.cyl('steel', [0, yy, 0], [len, yy, 0], 0.008, 0.008, '#8e9296', 4);
  const pts = []; for (let t = 0; t <= len * 7; t++) { const u = t / 7, an = u * 9.5; pts.push([u, 0.36 + Math.cos(an) * r, Math.sin(an) * r]); }
  for (let i = 0; i < pts.length - 1; i++) k.cyl('steel', pts[i], pts[i + 1], 0.007, 0.007, '#9a9ea2', 3);
  k.pop();
};

B.rope = (k, o) => k.rope(o.a, o.b, o.sag ?? 0.6, o.r ?? 0.035, o.color ?? '#2a2622', o.seg ?? 8);

/** Overhead cable runs between poles: pts = [[x,y,z], ...] */
B.cables = (k, o) => { for (let i = 0; i < o.pts.length - 1; i++) for (const dy of o.strands || [0, -0.25]) k.rope([o.pts[i][0], o.pts[i][1] + dy, o.pts[i][2]], [o.pts[i + 1][0], o.pts[i + 1][1] + dy, o.pts[i + 1][2]], o.sag ?? 0.7, 0.014, '#0d0d0d', 7); };

/** Wall-mounted details for a shed: downpipes, a vent row, an illuminated number. */
B.shedTrim = (k, o) => {
  const { x0, x1, z, h, face = 1, id = null } = o;
  for (let x = x0 + 0.6; x < x1; x += (x1 - x0 - 1.2) / 3) { k.cyl('steel', [x, 0, z + face * 0.14], [x, h, z + face * 0.14], 0.055, 0.055, '#5a5d60', 6); k.box('steel', x, h + 0.05, z + face * 0.14, 0.2, 0.14, 0.2, '#5a5d60'); }
  k.box('steel', (x0 + x1) / 2, h + 0.12, z + face * 0.2, x1 - x0 + 0.6, 0.14, 0.2, '#55585b');
  if (id) k.sign(id, (x0 + x1) / 2, h - 1.3, z + face * 0.115, { h: 1.25, color: '#e6e0d0', yaw: face > 0 ? 0 : Math.PI, worn: 0.8 });
};

addYardBuilders(B, { rng, PALETTE });
addAirfieldBuilders(B, { rng, PALETTE });

export async function buildDressing(items, root) {
  const k = new Kit();
  for (const it of items || []) { const fn = B[it.type]; if (fn) fn(k, it); else console.warn('unknown dressing type', it.type); }
  return k.build(root);
}
export const DRESSING_TYPES = Object.keys(B);
