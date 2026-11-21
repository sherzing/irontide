// Building blocks for the first-person weapons: springs, spline tracks, procedural textures, the shared
// per-vertex PBR material, geometry helpers (profile extrusions, revolves) and the skinned glove/arm rig.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { viewmodelDepth } from './materials.js';
import { G } from './globals.js';

// ------------------------------------------------------------------------------------------- springs
/** Damped spring integrated in closed form, so it is stable for any dt and frame-rate independent. */
export class Spring {
  constructor(hz = 6, zeta = 1) { this.x = 0; this.v = 0; this.w = hz * Math.PI * 2; this.z = zeta; }
  step(target, dt) {
    if (!(dt > 0)) return this.x;
    const w = this.w, z = this.z, d = this.x - target;
    if (z >= 0.999) {
      const e = Math.exp(-w * dt), t = (this.v + w * d) * dt;
      this.x = target + (d + t) * e; this.v = (this.v - w * t) * e;
    } else {
      const wd = w * Math.sqrt(1 - z * z), e = Math.exp(-z * w * dt), c = Math.cos(wd * dt), s = Math.sin(wd * dt), c2 = (this.v + z * w * d) / wd;
      this.x = target + e * (d * c + c2 * s);
      this.v = e * ((c2 * wd - z * w * d) * c - (d * wd + z * w * c2) * s);
    }
    return this.x;
  }
  kick(dv) { this.v += dv; }
  reset(x = 0) { this.x = x; this.v = 0; }
}
/** Frame-rate independent exponential approach. */
export const damp = (cur, tgt, rate, dt) => tgt + (cur - tgt) * Math.exp(-rate * dt);
export const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------------------------------- tracks
/**
 * Keyframe track with C1 monotone-cubic (PCHIP) interpolation: motion flows through keys that keep going
 * the same way and comes to rest at keys where it reverses or holds, with no overshoot and no pops.
 * keys: [[t, v0, v1, ...], ...] ; quat = index of a quaternion (4 values) to keep normalised, or -1.
 */
export function makeTrack(keys, quat = -1) {
  const n = keys.length, dim = keys[0].length - 1;
  const T = new Float64Array(n), V = new Float64Array(n * dim), M = new Float64Array(n * dim);
  for (let i = 0; i < n; i++) { T[i] = keys[i][0]; for (let k = 0; k < dim; k++) V[i * dim + k] = keys[i][k + 1]; }
  if (quat >= 0) for (let i = 1; i < n; i++) {           // keep neighbouring quaternions in one hemisphere
    let d = 0; for (let k = 0; k < 4; k++) d += V[i * dim + quat + k] * V[(i - 1) * dim + quat + k];
    if (d < 0) for (let k = 0; k < 4; k++) V[i * dim + quat + k] *= -1;
  }
  for (let i = 1; i < n - 1; i++) {
    const h0 = T[i] - T[i - 1], h1 = T[i + 1] - T[i];
    for (let k = 0; k < dim; k++) {
      const d0 = (V[i * dim + k] - V[(i - 1) * dim + k]) / h0, d1 = (V[(i + 1) * dim + k] - V[i * dim + k]) / h1;
      if (d0 * d1 > 0) { const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0; M[i * dim + k] = (w1 + w2) / (w1 / d0 + w2 / d1); }
    }
  }
  return { T, V, M, n, dim, quat };
}
export function evalTrack(tr, t, out) {
  const { T, V, M, n, dim, quat } = tr;
  let i = 0;
  if (t <= T[0]) { for (let k = 0; k < dim; k++) out[k] = V[k]; }
  else if (t >= T[n - 1]) { for (let k = 0; k < dim; k++) out[k] = V[(n - 1) * dim + k]; }
  else {
    while (i < n - 2 && t > T[i + 1]) i++;
    const h = T[i + 1] - T[i], s = (t - T[i]) / h, s2 = s * s, s3 = s2 * s;
    const a = 2 * s3 - 3 * s2 + 1, b = (s3 - 2 * s2 + s) * h, c = -2 * s3 + 3 * s2, d = (s3 - s2) * h;
    for (let k = 0; k < dim; k++) out[k] = a * V[i * dim + k] + b * M[i * dim + k] + c * V[(i + 1) * dim + k] + d * M[(i + 1) * dim + k];
  }
  if (quat >= 0) { const l = Math.hypot(out[quat], out[quat + 1], out[quat + 2], out[quat + 3]) || 1; for (let k = 0; k < 4; k++) out[quat + k] /= l; }
  return out;
}

// ------------------------------------------------------------------------------------------- textures
function dataTex(size, fill, srgb = false) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size);
  fill(img.data, size); g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** Tileable value noise with a few octaves, 0..1. */
