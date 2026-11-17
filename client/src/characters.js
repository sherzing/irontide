// Third-person soldiers (other players and bots): skinned, animated, interpolated from snapshots.
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { loadModel } from './levelbuild.js';
import { canvasTex } from './materials.js';

const TEAM_TINT = [new THREE.Color(0.95, 0.9, 0.8), new THREE.Color(0.62, 0.82, 1.3), new THREE.Color(1.35, 0.7, 0.6)];
const TEAM_CSS = ['#e8e2d0', '#7fb8ff', '#ff8a70'];
const lerpAngle = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };

function gunMesh() {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: 0.8, roughness: 0.5 }), t = new THREE.MeshStandardMaterial({ color: 0x6b5a44, roughness: 0.85 });
  const add = (w, h, d, x, y, z, mat = m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); b.castShadow = true; g.add(b); };
  add(0.04, 0.09, 0.4, 0, 0.03, -0.05); add(0.045, 0.05, 0.27, 0, 0.04, -0.36, t); add(0.018, 0.018, 0.2, 0, 0.04, -0.58);
  add(0.026, 0.16, 0.06, 0, -0.09, -0.1); add(0.03, 0.1, 0.04, 0, -0.06, 0.04, t); add(0.036, 0.08, 0.2, 0, 0.02, 0.24, t); add(0.03, 0.04, 0.05, 0, 0.1, -0.05);
  return g;
}

