// Headless smoke test: runs bot matches and the campaign with a scripted "player".
import { GameSim, TICK } from '../shared/sim.js';
const count = {};
const mk = (opts) => { const sim = new GameSim(opts, { send: (id, m) => { count[m.t] = (count[m.t] || 0) + 1; if (['mission','obj','say'].includes(m.t)) console.log('  >', JSON.stringify(m).slice(0, 110)); }, broadcast: (m) => { count[m.t] = (count[m.t] || 0) + 1; if (['mission','obj','match'].includes(m.t) && m.phase !== 'play') console.log('  >', JSON.stringify(m).slice(0, 140)); } }); return sim; };
let t0 = performance.now();
let sim = mk({ mode: 'dm', fill: 32, skill: 'hard', scoreLimit: 15 });
let open = sim.nav.open.length;
console.log('nav cells', open, 'colliders', sim.world.boxes.length, 'build ms', (performance.now() - t0).toFixed(0));
// ascii map
for (let j = 0; j < sim.nav.h; j += 3) { let r = ''; for (let i = 0; i < sim.nav.w; i += 2) r += sim.nav.ok[j * sim.nav.w + i] ? '.' : '#'; console.log(r); }
sim.addPlayer(1, 'Tester');
t0 = performance.now(); let ticks = 0;
while (sim.phase === 'play' && ticks < 20 * 600) { sim.tick(TICK); ticks++; }
console.log('dm 32: ticks', ticks, 'simulated s', (ticks * TICK).toFixed(0), 'ms/tick', ((performance.now() - t0) / ticks).toFixed(3));
console.log([...sim.ents.values()].sort((a, b) => b.kills - a.kills).slice(0, 5).map((e) => `${e.name} ${e.kills}/${e.deaths}`).join(', '));
let oob = [...sim.ents.values()].filter((e) => e.bot && !sim.nav.walkable(e.x, e.z)).length; console.log('bots off-nav:', oob);
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