function tileNoise(size, cells, seed = 1) {
  const rnd = (x, y, c) => { const n = Math.sin(((x % c) + c) % c * 127.1 + ((y % c) + c) % c * 311.7 + seed * 74.7) * 43758.5453; return n - Math.floor(n); };
  const out = new Float32Array(size * size);
  let amp = 1, tot = 0;
  for (let c = cells; c <= size / 2 && amp > 0.06; c *= 2, amp *= 0.55) {
    tot += amp;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size * c, v = y / size * c, iu = Math.floor(u), iv = Math.floor(v);
      let fu = u - iu, fv = v - iv; fu = fu * fu * (3 - 2 * fu); fv = fv * fv * (3 - 2 * fv);
      out[y * size + x] += amp * ((rnd(iu, iv, c) * (1 - fu) + rnd(iu + 1, iv, c) * fu) * (1 - fv) + (rnd(iu, iv + 1, c) * (1 - fu) + rnd(iu + 1, iv + 1, c) * fu) * fv);
    }
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
function normalFromHeight(size, h, strength) {
  return dataTex(size, (d) => {
    const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
      d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  });
}
export function makeTextures() {
  const S = 256;
  // fine isotropic grain: moulded polymer / bead-blasted metal
  const grainH = tileNoise(S, 64, 3), grain = normalFromHeight(S, grainH, 2.2);
  // plain weave for gloves and sleeves
  const weaveH = new Float32Array(S * S), N = 32, wn = tileNoise(S, 32, 9);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S * N, v = y / S * N, iu = Math.floor(u), iv = Math.floor(v), fu = u - iu, fv = v - iv;
    const a = Math.pow(Math.sin(Math.PI * fu), 0.7) * (0.55 + 0.45 * Math.sin(Math.PI * fv)), b = Math.pow(Math.sin(Math.PI * fv), 0.7) * (0.55 + 0.45 * Math.sin(Math.PI * fu));
    weaveH[y * S + x] = ((iu + iv) & 1 ? a : b) * 0.8 + wn[y * S + x] * 0.35;
  }
  const weave = normalFromHeight(S, weaveH, 3.0);
  // roughness variation: speckle, smudges and a few scratches (G channel is read)
  const R = 512, big = tileNoise(R, 4, 5), fine = tileNoise(R, 96, 7);
  const rough = dataTex(R, (d) => {
    for (let i = 0; i < R * R; i++) { const v = 0.5 + (big[i] - 0.5) * 0.42 + (fine[i] - 0.5) * 0.3; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.max(0, Math.min(1, v)) * 255; d[i * 4 + 3] = 255; }
  });
  { const g = rough.image.getContext('2d'); let s = 11; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 46; i++) { const x = r() * R, y = r() * R, a = r() * 6.28, l = 6 + r() * 34, c = r() < 0.6 ? 215 : 60; g.strokeStyle = `rgba(${c},${c},${c},${0.06 + r() * 0.14})`; g.lineWidth = 0.5 + r() * 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.25); g.stroke(); } }
  // faint albedo mottling so flat colours do not look synthetic
  const alb = dataTex(S, (d) => { const n1 = tileNoise(S, 8, 21), n2 = tileNoise(S, 80, 23); for (let i = 0; i < S * S; i++) { const v = 0.9 + (n1[i] - 0.5) * 0.1 + (n2[i] - 0.5) * 0.1; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.min(1, v) * 255; d[i * 4 + 3] = 255; } }, true);
  // rain beading on the weapon: scattered domes, a few merged into short runs
  const dropH = new Float32Array(S * S); { let sd = 5; const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    for (let k = 0; k < 150; k++) {
      const cx = r() * S, cy = r() * S, rad = 2.2 + r() * r() * 9, sx = 1 + (r() < 0.25 ? r() * 1.6 : 0);
      for (let y = -Math.ceil(rad * sx); y <= rad * sx; y++) for (let x = -Math.ceil(rad); x <= rad; x++) {
        const d = Math.hypot(x, y / sx) / rad; if (d >= 1) continue;
        const i = (((Math.round(cy) + y) % S + S) % S) * S + ((Math.round(cx) + x) % S + S) % S; dropH[i] = Math.max(dropH[i], Math.sqrt(1 - d * d) * rad / 9);
      }
    } }
  const drops = normalFromHeight(S, dropH, 14);
  return { grain, weave, rough, alb, drops };
}

// ------------------------------------------------------------------------------------------- materials
/** Shared projection scale: the viewmodel is drawn with its own field of view (see ViewModel.update). */
export const VM_SCALE = { value: 1 };
/** Rim-light colour for everything held in the hands (set from the level's sky each frame). */
export const VM_RIM = { value: new THREE.Color(0.05, 0.06, 0.075) };
/** Draws a material as part of the first-person view: own FOV + compressed depth so it never clips into the world. */
export function vmProject(mat, key = 'vmstd') {
  if (mat.userData.vmp) return mat;
  mat.userData.vmp = true;
  viewmodelDepth(mat);
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uVmScale = VM_SCALE;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uVmScale;')
      .replace('#include <project_vertex>', '#include <project_vertex>\ngl_Position.xy *= uVmScale;');
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}
/**
 * One material for a whole weapon or hand: albedo comes from vertex colours and metalness / roughness /
 * detail-normal strength from the per-vertex `pbr` attribute, so differently finished parts share a draw call.
 */
