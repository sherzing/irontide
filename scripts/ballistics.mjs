// What the weapon table does to a target, in numbers: the game's own firing maths (shared/weapons.js) against its
// own hit volumes and its own server checks. Run it after changing a weapon, the recoil or the server's fire checks.
//   node scripts/ballistics.mjs            every table, then the checks; exit code 1 if a check fails
//   node scripts/ballistics.mjs spray      one table: first | spray | taps | server
// The target stands still, 1.8 m tall, and is aimed at mid-chest. Nobody corrects the aim: a player who pulls down does better.
import { WEAPONS, damageAt, spreadOf, newRecoil, kick, recoilStep } from '../shared/weapons.js';
import { hitCharacter, World } from '../shared/collision.js';
import { GameSim, TICK } from '../shared/sim.js';

const EYE = 1.62, CHEST = 1.25, N = 3000, only = process.argv[2];
const pad = (v, n = 4) => String(v).padStart(n);

/** One player working the trigger `shots` times, `gap` seconds apart (0 = as fast as the weapon fires). Returns each shot's hit zones and the view's final offset. */
function fire(name, { dist, ads = 1, speed = 0, crouch = false, shots = 1, gap = 0, fps = 60, rest = 0 }) {
  const w = WEAPONS[name], dt = 1 / fps, r = newRecoil(), pitch0 = Math.atan2(CHEST - EYE, dist), out = [];
  let pitch = pitch0, yaw = 0, t = 0, next = 0, last = -9;
  const frame = () => {
    if (out.length < shots && t >= next) {
      next = t + Math.max(60 / w.rpm, gap); last = t;
      const cone = spreadOf(w, { ads, speed, bloom: r.bloom, air: false, crouch }), zones = [];
      for (let p = 0; p < (w.pellets || 1); p++) {
        const a = Math.sqrt(Math.random()) * cone, th = Math.random() * Math.PI * 2;
        let x = Math.cos(th) * Math.tan(a), y = Math.sin(th) * Math.tan(a), z = -1; const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
        const cp = Math.cos(pitch), sp = Math.sin(pitch), y2 = y * cp - z * sp, z2 = y * sp + z * cp, cy = Math.cos(yaw), sy = Math.sin(yaw);
        const h = hitCharacter(0, EYE, 0, x * cy + z2 * sy, y2, -x * sy + z2 * cy, w.range, 0, 0, -dist, 0);
        zones.push(h ? h.zone : null);
      }
      out.push(zones); kick(w, r, ads, crouch);
    }
    const [dp, dy] = recoilStep(w, r, dt, t - last); pitch += dp; yaw += dy; t += dt;
  };
  while (out.length < shots) frame();
  for (const end = t + rest; t < end;) frame();
  return { out, off: Math.hypot(pitch - pitch0, yaw) * 180 / Math.PI };
}
function stats(name, o) {
  const w = WEAPONS[name], per = Array(o.shots).fill(0); let dmg = 0, kills = 0, ttk = 0;
  for (let n = 0; n < N; n++) {
    let hp = 100, dead = -1;
    fire(name, o).out.forEach((zones, i) => { let any = false; for (const z of zones) if (z) { any = true; hp -= damageAt(w, o.dist, z); } if (any) per[i]++; if (hp <= 0 && dead < 0) dead = i; });
    dmg += 100 - hp; if (dead >= 0) { kills++; ttk += dead * Math.max(60 / w.rpm, o.gap || 0); }
  }
  return { per: per.map((v) => Math.round(v / N * 100)), dmg: Math.round(dmg / N), kill: Math.round(kills / N * 100), ttk: kills ? (ttk / kills).toFixed(2) : '   -' };
}

