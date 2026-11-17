// Drives a real match in headless Chromium: node scripts/play-test.mjs <outPrefix> <url> [weapon]
import { launch } from './browser.mjs';
const { browser, page, errors: errs } = await launch();
const [prefix, url, weapon] = process.argv.slice(2);
await page.goto(url);
await page.waitForFunction(() => window.__irontide?.game.me?.alive);
const shot = async (n) => { await page.screenshot({ path: `${prefix}-${n}.jpg`, type: 'jpeg', quality: 88 }); console.log('saved', `${prefix}-${n}.jpg`); };
if (weapon) await page.evaluate((w) => window.__irontide.game.switchWeapon(w), weapon);
await page.waitForTimeout(2500);
await shot('idle');
// aim at the nearest visible enemy and hold fire
const aim = () => page.evaluate(() => {
  const g = window.__irontide.game, me = g.me; let best = null, bd = 1e9;
  for (const c of g.chars.map.values()) { if (!c.alive) continue; const d = c.pos.distanceTo(me.pos); if (d < bd && g.world.los(me.pos.x, me.pos.y + 1.6, me.pos.z, c.pos.x, c.pos.y + 1.2, c.pos.z)) { bd = d; best = c; } }
  if (!best) { g.debugInput = { keys: ['KeyW'], yaw: me.yaw + 0.02 }; return null; }
  const dx = best.pos.x - me.pos.x, dz = best.pos.z - me.pos.z, dy = best.pos.y + 1.25 - (me.pos.y + me.eye);
  g.debugInput = { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), fire: true, ads: bd > 12, keys: [] };
  return { d: +bd.toFixed(1), name: best.info.name };
});
let seen = 0;
for (let i = 0; i < 60 && seen < 3; i++) { const t = await aim(); if (t) { seen++; console.log('target', JSON.stringify(t)); await page.waitForTimeout(350); await aim(); await page.waitForTimeout(250); await shot('fight' + seen); } else await page.waitForTimeout(400); }
await page.evaluate(() => { window.__irontide.game.debugInput = { keys: ['Tab'] }; });
await page.waitForTimeout(600); await shot('scores');
console.log(JSON.stringify(await page.evaluate(() => { const g = window.__irontide.game; return { hp: g.me.hp, alive: g.me.alive, roster: [...g.roster.values()].map((r) => `${r.name}:${r.k}/${r.d}`).join(' '), calls: g.engine.renderer.info.render.calls, tris: g.engine.renderer.info.render.triangles }; })));
console.log('errors:', errs.length);
await browser.close();
