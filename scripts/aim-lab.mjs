// Does a shot go where the player aims, and does it hit what they see? Three looks at the running game.
//   node scripts/aim-lab.mjs volumes <out.jpg>   the soldier in each stance from three sides, with what a shot would hit painted over him
//                                                (red head, yellow body, blue limbs; magenta = drawn but a bullet passes), and the same in numbers
//   node scripts/aim-lab.mjs lean <out.jpg>      the same for a soldier who leans (Q, E), and where his head is against where the leaning player's view is:
//                                                the two must agree, or a player shoots from where nobody can hit him
//   node scripts/aim-lab.mjs sights <out.png>    each weapon with its sights up, 3x, and a green cross on the screen's centre, where the shot goes
//   node scripts/aim-lab.mjs lag                 how far a shot trails the view while the view turns: 0 is right
// Needs the dev server: npx vite --port 5177 (BASE overrides the address).
import { launch } from './browser.mjs';
import { writeFileSync } from 'node:fs';
import { LEAN, leanBits, leanOf } from '../shared/collision.js';
const [mode, out] = process.argv.slice(2);
const base = process.env.BASE || 'http://127.0.0.1:5177';
const { browser, page, errors } = await launch();
const body = mode === 'volumes' || mode === 'lean', R = leanBits(1), L = leanBits(-1);
const STANCES = mode === 'lean' ? [['standing', 0, 0], ['leaning right', 0, R], ['leaning left', 0, L], ['leaning right, walking', 1.7, R], ['crouching', 0, 1], ['crouched, leaning right', 0, 1 | R], ['crouched, leaning left', 0, 1 | L]]
  : [['standing', 0, 0], ['walking', 1.7, 0], ['running', 5.5, 0], ['crouching', 0, 1], ['crouched, moving', 2.2, 1]];
