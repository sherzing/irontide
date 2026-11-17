// Boot, settings, menus and the main loop.
import * as THREE from 'three';
import { Engine } from './engine.js';
import { buildLevel } from './levelbuild.js';
import { setAnisotropy } from './materials.js';
import { FX } from './fx.js';
import { Rain } from './rain.js';
import { G } from './globals.js';
import { GameAudio } from './audio.js';
import { ViewModel } from './viewmodel.js';
import { Characters } from './characters.js';
import { Hud } from './hud.js';
import { Game } from './game.js';
import { LocalTransport, WsTransport } from './net.js';
import { LEVELS, DEFAULT_LEVEL, recommendedPlayers } from '../../shared/levels/index.js';
import { MAX_PLAYERS } from '../../shared/sim.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------- settings
const defaults = { mode: 'quick', quality: 'high', dynres: 'on', sens: 14, fov: 78, volume: 80, name: 'Player' + ((Math.random() * 900 + 100) | 0),
  q: { mode: 'dm', level: DEFAULT_LEVEL, bots: 9, skill: 'normal' }, c: { skill: 'normal' }, m: { server: '', room: 'public', mode: 'tdm', level: DEFAULT_LEVEL, fill: 12 } };
let settings = structuredClone(defaults);
try { const s = JSON.parse(localStorage.getItem('irontide') || '{}'); settings = { ...defaults, ...s, q: { ...defaults.q, ...s.q }, c: { ...defaults.c, ...s.c }, m: { ...defaults.m, ...s.m } }; } catch { /* storage unavailable */ }
if (params.get('q')) settings.quality = params.get('q');
if (LEVELS[params.get('level')]) settings.q.level = settings.m.level = params.get('level');
if (!LEVELS[settings.q.level]) settings.q.level = DEFAULT_LEVEL;
if (!LEVELS[settings.m.level]) settings.m.level = DEFAULT_LEVEL;
if (!['quick', 'campaign', 'multi'].includes(settings.mode)) settings.mode = 'quick';
settings.q.bots = Math.max(1, Math.min(MAX_PLAYERS - 1, +settings.q.bots || defaults.q.bots)); settings.m.fill = Math.max(0, Math.min(MAX_PLAYERS, +settings.m.fill || 0));
const save = () => { try { localStorage.setItem('irontide', JSON.stringify(settings)); } catch { /* ignore */ } };
const getOpt = (path) => path.split('.').reduce((o, k) => o[k], settings);
const setOpt = (path, v) => { const ks = path.split('.'), last = ks.pop(); ks.reduce((o, k) => o[k], settings)[last] = v; save(); applySettings(path); refreshUI(); if (inMenu && ['mode', 'q.level', 'm.level', 'm.mode'].includes(path)) showLevel(menuLevel()); };

// ---------------------------------------------------------------- engine + world
const engine = new Engine($('#c'), settings.quality);
setAnisotropy(engine.q.aniso);
const audio = new GameAudio(); audio.volume = settings.volume / 100;
const fx = new FX(engine);
const rain = new Rain(engine);
engine.dynamic = settings.dynres !== 'off' && params.get('dr') !== '0';
const vm = new ViewModel(engine, fx);
const chars = new Characters(engine);
const hud = new Hud();
const loaded = new Map();
let current = null;
const progress = (p, msg) => { $('#loading .bar i').style.width = Math.round(p * 100) + '%'; if (msg) $('#loadmsg').textContent = msg; };

