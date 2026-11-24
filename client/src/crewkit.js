// What makes a crew (shared/crews.js) look like itself: the soldier's one texture repainted in the crew's colours, and
// the kit strapped to his bones. Judge a change on the sheet: `node scripts/crew-sheet.mjs out.jpg` (dev server on 5177).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** 1 inside [lo, hi], fading to 0 over `f` on both sides. */
const band = (x, lo, hi, f) => smooth(lo - f, lo + f, x) * (1 - smooth(hi - f, hi + f, x));

/**
 * The body texture in a crew's colours. The original paints four things in four colours of its own, which is what this
 * tells apart: peach armour plate, red markings, olive fabric and a near-black under-suit. Each is repainted keeping
 * its own light and shade; buckles, leather and the paint's scratches are left as they are.
 */
export function repaint(image, crew) {
  const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(image, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  const plate = hex(crew.plate), stripe = hex(crew.stripe), cloth = hex(crew.cloth), suit = hex(crew.suit);
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2], max = Math.max(r, gg, b), min = Math.min(r, gg, b), v = max / 255, s = max ? (max - min) / max : 0;
    let h = 0;
    if (max !== min) { h = max === r ? ((gg - b) / (max - min)) % 6 : max === gg ? (b - r) / (max - min) + 2 : (r - gg) / (max - min) + 4; h *= 60; if (h < 0) h += 360; }
    const wPlate = band(h, 14, 46, 5) * smooth(0.14, 0.24, s) * smooth(0.4, 0.52, v);
    const wStripe = (h < 180 ? 1 - smooth(6, 13, h) : smooth(344, 352, h)) * smooth(0.5, 0.68, s) * smooth(0.25, 0.4, v);
    const wCloth = band(h, 52, 150, 10) * smooth(0.06, 0.14, s) * band(v, 0.1, 0.52, 0.05);
    const wSuit = (1 - smooth(0.17, 0.26, v)) * (1 - smooth(0.45, 0.6, s)) * 0.85;
    const paint = (w, col, ref, most) => { if (w <= 0.003) return; const k = Math.min(most, v / ref); d[i] += (col[0] * k - d[i]) * w; d[i + 1] += (col[1] * k - d[i + 1]) * w; d[i + 2] += (col[2] * k - d[i + 2]) * w; };
    paint(wSuit, suit, 0.1, 2.4); paint(wCloth, cloth, 0.3, 1.7); paint(wPlate, plate, 0.9, 1.12); paint(wStripe, stripe, 0.72, 1.2);
  }
  g.putImageData(img, 0, 0);
  return c;
}

// ---- kit: plain shapes in the bone's own frame, in metres: y along the bone (up), z to the soldier's front, x to his left.
const KIT_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.08 });
/** A shape placed at (x, y, z), turned by (rx, ry, rz) and given one colour. */
function part(geo, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
  const out = geo.index ? geo.toNonIndexed() : geo; out.applyMatrix4(m); out.deleteAttribute('uv');
  const col = new THREE.Color(color), n = out.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
  out.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return out;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (r, h, seg = 10) => new THREE.CylinderGeometry(r, r, h, seg), ball = (r) => new THREE.SphereGeometry(r, 10, 8), ring = (R, r) => new THREE.TorusGeometry(R, r, 7, 16);
const FLAT = Math.PI / 2;      // a torus lies in x/y: this turns it level
/** Each kit item: the bone it hangs on and its parts. c: the crew, for items that take its colours. */
const KIT = {
  radio: (c) => ['Spine2', [part(box(0.25, 0.3, 0.1), '#2b323a', 0, 0.0, -0.2), part(box(0.2, 0.05, 0.11), c.stripe, 0, 0.09, -0.2), part(cyl(0.007, 0.56, 6), '#15181b', 0.09, 0.42, -0.22), part(ball(0.014), '#15181b', 0.09, 0.7, -0.22)]],
  tanks: () => ['Spine2', [part(cyl(0.066, 0.4, 12), '#c8cdd1', 0.076, -0.02, -0.21), part(cyl(0.066, 0.4, 12), '#c8cdd1', -0.076, -0.02, -0.21), part(ball(0.066), '#c8cdd1', 0.076, 0.18, -0.21), part(ball(0.066), '#c8cdd1', -0.076, 0.18, -0.21),
    part(box(0.2, 0.035, 0.05), '#23282c', 0, 0.25, -0.2), part(box(0.24, 0.04, 0.03), '#1fd0bd', 0, -0.06, -0.15)]],
  collar: () => ['Neck', [part(ring(0.15, 0.052), '#f0701e', 0, -0.03, 0.015, FLAT), part(box(0.1, 0.16, 0.05), '#f0701e', 0, -0.12, 0.13, 0.25)]],
  mast: (c) => ['Spine2', [part(box(0.16, 0.22, 0.08), '#26405c', 0, 0.02, -0.19), part(cyl(0.008, 0.62, 6), '#d9dee2', -0.06, 0.44, -0.2), part(box(0.035, 0.05, 0.035), '#ffffff', -0.06, 0.77, -0.2), part(box(0.12, 0.07, 0.006), c.plate, -0.125, 0.66, -0.2)]],
  bottle: () => ['Spine2', [part(cyl(0.062, 0.4, 12), '#6f2f23', 0.02, -0.01, -0.21, 0, 0, 0.42), part(ball(0.062), '#6f2f23', -0.062, 0.172, -0.21), part(cyl(0.018, 0.06, 8), '#c9a13a', -0.09, 0.235, -0.21, 0, 0, 0.42)]],
  brow: () => ['Head', [part(box(0.2, 0.12, 0.016), '#1a1b1d', 0, 0.2, 0.105, -0.55), part(box(0.1, 0.045, 0.004), '#3b5a4a', 0, 0.2, 0.116, -0.55)]],
  brim: () => ['Head', [part(ring(0.128, 0.016), '#f2f2ec', 0, 0.118, 0.016, FLAT), part(ball(0.124).scale(1, 0.62, 1.04), '#f2f2ec', 0, 0.128, 0.014), part(box(0.055, 0.04, 0.04), '#2a2c2e', 0, 0.15, 0.13), part(box(0.04, 0.028, 0.012), '#fff0b8', 0, 0.15, 0.153)]],
  scarf: (c) => ['Neck', [part(ring(0.125, 0.056), c.stripe, 0, -0.01, 0.01, FLAT), part(box(0.09, 0.2, 0.03), c.stripe, 0.07, -0.13, 0.125, 0.2)]],
  roll: (c) => ['Spine2', [part(cyl(0.072, 0.4, 12), c.cloth, 0, -0.17, -0.2, 0, 0, FLAT), part(box(0.03, 0.16, 0.16), '#2a231b', 0.11, -0.17, -0.2), part(box(0.03, 0.16, 0.16), '#2a231b', -0.11, -0.17, -0.2)]],
};
/** A crew's kit as [bone name, one geometry] pairs: one draw call per bone that carries something. */
export function kitFor(crew) {
  const byBone = new Map();
  for (const id of crew.kit) { const [bone, parts] = KIT[id](crew); byBone.set(bone, [...(byBone.get(bone) || []), ...parts]); }
  return [...byBone].map(([bone, parts]) => [bone, mergeGeometries(parts)]);
}
/** A kit geometry hung on a bone. Bones are in centimetres, so the mount scales metres up to them. */
export function hang(bone, geometry) {
  const mount = new THREE.Group(), mesh = new THREE.Mesh(geometry, KIT_MAT);
  mount.scale.setScalar(100); mesh.castShadow = true; mount.add(mesh); bone.add(mount);
  return mount;
}
