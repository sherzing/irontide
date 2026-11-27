// Third-person soldiers (other players and bots): skinned, animated, interpolated from snapshots, and a ragdoll
// once they are killed.
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadModel } from './levelbuild.js';
import { canvasTex } from './materials.js';
import { Ragdoll, SHOVE } from './ragdoll.js';
import { raySphere, rayCapsule, CROUCH_SCALE, LEAN, leanOf, SLIDE, SLIDING } from '../../shared/collision.js';
import { CREWS } from '../../shared/crews.js';
import { repaint, kitFor, hang } from './crewkit.js';

const TEAM_CSS = ['#e8e2d0', '#7fb8ff', '#ff8a70'];
const _view = new THREE.Matrix4(), _frustum = new THREE.Frustum(), _sphere = new THREE.Sphere(new THREE.Vector3(), 3);
/**
 * What a player's shot can hit: the soldier as he is drawn. Capsules between his joints, [from, to, radius in metres, zone],
 * and a ball round his head. Arms count as legs. Judge a change with `node scripts/aim-lab.mjs volumes out.jpg`.
 */
const HIT = [
  ['Hips', 'Spine2', 0.18, 'body'], ['Spine2', 'Neck', 0.15, 'body'], ['LeftArm', 'RightArm', 0.135, 'body'], ['LeftUpLeg', 'RightUpLeg', 0.14, 'body'],
  ['LeftArm', 'LeftForeArm', 0.085, 'legs'], ['LeftForeArm', 'LeftHand', 0.07, 'legs'], ['LeftHand', 'LeftHandMiddle1', 0.06, 'legs'],
  ['RightArm', 'RightForeArm', 0.085, 'legs'], ['RightForeArm', 'RightHand', 0.07, 'legs'], ['RightHand', 'RightHandMiddle1', 0.06, 'legs'],
  ['LeftUpLeg', 'LeftLeg', 0.115, 'legs'], ['LeftLeg', 'LeftFoot', 0.09, 'legs'], ['LeftFoot', 'LeftToeBase', 0.075, 'legs'],
  ['RightUpLeg', 'RightLeg', 0.115, 'legs'], ['RightLeg', 'RightFoot', 0.09, 'legs'], ['RightFoot', 'RightToeBase', 0.075, 'legs'],
];
const HEAD = [0, 10, 1.5], HEAD_R = 0.125;      // the head's middle in the Head bone's own frame (centimetres), and its radius in metres
const _head = new THREE.Vector3();
/**
 * A full lean (Q and E), on top of whatever the soldier is doing: the pelvis tilts, each of the three spine joints bends and
 * the neck gives some of it back (degrees). Then the legs slant, feet where they were, until the head is LEAN.reach to the
 * side: where the leaning player's view is. `node scripts/aim-lab.mjs lean out.jpg` shows the pose and checks the head.
 */
export const LEAN_POSE = { pelvis: 6, spine: 9, neck: 12 };
/**
 * A slide (a crouch pressed in a sprint), in place of the stride: the soldier sits back on the floor, one leg out ahead
 * and the other knee up, rifle level. Degrees, each joint on top of the one before; a positive angle tips the top of a
 * joint back and swings what hangs below it ahead. hips: the pelvis; spine: each of the three spine joints; neck: the
 * neck and again the head; arms: each shoulder; lead, tuck: thigh and knee of the leg out ahead and of the one drawn up.
 * Then the hips go where that puts his head at the sliding player's view, SLIDE.eye over his feet:
 * `node scripts/aim-lab.mjs slide out.jpg` shows the pose and checks the head.
 */