let inMenu = true, menuT = 0;
let loading = Promise.resolve();
/** Loads a level (one at a time) and makes it the one on screen. */
const ensureLevel = (id) => (loading = loading.catch(() => {}).then(() => loadLevel(id)));
async function loadLevel(id) {
  const level = LEVELS[id] || LEVELS[DEFAULT_LEVEL];
  if (current?.level === level) return current;
  $('#loading').classList.remove('hidden'); progress(0.05, 'Loading ' + level.name);
  if (current) { engine.scene.remove(current.built.root); current.built.deactivate(); }
  await engine.loadEnvironment(level.env, level.bounds); progress(0.35);
  let built = loaded.get(level.id);
  if (!built) { built = await buildLevel(level, engine, (p) => progress(0.35 + p * 0.6)); loaded.set(level.id, built); } else { engine.scene.add(built.root); built.activate(); }
  current = { level, built };
  audio.setWeather(level.env.weather?.rain || 0);
  const b = level.bounds, s0 = level.shots?.[0];                                         // warm up behind the loading screen
  await engine.precompile(s0 ? s0.from : [(b.minX + b.maxX) / 2, 30, b.maxZ], s0 ? s0.look : [(b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2]);
  $('#loading').classList.add('hidden');
  return current;
}

const game = new Game({ engine, fx, audio, vm, hud, chars, settings, ensureLevel });
game.onKicked = (why) => toMenu(why);

function applySettings(path) {
  if (!path || path === 'quality') { if (engine.qualityName !== settings.quality) { engine.setQuality(settings.quality); setAnisotropy(engine.q.aniso); rain.build(); } }
  if (!path || path === 'dynres') { engine.dynamic = settings.dynres !== 'off' && params.get('dr') !== '0'; if (!engine.dynamic && engine.dyn !== 1) { engine.dyn = 1; engine.fit(); } }
  if (!path || path === 'volume') audio.setVolume(settings.volume / 100);
}

// ---------------------------------------------------------------- menu wiring
const CAMPAIGN_LEVEL = Object.values(LEVELS).find((l) => l.campaign).id, camp = LEVELS[CAMPAIGN_LEVEL].campaign;
/** The level the current menu choices lead to; it is the one shown behind the menu. */
const menuLevel = () => (settings.mode === 'quick' ? settings.q.level : settings.mode === 'multi' && settings.m.mode !== 'campaign' ? settings.m.level : CAMPAIGN_LEVEL);
const showLevel = (id) => { if (current?.level.id !== id) { menuT = 0; ensureLevel(id).catch((e) => menuMsg(e.message || String(e))); } };
const SKILL = { easy: 'Recruit', normal: 'Regular', hard: 'Veteran' };
const GO = { quick: 'Drop in', campaign: 'Start mission', multi: 'Join room' };
// the sliders go up to the game's cap; the band on each marks the size the level suits
const SIZE = { 'q.bots': { max: MAX_PLAYERS - 1, others: 1 }, 'm.fill': { max: MAX_PLAYERS, others: 0 } };
for (const [opt, o] of Object.entries(SIZE)) document.querySelector(`input[data-opt="${opt}"]`).max = o.max;
function refreshUI() {
  for (const seg of document.querySelectorAll('.seg[data-opt]')) for (const b of seg.children) b.classList.toggle('on', String(getOpt(seg.dataset.opt)) === b.dataset.v);
  for (const i of document.querySelectorAll('input[data-opt]')) {
    if (document.activeElement !== i) i.value = getOpt(i.dataset.opt);
    if (i.type === 'range') i.style.setProperty('--fill', ((i.value - i.min) / (i.max - i.min)) * 100 + '%');
  }
  for (const v of document.querySelectorAll('[data-val]')) v.textContent = getOpt(v.dataset.val);
  for (const g of document.querySelectorAll('[data-mode]')) g.classList.toggle('hidden', g.dataset.mode !== settings.mode);
  const q = settings.q, m = settings.m, mode = settings.mode;
  const lvl = LEVELS[menuLevel()], rec = recommendedPlayers(lvl);
  const players = mode === 'multi' ? m.fill : q.bots + 1, crowded = mode !== 'campaign' && players > rec.max;
  for (const [opt, o] of Object.entries(SIZE)) {
    const i = document.querySelector(`input[data-opt="${opt}"]`), r = recommendedPlayers(LEVELS[opt === 'q.bots' ? q.level : m.level]);
    const at = (n) => Math.max(0, Math.min(100, ((n - o.others - i.min) / (i.max - i.min)) * 100)) + '%';
    i.style.setProperty('--rec0', at(r.min)); i.style.setProperty('--rec1', at(r.max)); i.closest('.rng').classList.toggle('over', +i.value + o.others > r.max);
  }
  $('#tbLevel').textContent = lvl.name; $('#tbBlurb').textContent = [lvl.blurb, `${rec.min}–${rec.max} players`].filter(Boolean).join(' · ');
  $('#kOp').textContent = 'Operation ' + camp.title; $('#kSite').textContent = lvl.name + ' sector';
  $('#goLabel').textContent = GO[mode];
  $('#pitch').textContent = mode === 'campaign' ? camp.brief
    : mode === 'multi' ? `Up to ${MAX_PLAYERS} players share a room. Empty slots are held by bots until someone takes them.`
    : lvl.pitch || `Live rounds on ${lvl.name}. Set the opposition and drop in.`;
  const b = (t) => `<b>${String(t).replace(/[&<>]/g, '')}</b>`;
  $('#summary').innerHTML = mode === 'campaign' ? `${b(camp.stages.length + ' objectives')} · solo · ${SKILL[settings.c.skill]} opposition`
    : mode === 'multi' ? `Room ${b(m.room || 'public')} · ${{ dm: 'deathmatch', tdm: 'team deathmatch', campaign: 'co-op' }[m.mode]} if new · filled to ${m.fill} · ${MAX_PLAYERS} max`
    : `${b(q.mode === 'tdm' ? 'Team deathmatch' : 'Deathmatch')} · ${q.bots} bot${q.bots === 1 ? '' : 's'} · ${SKILL[q.skill]} · ${lvl.name}`;
  if (crowded) $('#summary').insertAdjacentHTML('beforeend', `<span class="warn">Crowded · ${lvl.name} plays best with ${rec.min}–${rec.max} players</span>`);
}
const menuMsg = (text, info = false) => { const el = $('#menuMsg'); el.textContent = text || ''; el.classList.toggle('info', info); };
function openDrawer(id) {
  for (const d of document.querySelectorAll('.drawer')) d.classList.toggle('open', d.id === 'drawer-' + id && !d.classList.contains('open'));
  $('#menu').classList.toggle('drawer-open', !!document.querySelector('.drawer.open'));
}
for (const el of document.querySelectorAll('.levels')) el.innerHTML = Object.values(LEVELS).map((l) => `<button data-v="${l.id}">${l.name}</button>`).join('');
$('#brief').innerHTML = `<b>${camp.title}</b>${camp.stages.length} objectives · ${LEVELS[CAMPAIGN_LEVEL].name}`;
document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) { if (!e.target.closest('.drawer')) openDrawer(null); return; }
  audio.start(); audio.ui('click');
  const seg = b.closest('.seg[data-opt]'); if (seg) setOpt(seg.dataset.opt, b.dataset.v);
  if (b.dataset.drawer) openDrawer(b.dataset.drawer);
  else if ('close' in b.dataset || !b.closest('.drawer')) openDrawer(null);
});
document.addEventListener('input', (e) => { const i = e.target; if (i.dataset?.opt) setOpt(i.dataset.opt, i.type === 'range' ? +i.value : i.value); });

