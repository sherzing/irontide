// Headless smoke test, no browser: every level is checked for open spawn points, clean placement of a full match
// and a bot match at the size it suits; then a full deathmatch, a team match and the campaign are played out.
// Exit code 1 if a check fails.  MAP=1 also prints each level's walkable floor as text.
import { GameSim, TICK, MAX_PLAYERS } from '../shared/sim.js';
import { LEVELS, DEFAULT_LEVEL, recommendedPlayers } from '../shared/levels/index.js';
import { PLAYER, LEAN, leanBits, leanShift } from '../shared/collision.js';
import { WEAPONS } from '../shared/weapons.js';

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
// what a room list is told about that match
const told = sim.status(), right = told.names.join() === 'T' && told.bots === 15 && told.phase === 'end' && told.score.join() === sim.teamScore.slice(1).join() && told.limit === 20 && told.level === DEFAULT_LEVEL && told.mode === 'tdm';
console.log(`  its status: ${told.names.length} player, ${told.bots} bots, ${told.phase}, ${told.score.join(' : ')} of ${told.limit}`, right ? 'OK' : '');
if (!right) fail(`status of the team match: ${JSON.stringify(told)}`);
// A link that stalls delivers a player's shots in a bunch. Every one of them must still be passed on and its hit counted,
// let out in turn at no more than twice the weapon's rate; a client that fires faster than the weapon can gets no more
// through than the weapon fires in that time and a second; and a shooter who dies takes the shots still waiting with him.
{
  const W = WEAPONS.carbine, gap = 60 / W.rpm, perSecond = W.rpm / 60 * 1.1;
  /** `shots` shots fired `every` seconds apart; held(t) is when the one fired at t reaches the server. Returns what came of them. */
  const volley = (shots, every, held, after = () => {}) => {
    const heard = [], out = { hit: 0 };
    const s = new GameSim({ mode: 'dm', fill: 0, scoreLimit: 1e9, timeLimit: 1e9 }, { send: (id, m) => { if (m.t === 'dmg' && id === 1) out.hit++; }, broadcast: (m) => { if (m.t === 'fire') heard.push(s.time); } });
    s.addPlayer(1, 'Shooter'); s.addPlayer(2, 'Target');
    const a = s.ents.get(1), b = s.ents.get(2);
    let at = null;      // the target stands 6 m from the shooter, in plain sight
    for (let k = 0; k < 16 && !at; k++) { const x = a.x + Math.sin(k * Math.PI / 8) * 6, z = a.z + Math.cos(k * Math.PI / 8) * 6; if (s.nav.walkable(x, z) && s.world.los(a.x, a.y + PLAYER.eye, a.z, x, a.y + 1.2, z, 'bullet')) at = [x, a.y, z]; }
    s.handle(2, { t: 'st', p: at, yw: 0, pt: 0, f: 0, w: 'carbine' });
    const shot = { t: 'fire', w: 'carbine', o: [a.x, a.y + PLAYER.eye, a.z], e: [[at[0], at[1] + 1.2, at[2]]], hits: [[2, 'body', 0]] };
    const due = Array.from({ length: shots }, (_, i) => held(i * every)), t0 = s.time; let sent = 0;
    for (let tick = 0; tick < 20 * (due[shots - 1] + 3); tick++) {
      b.hp = 1e6;                                             // the target outlives the volley
      while (sent < shots && due[sent] <= s.time - t0 + 1e-9) { s.handle(1, shot); sent++; }
      after(s, a, sent, heard);
      s.tick(TICK);
    }
    let most = 0; for (let i = 0; i < heard.length; i++) { let n = 0; for (let j = i; j < heard.length && heard[j] < heard[i] + 1; j++) n++; most = Math.max(most, n); }      // the most shots passed on within any one second
    return { heard: heard.length, hit: out.hit, most, last: heard.length ? heard[heard.length - 1] - t0 : 0, sent: due[shots - 1], sim: s };
  };
  const every = (s) => (t) => Math.ceil((t + 1e-6) / s) * s, stall = (at, s) => (t) => (t >= at && t < at + s ? at + s : t);
  const cases = [['as fired', (t) => t], ['in bunches every 300 ms', every(0.3)], ['in bunches every 400 ms', every(0.4)], ['after one stall of 1 s', stall(1.5, 1)]];
  for (const [label, held] of cases) {
    const r = volley(48, gap, held), ok = r.heard === 48 && r.hit === 48 && r.most <= 2 * perSecond + 4 && r.last <= r.sent + 1.1;
    console.log(`  48 carbine shots reaching the server ${label}: ${r.heard} passed on, ${r.hit} hits counted, at most ${r.most} in a second, the last ${(r.last - r.sent).toFixed(2)} s after it arrived`, ok ? 'OK' : '');
    if (!ok) fail(`shots ${label}: ${r.heard} of 48 passed on, ${r.hit} hits, ${r.most} in a second, last after ${(r.last - r.sent).toFixed(2)} s`);
  }
  {
    const r = volley(200, 0.01, (t) => t), fair = Math.ceil(perSecond * 3) + 2, ok = r.heard <= fair && r.most <= 2 * perSecond + 4 && r.last <= r.sent + 1.1 && r.sim.ents.get(1).odd.dropped === 200 - r.heard;
    console.log(`  a client firing the carbine 100 times a second for 2 s: ${r.heard} passed on (the weapon fires ${Math.round(W.rpm / 60 * 2)} in that time), ${r.sim.ents.get(1).odd?.dropped} refused and counted`, ok ? 'OK' : '');
    if (!ok) fail(`a flood of 200 shots: ${r.heard} passed on (${fair} would be fair), ${r.most} in a second, ${r.sim.ents.get(1).odd?.dropped} counted as refused`);
  }
  {
    let died = -1;
    const r = volley(12, 0, (t) => t, (s, a, sent, heard) => { if (sent === 12 && died < 0) { s.kill(a, null, 'fall', false); died = heard.length; } }), ok = died >= 0 && r.heard === died;
    console.log(`  a shooter killed with shots still waiting: ${r.heard - died} fired after his death`, ok ? 'OK' : '');
    if (!ok) fail(`${r.heard - died} shots were passed on after the shooter died`);
  }
}
// A player who leans out of cover (Q, E) shows his head and hides the rest. A bot must see that head and be able to hit it;
// while he stands upright behind the same cover it must see nothing.
{
  const s = mk({ mode: 'dm', fill: 2, skill: 'hard', scoreLimit: 1e9, timeLimit: 1e9 }); s.addPlayer(1, 'Peek');
  const p = s.ents.get(1), bot = [...s.ents.values()].find((e) => e.bot), w = s.world, nav = s.nav, R = leanBits(1);
  let spot = null;      // where he stands and looks, and a place 8 to 16 m ahead from which only the leaning head is in sight
  for (let i = 0; i < nav.open.length && !spot; i += 3) {
    const c = nav.center(nav.open[i]), y = w.floorAt(c.x, 1.5, c.z, 3) ?? 0;
    if (w.blocked(c.x, y + 0.02, c.z, 1.8)) continue;
    for (let k = 0; k < 8 && !spot; k++) {
      const yaw = k * Math.PI / 4, [lx, lz] = leanShift(yaw, R);
      for (let d = 8; d <= 16 && !spot; d += 2) {
        const bx = c.x + lx - Math.sin(yaw) * d, bz = c.z + lz - Math.cos(yaw) * d, sees = (x, h, z) => w.los(bx, y + PLAYER.eye, bz, x, y + h, z);
        if (!nav.walkable(bx, bz) || w.blocked(bx, y + 0.02, bz, 1.8) || Math.abs((w.floorAt(bx, 1.5, bz, 3) ?? 99) - y) > 0.05) continue;
        const hidden = [-0.75, 0, 0.75].every((o) => !sees(c.x + lx * o, 1.2, c.z + lz * o) && !sees(c.x + lx * o, 1.6, c.z + lz * o));      // upright, he is out of sight from shoulder to shoulder
        if (hidden && sees(c.x + lx, 1.6, c.z + lz)) spot = { x: c.x, y, z: c.z, yaw, bx, bz, d };
      }
    }
  }
  if (!spot) fail('found no corner to lean round on the default level');
  else {
    bot.ai.mode = 'hold'; bot.yaw = Math.atan2(-(spot.x - spot.bx), -(spot.z - spot.bz));
    const stand = (flags, seconds) => {
      let seen = 0, hurt = 0;
      for (let t = 0; t < 20 * seconds && !hurt; t++) {
        s.handle(1, { t: 'st', p: [spot.x, spot.y, spot.z], yw: spot.yaw, pt: 0, f: flags, w: 'carbine' });
        bot.x = spot.bx; bot.y = spot.y; bot.z = spot.bz;
        s.tick(TICK);
        if (bot.ai.visible && bot.ai.target === 1) seen++;
        if (p.hp < 100 || !p.alive) hurt++;
      }
      return { seen, hurt };
    };
    const up = stand(0, 15), out = stand(R, 120), ok = !up.seen && !up.hurt && out.seen && out.hurt;
    console.log(`  a bot ${spot.d} m from a corner: the player upright behind it is seen for ${up.seen} ticks and hit ${up.hurt} times; leaning out he is ${out.seen ? 'seen' : 'not seen'} and ${out.hurt ? 'hit' : 'not hit'}`, ok ? 'OK' : '');
    if (!ok) fail(`leaning: upright seen ${up.seen}, hit ${up.hurt}; leaning seen ${out.seen}, hit ${out.hurt}`);
  }
}
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