export function pbrMaterial(tex, { normal = tex.grain, normalRepeat = 4, normalScale = 0.6, env = 1, cloth = false } = {}) {
  const n = normal.clone(); n.needsUpdate = true; n.repeat.set(normalRepeat, normalRepeat);
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 1, roughness: 1, map: tex.alb, normalMap: n, roughnessMap: tex.rough, normalScale: new THREE.Vector2(normalScale, normalScale), envMapIntensity: env });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tDrops = { value: tex.drops }; sh.uniforms.uRain = G.uRain; sh.uniforms.uWet = G.uWet; sh.uniforms.uRim = VM_RIM;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 pbr; varying vec4 vPbr;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvPbr = pbr;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec4 vPbr; uniform sampler2D tDrops; uniform float uRain, uWet; uniform vec3 uRim; float gEdge = 0.0, gBead = 0.0, gUpW = 0.0;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // worn edges: the finish is rubbed through to bright metal along chamfers and small raised details
        float wearN = texture2D(roughnessMap, vRoughnessMapUv * 2.7).g + (texture2D(roughnessMap, vRoughnessMapUv * 11.0).g - 0.5) * 0.6;
        gEdge = vPbr.w * smoothstep(0.36, 0.68, wearN) * 0.9;
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.3, 0.3, 0.31), diffuseColor.rgb * 2.2 + 0.03, ${cloth ? '1.0' : '0.25'}), gEdge);
        // handling marks: broad lighter smudges and fine scuffs in the finish
        diffuseColor.rgb *= ${cloth ? '0.94 + 0.12' : '0.8 + 0.55'} * smoothstep(0.35, 0.8, texture2D(roughnessMap, vRoughnessMapUv * 0.9 + 0.37).g);
        // rain: up-facing surfaces darken a little and carry beads of water
        gUpW = uRain * smoothstep(0.15, 0.65, inverseTransformDirection(normalize(vNormal), viewMatrix).y);
        gBead = smoothstep(0.03, 0.22, length(texture2D(tDrops, vRoughnessMapUv * ${cloth ? '3.0' : '5.5'}).xy * 2.0 - 1.0)) * gUpW;
        diffuseColor.rgb *= 1.0 - ${cloth ? '0.38' : '0.12'} * uWet * (0.4 + 0.6 * gUpW);`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = clamp(vPbr.y * (0.62 + 0.76 * texture2D(roughnessMap, vRoughnessMapUv).g), 0.045, 1.0);
        roughnessFactor = mix(roughnessFactor, 0.3, gEdge * ${cloth ? '0.0' : '1.0'});
        roughnessFactor = mix(roughnessFactor * (1.0 - ${cloth ? '0.3' : '0.22'} * gUpW), 0.06, gBead);`)
      .replace('#include <metalnessmap_fragment>', `float metalnessFactor = mix(vPbr.x, ${cloth ? 'vPbr.x' : '1.0'}, gEdge) * (1.0 - gBead);`)
      // matte finishes do not turn into mirrors at grazing angles (the weapon is always seen edge-on)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>\n material.specularF90 = mix(${cloth ? '0.12' : '0.3'}, 1.0, max(metalnessFactor, gBead));`)
      // the sky around a low sun is so bright that its blurred reflection would wash a matte black gun out to beige: compress it
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>\n radiance /= 1.0 + dot(radiance, vec3(0.3333)) * ${cloth ? '3.0' : '1.6'};`)
      // a soft sky-coloured rim so the silhouette separates from dark backgrounds
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n { float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.5) * (0.35 + 0.65 * clamp(inverseTransformDirection(normal, viewMatrix).y * 0.5 + 0.5, 0.0, 1.0)); totalEmissiveRadiance += uRim * rim * ${cloth ? '0.6' : '1.0'}${cloth ? ' + diffuseColor.rgb * uRim * 2.2' : ''}; }`)
      .replace('#include <normal_fragment_maps>', `
        vec3 mapN = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0; mapN.xy *= normalScale * vPbr.z;
        vec3 dropN = texture2D(tDrops, vRoughnessMapUv * ${cloth ? '3.0' : '5.5'}).xyz * 2.0 - 1.0;
        mapN.xy = mix(mapN.xy, dropN.xy * 1.5, gBead);
        normal = normalize(tbn * mapN);`);
  };
  return vmProject(m, cloth ? 'vmpbr-cloth' : 'vmpbr');
}

// ------------------------------------------------------------------------------------------- finishes
const C = (hex) => new THREE.Color(hex);
/** c = albedo, m = metalness, r = roughness, b = detail-normal strength */
export const FIN = {
  anod: { c: C(0x2e3034), m: 0.12, r: 0.5, b: 0.3 },         // black anodised aluminium (mostly dielectric: stays dark, lights up at grazing angles)
  phos: { c: C(0x2a2b2e), m: 0.45, r: 0.54, b: 0.5 },       // phosphated steel
  steel: { c: C(0x6b6e72), m: 1, r: 0.4, b: 0.25 },         // bare steel
  chrome: { c: C(0xa9a8a2), m: 1, r: 0.26, b: 0.12 },
  poly: { c: C(0x232427), m: 0, r: 0.62, b: 1 },            // black polymer
  fde: { c: C(0x6e6049), m: 0, r: 0.76, b: 1 },             // dark-earth polymer
  rubber: { c: C(0x101011), m: 0, r: 0.9, b: 0.8 },
  hole: { c: C(0x020202), m: 0, r: 1, b: 0 },
  brass: { c: C(0xb69349), m: 1, r: 0.3, b: 0.1 },
  copper: { c: C(0xb06a45), m: 1, r: 0.34, b: 0.1 },
  white: { c: C(0xd8d6cf), m: 0, r: 0.6, b: 0.3 },
  red: { c: C(0xb3261c), m: 0, r: 0.55, b: 0.3 },
  glassDark: { c: C(0x0b1014), m: 0.9, r: 0.08, b: 0 },
};

// ------------------------------------------------------------------------------------------- geometry
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
/** Weapon space: +x right, +y up, forward = -z. Builders below take `f` = forward distance and convert. */
export function place(geo, x = 0, y = 0, f = 0, rx = 0, ry = 0, rz = 0) {
  return geo.applyMatrix4(_m4.compose(_p.set(x, y, -f), _q.setFromEuler(_e.set(rx, ry, rz)), _one));
}
const plain = (g) => { const o = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(o.attributes)) if (k !== 'position' && k !== 'normal') o.deleteAttribute(k); o.morphAttributes = {}; return o; };
const v2 = (pts) => pts.map(([a, b]) => new THREE.Vector2(a, b));