// ---- the server: how many shots that hit does it count? ------------------------------------------------------------
/** A player holding the trigger at `fps`, every message up to `jitter` ms late; each shot claims a hit on a target beside them. */
function served(name, fps, jitter, seconds = 40) {
  let counted = 0;
  const sim = new GameSim({ level: 'drydock', mode: 'dm', fill: 2, skill: 'easy' }, { send: (id, m) => { if (id === 1 && m.t === 'dmg' && m.by === 1) counted++; }, broadcast: () => {} });
  sim.addPlayer(1, 'me');
  const me = sim.ents.get(1), target = [...sim.ents.values()].find((e) => e.bot), w = WEAPONS[name], dt = 1 / fps, due = [];
  target.bot = false; target.ai = null;                     // stands there and never shoots back
  const keep = () => { target.hp = me.hp = 100; target.alive = me.alive = true; target.x = me.x; target.z = me.z; target.y = me.y; };      // on the same spot: nothing can stand between them
  let t = 0, acc = 0, next = 0, sent = 0;
  while (t < seconds) {
    t += dt; keep(); acc += dt;
    while (acc >= TICK) { acc -= TICK; sim.tick(TICK); keep(); }
    while (due.length && due[0] <= t) { due.shift(); sim.handle(1, { t: 'fire', w: name, o: [me.x, me.y + EYE, me.z], e: [[target.x, target.y + 1.2, target.z]], hits: [[target.id, 'body', 0]] }); keep(); }
    if (t >= next && t < seconds - 0.2) { next = t + 60 / w.rpm; sent++; due.push(t + Math.random() * jitter / 1000); due.sort((a, b) => a - b); }      // the last 0.2 s only deliver what is under way
  }
  return Math.round((1 - counted / sent) * 1000) / 10;
}
/** A player steps out from behind a wall and fires the moment they see the target; the server knows their position `late` ms ago. % of those shots it refuses. */
function peek(late, speed = 4.6) {
  const sim = new GameSim({ level: 'drydock', mode: 'dm', fill: 2, skill: 'easy' }, { send: (id, m) => { if (id === 1 && m.t === 'dmg' && m.by === 1) ok++; }, broadcast: () => {} });
  let ok = 0, tries = 0;
  sim.addPlayer(1, 'me');
  const me = sim.ents.get(1), target = [...sim.ents.values()].find((e) => e.bot);
  target.bot = false; target.ai = null;
  sim.world = new World([{ c: [0, -1, 0], h: [200, 1, 200] }, { c: [-5, 2, -6], h: [5, 2, 0.3] }]);      // a floor, and a wall whose end is at x = 0
  for (let n = 0; n < 400; n++) {
    const tx = -3 + Math.random() * 2, tz = -26 - Math.random() * 20;                                      // the target, behind the wall's line
    let x = -1.5; const z = 0, seen = () => sim.world.los(x, EYE, z, tx, 1.2, tz, 'bullet');
    while (!seen() && x < 3) x += speed / 240;
    if (x >= 3) continue;
    x += speed / 60 * Math.random();                                                                      // somewhere in the frame they first see it
    tries++; sim.time += 1;
    Object.assign(me, { x: x - speed * late / 1000, y: 0, z, alive: true, hp: 100, flags: 0 }); Object.assign(target, { x: tx, y: 0, z: tz, alive: true, hp: 100, flags: 0 });
    const d = Math.hypot(tx - x, 1.2 - EYE, tz - z), k = (d - 0.25) / d;
    sim.handle(1, { t: 'fire', w: 'carbine', o: [x, EYE, z], e: [[x + (tx - x) * k, EYE + (1.2 - EYE) * k, z + (tz - z) * k]], hits: [[target.id, 'body', 0]] });
  }
  return Math.round((1 - ok / tries) * 100);
}

const failed = [], check = (ok, what) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed.push(what); };
const names = Object.keys(WEAPONS);

