// First-person weapons. A procedurally modelled carbine plus two photoscanned guns, held by a skinned pair of
// gloved hands (an anatomical hand rig dressed as tactical gloves, see vmkit.js), and animated in layers: aim / sway / bob / sprint / draw springs underneath, and authored
// keyframe clips (reload, bolt cycle) on top that move the weapon, both hands, magazines and bolts.
import * as THREE from 'three';
import { loadModel } from './levelbuild.js';
import { WEAPONS } from '../../shared/weapons.js';
import { Spring, damp, makeTrack, evalTrack, makeTextures, pbrMaterial, vmProject, VM_SCALE, VM_RIM, makeHand, loadHandAsset, gripPose } from './vmkit.js';
import { G } from './globals.js';
import { buildCarbine, CARBINE_DIM } from './vmcarbine.js';

const VM_FOV = 58;                         // the weapon is always projected with this vertical FOV, whatever the world FOV is
const H = Math.PI / 2;

// ------------------------------------------------------------------------------------------- finger poses
// 5 digits (thumb, index, middle, ring, little) × [curl at knuckle, middle joint, tip joint, spread]
const FP = {
  relax: [0.25, 0.25, 0.2, 0, 0.35, 0.45, 0.3, 0, 0.4, 0.5, 0.3, 0, 0.45, 0.55, 0.35, 0, 0.5, 0.55, 0.35, 0],
  flat: [0.1, 0.1, 0.05, -0.2, 0.06, 0.1, 0.05, 0.04, 0.05, 0.08, 0.05, 0, 0.06, 0.1, 0.05, -0.03, 0.1, 0.12, 0.08, -0.08],
  // firing hand on a pistol grip: index along the trigger, the rest wrapped
  grip: [0.35, 0.3, 0.3, -0.45, 0.45, 0.75, 0.4, 0.04, 0.8, 1.5, 0.75, 0, 0.85, 1.52, 0.75, 0, 0.92, 1.5, 0.75, 0],
  // support hand cupping a handguard from below
  guard: [0.35, 0.2, 0.3, -0.25, 1.05, 1.0, 0.55, 0.03, 1.1, 1.05, 0.55, 0, 1.12, 1.05, 0.55, -0.02, 1.15, 1.0, 0.5, -0.05],
  // holding a rifle magazine
  mag: [0.7, 0.35, 0.3, 0.1, 1.15, 1.2, 0.6, 0, 1.2, 1.25, 0.6, 0, 1.2, 1.25, 0.6, 0, 1.2, 1.2, 0.6, 0],
  hook: [0.3, 0.25, 0.2, -0.1, 0.55, 1.2, 0.8, 0, 0.6, 1.25, 0.8, 0, 1.2, 1.4, 0.7, 0, 1.3, 1.4, 0.7, 0],
  pinch: [0.85, 0.5, 0.45, 0.2, 0.85, 1.0, 0.5, 0, 0.95, 1.05, 0.5, 0, 1.3, 1.4, 0.6, 0, 1.4, 1.4, 0.6, 0],
  fist: [0.8, 0.5, 0.6, 0.2, 1.4, 1.55, 0.8, 0, 1.45, 1.55, 0.8, 0, 1.45, 1.55, 0.8, 0, 1.45, 1.5, 0.8, 0],
  // support hand closed over the firing hand's fingers
  wrap: [0.25, 0.15, 0.2, -0.3, 1.0, 1.1, 0.5, 0, 1.05, 1.15, 0.5, 0, 1.08, 1.15, 0.5, 0, 1.1, 1.1, 0.5, 0],
};