/** Rounded box: w (x) × h (y) × len (forward). */
export function rbox(w, h, len, r = 0.0015, seg = 1) {
  return plain(new RoundedBoxGeometry(w, h, len, seg, Math.min(r, w / 2.02, h / 2.02, len / 2.02)));
}
/** Side profile [[f, y], ...] extruded across x (centred). `round` gives soft moulded edges instead of a machined chamfer. */
export function sideExtrude(pts, width, chamfer = 0.0012, { holes = [], round = false, crease = round ? 1.0 : 0.6, curve = 6 } = {}) {
  const shape = new THREE.Shape(v2(pts));
  for (const h of holes) shape.holes.push(new THREE.Path(v2(h)));
  const c = Math.min(chamfer, width / 2 - 1e-4), depth = width - 2 * c;
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: c > 0, bevelThickness: c, bevelSize: c, bevelOffset: -c, bevelSegments: round ? 3 : 1, curveSegments: curve });
  g.translate(0, 0, -depth / 2); g.rotateY(Math.PI / 2);
  return toCreasedNormals(plain(g), crease);
}
/** Cross-section [[x, y], ...] extruded along the barrel axis from f0 to f1. */
export function axisExtrude(pts, f0, f1, chamfer = 0, { holes = [], crease = 0.6, round = false } = {}) {
  const shape = new THREE.Shape(v2(pts));
  for (const h of holes) shape.holes.push(new THREE.Path(v2(h)));
  const c = Math.min(chamfer, (f1 - f0) / 2 - 1e-4), depth = f1 - f0 - 2 * c;
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: c > 0, bevelThickness: c, bevelSize: c, bevelOffset: -c, bevelSegments: round ? 3 : 1, curveSegments: 6 });
  g.translate(0, 0, -f1 + c);
  return toCreasedNormals(plain(g), crease);
}
/** Surface of revolution around the barrel axis from a profile [[f, radius], ...] (f increasing). */
export function revolve(pts, seg = 20, crease = 0.5) {
  const pos = [], P = (i, j) => { const [f, r] = pts[i], a = (j % seg) / seg * Math.PI * 2; pos.push(r * Math.cos(a), r * Math.sin(a), -f); };
  for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < seg; j++) {
    if (pts[i][1] > 1e-6) { P(i, j); P(i + 1, j); P(i, j + 1); }
    if (pts[i + 1][1] > 1e-6) { P(i + 1, j); P(i + 1, j + 1); P(i, j + 1); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return toCreasedNormals(g, crease);
}
/** Chamfered cylinder along the barrel axis centred on the origin; rotate with place() for other axes. */
export function cyl(r, len, seg = 16, ch = 0.0008, bore = 0) {
  const c = Math.min(ch, r * 0.4, len * 0.4), h = len / 2;
  return revolve([[-h, bore], [-h, r - c], [-h + c, r], [h - c, r], [h, r - c], [h, bore]], seg);
}
/** Rounded-rectangle outline (for holes and frames). */
export function roundRect(cx, cy, w, h, r, n = 4) {
  const out = [], q = [[1, 1, 0], [-1, 1, 90], [-1, -1, 180], [1, -1, 270]];
  for (const [sx, sy, a0] of q) for (let i = 0; i <= n; i++) { const a = (a0 + i / n * 90) * Math.PI / 180; out.push([cx + sx * (w / 2 - r) + Math.cos(a) * r, cy + sy * (h / 2 - r) + Math.sin(a) * r]); }
  return out;
}

/** Collects parts with a finish each and merges them into one mesh for the shared pbr material. */
export class PartBuilder {
  constructor() { this.geos = []; }
  add(fin, geo, x, y, f, rx, ry, rz) {
    const g = plain(geo);
    const n = g.attributes.position.count, col = new Float32Array(n * 3), pbr = new Float32Array(n * 4), edge = edgeMask(g), wear = fin.wear ?? 1;
    if (x !== undefined) place(g, x, y, f, rx, ry, rz);
    for (let i = 0; i < n; i++) { col[i * 3] = fin.c.r; col[i * 3 + 1] = fin.c.g; col[i * 3 + 2] = fin.c.b; pbr[i * 4] = fin.m; pbr[i * 4 + 1] = fin.r; pbr[i * 4 + 2] = fin.b; pbr[i * 4 + 3] = edge[i] * wear; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('pbr', new THREE.BufferAttribute(pbr, 4));
    this.geos.push(g); return this;
  }
  /** Mirrors the same part to both sides (x and -x). */
  both(fin, make, x, y, f, rx = 0, ry = 0, rz = 0) { this.add(fin, make(), x, y, f, rx, ry, rz); return this.add(fin, make(), -x, y, f, rx, -ry, -rz); }
  build(material, uvPerMetre = 8) {
    const g = mergeGeometries(this.geos); this.geos.forEach((x) => x.dispose()); this.geos = [];
    boxUV(g, uvPerMetre);
    const m = new THREE.Mesh(g, material); m.frustumCulled = false; m.receiveShadow = true;
    return m;
  }
}
/**
 * Painted / engraved markings: text is drawn into one atlas and placed as small quads just above a surface.
 * face: 'L' / 'R' = on the left / right side of the weapon (reads correctly from that side), 'T' = on top (reads from behind).
 */
export class Decals {
  constructor(w = 1024, h = 512) {
    this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h; this.g = this.c.getContext('2d');
    this.x = 4; this.y = 4; this.row = 0; this.pos = []; this.uv = []; this.idx = []; this.n = 0;
  }
  /** Draws a label (several lines allowed) and returns its atlas cell. */
  label(text, { size = 34, weight = 700, color = '#d6d4cc', family = '"Saira Condensed", "Arial Narrow", Arial, sans-serif', bg = null, pad = 4, track = 1.5, box = false } = {}) {
    const g = this.g, lines = String(text).split('\n'); g.font = `${weight} ${size}px ${family}`; try { g.letterSpacing = track + 'px'; } catch { /* older browsers */ }
    const w = Math.ceil(Math.max(...lines.map((l) => g.measureText(l).width)) + pad * 2 + 2), h = Math.ceil(lines.length * size * 1.08 + pad * 2);
    if (this.x + w > this.c.width) { this.x = 4; this.y += this.row + 4; this.row = 0; }
    const x = this.x, y = this.y; this.x += w + 4; this.row = Math.max(this.row, h);
    if (bg) { g.fillStyle = bg; g.fillRect(x, y, w, h); }
    if (box) { g.strokeStyle = color; g.lineWidth = Math.max(2, size * 0.07); g.strokeRect(x + 2, y + 2, w - 4, h - 4); }
    g.fillStyle = color; g.textBaseline = 'middle'; g.textAlign = 'left';
    lines.forEach((l, i) => g.fillText(l, x + pad + 1, y + pad + size * 1.08 * (i + 0.5) + size * 0.04));
    return { x, y, w, h };
  }
  /** Places a cell: centre (x, y, forward), height in metres. */
  put(cell, x, y, f, height, face = 'L', spin = 0) {
    const w = height * cell.w / cell.h, cs = Math.cos(spin), sn = Math.sin(spin), W = this.c.width, H = this.c.height;
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const a0 = (u - 0.5) * w, b0 = (v - 0.5) * height, a = a0 * cs - b0 * sn, b = a0 * sn + b0 * cs;
      if (face === 'L') this.pos.push(x, y + b, -f + a); else if (face === 'R') this.pos.push(x, y + b, -f - a); else this.pos.push(x + a, y, -f - b);
      this.uv.push((cell.x + u * cell.w) / W, 1 - (cell.y + (1 - v) * cell.h) / H);
    }
    this.idx.push(this.n, this.n + 1, this.n + 2, this.n, this.n + 2, this.n + 3); this.n += 4;
    return this;
  }
  build() {
    // wear the paint a little so it does not look printed yesterday
    const g = this.g; g.globalCompositeOperation = 'destination-out'; let s = 9; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 2600; i++) { g.globalAlpha = r() * 0.5; g.beginPath(); g.arc(r() * this.c.width, r() * this.c.height, 0.5 + r() * 1.6, 0, 7); g.fill(); }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    const map = new THREE.CanvasTexture(this.c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); geo.setIndex(this.idx); geo.computeVertexNormals();
    const mat = vmProject(new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.62, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, envMapIntensity: 0.3 }), 'vmdecal');
    const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 2; m.receiveShadow = true;
    return m;
  }
}

