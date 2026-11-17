// Authoritative match simulation. Transport-agnostic: the browser runs it in-process for
// solo play (quick game / campaign) and server/index.js runs it per room for multiplayer.
import { World, PLAYER, hitCharacter } from './collision.js';
import { NavGrid } from './nav.js';
import { WEAPONS, WEAPON_ORDER, damageAt } from './weapons.js';
import { levelColliders } from './props.js';
import { LEVELS, DEFAULT_LEVEL } from './levels/index.js';
import { botThink, botAlert, makeAI, BOT_NAMES } from './bots.js';

export const MAX_PLAYERS = 64;      // the game's hard cap per match; levels advertise the size they suit (recommendedPlayers)
export const TICK = 1 / 20;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

export class GameSim {
  /** opts: {level, mode:'dm'|'tdm'|'campaign', fill, skill, scoreLimit, timeLimit}; out: {send(id,msg), broadcast(msg, exceptId)} */
  constructor(opts, out) {
    this.opts = { level: DEFAULT_LEVEL, mode: 'dm', fill: 8, skill: 'normal', timeLimit: 600, ...opts };
    this.level = LEVELS[this.opts.level] || LEVELS[DEFAULT_LEVEL];
    this.mode = this.opts.mode;
    this.opts.scoreLimit ??= this.mode === 'tdm' ? 50 : 25;
    this.out = out;
    this.world = new World(levelColliders(this.level));
    this.nav = new NavGrid(this.world, this.level.bounds);
    this.ents = new Map();
    this.time = 0; this.tickN = 0; this.nextBotId = 1000;
    this.phase = 'play'; this.endAt = 0; this.timeLeft = this.opts.timeLimit;
    this.teamScore = [0, 0, 0];
    this.pickups = this.level.pickups.map((p) => ({ ...p, on: true, at: 0 }));
    this._p = { x: 0, y: 0, z: 0 }; this._v = { x: 0, y: 0, z: 0 };
    this.camp = null;
    if (this.mode === 'campaign') this.camp = { stage: -1, prog: 0, t: 0, wave: 0, checkpoint: this.level.campaign.start, sendAt: 0, started: false };
  }

  // ------------------------------------------------------------------ roster
  humans() { let n = 0; for (const e of this.ents.values()) if (!e.bot) n++; return n; }
  hostile(a, b) { return a.id !== b.id && (a.team === 0 || a.team !== b.team); }
  info(e) { return { id: e.id, name: e.name, team: e.team, bot: e.bot, k: e.kills, d: e.deaths }; }

