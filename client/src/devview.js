// Dev viewer: /dev.html?level=id&p=x,y,z&yaw=deg&pitch=deg&q=high[&fov=75][&env={json}]  — renders the level from a fixed camera (used for screenshots).
import * as THREE from 'three';
import { Engine, QUALITY } from './engine.js';
import { buildLevel } from './levelbuild.js';
import { Rain } from './rain.js';
import { setAnisotropy } from './materials.js';
import { LEVELS, DEFAULT_LEVEL } from '../../shared/levels/index.js';
const q = new URLSearchParams(location.search);
// &o=msaa:0,refl:0 overrides fields of the chosen quality preset (profiling)
if (q.get('o')) for (const kv of q.get('o').split(',')) { const [k, v] = kv.split(':'); QUALITY[q.get('q') || 'high'][k] = +v; }
const engine = new Engine(document.getElementById('c'), q.get('q') || 'high');
engine.dynamic = false; setAnisotropy(engine.q.aniso);
const level = LEVELS[q.get('level') || DEFAULT_LEVEL];
const env = { ...level.env }; if (q.get('hdri')) env.hdri = q.get('hdri'); if (q.get('az')) env.sunAzimuth = +q.get('az'); if (q.get('el')) env.sunElevation = +q.get('el');
if (q.get('env')) Object.assign(env, JSON.parse(q.get('env')));      // &env={"bloom":{"strength":0}} replaces whole keys of the level's env, for tuning
await engine.loadEnvironment(env, level.bounds);
const built = await buildLevel(level, engine);
const rain = new Rain(engine);
if (q.get('fov')) { engine.camera.fov = +q.get('fov'); engine.camera.updateProjectionMatrix(); }
const set = (p, yaw, pitch) => { engine.camera.position.set(...p); engine.camera.rotation.set(THREE.MathUtils.degToRad(pitch), THREE.MathUtils.degToRad(yaw), 0); };
set((q.get('p') || '0,1.62,18').split(',').map(Number), +(q.get('yaw') || 0), +(q.get('pitch') || 0));
window.__set = set; window.__engine = engine; window.__built = built;
let last = performance.now(), frames = 0, acc = 0, fps = 0, ft = 0;
function loop(now) { const dt = Math.min(0.1, (now - last) / 1000); last = now; built.update(engine.time); rain.update(dt, engine.camera); engine.render(dt); frames++; acc += dt; ft++; if (acc > 1) { fps = Math.round(ft / acc); acc = 0; ft = 0; } window.__frames = frames; requestAnimationFrame(loop); }
requestAnimationFrame(loop);
window.__info = () => ({ fps, tris: engine.stats.tris, calls: engine.stats.calls, size: engine.size, sun: engine.sunDir.toArray().map((v) => +v.toFixed(2)) });
