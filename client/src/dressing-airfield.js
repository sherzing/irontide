// Scenery for an airfield: hangar roofs, aircraft, ground vehicles, the control tower, a radome, fuel tanks,
// chain-link fencing, a windsock, sandbags, approach lights and the tree line beyond the wire.
// Visual only, like everything in dressing.js: the level's solids are what a player touches.
//   hangar · aircraft · vehicle · tower · radome · latticeMast · fence · fuelTanks · windsock · sandbags
//   approach · treeline · ridge · taxiSign
import * as THREE from 'three';

const rad = THREE.MathUtils.degToRad;

export function addAirfieldBuilders(B, { rng }) {
  /** Everything of a hangar above its walls: pitched roof, gables, trusses, window bands, lamps, the number. Ridge runs along z; the big door is in the z1 gable. */
  B.hangar = (k, o) => {
    const { x0, x1, z0, z1, eave = 8, ridge = 11.6, tint = '#9aa7ab', roof = '#6c777a', num = null, lit = true } = o;
    const xm = (x0 + x1) / 2, hw = (x1 - x0) / 2, rise = ridge - eave, slope = Math.atan2(rise, hw), sl = Math.hypot(hw, rise), zl = z1 - z0, zm = (z0 + z1) / 2, G = '#5d6367';
    for (const s of [-1, 1]) k.box('cladding', xm + s * hw / 2, eave + rise / 2 + 0.07, zm, sl + 0.7, 0.14, zl + 1.4, roof, 0, 0, -s * slope);
    k.box('steel', xm, ridge + 0.14, zm, 0.9, 0.2, zl + 1.4, G);
    for (let z = z0 + 5; z < z1 - 3; z += 9) k.box('cladding', xm, ridge + 0.5, z, 1.5, 0.7, 2.6, roof);                 // ridge vents
    for (const [z, out] of [[z1, 1], [z0, -1]]) {                                                                         // gable ends, seen from outside and from inside
      const A = [x0, eave, z + out * 0.02], Bp = [x1, eave, z + out * 0.02], C = [xm, ridge, z + out * 0.02];
      if (out > 0) { k.quad('cladding', A, Bp, C, C, tint, 2.4); k.quad('cladding', [x1, eave, z - 0.13], [x0, eave, z - 0.13], [xm, ridge, z - 0.13], [xm, ridge, z - 0.13], tint, 2.4); }
      else { k.quad('cladding', Bp, A, C, C, tint, 2.4); k.quad('cladding', [x0, eave, z + 0.13], [x1, eave, z + 0.13], [xm, ridge, z + 0.13], [xm, ridge, z + 0.13], tint, 2.4); }
    }
    for (let z = z0 + 0.4; z <= z1 - 0.3; z += (zl - 0.8) / Math.round(zl / 6)) {                                           // roof trusses
      k.beam('steel', [x0 + 0.2, eave - 0.12, z], [x1 - 0.2, eave - 0.12, z], 0.14, 0.22, G);
      for (const s of [-1, 1]) {
        k.beam('steel', [xm + s * (hw - 0.2), eave - 0.05, z], [xm, ridge - 0.25, z], 0.12, 0.2, G);
        for (const t of [0.33, 0.66]) { const x = xm + s * hw * t, y = eave + rise * (1 - t) - 0.25; k.beam('steel', [x, eave - 0.1, z], [x, y, z], 0.07, 0.07, G); k.beam('steel', [x, eave - 0.1, z], [xm + s * hw * (t - 0.33), eave + rise * (1.33 - t) - 0.25, z], 0.07, 0.07, G); }
      }
    }
    for (const s of [-1, 1]) {                                                                                             // high window bands and downpipes along the side walls
      const x = s < 0 ? x0 : x1;
      for (let z = z0 + 3.5; z < z1 - 3; z += 6) for (const d of [-0.17, 0.17]) k.box('glass', x + d, 6.3, z, 0.04, 1.3, 3.6, '#ffffff');
      for (const z of [z0 + 0.5, zm, z1 - 0.5]) k.cyl('steel', [x + s * 0.24, 0, z], [x + s * 0.24, eave, z], 0.06, 0.06, G, 6);
      k.box('steel', x + s * 0.3, eave + 0.02, zm, 0.26, 0.16, zl + 1, G);
    }
    if (lit) for (let z = z0 + 7; z < z1 - 4; z += 11) for (const s of [-0.5, 0.5]) { k.cyl('dark', [xm + s * hw, eave - 0.2, z], [xm + s * hw, eave - 1.1, z], 0.015, 0.015, '#111', 4); k.box('dark', xm + s * hw, eave - 1.18, z, 0.9, 0.14, 0.5, '#1b1d1f'); k.box('glow', xm + s * hw, eave - 1.26, z, 0.8, 0.02, 0.4, [5, 4.7, 4.1]); }
    if (lit) { k.light(xm - hw * 0.5, eave - 2.2, zm, 0xfff1dc, 70, 30, { glow: 0.5, range: 6, bulb: false, priority: 1 }); k.light(xm + hw * 0.5, eave - 2.2, zm, 0xfff1dc, 70, 30, { glow: 0.5, range: 6, bulb: false, priority: 1 }); }
    if (num != null) { k.sign(String(num), xm, eave + rise * 0.42, z1 + 0.06, { h: 2.0, color: '#e9e4d6', worn: 0.6 }); k.sign(`HANGAR ${num}`, xm, eave - 0.6, z0 - 0.19, { h: 0.6, color: '#e9e4d6', worn: 0.6, yaw: Math.PI }); }
    for (const s of [-1, 1]) { k.box('dark', xm + s * (hw - 3), eave - 0.5, z1 + 0.32, 0.8, 0.3, 0.5, '#1b1d1f', 0.5); }           // apron floodlights (off by day)
  };

  // ------------------------------------------------------------------ shared shapes
  const PI = Math.PI, TOP = 1.5 * PI, M4 = () => new THREE.Matrix4();
  /** A wing, fin or tailplane: an aerofoil section lofted through stations [{ x: leading edge, y, z, c: chord, t: thickness ratio }]. The chord runs back along -x. */
  const AERO = [[0, 0], [0.012, 0.3], [0.05, 0.56], [0.14, 0.82], [0.3, 1], [0.5, 0.9], [0.75, 0.52], [1, 0.05], [1, -0.05], [0.75, -0.2], [0.5, -0.32], [0.3, -0.38], [0.14, -0.36], [0.05, -0.27], [0.012, -0.15]];
  function loft(st) {
    const m = AERO.length, pos = [], idx = [];
    for (const s of st) for (const [u, v] of AERO) pos.push(s.x - u * s.c, s.y + v * s.c * (s.t ?? 0.075), s.z);
    for (let i = 0; i < st.length - 1; i++) for (let j = 0; j < m; j++) { const a = i * m + j, b = i * m + (j + 1) % m, c = a + m, d = b + m; idx.push(a, c, b, b, c, d); }
    for (const i of [0, st.length - 1]) { const o = i * m; for (let j = 1; j < m - 1; j++) idx.push(o, o + j, o + j + 1); }      // end caps
    let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g = g.toNonIndexed();
    // face outwards whichever way the stations run: flip every triangle if the enclosed volume comes out negative
    const P = g.attributes.position; let vol = 0; const A = new THREE.Vector3(), Bv = new THREE.Vector3(), C = new THREE.Vector3();
    for (let i = 0; i < P.count; i += 3) { A.fromBufferAttribute(P, i); Bv.fromBufferAttribute(P, i + 1); C.fromBufferAttribute(P, i + 2); vol += A.dot(Bv.cross(C)); }
    if (vol < 0) for (let i = 0; i < P.count; i += 3) { A.fromBufferAttribute(P, i + 1); C.fromBufferAttribute(P, i + 2); P.setXYZ(i + 1, C.x, C.y, C.z); P.setXYZ(i + 2, A.x, A.y, A.z); }
    g.computeVertexNormals(); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(P.count * 2), 2));
    return g;
  }
  /** A road wheel on an axle across the vehicle: tyre with rounded shoulders, dished rim, hub. out = +1 / -1: which side faces outwards. */
  function wheel(k, x, y, z, r, w, out, rim = '#b9bcbe') {
    const rot = [0, -out * PI / 2, 0], at = [x, y, z], h = w / 2;
    k.lathe('dark', [[-h + 0.012, r * 0.6], [-h, r * 0.72], [-h, r - 0.05], [-h + 0.035, r - 0.008], [-h + 0.06, r], [h - 0.06, r], [h - 0.035, r - 0.008], [h, r - 0.05], [h, r * 0.72], [h - 0.012, r * 0.6]], '#0e0e0f', { seg: 18, rot, at });
    k.lathe('gloss', [[h - 0.075, 0.001], [h - 0.075, r * 0.22], [h - 0.05, r * 0.3], [h - 0.03, r * 0.5], [h - 0.012, r * 0.6]], rim, { seg: 18, rot, at });
    k.lathe('dark', [[h - 0.07, 0.001], [h - 0.03, r * 0.1], [h - 0.03, r * 0.16], [h - 0.072, r * 0.2]], '#2a2c2e', { seg: 12, rot, at });
    for (let i = 0; i < 6; i++) { const a = i * PI / 3; k.box('dark', x + Math.cos(a) * r * 0.36, y + Math.sin(a) * r * 0.36, z + out * (h - 0.058), 0.03, 0.03, 0.02, '#3a3c3e'); }      // wheel nuts
  }
  /** One propeller: spinner and n blades with some pitch on them. bent = a blade folded back (belly landing). */
  function propeller(k, x, y, z, r, n, a0, color, bent = 0) {
    k.lathe('gloss', [[x - 0.16, r * 0.16], [x, r * 0.16], [x + 0.22, r * 0.13], [x + 0.42, r * 0.07], [x + 0.5, 0.004]], '#d8d5cb', { seg: 16, at: [0, y, z] });
    for (let b = 0; b < n; b++) {
      const a = a0 + b * 2 * PI / n, g = new THREE.SphereGeometry(1, 10, 6);
      const m = M4().makeRotationX(a).multiply(M4().makeRotationZ(b === 0 ? -bent : 0)).multiply(M4().makeTranslation(0, r * 0.56, 0)).multiply(M4().makeRotationY(0.5)).multiply(M4().makeScale(0.03, r * 0.5, r * 0.085));
      k.put('dark', g, color, m.premultiply(M4().makeTranslation(x + 0.06, y, z)));
      const tip = new THREE.SphereGeometry(1, 8, 4, 0, PI * 2, 0, 0.5);
      k.put('gloss', tip, '#d9a81c', M4().makeRotationX(a).multiply(M4().makeRotationZ(b === 0 ? -bent : 0)).multiply(M4().makeTranslation(0, r * 0.56, 0)).multiply(M4().makeRotationY(0.5)).multiply(M4().makeScale(0.032, r * 0.505, r * 0.088)).premultiply(M4().makeTranslation(x + 0.06, y, z)));
    }
  }

  /**
   * An aircraft. Local +x is the nose. kind 'cargo' = twin turboprop freighter (21 m), 'light' = four-seat high-wing (8 m).
   * wreck: gear collapsed, lying on its belly with one wing down. livery: { base, belly, stripe, tail }
   */
  B.aircraft = (k, o) => {
    const { x, z, yaw = 0, kind: type = 'cargo', wreck = false, reg = 'TAC 207', name = 'TERN AIR FREIGHT' } = o;
    const lv = { base: '#d9d6cc', belly: '#8f959a', stripe: '#b8452e', tail: '#274a5e', ...(o.livery || {}) }, DK = '#17191c', GLASS = '#ffffff';
    k.push(x, 0, z, yaw);
    if (wreck) k.pushM(M4().makeRotationFromEuler(new THREE.Euler(rad(type === 'cargo' ? 8 : 10), 0, rad(2.2), 'YXZ')).setPosition(0, type === 'cargo' ? -0.72 : -0.55, 0));
    if (type === 'cargo') {
      const yc = 2.25, at = [0, yc, 0];
      const F = [[-11.0, 0.16], [-10.7, 0.34], [-9.6, 0.6], [-8.0, 0.92], [-6.0, 1.22], [-4.2, 1.38], [-3.0, 1.42], [5.6, 1.42], [6.6, 1.38], [7.5, 1.24], [8.3, 1.02], [9.0, 0.76], [9.5, 0.5], [9.85, 0.26], [10.0, 0.03]];
      const bend = (px) => (px < -3 ? Math.pow((-3 - px) / 8, 1.6) * 1.05 : px > 6.5 ? -Math.pow((px - 6.5) / 3.5, 2) * 0.28 : 0);
      const skin = (x0, x1, lift) => { const out = [], R = (px) => { for (let i = 0; i < F.length - 1; i++) if (px <= F[i + 1][0]) { const t = (px - F[i][0]) / (F[i + 1][0] - F[i][0]); return F[i][1] + (F[i + 1][1] - F[i][1]) * t; } return 0.03; };
        const n = Math.max(2, Math.ceil((x1 - x0) / 0.35)); for (let i = 0; i <= n; i++) { const px = x0 + (x1 - x0) * i / n; out.push([px, R(px) + lift]); } return out; };
      const band = (mat, x0, x1, phi0, phiLen, c, lift = 0.006, seg = 6) => k.lathe(mat, skin(x0, x1, lift), c, { seg, phi0, phiLen, bend, at });
      k.lathe('gloss', F, lv.base, { seg: 28, bend, at });                                                     // fuselage
      band('gloss', -9.4, 8.9, PI / 2 - 0.95, 1.9, lv.belly, 0.005, 10);                                       // grey underside
      band('gloss', 9.2, 10.0, 0, 2 * PI, '#3c4044', 0.014, 28);                                               // radome
      for (const [p0, side] of [[0, -1], [PI, 1]]) {
        band('gloss', -9.0, 8.6, p0 + side * 0.34 - 0.07, 0.14, lv.stripe); band('gloss', -9.0, 8.6, p0 + side * 0.21 - 0.02, 0.04, lv.tail);    // cheat lines
        for (let wx = -1.6; wx < 5.8; wx += 1.18) { band('glass', wx, wx + 0.44, p0 + side * 0.6 - 0.1, 0.2, GLASS, 0.008, 3); band('gloss', wx - 0.03, wx + 0.47, p0 + side * 0.6 - 0.115, 0.23, '#6f7478', 0.004, 3); }
        band('dark', 6.05, 6.09, p0 + side * 0.35 - 0.5, 1.0, DK, 0.007, 4); band('dark', 6.95, 6.99, p0 + side * 0.35 - 0.5, 1.0, DK, 0.007, 4);             // crew door
        band('dark', 6.05, 6.99, p0 + side * 0.85 - 0.006, 0.012, DK, 0.007, 2);
      }
      for (const [a0, a1] of [[-1.22, -0.74], [-0.68, -0.03], [0.03, 0.68], [0.74, 1.22]]) band('glass', 7.72, 8.62, TOP + a0, a1 - a0, GLASS, 0.008, 4);    // flight-deck glazing
      band('gloss', 7.66, 8.68, TOP - 1.28, 2.56, '#30343a', 0.004, 12);
      band('dark', -5.9, -5.86, PI - 0.5 + 0.35, 1.05, DK, 0.007, 4); band('dark', -3.5, -3.46, PI - 0.5 + 0.35, 1.05, DK, 0.007, 4); band('dark', -5.9, -3.46, PI + 0.9 - 0.006, 0.012, DK, 0.007, 2);   // freight door
      // wing with its centre fairing, engines, tailplane and fin
      const wy = yc + 1.3;
      k.rbox('gloss', -0.45, wy + 0.06, 0, 3.7, 0.5, 2.5, 0.22, lv.base);
      for (const s of [-1, 1]) {
        k.put('gloss', loft([{ x: 1.15, y: wy, z: 0, c: 3.3, t: 0.085 }, { x: 1.1, y: wy + 0.04, z: s * 1.4, c: 3.2, t: 0.085 }, { x: 0.95, y: wy + 0.16, z: s * 4.9, c: 3.0, t: 0.08 }, { x: 0.6, y: wy + 0.42, z: s * 13.3, c: 1.75, t: 0.07 }, { x: 0.45, y: wy + 0.45, z: s * 13.62, c: 1.2, t: 0.05 }]), lv.base);
        k.box('dark', -1.42, wy + 0.2, s * 3.1, 0.02, 0.012, 3.2, '#5a5e62', 0, s * 0.017, 0); k.box('dark', -1.25, wy + 0.34, s * 9.6, 0.02, 0.012, 7.0, '#5a5e62', 0, s * 0.045, s * 0.03);     // flap and aileron gaps
        k.box('gloss', 0.5, wy + 0.47, s * 13.6, 1.25, 0.05, 0.05, s > 0 ? '#2f7a4a' : lv.stripe);
        const ez = s * 4.9, ey = wy - 0.34;
        k.lathe('gloss', [[-3.0, 0.1], [-2.6, 0.36], [-1.4, 0.56], [1.0, 0.62], [2.1, 0.58], [2.5, 0.5], [2.62, 0.4]], lv.base, { seg: 20, at: [0.2, ey, ez] });
        k.lathe('dark', [[2.4, 0.3], [2.62, 0.4], [2.66, 0.36], [2.5, 0.26]], '#0d0e10', { seg: 20, at: [0.2, ey, ez] });                              // intake lip
        k.lathe('gloss', [[-2.6, 0.37], [2.3, 0.6]], lv.belly, { seg: 6, phi0: PI / 2 - 0.7, phiLen: 1.4, at: [0.2, ey - 0.004, ez] });
        k.cyl('dark', [-0.6, ey - 0.1, ez + s * 0.62], [-1.5, ey - 0.16, ez + s * 0.74], 0.11, 0.1, '#2a2622', 10);                                     // exhaust stub
        k.box('dark', 0.9, ey - 0.6, ez, 1.1, 0.04, 0.36, '#101214');
        propeller(k, 2.86, ey, ez, 1.92, 4, s > 0 ? 0.3 : 0.9, '#1a1c1f', wreck && s < 0 ? 0.6 : 0);
        k.lathe('gloss', [[-2.7, 0.1], [-2.0, 0.42], [-0.6, 0.54], [0.7, 0.5], [1.5, 0.3], [1.85, 0.08]], lv.belly, { seg: 16, squash: [0.82, 1], at: [-0.3, yc - 0.98, s * 1.52] });   // main-gear sponson
        if (!wreck) {
          k.cyl('steel', [-0.55, yc - 1.1, s * 1.86], [-0.55, 0.52, s * 1.9], 0.07, 0.055, '#a9acae', 8); k.cyl('steel', [-1.1, 0.52, s * 1.9], [0.0, 0.52, s * 1.9], 0.05, 0.05, '#8a8d8f', 6);
          for (const wx of [-1.1, 0.0]) wheel(k, wx, 0.5, s * 1.94, 0.5, 0.3, s, '#c9ccce');
          for (const wx of [-1.55, 0.45]) k.box('gloss', wx, 0.09, s * 1.94, 0.26, 0.18, 0.5, '#d9a81c', 0, 0, wx < -1 ? 0.5 : -0.5);                  // chocks
        }
        k.put('gloss', loft([{ x: -7.9, y: yc + 1.2, z: 0, c: 2.5, t: 0.07 }, { x: -8.5, y: yc + 1.28, z: s * 4.5, c: 1.25, t: 0.06 }, { x: -8.6, y: yc + 1.29, z: s * 4.68, c: 0.8, t: 0.045 }]), lv.base);
        k.sign(reg, -6.2, yc + 0.98, s * 1.13, { h: 0.42, color: '#22262a', yaw: s > 0 ? 0 : Math.PI, worn: 0.3 });
        k.sign(name, 2.3, yc + 1.08, s * 1.0, { h: 0.24, color: lv.tail, yaw: s > 0 ? 0 : Math.PI, worn: 0.3 });
        k.lamp(0.7, wy + 0.48, s * 13.66, s > 0 ? [0.3, 6, 1.5] : [7, 0.4, 0.3], 0.06);
        k.cyl('steel', [9.3, yc - 0.52, s * 0.42], [9.72, yc - 0.56, s * 0.44], 0.014, 0.01, '#8a8d8f', 5);                                             // pitot probes
      }
      { const fin = loft([{ x: -6.6, y: 0, z: 0, c: 4.3, t: 0.06 }, { x: -8.3, y: 0, z: 3.0, c: 2.6, t: 0.055 }, { x: -9.5, y: 0, z: 4.75, c: 1.7, t: 0.05 }, { x: -9.75, y: 0, z: 4.95, c: 1.2, t: 0.04 }]);
        fin.applyMatrix4(M4().makeRotationX(-PI / 2).setPosition(0, yc + 1.05, 0)); k.put('gloss', fin, lv.tail); }
      for (const s of [-1, 1]) { k.box('gloss', -9.85, yc + 4.2, s * 0.085, 1.05, 1.05, 0.012, '#e3dfd2'); k.box('gloss', -9.3, yc + 2.4, s * 0.12, 2.6, 0.16, 0.012, lv.stripe, 0, 0, -0.52); }      // the line's mark on the fin
      k.box('gloss', 2.6, yc + 1.5, 0, 0.5, 0.2, 0.03, '#d9d6cc', 0, 0, -0.3); k.box('gloss', -2.6, yc + 1.62, 0, 0.4, 0.26, 0.03, '#d9d6cc', 0, 0, -0.3);   // blade aerials
      k.lamp(-1.2, yc + 1.66, 0, [9, 0.5, 0.3], 0.07, { period: 1.4, duty: 0.2 });
      if (!wreck) {
        k.cyl('steel', [6.95, yc - 1.2, 0], [6.95, 0.36, 0], 0.06, 0.05, '#a9acae', 8); k.beam('steel', [6.95, 0.9, 0], [6.4, 1.35, 0], 0.04, 0.05, '#8a8d8f');
        for (const s of [-1, 1]) { wheel(k, 6.95, 0.34, s * 0.2, 0.34, 0.2, s, '#c9ccce'); k.box('gloss', 6.6, yc - 1.42, s * 0.36, 1.5, 0.5, 0.02, lv.belly, 0, 0, 0); }
      }
    } else {
      const yc = 1.52, at = [0, yc, 0], bend = (px) => (px < -0.6 ? ((-0.6 - px) / 4.3) * 0.3 : 0);
      const F = [[-4.9, 0.06], [-4.4, 0.14], [-3.0, 0.27], [-1.6, 0.46], [-0.6, 0.62], [1.3, 0.62], [2.0, 0.56], [2.55, 0.42], [2.66, 0.3]];
      k.lathe('gloss', F, lv.base, { seg: 20, bend, at, squash: [0.96, 0.9] });
      k.lathe('dark', [[2.6, 0.001], [2.66, 0.3]], '#101214', { seg: 16, at, squash: [0.96, 0.9] });                                                   // cowl front
      for (const [p0, side] of [[0, -1], [PI, 1]]) {
        k.lathe('gloss', [[-3.4, 0.24], [-1.6, 0.47], [-0.6, 0.628], [2.3, 0.54]], lv.stripe, { seg: 3, phi0: p0 + side * 0.12 - 0.07, phiLen: 0.14, bend, at, squash: [0.96, 0.9] });
        k.lathe('glass', [[-0.75, 0.628], [0.72, 0.628]], GLASS, { seg: 4, phi0: p0 + side * 0.72 - 0.34, phiLen: 0.68, at, squash: [0.96, 0.9] });       // side windows
        k.lathe('dark', [[-0.02, 0.632], [0.02, 0.632]], DK, { seg: 4, phi0: p0 + side * 0.72 - 0.36, phiLen: 0.72, at, squash: [0.96, 0.9] });
      }
      k.lathe('glass', [[0.74, 0.63], [1.32, 0.626], [1.68, 0.6]], GLASS, { seg: 10, phi0: TOP - 1.3, phiLen: 2.6, at, squash: [0.96, 0.9] });           // windscreen
      k.lathe('glass', [[-1.1, 0.56], [-0.78, 0.628]], GLASS, { seg: 8, phi0: TOP - 1.1, phiLen: 2.2, at, squash: [0.96, 0.9] });                        // rear window
      const wy = yc + 0.66;
      for (const s of [-1, 1]) {
        k.put('gloss', loft([{ x: 0.95, y: wy, z: 0, c: 1.62, t: 0.1 }, { x: 0.95, y: wy + 0.03, z: s * 2.4, c: 1.62, t: 0.1 }, { x: 0.84, y: wy + 0.08, z: s * 5.3, c: 1.2, t: 0.085 }, { x: 0.76, y: wy + 0.09, z: s * 5.45, c: 0.8, t: 0.06 }]), lv.base);
        k.beam('gloss', [0.45, yc - 0.42, s * 0.56], [0.42, wy - 0.04, s * 2.5], 0.035, 0.11, lv.base);                                                 // wing strut
        k.box('gloss', 0.5, wy + 0.1, s * 5.42, 0.8, 0.04, 0.04, s > 0 ? '#2f7a4a' : lv.stripe);
        if (!wreck) {
          k.beam('gloss', [0.15, yc - 0.44, s * 0.4], [0.05, 0.42, s * 1.18], 0.05, 0.16, lv.base);                                                    // spring gear leg
          wheel(k, 0.05, 0.27, s * 1.22, 0.27, 0.15, s, '#d9d6cc');
          k.lathe('gloss', [[-0.5, 0.03], [-0.25, 0.2], [0.1, 0.25], [0.36, 0.16], [0.48, 0.03]], lv.stripe, { seg: 12, phi0: PI, phiLen: PI, squash: [1, 0.62], at: [0.05, 0.3, s * 1.22] });    // spat
        }
        k.put('gloss', loft([{ x: -3.9, y: yc + 0.42, z: 0, c: 1.05, t: 0.07 }, { x: -4.05, y: yc + 0.43, z: s * 1.7, c: 0.75, t: 0.06 }, { x: -4.1, y: yc + 0.43, z: s * 1.8, c: 0.5, t: 0.04 }]), lv.base);
        k.sign(reg, -2.4, yc + 0.2, s * 0.37, { h: 0.24, color: '#22262a', yaw: s > 0 ? 0 : Math.PI, worn: 0.3 });
      }
      { const fin = loft([{ x: -3.5, y: 0, z: 0, c: 1.5, t: 0.06 }, { x: -4.25, y: 0, z: 1.25, c: 0.85, t: 0.05 }, { x: -4.4, y: 0, z: 1.38, c: 0.55, t: 0.04 }]);
        fin.applyMatrix4(M4().makeRotationX(-PI / 2).setPosition(0, yc + 0.42, 0)); k.put('gloss', fin, lv.tail); }
      propeller(k, 2.66, yc, 0, 0.96, 2, 0.5, '#1a1c1f', wreck ? 0.5 : 0);
      if (!wreck) { k.cyl('steel', [2.15, yc - 0.42, 0], [2.3, 0.3, 0], 0.04, 0.035, '#a9acae', 6); wheel(k, 2.3, 0.24, 0.07, 0.24, 0.13, 1, '#d9d6cc'); k.box('gloss', 2.7, 0.07, 0, 0.2, 0.14, 0.4, '#d9a81c', 0, 0, -0.5); }
      k.lamp(-0.4, yc + 0.84, 0, [9, 0.5, 0.3], 0.05, { period: 1.4, duty: 0.2 });
    }
    if (wreck) k.pop();
    k.pop();
  };

  /** Ground vehicles. Local +x is the front. kind: truck · bowser · tender · pickup · tug · cart · stairs */
  B.vehicle = (k, o) => {
    const { x, z, yaw = 0, kind: type = 'truck', color = '#5d6a4f', text = null } = o, DK = '#17191b', TRIM = '#232527', LAMP = '#e9e6dc', RED = '#9c1f18', G = '#ffffff';
    k.push(x, 0, z, yaw);
    const axles = (xs, hw, r, w, rim) => { for (const wx of xs) { for (const s of [-1, 1]) wheel(k, wx, r, s * hw, r, w, s, rim); k.cyl('dark', [wx, r, -hw + w / 2], [wx, r, hw - w / 2], 0.06, 0.06, '#1c1d1e', 6); } };
    /** A forward-control cab: pressed-steel box with a raked screen, grille, lamps, mirrors and door lines. */
    const cab = (cx, w, h, len, c, y0 = 0.78) => {
      const f = cx + len / 2, top = y0 + h;
      k.rbox('gloss', cx, y0 + h / 2, 0, len, h, w, 0.12, c);
      k.box('glass', f - 0.02, y0 + h * 0.7, 0, 0.06, h * 0.42, w - 0.34, G, 0, 0, 0.12); k.box('dark', f - 0.035, y0 + h * 0.7, 0, 0.05, h * 0.47, w - 0.26, TRIM, 0, 0, 0.12);     // windscreen in its rubber
      for (const s of [-1, 1]) {
        k.box('glass', cx + len * 0.14, y0 + h * 0.7, s * (w / 2 - 0.005), len * 0.46, h * 0.36, 0.03, G); k.box('dark', cx + len * 0.14, y0 + h * 0.7, s * (w / 2 - 0.012), len * 0.5, h * 0.4, 0.03, TRIM);
        k.box('dark', cx - len * 0.12, y0 + h * 0.46, s * (w / 2 + 0.002), 0.012, h * 0.86, 0.01, TRIM); k.box('dark', cx + len * 0.4, y0 + h * 0.3, s * (w / 2 + 0.002), 0.012, h * 0.5, 0.01, TRIM);   // door shut lines
        k.box('steel', cx + len * 0.06, y0 + h * 0.44, s * (w / 2 + 0.012), 0.12, 0.03, 0.02, '#8a8d8f');                                           // door handle
        k.cyl('gloss', [f + 0.012, y0 + 0.2, s * (w / 2 - 0.3)], [f + 0.05, y0 + 0.2, s * (w / 2 - 0.3)], 0.11, 0.1, LAMP, 12); k.box('gloss', f + 0.03, y0 + 0.2, s * (w / 2 - 0.1), 0.03, 0.1, 0.12, '#d98a1c');   // head and side lamps
        k.beam('dark', [f - 0.2, y0 + h * 0.74, s * (w / 2)], [f + 0.06, y0 + h * 0.8, s * (w / 2 + 0.24)], 0.02, 0.02, TRIM); k.rbox('dark', f + 0.07, y0 + h * 0.72, s * (w / 2 + 0.25), 0.04, 0.3, 0.16, 0.02, TRIM);   // mirror
        k.rbox('dark', cx + len * 0.18, y0 - 0.2, s * (w / 2 - 0.12), 0.5, 0.06, 0.24, 0.02, TRIM);                                                 // step
      }
      for (let i = 0; i < 5; i++) k.box('dark', f + 0.012, y0 + 0.36 + i * 0.05, 0, 0.02, 0.022, w * 0.42, TRIM);                                      // grille
      k.rbox('dark', f + 0.07, y0 - 0.08, 0, 0.16, 0.2, w + 0.04, 0.04, TRIM);                                                                      // bumper
      for (const s of [-0.4, 0, 0.4]) k.box('gloss', cx + len * 0.3, top + 0.025, s * w * 0.5, 0.06, 0.04, 0.05, '#d98a1c');                          // roof markers
    };
    const tails = (bx, w, y) => { for (const s of [-1, 1]) { k.box('gloss', bx - 0.012, y, s * (w / 2 - 0.14), 0.03, 0.09, 0.2, RED); k.box('gloss', bx - 0.012, y, s * (w / 2 - 0.34), 0.03, 0.09, 0.1, '#d98a1c'); k.rbox('dark', bx + 0.3, 0.34, s * (w / 2 - 0.16), 0.03, 0.42, 0.3, 0.01, TRIM); } k.rbox('dark', bx - 0.06, 0.5, 0, 0.1, 0.12, w, 0.03, TRIM); };
    if (type === 'truck' || type === 'bowser' || type === 'tender') {
      const c = type === 'tender' ? '#a8281c' : color, big = type === 'tender';
      if (!big) {
        k.box('dark', -0.2, 0.66, 0, 7.3, 0.2, 0.9, DK); cab(2.75, 2.4, 1.75, 1.9, c); axles([2.6], 1.2, 0.5, 0.3); axles([-1.6, -2.8], 1.18, 0.5, 0.52);
        k.cyl('dark', [0.4, 0.62, -1.02], [1.3, 0.62, -1.02], 0.24, 0.24, '#2c2e30', 12); k.rbox('dark', 0.8, 0.6, 1.0, 0.9, 0.42, 0.4, 0.04, TRIM);                // fuel tank, battery box
        k.cyl('dark', [1.62, 0.9, 0.95], [1.62, 2.9, 0.95], 0.06, 0.06, '#2a2622', 8);                                                                         // exhaust stack
      }
      if (type === 'truck') {
        k.box('dark', -1.35, 0.94, 0, 5.3, 0.1, 2.42, '#3a3d3f');
        for (const s of [-1, 1]) { k.rbox('gloss', -1.35, 1.34, s * 1.19, 5.3, 0.72, 0.06, 0.02, color); for (const px of [-3.9, -2.6, -1.35, -0.1, 1.2]) k.box('gloss', px, 1.34, s * 1.225, 0.07, 0.74, 0.03, color); }
        k.rbox('gloss', -3.98, 1.34, 0, 0.06, 0.72, 2.42, 0.02, color); k.rbox('gloss', 1.28, 1.5, 0, 0.06, 1.04, 2.42, 0.02, color);
        k.rbox('matte', -1.35, 2.2, 0, 5.24, 1.42, 2.38, 0.3, '#474b3a');                                                                                     // canvas tilt over its hoops
        for (const px of [-3.6, -2.1, -0.6, 0.9]) k.box('matte', px, 2.2, 0, 0.05, 1.46, 2.42, '#3a3e30');
        for (const s of [-1, 1]) for (const px of [-3.2, -1.4, 0.4]) k.cyl('dark', [px, 1.62, s * 1.2], [px, 1.1, s * 1.24], 0.012, 0.012, '#1a1a1a', 4);    // lashings
        tails(-4.0, 2.42, 0.86);
      } else if (type === 'bowser') {
        k.lathe('gloss', [[-2.66, 0.1], [-2.56, 0.5], [-2.3, 0.78], [-1.9, 0.88], [1.9, 0.88], [2.3, 0.78], [2.56, 0.5], [2.66, 0.1]], '#d2cfc4', { seg: 22, squash: [1, 1.26], at: [-1.35, 1.98, 0] });
        k.box('dark', -1.35, 1.05, 0, 5.3, 0.16, 2.1, '#3a3d3f'); for (const px of [-3.2, -1.35, 0.5]) k.rbox('dark', px, 1.2, 0, 0.2, 0.3, 1.9, 0.03, '#3a3d3f');
        k.box('grid', -1.35, 2.9, 0, 4.0, 0.04, 0.62, G); for (const px of [-2.6, -0.1]) k.cyl('gloss', [px, 2.86, 0], [px, 2.99, 0], 0.26, 0.26, '#b9bcbe', 14);                // walkway and filler lids
        for (const s of [-1, 1]) { k.rbox('gloss', -2.6, 1.02, s * 1.0, 1.5, 0.62, 0.4, 0.04, '#d2cfc4'); k.box('dark', -2.6, 1.02, s * 1.205, 1.3, 0.5, 0.01, TRIM); k.sign(text || 'JET A-1', -1.1, 2.0, s * 1.12, { h: 0.34, color: '#a8281c', yaw: s > 0 ? 0 : Math.PI, worn: 0.3 }); k.box('gloss', -1.35, 1.52, s * 1.105, 4.6, 0.09, 0.012, '#a8281c'); }
        k.cyl('dark', [-0.1, 1.0, 1.04], [-0.1, 1.0, 1.2], 0.3, 0.3, '#1c1d1e', 14);                                                                           // hose reel
        for (const s of [-0.36, 0.36]) k.cyl('steel', [-3.98, 0.9, s], [-3.98, 2.86, s], 0.02, 0.02, '#b9bcbe', 5); for (let y = 1.1; y < 2.8; y += 0.3) k.cyl('steel', [-3.98, y, -0.36], [-3.98, y, 0.36], 0.014, 0.014, '#b9bcbe', 4);
        k.box('hazard', -4.04, 0.86, 0, 0.04, 0.34, 2.2, G); tails(-4.02, 2.3, 1.16);
        k.sign('NO SMOKING', -4.06, 1.9, 0, { h: 0.16, color: '#f4f0e4', bg: '#a52a1e', yaw: -Math.PI / 2, worn: 0.2 });
      } else {
        // airfield crash tender: three axles, a deep screen, lockers with roller shutters, a monitor on the roof
        k.box('dark', -0.2, 0.86, 0, 8.0, 0.26, 1.2, DK); axles([2.7], 1.24, 0.6, 0.42, '#c9ccce'); axles([-1.5, -2.95], 1.24, 0.6, 0.42, '#c9ccce');
        k.rbox('gloss', -0.9, 2.02, 0, 6.3, 2.1, 2.5, 0.14, c); k.rbox('gloss', 3.05, 1.7, 0, 1.75, 1.46, 2.5, 0.2, c); k.rbox('gloss', 2.7, 2.66, 0, 1.3, 0.72, 2.4, 0.2, c);
        k.box('glass', 3.63, 2.36, 0, 0.06, 1.16, 2.2, G, 0, 0, 0.34); k.box('dark', 3.6, 2.36, 0, 0.05, 1.24, 2.3, TRIM, 0, 0, 0.34);
        for (const s of [-1, 1]) {
          k.box('glass', 2.75, 2.5, s * 1.255, 1.1, 0.72, 0.03, G); k.box('dark', 2.75, 2.5, s * 1.25, 1.18, 0.8, 0.03, TRIM);
          for (const px of [-3.1, -1.75, -0.4, 0.95]) { k.rbox('steel', px, 1.9, s * 1.258, 1.2, 1.5, 0.03, 0.01, '#b9bcbe'); for (let i = 0; i < 9; i++) k.box('dark', px, 1.26 + i * 0.16, s * 1.276, 1.16, 0.012, 0.01, '#6a6d70'); }
          k.box('gloss', -0.3, 1.05, s * 1.262, 7.6, 0.16, 0.012, '#e6c11c'); k.box('gloss', -0.3, 3.0, s * 1.262, 6.2, 0.1, 0.012, '#e9e6dc');
          k.cyl('gloss', [3.94, 1.3, s * 0.82], [3.99, 1.3, s * 0.82], 0.13, 0.12, LAMP, 12); k.box('gloss', 2.4, 3.1, s * 0.9, 0.5, 0.14, 0.22, '#2c4a9a');
          k.sign('RESCUE 2', -1.0, 2.86, s * 1.268, { h: 0.2, color: '#e9e6dc', yaw: s > 0 ? 0 : Math.PI, worn: 0.3 });
        }
        k.rbox('dark', 4.0, 0.86, 0, 0.2, 0.34, 2.56, 0.05, TRIM); k.cyl('steel', [3.9, 1.0, 0], [4.5, 1.14, 0], 0.07, 0.05, '#b9bcbe', 8);                         // bumper and its monitor
        k.cyl('gloss', [0.6, 3.08, 0], [0.6, 3.36, 0], 0.3, 0.26, c, 14); k.cyl('steel', [0.6, 3.36, 0], [2.3, 3.62, 0], 0.1, 0.07, '#b9bcbe', 10); k.cyl('steel', [2.3, 3.62, 0], [2.56, 3.66, 0], 0.11, 0.11, '#8a8d8f', 10);
        for (const s of [-0.4, 0.4]) k.cyl('steel', [-4.06, 0.9, s], [-4.06, 3.1, s], 0.022, 0.022, '#b9bcbe', 5); for (let y = 1.1; y < 3.1; y += 0.32) k.cyl('steel', [-4.06, y, -0.4], [-4.06, y, 0.4], 0.016, 0.016, '#b9bcbe', 4);
        k.box('hazard', -4.07, 1.3, 0, 0.03, 0.5, 2.3, G); tails(-4.06, 2.5, 2.0);
      }
    } else if (type === 'pickup') {
      axles([1.52, -1.5], 0.92, 0.4, 0.26);
      k.rbox('gloss', 0, 0.82, 0, 5.05, 0.62, 1.86, 0.14, color); k.rbox('gloss', 1.72, 1.02, 0, 1.5, 0.3, 1.8, 0.12, color);                                         // body, bonnet
      k.rbox('gloss', 0.25, 1.48, 0, 1.9, 0.74, 1.72, 0.2, color);                                                                                              // cab
      k.box('glass', 1.2, 1.5, 0, 0.05, 0.58, 1.5, G, 0, 0, 0.5); k.box('glass', -0.71, 1.5, 0, 0.05, 0.5, 1.46, G, 0, 0, -0.16);
      for (const s of [-1, 1]) {
        k.box('glass', 0.27, 1.52, s * 0.866, 1.5, 0.44, 0.03, G); k.box('dark', 0.27, 1.52, s * 0.862, 1.58, 0.52, 0.03, TRIM); k.box('dark', 0.26, 1.1, s * 0.936, 0.012, 0.9, 0.01, TRIM);
        k.box('steel', 0.0, 1.2, s * 0.94, 0.12, 0.03, 0.02, '#8a8d8f'); k.rbox('gloss', -1.62, 1.26, s * 0.9, 1.9, 0.34, 0.06, 0.02, color);
        k.rbox('dark', 1.52, 0.72, s * 0.9, 1.0, 0.56, 0.12, 0.2, TRIM); k.rbox('dark', -1.5, 0.72, s * 0.9, 1.0, 0.56, 0.12, 0.2, TRIM);                              // wheel-arch flares
        k.rbox('gloss', 2.5, 0.96, s * 0.66, 0.06, 0.16, 0.36, 0.03, LAMP); k.box('gloss', -2.52, 1.0, s * 0.82, 0.03, 0.3, 0.12, RED);
        k.rbox('dark', 0.86, 1.36, s * 1.0, 0.06, 0.16, 0.2, 0.02, TRIM);
      }
      k.rbox('gloss', -2.52, 1.2, 0, 0.06, 0.42, 1.76, 0.02, color); k.box('dark', -1.6, 1.06, 0, 1.84, 0.05, 1.68, DK);
      for (let i = 0; i < 4; i++) k.box('dark', 2.53, 0.86 + i * 0.06, 0, 0.02, 0.03, 0.8, TRIM); k.rbox('dark', 2.56, 0.6, 0, 0.14, 0.2, 1.9, 0.04, TRIM); k.rbox('dark', -2.56, 0.6, 0, 0.12, 0.18, 1.9, 0.04, TRIM);
      if (text) { k.rbox('dark', 0.2, 2.02, 0, 0.14, 0.4, 1.3, 0.03, '#141414'); for (const s of [-1, 1]) k.sign(text, 0.2 + s * 0.075, 2.02, 0, { h: 0.22, color: '#f2c230', yaw: s * Math.PI / 2, worn: 0.1 }); }
      k.rbox('gloss', 0.25, 1.9, 0, 0.5, 0.1, 0.9, 0.04, '#d98a1c');                                                                                           // beacon bar
    } else if (type === 'tug') {
      axles([0.95, -0.95], 0.74, 0.34, 0.24, '#d9d6cc');
      k.rbox('gloss', 0, 0.74, 0, 3.0, 0.62, 1.5, 0.1, color); k.rbox('gloss', 0.95, 1.12, 0, 1.0, 0.3, 1.4, 0.1, color); k.rbox('dark', -0.55, 1.2, 0, 0.6, 0.5, 1.1, 0.1, '#232527');     // body, bonnet, seat
      k.rbox('dark', -0.86, 1.56, 0, 0.14, 0.6, 1.1, 0.05, '#232527'); k.cyl('dark', [0.4, 1.2, 0.3], [0.2, 1.52, 0.3], 0.025, 0.025, '#333', 6);
      k.put('dark', new THREE.TorusGeometry(0.17, 0.022, 6, 14), '#1c1c1c', M4().makeRotationFromEuler(new THREE.Euler(0, PI / 2, 0.6)).setPosition(0.18, 1.56, 0.3));
      for (const s of [-1, 1]) { k.cyl('steel', [0.5, 1.04, s * 0.68], [0.36, 2.06, s * 0.66], 0.03, 0.03, '#3a3c3e', 6); k.cyl('steel', [-1.2, 1.04, s * 0.68], [-1.1, 2.06, s * 0.66], 0.03, 0.03, '#3a3c3e', 6); k.rbox('gloss', 1.5, 0.86, s * 0.5, 0.05, 0.14, 0.26, 0.02, LAMP); k.box('gloss', -1.51, 0.9, s * 0.56, 0.03, 0.12, 0.2, RED); }
      k.rbox('gloss', -0.36, 2.1, 0, 1.9, 0.07, 1.5, 0.03, color); k.rbox('gloss', -0.36, 2.2, 0, 0.3, 0.12, 0.3, 0.05, '#d98a1c');
      k.box('hazard', 1.52, 0.56, 0, 0.05, 0.3, 1.5, G); k.box('hazard', -1.52, 0.56, 0, 0.05, 0.3, 1.5, G); k.rbox('dark', -1.62, 0.5, 0, 0.2, 0.12, 0.24, 0.03, TRIM);
    } else if (type === 'cart') {
      for (const wx of [1.05, -1.05]) for (const s of [-1, 1]) wheel(k, wx, 0.22, s * 0.7, 0.22, 0.14, s, '#d9d6cc');
      k.rbox('gloss', 0, 0.56, 0, 3.0, 0.1, 1.5, 0.03, color);
      for (const s of [-1, 1]) { for (const cx of [-1.44, -0.48, 0.48, 1.44]) k.cyl('gloss', [cx, 0.6, s * 0.72], [cx, 1.74, s * 0.72], 0.022, 0.022, color, 5); for (const yy of [0.92, 1.24]) k.cyl('gloss', [-1.44, yy, s * 0.72], [1.44, yy, s * 0.72], 0.014, 0.014, color, 4); }
      k.rbox('gloss', 0, 1.78, 0, 3.1, 0.07, 1.6, 0.03, color);
      const BAG = ['#3d4a5c', '#5c3a34', '#2f4a3a', '#6a5a3c', '#2a2c30', '#7a2f25', '#42506a'];
      [[-1.05, 0.78, -0.3, 0.7, 0.34, 0.5], [-1.0, 0.86, 0.34, 0.8, 0.5, 0.42], [-0.2, 0.8, 0.0, 0.62, 0.38, 1.0], [0.55, 0.84, -0.32, 0.74, 0.46, 0.46], [0.6, 0.78, 0.3, 0.7, 0.34, 0.5], [1.15, 0.9, 0.0, 0.34, 0.58, 0.9], [-0.9, 1.22, -0.1, 0.72, 0.3, 0.7], [0.3, 1.24, 0.1, 0.8, 0.3, 0.56]]
        .forEach(([bx, by, bz, sx, sy, sz], i) => { k.rbox('matte', bx, by, bz, sx, sy, sz, 0.05, BAG[i % BAG.length], 0, (i * 0.37) % 0.3 - 0.15, 0); k.box('dark', bx, by + sy / 2 + 0.012, bz, sx * 0.3, 0.02, 0.03, '#141414'); });
      k.beam('steel', [1.5, 0.46, 0], [2.3, 0.34, 0], 0.05, 0.05, '#3a3c3e'); k.put('steel', new THREE.TorusGeometry(0.06, 0.016, 5, 10), '#3a3c3e', M4().makeRotationX(PI / 2).setPosition(2.36, 0.34, 0));
    } else if (type === 'stairs') {
      axles([1.5, -1.5], 0.92, 0.34, 0.24, '#d9d6cc');
      k.rbox('gloss', 0, 0.62, 0, 4.6, 0.34, 1.8, 0.06, color); k.box('hazard', 0, 0.42, 0.91, 4.4, 0.1, 0.02, G); k.box('hazard', 0, 0.42, -0.91, 4.4, 0.1, 0.02, G);
      const n = 13, rise = 0.215, run = 0.29;
      for (let i = 0; i < n; i++) { k.box('grid', -1.95 + i * run, 0.9 + i * rise, 0, run + 0.02, 0.04, 1.3, G); k.box('gloss', -1.95 + i * run + run / 2, 0.9 + i * rise - rise / 2, 0, 0.02, rise, 1.3, '#b9bcbe'); }
      for (const s of [-1, 1]) {
        k.put('gloss', (() => { const sh = new THREE.Shape([[-2.2, 0.72], [1.9, 0.72], [1.9, 3.72], [1.6, 3.72]].map(([a, b]) => new THREE.Vector2(a, b))); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false }); g.translate(0, 0, -0.02); return g; })(), color, M4().makeTranslation(0, 0, s * 0.68));   // side panel under the flight
        k.box('gloss', -0.15, 2.3, s * 0.705, 4.6, 0.16, 0.012, '#274a5e', 0, 0, 0.638);
        k.beam('steel', [-2.1, 1.74, s * 0.68], [1.75, 4.6, s * 0.68], 0.04, 0.04, '#c9ccd0'); k.beam('steel', [-2.1, 1.34, s * 0.68], [1.75, 4.2, s * 0.68], 0.03, 0.03, '#c9ccd0');
        for (const t of [0, 0.25, 0.5, 0.75, 1]) k.cyl('steel', [-2.1 + 3.85 * t, 0.8 + 2.86 * t, s * 0.68], [-2.1 + 3.85 * t, 1.74 + 2.86 * t, s * 0.68], 0.022, 0.022, '#c9ccd0', 5);
        k.cyl('steel', [1.95, 0.5, s * 0.8], [1.95, 3.7, s * 0.8], 0.06, 0.06, '#8a8d8f', 8); k.cyl('steel', [2.2, 3.74, s * 0.74], [2.2, 4.8, s * 0.74], 0.022, 0.022, '#c9ccd0', 5); k.cyl('steel', [1.75, 4.6, s * 0.74], [2.7, 4.8, s * 0.74], 0.03, 0.03, '#c9ccd0', 5);
        k.cyl('dark', [-2.0, 0.1, s * 0.7], [-2.0, 0.5, s * 0.7], 0.05, 0.05, '#2a2c2e', 6); k.rbox('dark', -2.0, 0.04, s * 0.7, 0.26, 0.05, 0.26, 0.01, '#2a2c2e');     // stabiliser jack
      }
      k.rbox('grid', 2.3, 3.72, 0, 1.0, 0.06, 1.5, 0.01, G); k.beam('steel', [-2.3, 0.5, 0], [-3.1, 0.36, 0], 0.05, 0.05, '#3a3c3e');
    }
    k.pop();
  };

  /** Control tower: the cab, gallery, roof and aerials on top of a shaft the level builds. Centre (x, z), shaft half-width w, cab floor at y = h. */
  B.tower = (k, o) => {
    const { x, z, yaw = 0, w = 3, h = 16, color = '#cfcabd' } = o, G = '#6a6f73';
    k.push(x, 0, z, yaw);
    k.box('wall', 0, h + 0.15, 0, w * 2 + 3.2, 0.3, w * 2 + 3.2, '#ffffff');                                 // gallery slab
    for (const s of [-1, 1]) for (const t of [-1, 1]) k.cyl('steel', [s * (w + 1.5), h + 0.3, t * (w + 1.5)], [s * (w + 1.5), h + 1.35, t * (w + 1.5)], 0.03, 0.03, G, 5);
    for (const yy of [0.8, 1.35]) for (const s of [-1, 1]) { k.cyl('steel', [s * (w + 1.5), h + yy, -(w + 1.5)], [s * (w + 1.5), h + yy, w + 1.5], 0.022, 0.022, G, 4); k.cyl('steel', [-(w + 1.5), h + yy, s * (w + 1.5)], [w + 1.5, h + yy, s * (w + 1.5)], 0.022, 0.022, G, 4); }
    const cw = w + 0.5, ch = 2.7;                                                                             // the cab: glass leaning outwards between corner posts
    k.box('paint', 0, h + 0.75, 0, cw * 2, 0.9, cw * 2, color);
    for (const s of [-1, 1]) { k.box('glass', s * (cw + 0.22), h + 2.05, 0, 0.06, 1.9, cw * 2 + 0.3, '#ffffff', 0, 0, s * -0.22); k.box('glass', 0, h + 2.05, s * (cw + 0.22), cw * 2 + 0.3, 1.9, 0.06, '#ffffff', s * 0.22, 0, 0); }
    for (const s of [-1, 1]) for (const t of [-1, 1]) k.beam('paint', [s * cw, h + 1.2, t * cw], [s * (cw + 0.45), h + ch + 0.3, t * (cw + 0.45)], 0.16, 0.16, color);
    k.box('paint', 0, h + ch + 0.45, 0, cw * 2 + 1.7, 0.3, cw * 2 + 1.7, '#8d9092'); k.box('paint', 0, h + ch + 0.9, 0, 2.2, 0.6, 2.2, '#8d9092');
    k.cyl('steel', [0.6, h + ch + 1.2, 0.4], [0.6, h + ch + 5.4, 0.4], 0.05, 0.02, G, 6); k.cyl('steel', [-0.7, h + ch + 1.2, -0.5], [-0.7, h + ch + 3.6, -0.5], 0.04, 0.02, G, 6);
    k.lamp(0, h + ch + 1.4, 0, [3, 12, 5], 0.2, { period: 2.4, duty: 0.5 }); k.lamp(0.6, h + ch + 5.5, 0.4, [12, 0.5, 0.3], 0.1, { period: 1.6, duty: 0.4 });
    k.box('glow', 0, h + 1.26, 0, cw * 1.6, 0.04, cw * 1.6, [0.5, 0.48, 0.42]);                               // consoles catching the light
    k.pop();
  };

  /** Radar dome on a ring wall, r = dome radius, base = height of the ring. */
  B.radome = (k, o) => {
    const { x, z, y = 0, r = 4.2, base = 1.4, color = '#dcd9cf' } = o;
    k.push(x, y, z);
    k.cyl('wall', [0, 0, 0], [0, base, 0], r * 0.82, r * 0.82, '#ffffff', 20);
    k.sphere('gloss', 0, base + r * 0.72, 0, r, color, 1, 1, 1, 22);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI; k.put('dark', new THREE.TorusGeometry(r * 1.004, 0.03, 4, 40), '#8f8c84', new THREE.Matrix4().makeRotationY(a).setPosition(0, base + r * 0.72, 0)); }
    k.pop();
  };

  /** Lattice radio mast with guy wires and a warning lamp. */
  B.latticeMast = (k, o) => {
    const { x, z, h = 26, w = 0.9, color = '#b8291e', guys = 14 } = o;
    k.push(x, 0, z);
    k.box('wall', 0, 0.25, 0, w + 0.9, 0.5, w + 0.9, '#ffffff');
    for (const s of [-1, 1]) for (const t of [-1, 1]) k.beam('paint', [s * w / 2, 0.5, t * w / 2], [s * w * 0.18, h, t * w * 0.18], 0.07, 0.07, color);
    const n = Math.round(h / 1.6);
    for (let i = 0; i < n; i++) {
      const y0 = 0.5 + ((h - 0.5) * i) / n, y1 = 0.5 + ((h - 0.5) * (i + 1)) / n, a = (w / 2) * (1 - 0.64 * (i / n)), b = (w / 2) * (1 - 0.64 * ((i + 1) / n)), f = i % 2 ? 1 : -1, c = Math.floor(i / 3) % 2 ? '#e9e4d6' : color;
      for (const s of [-1, 1]) { k.beam('paint', [s * a, y0, f * a], [s * b, y1, -f * b], 0.035, 0.035, c); k.beam('paint', [f * a, y0, s * a], [-f * b, y1, s * b], 0.035, 0.035, c); }
    }
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.4; for (const t of [0.55, 0.95]) k.cyl('dark', [0, h * t, 0], [Math.cos(a) * guys, 0.2, Math.sin(a) * guys], 0.012, 0.012, '#222', 4); }
    k.cyl('steel', [0, h, 0], [0, h + 3, 0], 0.03, 0.015, '#8a8f93', 5); k.lamp(0, h + 0.3, 0, [12, 0.5, 0.3], 0.14, { period: 1.8, duty: 0.45, phase: x * 0.05 });
    k.pop();
  };

  /** Chain-link fence along a line of points [[x, z], ...] with an outward-leaning barbed top. */
  B.fence = (k, o) => {
    const { pts, h = 2.6, step = 3, barbed = true } = o, G = '#8a8f93';
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / step)), yaw = Math.atan2(-(bz - az), bx - ax);
      k.push(ax, 0, az, yaw);
      for (let j = 0; j <= n; j++) { const px = (len * j) / n; k.cyl('steel', [px, 0, 0], [px, h, 0], 0.035, 0.035, G, 5); if (barbed) k.beam('steel', [px, h, 0], [px, h + 0.38, 0.3], 0.03, 0.03, G); }
      k.cyl('steel', [0, h, 0], [len, h, 0], 0.022, 0.022, G, 4); k.cyl('steel', [0, 0.06, 0], [len, 0.06, 0], 0.012, 0.012, G, 4);
      if (barbed) for (const t of [0.35, 0.7, 1]) k.cyl('steel', [0, h + 0.38 * t, 0.3 * t], [len, h + 0.38 * t, 0.3 * t], 0.006, 0.006, '#9a9ea2', 3);
      const g = new THREE.PlaneGeometry(len, h - 0.06), uv = g.attributes.uv; for (let u = 0; u < uv.count; u++) uv.setXY(u, (uv.getX(u) * len) / 2.2, (uv.getY(u) * h) / 2.2);
      k.put('chainlink', g, '#ffffff', new THREE.Matrix4().setPosition(len / 2, h / 2 + 0.03, 0));
      k.pop();
    }
  };

  /** A row of horizontal fuel tanks on saddles with a walkway along their tops. Tanks lie along local x. */
  B.fuelTanks = (k, o) => {
    const { x, z, yaw = 0, n = 3, len = 11, r = 1.7, gap = 4.6, color = '#d2cfc4', text = 'JET A-1' } = o, G = '#7a7f83';
    k.push(x, 0, z, yaw);
    for (let i = 0; i < n; i++) {
      const tz = (i - (n - 1) / 2) * gap, y = r + 0.9;
      k.cyl('gloss', [-len / 2 + r * 0.5, y, tz], [len / 2 - r * 0.5, y, tz], r, r, color, 18);
      for (const s of [-1, 1]) k.sphere('gloss', s * (len / 2 - r * 0.5), y, tz, r, color, 0.5, 1, 1, 16);
      for (const sx of [-len * 0.3, len * 0.3]) { k.box('wall', sx, 0.55, tz, 0.5, 1.1, r * 1.7, '#ffffff'); k.cyl('paint', [sx - 0.16, y, tz], [sx + 0.16, y, tz], r + 0.04, r + 0.04, '#8a2f25', 18); }
      k.cyl('paint', [len * 0.1, y + r, tz], [len * 0.1, y + r + 0.45, tz], 0.3, 0.3, G, 10);
      k.sign(text, 0, y + 0.1, tz + r + 0.02, { h: 0.5, color: '#8a2f25', worn: 0.4 }); k.sign(text, 0, y + 0.1, tz - r - 0.02, { h: 0.5, color: '#8a2f25', worn: 0.4, yaw: Math.PI });
      k.cyl('steel', [-len / 2 - 0.3, 0.5, tz], [-len / 2 - 0.3, y - 0.2, tz], 0.09, 0.09, G, 8); k.cyl('steel', [-len / 2 - 0.3, y - 0.2, tz], [-len / 2 + r * 0.35, y - 0.2, tz], 0.09, 0.09, G, 8);
    }
    const span = (n - 1) * gap, wy = r * 2 + 0.95;
    k.cyl('steel', [-len / 2 - 0.3, 0.5, -span / 2 - 1.5], [-len / 2 - 0.3, 0.5, span / 2 + 1.5], 0.11, 0.11, G, 8);                    // manifold
    k.box('grid', len * 0.1, wy, 0, 0.9, 0.05, span + r * 2, '#ffffff');                                                                // walkway
    for (const s of [-1, 1]) { k.cyl('steel', [len * 0.1 + s * 0.45, wy + 1, -span / 2 - r], [len * 0.1 + s * 0.45, wy + 1, span / 2 + r], 0.02, 0.02, G, 4); for (let t = -span / 2 - r; t <= span / 2 + r + 0.01; t += 1.6) k.cyl('steel', [len * 0.1 + s * 0.45, wy, t], [len * 0.1 + s * 0.45, wy + 1, t], 0.02, 0.02, G, 4); }
    for (const s of [-0.22, 0.22]) k.cyl('steel', [len * 0.1 + s, 0, span / 2 + r + 0.25], [len * 0.1 + s, wy + 1, span / 2 + r + 0.25], 0.02, 0.02, G, 4);
    for (let y = 0.3; y < wy; y += 0.3) k.cyl('steel', [len * 0.1 - 0.22, y, span / 2 + r + 0.25], [len * 0.1 + 0.22, y, span / 2 + r + 0.25], 0.014, 0.014, G, 4);
    k.pop();
  };

  /** Windsock on a pole, streaming along `dir` degrees (compass). */
  B.windsock = (k, o) => {
    const { x, z, dir = 250, h = 6.5 } = o, a = rad(dir), fx = Math.sin(a), fz = -Math.cos(a);
    k.cyl('steel', [x, 0, z], [x, h, z], 0.07, 0.05, '#e9e4d6', 8); k.box('wall', x, 0.15, z, 0.7, 0.3, 0.7, '#ffffff');
    for (let i = 0; i < 5; i++) { const t0 = i * 0.62, t1 = t0 + 0.62, r0 = 0.42 - i * 0.055, r1 = 0.42 - (i + 1) * 0.055, d0 = t0 * t0 * 0.035, d1 = t1 * t1 * 0.035; k.cyl('matte', [x + fx * (0.2 + t0), h - 0.3 - d0, z + fz * (0.2 + t0)], [x + fx * (0.2 + t1), h - 0.3 - d1, z + fz * (0.2 + t1)], r0, r1, i % 2 ? '#e9e4d6' : '#d9571e', 10); }
  };

  /** Sandbag walls. at: [[x, z, yawDeg, length, height], ...] */
  B.sandbags = (k, o) => {
    const R = rng(o.seed ?? 6), C = ['#8f8468', '#9a8f72', '#857a60', '#a0977c'];
    for (const [x, z, yawDeg = 0, len = 4, h = 1.1] of o.at) {
      k.push(x, 0, z, rad(yawDeg));
      const rows = Math.round(h / 0.22), n = Math.round(len / 0.62);
      for (let r = 0; r < rows; r++) for (let i = 0; i < n + (r % 2 ? -1 : 0); i++) for (const d of [-0.16, 0.16])      // a bag = a squashed ball of 36 triangles; there are over a thousand of them
        k.put('matte', new THREE.SphereGeometry(0.34, 6, 4), C[(R() * 4) | 0], new THREE.Matrix4().makeScale(1, 0.36, 0.56).setPosition(-len / 2 + 0.31 + i * 0.62 + (r % 2 ? 0.31 : 0) + (R() - 0.5) * 0.05, 0.11 + r * 0.22, d + (R() - 0.5) * 0.04));
      k.pop();
    }
  };

  /** Approach lighting: bars of lamps on posts stepping away along the extended runway centre line. */
  B.approach = (k, o) => {
    const { x0, x1, z, step = 30, y0 = 0 } = o, s = Math.sign(x1 - x0);
    for (let x = x0, i = 0; s * (x1 - x) >= 0; x += s * step, i++) {
      const h = 1.2 + i * 0.5, w = i % 5 === 4 ? 14 : 4;
      for (const dz of [-w / 2, w / 2]) k.cyl('steel', [x, y0, z + dz], [x, y0 + h, z + dz], 0.05, 0.05, '#c9571c', 5);
      k.box('steel', x, y0 + h, z, 0.1, 0.1, w + 0.6, '#c9571c');
      for (let dz = -w / 2; dz <= w / 2 + 0.01; dz += w / 4) k.box('glow', x, y0 + h + 0.14, z + dz, 0.16, 0.12, 0.16, [1.6, 1.5, 1.3]);
    }
  };

  /** A belt of conifers (backdrop). From a to b, `depth` metres deep. */
  B.treeline = (k, o) => {
    const { a, b, depth = 26, n = 90, hMin = 9, hMax = 17, seed = 3 } = o, R = rng(seed), dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), nx = -dz / len, nz = dx / len;
    const C = ['#22382a', '#1c3024', '#2a4030', '#253a2c', '#31462f'];
    for (let i = 0; i < n; i++) {
      const t = (i + R()) / n, d = R() * depth, px = a[0] + dx * t + nx * d, pz = a[1] + dz * t + nz * d, h = hMin + R() * (hMax - hMin), r = h * (0.17 + R() * 0.06), c = C[(R() * C.length) | 0];
      k.cyl('matte', [px, 0, pz], [px, h * 0.3, pz], 0.22, 0.18, '#3a2f26', 5);
      for (let t = 0; t < 3; t++) k.cyl('matte', [px, h * (0.14 + t * 0.26), pz], [px, h * (0.52 + t * 0.24), pz], r * (1 - t * 0.26), r * (0.3 - t * 0.12), t % 2 ? c : C[(R() * C.length) | 0], 8);
    }
  };

  /** Far hills: long low ridges on an arc of compass bearings round the map centre. */
  B.ridge = (k, o) => {
    const { from = 0, to = 90, r = 700, n = 8, h = 60, w = 260, seed = 2, color = '#5f6f6a' } = o, R = rng(seed);
    for (let i = 0; i < n; i++) { const a = rad(from + (to - from) * ((i + R() * 0.7) / n)), d = r * (0.85 + R() * 0.4), ww = w * (0.6 + R() * 0.9); k.sphere('matte', Math.sin(a) * d, -h * 0.25, -Math.cos(a) * d, ww, color, 1, (h * (0.5 + R())) / ww, 0.45 + R() * 0.3, 14); }
  };

  /** Taxiway guidance signs: a lit board on two short legs. at: [[x, z, yawDeg, text, kind]] kind 'loc' = yellow on black, else black on yellow */
  B.taxiSign = (k, o) => {
    for (const [x, z, yawDeg = 0, text = 'A', kind = 'dir'] of o.at) {
      k.push(x, 0, z, rad(yawDeg));
      const w = 0.5 + String(text).length * 0.34;
      for (const s of [-1, 1]) k.box('dark', s * (w / 2 - 0.12), 0.2, 0, 0.08, 0.4, 0.08, '#2a2a2a');
      k.box('dark', 0, 0.68, 0, w, 0.58, 0.16, '#141414');
      for (const s of [-1, 1]) k.sign(String(text), 0, 0.68, s * 0.085, { h: 0.34, color: kind === 'loc' ? '#f2c230' : '#141414', bg: kind === 'loc' ? '#141414' : '#f2c230', yaw: s > 0 ? 0 : Math.PI, worn: 0.15 });
      k.pop();
    }
  };
}