/**
 * Per-vertex 0..1 flag for chamfers, fillets and small raised details of a part in its own (unrotated) space:
 * narrow faces that are not axis-aligned. The material rubs the finish off there.
 */
function edgeMask(g) {
  const p = g.attributes.position, n = p.count, out = new Float32Array(n), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    nn.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)); const area2 = nn.length(); if (area2 < 1e-12) continue; nn.divideScalar(area2);
    const longest = Math.max(e1.length(), e2.length(), b.distanceTo(c)), alt = area2 / longest, axis = Math.max(Math.abs(nn.x), Math.abs(nn.y), Math.abs(nn.z));
    const v = (1 - sstep(0.0011, 0.0032, alt)) * sstep(0.992, 0.94, axis);
    out[i] = out[i + 1] = out[i + 2] = v;
  }
  return out;
}

/** Per-triangle box projection so every part gets the same texel density without authored UVs. */
export function boxUV(g, s) {
  const p = g.attributes.position, n = p.count, uv = new Float32Array(n * 2), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    const nx = Math.abs((b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y)), ny = Math.abs((b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z)), nz = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    for (let k = 0; k < 3; k++) {
      const v = k === 0 ? a : k === 1 ? b : c;
      if (nx >= ny && nx >= nz) { uv[(i + k) * 2] = v.z * s; uv[(i + k) * 2 + 1] = v.y * s; }
      else if (ny >= nz) { uv[(i + k) * 2] = v.x * s; uv[(i + k) * 2 + 1] = v.z * s; }
      else { uv[(i + k) * 2] = v.x * s; uv[(i + k) * 2 + 1] = v.y * s; }
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// ------------------------------------------------------------------------------------------- hands
// Canonical RIGHT hand: wrist at the origin, fingers along -z, back of the hand +y (palm faces -y), thumb on -x.
// The left hand is the same rig mirrored in x.
// The skin is the WebXR "generic hand" (MIT): an anatomical, rigged hand. It is dressed here as a tactical glove:
// vertex-painted fabric and leather zones, a moulded knuckle guard, finger pads, a ribbed cuff with a strap, and a
// rain-shell sleeve that is aimed at the elbow every frame.
export const PALM = { y: -0.0155, z: -0.052 };          // palm-surface centre in hand space (grip poses refer to it)
const HAND_SCALE = 1.08, UV_PER_M = 52, ONE = new THREE.Vector3(1, 1, 1);
const GLOVE = {
  back: { c: C(0x5a6066), m: 0, r: 0.92, b: 1 }, palm: { c: C(0x3b332c), m: 0, r: 0.58, b: 0.4 }, tip: { c: C(0x3a3d40), m: 0, r: 0.5, b: 0.3 },
  guard: { c: C(0x161718), m: 0, r: 0.4, b: 0.18 }, pad: { c: C(0x1f2022), m: 0, r: 0.46, b: 0.2 }, cuff: { c: C(0x2c3035), m: 0, r: 0.9, b: 1 },
  strap: { c: C(0x101112), m: 0, r: 0.7, b: 0.8 }, tab: { c: C(0x1f8f83), m: 0, r: 0.6, b: 0.6 }, buckle: { c: C(0x6f7377), m: 1, r: 0.38, b: 0.2 },
  sleeve: { c: C(0x3a4149), m: 0, r: 0.66, b: 0.8 }, hem: { c: C(0x262b31), m: 0, r: 0.75, b: 0.9 },
};

/** Loads the hand skin once and moves it into the canonical frame. */
let handAsset = null;
export function loadHandAsset() {
  return handAsset || (handAsset = new GLTFLoader().loadAsync('/assets/models/hand/right.glb').then((g) => {
    let mesh = null; g.scene.updateMatrixWorld(true); g.scene.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
    const bones = mesh.skeleton.bones, names = bones.map((b) => b.name), wrist = bones[names.indexOf('wrist')];
    const inv = wrist.matrixWorld.clone().invert(), geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld); geo.applyMatrix4(new THREE.Matrix4().makeScale(HAND_SCALE, HAND_SCALE, HAND_SCALE).multiply(inv));
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    const rest = bones.map((b) => { inv.clone().multiply(b.matrixWorld).decompose(p, q, sc); return new THREE.Matrix4().compose(p.multiplyScalar(HAND_SCALE), q, ONE); });
    return { geo, names, rest };
  }));
}

/** Lofted tube: rings = [{ z, cx, cy, a, b, n?, skin:[boneA, boneB, weightB] }], pointing along -z. UVs wrap around it. */
function loft(rings, radial, fin) {
  const pos = [], si = [], sw = [], idx = [], uv = [], C = radial + 1;
  let per = 0; for (const r of rings) per = Math.max(per, 2 * Math.PI * Math.sqrt((r.a * r.a + r.b * r.b) / 2));
  const U = Math.max(1, Math.round(per * UV_PER_M)); let len = 0;
  rings.forEach((r, i) => {
    if (i) len += Math.hypot(r.z - rings[i - 1].z, r.a - rings[i - 1].a);
    for (let j = 0; j < C; j++) {
      const a = (j % radial) / radial * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), e = 2 / (r.n || 2), w = r.disp ? r.disp(a) : 1;
      pos.push((r.cx || 0) + r.a * w * Math.sign(c) * Math.pow(Math.abs(c), e), (r.cy || 0) + r.b * w * Math.sign(s) * Math.pow(Math.abs(s), e), r.z);
      si.push(r.skin[0], r.skin[1], 0, 0); sw.push(1 - r.skin[2], r.skin[2], 0, 0); uv.push(j / radial * U, len * UV_PER_M);
    }
  });
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * C + j, b = (i + 1) * C + j, c = (i + 1) * C + j + 1, d = i * C + j + 1;
    idx.push(a, b, d, b, c, d);
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx); g.computeVertexNormals();
  const N = g.attributes.normal;                                     // weld the normals across the UV seam
  for (let i = 0; i < rings.length; i++) {
    const a = i * C, b = i * C + radial, x = N.getX(a) + N.getX(b), y = N.getY(a) + N.getY(b), z = N.getZ(a) + N.getZ(b), l = Math.hypot(x, y, z) || 1;
    N.setXYZ(a, x / l, y / l, z / l); N.setXYZ(b, x / l, y / l, z / l);
  }
  return paint(g.toNonIndexed(), fin);
}
/** Vertex colour + finish attributes for a glove part. */
function paint(g, fin, edge = 0) {
  const n = g.attributes.position.count, col = new Float32Array(n * 3), pbr = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { col[i * 3] = fin.c.r; col[i * 3 + 1] = fin.c.g; col[i * 3 + 2] = fin.c.b; pbr[i * 4] = fin.m; pbr[i * 4 + 1] = fin.r; pbr[i * 4 + 2] = fin.b; pbr[i * 4 + 3] = edge; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('pbr', new THREE.BufferAttribute(pbr, 4));
  return g;
}
/** Binds a whole part to one bone (plus an optional share of a second one). */
function rigid(g, fin, bone, bone2 = 0, w2 = 0, edge = 0) {
  boxUV(g, UV_PER_M); paint(g, fin, edge);
  const n = g.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { si[i * 4] = bone; sw[i * 4] = 1 - w2; si[i * 4 + 1] = bone2; sw[i * 4 + 1] = w2; }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return g;
}

export function makeHand(material, left, asset) {
  const root = new THREE.Group(); root.scale.x = left ? -1 : 1;
  const N = asset.names, rest = asset.rest, ARM = N.length, J = (n) => N.indexOf(n), WR = J('wrist');
  const bones = [...N.map(() => new THREE.Bone()), new THREE.Bone()];
  bones.forEach((b, i) => { b.matrixAutoUpdate = false; if (i < ARM) b.matrix.copy(rest[i]); });
  const geos = [], wristW = (z) => sstep(-0.004, 0.06, z);
  const pos = (i) => new THREE.Vector3().setFromMatrixPosition(rest[i]);
  const at = (i, p, lx = 0, ly = 0, lz = 0, rx = 0) => new THREE.Matrix4().copy(rest[i]).setPosition(p).multiply(_m4.compose(_p.set(lx, ly, lz), _q.setFromEuler(_e.set(rx, 0, 0)), ONE));

  // ---- the skin: inflate it a little (it is a glove, not bare skin) and paint the material zones
  { const g = asset.geo.clone(), P = g.attributes.position, Nn = g.attributes.normal, n = P.count, uv = g.attributes.uv;
    const col = new Float32Array(n * 3), pbr = new Float32Array(n * 4), c = new THREE.Color(), k = UV_PER_M / (2.96 / HAND_SCALE);
    for (let i = 0; i < n; i++) {
      const nx = Nn.getX(i), ny = Nn.getY(i), nz = Nn.getZ(i), z = P.getZ(i);
      const palm = sstep(0.0, -0.45, ny), tip = sstep(-0.118, -0.14, z) * 0.0, t = 0.0017 + 0.0008 * (1 - palm);
      P.setXYZ(i, P.getX(i) + nx * t, P.getY(i) + ny * t, z + nz * t);
      const a = GLOVE.back, b = GLOVE.palm;
      c.copy(a.c).lerp(b.c, palm).lerp(GLOVE.tip.c, tip);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      pbr[i * 4] = 0; pbr[i * 4 + 1] = a.r + (b.r - a.r) * palm; pbr[i * 4 + 2] = a.b + (b.b - a.b) * palm; pbr[i * 4 + 3] = 0;
      uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('pbr', new THREE.BufferAttribute(pbr, 4));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array.from(g.attributes.skinIndex.array), 4));
    const sw = g.attributes.skinWeight, w = new Float32Array(n * 4); for (let i = 0; i < n; i++) { const a = sw.getX(i), b = sw.getY(i), cc = sw.getZ(i), d = sw.getW(i), sum = a + b + cc + d || 1; w[i * 4] = a / sum; w[i * 4 + 1] = b / sum; w[i * 4 + 2] = cc / sum; w[i * 4 + 3] = d / sum; }
    g.setAttribute('skinWeight', new THREE.BufferAttribute(w, 4));
    for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight', 'color', 'pbr'].includes(key)) g.deleteAttribute(key);
    geos.push(g.toNonIndexed());
    // wrist cross-section of the skin, for the cuff
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (let i = 0; i < n; i++) if (P.getZ(i) > 0.004) { x0 = Math.min(x0, P.getX(i)); x1 = Math.max(x1, P.getX(i)); y0 = Math.min(y0, P.getY(i)); y1 = Math.max(y1, P.getY(i)); }
    var wr = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, a: (x1 - x0) / 2, b: (y1 - y0) / 2 };
  }

  // ---- moulded knuckle guard, bridge plate and finger-back pads
  const F4 = ['index', 'middle', 'ring', 'pinky'], mid = new THREE.Vector3();
  F4.forEach((f, i) => {
    const meta = J(`${f}-finger-metacarpal`), prox = J(`${f}-finger-phalanx-proximal`), inter = J(`${f}-finger-phalanx-intermediate`), dist = J(`${f}-finger-phalanx-distal`), sz = i === 3 ? 0.88 : 1;
    const kn = rbox(0.0172 * sz, 0.0086, 0.0235, 0.0038, 3); kn.applyMatrix4(at(meta, pos(prox), 0, 0.0128 * sz, 0.0035, 0.16)); geos.push(rigid(kn, GLOVE.guard, meta, 0, 0, 0.35));
    const p1 = rbox(0.0128 * sz, 0.0036, 0.0225 * sz, 0.0016, 2); p1.applyMatrix4(at(prox, mid.lerpVectors(pos(prox), pos(inter), 0.52), 0, 0.0108 * sz, 0)); geos.push(rigid(p1, GLOVE.pad, prox));
    const p2 = rbox(0.0112 * sz, 0.003, 0.0135 * sz, 0.0014, 2); p2.applyMatrix4(at(inter, mid.lerpVectors(pos(inter), pos(dist), 0.5), 0, 0.0098 * sz, 0)); geos.push(rigid(p2, GLOVE.pad, inter));
  });
  { const a = pos(J('index-finger-phalanx-proximal')), b = pos(J('pinky-finger-phalanx-proximal')), c = mid.lerpVectors(a, b, 0.5).clone(), ang = Math.atan2(b.z - a.z, b.x - a.x);
    const br = rbox(a.distanceTo(b) + 0.012, 0.0042, 0.017, 0.002, 2); br.applyMatrix4(new THREE.Matrix4().makeRotationY(-ang).setPosition(c.x, c.y + 0.0128, c.z + 0.02)); geos.push(rigid(br, GLOVE.guard, WR, 0, 0, 0.3));
    const patch = rbox(0.034, 0.0022, 0.03, 0.001, 2); patch.applyMatrix4(new THREE.Matrix4().makeRotationY(-ang * 0.6).setPosition(c.x - 0.001, c.y + 0.0135, c.z + 0.05)); geos.push(rigid(patch, GLOVE.pad, WR)); }

  // ---- ribbed cuff, closure strap with buckle and pull tab
  { const rings = []; for (let i = 0; i <= 12; i++) { const z = 0.056 - i * 0.005, rib = 1 + (i % 2 ? 0.035 : 0) + (i === 0 || i === 12 ? -0.05 : 0);
      rings.push({ z, a: (wr.a + 0.0042) * rib, b: (wr.b + 0.0042) * rib, n: 2.4, cx: wr.cx, cy: wr.cy, skin: [WR, ARM, wristW(z)] }); }
    geos.push(loft(rings, 18, GLOVE.cuff));
    const part = (g, fin, x, y, z, rz = 0, edge = 0) => { g.applyMatrix4(_m4.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, 0, rz)), ONE)); geos.push(rigid(g, fin, WR, ARM, wristW(z), edge)); };
    part(rbox(wr.a * 1.7, 0.0038, 0.024, 0.0016, 2), GLOVE.strap, wr.cx, wr.cy + wr.b + 0.0052, 0.032);
    part(rbox(0.009, 0.006, 0.028, 0.002, 2), GLOVE.buckle, wr.cx + wr.a * 0.86, wr.cy + wr.b * 0.55 + 0.004, 0.032, -0.6, 0.6);
    part(rbox(0.0125, 0.0026, 0.026, 0.001, 2), GLOVE.tab, wr.cx + 0.002, wr.cy - wr.b - 0.0048, 0.06); }

  // ---- jacket sleeve with a folded hem and sewn-in wrinkles, driven by the forearm bone
  { const rings = [], n = 44, L = 0.42;
    for (let i = 0; i <= n; i++) {
      const s = i / n, z = 0.036 + s * L, hem = i < 2 ? 1.08 : i === 2 ? 1.03 : 1, grow = Math.pow(s, 0.75);
      // cloth folds: bunched and deep behind the cuff, shallower and longer toward the elbow, never a clean ring
      const disp = (a) => hem * (1 + (0.034 * Math.exp(-s * 2.4) + 0.013) * Math.sin(s * 37 + 3.3 * Math.sin(a + 0.7) + 1.3) + 0.016 * Math.sin(s * 66 + 3.6 * Math.sin(2 * a + 1.1)) + 0.014 * Math.sin(3 * a + s * 11));
      rings.push({ z, a: wr.a + 0.0085 + 0.02 * grow, b: wr.b + 0.0085 + 0.026 * grow, n: 2.25, cx: wr.cx, cy: wr.cy, disp, skin: [WR, ARM, wristW(z)] });
    }
    const g = loft(rings.reverse(), 24, GLOVE.sleeve), P = g.attributes.position, col = g.attributes.color;
    for (let i = 0; i < P.count; i++) if (P.getZ(i) < 0.05) col.setXYZ(i, GLOVE.hem.c.r, GLOVE.hem.c.g, GLOVE.hem.c.b);
    geos.push(g); }

  const geo = mergeGeometries(geos); geos.forEach((g) => g.dispose());
  const mesh = new THREE.SkinnedMesh(geo, material);
  for (const b of bones) mesh.add(b);
  mesh.bind(new THREE.Skeleton(bones, [...rest.map((m) => m.clone().invert()), new THREE.Matrix4()]), new THREE.Matrix4());
  mesh.frustumCulled = false; mesh.receiveShadow = true;
  root.add(mesh);

  // ---- forward kinematics over the flat joint list
  const rel = (a, b) => rest[a].clone().invert().multiply(rest[b]);
  const fingers = F4.map((f) => ['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'].map((s) => J(`${f}-finger-${s}`)));
  const thumb = ['metacarpal', 'phalanx-proximal', 'phalanx-distal', 'tip'].map((s) => J('thumb-' + s));
  const fRel = fingers.map((c) => [rest[c[0]].clone(), rel(c[0], c[1]), rel(c[1], c[2]), rel(c[2], c[3]), rel(c[3], c[4])]);
  const tRel = [rest[thumb[0]].clone(), rel(thumb[0], thumb[1]), rel(thumb[1], thumb[2]), rel(thumb[2], thumb[3])];
  const W = new THREE.Matrix4(), R = new THREE.Matrix4(), E = new THREE.Euler(0, 0, 0, 'YXZ'), zAxis = new THREE.Vector3(0, 0, 1), dir = new THREE.Vector3(), qa = new THREE.Quaternion(), sv = new THREE.Vector3(), zero = new THREE.Vector3();
  const put = (i) => { bones[i].matrix.copy(W); bones[i].matrixWorldNeedsUpdate = true; };
  const hand = {
    root, mesh, left, fingers: new Float32Array(20),
    /** pose = 5 digits (thumb, index, middle, ring, little) × [curl at the knuckle, middle joint, tip joint, spread] in radians */
    setFingers(p) {
      this.fingers.set(p);
      W.copy(tRel[0]).multiply(R.makeRotationFromEuler(E.set(-p[0], p[3], 0))); put(thumb[0]);
      W.multiply(tRel[1]).multiply(R.makeRotationX(-p[1])); put(thumb[1]);
      W.multiply(tRel[2]).multiply(R.makeRotationX(-p[2])); put(thumb[2]);
      W.multiply(tRel[3]); put(thumb[3]);
      for (let d = 0; d < 4; d++) {
        const o = (d + 1) * 4, c = fingers[d], r = fRel[d];
        W.copy(r[0]).multiply(R.makeRotationX(d >= 2 ? -p[o] * 0.07 * (d - 1) : 0)); put(c[0]);          // the palm arches when the outer fingers close
        W.multiply(r[1]).multiply(R.makeRotationFromEuler(E.set(-p[o], p[o + 3], 0))); put(c[1]);
        W.multiply(r[2]).multiply(R.makeRotationX(-p[o + 1])); put(c[2]);
        W.multiply(r[3]).multiply(R.makeRotationX(-p[o + 2])); put(c[3]);
        W.multiply(r[4]); put(c[4]);
      }
    },
    /** Points the forearm at the elbow, given in this hand's own (root) space. */
    aimLocal(elbow) {
      const len = elbow.length(); if (len < 1e-4) return;
      qa.setFromUnitVectors(zAxis, dir.copy(elbow).divideScalar(len));
      bones[ARM].matrix.compose(zero, qa, sv.set(1, 1, Math.max(1, len / 0.42))); bones[ARM].matrixWorldNeedsUpdate = true;
    },
  };
  hand.setFingers(new Float32Array(20));
  return hand;
}

function basis(zNeg, yNeg) {             // rotation whose -z axis is `zNeg` and whose -y axis leans towards `yNeg`
  const z = new THREE.Vector3(...zNeg).normalize().negate(), y = new THREE.Vector3(...yNeg).normalize().negate();
  y.addScaledVector(z, -y.dot(z)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Matrix4().makeBasis(x, y, z);
}

/** Hand placement from intuitive inputs: where the palm centre touches, which way the palm faces, where the fingers point. */
export function gripPose({ palm, n, d, roll = 0 }) {             // all three given as [x, y, forward]
  const m = basis([d[0], d[1], -d[2]], [n[0], n[1], -n[2]]);   // -z = finger direction, -y = palm normal
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
  const off = new THREE.Vector3(0, PALM.y, PALM.z).applyQuaternion(q);
  return { p: new THREE.Vector3(palm[0], palm[1], -palm[2]).sub(off), q };   // palm given as [x, y, f]
}