await page.goto(`${base}/?auto=dm&bots=1&level=drydock&dr=0&q=${body ? 'low' : 'medium'}`);
await page.waitForFunction(() => window.__irontide?.game.me?.alive && window.__irontide.chars.map.size > 0);
await page.waitForTimeout(800);
const res = await page.evaluate(async ({ mode, body, states }) => {
  const { game, engine, chars } = window.__irontide, sim = game.net.sim, me = game.me, rad = Math.PI / 180;
  const wait = (s) => new Promise((r) => setTimeout(r, s * 1000)), now = () => performance.now() / 1000;
  game.net.paused = true;                                   // the match stands still: only this script moves anything
  let after = null; const render = engine.render.bind(engine), V3 = engine.camera.position.constructor;

  if (body) {
    const c = [...chars.map.values()][0];
    let best = -1, x, z;                                    // the most open floor of a few hundred tries
    for (let i = 0; i < 600; i++) {
      const p = sim.nav.randomPoint(); let open = 0;
      for (let r = 1; r <= 9; r++) { let ok = true; for (let k = 0; k < 12; k++) if (!sim.nav.walkable(p.x + Math.cos(k * 0.5236) * r, p.z + Math.sin(k * 0.5236) * r)) ok = false; if (!ok) break; open = r; }
      if (open > best) { best = open; x = p.x; z = p.z; }
    }
    const y = game.world.floorAt(x, 1.5, z, 3) ?? 0, dist = Math.min(7, best - 0.5), fov = 2 * Math.atan(1.35 / dist) / rad, A = document.createElement('canvas'), B = document.createElement('canvas');
    let va = 0;
    c.body.root.traverse((o) => { o.castShadow = false; });
    engine.render = (dt) => {
      const cam = engine.camera; cam.position.set(c.pos.x + Math.sin(va) * dist, y + 1.0, c.pos.z - Math.cos(va) * dist); cam.lookAt(c.pos.x, y + 0.95, c.pos.z);
      if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
      game.vm.root.visible = false; render(dt);
      if (!after) return;
      const gl = engine.canvas; A.width = B.width = gl.width; A.height = B.height = gl.height;
      A.getContext('2d').drawImage(gl, 0, 0);               // with him, then without: where the two differ, he is drawn
      c.body.root.visible = false; render(0); B.getContext('2d').drawImage(gl, 0, 0); c.body.root.visible = true;
      cam.updateMatrixWorld(); const f = after; after = null; f();
    };
    const views = [['front', 0], ['side', 90], ['back', 180]];
    const cw = 320, ch = 330, sheet = document.createElement('canvas'); sheet.width = cw * states.length; sheet.height = ch * views.length;
    const g = sheet.getContext('2d'), rows = [];
    for (const [vi, [view, deg]] of views.entries()) for (const [si, [name, speed, flags]] of states.entries()) {
      const face = 90 * rad, yaw = -face, fx = -Math.sin(yaw), fz = -Math.cos(yaw), n = { seen: 0, hit: 0, both: 0, head: 0, headHit: 0, headAsHead: 0 }, at = { side: 0, up: 0 };
      for (let k = 0; k < (speed ? 6 : 1); k++) {
        const t0 = now() - game.interp, lead = 0.75 + k * 0.07, sx = x - fx * speed * lead, sz = z - fz * speed * lead;      // he is on the open spot when the picture is taken
        c.push(t0, [c.id, sx, y, sz, yaw, 0, flags, 0, 100, 1]);
        c.buf = [{ t: t0, x: sx, y, z: sz, yaw, pitch: 0, flags }, { t: t0 + 9, x: sx + fx * speed * 9, y, z: sz + fz * speed * 9, yaw, pitch: 0, flags }];
        c.placed = false; va = face + deg * rad; c.body.gun.visible = false;
        await wait(lead);
        await new Promise((r) => { after = r; });
        const cam = engine.camera, W = A.width, H = A.height, a = A.getContext('2d').getImageData(0, 0, W, H).data, b = B.getContext('2d').getImageData(0, 0, W, H).data, p = new V3(), o = cam.position;
        let x0 = W, x1 = 0, y0 = H, y1 = 0;                  // his box on the screen
        for (const dx of [-1.1, 1.1]) for (const dy of [0, 2.05]) for (const dz of [-1.1, 1.1]) { p.set(c.pos.x + dx, c.pos.y + dy, c.pos.z + dz).project(cam); const X = (p.x * 0.5 + 0.5) * W, Y = (-p.y * 0.5 + 0.5) * H; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
        x0 = Math.max(0, Math.floor(x0)); x1 = Math.min(W - 1, Math.ceil(x1)); y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(H - 1, Math.ceil(y1));
        const head = new V3(0, 10, 1.5).applyMatrix4(c.body.bones.Head.matrixWorld), top = head.clone(); top.y += 0.105;
        at.side += ((head.x - c.pos.x) * Math.cos(yaw) - (head.z - c.pos.z) * Math.sin(yaw)) / (speed ? 6 : 1); at.up += (head.y - c.pos.y) / (speed ? 6 : 1);      // the head's middle: to his right of his feet, and above them
        head.project(cam); top.project(cam);
        const hx = (head.x * 0.5 + 0.5) * W, hy = (-head.y * 0.5 + 0.5) * H, hr = Math.abs(top.y - head.y) * 0.5 * H;
        const bw = x1 - x0 + 1, bh = y1 - y0 + 1, over = k ? null : new ImageData(bw, bh);
        for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
          const i = (Y * W + X) * 4, seen = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 40;
          p.set((X + 0.5) / W * 2 - 1, -((Y + 0.5) / H * 2 - 1), 0.5).unproject(cam).sub(o).normalize();
          const h = c.hit(o, p, 100), inHead = Math.hypot(X - hx, Y - hy) < hr;
          if (seen) n.seen++; if (h) n.hit++; if (seen && h) n.both++;
          if (seen && inHead) { n.head++; if (h) n.headHit++; if (h?.zone === 'head') n.headAsHead++; }
          if (!over) continue;
          const j = ((Y - y0) * bw + (X - x0)) * 4, col = h ? (h.zone === 'head' ? [255, 40, 40] : h.zone === 'body' ? [255, 210, 0] : [40, 140, 255]) : [255, 0, 255];
          if (h || seen) { over.data[j] = col[0]; over.data[j + 1] = col[1]; over.data[j + 2] = col[2]; over.data[j + 3] = h ? (seen ? 80 : 210) : 200; }
        }
        if (over) {
          const tmp = document.createElement('canvas'); tmp.width = bw; tmp.height = bh; tmp.getContext('2d').putImageData(over, 0, 0);
          const k2 = Math.min(cw / bw, (ch - 30) / bh), dw = bw * k2, dh = bh * k2, ox = si * cw + (cw - dw) / 2, oy = vi * ch + 28;
          g.drawImage(A, x0, y0, bw, bh, ox, oy, dw, dh); g.drawImage(tmp, ox, oy, dw, dh);
          g.fillStyle = '#fff'; g.font = '15px monospace'; g.fillText(`${name}, ${view}`, si * cw + 8, vi * ch + 19);
        }
      }
      const pc = (v, d) => (d ? Math.round(v / d * 100) : 0);
      rows.push({ stance: name, from: view, 'of the soldier drawn, a shot hits %': pc(n.both, n.seen), 'of what a shot hits, nothing is drawn there %': pc(n.hit - n.both, n.hit), 'of the head drawn, counts as a head shot %': pc(n.headAsHead, n.head), flags, side: at.side, up: at.up });
    }
    return { rows, img: sheet.toDataURL('image/jpeg', 0.9) };
  }

  // ---- sights and lag: stand looking along the longest clear line under 60 m
  me.hp = 100; let yaw0 = 0, far = 0;
  for (let k = 0; k < 64; k++) { const yaw = k / 64 * Math.PI * 2, h = game.world.raycast(me.pos.x, me.pos.y + 1.6, me.pos.z, -Math.sin(yaw), 0, -Math.cos(yaw), 200, 'bullet'), t = h ? h.t : 200; if (t > far && t < 60) { far = t; yaw0 = yaw; } }
  const input = (o) => { game.debugInput = { yaw: yaw0, pitch: 0, keys: [], ads: true, fire: false, ...o }; };
  if (mode === 'sights') {
    const names = Object.keys(me.ammo), cw = 480, ch = 300, sheet = document.createElement('canvas'); sheet.width = cw * names.length; sheet.height = ch * 2; const g = sheet.getContext('2d');
    engine.render = (dt) => { render(dt); if (after) { const f = after; after = null; f(); } };
    const snap = (i, row, label) => new Promise((r) => { after = () => {
      const gl = engine.canvas, sw = cw / 3, sh = ch / 3, cx = i * cw + cw / 2 + 0.5, cy = row * ch + ch / 2 + 0.5;
      g.imageSmoothingEnabled = false; g.drawImage(gl, gl.width / 2 - sw / 2, gl.height / 2 - sh / 2, sw, sh, i * cw, row * ch, cw, ch);
      g.strokeStyle = '#0f0'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - 30, cy); g.lineTo(cx + 30, cy); g.moveTo(cx, cy - 30); g.lineTo(cx, cy + 30); g.stroke();
      g.fillStyle = '#fff'; g.font = '14px monospace'; g.fillText(`${names[i]}, ${label}`, i * cw + 8, row * ch + 18); r(); }; });
    for (const [i, n] of names.entries()) {
      input({ ads: false }); game.switchWeapon(n); await wait(0.9);
      input({}); await wait(0.9); await snap(i, 0, 'still');
      input({ keys: ['KeyD'] }); await wait(0.5); await snap(i, 1, 'walking');
      input({ keys: ['KeyA'] }); await wait(0.5);
    }
    return { img: sheet.toDataURL('image/png') };
  }
  // lag: turn the view at a steady rate, fire now and then, compare each bullet's bearing with the view's at that moment
  game.switchWeapon('marksman'); input({}); await wait(1.5);
  const sent = [], send = game.net.send.bind(game.net), rows = [];
  game.net.send = (m) => { if (m.t === 'fire') sent.push({ o: m.o, e: m.e[0], yaw: me.yaw }); send(m); };
  for (const rate of [0, 30, 90, 300]) {
    sent.length = 0; let yaw = yaw0, last = performance.now(), n = 0;
    await new Promise((done) => { const tick = () => { const t = performance.now(); yaw += rate * rad * (t - last) / 1000; last = t; n++; game.debugInput = { yaw, pitch: 0, keys: [], ads: true, fire: n % 110 === 0 }; if (n > 480) done(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    const off = sent.map((s) => { let d = s.yaw - Math.atan2(-(s.e[0] - s.o[0]), -(s.e[2] - s.o[2])); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d) / rad; });
    rows.push({ 'view turning, degrees a second': rate, shots: off.length, 'shot off the view, degrees (worst)': +Math.max(0, ...off).toFixed(2) });
    me.ammo.marksman.mag = 5;
  }
  return { rows };
}, { mode, body, states: STANCES });
if (mode === 'lean') {
  // The leaning player's view is LEAN.reach to the side of his feet and LEAN.drop lower than upright. The soldier others see must have his head there.
  const front = res.rows.filter((r) => r.from === 'front'), upright = (r) => front.find((u) => (u.flags & 1) === (r.flags & 1) && !leanOf(u.flags)), cm = (v) => Math.round(v * 100);
  const table = front.filter((r) => leanOf(r.flags)).map((r) => {
    const view = leanOf(r.flags) * LEAN.reach, lower = upright(r).up - r.up, off = Math.abs(r.side - upright(r).side - view);
    return { stance: r.stance, 'head to his right, cm': cm(r.side - upright(r).side), 'the view, cm': cm(view), 'head lower than upright, cm': cm(lower), 'the view lower, cm': cm(LEAN.drop * (r.flags & 1 ? 1.05 / 1.62 : 1)), 'apart sideways, cm': cm(off), '': off <= 0.04 ? 'OK' : 'FAIL' };
  });
  console.table(table);
  if (table.some((r) => r[''] !== 'OK')) { console.log('FAIL: the head of a leaning soldier is more than 4 cm to the side of the leaning player\'s view'); process.exitCode = 1; }
}
if (res.rows) console.table(res.rows.map(({ flags, side, up, ...r }) => r));
if (res.img && out) writeFileSync(out, Buffer.from(res.img.split(',')[1], 'base64'));
console.log('errors:', errors.length);
await browser.close();
