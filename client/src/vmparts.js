// Parts the modelled firearms share. They are all built on the carbine's ergonomic skeleton — bore on the z axis, the
// same pistol grip in the same place, the trigger and magazine well where a hand expects them — so one set of hand
// poses fits every long gun.
import * as THREE from 'three';
import { FIN, rbox, sideExtrude, axisExtrude, cyl } from './vmkit.js';

export const H = Math.PI / 2;
export const oct = (R, cy = 0) => Array.from({ length: 8 }, (_, k) => { const a = (22.5 + k * 45) * Math.PI / 180, r = R / Math.cos(Math.PI / 8); return [Math.cos(a) * r, cy + Math.sin(a) * r]; });
export const circle = (r, n = 14, cx = 0, cy = 0) => Array.from({ length: n }, (_, k) => { const a = k / n * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
export const stadium = (cf, cy, len, w, n = 5) => {
  const out = [], r = w / 2, h = len / 2 - r;
  for (let i = 0; i <= n; i++) { const a = -H + i / n * Math.PI; out.push([cf + h + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  for (let i = 0; i <= n; i++) { const a = H + i / n * Math.PI; out.push([cf - h + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
};

// more finishes for the newer guns
export const FINX = {
  od: { c: new THREE.Color(0x3d4430), m: 0, r: 0.72, b: 1 },           // olive-drab composite stock
  odDark: { c: new THREE.Color(0x3a402c), m: 0, r: 0.74, b: 1 },
  tan: { c: new THREE.Color(0x8a7a5c), m: 0, r: 0.74, b: 1 },
  hull: { c: new THREE.Color(0x8e2a22), m: 0, r: 0.5, b: 0.4 },        // shotgun shell body
  nickel: { c: new THREE.Color(0x8f8f8a), m: 1, r: 0.34, b: 0.2 },
  glassBlue: { c: new THREE.Color(0x1a2a3e), m: 0.9, r: 0.06, b: 0 },   // coated lens
};

/** The carbine's pistol grip, floor plate and checkering: the firing-hand pose is authored against this shape. */
export function pistolGrip(B, fin = FIN.poly) {
  B.add(fin, sideExtrude([[-0.047, -0.064], [-0.052, -0.09], [-0.071, -0.158], [-0.076, -0.166], [-0.108, -0.167], [-0.114, -0.158], [-0.103, -0.104], [-0.099, -0.075], [-0.108, -0.06], [-0.1, -0.054], [-0.09, -0.058]], 0.0295, 0.0065, { round: true }));
  B.add(fin, rbox(0.0305, 0.006, 0.04, 0.002, 2), 0, -0.1645, -0.0925, 0.02);
  for (let i = 0; i < 9; i++) B.both(FIN.hole, () => rbox(0.0009, 0.0015, 0.021, 0.0002), 0.0151, -0.086 - i * 0.008, -0.079 - i * 0.0019);
}
/** Trigger guard and trigger in the carbine's place (guard from f = -0.046 to 0.034, y = -0.066 to -0.098). */
export function triggerGroup(B, fin = FIN.anod) {
  B.add(fin, sideExtrude([[0.034, -0.066], [0.036, -0.098], [-0.046, -0.098], [-0.049, -0.066], [-0.045, -0.066], [-0.0425, -0.0942], [0.0322, -0.0942], [0.0302, -0.066]], 0.011, 0.001));
  B.add(FIN.phos, sideExtrude([[-0.012, -0.066], [-0.005, -0.066], [-0.002, -0.078], [-0.0045, -0.088], [-0.0085, -0.089], [-0.0075, -0.078]], 0.0065, 0.0012, { round: true }));
}
/** Accessory rail with its cross slots: base from y0 up, f0..f1. */
export function topRail(B, f0, f1, y0, fin = FIN.anod) {
  B.add(fin, axisExtrude([[-0.0084, y0], [0.0084, y0], [0.0084, y0 + 0.0043], [0.0106, y0 + 0.0065], [-0.0106, y0 + 0.0065], [-0.0084, y0 + 0.0043]], f0, f1, 0.0005));
  const tooth = [[-0.0106, y0 + 0.0065], [0.0106, y0 + 0.0065], [0.008, y0 + 0.0095], [-0.008, y0 + 0.0095]];
  for (let f = f0 + 0.002; f + 0.0053 < f1; f += 0.01) B.add(fin, axisExtrude(tooth, f, f + 0.0053, 0.0004));
}
/** Cross pin heads on both sides. */
export const pins = (B, list, x, r = 0.0034) => { for (const [f, y] of list) B.both(FIN.steel, () => cyl(r, 0.0014, 10, 0.0004), x, y, f, 0, H, 0); };
/** A folded back-up sight block on a rail whose top is at y. */
export function foldedSight(B, f, y, fin = FIN.anod) {
  B.add(fin, rbox(0.0212, 0.007, 0.03, 0.0012), 0, y + 0.0035, f);
  B.add(fin, rbox(0.0115, 0.0052, 0.036, 0.0014), 0, y + 0.0093, f - 0.004);
  B.add(FIN.phos, cyl(0.0024, 0.0225, 8, 0.0004), 0, y + 0.006, f + 0.012, 0, H, 0);
}
/** A round lens for the collimated-reticle material (see lensMaterial in viewmodel.js). */
export function roundLens(y, f, r) {
  const lens = new THREE.Mesh(new THREE.CircleGeometry(r, 28), null);
  lens.position.set(0, y, -f); lens.renderOrder = 8; lens.frustumCulled = false;
  return lens;
}
/** Moves a built mesh into a group whose origin is `pivot` (for magazines, bolts, slides). */
export function pivoted(mesh, pivot = [0, 0, 0]) {
  mesh.geometry.translate(-pivot[0], -pivot[1], -pivot[2]);
  const g = new THREE.Group(); g.position.set(...pivot); g.add(mesh);
  return g;
}
