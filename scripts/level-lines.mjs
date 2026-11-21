// What a level's layout does to a team match, no browser:  node scripts/level-lines.mjs <levelId> ["x,z" ...]
//   - whether one team's spawn points see the other's, and whether anything within 8 m of them does
//   - the longest clear line of sight on the level, and where it runs
//   - metres to walk from each side's nearest spawn point to every pickup, and to any "x,z" given
// A report, not a check: on an open yard the spawn points do see each other.
import { GameSim } from '../shared/sim.js';
import { LEVELS, DEFAULT_LEVEL } from '../shared/levels/index.js';

const [id = DEFAULT_LEVEL, ...extra] = process.argv.slice(2), level = LEVELS[id];
if (!level) { console.error(`no level "${id}": ${Object.keys(LEVELS).join(', ')}`); process.exit(2); }
const sim = new GameSim({ level: id, mode: 'dm', fill: 0 }, { send() {}, broadcast() {} }), nav = sim.nav, EYE = 1.6;
const see = (a, b) => sim.world.los(a.x, (a.y || 0) + EYE, a.z, b.x, (b.y || 0) + EYE, b.z, 'bullet');
const T1 = level.spawns.team1, T2 = level.spawns.team2, at = (p) => `(${p.x.toFixed(0)}, ${p.z.toFixed(0)})`;

const pairs = T1.flatMap((a) => T2.filter((b) => see(a, b)).map((b) => [a, b]));
console.log(`${level.name}: ${pairs.length} of ${T1.length * T2.length} pairs of opposing spawn points see each other`, pairs.length ? '- e.g. ' + at(pairs[0][0]) + ' and ' + at(pairs[0][1]) : '');

const floor = []; for (let k = 0; k < nav.open.length; k += 3) floor.push(nav.center(nav.open[k]));      // every third cell: a point each 0.9 m or so
const near = (S) => floor.filter((p) => S.some((s) => Math.hypot(s.x - p.x, s.z - p.z) < 8));
const n1 = near(T1), n2 = near(T2); let base = 0, eg = null;
for (let i = 0; i < n1.length; i += 2) for (let j = 0; j < n2.length; j += 2) if (see(n1[i], n2[j])) { base++; eg = [n1[i], n2[j]]; }
console.log(`  the ground within 8 m of the spawn points: ${base} clear lines from one side's to the other's among ${Math.ceil(n1.length / 2) * Math.ceil(n2.length / 2)} tried`, eg ? '- e.g. ' + at(eg[0]) + ' and ' + at(eg[1]) : '');

let best = 0, line = null; const some = floor.filter((_, i) => i % 4 === 0);
for (let i = 0; i < some.length; i++) for (let j = i + 1; j < some.length; j++) { const d = Math.hypot(some[i].x - some[j].x, some[i].z - some[j].z); if (d > best && see(some[i], some[j])) { best = d; line = [some[i], some[j]]; } }
console.log(`  longest clear line: ${best.toFixed(0)} m`, line ? `from ${at(line[0])} to ${at(line[1])}` : '');

/** Walking distance to every floor cell from the nearest of the given points (8-connected, no corner cutting). */
function walk(from) {
  const d = new Float32Array(nav.w * nav.h).fill(1e9), N = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  for (const s of from) d[nav.nearest(s.x, s.z)] = 0;
  for (let changed = true; changed;) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) for (let n = 0; n < d.length; n++) {
      const k = pass ? d.length - 1 - n : n; if (!nav.ok[k]) continue;
      const i = k % nav.w, j = (k / nav.w) | 0;
      for (const [di, dj, c] of N) {
        const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nav.w || b >= nav.h) continue;
        const m = b * nav.w + a; if (!nav.ok[m] || (di && dj && (!nav.ok[j * nav.w + a] || !nav.ok[b * nav.w + i]))) continue;
        if (d[m] + c * nav.cell < d[k] - 1e-4) { d[k] = d[m] + c * nav.cell; changed = true; }
      }
    }
  }
  return (x, z) => d[nav.nearest(x, z)];
}
const blue = walk(T1), red = walk(T2);
console.log('  metres to walk from the nearest spawn point:      BLUE   RED');
const places = [...level.pickups.filter((p) => !p.y).map((p) => [`pickup ${at(p)}`, p.x, p.z]), ...extra.map((s) => { const [x, z] = s.split(',').map(Number); return [`(${x}, ${z})`, x, z]; })];
for (const [name, x, z] of places) console.log(`    ${name.padEnd(46)} ${blue(x, z).toFixed(0).padStart(5)} ${red(x, z).toFixed(0).padStart(5)}`);
