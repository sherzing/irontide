// Scenery for an old harbour quarter: roofs and what a house shows the street, the ropewalk's fittings, the market
// hall, boats, and the things that stand about in lanes and yards. Visual only, like everything in dressing.js: the
// level's solids are what a player touches.
//   roof · facade · arch · ropeworks · marketHall · pump · boat · gallery · netRack · iceStacks · rails · quay
//   coils · bales · casks · carts · stalls
import * as THREE from 'three';

const rad = THREE.MathUtils.degToRad;
const STONE = '#cfc8b8', HEMP = '#b89a64', IRON = '#2c3033', SLATE = '#7f868d', TIMBER = '#f2e2c8', WHITE = '#e6e2d6';

export function addTownBuilders(B, { rng }) {
  /** A pitched roof on a house: slates, the gable walls in the house's own material, barge boards, chimneys. ridge: 'x' or 'z', the way it runs. flat: a parapet instead. */
  B.roof = (k, o) => {
    const { x0, z0, x1, z1, y, ridge = 'x', rise = 2.4, over = 0.38, mat = 'limewash', tint = '#ffffff', seed = 1, flat = false, pots = true } = o, R = rng(seed * 131 + 7);
    const xm = (x0 + x1) / 2, zm = (z0 + z1) / 2, SL = ['#7f868d', '#747b82', '#8a8f94', '#7c8082'][seed % 4];
    if (flat) { k.box('wall', xm, y + 0.13, zm, x1 - x0 + 0.3, 0.26, z1 - z0 + 0.3, '#b9b4a8'); return; }
    const alongX = ridge === 'x', half = (alongX ? z1 - z0 : x1 - x0) / 2, len = alongX ? x1 - x0 : z1 - z0, a = Math.atan2(rise, half), sl = Math.hypot(half, rise) + over / Math.cos(a);
    const c = (sl / 2) * Math.cos(a), yy = y + rise - (sl / 2) * Math.sin(a) + 0.07;
    for (const s of [-1, 1]) {
      if (alongX) k.box('slate', xm, yy, zm + s * c, len + over * 2, 0.1, sl, SL, s * a, 0, 0);
      else k.box('slate', xm + s * c, yy, zm, sl, 0.1, len + over * 2, SL, 0, 0, -s * a);
    }
    k.box('dark', xm, y + rise + 0.12, zm, alongX ? len + over * 2 : 0.3, 0.12, alongX ? 0.3 : len + over * 2, '#33373a');
    const G = (p, q, top) => k.quad(mat, p, q, top, top, tint, 2.6);
    if (alongX) { G([x0, y, z0], [x0, y, z1], [x0, y + rise, zm]); G([x1, y, z1], [x1, y, z0], [x1, y + rise, zm]); }
    else { G([x0, y, z1], [x1, y, z1], [xm, y + rise, z1]); G([x1, y, z0], [x0, y, z0], [xm, y + rise, z0]); }
    if (!pots) return;
    for (const t of R() < 0.5 ? [0.24] : [0.22, 0.8]) {                                        // chimney stacks on the ridge
      const u = (t - 0.5) * (len - 1.4), px = alongX ? xm + u : xm, pz = alongX ? zm : zm + u, w = alongX ? 0.85 : 0.6, d = alongX ? 0.6 : 0.85, top = y + rise + 0.95 + R() * 0.4;
      k.box('brick', px, (y + rise - 0.6 + top) / 2, pz, w, top - (y + rise - 0.6), d, '#ffffff'); k.box('wall', px, top + 0.05, pz, w + 0.12, 0.1, d + 0.12, STONE);
      for (const s of [-0.2, 0.2]) k.cyl('paint', [px + (alongX ? s : 0), top + 0.1, pz + (alongX ? 0 : s)], [px + (alongX ? s : 0), top + 0.42, pz + (alongX ? 0 : s)], 0.09, 0.075, '#a2583c', 8);
    }
  };

  /**
   * What one wall of a house shows the street: windows with shutters, a door, a footing and a band under the eaves,
   * or a warehouse's loading doors under a hoist beam, or a tarred shed's sliding door. The wall runs from a to b with
   * the street on the right. open: real openings in it, [from, to, top, sill] in metres along the wall. lift: the wall
   * starts this high (a room that bridges a lane).
   */
  B.facade = (k, o) => {
    const { a, b, h, style = 'house', paint = '#2f4a3c', seed = 1, open = [], room = 0, name = null, sub = null, lift = 0 } = o;
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), R = rng(seed * 977 + 13);
    const FRAME = style !== 'house' || R() < 0.65 ? '#e6e2d6' : paint;
    k.push(a[0], 0, a[1], Math.atan2(-dz, dx));
    const hit = (p0, p1, y0, y1) => p0 < 0.2 || p1 > len - 0.2 || open.some(([p, q, top, sill]) => p1 > p - 0.3 && p0 < q + 0.3 && y0 < top + 0.45 && y1 > sill - 0.25);
    const win = (x, y, w, hh, shut) => {
      if (hit(x - w / 2, x + w / 2, y, y + hh)) return;
      k.box('glass', x, y + hh / 2, 0.012, w, hh, 0.02, '#ffffff');
      for (const s of [-1, 1]) k.box('matte', x + s * (w / 2 + 0.03), y + hh / 2, 0.035, 0.07, hh + 0.13, 0.07, FRAME);
      k.box('matte', x, y + hh + 0.035, 0.035, w + 0.13, 0.07, 0.07, FRAME); k.box('matte', x, y - 0.03, 0.035, w + 0.13, 0.06, 0.07, FRAME);
      k.box('matte', x, y + hh / 2, 0.03, 0.035, hh, 0.035, FRAME); k.box('matte', x, y + hh * 0.58, 0.03, w, 0.035, 0.035, FRAME);
      k.box('wall', x, y - 0.095, 0.075, w + 0.3, 0.07, 0.15, STONE);
      if (shut === 'bars') { for (const s of [-0.25, 0, 0.25]) k.box('dark', x + s * w, y + hh / 2, 0.06, 0.025, hh, 0.025, IRON); k.box('wall', x, y + hh + 0.16, 0.04, w + 0.34, 0.2, 0.08, STONE); return; }
      if (!shut) return;
      const st = R(), lw = w / 2;
      for (const s of [-1, 1]) {
        if (st < 0.5 || (st > 0.74 && s < 0)) k.box('matte', x + s * (w / 2 + 0.08 + lw / 2), y + hh / 2, 0.03, lw, hh, 0.04, paint);                       // folded back on the wall
        else if (st <= 0.74) k.box('matte', x + s * lw / 2, y + hh / 2, 0.085, lw - 0.01, hh, 0.035, paint);                                              // shut
        else k.box('matte', x + s * (w / 2 + 0.06 + (lw / 2) * 0.64), y + hh / 2, 0.05 + (lw / 2) * 0.77, lw, hh, 0.035, paint, 0, -s * rad(50), 0);     // standing ajar
      }
    };
    const leaf = (x, w, hh, col, y = 0.04) => {
      if (hit(x - w / 2, x + w / 2, y, y + hh)) return false;
      k.box('matte', x, y + hh / 2, 0.03, w, hh, 0.05, col);
      for (const s of [-1, 1]) k.box('wall', x + s * (w / 2 + 0.08), y + (hh + 0.1) / 2 - 0.04, 0.045, 0.16, hh + 0.1, 0.09, STONE);
      k.box('wall', x, y + hh + 0.13, 0.045, w + 0.34, 0.2, 0.1, STONE); k.box('wall', x, 0.02, 0.09, w + 0.34, 0.04, 0.2, '#a9a59a');
      return true;
    };
    for (const [p, q, top, sill] of open) {                                                         // a real opening gets its stone surround
      for (const x of [p - 0.09, q + 0.09]) k.box('wall', x, (sill + top) / 2, 0.035, 0.18, top - sill, 0.09, STONE);
      k.box('wall', (p + q) / 2, top + 0.13, 0.035, q - p + 0.5, 0.26, 0.1, STONE);
      if (sill > 0.3) k.box('wall', (p + q) / 2, sill - 0.05, 0.07, q - p + 0.44, 0.1, 0.16, STONE);
    }
    // the footing, broken where a door is
    let cur = 0; const fh = style === 'shed' ? 0.3 : 0.7;
    if (!lift) for (const [p, q] of [...open.filter((v) => v[3] < 0.5).sort((m, n) => m[0] - n[0]), [len, len]]) { if (p - cur > 0.3) k.box('wall', (cur + p) / 2, fh / 2, 0.03, p - cur - (cur ? 0.18 : 0) - (p < len ? 0.18 : 0), fh, 0.06, style === 'house' ? '#c4c0b6' : '#b0aca2'); cur = q; }
    const g = lift || (style === 'shed' ? h : Math.min(h, room || 3.3)), ups = Math.max(0, Math.round((h - g) / 2.9)), up = ups ? (h - g) / ups : 0;
    const nb = Math.max(1, Math.floor((len - 0.6) / (style === 'house' ? 2.5 : 3.1))), pitch = (len - 0.6) / nb, cx = (i) => 0.3 + pitch * (i + 0.5);

    if (style === 'house') {
      const door = len > 3 && !lift ? Math.floor(R() * nb) : -1;
      for (let i = 0; i < nb; i++) {
        if (lift) { /* nothing below the room */ }
        else if (i === door && leaf(cx(i), 1.02, 2.1, R() < 0.7 ? paint : '#4a3526')) { k.box('glass', cx(i), 2.02, 0.07, 0.6, 0.16, 0.012, '#ffffff'); k.sphere('dark', cx(i) + 0.34, 1.12, 0.08, 0.04, '#b8963a'); }
        else if (R() < 0.9) win(cx(i), 0.98, 1.0, 1.45, true);
        for (let f = 0; f < ups; f++) if (R() < 0.94) win(cx(i), g + f * up + 0.82, 0.95, Math.min(1.45, up - 1.25), true);
      }
      k.box('wall', len / 2, g + (lift ? 0.06 : 0), 0.03, len, 0.12, 0.06, STONE);
      k.box('wall', len / 2, h - 0.1, 0.07, len + 0.08, 0.2, 0.14, STONE);
    } else if (style === 'warehouse') {
      const mid = len > 5 ? Math.floor(nb / 2) : -1;
      for (let i = 0; i < nb; i++) {
        if (i === mid) {                                                                            // the loading bay: doors one above the other under the hoist
          const x = cx(i);
          if (!lift) leaf(x, 2.3, 2.6, paint);
          for (let f = 0; f < ups; f++) { const y = g + f * up + 0.12; if (!hit(x - 0.8, x + 0.8, y, y + 1.9)) { k.box('matte', x, y + 0.95, 0.03, 1.5, 1.9, 0.05, paint); k.box('wall', x, y - 0.06, 0.12, 1.9, 0.12, 0.26, STONE); k.box('wall', x, y + 2.02, 0.04, 1.84, 0.2, 0.09, STONE); k.box('dark', x, y + 0.95, 0.062, 0.03, 1.9, 0.02, IRON); } }
          k.beam('timber', [x, h - 0.32, -0.1], [x, h - 0.32, 1.15], 0.16, 0.2, '#c9b8a4'); k.cyl('dark', [x, h - 0.44, 1.0], [x, h - 1.1, 1.0], 0.012, 0.012, IRON, 4); k.box('dark', x, h - 1.18, 1.0, 0.08, 0.16, 0.05, IRON);
          continue;
        }
        if (R() < 0.85 && !lift) win(cx(i), 1.25, 0.9, 1.15, 'bars');
        for (let f = 0; f < ups; f++) if (R() < 0.9) win(cx(i), g + f * up + 0.9, 0.9, Math.min(1.2, up - 1.4), 'bars');
      }
      k.box('brick', len / 2, h - 0.17, 0.05, len + 0.06, 0.34, 0.1, '#e6dcd0'); k.box('wall', len / 2, h + 0.0, 0.08, len + 0.1, 0.08, 0.18, STONE);
    } else {                                                                                        // tarred shed
      for (const x of [0.07, len - 0.07]) k.box('matte', x, h / 2, 0.025, 0.14, h, 0.05, '#e6e2d6');
      const slide = len > 5 ? 0.3 + R() * 0.4 : -1;
      if (slide > 0 && !hit(len * slide - 1.2, len * slide + 1.2, 0, 2.6)) { const x = len * slide; k.box('matte', x, 1.28, 0.05, 2.3, 2.5, 0.06, '#3f3a35'); k.box('dark', x + 0.4, 2.62, 0.07, 3.6, 0.06, 0.05, IRON); for (const s of [-0.75, 0, 0.75]) k.box('matte', x + s, 1.28, 0.085, 0.09, 2.5, 0.02, '#35302c'); }
      for (let i = 0; i < nb; i++) if (R() < 0.6) win(cx(i), Math.min(h - 1.6, 3.6), 0.8, 0.9, false);
      k.box('matte', len / 2, h - 0.1, 0.035, len, 0.2, 0.05, '#e6e2d6');
    }
    if (R() < 0.75) { const x = R() < 0.5 ? 0.22 : len - 0.22; k.cyl('dark', [x, 0.1, 0.11], [x, h - 0.05, 0.11], 0.05, 0.05, '#4a4d4f', 6); }
    if (name) {                                                                                     // the name over the door of a house that has one
      const d = open.find((v) => v[3] < 0.5), x = d ? (d[0] + d[1]) / 2 : len / 2, y = d ? d[2] + 0.62 : 3.0, w = Math.min(len - 0.8, 0.4 + name.length * 0.26);
      k.box('matte', x, y, 0.05, w, sub ? 0.66 : 0.46, 0.06, paint);
      k.sign(name, x, y + (sub ? 0.11 : 0), 0.09, { h: 0.24, color: '#f1ece0', worn: 0.15 });
      if (sub) k.sign(sub, x, y - 0.2, 0.09, { h: 0.1, color: '#f1ece0', worn: 0.15 });
    }
    k.pop();
  };

  /** The curve of a gateway: fills the top corners of a square opening in a wall that runs along z at x. y: the opening's top. */
  B.arch = (k, o) => {
    const { x, z0, z1, y, th = 0.6, rise = 0.95, mat = 'brick' } = o, zm = (z0 + z1) / 2, sh = new THREE.Shape();
    sh.moveTo(-z0, y - rise); sh.lineTo(-z0, y + 0.02); sh.lineTo(-z1, y + 0.02); sh.lineTo(-z1, y - rise); sh.quadraticCurveTo(-zm, y + rise - 0.1, -z0, y - rise);
    const g = new THREE.ExtrudeGeometry(sh, { depth: th + 0.02, bevelEnabled: false, curveSegments: 14 }).toNonIndexed(), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.5, uv.getY(i) / 1.5);
    k.put(mat, g, '#ffffff', new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(x - th / 2 - 0.01, 0, 0));
    for (const s of [-1, 1]) { k.box('wall', x + s * (th / 2 + 0.03), y + 0.1, zm, 0.08, 0.5, 0.36, STONE); for (const z of [z0 - 0.12, z1 + 0.12]) k.box('wall', x + s * (th / 2 + 0.02), (y - rise) / 2, z, 0.06, y - rise, 0.3, STONE); }
  };

  /**
   * Everything of a ropewalk above and inside its walls: the slate roof with skylights open to the sun, the trusses,
   * strands of rope hung along one side to dry, window and door frames, the laying machines and the bobbins.
   */
  B.ropeworks = (k, o) => {
    const { x0, x1, z0, z1, eave, th = 0.4, doors = [], ends = null, windows = [], racks = [], jennies = [], rise = 2.1, over = 0.4 } = o;
    const zm = (z0 + z1) / 2, half = (z1 - z0) / 2, a = Math.atan2(rise, half), sl = Math.hypot(half, rise) + over / Math.cos(a), c = (sl / 2) * Math.cos(a), yy = eave + rise - (sl / 2) * Math.sin(a) + 0.07, len = x1 - x0;
    k.box('slate', (x0 + x1) / 2, yy, zm - c, len + over * 2, 0.1, sl, SLATE, -a, 0, 0);                 // north slope, whole
    const BAY = 7, n = Math.round(len / BAY), bay = len / n, GAP = 1.5;                                       // south slope: a skylight in every bay
    for (let i = 0; i < n; i++) { const xa = x0 + i * bay + (i ? GAP / 2 : -over), xb = x0 + (i + 1) * bay - (i < n - 1 ? GAP / 2 : -over); k.box('slate', (xa + xb) / 2, yy, zm + c, xb - xa, 0.1, sl, SLATE, a, 0, 0); }
    for (let i = 1; i < n; i++) { const x = x0 + i * bay; k.box('slate', x, eave + rise - 0.2, zm + 0.32, GAP, 0.1, 0.9, SLATE, a, 0, 0); k.box('slate', x, eave + 0.16, z1 - 0.1, GAP, 0.1, 1.0 + over, SLATE, a, 0, 0); }   // the slates above and below each one
    k.box('dark', (x0 + x1) / 2, eave + rise + 0.12, zm, len + over * 2, 0.12, 0.3, '#33373a');
    for (const [x, s] of [[x0, 1], [x1, -1]]) k.quad('brick', [x, eave, s > 0 ? z0 : z1], [x, eave, s > 0 ? z1 : z0], [x, eave + rise, zm], [x, eave + rise, zm], '#ffffff', 1.5);
    for (const [x, s] of [[x0 + th, -1], [x1 - th, 1]]) k.quad('brick', [x, eave, s > 0 ? z0 : z1], [x, eave, s > 0 ? z1 : z0], [x, eave + rise, zm], [x, eave + rise, zm], '#ffffff', 1.5);   // and seen from inside
    const W = TIMBER, zi0 = z0 + th, zi1 = z1 - th;
    for (let x = x0 + 3.5; x < x1 - 2; x += 3.5) {                                                           // trusses
      k.beam('timber', [x, eave - 0.1, zi0], [x, eave - 0.1, zi1], 0.16, 0.2, W); k.beam('timber', [x, eave, zm], [x, eave + rise - 0.1, zm], 0.12, 0.12, W);
      for (const s of [-1, 1]) { k.beam('timber', [x, eave + 0.02, zm + s * (half - 0.3)], [x, eave + rise - 0.06, zm], 0.12, 0.16, W); k.beam('timber', [x, eave, zm + s * half * 0.5], [x, eave + rise * 0.5 - 0.1, zm + s * half * 0.5], 0.08, 0.08, W); }
    }
    for (const s of [-1, 1]) k.beam('timber', [x0 + th, eave + rise * 0.5, zm + s * half * 0.5], [x1 - th, eave + rise * 0.5, zm + s * half * 0.5], 0.1, 0.14, W);   // purlins
    for (let i = 0; i < 5; i++) for (let x = x0 + 3.5; x < x1 - 5.5; x += 3.5) k.rope([x, eave - 0.22, zi0 + 0.7 + i * 0.2], [x + 3.5, eave - 0.22, zi0 + 0.7 + i * 0.2], 0.05 + (i % 2) * 0.04, 0.022, i % 2 ? '#a88c5a' : HEMP, 3, 'matte');
    for (const x of windows) {                                                                              // north windows: frame, bars, sill
      for (const s of [-1, 1]) k.box('matte', x + s * 1.06, 2.25, z0 + th / 2, 0.08, 1.5, th + 0.06, WHITE);
      for (const y of [1.5, 3.0]) k.box('matte', x, y, z0 + th / 2, 2.2, 0.08, th + 0.06, WHITE);
      for (const s of [-0.55, 0, 0.55]) k.box('dark', x + s, 2.25, z0 + th / 2, 0.03, 1.5, 0.03, IRON); k.box('dark', x, 2.25, z0 + th / 2, 2.2, 0.03, 0.03, IRON);
    }
    for (const [p, q, top] of doors) {                                                                      // lane doors: timber frame, the two leaves swung back against the wall outside
      for (const x of [p - 0.08, q + 0.08]) k.box('matte', x, top / 2, z1 - th / 2, 0.16, top, th + 0.08, WHITE); k.box('matte', (p + q) / 2, top + 0.09, z1 - th / 2, q - p + 0.32, 0.18, th + 0.08, WHITE);
      const w = (q - p) / 2; for (const s of [-1, 1]) { const x = (s < 0 ? p : q) + s * (w / 2 + 0.2); k.box('matte', x, top / 2, z1 + 0.05, w, top - 0.1, 0.06, '#3d5a4c'); k.box('dark', x, top * 0.3, z1 + 0.09, w, 0.06, 0.02, IRON); k.box('dark', x, top * 0.75, z1 + 0.09, w, 0.06, 0.02, IRON); }
    }
    if (ends) for (const [x, s] of [[x0, -1], [x1, 1]]) {                                                   // the great doors in the gables
      const [p, q, top] = ends, xw = x - s * th / 2;
      for (const z of [p - 0.08, q + 0.08]) k.box('matte', xw, top / 2, z, th + 0.08, top, 0.16, WHITE); k.box('matte', xw, top + 0.09, (p + q) / 2, th + 0.08, 0.18, q - p + 0.32, WHITE);
      const w = (q - p) / 2; for (const e of [-1, 1]) { const z = (e < 0 ? p : q) + e * (w / 2 + 0.2); if (z - w / 2 < z0 + 0.1 || z + w / 2 > z1 - 0.1) continue; k.box('matte', x + s * 0.05, top / 2, z, 0.06, top - 0.1, w, '#3d5a4c'); }
    }
    for (const x of jennies) {                                                                              // the laying machine: a frame, a great wheel, a row of hooks
      const z = zi0 + 0.75, C = '#3d5a4c';
      k.box('paint', x, 0.85, z, 2.2, 1.7, 1.5, C); k.box('timber', x, 1.74, z, 2.3, 0.08, 1.6, W);
      const g = new THREE.TorusGeometry(0.72, 0.045, 6, 20); k.put('dark', g, IRON, new THREE.Matrix4().setPosition(x, 1.1, z + 0.82));
      for (let i = 0; i < 6; i++) { const an = (i / 6) * Math.PI; k.beam('dark', [x - Math.cos(an) * 0.72, 1.1 - Math.sin(an) * 0.72, z + 0.82], [x + Math.cos(an) * 0.72, 1.1 + Math.sin(an) * 0.72, z + 0.82], 0.03, 0.03, IRON); }
      k.cyl('dark', [x, 1.1, z + 0.7], [x, 1.1, z + 0.95], 0.07, 0.07, IRON, 8);
      for (const s of [-0.6, -0.2, 0.2, 0.6]) k.cyl('dark', [x + s, 1.5, z + 0.75], [x + s, 1.5, z + 0.98], 0.02, 0.02, '#8a8f93', 5);
    }
    for (const [x, ra, rb] of racks) for (const s of [-1, 1]) for (let z = ra + 0.5; z < rb - 0.3; z += 0.76) for (let j = 0; j < 3; j++) {  // bobbins on both faces of each rack
      const i = Math.round(z * 4), y = 0.45 + j * 0.62;
      k.cyl('timber', [x + s * 0.45, y, z], [x + s * 0.82, y, z], 0.2, 0.2, TIMBER, 10); k.cyl('matte', [x + s * 0.5, y, z], [x + s * 0.78, y, z], 0.17, 0.17, (i + j) % 2 ? HEMP : '#a88c5a', 10);
    }
  };

  /** A market hall: a slate roof with a glazed lantern on cast-iron columns, open on every side, and the clerk's kiosk under it. */
  B.marketHall = (k, o) => {
    const { x0, x1, z0, z1, eave = 4.3, rise = 2.3, cols = [], kiosk = null, color = '#2f4a3c' } = o, xm = (x0 + x1) / 2, zm = (z0 + z1) / 2, half = (z1 - z0) / 2, over = 0.9;
    const a = Math.atan2(rise, half), sl = Math.hypot(half, rise) + over / Math.cos(a), c = (sl / 2) * Math.cos(a), yy = eave + rise - (sl / 2) * Math.sin(a) + 0.07, len = x1 - x0 + over * 2, LAN = 1.3;
    for (const s of [-1, 1]) {
      const cut = LAN / Math.cos(a) / 2 + 0.2, l2 = sl - cut, c2 = c + (cut / 2) * Math.cos(a), y2 = yy - (cut / 2) * Math.sin(a);                     // each slope stops short of the ridge, where the lantern sits
      k.box('slate', xm, y2, zm + s * c2, len, 0.1, l2, SLATE, s * a, 0, 0);
      k.box('glass', xm, eave + rise + 0.18, zm + s * LAN * 0.5, len - 3, 0.5, 0.04, '#ffffff');
      k.box('slate', xm, eave + rise + 0.62, zm + s * 0.42, len - 2.4, 0.08, 1.05, '#9aa1a8', s * 0.42, 0, 0);
      k.box('matte', xm, eave - 0.2, zm + s * (half + over - 0.05), len, 0.3, 0.05, color);                                                         // valance
      k.box('paint', xm, eave - 0.02, zm + s * half, x1 - x0 + 0.3, 0.26, 0.2, color);
    }
    for (const x of [x0, x1]) k.box('paint', x, eave - 0.02, zm, 0.2, 0.26, z1 - z0, color);
    for (const x of [x0 - over, x1 + over]) for (const s of [-1, 1]) k.beam('matte', [x, eave - 0.05, zm + s * (half + over)], [x, eave + rise - 0.25, zm + s * 0.5], 0.06, 0.26, color);   // barge boards
    for (const x of [...new Set(cols.map((p) => p[0]))]) {                                                                                         // a truss over each row of columns
      k.beam('paint', [x, eave + 0.08, z0], [x, eave + 0.08, z1], 0.12, 0.16, color);
      for (const s of [-1, 1]) { k.beam('paint', [x, eave + 0.1, zm + s * half], [x, eave + rise - 0.2, zm + s * 0.4], 0.1, 0.14, color); k.beam('paint', [x, eave + 0.1, zm + s * half * 0.5], [x, eave + rise * 0.52, zm + s * half * 0.5], 0.06, 0.06, color); }
    }
    for (const [x, z] of cols) {
      k.box('paint', x, 0.25, z, 0.34, 0.5, 0.34, color); k.cyl('paint', [x, 0.5, z], [x, eave - 0.3, z], 0.1, 0.075, color, 10); k.box('paint', x, eave - 0.22, z, 0.28, 0.16, 0.28, color);
      for (const [dx2, dz2] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const px = x + dx2 * 0.85, pz = z + dz2 * 0.85; if (px < x0 - 0.1 || px > x1 + 0.1 || pz < z0 - 0.1 || pz > z1 + 0.1) continue; k.beam('paint', [x, eave - 1.0, z], [px, eave - 0.14, pz], 0.05, 0.08, color); }
    }
    for (const x of [xm - 4.6, xm + 4.6]) { k.cyl('dark', [x, eave + 0.1, zm], [x, eave - 0.7, zm], 0.012, 0.012, IRON, 4); k.box('dark', x, eave - 0.76, zm, 0.34, 0.1, 0.34, IRON); k.box('glow', x, eave - 0.83, zm, 0.2, 0.05, 0.2, [3.2, 2.7, 1.9]); }
    if (kiosk) {
      const [x, z, w, hh] = kiosk, g = new THREE.ConeGeometry(w * 0.86, 0.9, 4).toNonIndexed(); g.rotateY(Math.PI / 4);
      k.put('slate', g, '#9aa1a8', new THREE.Matrix4().setPosition(x, hh + 0.45, z)); k.box('matte', x, hh + 0.03, z, w + 0.5, 0.08, w + 0.5, WHITE);
      for (const [sx, sz, yaw] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
        k.push(x + sx * w / 2, 0, z + sz * w / 2, yaw);
        k.box('glass', 0, 1.75, 0.012, w * 0.5, 0.8, 0.02, '#ffffff'); k.box('matte', 0, 1.3, 0.09, w * 0.6, 0.06, 0.2, WHITE); k.box('matte', 0, 2.2, 0.03, w * 0.56, 0.06, 0.05, WHITE);
        for (const s of [-1, 1]) k.box('matte', s * w * 0.28, 1.75, 0.03, 0.06, 0.9, 0.05, WHITE);
        k.sign('MARKET CLERK', 0, 2.62, 0.02, { h: 0.16, color: '#f1ece0', worn: 0.2 });
        k.pop();
      }
    }
  };

  /** The square's hand pump. */
  B.pump = (k, o) => {
    const { x, z, yaw = 0, color = '#2f4a3c' } = o;
    k.push(x, 1.15, z, yaw);
    k.cyl('paint', [0, 0, 0], [0, 0.95, 0], 0.11, 0.09, color, 10); k.sphere('paint', 0, 1.0, 0, 0.13, color); k.cyl('paint', [0, 0.62, 0], [0.42, 0.52, 0], 0.045, 0.04, color, 8);
    k.beam('paint', [-0.05, 0.9, 0], [-0.6, 0.45, 0], 0.04, 0.05, color); k.sphere('paint', -0.62, 0.43, 0, 0.05, color);
    k.pop();
  };

  /**
   * A wooden fishing boat. chocks: hauled out and standing on timber; afloat: the water's height. house: a wheelhouse;
   * mast: a mast and derrick. The bow points along +x.
   */
  B.boat = (k, o) => {
    const { x, z, yaw = 0, len = 8, beam = 2.8, color = '#2f5d7a', chocks = false, afloat = null, house = false, mast = false, name = null } = o;
    const r = beam / 2, D = beam * 0.42, G = afloat != null ? afloat + D * 0.55 : 0.42 + D, L2 = len / 2;
    const pts = [[-L2, r * 0.5], [-L2 + 0.25, r * 0.86], [-len * 0.2, r], [len * 0.12, r * 0.97], [len * 0.33, r * 0.68], [L2 - 0.3, r * 0.24], [L2, 0.03]];
    const bend = (px) => (px > 0 ? 0.42 : 0.14) * (px / L2) ** 2 * (beam / 2.8);      // the sheer: the deck rises to the bow, and a little to the stern
    k.push(x, 0, z, rad(yaw));
    k.lathe('paint', pts, color, { phi0: 0, phiLen: Math.PI, squash: [D / r, 1], at: [0, G, 0], seg: 14, bend });
    k.lathe('paint', pts.map(([px, pr]) => [px, pr * 1.012]), '#6e2b22', { phi0: Math.PI / 2 - 0.62, phiLen: 1.24, squash: [D / r, 1], at: [0, G, 0], seg: 10, bend });      // bottom paint
    for (const p0 of [0, Math.PI - 0.2]) k.lathe('paint', pts.map(([px, pr]) => [px, pr * 1.015]), '#e6e2d6', { phi0: p0, phiLen: 0.2, squash: [D / r, 1], at: [0, G, 0], seg: 3, bend });   // the white strake
    k.lathe('timber', pts.map(([px, pr]) => [px, pr * 0.99]), '#f4ead8', { squash: [0.03 / r, 1], at: [0, G, 0], seg: 14, bend });                                              // deck
    k.box('paint', -L2 + 0.04, G - D * 0.3 + bend(-L2), 0, 0.08, D * 0.6, r * 0.9, color);                                                                                             // transom
    k.box('paint', L2 - 0.2, G + 0.2 + bend(L2 - 0.2), 0, 0.14, 0.5, 0.14, WHITE);                                                                                                     // stem post
    for (const s of [-1, 1]) k.beam('paint', [-L2 + 0.2, G + 0.16, s * r * 0.86], [len * 0.2, G + 0.16, s * r * 0.9], 0.06, 0.26, color);                                 // bulwarks amidships
    if (house) {
      const hx = -len * 0.2, hw = len * 0.2, hd = beam * 0.5;
      k.box('matte', hx, G + 0.85, 0, hw, 1.7, hd, WHITE); k.box('matte', hx, G + 1.74, 0, hw + 0.3, 0.08, hd + 0.3, color);
      for (const s of [-1, 1]) k.box('glass', hx + hw * 0.1, G + 1.25, s * (hd / 2 + 0.01), hw * 0.6, 0.45, 0.02, '#ffffff'); k.box('glass', hx + hw / 2 + 0.01, G + 1.25, 0, 0.02, 0.45, hd * 0.7, '#ffffff');
      if (name) for (const s of [-1, 1]) k.sign(name, hx, G + 0.6, s * (hd / 2 + 0.02), { h: 0.14, color: '#1b1d1f', worn: 0.2, yaw: s > 0 ? 0 : Math.PI });
    }
    if (mast) { const mx = len * 0.1, mh = len * 0.55; k.cyl('timber', [mx, G, 0], [mx, G + mh, 0], 0.08, 0.05, TIMBER, 8); k.beam('timber', [mx, G + mh * 0.35, 0], [mx - len * 0.3, G + mh * 0.75, 0], 0.06, 0.06, TIMBER); k.rope([mx, G + mh, 0], [L2 - 0.2, G + 0.4, 0], 0.1, 0.012, '#1b1d1f', 4); k.rope([mx, G + mh, 0], [-L2 + 0.1, G + 0.3, 0], 0.15, 0.012, '#1b1d1f', 4); }
    k.box('timber', len * 0.22, G + 0.2, 0, 1.0, 0.36, r * 0.9, TIMBER);                                                                                                // hatch
    for (const [bx, bz, c2] of [[-len * 0.02, 0.3, '#c8b23a'], [len * 0.02, -0.35, '#a8442c'], [-len * 0.36, 0, '#3b5a4a']]) k.box('paint', bx, G + 0.16, bz * r, 0.55, 0.28, 0.4, c2);
    if (chocks) for (const cxx of [-len * 0.24, len * 0.2]) {
      k.box('timber', cxx, 0.21, 0, 0.3, 0.42, beam * 0.9, TIMBER);
      for (const s of [-1, 1]) { k.box('timber', cxx, 0.62, s * r * 0.72, 0.3, 0.5, 0.3, '#dccab0'); k.beam('timber', [cxx, 0.05, s * (r + 0.9)], [cxx, G - 0.35, s * r * 0.93], 0.1, 0.1, '#dccab0'); }
    }
    k.pop();
  };

  /** A timber gallery along a wall with the stairs up to it: braces, rails, stringers. stairs: [[x, z of the foot, z of the top, width, side], ...], each rising toward +z with its open side at +x (1) or -x (-1). */
  B.gallery = (k, o) => {
    const { x0, x1, z0, z1, y, stairs = [], posts = [], color = '#e2d2b8' } = o, W = TIMBER;
    for (const x of posts) for (const s of [-1, 1]) k.beam('timber', [x, y - 0.8, z0 + 0.08], [x + s * 0.7, y - 0.16, z0 + 0.08], 0.08, 0.08, W);
    const rail = (p, q) => {
      k.beam('matte', [p[0], p[1] + 1.0, p[2]], [q[0], q[1] + 1.0, q[2]], 0.09, 0.07, WHITE); k.beam('matte', [p[0], p[1] + 0.52, p[2]], [q[0], q[1] + 0.52, q[2]], 0.05, 0.05, WHITE);
      const n = Math.max(1, Math.round(Math.hypot(q[0] - p[0], q[2] - p[2]) / 1.4));
      for (let i = 0; i <= n; i++) { const t = i / n; k.box('matte', p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t + 0.5, p[2] + (q[2] - p[2]) * t, 0.07, 1.0, 0.07, WHITE); }
    };
    const open = stairs.map(([x, , , w, side]) => x + side * (w / 2 + 0.04)), xa = Math.min(...open, x1), xb = Math.max(...open, x0);
    if (stairs.length < 2) { rail([stairs.length ? open[0] : x0, y, z0 + 0.04], [x1 - 0.04, y, z0 + 0.04]); rail([x1 - 0.04, y, z0 + 0.04], [x1 - 0.04, y, z1 - 0.06]); }
    else rail([xa, y, z0 + 0.04], [xb, y, z0 + 0.04]);
    k.box('timber', (x0 + x1) / 2, y - 0.2, z0 + 0.06, x1 - x0, 0.14, 0.1, color);
    for (const [x, za, zb, w, side] of stairs) { for (const s of [-1, 1]) k.beam('timber', [x + s * w / 2, 0.0, za], [x + s * w / 2, y - 0.12, zb], 0.07, 0.3, W); rail([x + side * (w / 2 + 0.04), 0.3, za + 0.3], [x + side * (w / 2 + 0.04), y, zb]); }
  };

  /** Nets hung to dry between two posts. */
  B.netRack = (k, o) => {
    const { a, b, h = 2.8, color = '#3b5a4a' } = o, R = rng(Math.round(a[0] * 13 + a[1] * 7) + 3), W = TIMBER;
    for (const p of [a, b]) k.cyl('timber', [p[0], 0, p[1]], [p[0], h, p[1]], 0.07, 0.055, W, 8);
    k.beam('timber', [a[0], h - 0.08, a[1]], [b[0], h - 0.08, b[1]], 0.08, 0.08, W);
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len, nx = -uz, nz = ux;
    for (const [off, drop, tint] of [[0.06, 1.5, color], [-0.07, 1.15, '#7a5a3a']]) {
      const p = (t, y) => [a[0] + ux * t + nx * off, y, a[1] + uz * t + nz * off], t0 = 0.25 + R() * 0.4, t1 = len - 0.25 - R() * 0.4;
      k.quad('chainlink', p(t0, h - 0.1 - drop), p(t1, h - 0.1 - drop * (0.8 + R() * 0.2)), p(t1, h - 0.1), p(t0, h - 0.1), tint, 6);
      for (let t = t0 + 0.2; t < t1; t += 0.45) k.sphere('paint', ...p(t, h - 0.13 - drop * 0.92), 0.05, R() < 0.5 ? '#c9571c' : '#d8d4c8', 1, 1, 1, 6);
    }
  };

  /** Blocks of ice stacked under sacking. at: [[x, z, w, d, h], ...] */
  B.iceStacks = (k, o) => {
    const R = rng(o.seed || 5);
    for (const [x, z, w, d, h] of o.at) {
      const nx = Math.max(1, Math.round(w / 0.8)), nz = Math.max(1, Math.round(d / 0.55)), ny = Math.max(1, Math.round(h / 0.36)), bx = w / nx, bz = d / nz, by = h / ny;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) for (let m = 0; m < nz; m++) {
        if (j === ny - 1 && R() < 0.25) continue;
        k.box('gloss', x - w / 2 + bx * (i + 0.5) + (R() - 0.5) * 0.03, by * (j + 0.5), z - d / 2 + bz * (m + 0.5) + (R() - 0.5) * 0.03, bx - 0.025, by - 0.012, bz - 0.025, ['#c3d0d6', '#d2dce0', '#b6c6ce'][(i * 2 + j + m) % 3]);
      }
      k.box('matte', x - w * 0.12, h + 0.02, z, w * 0.72, 0.05, d + 0.1, '#c8b08a'); k.box('matte', x - w * 0.12, h * 0.62, z + d / 2 + 0.03, w * 0.72, h * 0.76, 0.04, '#c8b08a');
    }
  };

  /** A railway siding running along z: two rails on sleepers, a buffer stop at each end. */
  B.rails = (k, o) => {
    const { x, z0, z1, gauge = 1.435 } = o;
    for (let z = z0 + 0.4; z < z1; z += 0.7) k.box('timber', x, 0.035, z, 2.5, 0.07, 0.24, '#c9b8a4');
    for (const s of [-1, 1]) k.box('steel', x + s * gauge / 2, 0.11, (z0 + z1) / 2, 0.07, 0.1, z1 - z0, '#6a5a50');
    for (const [z, s] of [[z0 + 0.3, 1], [z1 - 0.3, -1]]) { k.box('timber', x, 0.75, z, 2.3, 0.3, 0.3, '#c9b8a4'); for (const e of [-1, 1]) { k.box('steel', x + e * gauge / 2, 0.45, z, 0.1, 0.8, 0.1, '#6a5a50'); k.beam('steel', [x + e * gauge / 2, 0.8, z], [x + e * gauge / 2, 0.1, z + s * 1.1], 0.08, 0.08, '#6a5a50'); } k.box('paint', x, 0.75, z + s * 0.16, 2.3, 0.3, 0.02, '#b8291e'); }
  };

  /** What hangs on a quay wall that runs along z at x, facing the water to the west: tyre fenders, ladders, mooring rings. */
  B.quay = (k, o) => {
    const { x, z0, z1, water = -1.3, step = 7, ladders = [] } = o;
    for (let z = z0; z <= z1; z += step) {
      const g = new THREE.TorusGeometry(0.4, 0.16, 7, 14); k.put('dark', g, '#0d0d0d', new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(x - 0.2, -0.7, z));
      for (const s of [-0.2, 0.2]) k.cyl('dark', [x - 0.02, 0.2, z + s], [x - 0.2, -0.35, z + s], 0.012, 0.012, '#4a4a4a', 4);
    }
    for (const z of ladders) { for (const s of [-0.22, 0.22]) k.box('dark', x - 0.1, (0.5 + water - 0.6) / 2, z + s, 0.04, 0.5 - water + 0.6, 0.04, IRON); for (let y = water - 0.3; y < 0.3; y += 0.3) k.box('dark', x - 0.1, y, z, 0.03, 0.03, 0.44, IRON); }
  };

  /** Coils of rope, stacked. at: [[x, z, coils high], ...] */
  B.coils = (k, o) => {
    for (const [x, z, n] of o.at) for (let i = 0; i < n; i++) {
      const g = new THREE.TorusGeometry(0.43 - (i % 2) * 0.02, 0.13, 7, 18); g.rotateX(Math.PI / 2);
      k.put('matte', g, i % 3 ? HEMP : '#a88c5a', new THREE.Matrix4().makeRotationY(i * 1.3).setPosition(x + Math.sin(i * 2.1) * 0.03, 0.125 + i * 0.25, z + Math.cos(i * 1.7) * 0.03));
    }
  };

  /** Bales of hemp, bound twice. at: [[x, z, w, d, h, yawDeg], ...] */
  B.bales = (k, o) => {
    for (const [x, z, w, d, h, yawDeg = 0] of o.at) {
      k.push(x, 0, z, rad(yawDeg));
      const rows = Math.max(1, Math.round(h / 0.65)), bh = h / rows, cols = Math.max(1, Math.round(w / 1.25)), bw = w / cols;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const cx = -w / 2 + bw * (i + 0.5), cy = bh * (j + 0.5);
        k.rbox('matte', cx, cy, 0, bw - 0.03, bh - 0.02, d - 0.02, 0.09, (i + j) % 2 ? '#c2ac7a' : '#b59c68');
        for (const s of [-0.28, 0.28]) k.box('dark', cx + s * bw, cy, 0, 0.04, bh - 0.005, d + 0.005, '#3a342c');
      }
      k.pop();
    }
  };

  /** Casks lying on their sides: two below, one above; rows of them one behind the other. at: [[x, z, yawDeg, rows], ...] */
  B.casks = (k, o) => {
    const prof = [[-0.56, 0.33], [-0.3, 0.4], [0, 0.425], [0.3, 0.4], [0.56, 0.33]];
    for (const [x, z, yawDeg = 0, rows = 1] of o.at) {
      k.push(x, 0, z, rad(yawDeg));
      for (let r = 0; r < rows; r++) for (const [cx, cy, c] of [[-0.44, 0.425, '#e8c090'], [0.44, 0.425, '#dab284'], [0, 1.16, '#f0c898']]) {
        const cz = (r - (rows - 1) / 2) * 1.25, at = [cx, cy, cz], rot = [0, Math.PI / 2, 0];
        k.lathe('timber', prof, c, { at, rot, seg: 14 });
        for (const hx of [-0.5, -0.22, 0.22, 0.5]) { const rr = 0.345 + (0.56 - Math.abs(hx)) * 0.24; k.lathe('dark', [[hx - 0.025, rr], [hx + 0.025, rr]], IRON, { at, rot, seg: 14 }); }
        for (const s of [-1, 1]) k.cyl('timber', [cx, cy, cz + s * 0.52], [cx, cy, cz + s * 0.545], 0.325, 0.325, '#cfa878', 14);
      }
      k.box('timber', 0, 0.04, 0, 1.7, 0.08, 0.12, TIMBER);
      k.pop();
    }
  };

  /** Two-wheeled hand carts, shafts down. at: [[x, z, yawDeg], ...] */
  B.carts = (k, o) => {
    const W = TIMBER, D = '#d2bea2';
    for (const [x, z, yawDeg = 0] of o.at) {
      k.push(x, 0, z, rad(yawDeg));
      k.box('timber', -0.15, 0.72, 0, 1.7, 0.08, 1.0, W, 0, 0, -0.06);
      for (const s of [-1, 1]) { k.box('timber', -0.15, 0.9, s * 0.5, 1.7, 0.3, 0.05, D, 0, 0, -0.06); k.beam('timber', [0.6, 0.66, s * 0.42], [1.5, 0.05, s * 0.42], 0.06, 0.07, W); }
      k.box('timber', -0.98, 0.94, 0, 0.05, 0.3, 1.0, D);
      for (const s of [-1, 1]) {
        const g = new THREE.TorusGeometry(0.5, 0.04, 6, 18); k.put('dark', g, IRON, new THREE.Matrix4().setPosition(-0.15, 0.54, s * 0.6));
        for (let i = 0; i < 4; i++) { const an = (i / 4) * Math.PI + 0.3; k.beam('timber', [-0.15 - Math.cos(an) * 0.5, 0.54 - Math.sin(an) * 0.5, s * 0.6], [-0.15 + Math.cos(an) * 0.5, 0.54 + Math.sin(an) * 0.5, s * 0.6], 0.04, 0.05, D); }
        k.cyl('timber', [-0.15, 0.54, s * 0.52], [-0.15, 0.54, s * 0.68], 0.08, 0.08, D, 8);
      }
      k.cyl('dark', [-0.15, 0.54, -0.6], [-0.15, 0.54, 0.6], 0.03, 0.03, IRON, 6);
      for (const [bx, bz, c] of [[-0.6, -0.2, '#c8b08a'], [-0.1, 0.2, '#d6c098'], [0.25, -0.15, '#b8a07c']]) k.rbox('matte', bx, 0.95, bz, 0.5, 0.36, 0.42, 0.1, c);
      k.pop();
    }
  };

  /** Market stalls: a counter under a striped awning, boarded up the back, the day's boxes on it. at: [[x, z, yawDeg, colour], ...]; the front is +z. */
  B.stalls = (k, o) => {
    const W = TIMBER;
    for (const [x, z, yawDeg = 0, color = '#a8442c'] of o.at) {
      k.push(x, 0, z, rad(yawDeg));
      k.box('timber', 0, 0.91, 0, 2.6, 0.07, 1.0, W); k.box('timber', 0, 0.45, 0.47, 2.6, 0.86, 0.04, '#dccab0');
      k.box('timber', 0, 1.1, -0.46, 2.6, 2.2, 0.06, '#dccab0'); for (const y of [0.5, 1.7]) k.box('timber', 0, y, -0.51, 2.6, 0.1, 0.04, W);                // boarded back
      for (const s of [-1, 1]) { k.box('timber', s * 1.27, 0.45, 0, 0.04, 0.86, 0.94, '#dccab0'); k.cyl('timber', [s * 1.25, 0, -0.45], [s * 1.25, 2.45, -0.45], 0.035, 0.035, W, 6); k.cyl('timber', [s * 1.25, 0.9, 0.45], [s * 1.25, 2.05, 0.45], 0.035, 0.035, W, 6); }
      const sl = Math.atan2(0.5, 1.5);
      for (let i = 0; i < 8; i++) k.box('matte', -1.26 + i * 0.36, 2.2, 0.1, 0.36, 0.025, 1.75, i % 2 ? '#e6e0d0' : color, sl, 0, 0);
      for (let i = 0; i < 8; i++) k.box('matte', -1.26 + i * 0.36, 1.86, 0.93, 0.36, 0.22, 0.02, i % 2 ? '#e6e0d0' : color);
      for (const [bx, bz, c] of [[-0.85, 0.1, '#9aa7ab'], [-0.2, 0.05, '#c9c2b2'], [0.5, 0.12, '#8fa0a6'], [0.95, -0.2, '#b4772a']]) { k.box('timber', bx, 1.02, bz, 0.55, 0.14, 0.4, TIMBER, 0.12, 0, 0); k.box('gloss', bx, 1.09, bz, 0.47, 0.04, 0.32, c, 0.12, 0, 0); }
      k.pop();
    }
  };
}
