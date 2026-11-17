// A play session: local player controller, weapons, and the client side of the sim protocol.
import * as THREE from 'three';
import { World, PLAYER, hitCharacter } from '../../shared/collision.js';
import { levelColliders } from '../../shared/props.js';
import { WEAPONS, WEAPON_ORDER } from '../../shared/weapons.js';
import { MAX_PLAYERS } from '../../shared/sim.js';

const V = () => new THREE.Vector3();
const _a = V(), _b = V(), _c = V(), _d = V(), _n = V();
const clamp = THREE.MathUtils.clamp;

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx);        // engine, fx, audio, vm, hud, chars, settings, ensureLevel(id) -> {level, built}
    this.active = false; this.keys = new Set(); this.mouse = { l: false, r: false }; this.look = { x: 0, y: 0 };
    this.firePressed = false; this.roster = new Map(); this.debugInput = null;
    this.bindInput();
  }

  // ------------------------------------------------------------------ lifecycle
  async start(transport, name) {
    this.net = transport; this.name = name; this.roster.clear(); this.chars.clear(); this.hud.reset();
    this.me = null; this.match = null; this.obj = null; this.ended = false; this.msgQueue = []; this.ready = false; this.world = null; this.pendingHi = null;
    this.net.onMessage = (m) => this.onMessage(m);
    this.active = true; this.paused = false; this.sendT = 0; this.interp = transport.local ? 0.075 : 0.11;
    this.hud.show(true);
  }
  stop() {
    this.active = false; this.net?.close(); this.net = null; this.chars.clear(); this.hud.show(false); this.hud.reset();
    this.engine.hurt = 0; this.engine.scope = 0; this.me = null; this.vm.root.visible = false;
    if (document.pointerLockElement) document.exitPointerLock();
  }
  setPaused(p) { this.paused = p; if (this.net?.local) this.net.paused = p && !this.ended; if (p) { this.keys.clear(); this.mouse.l = this.mouse.r = false; } }

  initPlayer(id) {
    this.me = {
      id, alive: false, hp: 100, team: 0, pos: V(), vel: V(), yaw: 0, pitch: 0, grounded: true, crouch: false, eye: PLAYER.eye, stepOff: 0,
      weapon: 'carbine', ammo: {}, reload: null, nextFire: 0, bloom: 0, rp: 0, ry: 0, recover: 0, bolt: -1, stepDist: 0, surf: 'concrete',
      deadT: 0, killer: '', use: false, lastShot: -9, shake: 0, roll: 0, bob: 0, fov: this.settings.fov,
    };
    this.refill();
    this.vm.setWeapon('carbine'); this.vm.root.visible = true;
  }
  refill() { for (const k of WEAPON_ORDER) this.me.ammo[k] = { mag: WEAPONS[k].mag, res: WEAPONS[k].reserve }; }

  // ------------------------------------------------------------------ input
  bindInput() {
    const canvas = this.engine.canvas;
    addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (this.chatting) { if (e.code === 'Enter') this.endChat(true); else if (e.code === 'Escape') this.endChat(false); return; }
      if (e.code === 'Tab') e.preventDefault();
      if (this.paused) return;
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyR') this.startReload();
      if (e.code === 'Digit1') this.switchWeapon('carbine');
      if (e.code === 'Digit2') this.switchWeapon('marksman');
      if (e.code === 'Digit3') this.switchWeapon('pistol');
      if (e.code === 'Enter' && !this.net.local) this.beginChat();
      if (['Space', 'ControlLeft', 'KeyC'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.l = this.mouse.r = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.active || this.paused) return;
      if (document.pointerLockElement !== canvas) { canvas.requestPointerLock?.()?.catch?.(() => {}); return; }
      if (e.button === 0) { this.mouse.l = true; this.firePressed = true; }
      if (e.button === 2) this.mouse.r = true;
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.l = false; if (e.button === 2) this.mouse.r = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!this.active || this.paused || document.pointerLockElement !== canvas || !this.me) return;
      const zoom = this.engine.camera.fov / this.settings.fov;
      const s = this.settings.sens * 0.00011 * zoom;
      this.me.yaw -= e.movementX * s; this.me.pitch = clamp(this.me.pitch - e.movementY * s, -1.5, 1.5);
      this.look.x += e.movementX; this.look.y += e.movementY;
    });
    addEventListener('wheel', (e) => {
      if (!this.active || this.paused || !this.me) return;
      const i = WEAPON_ORDER.indexOf(this.me.weapon); this.switchWeapon(WEAPON_ORDER[(i + (e.deltaY > 0 ? 1 : 2)) % 3]);
    }, { passive: true });
  }
  beginChat() { this.chatting = true; const i = document.getElementById('chatin'); i.classList.remove('hidden'); i.value = ''; document.exitPointerLock(); setTimeout(() => i.focus(), 0); this.keys.clear(); }
  endChat(send) { const i = document.getElementById('chatin'); if (send && i.value.trim()) this.net.send({ t: 'chat', s: i.value.trim() }); i.classList.add('hidden'); i.blur(); this.chatting = false; this.engine.canvas.requestPointerLock?.()?.catch?.(() => {}); }
  key(c) { return this.keys.has(c) || (this.debugInput?.keys?.includes(c) ?? false); }

  // ------------------------------------------------------------------ protocol
  onMessage(m) {
    if (m.t === 'hi') { this.pendingHi = m; return; }
    if (!this.ready) { this.msgQueue.push(m); return; }
    const me = this.me;
    switch (m.t) {
      case 'join': this.addEnt(m.e); break;
      case 'left': this.roster.delete(m.id); this.chars.remove(m.id); break;
      case 'snap': {
        const t = performance.now() / 1000;
        for (const s of m.s) {
          if (me && s[0] === me.id) { me.hp = s[8]; continue; }
          this.chars.get(s[0])?.push(t, s);
        }
        break;
      }
      case 'spawn': {
        if (!me || m.id !== me.id) break;
        me.pos.set(m.p[0], m.p[1], m.p[2]); me.vel.set(0, 0, 0); me.yaw = m.yw; me.pitch = 0; me.alive = true; me.hp = 100; me.crouch = false; me.reload = null; me.bolt = -1;
        me.deadT = 0; me.rp = me.ry = me.recover = 0;
        if (!this.obj) this.refill(); else for (const k of WEAPON_ORDER) { const a = me.ammo[k]; a.mag = WEAPONS[k].mag; a.res = Math.max(a.res, WEAPONS[k].mag * 2); }
        this.vm.setWeapon(me.weapon); this.hud.death(null); this.engine.hurt = 0;
        break;
      }
      case 'fire': this.remoteFire(m); break;
      case 'dmg': {
        if (!me) break;
        if (m.id === me.id) {
          me.hp = m.hp; this.engine.hurt = Math.min(1, this.engine.hurt + 0.35 + m.amt / 90); me.shake = Math.min(1, me.shake + m.amt / 50);
          this.hud.damageFrom(Math.atan2(-(m.from[0] - me.pos.x), -(m.from[2] - me.pos.z))); this.audio.ui('hurt');
        }
        if (m.by === me.id && m.id !== me.id) { this.hud.hitmarker(m.kill); this.audio.ui(m.kill ? 'kill' : m.zone === 'head' ? 'head' : 'hit'); }
        break;
      }
      case 'kill': {
        const v = this.roster.get(m.id), k = this.roster.get(m.by);
        if (v) v.d = m.d; if (k && m.by !== m.id) k.k = m.k;
        if (this.match) this.match.ts = m.ts;
        const mine = me && (m.id === me.id || m.by === me.id);
        this.hud.killfeed(k?.name || '?', v?.name || '?', m.w, m.hs, mine, m.by === m.id);
        if (me && m.id === me.id) { me.alive = false; me.deadT = 0; me.killer = m.by === m.id ? '' : k?.name || ''; me.reload = null; this.audio.ui('death'); this.mouse.l = false; }
        break;
      }
      case 'match': {
        this.match = { ...this.match, ...m };
        if (m.phase === 'end' && !this.ended) { this.ended = true; this.hud.banner(m.winner === this.name ? 'Victory' : 'Match over', m.winner ? `${m.winner} wins` : '', 'Next round starting…'); this.audio.ui('objective'); }
        if (m.phase === 'play' && this.ended && !this.obj) { this.ended = false; this.hud.banner(null); }
        break;
      }
      case 'reset': for (const r of this.roster.values()) { r.k = 0; r.d = 0; } m.pickups.forEach((on, i) => this.setPickup(i, on)); break;
      case 'pk': {
        this.setPickup(m.i, m.on);
        if (!m.on && me && m.by === me.id) { for (const k of WEAPON_ORDER) me.ammo[k].res = WEAPONS[k].reserve; this.audio.ui('pickup'); this.hud.chat('Supply', 'Ammunition restocked'); }
        break;
      }
      case 'obj': this.obj = m; this.objP = { p: 0, left: m.time, en: 0 }; this.hud.setObjective(m); this.audio.ui('objective'); break;
      case 'objp': if (this.obj) { this.objP = m; this.hud.objProgress(this.obj.kind, m.p, m.left, m.en); } break;
      case 'say': this.hud.subtitle(m.who, m.s); this.audio.ui('radio'); break;
      case 'mission': this.ended = true; this.hud.setObjective(null); this.hud.banner(m.win ? 'Mission complete' : 'Mission failed', `Time ${(m.time / 60) | 0}:${String(m.time % 60).padStart(2, '0')}`, 'Press Esc to return to the menu'); this.audio.ui('objective'); break;
      case 'chat': this.hud.chat(this.roster.get(m.id)?.name || '?', m.s); break;
      case 'full': this.onKicked?.(`Server is full (${MAX_PLAYERS} players)`); break;
    }
  }
  addEnt(e) { this.roster.set(e.id, { ...e }); if (!this.me || e.id !== this.me.id) this.chars.add(e); }
  setPickup(i, on) { const p = this.built?.pickups[i]; if (p) p.group.visible = on; }

  async handleHi(m) {
    const { level, built } = await this.ensureLevel(m.level);
    this.level = level; this.built = built; this.mode = m.mode;
    this.world = new World(levelColliders(level));
    this.initPlayer(m.id);
    for (const e of m.ents) { this.addEnt(e); if (e.id === m.id) this.me.team = e.team; }
    m.pickups.forEach((on, i) => this.setPickup(i, on));
    this.match = m.match;
    this.ready = true;
    const q = this.msgQueue; this.msgQueue = []; for (const x of q) this.onMessage(x);
  }

  remoteFire(m) {
    const o = _a.set(m.o[0], m.o[1], m.o[2]), e = _b.set(...m.e[0]), dir = _c.copy(e).sub(o), len = dir.length() || 1; dir.divideScalar(len);
    const muzzle = _d.copy(o).addScaledVector(dir, 0.75); muzzle.y -= 0.1;
    this.fx.flash(muzzle, 0.55, 22); this.fx.tracer(muzzle, e); this.audio.shot(m.w, [o.x, o.y, o.z]);
    if (this.me && (this.me.team === 0 || this.roster.get(m.id)?.team !== this.me.team)) this.hud.gunfire(o.x, o.z);
    const h = this.world?.raycast(o.x, o.y, o.z, dir.x, dir.y, dir.z, len + 0.3, 'bullet');
    if (h && h.t > len - 0.6) { this.fx.impact(e, _n.set(h.nx, h.ny, h.nz), h.surf); if (Math.random() < 0.5) this.audio.impact(h.surf, [e.x, e.y, e.z]); }
    else if (this.me) {
      const cam = this.engine.camera.position, t = clamp(_n.copy(cam).sub(o).dot(dir), 0, len), dist = _n.copy(o).addScaledVector(dir, t).distanceTo(cam);
      if (dist < 0.9 && t > len - 1.2) this.fx.impact(e, _n.copy(dir).negate(), 'flesh', false);
      else if (dist < 2 && t > 3) this.audio.whiz([_n.x, _n.y, _n.z]);
      else for (const c of this.chars.map.values()) if (c.alive && Math.abs(c.pos.x - e.x) < 0.5 && Math.abs(c.pos.z - e.z) < 0.5 && e.y > c.pos.y && e.y < c.pos.y + 1.9) { this.fx.impact(e, _n.copy(dir).negate(), 'flesh', false); break; }
    }
  }

  // ------------------------------------------------------------------ weapons
  switchWeapon(name) {
    const me = this.me; if (!me || !me.alive || me.weapon === name) return;
    me.weapon = name; me.reload = null; me.bolt = -1; me.bloom = 0; this.vm.setWeapon(name); this.audio.click('draw');
  }
  startReload() {
    const me = this.me; if (!me || !me.alive || me.reload) return;
    const w = WEAPONS[me.weapon], a = me.ammo[me.weapon];
    if (a.mag >= w.mag || a.res <= 0) return;
    me.reload = { t: 0, dur: w.reload, cues: this.vm.reloadCues() }; me.bolt = -1;
  }
  tryFire(now) {
    const me = this.me, w = WEAPONS[me.weapon], a = me.ammo[me.weapon];
    if (me.reload || this.vm.drawT < 1 || now < me.nextFire || me.bolt >= 0) return;
    if (a.mag <= 0) { if (this.firePressed) { this.audio.click('dry'); this.startReload(); } return; }
    if (!w.auto && !this.firePressed) return;
    a.mag--; me.nextFire = now + 60 / w.rpm; me.lastShot = now;
    const cam = this.engine.camera, ads = this.vm.adsT;
    const speed = Math.hypot(me.vel.x, me.vel.z);
    let spread = w.spread + (w.adsSpread - w.spread) * ads + w.moveSpread * Math.min(1, speed / 4.5) * (1 - ads * 0.6) + me.bloom * (1 - ads * 0.5);
    if (!me.grounded) spread += 0.05; if (me.crouch) spread *= 0.75;
    const o = cam.getWorldPosition(_a);
    const r = Math.sqrt(Math.random()) * spread, th = Math.random() * Math.PI * 2;
    const dir = _b.set(Math.cos(th) * Math.tan(r), Math.sin(th) * Math.tan(r), -1).normalize().applyQuaternion(cam.quaternion);
    // world + characters
    const wh = this.world.raycast(o.x, o.y, o.z, dir.x, dir.y, dir.z, w.range, 'bullet');
    let best = wh ? wh.t : w.range, victim = null, zone = null;
    for (const c of this.chars.map.values()) {
      if (!c.alive || (me.team !== 0 && c.info.team === me.team)) continue;
      const h = hitCharacter(o.x, o.y, o.z, dir.x, dir.y, dir.z, best, c.pos.x, c.pos.y, c.pos.z, c.flags & 1);
      if (h) { best = h.t; victim = c; zone = h.zone; }
    }
    let surf = wh && !victim ? wh.surf : null;
    const wy = this.level.env.water?.y;
    if (!victim && wy != null && dir.y < -0.01) { const tw = (wy - o.y) / dir.y; if (tw > 0 && tw < best) { best = tw; surf = 'water'; } }
    const end = _c.copy(o).addScaledVector(dir, best);
    if (victim) { this.fx.impact(end, _n.copy(dir).negate(), 'flesh', false); this.audio.impact('flesh', [end.x, end.y, end.z]); }
    else if (surf === 'water') { this.fx.impact(end, _n.set(0, 1, 0), 'water', false); }
    else if (wh) { this.fx.impact(end, _n.set(wh.nx, wh.ny, wh.nz), wh.surf); this.audio.impact(wh.surf, [end.x, end.y, end.z]); }
    this.vm.fire(a.mag === 0);
    this.engine.camera.updateMatrixWorld(); this.vm.update({ dt: 0, speed, grounded: me.grounded, ads: this.adsWanted, sprint: false, look: { x: 0, y: 0 }, reload: -1, bolt: -1, hidden: this.scoped });
    this.vm.current.group.updateMatrixWorld(true);
    const muzzle = this.scoped ? _d.copy(o).addScaledVector(dir, 1.2) : this.vm.muzzleWorld(_d);
    this.fx.tracer(muzzle, end);
    if (!w.bolt) { const ej = this.vm.ejectWorld(_n); this.fx.shell(ej, V().set(1.6 + Math.random(), 1.6 + Math.random(), 0.3 * Math.random()).applyQuaternion(cam.quaternion).add(me.vel), me.pos.y); }
    else me.bolt = 0;
    this.audio.shot(me.weapon);
    const ak = ads > 0.5 ? 0.72 : 1, ck = me.crouch ? 0.85 : 1;
    me.rp += w.recoil[0] * ak * ck * (0.85 + Math.random() * 0.3); me.ry += (Math.random() - 0.5) * 2 * w.recoil[1] * ak;
    me.bloom = Math.min(w.maxBloom, me.bloom + w.bloom); me.shake = Math.min(1, me.shake + 0.12);
    this.net.send({ t: 'fire', w: me.weapon, o: [o.x, o.y, o.z].map((v) => Math.round(v * 100) / 100), e: [[end.x, end.y, end.z].map((v) => Math.round(v * 100) / 100)], hits: victim ? [[victim.id, zone]] : [] });
    if (a.mag === 0 && a.res > 0) setTimeout(() => this.me === me && me.weapon && this.startReload(), 250);
  }

  // ------------------------------------------------------------------ frame
  frame(dt) {
    if (!this.active) return;
    this.net.update(dt);
    if (this.pendingHi && !this.loadingHi) { const m = this.pendingHi; this.pendingHi = null; this.loadingHi = this.handleHi(m).finally(() => { this.loadingHi = null; }); }
    const me = this.me; if (!me || !this.world) return;
    const now = performance.now() / 1000, cam = this.engine.camera;
    const frozen = this.paused || this.chatting;
    const di = this.debugInput;
    if (di) { if (di.yaw != null) me.yaw = di.yaw; if (di.pitch != null) me.pitch = di.pitch; }
    const fireHeld = !frozen && (this.mouse.l || di?.fire), adsHeld = !frozen && (this.mouse.r || di?.ads);
    if (di?.fire && !this._dbgFire) this.firePressed = true; this._dbgFire = di?.fire;

    if (me.alive) {
      // ---- movement
      const f = frozen ? 0 : (this.key('KeyW') ? 1 : 0) - (this.key('KeyS') ? 1 : 0), s = frozen ? 0 : (this.key('KeyD') ? 1 : 0) - (this.key('KeyA') ? 1 : 0);
      const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
      let wx = -sy * f + cy * s, wz = -cy * f - sy * s; const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
      const wantCrouch = !frozen && (this.key('ControlLeft') || this.key('KeyC'));
      if (wantCrouch) me.crouch = true; else if (me.crouch && !this.world.blocked(me.pos.x, me.pos.y, me.pos.z, PLAYER.height)) me.crouch = false;
      const w = WEAPONS[me.weapon];
      this.adsWanted = adsHeld && !me.reload && this.vm.drawT > 0.6;
      const sprint = !frozen && this.key('ShiftLeft') && f > 0 && !this.adsWanted && !me.crouch && !me.reload && now - me.lastShot > 0.25;
      const max = me.crouch ? 2.3 : this.adsWanted ? 2.9 : sprint ? 6.7 : 4.6;
      const v = me.vel;
      if (me.grounded) {
        const sp = Math.hypot(v.x, v.z);
        if (sp > 0) { const drop = Math.max(sp, 2) * 9 * dt, k = Math.max(0, sp - drop) / sp; v.x *= k; v.z *= k; }
        const cur = v.x * wx + v.z * wz, add = clamp(max - cur, 0, 60 * dt); v.x += wx * add; v.z += wz * add;
        if (!frozen && this.key('Space') && !this.jumpHeld) { v.y = 6.6; me.grounded = false; this.audio.step(me.surf, null, 0.8); }
      } else {
        const cur = v.x * wx + v.z * wz, add = clamp(max * 0.55 - cur, 0, 14 * dt); v.x += wx * add; v.z += wz * add;
      }
      this.jumpHeld = this.key('Space');
      v.y -= 20 * dt;
      const wasG = me.grounded, vyBefore = v.y, yBefore = me.pos.y;
      const res = this.world.moveCharacter(me.pos, v, dt, me.crouch ? PLAYER.crouchHeight : PLAYER.height, wasG);
      me.grounded = res.grounded; if (res.surf) me.surf = res.surf;
      if (wasG && me.grounded && me.pos.y - yBefore > 0.06) me.stepOff -= me.pos.y - yBefore;       // smooth step-ups
      if (!wasG && me.grounded && vyBefore < -5) { this.vm.landT = Math.min(1.5, -vyBefore / 9); me.shake += 0.15; this.audio.step(me.surf, null, 1.6); }
      me.stepOff += (0 - me.stepOff) * Math.min(1, dt * 14);
      const speed = Math.hypot(v.x, v.z);
      if (me.grounded) { me.stepDist += speed * dt; const stride = sprint ? 2.5 : 2.0; if (me.stepDist > stride) { me.stepDist = 0; this.audio.step(me.surf, null, me.crouch ? 0.4 : sprint ? 1.2 : 0.8); } }
      me.eye += ((me.crouch ? PLAYER.crouchEye : PLAYER.eye) - me.eye) * Math.min(1, dt * 12);

      // ---- weapon logic
      if (me.reload) {
        const r = me.reload; r.t += dt;
        while (r.cues.length && r.t / r.dur >= r.cues[0][0]) this.audio.click(r.cues.shift()[1]);
        if (r.t >= r.dur) { const a = me.ammo[me.weapon], n = Math.min(w.mag - a.mag, a.res); a.mag += n; a.res -= n; me.reload = null; }
      }
      if (me.bolt >= 0) { const prev = me.bolt, cue = (at) => prev < at && me.bolt >= at; me.bolt += dt / (60 / w.rpm * 0.85); if (cue(0.17)) this.audio.click('boltup'); if (cue(0.25)) this.audio.click('boltback'); if (cue(0.29)) { const ej = this.vm.ejectWorld(_n); this.fx.shell(ej, V().set(1.5, 1.4, 0).applyQuaternion(cam.quaternion), me.pos.y); } if (cue(0.53)) this.audio.click('boltfwd'); if (cue(0.645)) this.audio.click('boltdown'); if (me.bolt >= 1) me.bolt = -1; }
      if (fireHeld && !this.ended) this.tryFire(now);
      this.firePressed = false;
      me.bloom = Math.max(0, me.bloom - dt * 0.09);
      // recoil: apply pending kick quickly, then recover part of it
      const ap = me.rp * Math.min(1, dt * 28), ay = me.ry * Math.min(1, dt * 28);
      me.pitch = clamp(me.pitch + ap, -1.5, 1.5); me.yaw += ay; me.rp -= ap; me.ry -= ay; me.recover += ap * 0.55;
      if (now - me.lastShot > 0.11) { const rc = me.recover * Math.min(1, dt * 7); me.pitch -= rc; me.recover -= rc; }

      // ---- camera
      this.scoped = me.weapon === 'marksman' && this.vm.adsT > 0.82 && this.adsWanted;
      this.engine.scope += ((this.scoped ? 1 : 0) - this.engine.scope) * Math.min(1, dt * 22);
      const targetFov = this.settings.fov + (w.adsFov - this.settings.fov) * this.vm.adsT + (sprint ? 5 : 0);
      me.fov += (targetFov - me.fov) * Math.min(1, dt * 14);
      me.roll += ((-s * 0.012 * Math.min(1, speed / 4)) - me.roll) * Math.min(1, dt * 8);
      me.bob += dt * (me.grounded ? speed : 0) * 1.9;
      const bobY = Math.sin(me.bob * 2) * 0.012 * Math.min(1, speed / 4.6) * (1 - this.vm.adsT * 0.7);
      me.shake = Math.max(0, me.shake - dt * 4);
      const sh = me.shake * me.shake * 0.012;
      cam.position.set(me.pos.x, me.pos.y + me.eye + me.stepOff + bobY - this.vm.landT * 0.05, me.pos.z);
      cam.rotation.set(me.pitch + (Math.random() - 0.5) * sh, me.yaw + (Math.random() - 0.5) * sh, me.roll);
      if (Math.abs(cam.fov - me.fov) > 0.01) { cam.fov = me.fov; cam.updateProjectionMatrix(); }
      this.vm.update({ dt, speed, grounded: me.grounded, ads: this.adsWanted, sprint, look: this.look, reload: me.reload ? me.reload.t / me.reload.dur : -1, bolt: me.bolt, hidden: this.scoped });
      this.look.x = this.look.y = 0;

      // ---- net
      const use = !frozen && this.key('KeyF'); if (use !== me.use) { me.use = use; this.net.send({ t: 'use', on: use }); }
      this.sendT += dt;
      if (this.sendT >= 0.05) {
        this.sendT = 0;
        const r2 = (x) => Math.round(x * 100) / 100;
        this.net.send({ t: 'st', p: [r2(me.pos.x), r2(me.pos.y), r2(me.pos.z)], yw: Math.round(me.yaw * 1000) / 1000, pt: Math.round(me.pitch * 1000) / 1000, f: (me.crouch ? 1 : 0) | (speed > 0.6 ? 2 : 0) | (sprint ? 4 : 0) | (me.grounded ? 0 : 8) | (this.adsWanted ? 16 : 0), w: me.weapon });
      }
      // ---- hud
      const a = me.ammo[me.weapon];
      this.hud.setAmmo(a.mag, a.res, w.name, w.slot, a.mag <= w.mag * 0.25, { size: w.mag, reload: me.reload ? me.reload.t / me.reload.dur : -1, ammo: me.ammo });
      const px = Math.tan(w.spread + (w.adsSpread - w.spread) * this.vm.adsT + w.moveSpread * Math.min(1, speed / 4.5) + me.bloom + (me.grounded ? 0 : 0.05)) * (innerHeight / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      this.hud.setCrosshair(Math.max(3, px), this.vm.adsT < 0.5 && !sprint && !me.reload);
    } else {
      // death camera: sink and tilt
      me.deadT += dt; this.engine.scope = 0;
      const k = Math.min(1, me.deadT / 0.6);
      cam.position.set(me.pos.x, me.pos.y + me.eye * (1 - k * 0.78), me.pos.z);
      cam.rotation.set(me.pitch * (1 - k) - k * 0.25, me.yaw, k * 0.6);
      this.vm.update({ dt, speed: 0, grounded: true, ads: false, sprint: false, look: this.look, reload: -1, bolt: -1, hidden: true });
      this.hud.setCrosshair(0, false);
      if (!this.ended) this.hud.death(me.killer ? `Killed by ${me.killer} — redeploying…` : 'Redeploying…');
    }
    this.engine.hurt = Math.max(me.alive ? (me.hp < 35 ? (35 - me.hp) / 70 : 0) : 0.9, this.engine.hurt - dt * 0.9);
    this.hud.setHealth(me.alive ? me.hp : 0);

    // ---- world
    this.chars.update(dt, now - this.interp, me.team);
    cam.updateMatrixWorld();
    const fw = cam.getWorldDirection(_a);
    this.audio.setListener(cam.position, fw);

    // ---- objective marker / prompt
    if (this.obj && this.obj.at && !this.ended) {
      const at = this.obj.at, p = _b.set(at[0], at[1] + 1.2, at[2]), dist = Math.hypot(at[0] - me.pos.x, at[2] - me.pos.z);
      const v = p.clone().applyMatrix4(cam.matrixWorldInverse); p.project(cam);
      const x = (p.x * 0.5 + 0.5) * innerWidth, y = (-p.y * 0.5 + 0.5) * innerHeight;
      // the diamond only shows while the objective is in view; the compass carries the direction otherwise
      this.hud.marker(x, y, `${Math.round(dist)} m`, v.z < 0 && Math.abs(p.x) < 0.94 && p.y > -0.8 && p.y < 0.72);
      const near = this.obj.kind === 'interact' && dist < 2.4 && me.alive;
      this.hud.prompt(near ? this.obj.prompt : null, this.objP?.p || 0);
    } else { this.hud.marker(0, 0, '', false); this.hud.prompt(null); }
    if (!this.paused && !this.chatting && !this.debugInput && document.pointerLockElement !== this.engine.canvas) this.hud.prompt('Click to take control');
    // ---- compass: objective, nearby ammo, (hostile gunfire is added by the HUD from remoteFire)
    {
      const mk = this.compassMk || (this.compassMk = []); mk.length = 0;
      const brg = (x, z) => Math.atan2(x - me.pos.x, -(z - me.pos.z)) * 57.29578;
      if (this.obj?.at && !this.ended) mk.push({ kind: 'obj', bearing: brg(this.obj.at[0], this.obj.at[2]), dist: Math.hypot(this.obj.at[0] - me.pos.x, this.obj.at[2] - me.pos.z) });
      const pk = this.level.pickups;
      for (let i = 0; i < pk.length; i++) { const d = Math.hypot(pk[i].x - me.pos.x, pk[i].z - me.pos.z); if (d < 30 && this.built?.pickups[i]?.group.visible) mk.push({ kind: 'ammo', bearing: brg(pk[i].x, pk[i].z), dist: d }); }
      this.hud.setCompass(((-me.yaw * 57.29578) % 360 + 360) % 360, mk, me.pos);
    }
    // ---- match header + scoreboard
    if (this.mode !== 'campaign' && this.match) {
      const mine = this.roster.get(me.id);
      this.hud.setMatch(this.mode === 'tdm' ? { left: this.match.left, tdm: true, a: this.match.ts[1], al: 'Blue', b: this.match.ts[2], bl: 'Red' } : { left: this.match.left, a: mine?.k ?? 0, al: 'Kills', b: this.match.limit, bl: 'To win' });
    }
    const showScores = (this.key('Tab') || (this.ended && this.mode !== 'campaign')) && !this.paused;
    if (showScores) this.hud.scoreboard(true, { title: `${this.level.name} · ${{ dm: 'Deathmatch', tdm: 'Team deathmatch', campaign: 'Campaign' }[this.mode]}`, teams: this.mode === 'tdm', rows: [...this.roster.values()].map((r) => ({ ...r, me: r.id === me.id })) });
    else this.hud.scoreboard(false);
    this.hud.update(dt, me.yaw);
  }
}
