// Viewmodel lab: renders the first-person weapons outside the game for inspection, filmstrips and
// numeric continuity checks. Driven by scripts/vm-lab.mjs through window.lab.
import * as THREE from 'three';
import { loadSky } from './sky.js';
import { ViewModel } from './viewmodel.js';
import { VM_SCALE } from './vmkit.js';
import { WEAPONS } from '../../shared/weapons.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.75; renderer.autoClear = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.04, 800); camera.rotation.order = 'YXZ';
camera.position.set(0, 1.6, 0); camera.rotation.y = -1.25; scene.add(camera);
const env = await loadSky('industrial_sunset_02_puresky');
scene.environment = env; scene.background = env; scene.backgroundIntensity = 0.55; scene.environmentIntensity = 0.75; scene.backgroundBlurriness = 0.25;
const sun = new THREE.DirectionalLight(0xffc48a, 4); sun.position.set(-3, 2.2, -4).add(camera.position); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.9 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
const dot = document.createElement('canvas'); dot.width = dot.height = 64; { const g = dot.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, '#fff'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }
const engine = { camera, scene, renderer, canvas, time: 0 };
const vm = new ViewModel(engine, { flashTex: new THREE.CanvasTexture(dot) });
await vm.load();
const icam = new THREE.PerspectiveCamera(24, 1, 0.02, 50);
const fill = new THREE.HemisphereLight(0xffffff, 0x9a9488, 0); scene.add(fill);

const state = { speed: 0, grounded: true, ads: false, sprint: false, look: { x: 0, y: 0 }, reload: -1, bolt: -1, hidden: false };
const step = (dt, n = 1, patch) => { for (let i = 0; i < n; i++) { patch?.(i); engine.time += dt; camera.updateMatrixWorld(); vm.update({ ...state, dt }); } };
const settle = (sec = 1) => step(1 / 120, Math.round(sec * 120));
const VIEWS = { left: [-1, 0.12, 0.05], right: [1, 0.12, 0.05], top: [0.001, 1, 0.12], front: [0.25, 0.15, -1], rear: [-0.3, 0.3, 1], q: [-0.75, 0.5, 0.55], q2: [0.7, 0.45, 0.6], under: [-0.55, -0.7, 0.3] };
const _v = new THREE.Vector3(), _c = new THREE.Vector3();

function drawCell(x, y, w, h, view, o = {}) {
  renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h); renderer.setScissorTest(true);
  camera.updateMatrixWorld(true);
  if (view === 'fp') {
    camera.aspect = w / h; camera.updateProjectionMatrix();
    vm.update({ ...state, dt: 0 });
    renderer.clear(); renderer.render(scene, camera);
  } else {
    const g = vm.shown.group; g.updateMatrixWorld(true);
    _c.set(...(o.focus || [0, -0.02, -0.12])).applyMatrix4(g.matrixWorld);                 // weapon-space focus point
    const d = _v.set(...VIEWS[view]).normalize().transformDirection(g.matrixWorld);
    icam.position.copy(_c).addScaledVector(d, o.dist || 1.35); icam.up.set(0, 1, 0).transformDirection(g.matrixWorld); icam.lookAt(_c);
    icam.fov = o.fov || 24; icam.aspect = w / h; icam.updateProjectionMatrix(); icam.updateMatrixWorld(true);
    const s = VM_SCALE.value; VM_SCALE.value = 1; fill.intensity = 2.2; scene.backgroundIntensity = 0.25;
    renderer.clear(); renderer.render(scene, icam);
    VM_SCALE.value = s; fill.intensity = 0; scene.backgroundIntensity = 0.55;
  }
}
function sheet(cells, cols) {
  const W = canvas.width, Hh = canvas.height, rows = Math.ceil(cells.length / cols), cw = Math.floor(W / cols), ch = Math.floor(Hh / rows);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, W, Hh); renderer.clear();
  cells.forEach((c, i) => { c.pre?.(); drawCell((i % cols) * cw, Hh - (Math.floor(i / cols) + 1) * ch, cw - 2, ch - 2, c.view, c); });
}