// ------------------------------------------------------------------------------------------- weapon definitions
// Camera space: +x right, +y up, -z forward. Grip inputs are in weapon space as [x, y, forward].
// Clip tracks: weapon = [t, dx, dy, dz, rx, ry, rz] additive in camera space; L / R = [t, gripName, {dp, f, rot}].
const DEFS = {
  carbine: {
    hip: [0.104, -0.122, -0.215], hipRot: [0.03, 0.115, -0.045], ads: [0, -CARBINE_DIM.sightY, -0.2], adsVmFov: 45,
    muzzle: CARBINE_DIM.muzzle, eject: CARBINE_DIM.eject, flash: 0.22,
    kick: { back: 2.2, pitch: 1.6, yaw: 0.5, roll: 0.8, cycle: 0.065 },
    elbows: { R: [0.26, -0.4, 0.16], L: [-0.2, -0.56, -0.06] },
    grips: {
      fire: { palm: [0.0105, -0.1, -0.1], n: [-1, 0.03, -0.12], d: [0, -0.2, 0.98], f: 'grip' },
      guard: { palm: [-0.011, -0.0285, 0.266], n: [0.3, 1, 0], d: [0.78, 0.1, 0.62], f: 'guard' },
      mag: { palm: [-0.0135, -0.156, 0.071], n: [1, 0.06, 0.1], d: [0.0, -0.14, 0.99], f: 'mag' },
      charge: { palm: [-0.05, -0.012, 0.094], n: [1, 0.05, 0.25], d: [0.1, 0.9, 0.42], f: 'hook' },
    },
    rest: { R: 'fire', L: 'guard' },
    clips: {
      reload: {
        weapon: [[0, 0, 0, 0, 0, 0, 0], [0.11, -0.04, 0.085, -0.045, 0.27, 0.19, -0.37], [0.25, -0.05, 0.11, -0.07, 0.34, 0.24, -0.45], [0.5, -0.048, 0.104, -0.07, 0.32, 0.24, -0.44],
          [0.6, -0.045, 0.112, -0.068, 0.34, 0.22, -0.41], [0.74, -0.03, 0.075, -0.04, 0.22, 0.14, -0.22], [0.84, -0.015, 0.04, -0.016, 0.12, 0.07, -0.11], [0.96, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0]],
        L: [[0, 'guard'], [0.035, 'guard', { f: 'relax', dp: [-0.006, -0.012, -0.004] }], [0.145, 'mag'], [0.165, 'mag'], [0.25, 'mag', { dp: [0.004, -0.135, -0.012] }],
          [0.36, 'mag', { dp: [-0.11, -0.34, -0.12], rot: [0.3, 0, 0.4] }], [0.43, 'mag', { dp: [-0.07, -0.3, -0.1], rot: [0.2, 0, 0.3] }], [0.515, 'mag', { dp: [0.004, -0.12, -0.014], rot: [-0.05, 0, 0] }],
          [0.565, 'mag'], [0.6, 'mag', { dp: [0, 0.004, 0] }], [0.64, 'mag', { f: 'relax', dp: [-0.02, -0.02, 0.0] }], [0.74, 'charge'], [0.795, 'charge', { dp: [0, 0, -CARBINE_DIM.boltTravel] }],
          [0.825, 'charge', { dp: [-0.012, 0.004, -CARBINE_DIM.boltTravel - 0.012], f: 'relax' }], [0.95, 'guard'], [1, 'guard']],
        parts: { bolt: [[0, 0], [0.74, 0], [0.795, 1], [0.803, 1], [0.826, 0], [1, 0]], release: [[0, 1], [0.803, 1], [0.826, 0], [1, 0]] },
        mag: { hand: 'L', grab: 0.165, seat: 0.565 },
        kicks: [[0.165, { y: -0.25, pitch: -0.9 }], [0.25, { y: 0.35, pitch: 0.8, roll: 0.6 }], [0.565, { y: 0.9, pitch: 1.6, roll: -1.2 }], [0.6, { y: 0.4, pitch: 0.6 }], [0.8, { z: 0.5, pitch: 0.7 }], [0.826, { z: -1.4, pitch: -2.4, roll: 0.8 }]],
        cues: [[0.16, 'magout'], [0.56, 'magin'], [0.6, 'tap'], [0.824, 'boltfwd']], freeCues: [[0.765, 'boltback']],
      },
    },
  },
  pistol: {
    model: 'service_pistol', rot: [0, H, 0], scale: 1.08, off: [0, 0, 0], keep: /pistol_a|slide_a|hammer_a|trigger_a|magazine_loaded/,
    hip: [0.098, -0.112, -0.36], hipRot: [0.07, 0.27, -0.12], ads: [0, -0.0885, -0.43], adsVmFov: 50,
    muzzle: [0, 0.071, -0.2], eject: [0.02, 0.078, -0.01], flash: 0.17,
    kick: { back: 2.4, pitch: 8.5, yaw: 1.1, roll: 1.6, cycle: 0.06 },
    elbows: { R: [0.2, -0.62, -0.1], L: [-0.08, -0.64, -0.12] },
    grips: {
      fire: { palm: [0.0135, 0.022, -0.038], n: [-0.78, 0.0, 0.62], d: [0.6, -0.2, 0.775], f: 'grip' },
      support: { palm: [-0.021, 0.004, -0.02], n: [0.85, 0.1, 0.5], d: [-0.3, -0.5, 0.81], f: 'wrap' },
      magIn: { palm: [-0.004, -0.082, -0.03], n: [0.2, 1, 0.15], d: [0.55, 0.15, 0.82], f: 'mag' },
      rack: { palm: [0.0, 0.094, -0.012], n: [0, -1, 0], d: [1, -0.1, 0.25], f: 'hook' },
    },
    rest: { R: 'fire', L: 'support' },
    setup(w) {
      const n = w.node, d = DEFS.pistol; w.slide = n.slide_a; w.slideX = n.slide_a.position.x; w.hammer = n.hammer_a;
      const mag = new THREE.Group(), inner = new THREE.Group(); inner.rotation.set(...d.rot); inner.scale.setScalar(d.scale);
      n.magazine_loaded.position.set(-0.0075, 0, 0); inner.add(n.magazine_loaded); mag.add(inner); w.group.add(mag); w.mag = mag;
      w.applyParts = (w, part, cyc, vm) => { const k = Math.max(vm.lockAmount(w, part), cyc); w.slide.position.x = w.slideX - 0.03 * k; w.hammer.rotation.z = 0.9 * Math.min(1, k * 3); };
      w.partProbe = (w) => [w.slide.position.x];
    },
    clips: {
      reload: {
        weapon: [[0, 0, 0, 0, 0, 0, 0], [0.11, -0.03, 0.075, -0.01, 0.3, 0.06, -0.4], [0.32, -0.036, 0.088, -0.012, 0.34, 0.08, -0.46], [0.55, -0.034, 0.084, -0.012, 0.32, 0.08, -0.44], [0.66, -0.03, 0.09, -0.012, 0.33, 0.06, -0.4],
          [0.78, -0.016, 0.045, -0.005, 0.14, 0.03, -0.17], [0.88, -0.006, 0.015, 0, 0.04, 0.01, -0.05], [0.96, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0]],
        L: [[0, 'support'], [0.08, 'support', { f: 'relax', dp: [-0.02, -0.03, -0.01] }], [0.22, 'magIn', { dp: [-0.1, -0.3, -0.12], rot: [0.3, 0, 0.3] }], [0.36, 'magIn', { dp: [-0.09, -0.3, -0.11], rot: [0.3, 0, 0.3] }],
          [0.5, 'magIn', { dp: [0, -0.095, -0.022] }], [0.6, 'magIn'], [0.645, 'magIn', { dp: [0, 0.004, 0] }], [0.7, 'magIn', { f: 'relax', dp: [-0.022, -0.02, 0] }], [0.9, 'support'], [1, 'support']],
        parts: { release: [[0, 1], [0.735, 1], [0.76, 0], [1, 0]] },
        mag: { hand: 'L', grab: 0.36, seat: 0.6, drop: [0.13, 0.33], dropDir: [0, -0.975, 0.22], dur: 1.5 },
        kicks: [[0.13, { y: 0.3, pitch: 0.5 }], [0.6, { y: 0.9, pitch: 1.4, roll: -0.8 }], [0.645, { y: 0.3 }]],
        lockKicks: [[0.76, { z: -1.2, pitch: -2.0, roll: 0.6 }]],
        cues: [[0.12, 'magout'], [0.595, 'magin'], [0.645, 'tap']], lockCues: [[0.757, 'slidefwd']],
      },
    },
  },
  marksman: {
    model: 'bolt_action_rifle_7_62', rot: [0, H, 0], scale: 1, off: [0, 0.02, -0.29], hide: /bullet|bolt_b/,
    hip: [0.1, -0.152, -0.35], hipRot: [0.02, 0.085, -0.03], ads: [0, -0.115, -0.24], adsVmFov: 50,
    muzzle: [0, 0.075, -0.9], eject: [0.035, 0.08, -0.04], flash: 0.3,
    kick: { back: 5.2, pitch: 6.5, yaw: 0.9, roll: 1.8, cycle: 0 },
    elbows: { R: [0.26, -0.4, 0.2], L: [-0.2, -0.56, -0.06] },
    grips: {
      fire: { palm: [0.0135, 0.03, -0.058], n: [-0.75, 0.25, 0.6], d: [0.55, -0.45, 0.7], f: 'grip' },
      forend: { palm: [-0.008, 0.037, 0.3], n: [0.3, 1, 0], d: [0.78, 0.1, 0.62], f: 'guard' },
      bolt: { palm: [0.042, 0.024, 0.03], n: [-0.5, 0.85, 0], d: [-0.3, 0.1, 0.95], f: 'pinch' },
      boltUp: { palm: [0.05, 0.088, 0.03], n: [-0.9, 0.4, 0], d: [-0.2, 0.35, 0.92], f: 'pinch' },
      feed: { palm: [0.046, 0.118, 0.04], n: [-0.6, -0.8, 0], d: [-0.5, 0.1, 0.86], f: 'pinch' },
    },
    rest: { R: 'fire', L: 'forend' },
    setup(w, vm) {
      const n = w.node; w.boltNode = n.bolt_a; w.boltX = n.bolt_a.position.x;
      for (const m of new Set([n.main, n.trigger].filter(Boolean).map((o) => o.material))) m.color.setRGB(0.46, 0.36, 0.3);   // calmer, darker walnut
      w.applyParts = (w, part) => { w.boltNode.rotation.x = -1.15 * (part.lift || 0); w.boltNode.position.x = w.boltX - 0.088 * (part.pull || 0); };
      w.partProbe = (w) => [w.boltNode.position.x, w.boltNode.rotation.x * 0.05];
      const r = n.bullet_54mm.clone(); r.visible = true; r.position.set(0, 0, 0); r.rotation.set(0, H, 0); r.material = n.bullet_54mm.material;
      const holder = new THREE.Group(); holder.add(r); holder.position.set(-0.03, -0.034, -0.1); holder.rotation.set(0.2, 0.5, 0); holder.visible = false;
      vm.hands.R.root.add(holder); w.round = holder;
    },
    clips: {
      reload: {
        weapon: [[0, 0, 0, 0, 0, 0, 0], [0.08, -0.03, 0.03, 0.0, -0.02, 0.1, 0.26], [0.22, -0.04, 0.04, 0.0, -0.04, 0.13, 0.34], [0.7, -0.04, 0.04, 0.0, -0.04, 0.13, 0.33], [0.82, -0.025, 0.025, 0, -0.02, 0.08, 0.2], [0.9, -0.01, 0.01, 0, 0, 0.03, 0.08], [0.97, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0]],
        R: [[0, 'fire'], [0.07, 'fire', { f: 'relax', dp: [0.012, 0.02, 0] }], [0.13, 'bolt'], [0.172, 'boltUp'], [0.215, 'boltUp', { dp: [0, 0, -0.088] }], [0.3, 'feed', { dp: [0.16, -0.36, -0.2] }], [0.35, 'feed', { dp: [0.15, -0.34, -0.2] }],
          [0.42, 'feed', { dp: [0.004, 0.04, 0] }], [0.455, 'feed'], [0.5, 'feed', { dp: [0.004, 0.034, -0.008] }], [0.545, 'feed'], [0.59, 'feed', { dp: [0.004, 0.034, -0.008] }], [0.635, 'feed'], [0.69, 'feed', { dp: [0.02, 0.03, -0.04], f: 'relax' }],
          [0.75, 'boltUp', { dp: [0, 0, -0.088] }], [0.805, 'boltUp'], [0.848, 'bolt'], [0.9, 'bolt', { f: 'relax', dp: [0.012, 0, -0.012] }], [0.97, 'fire'], [1, 'fire']],
        parts: { lift: [[0, 0], [0.13, 0], [0.172, 1], [0.805, 1], [0.848, 0], [1, 0]], pull: [[0, 0], [0.172, 0], [0.215, 1], [0.75, 1], [0.805, 0], [1, 0]] },
        show: { round: [[0.33, 0.455], [0.475, 0.545], [0.565, 0.635]] },
        kicks: [[0.172, { roll: 0.8 }], [0.215, { z: 0.8, pitch: 0.5 }], [0.455, { y: -0.5, pitch: -0.5 }], [0.545, { y: -0.5, pitch: -0.5 }], [0.635, { y: -0.5, pitch: -0.5 }], [0.805, { z: -1.1, pitch: -0.8 }], [0.848, { roll: -1.0 }]],
        cues: [[0.15, 'boltup'], [0.2, 'boltback'], [0.45, 'round'], [0.54, 'round'], [0.63, 'round'], [0.79, 'boltfwd'], [0.84, 'boltdown']],
      },
      bolt: {
        weapon: [[0, 0, 0, 0, 0, 0, 0], [0.17, -0.012, -0.012, 0.008, 0.03, 0.04, 0.16], [0.3, -0.016, -0.016, 0.018, 0.05, 0.05, 0.22], [0.56, -0.012, -0.012, 0.004, 0.03, 0.04, 0.17], [0.72, -0.004, -0.004, 0, 0.01, 0.01, 0.05], [0.92, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0]],
        R: [[0, 'fire'], [0.07, 'fire', { f: 'relax', dp: [0.012, 0.02, 0] }], [0.15, 'bolt'], [0.2, 'boltUp'], [0.3, 'boltUp', { dp: [0, 0, -0.088] }], [0.42, 'boltUp', { dp: [0, 0, -0.088] }], [0.56, 'boltUp'], [0.66, 'bolt'],
          [0.74, 'bolt', { f: 'relax', dp: [0.012, 0, -0.012] }], [0.93, 'fire'], [1, 'fire']],
        parts: { lift: [[0, 0], [0.15, 0], [0.2, 1], [0.56, 1], [0.66, 0], [1, 0]], pull: [[0, 0], [0.2, 0], [0.3, 1], [0.42, 1], [0.56, 0], [1, 0]] },
        kicks: [[0.2, { roll: 0.7 }], [0.3, { z: 0.9, pitch: 0.6 }], [0.56, { z: -1.1, pitch: -0.8 }], [0.66, { roll: -0.9 }]],
        cues: [],
      },
    },
  },
};