export const SLIDE_POSE = { hips: 50, spine: -10, neck: -8, arms: -20, lead: [5, 16], tuck: [86, -84] };
const LEG = 0.8, HIPS_MOST = 0.3;                // hip joint to ankle, and the furthest the hips go to the side, metres
const FWD = new THREE.Vector3(0, 0, -1), RIGHT = new THREE.Vector3(1, 0, 0), RAD = Math.PI / 180;
const _turn = new THREE.Quaternion(), _inv = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _qd = new THREE.Quaternion(), _qe = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
/** Turns a bone by `angle` round `axis` of the soldier's own frame (the way he faces, unless given). parent: how the bone's parent is turned in that frame; `out` gets the same for the bone. */
function turn(bone, parent, angle, out, axis = FWD) {
  _turn.setFromAxisAngle(axis, angle); _inv.copy(parent).invert();
  bone.quaternion.premultiply(parent).premultiply(_turn).premultiply(_inv);
  return out.multiplyQuaternions(parent, bone.quaternion);
}
const LINGER = 12, SINK = 1.6, MAX_LYING = 10;      // seconds a body lies, seconds it takes to sink away, bodies left lying at once
const lerpAngle = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };

// The third-person rifle: built once and shared by every soldier, merged into one mesh per material
// (a full match is 63 of them, drawn again in the shadow and reflection passes).
function gunParts() {
  const metal = [], furniture = [];
  const add = (w, h, d, x, y, z, list = metal) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); list.push(g); };
  add(0.04, 0.09, 0.4, 0, 0.03, -0.05); add(0.045, 0.05, 0.27, 0, 0.04, -0.36, furniture); add(0.018, 0.018, 0.2, 0, 0.04, -0.58);
  add(0.026, 0.16, 0.06, 0, -0.09, -0.1); add(0.03, 0.1, 0.04, 0, -0.06, 0.04, furniture); add(0.036, 0.08, 0.2, 0, 0.02, 0.24, furniture); add(0.03, 0.04, 0.05, 0, 0.1, -0.05);
  return [[mergeGeometries(metal), new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: 0.8, roughness: 0.5 })],
    [mergeGeometries(furniture), new THREE.MeshStandardMaterial({ color: 0x6b5a44, roughness: 0.85 })]];
}
function gunMesh(parts) {
  const g = new THREE.Group();
  for (const [geo, mat] of parts) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); }
  return g;
}

/**
 * One soldier model: skeleton, animations, rifle and ragdoll. A Char wears one while it lives. Killed, the body
 * falls where it stood and is left lying; the Char takes another one when it comes back.
 */
