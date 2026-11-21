// Third-person soldiers (other players and bots): skinned, animated, interpolated from snapshots, and a ragdoll
// once they are killed.
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadModel } from './levelbuild.js';
import { canvasTex } from './materials.js';
import { Ragdoll, SHOVE } from './ragdoll.js';

const TEAM_TINT = [new THREE.Color(0.95, 0.9, 0.8), new THREE.Color(0.62, 0.82, 1.3), new THREE.Color(1.35, 0.7, 0.6)];
const TEAM_CSS = ['#e8e2d0', '#7fb8ff', '#ff8a70'];
const _view = new THREE.Matrix4(), _frustum = new THREE.Frustum(), _sphere = new THREE.Sphere(new THREE.Vector3(), 3);
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
    this.skin = []; this.meshes = [];
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; if (o.material.name === 'VanguardBodyMat') this.skin.push(o);
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
  }
  /** Made ready for a living soldier of this team. */
  wear(team) {
    for (const m of this.skin) m.material = this.owner.bodyMats[team || 0];
    for (const m of this.meshes) m.boundingSphere.radius = this.owner.reach;
    for (const [b, p, q] of this.pose0) { b.position.copy(p); b.quaternion.copy(q); }
    const g = this.gun; this.bones.RightHand.add(g); g.scale.setScalar(100); g.position.set(-2, 9, 3); g.rotation.set(1.45, 0.1, -1.5);
    this.w = { Idle: 1, Walk: 0, Run: 0 }; for (const k in this.act) this.act[k].setEffectiveWeight(this.w[k]);
    this.dead = false; this.deadT = 0; this.animT = 0;
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
    this.body = owner.takeBody(info.team);
    // name tag
    const tex = canvasTex(256, (g) => { g.clearRect(0, 0, 256, 256); g.font = '600 34px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText(info.name, 129, 141); g.fillStyle = TEAM_CSS[info.team || 0]; g.fillText(info.name, 128, 140); });
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    this.tag.scale.set(1.5, 1.5, 1); this.tag.visible = false; owner.engine.fx.add(this.tag);
    this.buf = []; this.alive = false; this.flags = 0; this.pitch = 0; this.speed = 0; this.vx = 0; this.vz = 0; this.placed = false;
    this.pos = new THREE.Vector3(); this.yaw = 0; this.hp = 100; this.weapon = 0;
  }
  push(t, s) {
    this.buf.push({ t, x: s[1], y: s[2], z: s[3], yaw: s[4], pitch: s[5], flags: s[6] });
    if (this.buf.length > 12) this.buf.shift();
    this.weapon = s[7]; this.hp = s[8];
    const alive = !!s[9];
    if (alive && !this.alive) {                                         // back in: the body it died in stays where it fell
      this.buf.length = 0; this.buf.push({ t, x: s[1], y: s[2], z: s[3], yaw: s[4], pitch: s[5], flags: s[6] }); this.placed = false;
      if (this.body.dead) { this.owner.leave(this.body); this.body = this.owner.takeBody(this.info.team); }
    }
    if (!alive && this.alive) this.die();
    this.alive = alive;
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
    if (!this.placed) { this.placed = true; this.speed = this.vx = this.vz = 0; }      // just put down somewhere: that was not a movement
    else {
      const inv = 1 / Math.max(dt, 1e-3), ease = Math.min(1, dt * 8), vx = (this.pos.x - px) * inv, vz = (this.pos.z - pz) * inv;
      this.speed += (Math.min(Math.hypot(vx, vz), 9) - this.speed) * ease; this.vx += (vx - this.vx) * ease; this.vz += (vz - this.vz) * ease;
    }
    const root = body.root;
    root.visible = true; root.position.copy(this.pos); root.rotation.y = this.yaw;
    const crouch = this.flags & 1;
    root.scale.y += ((crouch ? 0.74 : 1) - root.scale.y) * Math.min(1, dt * 12);
    // locomotion blend
    const s = this.speed, w = body.w, act = body.act;
    const tw = { Idle: s < 0.4 ? 1 : 0, Walk: s >= 0.4 && s < 3.4 ? 1 : 0, Run: s >= 3.4 ? 1 : 0 };
    for (const n of ['Idle', 'Walk', 'Run']) { w[n] += (tw[n] - w[n]) * Math.min(1, dt * 9); act[n]?.setEffectiveWeight(w[n]); }
    if (act.Walk) act.Walk.timeScale = THREE.MathUtils.clamp(s / 1.7, 0.6, 1.8);
    if (act.Run) act.Run.timeScale = THREE.MathUtils.clamp(s / 4.2, 0.8, 1.5);
    body.animT += dt;
    if (!coarse || tick) {
      body.mixer.update(body.animT); body.animT = 0;
      body.bones.Spine1.rotation.x += -this.pitch * 0.7;               // on top of the pose the mixer just wrote
    }
    this.tag.visible = showTag;
    if (showTag) this.tag.position.set(this.pos.x, this.pos.y + (crouch ? 1.75 : 2.2), this.pos.z);
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
    let body = null;
    this.src.scene.traverse((o) => { if (o.isMesh && o.material.name === 'VanguardBodyMat') body = o.material; });
    this.bodyMats = TEAM_TINT.map((c) => { const m = body.clone(); m.name = 'VanguardBodyMat'; m.color.copy(c); return m; });
  }
  takeBody(team) { const b = this.spare.pop() || new Body(this); b.wear(team); return b; }
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
