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

  /**
   * An aircraft. Local +x is the nose. kind 'cargo' = twin turboprop freighter (21 m), 'light' = four-seat high-wing (8 m).
   * wreck: gear collapsed, lying on its belly with one wing down. livery: { base, belly, stripe, tail }
   */
  B.aircraft = (k, o) => {
    const { x, z, yaw = 0, kind: type = 'cargo', wreck = false, reg = 'TAC 207', name = 'TERN AIR FREIGHT' } = o;
    const lv = { base: '#d6d3c8', belly: '#8e9499', stripe: '#b8452e', tail: '#274a5e', ...(o.livery || {}) }, DK = '#15171a', M = 'gloss';
    k.push(x, 0, z, yaw);
    if (wreck) k.pushM(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rad(type === 'cargo' ? 8 : 10), 0, rad(2.2), 'YXZ')).setPosition(0, type === 'cargo' ? -0.72 : -0.55, 0));
    if (type === 'cargo') {
      const r = 1.4, yc = 2.2;
      k.cyl(M, [-3, yc, 0], [6.8, yc, 0], r, r, lv.base, 16);                                              // cabin
      k.cyl(M, [6.8, yc, 0], [8.9, yc - 0.18, 0], r, 0.95, lv.base, 16); k.cyl(M, [8.9, yc - 0.18, 0], [9.9, yc - 0.36, 0], 0.95, 0.42, '#4a4e52', 14); k.sphere(M, 9.86, yc - 0.36, 0, 0.43, '#4a4e52', 0.8, 1, 1, 12);   // nose and radome
      k.cyl(M, [-3, yc, 0], [-7.5, yc + 0.5, 0], r, 0.95, lv.base, 16); k.cyl(M, [-7.5, yc + 0.5, 0], [-11, yc + 0.95, 0], 0.95, 0.38, lv.base, 14);  // tail cone
      k.box(M, 1.9, yc - 1.0, 0, 9.6, 0.82, 2.25, lv.belly);                                                // belly fairing
      for (const s of [-1, 1]) {
        k.box(M, 1.6, yc + 0.28, s * (r + 0.006), 16.4, 0.2, 0.02, lv.stripe); k.box(M, 1.6, yc + 0.02, s * (r + 0.008), 16.4, 0.07, 0.02, lv.tail);   // cheat lines
        for (let wx = -1.6; wx < 5.6; wx += 1.25) k.box('dark', wx, yc + 0.62, s * (r - 0.03), 0.36, 0.36, 0.08, '#0c0d0f');
        k.box('dark', 7.75, yc + 0.5, s * 1.06, 1.3, 0.52, 0.08, '#0b0c0e', 0, s * -0.2, 0.08);              // flight-deck side windows
        k.sign(reg, -5.4, yc + 0.72, s * (1.2 + 0.05), { h: 0.42, color: '#22262a', yaw: s > 0 ? 0 : Math.PI, worn: 0.3 });
        k.sign(name, 2.2, yc + 1.02, s * (r * 0.78 + 0.04), { h: 0.24, color: lv.tail, yaw: s > 0 ? 0 : Math.PI, worn: 0.3 });
        // wing: two panels a side, high on the fuselage
        k.box(M, -0.6, yc + 1.46, s * 3.6, 3.2, 0.36, 6.4, lv.base, 0, 0, 0); k.box(M, -0.5, yc + 1.5, s * 10.1, 2.3, 0.26, 6.9, lv.base, s * -0.03, 0, 0);
        k.box(M, 0.9, yc + 1.5, s * 13.4, 1.5, 0.1, 0.5, lv.stripe);
        // engine: nacelle, spinner, four blades
        const ez = s * 4.9, ey = yc + 1.02;
        k.cyl(M, [-2.6, ey, ez], [1.9, ey, ez], 0.5, 0.62, lv.belly, 12); k.cyl(M, [1.9, ey, ez], [2.5, ey, ez], 0.62, 0.36, lv.belly, 12); k.cyl(M, [2.5, ey, ez], [3.05, ey, ez], 0.3, 0.05, DK, 10);
        k.box('dark', -0.2, ey - 0.5, ez, 1.6, 0.3, 0.5, '#101214');
        for (let b = 0; b < 4; b++) { const a = b * Math.PI / 2 + (s > 0 ? 0.3 : 0.9), bent = wreck && s < 0 ? 0.5 : 0; k.box('dark', 2.62 - bent * 0.5, ey + Math.cos(a) * 0.95, ez + Math.sin(a) * 0.95, 0.07, 1.9, 0.24, '#1a1c1f', a, 0, bent); }
        // main gear pod and wheels
        k.cyl(M, [-2.3, yc - 1.0, s * 1.6], [1.2, yc - 1.0, s * 1.6], 0.5, 0.56, lv.belly, 10);
        if (!wreck) for (const wx of [-1.15, -0.05]) k.cyl('dark', [wx, 0.5, s * 1.72], [wx, 0.5, s * 2.08], 0.5, 0.5, '#111', 12);
        k.box(M, -9.6, yc + 1.5, s * 2.5, 2.3, 0.2, 4.6, lv.base, 0, s * 0.12, 0);                          // tailplane
      }
      k.box('dark', 8.55, yc + 0.6, 0, 0.5, 0.56, 1.7, '#0b0c0e', 0, 0, 0.5);                                // windscreen
      k.quad(M, [-11.2, yc + 1.2, 0.1], [-7.2, yc + 1.2, 0.1], [-9.3, yc + 5.6, 0.07], [-11.4, yc + 5.6, 0.07], lv.tail); k.quad(M, [-7.2, yc + 1.2, -0.1], [-11.2, yc + 1.2, -0.1], [-11.4, yc + 5.6, -0.07], [-9.3, yc + 5.6, -0.07], lv.tail);   // fin
      k.beam(M, [-7.2, yc + 1.2, 0], [-9.3, yc + 5.6, 0], 0.2, 0.12, lv.tail); k.box(M, -10.35, yc + 5.62, 0, 2.15, 0.08, 0.2, lv.tail); k.beam(M, [-11.2, yc + 1.2, 0], [-11.4, yc + 5.6, 0], 0.2, 0.1, lv.stripe);
      k.box(M, -10.2, yc + 3.6, 0.11, 0.9, 0.9, 0.02, '#e3dfd2'); k.box(M, -10.2, yc + 3.6, -0.11, 0.9, 0.9, 0.02, '#e3dfd2');   // the line's mark: a pale square on the fin
      if (!wreck) { k.cyl('steel', [6.9, 1.3, 0], [6.9, 0.36, 0], 0.07, 0.07, '#8a8f93', 6); for (const s of [-1, 1]) k.cyl('dark', [6.9, 0.34, s * 0.14], [6.9, 0.34, s * 0.3], 0.34, 0.34, '#111', 10); }
      for (const s of [-1, 1]) k.lamp(-0.6, yc + 1.5, s * 13.6, s > 0 ? [0.3, 6, 1.5] : [7, 0.4, 0.3], 0.07);
    } else {
      const r = 0.62, yc = 1.5;
      k.cyl(M, [-0.9, yc, 0], [1.5, yc, 0], r, r, lv.base, 12); k.cyl(M, [1.5, yc, 0], [2.7, yc - 0.06, 0], r, 0.4, lv.base, 12); k.cyl(M, [2.7, yc - 0.06, 0], [3.0, yc - 0.06, 0], 0.2, 0.06, DK, 8);
      k.cyl(M, [-0.9, yc, 0], [-4.9, yc + 0.28, 0], r, 0.14, lv.base, 12);
      k.box('dark', 0.9, yc + 0.5, 0, 1.3, 0.5, 1.12, '#0b0c0e'); k.box(M, 0.3, yc + 0.84, 0, 1.6, 0.14, 10.8, lv.base); k.box(M, 0.5, yc + 0.84, 0, 1.0, 0.16, 1.3, lv.stripe);
      for (const s of [-1, 1]) {
        k.box(M, 0.4, yc + 0.02, s * (r + 0.005), 4.4, 0.16, 0.02, lv.stripe);
        k.beam('steel', [0.5, yc - 0.45, s * 0.6], [0.3, yc + 0.78, s * 2.9], 0.05, 0.12, lv.base);                // wing strut
        if (!wreck) { k.beam('steel', [0.2, yc - 0.5, s * 0.5], [0, 0.34, s * 1.15], 0.07, 0.14, lv.base); k.cyl('dark', [0, 0.3, s * 1.1], [0, 0.3, s * 1.3], 0.3, 0.3, '#111', 10); }
        k.box(M, -4.5, yc + 0.34, s * 0.9, 0.95, 0.08, 1.8, lv.base);
        k.sign(reg, -2.2, yc + 0.12, s * (0.42 + 0.03), { h: 0.26, color: '#22262a', yaw: s > 0 ? 0 : Math.PI, worn: 0.3 });
      }
      k.quad(M, [-5.0, yc + 0.3, 0.04], [-3.7, yc + 0.3, 0.04], [-4.5, yc + 1.75, 0.03], [-5.1, yc + 1.75, 0.03], lv.tail); k.quad(M, [-3.7, yc + 0.3, -0.04], [-5.0, yc + 0.3, -0.04], [-5.1, yc + 1.75, -0.03], [-4.5, yc + 1.75, -0.03], lv.tail);
      for (let b = 0; b < 2; b++) k.box('dark', 2.86, yc - 0.06, 0, 0.05, 1.9, 0.16, '#1a1c1f', b * Math.PI / 2 + 0.4, 0, 0);
      if (!wreck) { k.cyl('steel', [2.2, yc - 0.5, 0], [2.3, 0.3, 0], 0.045, 0.045, '#8a8f93', 6); k.cyl('dark', [2.3, 0.26, -0.08], [2.3, 0.26, 0.08], 0.26, 0.26, '#111', 10); }
    }
    if (wreck) k.pop();
    k.pop();
  };

  /** Ground vehicles. Local +x is the front. kind: truck · bowser · tender · pickup · tug · cart · stairs */
  B.vehicle = (k, o) => {
    const { x, z, yaw = 0, kind: type = 'truck', color = '#5d6a4f', text = null } = o, DK = '#17191b';
    k.push(x, 0, z, yaw);
    const wheels = (xs, hw, r = 0.48, w = 0.3) => { for (const wx of xs) for (const s of [-1, 1]) { k.cyl('dark', [wx, r, s * (hw - w)], [wx, r, s * hw], r, r, '#101010', 12); k.cyl('steel', [wx, r, s * hw], [wx, r, s * (hw + 0.02)], r * 0.5, r * 0.5, '#7a7d80', 8); } };
    const cab = (cx, w, h, len, c) => { k.box('gloss', cx, 0.75 + h / 2, 0, len, h, w, c); k.box('glass', cx + len / 2 + 0.01, 0.75 + h * 0.68, 0, 0.04, h * 0.42, w - 0.3, '#fff'); for (const s of [-1, 1]) k.box('glass', cx + len * 0.12, 0.75 + h * 0.68, s * (w / 2 + 0.01), len * 0.5, h * 0.4, 0.04, '#fff'); k.box('dark', cx + len / 2 + 0.06, 0.72, 0, 0.14, 0.3, w, DK); };
    if (type === 'truck' || type === 'bowser' || type === 'tender') {
      const c = type === 'tender' ? '#a8281c' : color;
      k.box('dark', -0.2, 0.62, 0, 7.4, 0.26, 1.0, DK); cab(2.75, 2.4, 1.75, 1.9, c); wheels([2.6, -1.6, -2.75], 1.22);
      if (type === 'truck') { k.box('gloss', -1.35, 0.92, 0, 5.3, 0.14, 2.42, '#3a3d3f'); for (const s of [-1, 1]) k.box('gloss', -1.35, 1.35, s * 1.19, 5.3, 0.72, 0.06, color); k.box('gloss', -3.98, 1.35, 0, 0.06, 0.72, 2.42, color); k.box('matte', -1.35, 2.2, 0, 5.2, 1.5, 2.36, '#474b3a'); }
      else if (type === 'bowser') { k.sphere('gloss', -1.35, 1.95, 0, 1.0, '#c9c6bb', 2.75, 0.95, 1.15, 14); k.box('gloss', -1.35, 1.0, 0, 5.3, 0.2, 2.2, '#3a3d3f'); k.box('gloss', -1.35, 2.94, 0, 3.6, 0.08, 0.7, '#8a8f93'); for (const s of [-1, 1]) k.sign(text || 'JET A-1', -1.35, 1.95, s * 1.16, { h: 0.34, color: '#a8281c', yaw: s > 0 ? 0 : Math.PI, worn: 0.3 }); k.box('hazard', -4.05, 0.9, 0, 0.08, 0.3, 2.2, '#ffffff'); }
      else { k.box('gloss', -1.35, 1.85, 0, 5.3, 2.2, 2.42, c); for (const s of [-1, 1]) for (const lx of [-3.1, -1.35, 0.4]) k.box('gloss', lx, 1.7, s * 1.22, 1.5, 1.5, 0.04, '#8f2218'); k.box('steel', -1.2, 3.02, 0, 4.4, 0.12, 0.9, '#b9bcbe'); k.cyl('steel', [1.2, 3.1, 0], [3.4, 3.5, 0], 0.09, 0.07, '#b9bcbe', 8); k.box('gloss', 2.75, 2.58, 0, 0.9, 0.18, 1.5, '#2c4a9a'); }
    } else if (type === 'pickup') {
      k.box('gloss', 0, 0.78, 0, 5.0, 0.6, 1.86, color); k.box('gloss', 0.5, 1.42, 0, 1.9, 0.72, 1.74, color); k.box('glass', 1.47, 1.44, 0, 0.04, 0.5, 1.5, '#fff'); k.box('glass', -0.47, 1.44, 0, 0.04, 0.5, 1.5, '#fff');
      for (const s of [-1, 1]) { k.box('glass', 0.5, 1.46, s * 0.88, 1.5, 0.46, 0.04, '#fff'); k.box('gloss', -1.55, 1.2, s * 0.9, 1.9, 0.3, 0.06, color); } k.box('dark', -1.55, 1.02, 0, 1.86, 0.06, 1.7, DK); wheels([1.55, -1.5], 0.95, 0.4, 0.26);
    } else if (type === 'tug') {
      k.box('gloss', 0, 0.72, 0, 3.0, 0.75, 1.5, color); k.box('gloss', -0.5, 1.3, 0, 1.2, 0.45, 1.4, color); k.box('dark', 0.55, 1.2, 0, 0.5, 0.3, 1.0, DK); k.cyl('steel', [0.9, 1.1, 0], [0.75, 1.5, 0], 0.03, 0.03, '#333', 5); k.box('hazard', 1.52, 0.6, 0, 0.06, 0.34, 1.5, '#ffffff'); wheels([0.95, -0.95], 0.76, 0.34, 0.24);
    } else if (type === 'cart') {
      k.box('gloss', 0, 0.62, 0, 3.0, 0.1, 1.5, color); for (const s of [-1, 1]) { k.box('gloss', 0, 1.08, s * 0.74, 3.0, 0.06, 0.04, color); for (const cx of [-1.46, 0, 1.46]) k.box('gloss', cx, 0.9, s * 0.74, 0.05, 0.5, 0.04, color); }
      for (const cx of [-1.46, 1.46]) k.box('gloss', cx, 1.2, 0, 0.05, 1.1, 1.5, color); k.box('matte', -0.1, 1.05, 0, 2.5, 0.7, 1.2, '#3d4238'); k.beam('steel', [1.5, 0.5, 0], [2.3, 0.4, 0], 0.05, 0.05, '#333'); wheels([1.05, -1.05], 0.74, 0.22, 0.14);
    } else if (type === 'stairs') {
      k.box('gloss', 0, 0.6, 0, 4.6, 0.4, 1.9, color); wheels([1.5, -1.5], 0.98, 0.34, 0.24);
      const n = 12; for (let i = 0; i < n; i++) k.box('grid', -1.9 + i * 0.3, 0.9 + i * 0.22, 0, 0.3, 0.05, 1.3, '#ffffff');
      for (const s of [-1, 1]) { k.beam('gloss', [-2.05, 0.82, s * 0.7], [1.7, 3.5, s * 0.7], 0.1, 0.28, color); k.beam('steel', [-2.05, 1.8, s * 0.7], [1.7, 4.5, s * 0.7], 0.04, 0.04, '#c9ccd0'); for (const t of [0, 0.5, 1]) k.cyl('steel', [-2.05 + 3.75 * t, 0.85 + 2.68 * t, s * 0.7], [-2.05 + 3.75 * t, 1.8 + 2.7 * t, s * 0.7], 0.025, 0.025, '#c9ccd0', 5); k.cyl('steel', [1.9, 0.8, s * 0.8], [1.9, 3.5, s * 0.8], 0.06, 0.06, '#8a8f93', 6); }
      k.box('grid', 2.15, 3.52, 0, 1.0, 0.06, 1.5, '#ffffff');
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