class Body {
  constructor(owner) {
    this.owner = owner;
    this.root = new THREE.Group(); this.loose = new THREE.Group();      // loose: what has left the body (the dropped rifle), in world space
    const model = skeletonClone(owner.src.scene), bones = this.bones = {};
    this.skin = []; this.visors = []; this.meshes = []; this.kit = []; this.crew = null;
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; if (o.material.name === 'VanguardBodyMat') this.skin.push(o); else this.visors.push(o);
        const b = owner.bounds.get(o.name); o.frustumCulled = !!b; if (b) { o.boundingSphere = b.clone(); this.meshes.push(o); }      // skinned meshes need their bounds given (see load)
      }
      if (o.isBone) bones[o.name.replace('mixamorig', '')] = o;
    });
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    this.act = {};
    for (const c of owner.src.animations) { if (c.name === 'TPose') continue; const a = this.mixer.clipAction(c); a.play(); this.act[c.name] = a; }
    this.gun = gunMesh(owner.gun);
    this.pose0 = Object.values(bones).map((b) => [b, b.position.clone(), b.quaternion.clone()]);
    this.rag = new Ragdoll(bones, this.gun);
    // the frame the hips are placed in, seen from the soldier's own (x his right, y up, -z ahead): how it is turned, and how many of its units make a metre
    model.updateMatrixWorld(true); this.frame = new THREE.Quaternion(); bones.Hips.parent.matrixWorld.decompose(_v, this.frame, _s); this.units = 1 / _s.x;
    this.bent = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot'].map((n) => ({ bone: bones[n], q: new THREE.Quaternion(), p: new THREE.Vector3() }));      // what lean() and slide() move
    this.column = ['Head', 'Neck', 'Spine2', 'Spine1', 'Spine', 'Hips'].map((n) => bones[n]); this.frameAt = _v.clone();
    this.leant = false;
  }
  /** Where the middle of the soldier's head is in his own frame, metres: x to his right, y up from his feet, -z ahead. Worked out from the joints, which each turn and place the next. */
  headAt(out) {
    out.fromArray(HEAD);
    for (const bone of this.column) out.applyQuaternion(bone.quaternion).add(bone.position);
    return out.applyQuaternion(this.frame).divideScalar(this.units).add(this.frameAt);
  }
  /** How far to his right the middle of his head is, metres. */
  headSide() { return this.headAt(_v).x; }
  /** Sits the pose the mixer wrote down into a slide: k from 0 (not at all) to 1. See SLIDE_POSE. */
  slide(k) {
    for (const s of this.bent) { s.q.copy(s.bone.quaternion); s.p.copy(s.bone.position); }
    this.leant = true;
    const b = this.bones, P = SLIDE_POSE, a = (deg) => deg * RAD * k;
    const hips = turn(b.Hips, this.frame, a(P.hips), _qa, RIGHT);
    const chest = turn(b.Spine2, turn(b.Spine1, turn(b.Spine, hips, a(P.spine), _qb, RIGHT), a(P.spine), _qc, RIGHT), a(P.spine), _qe, RIGHT);
    turn(b.Head, turn(b.Neck, chest, a(P.neck), _qb, RIGHT), a(P.neck), _qc, RIGHT);
    for (const side of ['Left', 'Right']) {
      turn(b[side + 'Shoulder'], chest, a(P.arms), _qb, RIGHT);
      const [thigh, knee] = side === 'Left' ? P.lead : P.tuck;
      turn(b[side + 'Leg'], turn(b[side + 'UpLeg'], hips, a(thigh), _qb, RIGHT), a(knee), _qc, RIGHT);
    }
    const head = this.headAt(_v);                             // the hips go where his head then is at the sliding view
    b.Hips.position.add(_s.set(0, (SLIDE.eye - head.y) * k, -head.z * k).applyQuaternion(_inv.copy(this.frame).invert()).multiplyScalar(this.units));
  }
  /** Leans the pose the mixer wrote: k from -1 (all the way left) to 1 (right). See LEAN_POSE. */
  lean(k) {
    for (const s of this.bent) { s.q.copy(s.bone.quaternion); s.p.copy(s.bone.position); }
    this.leant = true;
    const b = this.bones, P = LEAN_POSE, pelvis = P.pelvis * RAD * k, spine = P.spine * RAD * k, was = this.headSide();
    const hips = turn(b.Hips, this.frame, pelvis, _qa);
    turn(b.Neck, turn(b.Spine2, turn(b.Spine1, turn(b.Spine, hips, spine, _qb), spine, _qc), spine, _qb), -P.neck * RAD * k, _qc);
    // what the bending leaves of the way, the hips go: at a full lean the head is LEAN.reach from the feet, whatever the stride does to it
    const a = Math.abs(k), go = THREE.MathUtils.clamp(k * LEAN.reach + was * (1 - a) - this.headSide(), -HIPS_MOST * a, HIPS_MOST * a), slant = Math.asin(go / LEG);
    b.Hips.position.add(_v.set(go, LEG * (Math.cos(slant) - 1), 0).applyQuaternion(_inv.copy(this.frame).invert()).multiplyScalar(this.units));
    for (const side of ['Left', 'Right']) {                   // the legs slant back to where the feet stood, and the feet stay flat
      const leg = turn(b[side + 'UpLeg'], hips, slant - pelvis, _qb);
      turn(b[side + 'Foot'], _qc.multiplyQuaternions(leg, b[side + 'Leg'].quaternion), -slant, _qd);
    }
  }
  /** Takes the lean or the slide back out. The mixer writes a bone only when its animation moved it on, so a pose left in would add up. */
  unlean() {
    if (!this.leant) return;
    for (const s of this.bent) { s.bone.quaternion.copy(s.q); s.bone.position.copy(s.p); }
    this.leant = false;
  }
  /** Made ready for a living soldier of this team, in this crew's colours and kit. */
  wear(team, crew) {
    const look = this.owner.look(crew, team);
    for (const m of this.skin) m.material = look.body;
    for (const m of this.visors) m.material = look.visor;
    if (this.crew !== look.id) { for (const k of this.kit) k.removeFromParent(); this.kit = look.kit.map(([bone, geo]) => hang(this.bones[bone], geo)); this.crew = look.id; }
    for (const m of this.meshes) m.boundingSphere.radius = this.owner.reach;
    for (const [b, p, q] of this.pose0) { b.position.copy(p); b.quaternion.copy(q); }
    const g = this.gun; this.bones.RightHand.add(g); g.scale.setScalar(100); g.position.set(-2, 9, 3); g.rotation.set(1.45, 0.1, -1.5);
    this.w = { Idle: 1, Walk: 0, Run: 0 }; for (const k in this.act) this.act[k].setEffectiveWeight(this.w[k]);
    this.dead = false; this.deadT = 0; this.animT = 0; this.leant = false;
    this.root.scale.set(1, 1, 1); this.loose.position.y = 0; this.root.visible = this.loose.visible = false;
    this.owner.engine.scene.add(this.root, this.loose);
  }
  /** Put away until the next soldier needs one. */
  stow() { this.root.removeFromParent(); this.loose.removeFromParent(); }
  /** Killed where it stands. hit: { vx, vz, dir, power, head } as Ragdoll.start takes them. */
  die(hit) {
    const root = this.root, squash = root.scale.y;
    root.scale.set(1, 1, 1); root.updateMatrixWorld(true);
    this.rag.start({ world: this.owner.world, floor: root.position.y, squash, ...hit });
    this.loose.attach(this.gun);                                        // the rifle leaves the hand
    for (const m of this.meshes) m.boundingSphere.radius = this.owner.reach * 2.4;      // a body ends up to one body length from where it stood
    this.dead = true; this.deadT = 0; this.y0 = root.position.y;
  }
  /** A dead body's frame. Returns true once it has sunk away. */
  fall(dt, coarse, tick) {
    const rag = this.rag, over = (this.deadT += dt) - LINGER;
    if (over > 0) rag.asleep = true;
    rag.step(dt);
    if (rag.dirty && (!coarse || tick)) rag.pose();
    const sunk = Math.max(0, over) * 0.3;
    this.root.position.y = this.y0 - sunk; this.loose.position.y = -sunk;
    const done = rag.gone || over > SINK;
    this.root.visible = this.loose.visible = !done;
    return done;
  }
}

