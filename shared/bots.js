// Bot AI. Runs inside GameSim (browser for solo play, Node for multiplayer).
import { PLAYER, LEAN, leanShift } from './collision.js';
import { WEAPONS } from './weapons.js';

export const SKILLS = {
  easy: { react: 0.6, err: 5.2, turn: 4.0, dmg: 0.55, burst: [2, 4], pause: [0.6, 1.2] },
  normal: { react: 0.38, err: 3.2, turn: 6.5, dmg: 0.8, burst: [3, 6], pause: [0.4, 0.9] },
  hard: { react: 0.22, err: 1.9, turn: 9.5, dmg: 1.0, burst: [4, 8], pause: [0.25, 0.6] },
};
export const BOT_NAMES = ['Harlow', 'Voss', 'Kessler', 'Marek', 'Ito', 'Brandt', 'Okafor', 'Reyes', 'Lindqvist', 'Novak', 'Tamsin', 'Dray',
  'Castell', 'Yun', 'Abara', 'Moreau', 'Stroud', 'Petrov', 'Hale', 'Quint', 'Sorrel', 'Vance', 'Idris', 'Brooke', 'Aziz', 'Fenn', 'Garza', 'Holt',
  'Juno', 'Kade', 'Lark', 'Mako', 'Nash', 'Orrin', 'Pryce', 'Rook', 'Sable', 'Tolan', 'Ulrich', 'Varga', 'Wren', 'Xavi', 'Yates', 'Zeller',
  'Ames', 'Boone', 'Cray', 'Dunne', 'Eze', 'Falk', 'Grieve', 'Hobbs', 'Imani', 'Jarrah', 'Kowal', 'Lund', 'Mbeki', 'Nilsen', 'Oduya', 'Pike',
  'Ramos', 'Santos', 'Thorne', 'Usman', 'Vidal', 'Weir'];      // at least MAX_PLAYERS of them

/**
 * How a bot moves while it has nobody in sight. walk, jog, sprint: its paces in m/s (a soldier on screen walks below
 * 3.4 m/s and runs above it, so no pace sits near that; a player sprints at 6.7); only bots of a match sprint.
 * accel, brake: m/s² to speed up and to slow down. grip: m/s² sideways, which sets how tight a turn it can make at a
 * speed (radius = speed² / grip): it slows for a corner and rounds it, swinging at most `wide` m off its route. reach: how far ahead on its route it steers
 * for, m, plus `lead` s of travel. look: how far ahead on the route its eyes are, m: into a corner before it turns.
 * ease, spin: how its view turns: `ease` times the angle left, per second, and that speed changes by at most `spin`
 * rad/s². glance: every so many seconds it looks to one side for `glanceFor` s by up to `glanceBy` rad.
 * rest: the chance that it stands and looks about when it gets where it was going, and for how many seconds.
 */
export const GAIT = { walk: 2.9, jog: 4.4, sprint: 6.3, accel: 9, brake: 11, grip: 16, wide: 0.4, reach: 1.2, lead: 0.3, look: 6, ease: 6, spin: 30,
  glance: [2, 5.5], glanceFor: [0.45, 0.9], glanceBy: [0.5, 1.1], rest: 0.35, restFor: [0.8, 2.4] };

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** The point m metres from a towards b: b itself if that is nearer. */
const toward = (a, b, m) => { const d = Math.hypot(b.x - a.x, b.z - a.z); return d <= m ? b : { x: a.x + (b.x - a.x) / d * m, z: a.z + (b.z - a.z) / d * m }; };
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.75;
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const TICKS_APART = 0.11;      // s since a bot last steered along a route after which it is setting off anew

export function makeAI(skill, mode = 'roam', post = null) {
  return {
    skill: SKILLS[skill] || SKILLS.normal, mode, post, target: null, visible: false, peek: false, seenAt: -99, lastSeen: null,
    reactAt: 0, engageAt: 0, alertUntil: 0, nextSee: Math.random() * 0.3, path: null, pi: 0, repathAt: 0, goal: null,
    strafe: 0, strafeUntil: 0, burst: 0, pauseUntil: 0, nextShot: 0, ammo: 30, reloadUntil: 0,
    stuckT: 0, stuckX: 0, stuckZ: 0,
    // on a route (GAIT): where this stretch of it began, the way and the speed it is going, its pace for this route and whether it sprints this stretch, when it last steered
    sx: 0, sz: 0, head: 0, v: 0, pace: GAIT.jog, dash: false, steered: -9, own: rnd(0.93, 1.07),
    yawV: 0, glance: 0, glanceAt: rnd(1, 4), glanceUntil: 0, restUntil: 0, lookYaw: 0, lookAt: 0,
  };
}

