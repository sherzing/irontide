// Scenery for a shipbreaking beach: the beached hulk, a severed bow, plate stacks, scrap, an anchor and chain,
// a lifeboat, tarp shelters, a hauling winch and a crawler crane. Visual only, like everything in dressing.js:
// the level's solids are what a player touches.
//   hulk · bowBlock · plates · scrap · anchor · lifeboat · shelter · winch · crawlerCrane · mounds
import * as THREE from 'three';

const RUST = ['#7a4a30', '#8a5636', '#6b3f2a', '#5d4636', '#94603a'];
const smooth = (a, b, t) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };

export function addYardBuilders(B, { rng }) {
  /**
   * What is left of a freighter hauled up the beach: the fittings on and inside a hull whose plating, decks and
   * bulkheads the level builds as solids. Local frame: x across the beam, z along the ship; the bow has been cut
   * off at z = cut, the parallel body ends at z = aft and the stern overhangs to z = stern.
   * holes: { w: [[z0, z1, height]], e: [...] } = openings burnt through each side · hatches: [[z0, z1, halfWidth]]
   */
  B.hulk = (k, o) => {
    const { x, z, yaw = 0, beam = 15, depth = 8.5, cut = -18, aft = 40, stern = 52, name = 'MERIDIAN GRACE', port = 'MONROVIA',
      holes = { w: [], e: [] }, hatches = [], house = [27, 39], seed = 7, tow = null, tint = '#ffffff' } = o;
    const R = rng(seed), hb = beam / 2, D = depth, WHITE = '#cbc5b4', GREY = '#8d8a80', rust = () => RUST[(R() * RUST.length) | 0];
    k.push(x, 0, z, yaw);
    // frames and a stringer inside the shell; a frame stops above an opening
    for (const sx of [-1, 1]) {
      const hs = sx < 0 ? holes.w : holes.e;
      for (let zz = cut + 1.2; zz < aft - 0.4; zz += 2.4) {
        const h = hs.find((q) => zz > q[0] - 0.25 && zz < q[1] + 0.25), y0 = h ? h[2] + 0.12 : 0.12;
        if (D - y0 > 0.6) k.box('paint', sx * (hb - 0.38), (y0 + D) / 2, zz, 0.46, D - y0, 0.14, rust());
      }
      k.box('paint', sx * (hb - 0.34), 5.7, (cut + aft) / 2, 0.38, 0.18, aft - cut, RUST[1]);
      // deck edge: stanchions and rails, with gaps where they have been cut away
      for (let zz = cut + 0.6; zz < aft; zz += 2) {
        if (R() < 0.22) continue;
        k.cyl('steel', [sx * (hb - 0.12), D, zz], [sx * (hb - 0.12), D + 1.05, zz], 0.024, 0.024, '#9a9d9f', 5);
        for (const yy of [0.55, 1.05]) k.cyl('steel', [sx * (hb - 0.12), D + yy, zz], [sx * (hb - 0.12), D + yy, Math.min(aft, zz + 2)], 0.018, 0.018, '#9a9d9f', 4);
      }
      for (const bz of [cut + 6, (cut + aft) / 2, aft - 14]) for (const dz of [-0.45, 0.45]) k.cyl('paint', [sx * (hb - 1.1), D, bz + dz], [sx * (hb - 1.1), D + 0.55, bz + dz], 0.2, 0.17, '#2a2826', 10);   // mooring bitts
    }
    // hatch coamings round the open holds
    for (const [z0, z1, hw] of hatches) {
      for (const sx of [-1, 1]) k.box('paint', sx * hw, D + 0.5, (z0 + z1) / 2, 0.22, 1.0, z1 - z0 + 0.22, '#5a3a2e');
      for (const zz of [z0, z1]) k.box('paint', 0, D + 0.5, zz, hw * 2, 1.0, 0.22, '#5a3a2e');
      for (let zz = z0 + 1.5; zz < z1; zz += 3) for (const sx of [-1, 1]) k.box('paint', sx * (hw + 0.2), D + 0.3, zz, 0.3, 0.6, 0.1, RUST[2]);
    }
    // the jagged edge where the bow was burnt off, with cable ends hanging from it
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1, yy = 0.6 + R() * (D - 0.4), w = 0.9 + R() * 1.8, h = 0.5 + R() * 1.3;
      k.box('paint', side * (hb - 0.06), yy, cut - w * 0.38, 0.05, h, w, rust(), R() * 0.25 - 0.12, side * (R() * 0.22), R() * 0.4 - 0.2);
    }
    for (let i = 0; i < 7; i++) { const xx = (R() - 0.5) * (beam - 4.4), s = xx > 0 ? 1 : -1; k.box('paint', s * (hb - 1.5 - R() * 1.2), D - 0.05, cut - 0.5 - R() * 0.7, 1.2 + R() * 1.6, 0.05, 1.4 + R(), rust(), R() * 0.5 + 0.1, 0, 0); }
    for (let i = 0; i < 5; i++) { const xx = (i % 2 ? 1 : -1) * (hb - 0.5 - R() * 2); k.rope([xx, D, cut - 0.2], [xx + (R() - 0.5), D - 2 - R() * 3.5, cut - 0.4 - R() * 0.8], 0.1, 0.03, '#1c1a18', 5); }
    // ventilators, a winch and a crane post on the deck between the holds
    if (hatches.length > 1) {
      const cz = (hatches[0][1] + hatches[1][0]) / 2;
      k.cyl('paint', [0, D, cz], [0, D + 7.5, cz], 0.6, 0.5, '#b08a2a', 12); k.box('paint', 0, D + 8.1, cz, 1.9, 1.3, 1.9, '#b08a2a');
      k.beam('paint', [0.4, D + 8.2, cz - 0.6], [2.6, D + 1.4, cz - 9.5], 0.5, 0.7, '#b08a2a');                       // jib lowered onto the coaming
      for (const sx of [-1, 1]) { k.cyl('paint', [sx * (hb - 2.2), D, cz], [sx * (hb - 2.2), D + 1.9, cz], 0.3, 0.3, WHITE, 10); k.sphere('paint', sx * (hb - 2.2), D + 2.0, cz - 0.15, 0.42, WHITE, 1, 0.9, 1.15, 10); }
      k.box('paint', -2.6, D + 0.5, cz + 0.2, 1.8, 1.0, 1.3, '#3a3f44'); k.cyl('dark', [-3.4, D + 0.75, cz + 0.2], [-1.8, D + 0.75, cz + 0.2], 0.45, 0.45, '#22262a', 10);
    }
    // accommodation block, bridge, funnel and mast at the stern
    const [h0, h1] = house, hz = (h0 + h1) / 2, hl = h1 - h0, hw = beam - 2.6, dh = 2.6, decks = 4;
    for (let d = 0; d < decks; d++) {
      const y = D + d * dh, l = hl - d * 0.5, w = hw - (d > 1 ? 1.2 : 0);
      k.box('paint', 0, y + dh / 2, hz, w, dh, l, d % 2 ? WHITE : '#c3bcaa');
      k.box('paint', 0, y + dh + 0.04, hz, w + 1.6, 0.1, l + 1.0, GREY);
      for (let wx = -w / 2 + 1.0; wx < w / 2 - 0.5; wx += 1.6) {
        k.box(R() < 0.2 ? 'glass' : 'dark', wx, y + 1.5, hz - l / 2 - 0.02, 0.8, 0.62, 0.05, '#0b0c0d');
        if (R() < 0.6) k.box('paint', wx, y + 0.72, hz - l / 2 - 0.012, 0.5 + R() * 0.4, 0.9, 0.02, rust());                // rust run under the port
      }
      for (const sx of [-1, 1]) {
        for (let wz = -l / 2 + 1.1; wz < l / 2 - 0.6; wz += 1.7) { k.box(R() < 0.2 ? 'glass' : 'dark', sx * (w / 2 + 0.02), y + 1.5, hz + wz, 0.05, 0.62, 0.8, '#0b0c0d'); if (R() < 0.5) k.box('paint', sx * (w / 2 + 0.012), y + 0.72, hz + wz, 0.02, 0.9, 0.5 + R() * 0.4, rust()); }
        for (let rz = -l / 2 - 0.4; rz <= l / 2 + 0.4; rz += 1.9) k.cyl('steel', [sx * (w / 2 + 0.72), y + dh + 0.08, hz + rz], [sx * (w / 2 + 0.72), y + dh + 1.1, hz + rz], 0.022, 0.022, '#b9b6ad', 5);
        k.cyl('steel', [sx * (w / 2 + 0.72), y + dh + 1.1, hz - l / 2 - 0.4], [sx * (w / 2 + 0.72), y + dh + 1.1, hz + l / 2 + 0.4], 0.022, 0.022, '#b9b6ad', 5);
      }
    }
    const by = D + decks * dh, bz = hz - 0.8, bl = hl - 4.5;
    k.box('paint', 0, by + 1.3, bz, beam + 2.2, 2.6, bl, WHITE);
    k.box('dark', 0, by + 1.65, bz - bl / 2 - 0.03, beam + 1.7, 0.9, 0.05, '#090a0b');
    for (const sx of [-1, 1]) k.box('dark', sx * (beam / 2 + 1.12), by + 1.65, bz, 0.05, 0.9, bl - 0.9, '#090a0b');
    k.box('paint', 0, by + 2.66, bz, beam + 2.8, 0.12, bl + 0.9, GREY);
    k.box('paint', 0, by + 4.4, hz + 3.2, 4.2, 6.2, 3.4, '#27343d'); k.box('paint', 0, by + 5.5, hz + 3.2, 4.3, 1.5, 3.5, '#b98a2a');           // funnel with the line's band
    for (const sx of [-0.9, 0.9]) k.cyl('dark', [sx, by + 7.5, hz + 3.4], [sx, by + 8.9, hz + 3.7], 0.32, 0.28, '#101010', 8);
    k.cyl('paint', [0, by + 2.7, bz - 1], [0, by + 10.2, bz - 1], 0.22, 0.1, WHITE, 8); k.box('paint', 0, by + 7.4, bz - 1, 5.2, 0.2, 0.2, WHITE);
    k.sign(name, 0, by + 1.3 + 1.75, bz - bl / 2 - 0.035, { h: 0.5, color: '#2a2a28', yaw: Math.PI, worn: 0.7 });
    // counter stern: the bottom sweeps up to the transom; sternpost, propeller and rudder stand clear of the sand
    const N = 8, st = (t) => ({ z: aft + (stern - aft) * t, hw: hb * (1 - 0.5 * Math.pow(t, 1.7)), keel: 3.5 * smooth(0.02, 0.34, t) + 2.2 * smooth(0.34, 1, t) });
    for (let i = 0; i < N; i++) {
      const a = st(i / N), b = st((i + 1) / N), bandA = Math.max(a.keel, 2.4), bandB = Math.max(b.keel, 2.4);
      for (const sx of [-1, 1]) {
        const q = (ya0, yb0, ya1, yb1, m) => { const A0 = [sx * a.hw, ya0, a.z], B0 = [sx * b.hw, yb0, b.z], A1 = [sx * a.hw, ya1, a.z], B1 = [sx * b.hw, yb1, b.z]; if (sx > 0) k.quad(m, B0, A0, A1, B1, tint, 3.4); else k.quad(m, A0, B0, B1, A1, tint, 3.4); };
        if (bandA > a.keel + 0.01 || bandB > b.keel + 0.01) q(a.keel, b.keel, bandA, bandB, 'antifoul');
        q(bandA, bandB, D + 1, D + 1, 'hull');
        const iw = 0.22; { const A0 = [sx * (a.hw - iw), D, a.z], B0 = [sx * (b.hw - iw), D, b.z], A1 = [sx * (a.hw - iw), D + 1, a.z], B1 = [sx * (b.hw - iw), D + 1, b.z]; if (sx > 0) k.quad('hull', A0, B0, B1, A1, tint, 3.4); else k.quad('hull', B0, A0, A1, B1, tint, 3.4); }   // bulwark, inner face
      }
      k.quad('paint', [-a.hw, D, a.z], [-b.hw, D, b.z], [b.hw, D, b.z], [a.hw, D, a.z], '#5a3a2e');
      k.quad('antifoul', [-a.hw, a.keel, a.z], [a.hw, a.keel, a.z], [b.hw, b.keel, b.z], [-b.hw, b.keel, b.z], tint, 3.4);
    }
    { const e = st(1); k.quad('hull', [-e.hw, e.keel, e.z], [e.hw, e.keel, e.z], [e.hw, D + 1, e.z], [-e.hw, D + 1, e.z], tint, 3.4);
      k.sign(`${name}\n${port}`, 0, D - 1.5, e.z + 0.04, { h: 0.62, color: '#d6d1c2', worn: 0.55 }); }
    for (let i = 0; i < 6; i++) k.box('paint', (R() - 0.5) * hb, 4.2 + R() * 3.4, stern + 0.02, 0.4 + R() * 0.9, 1 + R() * 2.2, 0.02, rust());   // rust runs down the transom
    const pz = aft + (stern - aft) * 0.36;
    k.box('antifoul', 0, 1.75, aft + 1.4, 0.55, 3.5, 2.8, tint);                                                                                 // sternpost and skeg
    k.cyl('paint', [0, 1.5, aft + 2.6], [0, 1.5, pz + 0.5], 0.34, 0.26, '#8a6a34', 10);
    for (let b = 0; b < 4; b++) { const a = b * Math.PI / 2 + 0.5, bx = Math.cos(a), byy = Math.sin(a); k.box('paint', bx * 0.85, 1.5 + byy * 0.85, pz + 0.1, 0.62, 1.5, 0.09, '#9a7a3c', 0.35, 0, a - Math.PI / 2); }
    k.box('antifoul', 0, 1.75, pz + 1.9, 0.26, 3.3, 1.7, tint);                                                                                  // rudder
    // draught marks and the hauling wire up the beach
    for (const sx of [-1, 1]) k.sign('8M\n7M\n6M\n5M', sx * (hb + 0.03), 4.3, aft - 2.5, { h: 0.3, color: '#d6d1c2', yaw: sx * Math.PI / 2, worn: 0.55 });
    if (tow) k.rope([0, 2.4, cut + 0.3], tow, 1.1, 0.035, '#6a6258', 12, 'steel');
    k.pop();
  };

  /** A bow that has been cut off and left standing on the sand. Local z = 0 is the open cut face, the stem is at z = len. */
  B.bowBlock = (k, o) => {
    const { x, z, yaw = 0, beam = 15, depth = 9.5, len = 13, name = 'MERIDIAN GRACE', tint = '#ffffff', seed = 3 } = o, R = rng(seed), hb = beam / 2, D = depth;
    k.push(x, 0, z, yaw);
    const N = 7, st = (t) => ({ z: len * t + 0.9 * t * t, top: Math.max(0.05, hb * Math.pow(1 - Math.pow(t, 2.3), 0.75)), bot: Math.max(0.05, hb * 0.86 * Math.pow(1 - Math.pow(t, 1.5), 0.9)), zb: len * t });
    for (let i = 0; i < N; i++) {
      const a = st(i / N), b = st((i + 1) / N);
      for (const sx of [-1, 1]) {
        const P = (s, y, inset = 0) => { const f = y / (D + 1), w = s.bot + (s.top - s.bot) * f - inset; return [sx * Math.max(0.02, w), y, s.zb + (s.z - s.zb) * f]; };
        const band = (y0, y1, m) => { if (sx > 0) k.quad(m, P(b, y0), P(a, y0), P(a, y1), P(b, y1), tint, 3.4); else k.quad(m, P(a, y0), P(b, y0), P(b, y1), P(a, y1), tint, 3.4); };
        band(0, 2.4, 'antifoul'); band(2.4, D + 1, 'hull');
        if (sx > 0) k.quad('paint', P(a, 0, 0.12), P(b, 0, 0.12), P(b, D, 0.12), P(a, D, 0.12), RUST[i % 5]); else k.quad('paint', P(b, 0, 0.12), P(a, 0, 0.12), P(a, D, 0.12), P(b, D, 0.12), RUST[(i + 2) % 5]);   // inside of the shell
        if (i < N - 1) { const m = P(a, D * 0.5, 0.3); k.box('paint', m[0], D / 2, m[2], 0.4, D, 0.14, RUST[(i + 1) % 5], 0, sx * -0.3, 0); }                                                    // frames
      }
      const fa = a.top, fb = b.top, ya = D, za = a.zb + (a.z - a.zb) * (D / (D + 1)), zb2 = b.zb + (b.z - b.zb) * (D / (D + 1));
      if (i >= 2) { k.quad('paint', [-fa, ya, za], [-fb, ya, zb2], [fb, ya, zb2], [fa, ya, za], '#5a3a2e'); k.quad('paint', [-fa, ya - 0.08, za], [fa, ya - 0.08, za], [fb, ya - 0.08, zb2], [-fb, ya - 0.08, zb2], RUST[3]); }   // forecastle deck, seen from above and from inside
    }
    k.beam('hull', [0, 0, len], [0, D + 1.1, len + 0.95], 0.3, 0.45, tint);                                                // stem bar
    for (const sx of [-1, 1]) {
      const s = st(0.52), w = s.bot + (s.top - s.bot) * 0.68;
      k.box('dark', sx * (w + 0.02), D * 0.68, s.zb + 0.3, 0.3, 1.5, 1.3, '#07090b', 0, sx * -0.42, 0);                     // hawse pipe
      { const n0 = st(0.22), f = (D - 1) / (D + 1); k.sign(name, sx * (n0.bot + (n0.top - n0.bot) * f + 0.06), D - 1.0, n0.zb + (n0.z - n0.zb) * f, { h: 0.6, color: '#d6d1c2', yaw: sx * (Math.PI / 2 - 0.14), worn: 0.6 }); }
    }
    k.box('paint', 0, D + 0.5, len * 0.62, 2.4, 1.0, 1.6, '#3a3f44'); for (const sx of [-0.9, 0.9]) k.cyl('dark', [sx - 0.5, D + 0.75, len * 0.62 + 1], [sx + 0.5, D + 0.75, len * 0.62 + 1], 0.42, 0.42, '#22262a', 10);   // windlass
    for (let i = 0; i < 9; i++) { const side = i % 2 ? 1 : -1; k.box('paint', side * (hb - 0.05), 0.8 + R() * (D - 1), -0.4 - R() * 0.4, 0.05, 0.5 + R() * 1.2, 0.8 + R() * 1.2, RUST[i % 5], R() * 0.2, side * R() * 0.2, 0); }
    k.pop();
  };

  /** Stacks of cut steel plate. at: [[x, z, yawDeg, w, d, h], ...] */
  B.plates = (k, o) => {
    const R = rng(o.seed ?? 5);
    for (const [x, z, yawDeg = 0, w = 6, d = 2.4, h = 1] of o.at) {
      k.push(x, o.y || 0, z, THREE.MathUtils.degToRad(yawDeg));
      const n = Math.max(2, Math.round(h / 0.11)), t = h / n;
      for (let i = 0; i < n; i++) k.box('paint', (R() - 0.5) * 0.22, t * (i + 0.5), (R() - 0.5) * 0.16, w - R() * 0.5, t * 0.86, d - R() * 0.3, RUST[(R() * RUST.length) | 0], 0, (R() - 0.5) * 0.05, 0);
      k.pop();
    }
  };

  /** A heap of offcuts, pipe and frames. at: [[x, z, radius, height], ...] */
  B.scrap = (k, o) => {
    const R = rng(o.seed ?? 9);
    for (const [x, z, r = 2.5, h = 1.4] of o.at) {
      k.push(x, 0, z, R() * 6);
      const n = Math.round(10 + r * 5);
      for (let i = 0; i < n; i++) {
        const a = R() * 6.28, d = Math.sqrt(R()) * r, px = Math.cos(a) * d, pz = Math.sin(a) * d, top = h * (1 - (d / r) * 0.75), py = 0.1 + R() * top, c = R() < 0.2 ? '#4f5a60' : RUST[(R() * RUST.length) | 0];
        if (R() < 0.55) k.box('paint', px, py, pz, 0.6 + R() * 1.6, 0.05 + R() * 0.06, 0.5 + R() * 1.3, c, (R() - 0.5) * 1.3, R() * 6, (R() - 0.5) * 1.3);
        else if (R() < 0.6) k.cyl('paint', [px, py, pz], [px + (R() - 0.5) * 2.6, py + (R() - 0.3) * 0.9, pz + (R() - 0.5) * 2.6], 0.07 + R() * 0.1, 0.07 + R() * 0.1, c, 7);
        else k.beam('paint', [px, py, pz], [px + (R() - 0.5) * 3, py + (R() - 0.3) * 1.1, pz + (R() - 0.5) * 3], 0.16, 0.24, c);
      }
      k.pop();
    }
  };

  /** A ship's anchor lying on the sand, with its chain running to `to` = [x, z] in world coordinates. */
  B.anchor = (k, o) => {
    const { x, z, yaw = 0, s = 1, to = null, color = '#3b3632' } = o;
    k.push(x, 0, z, yaw);
    k.box('paint', 0, 0.24 * s, 0, 0.34 * s, 0.34 * s, 3.4 * s, color, 0.06, 0, 0);                                         // shank
    k.box('paint', 0, 0.32 * s, -1.75 * s, 0.9 * s, 0.5 * s, 0.6 * s, color);                                               // crown
    for (const sx of [-1, 1]) { k.box('paint', sx * 0.72 * s, 0.34 * s, -1.25 * s, 0.26 * s, 0.3 * s, 1.5 * s, color, 0, sx * -0.5, 0); k.box('paint', sx * 1.08 * s, 0.4 * s, -0.62 * s, 0.6 * s, 0.1 * s, 0.75 * s, color, 0.2, sx * -0.5, sx * 0.3); }   // arms and flukes
    k.put('paint', new THREE.TorusGeometry(0.26 * s, 0.06 * s, 6, 12), color, new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(0, 0.36 * s, 1.85 * s));
    k.pop();
    if (to) {
      const dx = to[0] - x, dz = to[1] - z, len = Math.hypot(dx, dz), a = Math.atan2(dx, dz), head = [x + Math.sin(yaw) * 2 * s, z + Math.cos(yaw) * 2 * s];
      const ddx = to[0] - head[0], ddz = to[1] - head[1], l2 = Math.hypot(ddx, ddz), n = Math.floor(l2 / 0.34);
      for (let i = 0; i < n; i++) {
        const t = i / n, wob = Math.sin(t * 9 + len) * 0.5 * Math.sin(t * Math.PI);
        const px = head[0] + ddx * t - Math.cos(a) * wob, pz = head[1] + ddz * t + Math.sin(a) * wob;
        k.put('paint', new THREE.TorusGeometry(0.17, 0.045, 5, 8), i % 7 ? color : RUST[i % 5], new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(i % 2 ? Math.PI / 2 : 0.2, Math.atan2(ddx, ddz), 0, 'YXZ')).setPosition(px, i % 2 ? 0.06 : 0.17, pz));
      }
    }
  };

  /** An enclosed lifeboat left on its side frames. */
  B.lifeboat = (k, o) => {
    const { x, z, yaw = 0, color = '#c9571c' } = o;
    k.push(x, 0, z, yaw);
    k.sphere('paint', 0, 1.25, 0, 1.3, color, 2.9, 0.92, 1.0, 14);
    k.box('paint', 0.2, 2.2, 0, 3.6, 0.85, 1.7, color); k.box('paint', -1.2, 2.72, 0, 1.3, 0.5, 1.1, color);
    for (const wx of [-0.6, 0.5, 1.6]) for (const sz of [-1, 1]) k.box('dark', wx, 2.25, sz * 0.86, 0.5, 0.28, 0.04, '#0b0c0d');
    k.box('paint', 0, 1.2, 0, 7.2, 0.14, 2.7, '#d8d4c8');                                                                    // rubbing band
    for (const cx of [-1.8, 1.8]) { k.box('wood', cx, 0.25, 0, 0.3, 0.5, 2.6, '#8b7355'); for (const sz of [-1, 1]) k.box('wood', cx, 0.65, sz * 1.05, 0.3, 0.6, 0.3, '#7d684e'); }
    k.cyl('dark', [-3.6, 0.75, 0], [-4.1, 0.75, 0], 0.16, 0.1, '#222', 8);
    k.pop();
  };

  /** Posts and a sagging tarp roof. w along local x, d along local z. */
  B.shelter = (k, o) => {
    const { x, z, yaw = 0, w = 6, d = 4, h = 2.7, color = '#3f6e8c', drop = 0.5 } = o;
    k.push(x, 0, z, yaw);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl('steel', [sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1)], [sx * (w / 2 - 0.1), h - (sz > 0 ? drop : 0), sz * (d / 2 - 0.1)], 0.045, 0.045, '#6a6d70', 6);
    const slope = Math.atan2(drop, d);
    k.box('matte', 0, h - drop / 2 + 0.03, 0, w + 0.5, 0.035, Math.hypot(d, drop) + 0.5, color, slope, 0, 0);
    for (const sx of [-1, 1]) k.beam('steel', [sx * (w / 2 - 0.1), h, -d / 2 + 0.1], [sx * (w / 2 - 0.1), h - drop, d / 2 - 0.1], 0.05, 0.05, '#6a6d70');
    k.pop();
  };

  /** Hauling winch on a concrete bed: the machine that drags a hull up the beach. */
  B.winch = (k, o) => {
    const { x, z, yaw = 0 } = o;
    k.push(x, 0, z, yaw);
    k.box('wall', 0, 0.2, 0, 4.4, 0.4, 3.4, '#ffffff');
    for (const sx of [-1, 1]) { k.box('paint', sx * 1.45, 1.15, 0, 0.28, 1.5, 2.2, '#31485c'); k.cyl('paint', [sx * 1.3, 1.35, 0], [sx * 1.62, 1.35, 0], 1.0, 1.0, '#31485c', 16); }
    k.cyl('paint', [-1.3, 1.35, 0], [1.3, 1.35, 0], 0.62, 0.62, '#4a3d33', 14);                                               // drum, wound with wire
    k.box('paint', -0.2, 0.9, -1.25, 1.7, 1.0, 0.9, '#b08a2a'); k.cyl('dark', [0.9, 1.4, -1.3], [0.9, 2.5, -1.3], 0.07, 0.07, '#222', 6);   // engine and exhaust
    k.box('hazard', 0, 0.44, 1.5, 4.2, 0.08, 0.3, '#ffffff');
    k.pop();
  };

  /** Crawler crane with a lattice boom (backdrop). angle = boom elevation in degrees. */
  B.crawlerCrane = (k, o) => {
    const { x, z, yaw = 0, boom = 36, angle = 64, color = '#c9a227' } = o, a = THREE.MathUtils.degToRad(angle);
    k.push(x, 0, z, yaw);
    for (const sx of [-1, 1]) { k.box('dark', sx * 2.1, 0.55, 0, 0.9, 1.1, 6.4, '#232323'); }
    k.box('paint', 0, 1.3, 0, 3.4, 0.5, 3.2, '#2c2c2c'); k.box('paint', 0, 2.6, -0.8, 3.3, 2.1, 5.2, color); k.box('paint', 0, 2.0, -3.9, 3.3, 1.2, 1.2, '#3a3a3a');
    k.box('glass', 1.1, 2.9, 1.85, 1.0, 1.1, 0.05, '#fff');
    const foot = [0, 2.2, 1.8], tip = [0, 2.2 + Math.sin(a) * boom, 1.8 + Math.cos(a) * boom], w = 0.75;
    const at = (t, ox, oy) => [ox, foot[1] + (tip[1] - foot[1]) * t + oy * Math.cos(a), foot[2] + (tip[2] - foot[2]) * t - oy * Math.sin(a)];
    for (const ox of [-w, w]) for (const oy of [-w, w]) k.beam('paint', at(0.02, ox * 0.4, oy * 0.4), at(1, ox, oy), 0.13, 0.13, color);
    const n = Math.round(boom / 2.2);
    for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, s = i % 2 ? 1 : -1; for (const ox of [-w, w]) k.beam('paint', at(t0, ox, s * w), at(t1, ox, -s * w), 0.06, 0.06, color); for (const oy of [-w, w]) k.beam('paint', at(t0, s * w, oy), at(t1, -s * w, oy), 0.06, 0.06, color); }
    const mast = [0, 9.5, -3.4];
    k.beam('paint', [0, 3.6, -1.6], mast, 0.25, 0.25, color);
    k.cyl('dark', mast, tip, 0.03, 0.03, '#111', 4); k.cyl('dark', mast, [0, 3.2, -4.3], 0.03, 0.03, '#111', 4);
    k.cyl('dark', tip, [0, tip[1] - boom * 0.55, tip[2] + 0.4], 0.025, 0.025, '#111', 4); k.box('paint', 0, tip[1] - boom * 0.55 - 0.5, tip[2] + 0.4, 0.5, 1.0, 0.5, '#b8291e');
    k.pop();
  };

  /** Low earth or sand mounds along a line (dunes, spoil heaps) — backdrop. */
  B.mounds = (k, o) => {
    const { a, b, n = 10, w = 16, h = 3, seed = 4, color = '#b9a888', spread = 6 } = o, R = rng(seed);
    for (let i = 0; i < n; i++) {
      const t = (i + R() * 0.8) / n, px = a[0] + (b[0] - a[0]) * t + (R() - 0.5) * spread, pz = a[1] + (b[1] - a[1]) * t + (R() - 0.5) * spread, r = w * (0.6 + R() * 0.8);
      k.sphere('matte', px, -r * 0.1, pz, r, color, 1, (h * (0.6 + R() * 0.8)) / r, 0.6 + R() * 0.5, 14);
    }
  };
}