class Char {
  constructor(owner, info) {
    this.id = info.id; this.info = info; this.owner = owner;
    this.body = owner.takeBody(info.team, info.crew);
    // name tag
    const tex = canvasTex(256, (g) => { g.clearRect(0, 0, 256, 256); g.font = '600 34px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText(info.name, 129, 141); g.fillStyle = TEAM_CSS[info.team || 0]; g.fillText(info.name, 128, 140); });
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    this.tag.scale.set(1.5, 1.5, 1); this.tag.visible = false; owner.engine.fx.add(this.tag);
    this.buf = []; this.alive = false; this.flags = 0; this.pitch = 0; this.lean = 0; this.slide = 0; this.speed = 0; this.vx = 0; this.vz = 0; this.placed = false;
    this.pos = new THREE.Vector3(); this.yaw = 0; this.hp = 100; this.weapon = 0;
  }
  push(t, s) {
    this.buf.push({ t, x: s[1], y: s[2], z: s[3], yaw: s[4], pitch: s[5], flags: s[6] });
    if (this.buf.length > 12) this.buf.shift();
    this.weapon = s[7]; this.hp = s[8];
    const alive = !!s[9];
    if (alive && !this.alive) {                                         // back in: the body it died in stays where it fell
      this.buf.length = 0; this.buf.push({ t, x: s[1], y: s[2], z: s[3], yaw: s[4], pitch: s[5], flags: s[6] }); this.placed = false;
      if (this.body.dead) { this.owner.leave(this.body); this.body = this.owner.takeBody(this.info.team, this.info.crew); }
    }
    if (!alive && this.alive) this.die();
    this.alive = alive;
  }
  /** A ray (o, unit d) against the soldier as he stands on the screen: { t, zone } for the nearest hit within maxT, or null. */
  hit(o, d, maxT) {
    const p = this.pos, body = this.body, tall = body.root.scale.y;
    const near = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, p.x, p.y + 0.9 * tall, p.z, 1.25 + this.slide * 0.3);      // a slider's legs reach further
    if (near < 0 || near > maxT) return null;                                    // not even near him
    body.root.updateMatrixWorld(true);
    const b = body.bones;
    _head.fromArray(HEAD).applyMatrix4(b.Head.matrixWorld);
    let t = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, _head.x, _head.y, _head.z, HEAD_R);
    if (t >= 0 && t < maxT) return { t, zone: 'head' };                          // through the head is a head shot, whatever else is in line
    let best = maxT, zone = null;
    for (const [from, to, r, z] of HIT) {
      const A = b[from].matrixWorld.elements, B = b[to].matrixWorld.elements;
      t = rayCapsule(o.x, o.y, o.z, d.x, d.y, d.z, A[12], A[13], A[14], B[12], B[13], B[14], r);
      if (t >= 0 && t < best) { best = t; zone = z; }
    }
    return zone ? { t: best, zone } : null;
  }
  /** Killed. from: where the shot came from ({x, z}) when somebody fired one; weapon: its id; head: a head shot. */
  die(from, weapon, head) {
    if (!this.alive || this.body.dead) return;
    this.alive = false;
    let dir = null;
    if (from) { const dx = this.pos.x - from.x, dz = this.pos.z - from.z, l = Math.hypot(dx, dz) || 1; dir = [dx / l, 0.1, dz / l]; }
    this.body.die({ vx: this.vx, vz: this.vz, dir, power: SHOVE[weapon] || 0, head: !!head });
  }
  /** coarse: out of view or far away — the pose is then only refreshed on `tick` frames. */
  update(dt, rt, showTag, coarse = false, tick = true) {
    const b = this.buf, body = this.body;
    this.tag.visible = false;
    if (body.dead) { body.fall(dt, coarse, tick); return; }
    if (!b.length || !this.alive) { body.root.visible = false; return; }
    let i = b.length - 1; while (i > 0 && b[i - 1].t > rt) i--;
    const a = b[Math.max(0, i - 1)], c = b[i];
    const k = c.t > a.t ? THREE.MathUtils.clamp((rt - a.t) / (c.t - a.t), 0, 1.25) : 1;
    const px = this.pos.x, pz = this.pos.z;
    this.pos.set(a.x + (c.x - a.x) * k, a.y + (c.y - a.y) * k, a.z + (c.z - a.z) * k);
    this.yaw = lerpAngle(a.yaw, c.yaw, Math.min(1, k)); this.pitch = a.pitch + (c.pitch - a.pitch) * Math.min(1, k); this.flags = c.flags;
    if (!this.placed) { this.placed = true; this.speed = this.vx = this.vz = 0; this.lean = leanOf(this.flags); this.slide = 0; }      // just put down somewhere: that was not a movement
    else {
      const inv = 1 / Math.max(dt, 1e-3), ease = Math.min(1, dt * 8), vx = (this.pos.x - px) * inv, vz = (this.pos.z - pz) * inv;
      this.speed += (Math.min(Math.hypot(vx, vz), 9) - this.speed) * ease; this.vx += (vx - this.vx) * ease; this.vz += (vz - this.vz) * ease;
    }
    const root = body.root;
    root.visible = true; root.position.copy(this.pos); root.rotation.y = this.yaw;
    const crouch = this.flags & 1, sliding = this.flags & SLIDING ? 1 : 0;
    this.slide += (sliding - this.slide) * Math.min(1, dt * (sliding ? 14 : 9));
    root.scale.y += ((crouch && !sliding ? CROUCH_SCALE : 1) - root.scale.y) * Math.min(1, dt * 12);      // a slide is a pose of its own (SLIDE_POSE), not a squashed stride
    // locomotion blend
    const s = sliding ? 0 : this.speed, w = body.w, act = body.act;
    const tw = { Idle: s < 0.4 ? 1 : 0, Walk: s >= 0.4 && s < 3.4 ? 1 : 0, Run: s >= 3.4 ? 1 : 0 };
    for (const n of ['Idle', 'Walk', 'Run']) { w[n] += (tw[n] - w[n]) * Math.min(1, dt * 9); act[n]?.setEffectiveWeight(w[n]); }
    if (act.Walk) act.Walk.timeScale = THREE.MathUtils.clamp(s / 1.7, 0.6, 1.8);
    if (act.Run) act.Run.timeScale = THREE.MathUtils.clamp(s / 4.2, 0.8, 1.5);
    body.animT += dt;
    this.lean += (leanOf(this.flags) - this.lean) * Math.min(1, dt * 16);
    if (!coarse || tick) {
      body.unlean();
      body.mixer.update(body.animT); body.animT = 0;
      body.bones.Spine1.rotation.x += -this.pitch * 0.7;               // on top of the pose the mixer just wrote
      if (Math.abs(this.lean) > 0.01) body.lean(this.lean); else if (this.slide > 0.01) body.slide(this.slide);      // a slider does not lean
    }
    this.tag.visible = showTag;
    if (showTag) { const side = this.lean * LEAN.reach; this.tag.position.set(this.pos.x + Math.cos(this.yaw) * side, this.pos.y + (crouch ? 1.75 : 2.2), this.pos.z - Math.sin(this.yaw) * side); }      // over his head, also when he leans
  }
  dispose() {
    this.owner.engine.fx.remove(this.tag); this.tag.material.map.dispose(); this.tag.material.dispose();
    if (this.body.dead) this.owner.leave(this.body); else this.owner.store(this.body);
  }
}