export function botAlert(e, from, now) {
  const ai = e.ai; if (!ai) return;
  ai.alertUntil = now + 4;
  if (!ai.visible) { ai.lastSeen = { x: from.x, z: from.z }; ai.seenAt = now; ai.path = null; }
}

/** A practice target (mode 'target'): stands on its post, or walks between the post and post.to. It never looks for anyone. */
function targetThink(e, dt) {
  const ai = e.ai, p = ai.post, low = p.crouch ? 1 : 0;
  if (!p.to) { e.vx = e.vz = 0; e.flags = low; return; }
  const tx = ai.back ? p.x : p.to[0], tz = ai.back ? p.z : p.to[1], dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz), sp = p.speed || 1.7;
  if (d < 0.1) { ai.back = !ai.back; return; }
  const step = Math.min(d, sp * dt);
  e.x += (dx / d) * step; e.z += (dz / d) * step; e.vx = (dx / d) * sp; e.vz = (dz / d) * sp;
  e.yaw = Math.atan2(-dx, -dz); e.flags = low | 2 | (sp > 3.8 ? 4 : 0);
}

export function botThink(sim, e, dt, now) {
  if (e.ai.mode === 'target') return targetThink(e, dt);
  const ai = e.ai, sk = ai.skill, world = sim.world, nav = sim.nav;
  const w = WEAPONS[e.weapon];
  const eyeY = e.y + PLAYER.eye;

  // ---------------- perception
  if (now >= ai.nextSee) {
    ai.nextSee = now + 0.14 + Math.random() * 0.1;
    let best = null, bd = 1e9, peek = false;                  // peek: he leans out of cover and only his head shows
    const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
    for (const t of sim.ents.values()) {
      if (t === e || !t.alive || !sim.hostile(e, t)) continue;
      const dx = t.x - e.x, dz = t.z - e.z, d = Math.hypot(dx, dz);
      if (d > 70 || d >= bd) continue;
      const inFov = d < 5 || (dx * fx + dz * fz) / (d || 1) > 0.25 || ai.alertUntil > now || ai.target === t.id;
      if (!inFov) continue;
      // his chest or his head must be in sight. A player who leans (Q, E) has both to the side of his feet.
      const [lx, lz] = leanShift(t.yaw, t.flags), c = LEAN.chest, ty = t.y + (t.flags & 1 ? 0.8 : 1.2);
      const chest = world.los(e.x, eyeY, e.z, t.x + lx * c, ty, t.z + lz * c);
      if (!chest && !world.los(e.x, eyeY, e.z, t.x + lx, t.y + (t.flags & 1 ? 1.1 : 1.6), t.z + lz)) continue;
      best = t; bd = d; peek = !chest && (lx !== 0 || lz !== 0);
    }
    if (best) {
      if (!ai.visible || ai.target !== best.id) { ai.reactAt = now + sk.react * rnd(0.7, 1.3); ai.engageAt = now; }
      ai.target = best.id; ai.visible = true; ai.seenAt = now; ai.lastSeen = { x: best.x, z: best.z }; ai.peek = peek;
    } else {
      ai.visible = false;
      if (ai.mode === 'hunt' && now - ai.seenAt > 2.5) {
        let near = null, nd = 1e9;
        for (const t of sim.ents.values()) if (t.alive && sim.hostile(e, t)) { const d = Math.hypot(t.x - e.x, t.z - e.z); if (d < nd) { nd = d; near = t; } }
        if (near) { ai.lastSeen = { x: near.x, z: near.z }; ai.seenAt = now - 1; }
      }
    }
  }
  const tgt = ai.visible ? sim.ents.get(ai.target) : null;
  if (ai.visible && (!tgt || !tgt.alive)) { ai.visible = false; ai.target = null; ai.lastSeen = null; }

  // ---------------- movement intent
  let wx = 0, wz = 0, speed = 0, faceYaw = e.yaw, facePitch = 0;
  const hold = ai.mode === 'hold';
  if (tgt && ai.visible) {
    const dx = tgt.x - e.x, dz = tgt.z - e.z, d = Math.hypot(dx, dz) || 1;
    const nx = dx / d, nz = dz / d;
    const pref = { marksman: 30, pistol: 8, shotgun: 6, smg: 10 }[e.weapon] || 15;
    if (now > ai.strafeUntil) { ai.strafe = Math.random() < 0.2 ? 0 : Math.random() < 0.5 ? -1 : 1; ai.strafeUntil = now + rnd(0.5, 1.6); }
    const fwd = d > pref * 1.4 ? 1 : d < pref * 0.45 ? -0.8 : 0;
    wx = nx * fwd + -nz * ai.strafe; wz = nz * fwd + nx * ai.strafe;
    const l = Math.hypot(wx, wz);
    if (l > 0.01 && !hold) {
      wx /= l; wz /= l; speed = 3.1;
      if (!nav.walkable(e.x + wx * 0.7, e.z + wz * 0.7)) { ai.strafe = -ai.strafe; wx = wz = 0; speed = 0; }
    } else { wx = wz = 0; }
    ai.path = null;
    const ty = tgt.y + (tgt.flags & 1 ? 0.85 : 1.25);
    faceYaw = Math.atan2(-dx, -dz);
    facePitch = Math.atan2(ty - eyeY, d);
  } else if (!hold) {
    let goal = null, moving = false;                          // moving: after someone it saw or heard, not just on its round
    if (ai.lastSeen && (now - ai.seenAt < 8 || ai.mode === 'hunt')) { goal = ai.lastSeen; moving = true; }
    else if (ai.mode === 'guard' && ai.post) { if (Math.hypot(e.x - ai.post.x, e.z - ai.post.z) > 2.5) goal = ai.post; }
    else if (ai.mode !== 'guard' && now >= ai.restUntil) { if (!ai.goal) ai.goal = nav.randomPoint(); goal = ai.goal; }
    if (goal) {
      if (!ai.path || (moving && now > ai.repathAt)) {
        const fresh = !ai.path;
        ai.path = nav.path(e.x, e.z, goal.x, goal.z); ai.pi = 0; ai.sx = e.x; ai.sz = e.z; ai.repathAt = now + rnd(1.2, 2.2);
        if (!ai.path) { ai.goal = null; ai.lastSeen = null; }
        else if (fresh) { ai.pace = (Math.random() < 0.25 ? GAIT.walk : GAIT.jog) * ai.own; ai.dash = Math.random() < 0.4; }
      }
      if (ai.path) {
        // Along the route: each stretch runs from (sx, sz) to a point of the path. The bot steers for a spot a little
        // ahead of itself on the route, round the next corner if the way there is open, and has its eyes further ahead.
        const P = ai.path; let wp = P[ai.pi], lx = wp.x - ai.sx, lz = wp.z - ai.sz, len = Math.hypot(lx, lz) || 1e-6;
        let t = clamp(((e.x - ai.sx) * lx + (e.z - ai.sz) * lz) / (len * len), 0, 1), rem = (1 - t) * len;
        if (rem < 0.35 || Math.hypot(wp.x - e.x, wp.z - e.z) < 0.5) {
          ai.sx = wp.x; ai.sz = wp.z; ai.pi++; ai.dash = Math.random() < 0.4;
          if (ai.pi >= P.length) {                            // there
            ai.path = null; ai.goal = null; wp = null;
            if (goal === ai.lastSeen && ai.mode !== 'hunt') ai.lastSeen = null;
            if (ai.mode === 'roam' && Math.random() < GAIT.rest) ai.restUntil = now + rnd(GAIT.restFor[0], GAIT.restFor[1]);
          } else { wp = P[ai.pi]; lx = wp.x - ai.sx; lz = wp.z - ai.sz; len = Math.hypot(lx, lz) || 1e-6; t = 0; rem = len; }
        }
        if (wp) {
          if (now - ai.steered > TICKS_APART) { const sp0 = Math.hypot(e.vx, e.vz); ai.v = sp0; ai.head = sp0 > 1 ? Math.atan2(-e.vx, -e.vz) : Math.atan2(-(wp.x - e.x), -(wp.z - e.z)); }      // setting off: as it is going, or straight for the route
          ai.steered = now;
          const next = P[ai.pi + 1], on = { x: ai.sx + lx * t, z: ai.sz + lz * t }, far = GAIT.reach + ai.v * GAIT.lead;
          let spot = rem >= far || !next ? toward(on, wp, far) : toward(wp, next, far - rem);
          if (spot !== wp && rem < far && !nav.clear(e.x, e.z, spot.x, spot.z)) spot = wp;      // something in the corner: by way of the corner itself
          const dx = spot.x - e.x, dz = spot.z - e.z, d = Math.hypot(dx, dz) || 1e-6, off = wrap(Math.atan2(-dx, -dz) - ai.head);
          // pace: this route's, a sprint on a long stretch or after someone far off, slower into a corner and when what it steers for is to its side
          const run = ai.mode === 'roam' && (moving ? Math.hypot(goal.x - e.x, goal.z - e.z) > 14 : ai.dash && rem > 9 && ai.pace > 3.4);
          const pace = ai.mode === 'guard' && !moving ? 2.2 : run ? GAIT.sprint * ai.own : moving ? GAIT.jog * ai.own : ai.pace;
          let corner = 1.4;                                   // the speed it may still have at the end of this stretch: slow where the route ends,
          if (next) { const nx = next.x - wp.x, nz = next.z - wp.z, bend = Math.acos(clamp((lx * nx + lz * nz) / (len * (Math.hypot(nx, nz) || 1e-6)), -1, 1)); corner = pace + (2.4 - pace) * Math.min(1, bend / 1.9); }      // slower the sharper the corner
          const arc = Math.min(d / (2 * Math.max(0.05, Math.sin(Math.min(Math.abs(off), Math.PI / 2)))), GAIT.wide / Math.max(1e-3, 1 - Math.cos(off)));      // the radius of the turn that ends on the spot, and of the one that swings no wider than GAIT.wide
          const want = Math.min(pace, Math.sqrt(corner * corner + 2 * GAIT.brake * rem), Math.sqrt(GAIT.grip * arc));
          ai.v += clamp(want - ai.v, -GAIT.brake * dt * (Math.abs(off) > 1.2 ? 2.5 : 1), GAIT.accel * dt);      // its way is behind it: it stops short
          const swing = GAIT.grip / Math.max(ai.v, 1) * dt; ai.head = wrap(ai.head + clamp(off, -swing, swing));
          wx = -Math.sin(ai.head); wz = -Math.cos(ai.head); speed = ai.v;
          // eyes: on the route GAIT.look m ahead, and now and then to one side
          const eye = rem >= GAIT.look || !next ? toward(on, wp, GAIT.look) : toward(wp, next, GAIT.look - rem), ex = eye.x - e.x, ez = eye.z - e.z;
          let look = Math.hypot(ex, ez) > 0.6 ? clamp(wrap(Math.atan2(-ex, -ez) - ai.head), -1.1, 1.1) : 0;
          if (now > ai.glanceAt) { ai.glance = (Math.random() < 0.5 ? -1 : 1) * rnd(GAIT.glanceBy[0], GAIT.glanceBy[1]); ai.glanceUntil = now + rnd(GAIT.glanceFor[0], GAIT.glanceFor[1]); ai.glanceAt = ai.glanceUntil + rnd(GAIT.glance[0], GAIT.glance[1]); }
          if (now < ai.glanceUntil && !run) look = clamp(look + ai.glance, -1.2, 1.2);
          faceYaw = ai.head + look;
        }
      }
    } else if (ai.mode === 'roam') {                          // standing where it was going: it looks about
      if (now > ai.lookAt) { ai.lookYaw = e.yaw + rnd(-1.6, 1.6); ai.lookAt = now + rnd(0.6, 1.3); }
      faceYaw = ai.lookYaw;
    }
  }

  // ---------------- integrate
  const acc = Math.min(1, dt * 10);
  e.vx += (wx * speed - e.vx) * acc; e.vz += (wz * speed - e.vz) * acc;
  e.vy -= 22 * dt;
  const pos = sim._p; pos.x = e.x; pos.y = e.y; pos.z = e.z;
  const vel = sim._v; vel.x = e.vx; vel.y = e.vy; vel.z = e.vz;
  const res = world.moveCharacter(pos, vel, dt, PLAYER.height, e.grounded);
  e.x = pos.x; e.y = pos.y; e.z = pos.z; e.vx = vel.x; e.vy = vel.y; e.vz = vel.z; e.grounded = res.grounded;
  const sp = Math.hypot(e.vx, e.vz);
  e.flags = (sp > 0.6 ? 2 : 0) | (sp > 3.8 ? 4 : 0);
  if (e.y < world.killY) { const n = nav.center(nav.nearest(e.x, e.z)); e.x = n.x; e.z = n.z; e.y = 0.05; e.vy = 0; }

  // stuck detection
  ai.stuckT += dt;
  if (ai.stuckT > 1.2) {
    if (speed > 0 && Math.hypot(e.x - ai.stuckX, e.z - ai.stuckZ) < 0.3) { ai.path = null; ai.goal = null; ai.strafe = -ai.strafe; if (!ai.visible && ai.mode !== 'hunt') ai.lastSeen = null; if (e.grounded) e.vy = 6.2; }
    ai.stuckT = 0; ai.stuckX = e.x; ai.stuckZ = e.z;
  }

  // ---------------- aim
  // On someone, the view turns at the skill's full rate. With nobody in sight it eases: slower as it gets there, and it
  // neither starts nor stops with a jolt.
  const turn = sk.turn * dt;
  const dy = wrap(faceYaw - e.yaw);
  if (tgt && ai.visible) { const step = clamp(dy, -turn, turn); e.yaw = wrap(e.yaw + step); ai.yawV = step / dt; }
  else { ai.yawV += clamp(clamp(dy * GAIT.ease, -sk.turn, sk.turn) - ai.yawV, -GAIT.spin * dt, GAIT.spin * dt); e.yaw = wrap(e.yaw + ai.yawV * dt); }
  e.pitch += Math.max(-turn, Math.min(turn, facePitch - e.pitch));

  // ---------------- fire
  if (tgt && ai.visible && now >= ai.reactAt && now >= ai.reloadUntil && now >= ai.nextShot && Math.abs(dy) < 0.14) {
    if (ai.burst <= 0) {
      if (now < ai.pauseUntil) return;
      ai.burst = Math.round(rnd(sk.burst[0], sk.burst[1]));
      if (!w.auto) ai.burst = 1;
    }
    const d = Math.hypot(tgt.x - e.x, tgt.z - e.z);
    const tv = Math.hypot(tgt.vx || 0, tgt.vz || 0);
    let err = sk.err * (Math.PI / 180) * (1 + tv * 0.11 + 1.6 * Math.exp(-(now - ai.engageAt) / 0.9)) * (e.weapon === 'marksman' ? 0.45 : 1);
    if (sp > 1) err *= 1.3;
    const aimHead = ai.peek || (sk === SKILLS.hard && Math.random() < 0.25);
    const [lx, lz] = leanShift(tgt.yaw, tgt.flags), part = aimHead ? 1 : LEAN.chest;      // a leaning player's head and chest are to the side of his feet
    const ty = tgt.y + (tgt.flags & 1 ? (aimHead ? 1.14 : 0.85) : (aimHead ? 1.64 : 1.22)) - (lx || lz ? LEAN.drop * part : 0);
    const yaw = Math.atan2(-(tgt.x + lx * part - e.x), -(tgt.z + lz * part - e.z)) + gauss() * err;
    const pitch = Math.atan2(ty - eyeY, d) + gauss() * err;
    const cp = Math.cos(pitch);
    sim.botFire(e, [e.x, eyeY, e.z], [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp], sk.dmg);
    ai.burst--; ai.ammo--;
    ai.nextShot = now + 60 / w.rpm + (w.auto ? 0 : rnd(0.12, 0.4));
    if (ai.burst <= 0) ai.pauseUntil = now + rnd(sk.pause[0], sk.pause[1]);
    if (ai.ammo <= 0) { ai.ammo = w.mag; ai.reloadUntil = now + w.reload; ai.burst = 0; }
  }
}