function toMenu(msg) {
  game.stop(); inMenu = true; $('#menu').classList.remove('hidden'); $('#pause').classList.add('hidden');
  engine.camera.fov = 55; engine.camera.updateProjectionMatrix();
  menuMsg(msg || '');
  showLevel(menuLevel());
}
async function play(makeTransport) {
  audio.start();
  try {
    const t = await makeTransport();
    inMenu = false; $('#menu').classList.add('hidden'); $('#pause').classList.add('hidden'); openDrawer(null); menuMsg('');
    await game.start(t, settings.name);
    t.onClose = (why) => toMenu(why);
    engine.canvas.requestPointerLock?.()?.catch?.(() => {});
  } catch (err) { toMenu(err.message || String(err)); }
}
const playLocal = (opts) => play(async () => new LocalTransport(opts, settings.name));
const startQuick = () => playLocal({ mode: settings.q.mode, level: settings.q.level, fill: settings.q.bots + 1, skill: settings.q.skill });
const startCampaign = () => playLocal({ mode: 'campaign', level: CAMPAIGN_LEVEL, skill: settings.c.skill });
const startMulti = () => { menuMsg('Connecting…', true); play(async () => {
  let host = settings.m.server.trim() || location.host;
  host = host.replace(/^(https?|wss?):\/\//, '').replace(/\/+$/, '');
  const proto = location.protocol === 'https:' && !settings.m.server.trim() ? 'wss' : 'ws';
  const q = new URLSearchParams({ name: settings.name, room: settings.m.room || 'public', mode: settings.m.mode, fill: settings.m.fill, level: settings.m.level });
  const t = new WsTransport(`${proto}://${host}/ws?${q}`); await t.ready; return t;
}); };
$('#go').onclick = () => ({ quick: startQuick, campaign: startCampaign, multi: startMulti })[settings.mode]();
$('#resume').onclick = () => { $('#pause').classList.add('hidden'); game.setPaused(false); engine.canvas.requestPointerLock?.()?.catch?.(() => {}); };
$('#quit').onclick = () => toMenu();
document.addEventListener('pointerlockchange', () => {
  if (!game.active || game.chatting) return;
  if (!document.pointerLockElement) { game.setPaused(true); $('#pause').classList.remove('hidden'); }
});
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && game.active && game.ended && game.mode === 'campaign') toMenu();
  else if (e.code === 'Escape' && inMenu) openDrawer(null);
  else if (e.code === 'Enter' && inMenu && e.target.matches?.('.hero input[type=text]')) { e.target.blur(); $('#go').click(); }
});

