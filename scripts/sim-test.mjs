// Headless smoke test, no browser: every level is checked for open spawn points, clean placement of a full match
// and a bot match at the size it suits; then a full deathmatch, a team match and the campaign are played out.
// Exit code 1 if a check fails.  MAP=1 also prints each level's walkable floor as text.
import { GameSim, TICK, MAX_PLAYERS } from '../shared/sim.js';
import { LEVELS, DEFAULT_LEVEL, recommendedPlayers } from '../shared/levels/index.js';

const count = {};
const tally = (m) => { count[m.t] = (count[m.t] || 0) + 1; };
const mk = (opts, loud = false) => new GameSim(opts, {
  send: (id, m) => { tally(m); if (loud && ['mission', 'obj', 'say'].includes(m.t)) console.log('  >', JSON.stringify(m).slice(0, 110)); },
  broadcast: (m) => { tally(m); if (loud && ['mission', 'obj', 'match'].includes(m.t) && m.phase !== 'play') console.log('  >', JSON.stringify(m).slice(0, 140)); },
});
const fail = (msg) => { console.log('  FAIL', msg); process.exitCode = 1; };
const run = (sim, seconds) => { const t0 = performance.now(); let ticks = 0; while (sim.phase === 'play' && ticks < 20 * seconds) { sim.tick(TICK); ticks++; } return { ticks, ms: (performance.now() - t0) / Math.max(1, ticks) }; };

for (const level of Object.values(LEVELS)) {
  const rec = recommendedPlayers(level);
  let t0 = performance.now();
  const sim = mk({ level: level.id, mode: 'dm', fill: 0 });
  console.log(`\n${level.name}: suits ${rec.min}-${rec.max} players (cap ${MAX_PLAYERS}) | ${sim.world.boxes.length} colliders, ${(sim.nav.open.length * sim.nav.cell ** 2).toFixed(0)} m2 of floor, built in ${(performance.now() - t0).toFixed(0)} ms`);
  if (process.env.MAP) { const st = Math.max(1, Math.round(sim.nav.w / 140)); for (let j = 0; j < sim.nav.h; j += st * 2) { let r = ''; for (let i = 0; i < sim.nav.w; i += st) r += sim.nav.ok[j * sim.nav.w + i] ? '.' : '#'; console.log(r); } }

  // every place the level puts someone or something must be open floor (a prop dropped onto a spawn point is an easy mistake)
  const S = level.spawns, C = level.campaign, pts = [...S.dm.map((p) => ['dm', p]), ...S.team1.map((p) => ['team1', p]), ...S.team2.map((p) => ['team2', p])];
  if (C) { pts.push(['campaign start', C.start]); JSON.stringify(C, (k, v) => { if (k === 'enemies' && Array.isArray(v)) for (const en of v) if (en.at) pts.push(['campaign enemy', { x: en.at[0], z: en.at[1], y: en.at[2] || 0 }]); return v; }); }
  const onFloor = ([k, p]) => (k === 'campaign enemy' && p.y ? true : sim.nav.walkable(p.x, p.z)) && !sim.world.blocked(p.x, (p.y || 0) + 0.02, p.z, 1.8);
  const bad = pts.filter((q) => !onFloor(q)).map(([k, p]) => `${k} (${p.x}, ${p.z})`);
  const badPick = level.pickups.filter((p) => sim.world.blocked(p.x, p.y + 0.35, p.z, 0.3, 0.05)).map((p) => `pickup (${p.x}, ${p.z})`);      // where the box floats; it may sit on a crate
  console.log(`  spawn points ${pts.length}, pickups ${level.pickups.length}: blocked ${bad.length + badPick.length}`, bad.length + badPick.length ? '' : 'OK');
  if (bad.length + badPick.length) fail([...bad, ...badPick].join(', '));
  // each team should come in looking at the map, not at the fence behind it
  for (const k of ['team1', 'team2']) {
    const b = level.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const away = S[k].filter((p) => (-Math.sin(p.yaw) * (cx - p.x) - Math.cos(p.yaw) * (cz - p.z)) / Math.hypot(cx - p.x, cz - p.z) < 0).length;
    if (away > S[k].length / 2) fail(`${k}: ${away} of ${S[k].length} spawn points face away from the map`);
  }

  // a full match has more players than spawn points: nobody may start on top of someone else or inside a wall
  for (const mode of ['dm', 'tdm']) {
    const full = mk({ level: level.id, mode, fill: MAX_PLAYERS, skill: 'normal' }); full.addPlayer(1, 'T');
    let worst = 1e9, misplaced = 0, names = 0;
    const check = () => {
      const es = [...full.ents.values()];
      for (const a of es) { if (!full.nav.walkable(a.x, a.z) || full.world.blocked(a.x, a.y, a.z, 1.8)) misplaced++; for (const b of es) if (a.id < b.id) worst = Math.min(worst, Math.hypot(a.x - b.x, a.z - b.z)); }
      names = new Set(es.map((e) => e.name)).size - es.length;
    };
    check(); for (let i = 0; i < 12; i++) { full.restart(); check(); }
    const ok = worst > 0.6 && !misplaced && !names;
    console.log(`  ${mode} with ${MAX_PLAYERS} players, 13 starts: closest pair ${worst.toFixed(2)} m, badly placed ${misplaced}`, ok ? 'OK' : '');
    if (!ok) fail(`${mode}: closest pair ${worst.toFixed(2)} m, badly placed ${misplaced}, duplicate names ${-names}`);
  }

  // bots must find each other and stay on the floor
  const match = mk({ level: level.id, mode: 'dm', fill: rec.max, skill: 'normal', scoreLimit: 1e9 }); match.addPlayer(1, 'T');
  const r = run(match, 180), es = [...match.ents.values()], kills = es.reduce((n, e) => n + e.kills, 0), off = es.filter((e) => e.bot && e.alive && !match.nav.walkable(e.x, e.z)).length;
  console.log(`  dm with ${rec.max} players for 180 s: ${r.ms.toFixed(2)} ms per tick, ${kills} kills, bots off the floor ${off}`, kills > rec.max && off <= 1 ? 'OK' : '');
  if (!(kills > rec.max) || off > 1) fail(`bot match: ${kills} kills, ${off} bots off the floor`);
}