  newEnt(id, name, bot, team) {
    const e = { id, name, bot, team, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, hp: 100, alive: false, flags: 0,
      weapon: 'carbine', kills: 0, deaths: 0, respawnAt: 0, lastHurt: -99, lastFire: -99, grounded: true, use: false, ai: null, gone: 0 };
    this.ents.set(id, e);
    return e;
  }
  pickTeam() {
    if (this.mode === 'dm') return 0;
    if (this.mode === 'campaign') return 1;
    let a = 0, b = 0;
    for (const e of this.ents.values()) { if (e.team === 1) a++; else if (e.team === 2) b++; }
    return a <= b ? 1 : 2;
  }
  addPlayer(id, name) {
    if (this.humans() >= MAX_PLAYERS) return false;
    this.balanceBots(1);
    const e = this.newEnt(id, String(name || 'Player').slice(0, 16), false, this.pickTeam());
    this.out.send(id, {
      t: 'hi', id, level: this.level.id, mode: this.mode, opts: this.opts,
      ents: [...this.ents.values()].map((x) => this.info(x)),
      pickups: this.pickups.map((p) => p.on), match: this.matchMsg(),
    });
    this.out.broadcast({ t: 'join', e: this.info(e) }, id);
    this.spawn(e);
    if (this.camp && !this.camp.started) { this.camp.started = true; this.advance(); }
    else if (this.camp) this.sendObjective(id);
    return true;
  }
  removePlayer(id) {
    if (!this.ents.delete(id)) return;
    this.out.broadcast({ t: 'left', id });
    this.balanceBots(0);
  }
  /** Keeps humans + bots at opts.fill (never above MAX_PLAYERS). */
  balanceBots(incoming = 0) {
    if (this.mode === 'campaign') return;
    const humans = this.humans() + incoming;
    const want = Math.max(0, Math.min(MAX_PLAYERS, this.opts.fill) - humans);
    const bots = [...this.ents.values()].filter((e) => e.bot);
    for (let i = bots.length; i > want; i--) { const b = bots[i - 1]; this.ents.delete(b.id); this.out.broadcast({ t: 'left', id: b.id }); }
    for (let i = bots.length; i < want; i++) this.addBot();
  }
  addBot(o = {}) {
    const used = new Set([...this.ents.values()].map((e) => e.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) || 'Bot' + this.nextBotId;
    const e = this.newEnt(this.nextBotId++, name, true, o.team ?? this.pickTeam());
    e.ai = makeAI(o.skill || this.opts.skill, o.mode || 'roam', o.post || null);
    const r = Math.random();
    e.weapon = o.weapon || (r < 0.68 ? 'carbine' : r < 0.85 ? 'marksman' : 'pistol');
    e.ai.ammo = WEAPONS[e.weapon].mag;
    e.temp = !!o.temp;
    this.out.broadcast({ t: 'join', e: this.info(e) });
    this.spawn(e, o.at);
    return e;
  }

  // ------------------------------------------------------------------ spawning
  /** Where e comes back in: the points farthest from enemies and least crowded (campaign uses the checkpoint). */
  spawnPoint(e) {
    if (this.camp) return this.camp.checkpoint;
    const S = this.level.spawns;
    const list = this.mode === 'tdm' ? (e.team === 1 ? S.team1 : S.team2) : S.dm;
    const scored = list.map((s) => {
      let md = 60, near = 0;
      for (const o of this.ents.values()) if (o.alive && o !== e) {
        const d = Math.hypot(o.x - s.x, o.z - s.z);
        if (d < 4) near++;
        if (this.hostile(e, o)) md = Math.min(md, d);
      }
      return { s, score: md - near * 3 + Math.random() };
    });
    scored.sort((a, b) => b.score - a.score);
    const top = scored.filter((c, i) => i < 4 && c.score > scored[0].score - 6), first = top[(Math.random() * top.length) | 0];
    for (const c of [first, ...scored]) { const p = this.freeSpot(c.s, e); if (p) return p; }      // packed solid there: try the next point
    return first.s;
  }
  /** s itself while nobody stands on it, otherwise a free spot next to it (null if there is none) — a full match has more players than spawn points. */
  freeSpot(s, e) {
    const y = (s.y || 0) + 0.02;
    const taken = (x, z) => { for (const o of this.ents.values()) if (o.alive && o !== e && Math.hypot(o.x - x, o.z - z) < 1.3) return true; return false; };
    if (!taken(s.x, s.z)) return s;
    for (let ring = 1; ring <= 5; ring++) {
      const r = ring * 1.4, n = ring * 6, a0 = Math.random() * 6.2832;
      for (let k = 0; k < n; k++) {
        const a = a0 + (k / n) * 6.2832, x = s.x + Math.sin(a) * r, z = s.z + Math.cos(a) * r;
        if (this.nav.walkable(x, z) && this.nav.clear(s.x, s.z, x, z) && !this.world.blocked(x, y, z, PLAYER.height) && !taken(x, z)) return { ...s, x, z };
      }
    }
    return null;
  }
  spawn(e, at) {
    const s = at || this.spawnPoint(e);
    e.x = s.x; e.z = s.z; e.y = (s.y || 0) + 0.02;
    if (!at) {                                             // a little scatter, as long as it stays on open floor
      const x = s.x + (Math.random() - 0.5) * 0.6, z = s.z + (Math.random() - 0.5) * 0.6;
      if (this.nav.walkable(x, z) && !this.world.blocked(x, e.y, z, PLAYER.height)) { e.x = x; e.z = z; }
    }
    e.yaw = s.yaw || 0; e.pitch = 0; e.vx = e.vy = e.vz = 0;
    e.hp = 100; e.alive = true; e.lastHurt = -99; e.flags = 0; e.grounded = true;
    if (e.ai) { const ai = e.ai; ai.target = null; ai.visible = false; ai.lastSeen = null; ai.path = null; ai.goal = null; ai.ammo = WEAPONS[e.weapon].mag; ai.reloadUntil = 0; }
    this.out.broadcast({ t: 'spawn', id: e.id, p: [r2(e.x), r2(e.y), r2(e.z)], yw: r3(e.yaw) });
  }

  // ------------------------------------------------------------------ messages from humans
  handle(id, m) {
    const e = this.ents.get(id);
    if (!e || !m) return;
    switch (m.t) {
      case 'st': {
        if (!e.alive || !Array.isArray(m.p)) return;
        const [x, y, z] = m.p;
        if (![x, y, z, m.yw, m.pt].every(Number.isFinite)) return;
        const b = this.level.bounds;
        e.vx = (x - e.x) / TICK * 0.5 + e.vx * 0.5; e.vz = (z - e.z) / TICK * 0.5 + e.vz * 0.5;
        e.x = Math.max(b.minX - 3, Math.min(b.maxX + 3, x)); e.y = Math.max(-5, Math.min(40, y)); e.z = Math.max(b.minZ - 3, Math.min(b.maxZ + 3, z));
        e.yaw = m.yw; e.pitch = m.pt; e.flags = m.f | 0;
        if (WEAPONS[m.w]) e.weapon = m.w;
        break;
      }
      case 'fire': this.humanFire(e, m); break;
      case 'use': e.use = !!m.on; break;
      case 'chat': if (typeof m.s === 'string' && m.s.trim()) this.out.broadcast({ t: 'chat', id, s: m.s.slice(0, 120) }); break;
      case 'ping': this.out.send(id, { t: 'pong', c: m.c }); break;
    }
  }
  humanFire(e, m) {
    const w = WEAPONS[m.w];
    if (!e.alive || !w || this.phase !== 'play') return;
    if (this.time - e.lastFire < (60 / w.rpm) * 0.6) return;
    e.lastFire = this.time;
    if (Array.isArray(m.o) && Array.isArray(m.e)) this.out.broadcast({ t: 'fire', id: e.id, w: m.w, o: m.o, e: m.e.slice(0, 1) }, e.id);
    const ey = e.y + (e.flags & 1 ? PLAYER.crouchEye : PLAYER.eye);
    let n = 0;
    for (const h of Array.isArray(m.hits) ? m.hits : []) {
      if (++n > 1) break;
      const t = this.ents.get(h[0]);
      if (!t || !t.alive || !this.hostile(e, t)) continue;
      const d = Math.hypot(t.x - e.x, t.y - e.y, t.z - e.z);
      if (d > w.range + 5) continue;
      const k = t.flags & 1 ? 0.7 : 1;
      if (!this.world.los(e.x, ey, e.z, t.x, t.y + 1.2 * k, t.z, 'bullet') && !this.world.los(e.x, ey, e.z, t.x, t.y + 1.64 * k, t.z, 'bullet')
        && !this.world.los(e.x, ey, e.z, t.x, t.y + 0.45, t.z, 'bullet')) continue;
      const zone = h[1] === 'head' ? 'head' : h[1] === 'legs' ? 'legs' : 'body';
      this.damage(t, e, damageAt(w, d, zone), zone, m.w);
    }
    for (const b of this.ents.values()) if (b.ai && b.alive && this.hostile(b, e) && Math.hypot(b.x - e.x, b.z - e.z) < 32) botAlert(b, e, this.time);
  }
  botFire(e, o, d, dmgScale) {
    const w = WEAPONS[e.weapon];
    const wh = this.world.raycast(o[0], o[1], o[2], d[0], d[1], d[2], w.range, 'bullet');
    let best = wh ? wh.t : w.range, victim = null, zone = null;
    for (const t of this.ents.values()) {
      if (!t.alive || !this.hostile(e, t)) continue;
      const h = hitCharacter(o[0], o[1], o[2], d[0], d[1], d[2], best, t.x, t.y, t.z, t.flags & 1);
      if (h) { best = h.t; victim = t; zone = h.zone; }
    }
    this.out.broadcast({ t: 'fire', id: e.id, w: e.weapon, o: o.map(r2), e: [[r2(o[0] + d[0] * best), r2(o[1] + d[1] * best), r2(o[2] + d[2] * best)]] });
    if (victim) this.damage(victim, e, Math.max(1, Math.round(damageAt(w, best, zone) * dmgScale)), zone, e.weapon);
  }
  damage(t, by, amt, zone, weapon) {
    if (!t.alive || this.phase !== 'play') return;
    t.hp -= amt; t.lastHurt = this.time;
    const msg = { t: 'dmg', id: t.id, by: by.id, amt, zone, hp: Math.max(0, t.hp), from: [r2(by.x), r2(by.y), r2(by.z)], kill: t.hp <= 0 };
    if (!t.bot) this.out.send(t.id, msg);
    if (!by.bot && by !== t) this.out.send(by.id, msg);
    if (t.ai) botAlert(t, by, this.time);
    if (t.hp <= 0) this.kill(t, by, weapon, zone === 'head');
  }
  kill(t, by, weapon, hs) {
    t.alive = false; t.hp = 0; t.deaths++;
    t.respawnAt = this.time + (this.camp ? 4 : 3);
    if (by && by !== t) { by.kills++; if (by.team) this.teamScore[by.team]++; }
    if (t.temp) t.gone = this.time + 10;
    this.out.broadcast({ t: 'kill', id: t.id, by: by ? by.id : t.id, w: weapon, hs: !!hs, k: by ? by.kills : 0, d: t.deaths, ts: this.teamScore });
    if (this.camp || this.phase !== 'play') return;
    const top = this.mode === 'tdm' ? Math.max(this.teamScore[1], this.teamScore[2]) : by ? by.kills : 0;
    if (top >= this.opts.scoreLimit) this.endMatch();
  }
  endMatch() {
    this.phase = 'end'; this.endAt = this.time + 12;
    this.out.broadcast(this.matchMsg());
  }
  matchMsg() {
    let winner = null;
    if (this.phase === 'end') {
      if (this.mode === 'tdm') winner = this.teamScore[1] === this.teamScore[2] ? 'Draw' : this.teamScore[1] > this.teamScore[2] ? 'BLUE team' : 'RED team';
      else { let b = null; for (const e of this.ents.values()) if (!b || e.kills > b.kills) b = e; winner = b ? b.name : null; }
    }
    return { t: 'match', phase: this.phase, left: Math.ceil(this.timeLeft), ts: this.teamScore, limit: this.opts.scoreLimit, winner };
  }
  restart() {
    this.phase = 'play'; this.timeLeft = this.opts.timeLimit; this.teamScore = [0, 0, 0];
    for (const e of this.ents.values()) { e.kills = 0; e.deaths = 0; e.alive = false; }      // everyone leaves the floor first, then is placed again
    for (const e of this.ents.values()) this.spawn(e);
    for (const p of this.pickups) p.on = true;
    this.out.broadcast({ t: 'reset', pickups: this.pickups.map((p) => p.on) });
    this.out.broadcast(this.matchMsg());
  }

  // ------------------------------------------------------------------ campaign
  say(line) { if (line) this.out.broadcast({ t: 'say', who: line[0], s: line[1] }); }
  spawnEnemies(list) {
    for (const en of list || []) {
      this.addBot({ team: 2, weapon: en.w, mode: en.hold ? 'hold' : en.hunt ? 'hunt' : 'guard', post: { x: en.at[0], z: en.at[1] }, temp: true,
        at: { x: en.at[0], z: en.at[1], y: en.at[2] || 0, yaw: Math.random() * 6.28 } });
    }
  }
  enemiesLeft() { let n = 0; for (const e of this.ents.values()) if (e.bot && e.alive) n++; return n; }
  objectiveMsg() {
    const c = this.camp, st = this.level.campaign.stages[c.stage];
    if (!st) return null;
    return { t: 'obj', i: c.stage, n: this.level.campaign.stages.length, kind: st.type, text: st.text, at: st.at || null, r: st.r || 0, prompt: st.prompt || null, time: st.time || 0 };
  }
  sendObjective(id) { const m = this.objectiveMsg(); if (m) { if (id != null) this.out.send(id, m); else this.out.broadcast(m); } }
  advance() {
    const c = this.camp, stages = this.level.campaign.stages;
    c.stage++; c.prog = 0; c.t = 0; c.wave = 0;
    if (c.stage >= stages.length) {
      this.phase = 'end'; this.endAt = Infinity;
      this.say(this.level.campaign.outro);
      this.out.broadcast({ t: 'mission', win: true, time: Math.round(this.time) });
      return;
    }
    const st = stages[c.stage];
    for (const e of this.ents.values()) if (!e.bot && e.alive && c.stage > 0) { c.checkpoint = { x: e.x, y: e.y, z: e.z, yaw: e.yaw }; break; }
    this.spawnEnemies(st.enemies);
    this.say(st.say);
    this.sendObjective();
  }
  tickCampaign(dt) {
    const c = this.camp, st = this.level.campaign.stages[c.stage];
    if (!st || this.phase !== 'play') return;
    c.t += dt;
    const humans = [...this.ents.values()].filter((e) => !e.bot && e.alive);
    const near = (r) => humans.some((e) => Math.hypot(e.x - st.at[0], e.z - st.at[2]) < r && Math.abs(e.y - st.at[1]) < 3);
    let done = false, left = 0;
    if (st.type === 'reach') done = near(st.r);
    else if (st.type === 'eliminate') done = this.enemiesLeft() === 0;
    else if (st.type === 'interact') {
      const using = humans.some((e) => e.use && Math.hypot(e.x - st.at[0], e.z - st.at[2]) < 2.4);
      c.prog = Math.max(0, Math.min(1, c.prog + (using ? dt / st.hold : -dt * 0.8)));
      done = c.prog >= 1;
    } else if (st.type === 'defend') {
      while (c.wave < st.waves.length && c.t >= st.waves[c.wave].t) this.spawnEnemies(st.waves[c.wave++].enemies.map((e) => ({ ...e, hunt: true })));
      left = Math.max(0, st.time - c.t); c.prog = c.t / st.time; done = left <= 0;
    }
    if (done) return this.advance();
    if (this.time >= c.sendAt) { c.sendAt = this.time + 0.2; this.out.broadcast({ t: 'objp', p: r2(c.prog), left: Math.ceil(left), en: this.enemiesLeft() }); }
  }

  // ------------------------------------------------------------------ tick
  tick(dt = TICK) {
    this.time += dt; this.tickN++;
    const now = this.time;
    if (this.phase === 'end') { if (now >= this.endAt) this.restart(); }
    else if (!this.camp && this.humans() > 0) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) this.endMatch();
      else if (this.tickN % 20 === 0) this.out.broadcast(this.matchMsg());
    }
    for (const e of this.ents.values()) {
      if (!e.alive) {
        if (e.temp) { if (e.gone && now >= e.gone) { this.ents.delete(e.id); this.out.broadcast({ t: 'left', id: e.id }); } }
        else if (this.phase === 'play' && now >= e.respawnAt) this.spawn(e);
        continue;
      }
      if (e.hp < 100 && now - e.lastHurt > 5) e.hp = Math.min(100, e.hp + 22 * dt);
      if (e.bot) { if (this.phase === 'play') botThink(this, e, dt, now); }
      else if (e.y < this.world.killY) this.kill(e, null, 'fall', false);
    }
    // pickups
    for (let i = 0; i < this.pickups.length; i++) {
      const p = this.pickups[i];
      if (!p.on) { if (now >= p.at) { p.on = true; this.out.broadcast({ t: 'pk', i, on: true }); } continue; }
      for (const e of this.ents.values()) {
        if (e.bot || !e.alive) continue;
        if (Math.hypot(e.x - p.x, e.z - p.z) < 1.0 && Math.abs(e.y - p.y) < 1.5) {
          p.on = false; p.at = now + 25; this.out.broadcast({ t: 'pk', i, on: false, by: e.id, kind: p.kind }); break;
        }
      }
    }
    if (this.camp) this.tickCampaign(dt);
    // snapshot
    const s = [];
    for (const e of this.ents.values()) s.push([e.id, r2(e.x), r2(e.y), r2(e.z), r3(e.yaw), r3(e.pitch), e.flags, WEAPON_ORDER.indexOf(e.weapon), Math.ceil(e.hp), e.alive ? 1 : 0]);
    this.out.broadcast({ t: 'snap', n: this.tickN, s });
  }
}