export class Characters {
  constructor(engine) { this.engine = engine; this.map = new Map(); this.lying = []; this.spare = []; this.world = null; }      // world: the collision World bodies fall in, set by the game
  async load() {
    this.src = await loadModel('Soldier.glb');
    // Bounds for frustum culling: a skinned mesh's geometry bounds are those of the bind pose in bone space, so take
    // them from the posed model once and pad them for the animations. Soldiers behind the camera are then skipped.
    // Every part (body, visor) uses the body's sphere: a small part's own sphere would not follow the animation.
    this.bounds = new Map(); this.src.scene.updateMatrixWorld(true); let sphere = null;
    this.src.scene.traverse((o) => { if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingSphere(); if (!sphere || o.boundingSphere.radius > sphere.radius) sphere = o.boundingSphere.clone(); o.boundingSphere = null; } });
    if (sphere) { sphere.radius *= 1.5; this.src.scene.traverse((o) => { if (o.isSkinnedMesh) this.bounds.set(o.name, sphere); }); }
    this.reach = sphere ? sphere.radius : 0;
    this.gun = gunParts();
    this.looks = new Map();
    this.src.scene.traverse((o) => { if (o.isMesh) this[o.material.name === 'VanguardBodyMat' ? 'bodyMat' : 'visorMat'] = o.material; });
    // One soldier stands in the scene unseen and for good: a level's shader warm-up (Engine.precompile) compiles what is in
    // the scene, and without him the soldiers' programs would be compiled when the first of them appears in a match.
    const crew = Object.keys(CREWS)[0]; this.takeBody(CREWS[crew].side, crew);
  }
  /** A crew's materials and kit, made the first time someone wears it. An id this build does not know gets the side's first crew. */
  look(id, team) {
    if (!CREWS[id]) id = team === 2 ? 'wreckers' : 'watch';
    let L = this.looks.get(id);
    if (L) return L;
    const crew = CREWS[id], src = this.bodyMat.map, map = new THREE.CanvasTexture(repaint(src.image, crew));
    map.flipY = src.flipY; map.colorSpace = src.colorSpace; map.wrapS = src.wrapS; map.wrapT = src.wrapT; map.channel = src.channel; map.anisotropy = 4;
    const body = this.bodyMat.clone(); body.name = 'VanguardBodyMat'; body.map = map;
    const visor = this.visorMat.clone(); visor.map = null; visor.color.set(crew.visor).multiplyScalar(0.55); visor.emissive.set(crew.visor); visor.emissiveIntensity = 0.35; visor.roughness = 0.25; visor.metalness = 0.6;
    this.looks.set(id, L = { id, body, visor, kit: kitFor(crew) });
    return L;
  }
  /**
   * A soldier on a turntable for the menu, drawn into `canvas` by a renderer of its own.
   * show(crew) dresses him, frame(dt) turns and draws him, face(a) sets the angle (0 = facing the viewer).
   */
  preview(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(24, 1, 0.1, 30), body = new Body(this);
    scene.add(new THREE.HemisphereLight(0xe8f0f8, 0x565c66, 2.4));
    for (const [c, k, x, y, z] of [[0xfff2e0, 3.4, 2.5, 3.5, 4], [0x9fc6ff, 2.4, -3, 2.5, -3.5]]) { const l = new THREE.DirectionalLight(c, k); l.position.set(x, y, z); scene.add(l); }
    cam.position.set(0, 1.05, 5.0); cam.lookAt(0, 0.93, 0);
    let turn = 0.45, w = 0, h = 0;
    return {
      show: (crew) => { body.wear(CREWS[crew]?.side, crew); scene.add(body.root); body.root.visible = true; },
      face: (a) => { turn = a; },
      frame: (dt, spin = 0.6) => {
        if (canvas.clientWidth && (canvas.clientWidth !== w || canvas.clientHeight !== h)) { w = canvas.clientWidth; h = canvas.clientHeight; r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
        turn += dt * spin; body.root.rotation.y = turn + Math.PI; body.mixer.update(dt); r.render(scene, cam);      // the model looks along -z: turned round, he faces the camera
      },
    };
  }
  takeBody(team, crew) { const b = this.spare.pop() || new Body(this); b.wear(team, crew); return b; }
  store(body) { body.stow(); this.spare.push(body); }
  /** A dead body its soldier has moved on from. It lies for LINGER seconds; only the newest MAX_LYING stay, older ones sink away at once. */
  leave(body) {
    this.lying.push(body);
    let n = 0; for (let i = this.lying.length - 1; i >= 0; i--) { const b = this.lying[i]; if (b.deadT < LINGER && ++n > MAX_LYING) b.deadT = LINGER; }
  }
  add(info) { this.remove(info.id); const c = new Char(this, info); this.map.set(info.id, c); return c; }
  remove(id) { const c = this.map.get(id); if (c) { c.dispose(); this.map.delete(id); } }
  clear() { for (const id of [...this.map.keys()]) this.remove(id); for (const b of this.lying) this.store(b); this.lying.length = 0; }
  get(id) { return this.map.get(id); }
  update(dt, rt, myTeam) {
    const cam = this.engine.camera, frame = this.frame = (this.frame || 0) + 1;
    _view.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); _frustum.setFromProjectionMatrix(_view);
    const coarse = (p) => { _sphere.center.set(p.x, p.y + 0.9, p.z); return !_frustum.intersectsSphere(_sphere) || p.distanceToSquared(cam.position) > 60 * 60; };
    for (const c of this.map.values()) c.update(dt, rt, myTeam !== 0 && c.info.team === myTeam, coarse(c.pos), (frame + c.id) % 3 === 0);
    for (let i = this.lying.length - 1; i >= 0; i--) {
      const b = this.lying[i];
      if (b.fall(dt, coarse(b.root.position), (frame + i) % 3 === 0)) { this.store(b); this.lying.splice(i, 1); }
    }
  }
}