// ---- complete matches on the default level
console.log(`\n${LEVELS[DEFAULT_LEVEL].name}: matches played to the end`);
let sim = mk({ mode: 'dm', fill: MAX_PLAYERS, skill: 'hard', scoreLimit: 15 }, true); sim.addPlayer(1, 'Tester');
let r = run(sim, 600);
console.log(`  dm ${MAX_PLAYERS}: ${(r.ticks * TICK).toFixed(0)} s simulated, ${r.ms.toFixed(3)} ms per tick, phase ${sim.phase}`, sim.phase === 'end' ? 'OK' : '');
if (sim.phase !== 'end') fail('the deathmatch did not finish');
console.log('  top:', [...sim.ents.values()].sort((a, b) => b.kills - a.kills).slice(0, 5).map((e) => `${e.name} ${e.kills}/${e.deaths}`).join(', '));
sim = mk({ mode: 'tdm', fill: 16, skill: 'normal', scoreLimit: 20 }); sim.addPlayer(1, 'T'); r = run(sim, 900);
console.log(`  tdm 16: ${(r.ticks * TICK).toFixed(0)} s, score ${sim.teamScore.slice(1).join(' : ')}`, sim.phase === 'end' ? 'OK' : '');
if (sim.phase !== 'end') fail('the team match did not finish');
// campaign with an invulnerable ghost that walks the objectives and deletes enemies
sim = mk({ mode: 'campaign', skill: 'normal' }, true); sim.addPlayer(1, 'Ghost');
const me = sim.ents.get(1); let ticks = 0;
while (sim.phase === 'play' && ticks < 20 * 400) {
  const st = sim.level.campaign.stages[sim.camp.stage];
  me.hp = 100;
  if (st.at) { sim.handle(1, { t: 'st', p: [st.at[0], 0, st.at[2]], yw: 0, pt: 0, f: 0, w: 'carbine' }); sim.handle(1, { t: 'use', on: true }); }
  if (ticks % 10 === 0) for (const e of sim.ents.values()) if (e.bot && e.alive) { sim.damage(e, me, 200, 'body', 'carbine'); break; }
  sim.tick(TICK); ticks++;
}
console.log(`  campaign: ${sim.phase} after ${(ticks * TICK).toFixed(0)} s, deaths ${me.deaths}`, sim.phase === 'end' ? 'OK' : '');
if (sim.phase !== 'end') fail('the campaign did not finish');
// the training course with a ghost that walks to each mark and drops the targets the stage asks for: it must end in free practice, with every target back up
for (const level of Object.values(LEVELS).filter((l) => l.training)) {
  const tr = mk({ mode: 'campaign', level: level.id }, true); tr.addPlayer(1, 'Ghost');
  const g = tr.ents.get(1), stages = level.campaign.stages, last = stages.length - 1; let n = 0;
  for (; tr.camp.stage < last && n < 20 * 120; n++) {
    const st = stages[tr.camp.stage];
    if (st.at) tr.handle(1, { t: 'st', p: [st.at[0], 0, st.at[2]], yw: 0, pt: 0, f: 0, w: 'carbine' });
    if (n % 10 === 0) for (const e of tr.ents.values()) if (e.bot && e.alive && (!st.line || e.line === st.line)) { tr.damage(e, g, 200, 'body', 'carbine'); break; }
    tr.tick(TICK);
  }
  for (let i = 0; i < 20 * 5; i++) tr.tick(TICK);
  const targets = [...tr.ents.values()].filter((e) => e.home), up = targets.filter((e) => e.alive).length, ok = tr.camp.stage === last && tr.phase === 'play' && up === targets.length && g.hp === 100;
  console.log(`\n${level.name}: course reached free practice after ${(n * TICK).toFixed(0)} s, ${up} of ${targets.length} targets standing, nobody shot back`, ok ? 'OK' : '');
  if (!ok) fail(`training on ${level.name}: stage ${tr.camp.stage} of ${last}, phase ${tr.phase}, ${up}/${targets.length} targets up, hp ${g.hp}`);
}
console.log(process.exitCode ? '\nFAILED' : '\nall checks passed');
