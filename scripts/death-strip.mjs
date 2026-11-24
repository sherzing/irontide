// One soldier being killed, to judge the ragdoll (client/src/ragdoll.js): a filmstrip to look at, or many trials in numbers.
//   node scripts/death-strip.mjs <out.jpg> [key=value ...]      one death as twelve frames
//   node scripts/death-strip.mjs - trials=40 [key=value ...]    that many deaths, shot from all sides with every weapon: what went wrong, if anything
//   level=drydock   weapon=carbine   head=1          a head shot
//   from=0          where the shot comes from, degrees round the victim: 0 in front of him, 90 on his left, 180 behind
//   move=0          metres a second he is moving when hit (1.6 walks, 5 runs)      crouch=1   crouching
//   at=x,z          where he stands (default: the most open floor found; at=wall: with his back to a wall)      face=90    the bearing he faces, degrees
//   view=55         camera angle round him, degrees      dist=5.5   camera distance      fov=34
//   times=0,0.1,..  seconds after the shot for each frame      dots=1     draw the ragdoll's particles and sticks on top
// Needs the dev server: npx vite --port 5177 (BASE overrides the address).
import { launch } from './browser.mjs';
const [out, ...rest] = process.argv.slice(2);
const arg = Object.fromEntries(rest.map((kv) => kv.split('=')));
const base = process.env.BASE || 'http://127.0.0.1:5177';
const { browser, page, errors } = await launch();
await page.goto(`${base}/?auto=dm&bots=1&level=${arg.level || 'drydock'}`);
await page.waitForFunction(() => window.__irontide?.game.me?.alive && window.__irontide.chars.map.size > 0);
await page.waitForTimeout(800);
const report = await page.evaluate(async (a) => {
  const { game, engine, chars } = window.__irontide, sim = game.net.sim, world = game.world, rad = Math.PI / 180;
  const wait = (s) => new Promise((r) => setTimeout(r, s * 1000)), now = () => performance.now() / 1000, r2 = (v) => Math.round(v * 100) / 100;
  game.net.paused = true;                                   // the match stands still: only this script moves anything
  const c = [...chars.map.values()][0];
  // ---- where: the given spot, or the most open floor of a few hundred tries
  let x, z;
  if (a.at === 'wall') {                                    // with his back to a wall, 0.7 m from it
    for (let i = 0; i < 2000; i++) {
      const p = sim.nav.randomPoint(), k = Math.floor(Math.random() * 4), dx = [1, -1, 0, 0][k], dz = [0, 0, 1, -1][k];
      const h = world.raycast(p.x, 1.0, p.z, dx, 0, dz, 3, 'solid'), top = world.raycast(p.x, 1.9, p.z, dx, 0, dz, 3, 'solid');
      if (h && top && h.t > 0.6 && h.t < 0.8 && !world.raycast(p.x, 1.0, p.z, -dx, 0, -dz, 5, 'solid')) { x = p.x; z = p.z; a.face = Math.atan2(-dx, dz) / rad; break; }
    }
  } else if (a.at) [x, z] = a.at.split(',').map(Number);
  else {
    let best = -1;
    for (let i = 0; i < 400; i++) {
      const p = sim.nav.randomPoint(); let open = 0;
      for (let r = 1; r <= 5; r++) { let ok = true; for (let k = 0; k < 8; k++) if (!sim.nav.walkable(p.x + Math.cos(k * 0.785) * r, p.z + Math.sin(k * 0.785) * r)) ok = false; if (!ok) break; open = r; }
      if (open > best) { best = open; x = p.x; z = p.z; }
    }
  }
  const y = world.floorAt(x, 1.5, z, 3) ?? 0;
  // ---- camera and capture
  const times = (a.times || '0,0.1,0.2,0.3,0.45,0.6,0.8,1,1.3,1.7,2.4,4').split(',').map(Number), cols = 4, rows = Math.ceil(times.length / cols);
  const sheet = document.createElement('canvas'); sheet.width = innerWidth; sheet.height = innerHeight;
  const g = sheet.getContext('2d'), cw = sheet.width / cols, ch = sheet.height / rows;
  const dist = +(a.dist || 5.5), fov = +(a.fov || 34), look = { x, y: y + 0.75, z };
  let va = 0, filming = false, next = 0;
  const render = engine.render.bind(engine);
  engine.render = (dt) => {
    const cam = engine.camera; cam.position.set(look.x + Math.sin(va) * dist, y + 1.5, look.z - Math.cos(va) * dist); cam.lookAt(look.x, look.y, look.z);
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    game.vm.root.visible = false;
    render(dt);
    const rag = c.body.rag;
    if (filming && next < times.length && (rag.asleep ? 99 : rag.t) >= times[next]) {      // by the ragdoll's own clock, which runs slow on a slow machine
      const gl = engine.canvas, sw = Math.min(gl.width, gl.height * (cw / ch)), sh = sw * (ch / cw), i = next++;
      g.drawImage(gl, (gl.width - sw) / 2, (gl.height - sh) / 2, sw, sh, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch);
      if (a.dots) {                                         // the ragdoll's particles and sticks, drawn over the picture
        const R = rag.d, K = rag.links, v = engine.camera.position.clone(), k = cw / sw, ox = (i % cols) * cw - ((gl.width - sw) / 2) * k, oy = Math.floor(i / cols) * ch - ((gl.height - sh) / 2) * k;
        const at = (n) => { v.set(R[n * 3], R[n * 3 + 1], R[n * 3 + 2]).project(engine.camera); return [ox + (v.x * 0.5 + 0.5) * gl.width * k, oy + (-v.y * 0.5 + 0.5) * gl.height * k]; };
        g.strokeStyle = '#3f6'; g.lineWidth = 1; g.beginPath();
        for (let n = 0; n < K.length; n += 4) if (K[n + 3] < 1e8 && K[n + 2] === K[n + 3]) { g.moveTo(...at(K[n])); g.lineTo(...at(K[n + 1])); }
        g.stroke(); g.fillStyle = '#f33';
        for (let n = 0; n < R.length / 3; n++) { const [px, py] = at(n); g.fillRect(px - 2, py - 2, 4, 4); }
      }
      g.fillStyle = '#fff'; g.font = '16px monospace'; g.fillText(`${times[i].toFixed(2)} s`, (i % cols) * cw + 10, Math.floor(i / cols) * ch + 22);
    }
  };
  /** One death. o: { weapon, head, from, move, crouch, face, view }. Returns what the ragdoll did, in numbers. */
  const kill = async (o, film) => {
    const face = (o.face != null ? +o.face : 90) * rad, yaw = -face, fx = -Math.sin(yaw), fz = -Math.cos(yaw);      // his forward
    const speed = +(o.move || 0), lead = speed ? 0.8 : 0.5, t0 = now() - game.interp, flags = +(o.crouch || 0) ? 1 : 0;
    const sx = x - fx * speed * lead, sz = z - fz * speed * lead;                                                 // start far enough back to be at (x, z) when hit
    c.push(t0, [c.id, sx, y, sz, yaw, 0, flags, 0, 100, 1]);                                                      // back on his feet, in a body of his own
    c.buf = [{ t: t0, x: sx, y, z: sz, yaw, pitch: 0, flags }, { t: t0 + 10, x: sx + fx * speed * 10, y, z: sz + fz * speed * 10, yaw, pitch: 0, flags }];
    c.placed = false; va = face + (o.view != null ? +o.view : 55) * rad; look.x = x; look.z = z;
    await wait(lead + game.interp);
    const fa = face + (+(o.from || 0)) * rad, body = c.body, rag = body.rag, P = rag.p;
    look.x = c.pos.x; look.z = c.pos.z; const start = [c.pos.x, c.pos.z];
    c.die({ x: c.pos.x + Math.sin(fa) * 10, z: c.pos.z - Math.cos(fa) * 10 }, o.weapon || 'carbine', !!+(o.head || 0));
    filming = film; next = 0;
    let kick = 0;                                           // how high a foot gets once the body is down: a leg thrown into the air
    let s6 = null, s7 = null;                                // where everything is 4.5 and 5.5 seconds in, for bodies that are still creeping then
    for (let i = 0; i < 400 && (!rag.asleep || (film && next < times.length)); i++) { await wait(0.03); if (rag.t > 0.3) kick = Math.max(kick, P[12 * 3 + 1] - y, P[13 * 3 + 1] - y); if (!s6 && rag.t > 4.5) s6 = P.slice(); if (!s7 && rag.t > 5.5) s7 = P.slice(); }
    filming = false;
    let low = 9, high = -9, bad = 0, stretch = 0, worst = '';
    for (let i = 0; i < P.length; i += 3) { if (!Number.isFinite(P[i] + P[i + 1] + P[i + 2])) bad++; low = Math.min(low, P[i + 1] - rag.rad[i / 3] - y); if (i < 16 * 3) high = Math.max(high, P[i + 1] - y); }
    for (let k = 0; k < rag.links.length; k += 4) { const i = rag.links[k] * 3, j = rag.links[k + 1] * 3, d = Math.hypot(P[i] - P[j], P[i + 1] - P[j + 1], P[i + 2] - P[j + 2]), e = Math.max(rag.links[k + 2] - d, d - rag.links[k + 3]); if (e > stretch) { stretch = e; worst = `${rag.links[k]}-${rag.links[k + 1]}`; } }
    return { settled: r2(rag.t), kick: r2(kick), high: r2(high), low: r2(low), slid: r2(Math.hypot((P[0] + P[3]) / 2 - start[0], (P[2] + P[5]) / 2 - start[1])), stretch: r2(stretch), worst, bad, moving: s7 ? [...Array(19).keys()].map((n) => [n, Math.hypot(s7[n * 3] - s6[n * 3], s7[n * 3 + 1] - s6[n * 3 + 1], s7[n * 3 + 2] - s6[n * 3 + 2])]).filter((m) => m[1] > 0.01).map((m) => `${m[0]}:${m[1].toFixed(2)}`).join(' ') : '', ys: [...Array(19).keys()].map((n) => r2(P[n * 3 + 1] - y)).join(' ') };
  };
  if (!a.trials) {
    const res = await kill(a, true);
    Object.assign(sheet.style, { position: 'fixed', left: 0, top: 0, zIndex: 99999 }); document.body.append(sheet);
    return { at: [r2(x), r2(z)], ...res };
  }
  const weapons = ['carbine', 'smg', 'pistol', 'shotgun', 'marksman'], rows_ = [];
  for (let n = 0; n < +a.trials; n++) {
    const o = { weapon: a.weapon ?? weapons[n % 5], from: a.from ?? (n * 47) % 360, head: a.head ?? (n % 4 === 3 ? 1 : 0), move: a.move ?? [0, 0, 1.6, 5][n % 4], crouch: a.crouch ?? (n % 7 === 6 ? 1 : 0), face: a.face ?? (n * 73) % 360 };      // a key given on the command line holds for every trial
    rows_.push({ ...o, ...(await kill(o, false)) });
  }
  return { at: [r2(x), r2(z)], rows: rows_ };
}, arg);
if (out !== '-') { await page.screenshot({ path: out, type: 'jpeg', quality: 88 }); console.log('saved', out); }
if (report.rows) {
  // a body that came to rest lies low, kept its feet near the floor (a sprinter may tumble), kept its shape and stopped moving within a few seconds
  const odd = (r) => [r.bad && 'broken numbers', r.settled >= 5.9 && `never came to rest (particle:metres moved between 4.5 and 5.5 s: ${r.moving})`, r.high > 0.6 && `rests ${r.high} m high`, r.kick > (r.move > 3 ? 1.3 : 0.75) && `a foot went ${r.kick} m up`, r.low < -0.03 && `${-r.low} m into the floor`, r.stretch > 0.03 && `link ${r.worst} is ${r.stretch} m off`].filter(Boolean);
  for (const r of report.rows) console.log(`${r.weapon.padEnd(8)} from ${String(r.from).padStart(3)} ${r.head ? 'head' : 'body'} move ${r.move}${r.crouch ? ' crouched' : ''}: settled ${r.settled} s, slid ${r.slid} m, highest ${r.high} m, foot ${r.kick} m  ${odd(r).join('; ')}`);
  const n = report.rows.filter((r) => odd(r).length).length;
  console.log(`${report.rows.length} deaths at ${report.at}: ${n} odd, settled after ${(report.rows.reduce((s, r) => s + r.settled, 0) / report.rows.length).toFixed(1)} s on average`);
} else console.log(JSON.stringify(report));
console.log('errors:', errors.length);
await browser.close();