// ---- numeric trace of every animated channel
function channels() {
  const w = vm.shown, g = w.group, out = [g.position.x, g.position.y, g.position.z, g.quaternion.x, g.quaternion.y, g.quaternion.z, g.quaternion.w];
  const names = ['weapon'];
  for (const h of ['L', 'R']) { const r = vm.hands[h].root; if (r.parent !== g) continue; names.push('hand' + h); out.push(r.position.x, r.position.y, r.position.z, r.quaternion.x, r.quaternion.y, r.quaternion.z, r.quaternion.w); }
  if (w.mag && w.mag.visible) { names.push('mag'); out.push(w.mag.position.x, w.mag.position.y, w.mag.position.z, w.mag.quaternion.x, w.mag.quaternion.y, w.mag.quaternion.z, w.mag.quaternion.w); } else if (w.mag) { names.push('mag'); out.push(NaN, NaN, NaN, NaN, NaN, NaN, NaN); }
  const fingers = []; for (const h of ['L', 'R']) fingers.push(...vm.hands[h].fingers);
  const parts = (w.partProbe?.(w) || []);
  return { names, rigid: out, fingers, parts };
}
/** Plays idle -> clip -> idle at a fixed dt and reports the fastest motion per channel (m/s, rad/s) plus the largest single-step jump. */
function trace(weapon, clip, dt, opts = {}) {
  vm.setWeapon(weapon); Object.assign(state, { reload: -1, bolt: -1, ads: false, sprint: false, speed: 0 }); settle(1.5);
  const def = WEAPONS[weapon], dur = clip === 'reload' ? def.reload : 60 / def.rpm * 0.85, key = clip;
  let prev = null, time = 0, shownPrev = vm.shown, swap = null; const res = {}, samples = [];
  const rec = (phase) => {
    const c = channels();
    if (vm.shown !== shownPrev) { swap = { at: +time.toFixed(3), lower: +vm.lower.toFixed(3) }; shownPrev = vm.shown; prev = null; }     // weapon swapped while lowered out of view
    if (prev) {
      c.names.forEach((n, i) => {
        const o = i * 7, a = c.rigid, b = prev.rigid; if (Number.isNaN(a[o]) || Number.isNaN(b[o])) return;
        const dp = Math.hypot(a[o] - b[o], a[o + 1] - b[o + 1], a[o + 2] - b[o + 2]);
        const dq = Math.abs(a[o + 3] * b[o + 3] + a[o + 4] * b[o + 4] + a[o + 5] * b[o + 5] + a[o + 6] * b[o + 6]), ang = 2 * Math.acos(Math.min(1, dq));
        const r = res[n] || (res[n] = { v: 0, vt: 0, w: 0, wt: 0, step: 0 });
        if (dp / dt > r.v) { r.v = dp / dt; r.vt = +time.toFixed(3); r.vp = phase; } if (ang / dt > r.w) { r.w = ang / dt; r.wt = +time.toFixed(3); } r.step = Math.max(r.step, dp);
      });
      let fm = 0; for (let i = 0; i < c.fingers.length; i++) fm = Math.max(fm, Math.abs(c.fingers[i] - prev.fingers[i]));
      const r = res.fingers || (res.fingers = { w: 0, wt: 0 }); if (fm / dt > r.w) { r.w = fm / dt; r.wt = +time.toFixed(3); }
      c.parts.forEach((p, i) => { const r2 = res['part' + i] || (res['part' + i] = { v: 0, vt: 0 }); const sp = Math.abs(p - prev.parts[i]) / dt; if (sp > r2.v) { r2.v = sp; r2.vt = +time.toFixed(3); } });
    }
    prev = c; if (opts.sample && samples.length < 4000) samples.push([+time.toFixed(4), ...c.rigid.slice(0, 3)]);
  };
  const run = (sec, fn, phase) => { const n = Math.round(sec / dt); for (let i = 0; i < n; i++) { fn?.(i * dt, sec); step(dt); time += dt; rec(phase); } };
  if (opts.lock) vm.fire(true);                       // last round: the action stays open until the reload releases it
  run(0.3, null, 'idle');
  const stop = opts.interrupt ?? 1;
  run(dur * stop, (t) => { state[key] = Math.min(0.99999, t / dur); }, 'clip');
  state[key] = -1;
  if (opts.interrupt) vm.setWeapon(weapon === 'pistol' ? 'carbine' : 'pistol');
  run(0.9, null, 'after');
  const g = vm.shown.group, end = [g.position.x, g.position.y, g.position.z, g.rotation.x, g.rotation.y, g.rotation.z].map((v) => +v.toFixed(5));
  for (const r of Object.values(res)) for (const k of Object.keys(r)) if (typeof r[k] === 'number') r[k] = +r[k].toFixed(4);
  return { weapon, clip, dt, res, end, samples, swap, interrupt: opts.interrupt || 0, lock: !!opts.lock, locked: !!vm.weapons[weapon].locked };
}

// debug aids: a 5 cm grid in the weapon's side plane and marker dots at weapon-space [x, y, forward] points
import('./vmkit.js').then(({ vmProject }) => {
  const mk = (color) => vmProject(new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }), 'vmline');
  window.lab.grid = (w = vm.shown) => {
    const a = [], b = [];
    for (let i = -8; i <= 20; i++) { (i === 0 ? b : a).push(0, -0.25, -i * 0.05, 0, 0.15, -i * 0.05); }
    for (let j = -5; j <= 3; j++) { (j === 0 ? b : a).push(0, j * 0.05, 0.4, 0, j * 0.05, -1.0); }
    for (const [pts, col] of [[a, 0x30c0ff], [b, 0xff4030]]) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); const l = new THREE.LineSegments(g, mk(col)); l.renderOrder = 50; l.frustumCulled = false; w.group.add(l); }
  };
  window.lab.mark = (pts, w = vm.shown) => { for (const [x, y, f] of pts) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), vmProject(new THREE.MeshBasicMaterial({ color: 0x40ff40, depthTest: false }), 'vmdot')); m.position.set(x, y, -f); m.renderOrder = 60; m.frustumCulled = false; w.group.add(m); } };
});
window.lab = { vm, engine, state, step, settle, sheet, trace, THREE, camera, renderer, scene, VM_SCALE };
window.__ready = true;