// ---------------------------------------------------------------- boot
progress(0.02, 'Loading assets');
await Promise.all([chars.load(), vm.load()]);
vm.root.visible = false;
await ensureLevel(menuLevel());
refreshUI();
$('#menu').classList.remove('hidden');
engine.camera.fov = 55; engine.camera.updateProjectionMatrix();

const clock = new THREE.Clock();
let frames = 0, fpsT = 0, fps = 0;
const _from = new THREE.Vector3(), _to = new THREE.Vector3();
/** Menu backdrop: slow dolly shots defined by the level (env.shots), or a fallback orbit. */
function menuCamera(dt) {
  menuT += dt;
  const level = current.level, shots = level.shots, cam = engine.camera;
  if (shots?.length) {
    const total = shots.reduce((n, s) => n + s.dur, 0); let t = menuT % total, i = 0;
    while (t >= shots[i].dur) { t -= shots[i].dur; i++; }
    const s = shots[i], k = t / s.dur, e = k * k * (3 - 2 * k) * 0.6 + k * 0.4;
    cam.position.copy(_from.fromArray(s.from)).lerp(_to.fromArray(s.to), e);
    cam.lookAt(_from.fromArray(s.look).lerp(_to.fromArray(s.lookTo || s.look), e));
    if (cam.fov !== (s.fov || 55)) { cam.fov = s.fov || 55; cam.updateProjectionMatrix(); }
    engine.fade = Math.min(1, t / 0.9, (s.dur - t) / 0.9);            // dip to black across each cut
  } else {
    const b = level.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + Math.min(b.maxZ, b.minZ + 52)) / 2, a = menuT * 0.035 + 2.2;
    cam.position.set(cx + Math.cos(a) * 30, 5.5 + Math.sin(menuT * 0.11) * 1.2, cz + Math.sin(a) * 24); cam.lookAt(cx + 4, 2.2, cz);
  }
  cam.rotation.order = 'YXZ';
}
function loop() {
  const dt = Math.min(clock.getDelta(), 0.1);
  frames++; fpsT += dt; if (fpsT >= 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; hud.netstat(`${fps} fps${game.net && !game.net.local ? ` · ${game.net.ping} ms` : ''} · ${engine.qualityName}${engine.dyn < 0.99 ? ` · ${Math.round(engine.dyn * 100)}% res` : ''}`); }
  if (inMenu && current) menuCamera(dt); else { engine.fade = 1; game.frame(dt); }
  current?.built.update(engine.time);
  fx.update(dt, engine.camera);
  rain.update(dt, engine.camera);
  if (current) { const c = engine.camera.position, sh = current.built.cover.at(c.x, c.z) > c.y + 0.5 ? 1 : 0; audio.setShelter(sh, dt); engine.shelter += (sh - engine.shelter) * Math.min(1, dt * 2); }
  engine.render(dt);
  window.__frames = (window.__frames || 0) + 1;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// debugging / automated tests
window.__irontide = { game, engine, settings, playLocal, toMenu, vm, chars, fx, rain, G };
if (params.get('auto')) {
  const a = params.get('auto');
  if (a === 'campaign') startCampaign();
  else if (a === 'multi') startMulti();
  else playLocal({ mode: a === 'tdm' ? 'tdm' : 'dm', level: settings.q.level, fill: +(params.get('bots') || 9) + 1, skill: params.get('skill') || 'normal' });
}
