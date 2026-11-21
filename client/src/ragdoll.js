// What a soldier's body does once nobody holds it up. Sixteen particles sit on the joints and three on the rifle
// (verlet integration), tied together by sticks and joint limits and stopped by the level's collision boxes; the
// skeleton is then turned to follow them. Client only: where a body comes to rest does not matter to the match.
import * as THREE from 'three';

const HL = 0, HR = 1, WA = 2, SL = 3, SR = 4, HD = 5, EL = 6, ER = 7, ML = 8, MR = 9, KL = 10, KR = 11, AL = 12, AR = 13, TL = 14, TR = 15, G0 = 16, G1 = 17, G2 = 18, N = 19;
// the bone each body particle starts on, its radius in metres and its share of the weight
const PART = [
  ['LeftUpLeg', 0.11, 7], ['RightUpLeg', 0.11, 7], ['Spine1', 0.13, 10], ['LeftArm', 0.11, 6], ['RightArm', 0.11, 6], ['Head', 0.11, 5],
  ['LeftForeArm', 0.055, 2], ['RightForeArm', 0.055, 2], ['LeftHand', 0.05, 1], ['RightHand', 0.05, 1],
  ['LeftLeg', 0.085, 5], ['RightLeg', 0.085, 5], ['LeftFoot', 0.065, 2.5], ['RightFoot', 0.065, 2.5], ['LeftToeBase', 0.04, 0.8], ['RightToeBase', 0.04, 0.8],      // a leg lying flat rests on hip, knee and heel without bending the knee backwards
];
const GUN = [[0, 0.04, -0.64], [0, 0.02, 0.33], [0, -0.16, -0.1]], GUN_R = 0.03, GUN_M = 1.2;      // muzzle, butt and magazine in the rifle's own frame
// the bones the particles turn, parents first
const DRIVEN = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
const HIPS = 0, SPINE = 1, SPINE1 = 2, SPINE2 = 3, NECK = 4, HEAD = 5, ARM = [6, 8], FORE = [7, 9], UPLEG = [10, 13], LEG = [11, 14], FOOT = [12, 15];
const SIDES = [                                   // left, right: the particles of one arm and one leg, and which way is outward
  { sh: SL, el: EL, hand: ML, hip: HL, knee: KL, ankle: AL, toe: TL, out: 1 },
  { sh: SR, el: ER, hand: MR, hip: HR, knee: KR, ankle: AR, toe: TR, out: -1 },
];
// Pairs of particles across a joint, and the share of their closing or opening speed taken off each step: what is left
// of muscle and sinew in a body that has just gone limp. The knees and ankles give way slowly; the rest hangs loose.
const JOINTS = [
  [HL, AL, 0.035], [HR, AR, 0.035], [KL, TL, 0.05], [KR, TR, 0.05],                  // knee, ankle
  [SL, KL, 0.012], [SR, KR, 0.012], [SL, ML, 0.02], [SR, MR, 0.02], [WA, EL, 0.015], [WA, ER, 0.015],      // hip, elbow, shoulder
  [SL, HL, 0.03], [SR, HR, 0.03], [SL, HR, 0.03], [SR, HL, 0.03], [HD, WA, 0.03],    // trunk, neck
];
const STEP = 1 / 120, ITER = 8, GRAVITY = 12, CREEP = 0.004;
const GRIP = 0.7, STICK = 0.15 * STEP;             // friction on what it lies on, and the sliding speed (m/s) below which a part stays put
const DRAG = 0.996, DOWN = 0.991;                 // the speed kept each step in the air, and once the body is on the ground: flesh soaks a fall up, it does not roll on
/** How hard each weapon shoves the body it kills, in metres a second at the chest. */
export const SHOVE = { carbine: 1.2, smg: 1.0, pistol: 1.0, shotgun: 2.0, marksman: 1.8 };

