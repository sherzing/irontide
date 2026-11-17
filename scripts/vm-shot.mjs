// In-game screenshots of the first-person weapons: node scripts/vm-shot.mjs <prefix> <baseUrl> [weapon] [shots]
//   shots (comma separated, default all): hip, ads, reload (three frozen frames), fire, sprint
// Also runs a short live sequence (fire, reload, switch) and reports console errors.
import { launch } from './browser.mjs';
const { browser, page, errors } = await launch({ width: 1280, height: 720 });
const [prefix, base, only, shots] = process.argv.slice(2);
const want = (shots || 'hip,ads,reload,fire,sprint').split(',');
await page.goto(base + '/?auto=dm&bots=0&q=' + (process.env.Q || 'high'));
await page.waitForFunction(() => window.__irontide?.game.me?.alive);
const snap = async (n) => { await page.screenshot({ path: `${prefix}-${n}.jpg`, type: 'jpeg', quality: 88 }); console.log('saved', `${prefix}-${n}.jpg`); };
const pose = process.env.POSE ? JSON.parse(process.env.POSE) : { x: -12, z: 9, yaw: -2.0 };
await page.evaluate((p) => { const g = window.__irontide.game; g.me.pos.set(p.x, 0.02, p.z); g.debugInput = { yaw: p.yaw, pitch: -0.02, keys: [] }; }, pose);
const set = (o) => page.evaluate((o) => { const g = window.__irontide.game; Object.assign(g.debugInput, o); }, o);
for (const w of (only && only !== 'all' ? [only] : ['carbine', 'pistol', 'marksman'])) {
  await page.evaluate((w) => { const g = window.__irontide.game; g.me.reload = null; g.switchWeapon(w); }, w);
  await set({ ads: false, fire: false, keys: [] }); await page.waitForTimeout(1500);
  if (want.includes('hip')) await snap(`${w}-hip`);
  if (want.includes('ads') && (w !== 'marksman' || process.env.SCOPE)) { await set({ ads: true }); await page.waitForTimeout(1100); await snap(`${w}-ads`); await set({ ads: false }); await page.waitForTimeout(600); }
  if (want.includes('reload')) for (const t of (process.env.RT || '0.2,0.5,0.8').split(',').map(Number)) {
    await page.evaluate((t) => { const g = window.__irontide.game; g.me.reload = { t: 0, dur: 0.5, cues: [] }; g.__rt = t; }, t);     // run up to t, then freeze there
    await page.evaluate((t) => new Promise((res) => { const g = window.__irontide.game, me = g.me; const tick = () => { if (!me.reload) me.reload = { t: 0, dur: 0.5, cues: [] }; if (me.reload.t / me.reload.dur >= t || me.reload.dur > 1e5) { me.reload = { t: t * 1e6, dur: 1e6, cues: [] }; res(); } else requestAnimationFrame(tick); }; me.reload = { t: 0, dur: 2.0 * t + 0.2, cues: [] }; me.reload.dur = 2.0; tick(); }), t);
    await page.waitForTimeout(350); await snap(`${w}-reload${Math.round(t * 100)}`);
    await page.evaluate(() => { window.__irontide.game.me.reload = null; }); await page.waitForTimeout(500);
  }
  if (want.includes('fire')) { await set({ fire: true }); await page.waitForTimeout(w === 'carbine' ? 260 : 60); await snap(`${w}-fire`); await set({ fire: false }); await page.waitForTimeout(w === 'marksman' ? 1400 : 400); }
  if (want.includes('sprint')) { await set({ keys: ['KeyW', 'ShiftLeft'] }); await page.waitForTimeout(700); await snap(`${w}-sprint`); await set({ keys: [] }); await page.evaluate((p) => { window.__irontide.game.me.pos.set(p.x, 0.02, p.z); }, pose); await page.waitForTimeout(300); }
}
// live sequence: empty a magazine (last-round lock), auto reload, switch through all weapons
await page.evaluate(() => window.__irontide.game.switchWeapon('carbine')); await page.waitForTimeout(700);
await set({ fire: true }); await page.waitForTimeout(3600); await set({ fire: false }); await page.waitForTimeout(2600);
for (const w of ['pistol', 'marksman', 'carbine']) { await page.evaluate((w) => window.__irontide.game.switchWeapon(w), w); await page.waitForTimeout(400); await set({ fire: true }); await page.waitForTimeout(250); await set({ fire: false }); await page.waitForTimeout(900); }
const info = await page.evaluate(() => { const g = window.__irontide.game, r = g.engine.renderer.info; return { weapon: g.me.weapon, ammo: g.me.ammo, drawT: +g.vm.drawT.toFixed(2), fps: window.__fps }; });
console.log(JSON.stringify(info)); console.log('errors:', errors.length);
await browser.close();