// ------------------------------------------------------------------------------------------- clip machinery
const HAND_DIM = 27;       // pos(3) quat(4) fingers(20)
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _s = new THREE.Vector3();
function handKey(t, g, o = {}) {
  const p = g.p.clone(), q = g.q.clone();
  if (o.dp) p.add(_v.set(o.dp[0], o.dp[1], -o.dp[2]));
  if (o.rot) q.premultiply(_q.setFromEuler(_e.set(o.rot[0], o.rot[1], o.rot[2])));
  return [t, p.x, p.y, p.z, q.x, q.y, q.z, q.w, ...(o.f ? FP[o.f] : g.f)];
}
const handMatrix = (a, left, out) => out.compose(_v.set(a[0], a[1], a[2]), _q.set(a[3], a[4], a[5], a[6]), _s.set(left ? -1 : 1, 1, 1));

function compileWeapon(def) {
  const grips = {};
  for (const [k, g] of Object.entries(def.grips)) grips[k] = { ...gripPose(g), f: FP[g.f] };
  const rest = {};
  for (const h of ['L', 'R']) rest[h] = def.rest[h] ? new Float64Array(handKey(0, grips[def.rest[h]]).slice(1)) : null;
  const clips = {};
  for (const [name, c] of Object.entries(def.clips || {})) {
    const o = { hands: {}, parts: {}, kicks: c.kicks || [], lockKicks: c.lockKicks || null, cues: c.cues || [], lockCues: c.lockCues || [], freeCues: c.freeCues || [], mag: c.mag || null, show: c.show || null, weapon: c.weapon ? makeTrack(c.weapon) : null };
    for (const h of ['L', 'R']) if (c[h]) o.hands[h] = makeTrack(c[h].map(([t, g, opt]) => handKey(t, grips[g], opt)), 3);
    for (const [k, tr] of Object.entries(c.parts || {})) o.parts[k] = makeTrack(tr);
    clips[name] = o;
  }
  return { grips, rest, clips };
}