class Char {
  constructor(owner, info) {
    this.id = info.id; this.info = info; this.owner = owner;
    this.root = new THREE.Group();
    const model = this.model = skeletonClone(owner.src.scene);
    model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material.name === 'VanguardBodyMat') o.material = owner.bodyMats[info.team || 0]; }
      if (o.isBone) { if (o.name === 'mixamorigSpine1') this.spine = o; if (o.name === 'mixamorigRightHand') this.hand = o; if (o.name === 'mixamorigHead') this.head = o; }
    });
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    this.act = {};
    for (const c of owner.src.animations) { if (c.name === 'TPose') continue; const a = this.mixer.clipAction(c); a.play(); a.setEffectiveWeight(c.name === 'Idle' ? 1 : 0); this.act[c.name] = a; }
    this.w = { Idle: 1, Walk: 0, Run: 0 };
    if (this.hand) { const gun = this.gun = gunMesh(); gun.scale.setScalar(100); gun.position.set(-2, 9, 3); gun.rotation.set(1.45, 0.1, -1.5); this.hand.add(gun); }
    // name tag
    const tex = canvasTex(256, (g) => { g.clearRect(0, 0, 256, 256); g.font = '600 34px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText(info.name, 129, 141); g.fillStyle = TEAM_CSS[info.team || 0]; g.fillText(info.name, 128, 140); });
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    this.tag.scale.set(1.5, 1.5, 1); this.tag.visible = false; owner.engine.fx.add(this.tag);
    this.buf = []; this.alive = false; this.deadT = 0; this.flags = 0; this.pitch = 0; this.speed = 0;
    this.pos = new THREE.Vector3(); this.yaw = 0; this.hp = 100; this.weapon = 0;
    this.root.visible = false;
    owner.engine.scene.add(this.root);
  }
  push(t, s) {
    this.buf.push({ t, x: s[1], y: s[2], z: s[3], yaw: s[4], pitch: s[5], flags: s[6] });
    if (this.buf.length > 12) this.buf.shift();
    this.weapon = s[7]; this.hp = s[8];
    const alive = !!s[9];
    if (alive && !this.alive) { this.buf.length = 0; this.buf.push({ t, x: s[1], y: s[2], z: s[3], yaw: s[4], pitch: s[5], flags: s[6] }); this.deadT = 0; this.root.rotation.set(0, 0, 0); this.model.rotation.x = 0; this.model.position.y = 0; }
    if (!alive && this.alive) this.deadT = 0.0001;
    this.alive = alive;
  }
  update(dt, rt, showTag) {
    const b = this.buf;
    if (!b.length) { this.root.visible = false; this.tag.visible = false; return; }
    if (this.alive || this.deadT < 0.2) {
      let i = b.length - 1; while (i > 0 && b[i - 1].t > rt) i--;
      const a = b[Math.max(0, i - 1)], c = b[i];
      const k = c.t > a.t ? THREE.MathUtils.clamp((rt - a.t) / (c.t - a.t), 0, 1.25) : 1;
      const px = this.pos.x, pz = this.pos.z;
      this.pos.set(a.x + (c.x - a.x) * k, a.y + (c.y - a.y) * k, a.z + (c.z - a.z) * k);
      this.yaw = lerpAngle(a.yaw, c.yaw, Math.min(1, k)); this.pitch = a.pitch + (c.pitch - a.pitch) * Math.min(1, k); this.flags = c.flags;
      const sp = Math.hypot(this.pos.x - px, this.pos.z - pz) / Math.max(dt, 1e-3);
      this.speed += (Math.min(sp, 9) - this.speed) * Math.min(1, dt * 8);
    }
    this.root.visible = this.alive || this.deadT < 6;
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    const crouch = this.flags & 1;
    this.root.scale.y += ((crouch ? 0.74 : 1) - this.root.scale.y) * Math.min(1, dt * 12);
    // locomotion blend
    const s = this.alive ? this.speed : 0;
    const tw = { Idle: s < 0.4 ? 1 : 0, Walk: s >= 0.4 && s < 3.4 ? 1 : 0, Run: s >= 3.4 ? 1 : 0 };
    for (const k of ['Idle', 'Walk', 'Run']) { this.w[k] += (tw[k] - this.w[k]) * Math.min(1, dt * 9); this.act[k]?.setEffectiveWeight(this.w[k]); }
    if (this.act.Walk) this.act.Walk.timeScale = THREE.MathUtils.clamp(s / 1.7, 0.6, 1.8);
    if (this.act.Run) this.act.Run.timeScale = THREE.MathUtils.clamp(s / 4.2, 0.8, 1.5);
    if (this.alive) this.mixer.update(dt);
    if (this.spine && this.alive) this.spine.rotation.x += -this.pitch * 0.7;
    if (!this.alive && this.deadT > 0) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 0.55), e = 1 - (1 - k) * (1 - k);
      this.model.rotation.x = -e * Math.PI / 2 * 0.97; this.model.position.y = e * 0.22;
      if (this.deadT > 5) this.model.position.y = 0.22 - (this.deadT - 5) * 0.4;
    }
    this.tag.visible = showTag && this.alive;
    if (this.tag.visible) this.tag.position.set(this.pos.x, this.pos.y + (crouch ? 1.75 : 2.2), this.pos.z);
  }
  dispose() { this.owner.engine.scene.remove(this.root); this.owner.engine.fx.remove(this.tag); this.tag.material.map.dispose(); this.tag.material.dispose(); }
}

export class Characters {
  constructor(engine) { this.engine = engine; this.map = new Map(); }
  async load() {
    this.src = await loadModel('Soldier.glb');
    let body = null;
    this.src.scene.traverse((o) => { if (o.isMesh && o.material.name === 'VanguardBodyMat') body = o.material; });
    this.bodyMats = TEAM_TINT.map((c) => { const m = body.clone(); m.name = 'VanguardBodyMat'; m.color.copy(c); return m; });
  }
  add(info) { this.remove(info.id); const c = new Char(this, info); this.map.set(info.id, c); return c; }
  remove(id) { const c = this.map.get(id); if (c) { c.dispose(); this.map.delete(id); } }
  clear() { for (const id of [...this.map.keys()]) this.remove(id); }
  get(id) { return this.map.get(id); }
  update(dt, rt, myTeam) { for (const c of this.map.values()) c.update(dt, rt, myTeam !== 0 && c.info.team === myTeam); }
}