const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
const _a = V(), _b = V(), _c = V(), _d = V(), _e = V(), _s = V(), _m = new THREE.Matrix4(), _q = Q(), _q2 = Q(), _D = Q(), _D2 = Q(), _D3 = Q(), _Dp = Q(), _Dc = Q();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const seg = (out, P, i, j) => out.set(P[j * 3] - P[i * 3], P[j * 3 + 1] - P[i * 3 + 1], P[j * 3 + 2] - P[i * 3 + 2]);
const mid = (out, P, i, j) => out.set((P[i * 3] + P[j * 3]) / 2, (P[i * 3 + 1] + P[j * 3 + 1]) / 2, (P[i * 3 + 2] + P[j * 3 + 2]) / 2);
const dist = (P, i, j) => Math.hypot(P[j * 3] - P[i * 3], P[j * 3 + 1] - P[i * 3 + 1], P[j * 3 + 2] - P[i * 3 + 2]);
/** The axes of a triangle of particles: x from b to a, y from the middle of a-b towards c, z out of its plane. */
function axes(x, y, z, P, a, b, c) {
  seg(x, P, b, a).normalize();
  y.set(P[c * 3] - (P[a * 3] + P[b * 3]) / 2, P[c * 3 + 1] - (P[a * 3 + 1] + P[b * 3 + 1]) / 2, P[c * 3 + 2] - (P[a * 3 + 2] + P[b * 3 + 2]) / 2);
  z.crossVectors(x, y).normalize(); y.crossVectors(z, x);
}
const tri = (out, P, a, b, c) => { axes(_a, _b, _c, P, a, b, c); return out.setFromRotationMatrix(_m.makeBasis(_a, _b, _c)); };

export class Ragdoll {
  /** bones: the skeleton by bone name without its prefix; gun: the rifle, a child of the right hand. */
  constructor(bones, gun) {
    this.bones = bones; this.gun = gun;
    this.p = new Float64Array(N * 3); this.o = new Float64Array(N * 3); this.d = new Float64Array(N * 3); this.mark = new Float64Array(N * 3);      // now, a step ago, as drawn, half a second ago
    this.rad = new Float64Array(N); this.w = new Float64Array(N);                                             // radius, 1 / weight
    for (let i = 0; i < N; i++) { this.rad[i] = i < G0 ? PART[i][1] : GUN_R; this.w[i] = 1 / (i < G0 ? PART[i][2] : GUN_M); }
    this.src = PART.map((s) => bones[s[0]]);
    this.arm = bones.Hips.parent; this.armQ = Q(); this.armInv = new THREE.Matrix4();      // what the skeleton hangs from
    const index = new Map(DRIVEN.map((n, i) => [bones[n], i]));
    this.drv = DRIVEN.map((n) => {                 // each driven bone, the driven bone above it and the untouched bones between the two
      const bone = bones[n], between = []; let up = bone.parent;
      while (up !== this.arm && !index.has(up)) { between.unshift(up); up = up.parent; }
      return { bone, anc: index.has(up) ? index.get(up) : -1, between, q0: Q(), q: Q() };
    });
    this.fp = Q(); this.fc = Q(); this.fg = Q(); this.gunQ = Q(); this.gunOff = V(); this.hipsOff = V(); this.neckOff = V(); this.headDir = V();
    this.limb = SIDES.map(() => ({ u: V(), f: V(), t: V(), s: V(), ft: V(), kf: V(), kl: V(), f0: V(), l0: V(), tol: 0, thigh: 0, shin: 0 }));
    this.px = V(); this.py = V(); this.pz = V();
    this.links = []; this.boxes = []; this.asleep = true; this.gone = false; this.dirty = false;
  }