if (!only || only === 'first') {
  console.log('\nFIRST SHOT at the chest: % that hit\n            dist    hip   hip, walking   sights   sights, walking');
  for (const n of names) for (const dist of [10, 20, 40, 80]) if (dist <= WEAPONS[n].range) {
    const f = (o) => stats(n, { dist, shots: 1, ...o }).per[0];
    console.log(n.padEnd(10), pad(dist) + ' m', pad(f({ ads: 0 }), 6), pad(f({ ads: 0, speed: 4.6 }), 11), pad(f({ ads: 1 }), 11), pad(f({ ads: 1, speed: 2.9 }), 12));
  }
}
if (!only || only === 'spray') {
  console.log('\nTRIGGER HELD, aim never corrected: % of each of the first 10 rounds that hit, damage of the 10, % of targets killed, seconds to the kill');
  for (const n of names.filter((k) => WEAPONS[k].auto)) for (const dist of [10, 20, 40]) for (const ads of [1, 0]) {
    const s = stats(n, { dist, ads, shots: 10 });
    console.log(n.padEnd(8), pad(dist) + ' m', ads ? 'sights' : 'hip   ', s.per.map((v) => pad(v)).join(''), '  dmg', pad(s.dmg), ' killed', pad(s.kill) + '%', ' in', s.ttk);
  }
}
if (!only || only === 'taps') {
  console.log('\nSINGLE SHOTS, sights up, aim never corrected: % of each shot that hits');
  for (const [n, gap, shots] of [['carbine', 0.25, 8], ['pistol', 0.2, 6], ['pistol', 0.4, 6], ['shotgun', 0.5, 4], ['marksman', 0, 3]]) for (const dist of [20, 40, 80]) if (dist <= WEAPONS[n].range) {
    const s = stats(n, { dist, shots, gap });
    console.log(n.padEnd(8), `every ${(gap || 60 / WEAPONS[n].rpm).toFixed(2)} s`, pad(dist) + ' m', s.per.map((v) => pad(v)).join(''), '  killed', pad(s.kill) + '%', ' in', s.ttk);
  }
}
let lost = 0, refused = 0;
if (!only || only === 'server') {
  console.log('\nSERVER: % of shots that hit and were not counted (trigger held)\n            60 fps   120 fps   144 fps   60 fps, 40 ms jitter   120 fps, 40 ms jitter');
  for (const n of names) { const row = [[60, 0], [120, 0], [144, 0], [60, 40], [120, 40]].map(([fps, j]) => served(n, fps, j)); lost = Math.max(lost, ...row); console.log(n.padEnd(10), row.map((v) => pad(v, 9)).join(' ')); }
  console.log('\nSERVER: % of shots refused when fired the moment a target comes into view round a corner, by how old the server\'s idea of the shooter is');
  const row = [0, 50, 100, 150].map((ms) => [ms, peek(ms)]); refused = Math.max(...row.map((r) => r[1]));
  console.log('  ' + row.map(([ms, v]) => `${ms} ms: ${v}%`).join('    '));
}
if (!only) {
  console.log('\nCHECKS');
  check(lost === 0, `the server counts every shot of a held trigger (worst case lost: ${lost}%)`);
  check(refused === 0, `the server accepts a shot fired the moment the target is seen (worst case refused: ${refused}%)`);
  for (const n of names) if (!WEAPONS[n].pellets) { const d = Math.min(80, WEAPONS[n].falloff[1]), v = stats(n, { dist: d, shots: 1 }).per[0]; check(v >= 99, `${n}: sights up and standing still, the first shot hits at ${d} m (${v}%)`); }
  const c = stats('carbine', { dist: 20, shots: 10 }); check(c.kill >= 90, `carbine: ten rounds held at 20 m with the sights up kill (${c.kill}%)`);
  for (const n of names) { let worst = 0; for (let i = 0; i < 200; i++) worst = Math.max(worst, fire(n, { dist: 20, shots: 4, rest: 1.2 }).off); check(worst < 0.05, `${n}: the view is back where it was 1.2 s after four shots (off by ${worst.toFixed(3)} degrees at most)`); }
  if (failed.length) { console.log(`\n${failed.length} check(s) failed`); process.exit(1); }
  console.log('\nall checks passed');
}