// ------------------------------------------------------------------------------------------- lens / reticle
function lensMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uVmScale: VM_SCALE, uColor: { value: new THREE.Color(7.5, 0.5, 0.18) }, uOn: { value: 1 } },
    vertexShader: /* glsl */`
      uniform float uVmScale; varying vec3 vView, vF, vR, vU, vN;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = mv.xyz;
        vF = normalize((modelViewMatrix * vec4(0.0, 0.0, -1.0, 0.0)).xyz); vR = normalize((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz); vU = normalize((modelViewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv; gl_Position.xy *= uVmScale; gl_Position.z = mix(-gl_Position.w, gl_Position.z, 0.06);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOn; varying vec3 vView, vF, vR, vU, vN;
      void main(){
        vec3 d = normalize(vView); float k = dot(d, vF);
        // the reticle is collimated: it depends only on the angle between the eye ray and the bore axis
        vec2 a = vec2(dot(d, vR), dot(d, vU)) / max(k, 1e-3); float r = length(a), w = fwidth(r) * 1.2 + 1e-5;
        float dotI = 1.0 - smoothstep(0.0011 - w, 0.0011 + w, r);
        float ring = 1.0 - smoothstep(0.0007, 0.0007 + w, abs(r - 0.0118));
        float tick = (1.0 - smoothstep(0.0006, 0.0006 + w, min(abs(a.x), abs(a.y)))) * step(0.0118, r) * (1.0 - step(0.0152, r));
        float ret = clamp(dotI + ring * 0.8 + tick * 0.8, 0.0, 1.0) * step(0.0, k) * uOn;
        float fres = pow(1.0 - abs(dot(normalize(vN), d)), 3.0);
        float alpha = 0.035 + fres * 0.5;
        vec3 tint = mix(vec3(0.2, 0.5, 0.42), vec3(0.55, 0.75, 0.9), fres) * 0.5;
        gl_FragColor = vec4(tint * alpha + uColor * ret, alpha + ret * 0.2);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}

// ------------------------------------------------------------------------------------------- view model
export class ViewModel {
  constructor(engine, fx) {
    this.engine = engine; this.fx = fx;
    this.root = new THREE.Group(); engine.camera.add(this.root);
    // Passes that draw the scene with an override material (e.g. an AO pre-pass) do not get the viewmodel projection, so they must skip it.
    engine.hideForAO = (hide) => { if (hide) { this._rootVisible = this.root.visible; this.root.visible = false; } else if (this._rootVisible !== undefined) this.root.visible = this._rootVisible; };
    this.weapons = {}; this.current = null; this.shown = null; this.name = null;
    this.adsT = 0; this.drawT = 1; this.sprintT = 0; this.landT = 0; this.lower = 0;
    this.sp = {      // springs
      back: new Spring(11, 0.6), pitch: new Spring(9.5, 0.5), yaw: new Spring(8, 0.55), roll: new Spring(8, 0.5),
      swayX: new Spring(4.2, 0.72), swayY: new Spring(4.2, 0.72), land: new Spring(5, 0.5),
      jy: new Spring(7, 0.42), jz: new Spring(8, 0.45), jp: new Spring(6.5, 0.4), jr: new Spring(6, 0.42),
    };
    this.lookV = new THREE.Vector2(); this.bobT = 0; this.bobAmp = 0; this.cycleT = 1; this.flashT = 0;
    this.light = new THREE.PointLight(0xffb060, 0, 12, 2); engine.camera.add(this.light);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: fx.flashTex, color: new THREE.Color(7, 4.5, 2.2), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, fog: false }));
    this.flash.visible = false; this.flash.renderOrder = 10;
    this.pose = { p: new THREE.Vector3(), r: new THREE.Euler() };
    this.tmp = { w: new Float64Array(6), h: new Float64Array(HAND_DIM), hand: { L: new Float64Array(HAND_DIM), R: new Float64Array(HAND_DIM) }, part: new Float64Array(4) };
  }

  async load() {
    const T = this.tex = makeTextures();
    const gun = this.gunMat = pbrMaterial(T, { normalRepeat: 7, normalScale: 0.5, env: 0.75 });
    const glove = this.gloveMat = pbrMaterial(T, { normal: T.weave, normalRepeat: 1, normalScale: 0.45, env: 0.6, cloth: true });
    try { await Promise.all(['700 40px "Saira Condensed"', '600 40px "Saira Condensed"'].map((f) => document.fonts.load(f))); } catch { /* fall back to a system face for the weapon markings */ }
    const skin = await loadHandAsset();
    this.hands = { R: makeHand(glove, false, skin), L: makeHand(glove, true, skin) };
    this.lensMat = lensMaterial();
    // ---- carbine
    { const c = buildCarbine(gun); c.lens.material = this.lensMat;
      this.weapons.carbine = { ...DEFS.carbine, ...compileWeapon(DEFS.carbine), group: c.group, mag: c.mag, bolt: c.bolt, name: 'carbine',
        applyParts: (w, part, cyc, vm) => { w.bolt.position.z = CARBINE_DIM.boltTravel * Math.max(part.bolt || 0, cyc, vm.lockAmount(w, part)); },
        partProbe: (w) => [w.bolt.position.z] }; }
    // ---- photoscanned pistol + rifle
    for (const k of ['pistol', 'marksman']) {
      const d = DEFS[k], g = new THREE.Group(), src = (await loadModel(d.model)).scene.clone(true), node = {};
      src.rotation.set(...d.rot); src.scale.setScalar(d.scale); src.position.set(...d.off);
      src.traverse((o) => {
        node[o.name === d.model ? 'main' : o.name.replace(d.model + '_', '')] = o;
        if (o.isMesh) { o.material = vmProject(o.material.clone()); if ((d.keep && !d.keep.test(o.name)) || (d.hide && d.hide.test(o.name))) o.visible = false; }
      });
      g.add(src);
      const w = this.weapons[k] = { ...d, ...compileWeapon(d), group: g, src, node, name: k };
      d.setup?.(w, this);
    }
    for (const w of Object.values(this.weapons)) {
      w.group.visible = false; this.root.add(w.group);
      w.state = {}; for (const k of Object.keys(w.clips)) w.state[k] = { t: -1, w: 0 };
      if (w.mag) { w.magSeat = new THREE.Matrix4().compose(w.mag.position, w.mag.quaternion, w.mag.scale); w.magSeatP = w.mag.position.clone(); w.magSeatQ = w.mag.quaternion.clone(); }
      for (const c of Object.values(w.clips)) if (c.mag) {      // offset that keeps the magazine rigid in the hand that carries it
        const a = evalTrack(c.hands[c.mag.hand], c.mag.seat, new Float64Array(HAND_DIM));
        c.mag.hold = handMatrix(a, c.mag.hand === 'L', new THREE.Matrix4()).invert().multiply(w.magSeat);
      }
      w.group.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; o.receiveShadow = true; } });
    }
    this.root.add(this.flash);
  }

  setWeapon(name) {
    const next = this.weapons[name]; if (!next) return;
    const same = this.current === next;
    this.name = name; this.current = next;
    if (!this.shown) { this.lower = 1; this.show(next); }
    else if (this.shown === next && same) { this.lower = 1; this.resetClips(next); }      // respawn: draw again from below
    this.syncDraw();
  }
  show(w) {
    if (this.shown && this.shown !== w) { this.shown.group.visible = false; this.resetClips(this.shown); }
    this.shown = w; this.resetClips(w); w.group.visible = true;
    for (const o of Object.values(this.weapons)) if (o.round) o.round.visible = false;
    for (const h of ['L', 'R']) { const hand = this.hands[h]; if (w.rest[h]) { w.group.add(hand.root); hand.root.visible = true; } else { hand.root.removeFromParent(); hand.root.visible = false; } }
    this.cycleT = 1;
  }
  resetClips(w) { w.locked = false; for (const s of Object.values(w.state)) { s.t = -1; s.w = 0; } if (w.mag) { w.mag.position.copy(w.magSeatP); w.mag.quaternion.copy(w.magSeatQ); w.mag.visible = true; } }
  syncDraw() { this.drawT = this.shown === this.current ? 1 - 0.62 * this.lower : 0.38 * this.lower; }

  /** last = this shot emptied the magazine: the action stays open until the next reload releases it. */
  fire(last = false) {
    const k = this.current.kick, a = 1 - this.adsT * 0.45, s = this.sp;
    this.current.locked = !!last && !!this.current.clips.reload?.parts.release;
    s.back.kick(k.back * a); s.pitch.kick(k.pitch * a * (0.85 + Math.random() * 0.3));
    s.yaw.kick((Math.random() - 0.5) * 2 * k.yaw * a); s.roll.kick((Math.random() - 0.5) * 2 * k.roll * a);
    this.cycleT = 0; this.flashT = 0.045;
    this.flashSize = this.current.flash * (0.7 + Math.random() * 0.6) * (1 - this.adsT * 0.4); this.flash.material.rotation = Math.random() * 6.28;
    this.light.intensity = 30;
  }
  /** How far the action is held open by the last-round lock (1) while a reload has not released it yet. */
  lockAmount(w, part) { return !w.locked ? 0 : w.state.reload.t >= 0 ? (part.release ?? 1) : this.cycleT < w.kick.cycle / 2 ? 0 : 1; }
  /** Sound cues [[t, kind], ...] for the reload that is about to start on the current weapon. */
  reloadCues() { const c = this.current.clips.reload; return c ? [...c.cues, ...(this.current.locked ? c.lockCues : c.freeCues)].sort((a, b) => a[0] - b[0]) : []; }
  /** Camera-space point where a weapon-space point appears on screen (accounts for the viewmodel's own FOV). */
  toCamera(local, out) { out.set(local[0], local[1], local[2]).applyMatrix4(this.current.group.matrix); out.x *= VM_SCALE.value; out.y *= VM_SCALE.value; return out; }
  /** World position of the muzzle (for tracers). */
  muzzleWorld(out) { return this.toCamera(this.current.muzzle, out).applyMatrix4(this.engine.camera.matrixWorld); }
  ejectWorld(out) { return this.toCamera(this.current.eject, out).applyMatrix4(this.engine.camera.matrixWorld); }

  /** s: {dt, speed, grounded, ads, sprint, look:{x,y}, reload:0..1|-1, bolt:0..1|-1, hidden} */
  update(s) {
    if (!this.current) return;
    if (s.dt > 0) this.advance(s);
    this.apply(s);
  }

  // ---- state: everything that integrates over time
  advance(s) {
    const dt = Math.min(s.dt, 0.1), def = WEAPONS[this.name], sp = this.sp, cam = this.engine.camera;
    // draw / holster
    if (this.shown !== this.current) { this.lower = Math.min(1, this.lower + dt / (def.drawTime * 0.38)); if (this.lower >= 1) this.show(this.current); }
    else this.lower = Math.max(0, this.lower - dt / (def.drawTime * 0.62));
    this.syncDraw();
    const live = this.shown === this.current;
    this.adsT = damp(this.adsT, s.ads && live ? 1 : 0, 2.6 / def.adsTime, dt);
    this.sprintT = damp(this.sprintT, s.sprint ? 1 : 0, 9, dt);
    this.landT = damp(this.landT, 0, 9, dt);
    // look sway: the weapon trails the view when turning, then catches up
    this.lookV.x = damp(this.lookV.x, s.look.x / dt, 30, dt); this.lookV.y = damp(this.lookV.y, s.look.y / dt, 30, dt);
    const c = THREE.MathUtils.clamp;
    sp.swayX.step(c(-this.lookV.x * 0.000028, -0.05, 0.05), dt); sp.swayY.step(c(this.lookV.y * 0.000028, -0.05, 0.05), dt);
    sp.back.step(0, dt); sp.pitch.step(0, dt); sp.yaw.step(0, dt); sp.roll.step(0, dt);
    sp.land.step(this.landT, dt); sp.jy.step(0, dt); sp.jz.step(0, dt); sp.jp.step(0, dt); sp.jr.step(0, dt);
    const moving = s.grounded ? Math.min(1, s.speed / 4.6) : 0;
    this.bobAmp = damp(this.bobAmp, moving, 7, dt);
    this.bobT += dt * (2.2 + s.speed * 1.55) * (moving > 0.04 ? 1 : 0.25 * this.bobAmp);
    this.cycleT += dt; this.flashT -= dt;
    this.light.intensity = damp(this.light.intensity, 0, 45, dt);
    // clips
    const w = this.shown;
    for (const [name, clip] of Object.entries(w.clips)) {
      const st = w.state[name], input = live ? (name === 'reload' ? s.reload : name === 'bolt' ? s.bolt : -1) : -1, prev = st.t;
      const dur = name === 'reload' ? def.reload : 60 / def.rpm * 0.85;
      if (input >= 0) { st.t = input; st.w = input < 0.08 || prev >= 0 ? 1 : damp(st.w, 1, 18, dt); st.done = false; }
      else if (st.t >= 0) {
        if (st.t > 0.9 || st.done) { st.done = true; st.t += dt / dur; if (st.t >= 1) { st.t = -1; st.w = 0; st.done = false; } }     // let the tail play out
        else if (live) { st.w = damp(st.w, 0, 7, dt); if (st.w < 0.003) { st.t = -1; st.w = 0; } }                             // interrupted: blend away
        // (interrupted by a weapon switch: the pose simply stays frozen while this weapon is lowered out of view)
      }
      if (st.t >= 0 && prev >= 0 && st.t > prev) for (const [kt, k] of (w.locked && clip.lockKicks ? [...clip.kicks, ...clip.lockKicks] : clip.kicks)) if (kt > prev && kt <= st.t) {
        if (k.y) sp.jy.kick(k.y * st.w); if (k.z) sp.jz.kick(k.z * st.w); if (k.pitch) sp.jp.kick(k.pitch * st.w); if (k.roll) sp.jr.kick(k.roll * st.w);
      }
      if (name === 'reload' && w.locked && prev >= 0.9) w.locked = false;                // past the release point: the action is closed again
    }
  }

  // ---- pose: a pure function of the state above
  apply(s) {
    const w = this.shown, cam = this.engine.camera, sp = this.sp, a = this.adsT, T = this.tmp;
    const t = this.engine.time, hip = w.hip, ads = w.ads, hr = w.hipRot;
    const ae = a * a * (3 - 2 * a);
    VM_SCALE.value = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) / Math.tan(THREE.MathUtils.degToRad(VM_FOV + ((w.adsVmFov || VM_FOV) - VM_FOV) * ae) / 2);
    this.engine.vmScale = VM_SCALE.value;                              // the post chain needs it to rebuild weapon-space depth for contact shadows
    VM_RIM.value.copy(G.uSkyCol.value).multiplyScalar(0.9).addScalar(0.012);
    let px = hip[0] + (ads[0] - hip[0]) * ae, py = hip[1] + (ads[1] - hip[1]) * ae - Math.sin(Math.PI * a) * 0.006, pz = hip[2] + (ads[2] - hip[2]) * ae;
    let rx = hr[0] * (1 - ae), ry = hr[1] * (1 - ae), rz = hr[2] * (1 - ae) - Math.sin(Math.PI * a) * 0.05;
    const loose = 1 - a * 0.82;                                         // how much of the hip-fire looseness is left
    // idle: breathing + slow drift
    py += Math.sin(t * 1.35) * 0.0016 * loose; rx += Math.sin(t * 1.35 + 0.6) * 0.004 * loose; ry += Math.sin(t * 0.83) * 0.003 * loose; px += Math.sin(t * 0.61 + 1) * 0.0008 * loose;
    // walk bob (figure of eight)
    const bob = this.bobAmp * (1 - a * 0.9) * (1 + this.sprintT * 0.8), bs = Math.sin(this.bobT), bc = Math.sin(this.bobT * 2);
    px += bs * 0.0058 * bob; py += -Math.abs(bs) * 0.0052 * bob + 0.0026 * bob; rz += bs * 0.012 * bob; rx += bc * 0.006 * bob; ry += bs * 0.007 * bob;
    // look sway
    px += sp.swayX.x * 0.3 * loose; py -= sp.swayY.x * 0.25 * loose; ry += sp.swayX.x * (0.9 * loose + 0.12); rx += sp.swayY.x * (0.7 * loose + 0.1); rz += sp.swayX.x * 1.3 * loose;
    // recoil
    pz += sp.back.x; py += sp.pitch.x * 0.2; rx += sp.pitch.x; ry += sp.yaw.x; rz += sp.roll.x; px -= sp.yaw.x * 0.15;
    // landing dip
    py -= sp.land.x * 0.028 * (1 - a * 0.5); rx += sp.land.x * 0.09 * (1 - a * 0.5);
    // sprint carry: muzzle swings inwards and down
    const sv = this.sprintT * (1 - a), se = sv * sv * (3 - 2 * sv);
    px -= se * 0.045; py -= se * 0.028; pz += se * 0.03; rx -= se * 0.16; ry += se * 0.62; rz += se * 0.3;
    // draw / holster
    const d = this.lower * this.lower * (3 - 2 * this.lower);
    py -= d * 0.3; pz += d * 0.06; rx -= d * 0.85; rz += d * 0.35; px += d * 0.03;
    // clips: weapon offsets, hands, moving parts
    const part = {}; let magDone = false;
    if (w.round) w.round.visible = false;
    const hands = { L: w.rest.L, R: w.rest.R }, hw = { L: null, R: null };
    for (const [name, clip] of Object.entries(w.clips)) {
      const st = w.state[name]; if (st.t < 0 || st.w <= 0) continue;
      const tt = Math.min(1, st.t), k = st.w;
      if (clip.weapon) { const o = evalTrack(clip.weapon, tt, T.w); px += o[0] * k; py += o[1] * k; pz += o[2] * k; rx += o[3] * k; ry += o[4] * k; rz += o[5] * k; }
      for (const h of ['L', 'R']) if (clip.hands[h] && hands[h]) {
        const o = evalTrack(clip.hands[h], tt, T.h), dst = T.hand[h], src = hw[h] || hands[h];
        if (k >= 1) dst.set(o); else {
          for (let i = 0; i < 3; i++) dst[i] = src[i] + (o[i] - src[i]) * k;
          _q.set(src[3], src[4], src[5], src[6]).slerp(_q2.set(o[3], o[4], o[5], o[6]), k); dst[3] = _q.x; dst[4] = _q.y; dst[5] = _q.z; dst[6] = _q.w;
          for (let i = 7; i < HAND_DIM; i++) dst[i] = src[i] + (o[i] - src[i]) * k;
        }
        hw[h] = dst;
      }
      for (const [pk, tr] of Object.entries(clip.parts)) part[pk] = (part[pk] || 0) + evalTrack(tr, tt, T.part)[0] * k;
      if (clip.mag && w.mag && !magDone) {
        const mg = clip.mag; let vis = true;
        if (tt >= mg.grab && tt <= mg.seat) { handMatrix(hw[mg.hand], mg.hand === 'L', _m).multiply(mg.hold); _m.decompose(_v, _q, _s); }
        else if (mg.drop && tt >= mg.drop[0] && tt < mg.grab) { const tau = (tt - mg.drop[0]) * mg.dur, dist = 0.25 * tau + 4.9 * tau * tau; _v.copy(w.magSeatP).addScaledVector(_v2.set(...mg.dropDir), dist); _q.copy(w.magSeatQ); vis = tt < mg.drop[1]; }
        else { _v.copy(w.magSeatP); _q.copy(w.magSeatQ); }
        if (k < 1) { _v.lerpVectors(w.magSeatP, _v, k); _q2.copy(w.magSeatQ).slerp(_q, k); _q.copy(_q2); }
        w.mag.position.copy(_v); w.mag.quaternion.copy(_q); w.mag.visible = vis; magDone = true;
      }
      if (clip.show) for (const [obj, spans] of Object.entries(clip.show)) if (w[obj]) w[obj].visible = k > 0.5 && spans.some(([t0, t1]) => tt >= t0 && tt < t1);
    }
    if (w.mag && !magDone) { w.mag.position.copy(w.magSeatP); w.mag.quaternion.copy(w.magSeatQ); w.mag.visible = true; }
    // reload jolts
    py += sp.jy.x * 0.5; pz += sp.jz.x * 0.5; rx += sp.jp.x * 0.8; rz += sp.jr.x * 0.8;
    const g = w.group;
    g.position.set(px, py, pz); g.rotation.set(rx, ry, rz); g.visible = !s.hidden; g.updateMatrix();
    // firing cycle of the action (bolt / slide), 0..1 displacement
    const cyc = this.cycleT < w.kick.cycle ? Math.pow(Math.sin(Math.PI * this.cycleT / w.kick.cycle), 0.8) : 0;
    w.applyParts?.(w, part, cyc, this);
    // hands
    for (const h of ['L', 'R']) {
      const hand = this.hands[h], src = hw[h] || hands[h]; if (!src || hand.root.parent !== g) continue;
      hand.root.position.set(src[0], src[1], src[2]); hand.root.quaternion.set(src[3], src[4], src[5], src[6]); hand.root.updateMatrix();
      hand.setFingers(src.subarray ? src.subarray(7) : src.slice(7));
      _m.multiplyMatrices(g.matrix, hand.root.matrix).invert();                       // camera space -> hand space
      hand.aimLocal(_v.set(...w.elbows[h]).applyMatrix4(_m));
    }
    // muzzle flash
    this.flash.visible = this.flashT > 0 && !s.hidden && w === this.current;
    if (this.flash.visible) { this.toCamera(w.muzzle, this.flash.position); this.flash.scale.setScalar((this.flashSize || w.flash) * VM_SCALE.value); this.light.position.copy(this.flash.position); }
  }
}