  /**
   * Lets go of the body as it stands. o: { world, floor (y of the feet), squash (the crouch scale it was drawn with),
   * vx, vz (how it was moving), dir ([x, y, z] of the killing shot, if any), power (SHOVE), head (a head shot) }.
   * The body's root must be at scale 1 with its world matrices current.
   */
  start(o) {
    const P = this.p, R = this.d;
    for (let i = 0; i < G0; i++) { _a.setFromMatrixPosition(this.src[i].matrixWorld); P[i * 3] = _a.x; P[i * 3 + 1] = _a.y; P[i * 3 + 2] = _a.z; }
    _a.set(0, 10, 1).applyMatrix4(this.bones.Head.matrixWorld); P[HD * 3] = _a.x; P[HD * 3 + 1] = _a.y; P[HD * 3 + 2] = _a.z;      // the middle of the head: 10 cm up the head bone
    GUN.forEach((g, k) => { _a.set(g[0], g[1], g[2]).applyMatrix4(this.gun.matrixWorld); P[(G0 + k) * 3] = _a.x; P[(G0 + k) * 3 + 1] = _a.y; P[(G0 + k) * 3 + 2] = _a.z; });
    // ---- the pose it is let go in: everything below is measured against it
    for (const d of this.drv) d.bone.matrixWorld.decompose(_a, d.q0, _s);
    this.arm.matrixWorld.decompose(_a, this.armQ, _s); this.armInv.copy(this.arm.matrixWorld).invert();
    tri(this.fp, P, HL, HR, WA).invert(); tri(this.fc, P, SL, SR, WA).invert(); tri(this.fg, P, G0, G1, G2).invert();
    this.hipsOff.setFromMatrixPosition(this.bones.Hips.matrixWorld).sub(mid(_a, P, HL, HR));
    this.neckOff.setFromMatrixPosition(this.bones.Neck.matrixWorld).sub(mid(_a, P, SL, SR));
    this.headDir.set(P[HD * 3], P[HD * 3 + 1], P[HD * 3 + 2]).sub(_a.setFromMatrixPosition(this.bones.Neck.matrixWorld)).normalize();
    this.gun.matrixWorld.decompose(_a, this.gunQ, _s); this.gunOff.copy(_a).sub(_b.set((P[G0 * 3] + P[G1 * 3] + P[G2 * 3]) / 3, (P[G0 * 3 + 1] + P[G1 * 3 + 1] + P[G2 * 3 + 1]) / 3, (P[G0 * 3 + 2] + P[G1 * 3 + 2] + P[G2 * 3 + 2]) / 3));
    axes(_a, _b, _e, P, SL, SR, WA); mid(_d, P, SL, SR);
    const nod = (_d.x - P[HD * 3]) * _e.x + (_d.y - P[HD * 3 + 1]) * _e.y + (_d.z - P[HD * 3 + 2]) * _e.z;      // how far the head is carried in front of the shoulders
    this.nod0 = Math.min(nod, 0.02) - 0.07; this.nod1 = Math.max(nod, 0.04) + 0.09;                            // from tipped back a little to chin on chest
    axes(this.px, this.py, this.pz, P, HL, HR, WA);
    SIDES.forEach((s, k) => {
      const L = this.limb[k];
      seg(L.u, P, s.sh, s.el).normalize(); seg(L.f, P, s.el, s.hand).normalize();
      seg(L.t, P, s.hip, s.knee); L.thigh = L.t.length(); L.t.normalize(); seg(L.s, P, s.knee, s.ankle); L.shin = L.s.length(); seg(L.ft, P, s.ankle, s.toe).normalize();
      L.f0.copy(this.pz).addScaledVector(L.t, -this.pz.dot(L.t)).normalize(); L.l0.crossVectors(L.t, L.f0);      // the way this knee points, and across it
      L.tol = Math.max(0.05, L.s.dot(L.f0) + 0.01); L.s.normalize();
    });
    // ---- sticks (a length), limits (a range) and things that keep apart (a least distance)
    const K = this.links; K.length = 0;
    const link = (i, j, lo = 1, hi = lo) => { const r = dist(P, i, j); K.push(i, j, r * lo, r * hi); }, apart = (i, j, least) => K.push(i, j, least, 1e9);
    link(HL, HR); link(HL, WA); link(HR, WA); link(SL, SR); link(SL, WA); link(SR, WA);                       // pelvis and chest: two stiff triangles hinged at the waist
    link(SL, HL, 0.82, 1.03); link(SR, HR, 0.82, 1.03); link(SL, HR, 0.84, 1.03); link(SR, HL, 0.84, 1.03);   // ... which the trunk lets bend and twist this far
    link(HD, SL, 0.93, 1.07); link(HD, SR, 0.93, 1.07); link(HD, WA, 0.9, 1.02);
    link(G0, G1); link(G1, G2); link(G2, G0);
    for (const s of SIDES) {
      link(s.sh, s.el); link(s.el, s.hand); apart(s.sh, s.hand, (dist(P, s.sh, s.el) + dist(P, s.el, s.hand)) * 0.4);
      link(s.hip, s.knee); link(s.knee, s.ankle); link(s.ankle, s.toe); link(s.knee, s.toe, 0.86, 1.1);
      apart(s.hip, s.ankle, 0.2);                                                                               // folds far enough to sit on the heels
      apart(s.el, HD, 0.16); apart(s.hand, HD, 0.15); apart(s.knee, HD, 0.2); apart(s.knee, WA, 0.26); apart(s.knee, SL, 0.3); apart(s.knee, SR, 0.3);
    }
    apart(KL, KR, 0.15); apart(AL, AR, 0.14); apart(KL, AR, 0.13); apart(KR, AL, 0.13); apart(ML, MR, 0.08);
    // ---- a crouching soldier was drawn squashed: start from a real crouch of the same height instead
    if (o.squash < 0.98) {
      const drop = (1 - o.squash) * ((P[HL * 3 + 1] + P[HR * 3 + 1]) / 2 - o.floor);
      for (const i of [HL, HR, WA, SL, SR, HD, EL, ER, ML, MR, G0, G1, G2]) P[i * 3 + 1] -= drop;
      SIDES.forEach((s, k) => {
        const L = this.limb[k], c = Math.min(seg(_a, P, s.hip, s.ankle).length(), L.thigh + L.shin - 1e-3), x = (L.thigh * L.thigh - L.shin * L.shin + c * c) / (2 * c);
        _a.normalize(); _b.copy(this.pz).addScaledVector(_a, -this.pz.dot(_a)).normalize();
        const h = Math.sqrt(Math.max(0, L.thigh * L.thigh - x * x));
        for (let n = 0; n < 3; n++) P[s.knee * 3 + n] = P[s.hip * 3 + n] + _a.getComponent(n) * x + _b.getComponent(n) * h;
      });
    }
    // ---- how each part is moving: with the soldier, away from the shot, the knees giving way
    const sp = Math.hypot(o.vx, o.vz), cut = sp > 7 ? 7 / sp : 1, dir = o.dir, pw = o.power || 0, twist = (Math.random() * 2 - 1) * 0.45 * pw, tumble = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random());
    const take = o.head
      ? [0.3, 0.3, 0.45, 0.75, 0.75, 1.0, 0.4, 0.4, 0.3, 0.3, 0.2, 0.2, 0.1, 0.1, 0, 0, 0.3, 0.3, 0.3]
      : [0.6, 0.6, 1, 1, 1, 0.75, 0.5, 0.5, 0.4, 0.4, 0.45, 0.45, 0.2, 0.2, 0.1, 0.1, 0.4, 0.4, 0.4];
    const give = [0.7 + Math.random() * 0.8, 0.7 + Math.random() * 0.8];                 // each knee gives way in its own time
    for (let i = 0; i < N; i++) {
      const loose = i >= EL && i <= MR ? 1 : 0.3;                                        // arms fly about more than the rest
      let vx = o.vx * cut + (Math.random() - 0.5) * loose, vy = (Math.random() - 0.5) * 0.2, vz = o.vz * cut + (Math.random() - 0.5) * loose;
      if (dir) { vx += dir[0] * pw * take[i]; vy += dir[1] * pw * take[i]; vz += dir[2] * pw * take[i]; }
      if (dir && (i === SL || i === SR)) { const t = i === SL ? twist : -twist; vx += -dir[2] * t; vz += dir[0] * t; }
      if (i === KL || i === KR) { const g = give[i - KL]; vx += this.pz.x * g; vz += this.pz.z * g; }
      if (i === HL || i === HR) { vx -= this.pz.x * 0.35; vz -= this.pz.z * 0.35; }
      if (i >= G0) { vy += 0.6 + (i === G0 ? tumble : 0); vx += this.px.x * -0.5; vz += this.px.z * -0.5; }      // the rifle is let go with a turn to it
      this.o[i * 3] = P[i * 3] - vx * STEP; this.o[i * 3 + 1] = P[i * 3 + 1] - vy * STEP; this.o[i * 3 + 2] = P[i * 3 + 2] - vz * STEP;
    }
    R.set(P); this.mark.set(P);
    this.world = o.world; this.asleep = false; this.gone = false; this.acc = 0; this.t = 0; this.still = 0; this.down = 0; this.dirty = true;
  }

  /** Advances the body by dt seconds. */
  step(dt) {
    if (this.asleep) return;
    const P = this.p;
    // the boxes it could touch this frame
    const cx = (P[HL * 3] + P[HR * 3]) / 2, cy = (P[HL * 3 + 1] + P[HR * 3 + 1]) / 2, cz = (P[HL * 3 + 2] + P[HR * 3 + 2]) / 2, near = this.boxes; near.length = 0;
    for (const b of this.world.near(cx, cz, 1)) {
      if (!b.solid || cy - 2 > b.maxY || cy + 2 < b.minY) continue;
      const dx = cx - b.cx, dz = cz - b.cz, reach = b.br + 1.7;
      if (dx < reach && dx > -reach && dz < reach && dz > -reach) near.push(b);
    }
    this.acc = Math.min(this.acc + dt, STEP * 6);
    while (this.acc >= STEP && !this.asleep) { this.acc -= STEP; this.substep(); }
    if (cy < this.world.killY - 3) { this.asleep = true; this.gone = true; }      // fell off the map
    const R = this.d, O = this.o, k = this.asleep ? 0 : this.acc / STEP;          // drawn a part-step ahead, so the motion stays even at any frame rate
    for (let i = 0; i < N * 3; i++) R[i] = P[i] + (P[i] - O[i]) * k;
    this.dirty = true;
  }

  substep() {
    const P = this.p, O = this.o, W = this.w, K = this.links;
    // joint axes for this step: the pelvis's own, and for each knee the way it points and across it
    axes(this.px, this.py, this.pz, P, HL, HR, WA);
    _Dp.setFromRotationMatrix(_m.makeBasis(this.px, this.py, this.pz)).multiply(this.fp);
    SIDES.forEach((s, k) => {
      const L = this.limb[k];
      _q.setFromUnitVectors(_a.copy(L.t).applyQuaternion(_Dp), seg(_b, P, s.hip, s.knee).normalize());
      L.kf.copy(L.f0).applyQuaternion(_Dp).applyQuaternion(_q); L.kl.copy(L.l0).applyQuaternion(_Dp).applyQuaternion(_q);
    });
    for (const [a, b, brake] of JOINTS) {
      const i = a * 3, j = b * 3, dx = P[j] - P[i], dy = P[j + 1] - P[i + 1], dz = P[j + 2] - P[i + 2], d2 = dx * dx + dy * dy + dz * dz || 1e-9;
      const f = ((P[j] - O[j] - P[i] + O[i]) * dx + (P[j + 1] - O[j + 1] - P[i + 1] + O[i + 1]) * dy + (P[j + 2] - O[j + 2] - P[i + 2] + O[i + 2]) * dz) / d2 * brake / (W[a] + W[b]);
      O[i] -= dx * f * W[a]; O[i + 1] -= dy * f * W[a]; O[i + 2] -= dz * f * W[a]; O[j] += dx * f * W[b]; O[j + 1] += dy * f * W[b]; O[j + 2] += dz * f * W[b];
    }
    const keep = this.down > 1 ? DOWN : DRAG; this.down = 0;
    for (let i = 0; i < N * 3; i += 3) {
      const vx = (P[i] - O[i]) * keep, vy = (P[i + 1] - O[i + 1]) * keep, vz = (P[i + 2] - O[i + 2]) * keep;
      O[i] = P[i]; O[i + 1] = P[i + 1]; O[i + 2] = P[i + 2];
      P[i] += vx; P[i + 1] += vy - GRAVITY * STEP * STEP; P[i + 2] += vz;
    }
    // Joint stops. Two parts past a stop are put back where this step found them, so they get no further past it, and
    // while the body is still falling they are also walked home a little (CREEP a step). Put back in one go, a knee
    // bent the wrong way by the weight above it would be thrown into the air; and once the body lies, a limb caught
    // where it cannot get home must be left alone, or the pushing would move the whole body about.
    const push = (i, n, by) => { P[i * 3] += n.x * by; P[i * 3 + 1] += n.y * by; P[i * 3 + 2] += n.z * by; };
    const creep = CREEP * clamp(2.5 - this.t, 0, 1);
    const stop = (i, j, n, deep) => {               // i belongs `deep` further along n, j the other way
      const a = i * 3, b = j * 3, wi = W[i] / (W[i] + W[j]);
      const apart = (P[a] - O[a] - P[b] + O[b]) * n.x + (P[a + 1] - O[a + 1] - P[b + 1] + O[b + 1]) * n.y + (P[a + 2] - O[a + 2] - P[b + 2] + O[b + 2]) * n.z;
      const fix = Math.min(deep, creep) - Math.min(0, apart);
      push(i, n, fix * wi); push(j, n, -fix * (1 - wi));
    };
    SIDES.forEach((s, k) => {
      const L = this.limb[k];
      // knee: the shin folds back, never forward, and only a little to the side
      seg(_a, P, s.knee, s.ankle);
      let c = _a.dot(L.kf) - L.tol; if (c > 0) stop(s.knee, s.ankle, L.kf, c);
      c = _a.dot(L.kl); const lim = L.shin * 0.3; if (c > lim) stop(s.knee, s.ankle, L.kl, c - lim); else if (c < -lim) stop(s.ankle, s.knee, L.kl, -lim - c);
      // hip: the thigh goes neither far behind the pelvis nor across the other leg
      seg(_a, P, s.hip, s.knee);
      c = _a.dot(this.pz) + L.thigh * 0.4; if (c < 0) stop(s.knee, s.hip, this.pz, -c);
      c = _a.dot(this.px) * s.out; _e.copy(this.px).multiplyScalar(s.out);
      if (c < -L.thigh * 0.5) stop(s.knee, s.hip, _e, -L.thigh * 0.5 - c); else if (c > L.thigh * 0.9) stop(s.hip, s.knee, _e, c - L.thigh * 0.9);
    });
    // arms stay outside the trunk
    mid(_a, P, HL, HR); mid(_b, P, SL, SR); _c.subVectors(_b, _a); const len2 = _c.lengthSq();
    for (const i of [EL, ER, ML, MR]) {
      _d.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).sub(_a); const t = clamp(_d.dot(_c) / len2, 0, 1);
      _d.addScaledVector(_c, -t); const d = _d.length(), least = 0.13 + this.rad[i];
      if (d < least && d > 1e-5) stop(i, WA, _d.divideScalar(d), least - d);
    }
    // spine: bends forward freely, back only a little
    mid(_a, P, SL, SR); const back = -((_a.x - P[WA * 3]) * this.pz.x + (_a.y - P[WA * 3 + 1]) * this.pz.y + (_a.z - P[WA * 3 + 2]) * this.pz.z + 0.09);
    if (back > 0) { stop(SL, WA, this.pz, back); stop(SR, WA, this.pz, back); }
    // neck: the head nods to the chest but tips back only a little
    axes(_a, _b, _e, P, SL, SR, WA); mid(_d, P, SL, SR);                                    // _e: out of the back of the chest
    const nod = (_d.x - P[HD * 3]) * _e.x + (_d.y - P[HD * 3 + 1]) * _e.y + (_d.z - P[HD * 3 + 2]) * _e.z;
    if (nod > this.nod1) { stop(HD, SL, _e, nod - this.nod1); stop(HD, SR, _e, nod - this.nod1); }
    else if (nod < this.nod0) { stop(SL, HD, _e, this.nod0 - nod); stop(SR, HD, _e, this.nod0 - nod); }
    for (let it = 0; it < ITER; it++) {
      for (let k = 0; k < K.length; k += 4) {
        const i = K[k] * 3, j = K[k + 1] * 3, dx = P[j] - P[i], dy = P[j + 1] - P[i + 1], dz = P[j + 2] - P[i + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const want = d < K[k + 2] ? K[k + 2] : d > K[k + 3] ? K[k + 3] : d;
        if (want === d) continue;
        const wi = W[K[k]], wj = W[K[k + 1]], f = (d - want) / d / (wi + wj);
        P[i] += dx * f * wi; P[i + 1] += dy * f * wi; P[i + 2] += dz * f * wi; P[j] -= dx * f * wj; P[j + 1] -= dy * f * wj; P[j + 2] -= dz * f * wj;
      }
      this.collide();                              // every pass: a shoulder propped on an elbow sinks through it otherwise
    }
    // at rest once nothing has got anywhere for half a second (a part trembling against a stop does not count as moving)
    this.t += STEP;
    if ((this.still += STEP) >= 0.5) {
      let far = 0; const M = this.mark;
      for (let i = 0; i < N * 3; i += 3) far = Math.max(far, (P[i] - M[i]) ** 2 + (P[i + 1] - M[i + 1]) ** 2 + (P[i + 2] - M[i + 2]) ** 2);
      if (far < 0.02 ** 2 || this.t > 6) this.asleep = true;
      M.set(P); this.still = 0;
    }
  }

  /** Pushes every particle out of the boxes around it; what it touches also slows it. */
  collide() {
    const P = this.p, O = this.o;
    let down = 0;
    for (let n = 0; n < N; n++) {
      const i = n * 3, r = this.rad[n]; let hit = false;
      for (const b of this.boxes) {
        const ly = P[i + 1] - b.cy; if (ly > b.hy + r || ly < -b.hy - r) continue;
        const dx = P[i] - b.cx, dz = P[i + 2] - b.cz, lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos;
        if (lx > b.hx + r || lx < -b.hx - r || lz > b.hz + r || lz < -b.hz - r) continue;
        let nx = lx - clamp(lx, -b.hx, b.hx), ny = ly - clamp(ly, -b.hy, b.hy), nz = lz - clamp(lz, -b.hz, b.hz), deep;
        const d2 = nx * nx + ny * ny + nz * nz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-12) { const d = Math.sqrt(d2); nx /= d; ny /= d; nz /= d; deep = r - d; }
        else {                                       // the centre is inside: out through the nearest face
          const ex = b.hx - Math.abs(lx), ey = b.hy - Math.abs(ly), ez = b.hz - Math.abs(lz);
          nx = ny = nz = 0;
          if (ey <= ex && ey <= ez) { ny = ly < 0 ? -1 : 1; deep = ey + r; } else if (ex <= ez) { nx = lx < 0 ? -1 : 1; deep = ex + r; } else { nz = lz < 0 ? -1 : 1; deep = ez + r; }
        }
        const wx = nx * b.cos + nz * b.sin, wz = -nx * b.sin + nz * b.cos;
        P[i] += wx * deep; P[i + 1] += ny * deep; P[i + 2] += wz * deep;
        // friction: the harder it is pressed on, the more of this step's sliding is taken back; what barely slides stays put
        const vx = P[i] - O[i], vy = P[i + 1] - O[i + 1], vz = P[i + 2] - O[i + 2], vn = vx * wx + vy * ny + vz * wz;
        const sx = vx - vn * wx, sy = vy - vn * ny, sz = vz - vn * wz, slide = Math.sqrt(sx * sx + sy * sy + sz * sz), k = slide < STICK ? 1 : Math.min(1, GRIP * deep / slide);
        P[i] -= sx * k; P[i + 1] -= sy * k; P[i + 2] -= sz * k; hit = true;
      }
      if (hit && n < AL) down++;                     // anything but a foot or the rifle
    }
    this.down = down;
  }

  /** Turns the skeleton and the rifle to the particles. */
  pose() {
    const P = this.d, drv = this.drv;
    this.dirty = false;
    const set = (k, D) => {
      const d = drv[k]; d.q.multiplyQuaternions(D, d.q0);
      _q2.copy(d.anc < 0 ? this.armQ : drv[d.anc].q); for (const b of d.between) _q2.multiply(b.quaternion);
      d.bone.quaternion.copy(_q2.invert()).multiply(d.q);
    };
    const swing = (out, D, was, i, j) => out.setFromUnitVectors(_a.copy(was).applyQuaternion(D), seg(_b, P, i, j).normalize()).multiply(D);
    tri(_Dp, P, HL, HR, WA).multiply(this.fp); tri(_Dc, P, SL, SR, WA).multiply(this.fc);
    set(HIPS, _Dp);
    this.bones.Hips.position.copy(mid(_a, P, HL, HR)).add(_b.copy(this.hipsOff).applyQuaternion(_Dp)).applyMatrix4(this.armInv);
    set(SPINE, _D.slerpQuaternions(_Dp, _Dc, 1 / 3)); set(SPINE1, _D.slerpQuaternions(_Dp, _Dc, 2 / 3)); set(SPINE2, _Dc);
    mid(_c, P, SL, SR).add(_d.copy(this.neckOff).applyQuaternion(_Dc));                                             // where the neck starts now
    _D.setFromUnitVectors(_a.copy(this.headDir).applyQuaternion(_Dc), _b.set(P[HD * 3], P[HD * 3 + 1], P[HD * 3 + 2]).sub(_c).normalize()).multiply(_Dc);
    set(NECK, _D2.slerpQuaternions(_Dc, _D, 0.5)); set(HEAD, _D);
    SIDES.forEach((s, k) => {
      const L = this.limb[k];
      set(ARM[k], swing(_D, _Dc, L.u, s.sh, s.el)); set(FORE[k], swing(_D2, _D, L.f, s.el, s.hand));
      set(UPLEG[k], swing(_D, _Dp, L.t, s.hip, s.knee)); set(LEG[k], swing(_D2, _D, L.s, s.knee, s.ankle)); set(FOOT[k], swing(_D3, _D2, L.ft, s.ankle, s.toe));
    });
    tri(_D, P, G0, G1, G2).multiply(this.fg);
    this.gun.quaternion.multiplyQuaternions(_D, this.gunQ);
    this.gun.position.set((P[G0 * 3] + P[G1 * 3] + P[G2 * 3]) / 3, (P[G0 * 3 + 1] + P[G1 * 3 + 1] + P[G2 * 3 + 1]) / 3, (P[G0 * 3 + 2] + P[G1 * 3 + 2] + P[G2 * 3 + 2]) / 3).add(_a.copy(this.gunOff).applyQuaternion(_D));
  }
}
