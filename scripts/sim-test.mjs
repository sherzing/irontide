// Headless smoke test: runs bot matches and the campaign with a scripted "player".
import { GameSim, TICK, MAX_PLAYERS } from '../shared/sim.js';
import { recommendedPlayers } from '../shared/levels/index.js';
const count = {};
const mk = (opts) => { const sim = new GameSim(opts, { send: (id, m) => { count[m.t] = (count[m.t] || 0) + 1; if (['mission','obj','say'].includes(m.t)) console.log('  >', JSON.stringify(m).slice(0, 110)); }, broadcast: (m) => { count[m.t] = (count[m.t] || 0) + 1; if (['mission','obj','match'].includes(m.t) && m.phase !== 'play') console.log('  >', JSON.stringify(m).slice(0, 140)); } }); return sim; };
let t0 = performance.now();
let sim = mk({ mode: 'dm', fill: MAX_PLAYERS, skill: 'hard', scoreLimit: 15 });
let open = sim.nav.open.length;
console.log('nav cells', open, 'colliders', sim.world.boxes.length, 'build ms', (performance.now() - t0).toFixed(0));
// ascii map
for (let j = 0; j < sim.nav.h; j += 3) { let r = ''; for (let i = 0; i < sim.nav.w; i += 2) r += sim.nav.ok[j * sim.nav.w + i] ? '.' : '#'; console.log(r); }
sim.addPlayer(1, 'Tester');
t0 = performance.now(); let ticks = 0;
while (sim.phase === 'play' && ticks < 20 * 600) { sim.tick(TICK); ticks++; }
console.log(`dm ${MAX_PLAYERS}: ticks`, ticks, 'simulated s', (ticks * TICK).toFixed(0), 'ms/tick', ((performance.now() - t0) / ticks).toFixed(3));
console.log([...sim.ents.values()].sort((a, b) => b.kills - a.kills).slice(0, 5).map((e) => `${e.name} ${e.kills}/${e.deaths}`).join(', '));
let oob = [...sim.ents.values()].filter((e) => e.bot && !sim.nav.walkable(e.x, e.z)).length; console.log('bots off-nav:', oob);
// every place the level puts someone must be open floor (a prop dropped onto a spawn point is an easy mistake)
{
  const S = sim.level.spawns, C = sim.level.campaign, pts = [...S.dm.map((p) => ['dm', p]), ...S.team1.map((p) => ['team1', p]), ...S.team2.map((p) => ['team2', p])];
  if (C) { pts.push(['campaign start', C.start]); JSON.stringify(C, (k, v) => { if (k === 'enemies' && Array.isArray(v)) for (const en of v) if (en.at) pts.push(['campaign enemy', { x: en.at[0], z: en.at[1], y: en.at[2] || 0 }]); return v; }); }
  const bad = pts.filter(([, p]) => !sim.nav.walkable(p.x, p.z) || sim.world.blocked(p.x, (p.y || 0) + 0.02, p.z, 1.8)).map(([k, p]) => `${k} (${p.x}, ${p.z})`);
  console.log(`spawn points checked: ${pts.length}, blocked: ${bad.length}`, bad.length ? 'FAIL ' + bad.join(', ') : 'OK');
  if (bad.length) process.exitCode = 1;
}
// a full match has more players than spawn points: nobody may start on top of someone else or inside a wall
for (const mode of ['dm', 'tdm']) {
  const full = mk({ mode, fill: MAX_PLAYERS, skill: 'normal' }); full.addPlayer(1, 'T');
  const check = (when) => {
    const es = [...full.ents.values()]; let gap = 1e9, bad = 0;
    for (const a of es) { if (!full.nav.walkable(a.x, a.z) || full.world.blocked(a.x, a.y, a.z, 1.8)) bad++; for (const b of es) if (a.id < b.id) gap = Math.min(gap, Math.hypot(a.x - b.x, a.z - b.z)); }
    const names = new Set(es.map((e) => e.name)).size;
    console.log(`${mode} ${es.length} players ${when}: closest pair ${gap.toFixed(2)} m, badly placed ${bad}, distinct names ${names}`, gap > 0.6 && !bad && names === es.length ? 'OK' : 'FAIL');
    if (!(gap > 0.6) || bad || names !== es.length) process.exitCode = 1;
  };
  check('at start'); for (let i = 1; i <= 12; i++) { full.restart(); if (i % 4 === 0) check(`after restart ${i}`); else { const es = [...full.ents.values()]; for (const a of es) for (const b of es) if (a.id < b.id && Math.hypot(a.x - b.x, a.z - b.z) <= 0.6) { check(`after restart ${i}`); break; } } }
}
console.log('drydock suits', JSON.stringify(recommendedPlayers(sim.level)), 'players; cap', MAX_PLAYERS);
sim = mk({ mode: 'tdm', fill: 16, skill: 'normal', scoreLimit: 20 }); sim.addPlayer(1, 'T'); ticks = 0;
while (sim.phase === 'play' && ticks < 20 * 900) { sim.tick(TICK); ticks++; }
console.log('tdm: s', (ticks * TICK).toFixed(0), 'score', sim.teamScore);
// campaign with an invulnerable ghost that walks objectives and deletes enemies
sim = mk({ mode: 'campaign', skill: 'normal' }); sim.addPlayer(1, 'Ghost'); ticks = 0;
const me = sim.ents.get(1);
while (sim.phase === 'play' && ticks < 20 * 400) {
  const st = sim.level.campaign.stages[sim.camp.stage];
  me.hp = 100;
  if (st.at) { sim.handle(1, { t: 'st', p: [st.at[0], 0, st.at[2]], yw: 0, pt: 0, f: 0, w: 'carbine' }); sim.handle(1, { t: 'use', on: true }); }
  if (ticks % 10 === 0) for (const e of sim.ents.values()) if (e.bot && e.alive) { sim.damage(e, me, 200, 'body', 'carbine'); break; }
  sim.tick(TICK); ticks++;
}
console.log('campaign finished:', sim.phase, 'after s', (ticks * TICK).toFixed(0), 'deaths', me.deaths);
console.log(count);
