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

const rnd = (a, b) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.75;
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export function makeAI(skill, mode = 'roam', post = null) {
  return {
    skill: SKILLS[skill] || SKILLS.normal, mode, post, target: null, visible: false, peek: false, seenAt: -99, lastSeen: null,
    reactAt: 0, engageAt: 0, alertUntil: 0, nextSee: Math.random() * 0.3, path: null, pi: 0, repathAt: 0, goal: null,
    strafe: 0, strafeUntil: 0, burst: 0, pauseUntil: 0, nextShot: 0, ammo: 30, reloadUntil: 0,
    stuckT: 0, stuckX: 0, stuckZ: 0,
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
    let goal = null, moving = false;
    if (ai.lastSeen && (now - ai.seenAt < 8 || ai.mode === 'hunt')) { goal = ai.lastSeen; moving = true; }
    else if (ai.mode === 'guard' && ai.post) { if (Math.hypot(e.x - ai.post.x, e.z - ai.post.z) > 2.5) goal = ai.post; }
    else if (ai.mode !== 'guard') { if (!ai.goal) ai.goal = nav.randomPoint(); goal = ai.goal; }
    if (goal) {
      if (!ai.path || (moving && now > ai.repathAt)) {
        ai.path = nav.path(e.x, e.z, goal.x, goal.z); ai.pi = 0; ai.repathAt = now + rnd(1.2, 2.2);
        if (!ai.path) { ai.goal = null; ai.lastSeen = null; }
      }
      if (ai.path) {
        let wp = ai.path[ai.pi];
        if (Math.hypot(wp.x - e.x, wp.z - e.z) < 0.5) {
          ai.pi++;
          if (ai.pi >= ai.path.length) { ai.path = null; ai.goal = null; if (goal === ai.lastSeen && ai.mode !== 'hunt') ai.lastSeen = null; wp = null; }
          else wp = ai.path[ai.pi];
        }
        if (wp) {
          const dx = wp.x - e.x, dz = wp.z - e.z, d = Math.hypot(dx, dz) || 1;
          wx = dx / d; wz = dz / d; speed = ai.mode === 'guard' && !moving ? 2.2 : 4.4;
          faceYaw = Math.atan2(-wx, -wz);
        }
      }
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
  const turn = sk.turn * dt;
  const dy = wrap(faceYaw - e.yaw);
  e.yaw = wrap(e.yaw + Math.max(-turn, Math.min(turn, dy)));
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
