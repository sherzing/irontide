// Captures every menu / HUD state for visual review: node scripts/ui-shot.mjs <outPrefix> <baseUrl> [group ...]
// groups: menu, campaign, states, dm, tdm (default: all). W/H env set the viewport.
import { launch } from './browser.mjs';
const [prefix, base, ...groups] = process.argv.slice(2);
const want = (g) => !groups.length || groups.includes(g);
const { browser, page, errors } = await launch();
const shot = async (n) => { await page.screenshot({ path: `${prefix}-${n}.jpg`, type: 'jpeg', quality: 90 }); console.log('saved', `${prefix}-${n}.jpg`); };
const frames = (n = 8) => page.waitForFunction((k) => { window.__f0 ??= window.__frames || 0; return (window.__frames || 0) - window.__f0 > k; }, n).then(() => page.evaluate(() => { window.__f0 = undefined; }));
const alive = () => page.waitForFunction(() => window.__irontide?.game.me?.alive);
const G = (fn, arg) => page.evaluate(fn, arg);

if (want('menu')) {
  await page.goto(base + '/?q=medium', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(350); await shot('loading');
  await page.waitForFunction(() => !document.querySelector('#menu').classList.contains('hidden'));
  await G(() => { localStorage.removeItem('irontide'); }); await page.reload();
  await page.waitForFunction(() => !document.querySelector('#menu').classList.contains('hidden'));
  await frames(20); await shot('menu-quick');
  await page.click('[data-opt="mode"] [data-v="campaign"]'); await frames(4); await shot('menu-campaign');
  await page.click('[data-opt="mode"] [data-v="multi"]'); await frames(4); await shot('menu-multi');
  await page.click('[data-opt="mode"] [data-v="quick"]');
  await page.click('[data-drawer="settings"]'); await page.waitForTimeout(450); await shot('menu-settings');
  await page.click('[data-drawer="controls"]'); await page.waitForTimeout(450); await shot('menu-controls');
  await page.keyboard.press('Escape'); await page.waitForTimeout(350);
  console.log('drawers closed:', await G(() => !document.querySelector('.drawer.open')));
}

if (want('campaign')) {
  await page.goto(base + '/?auto=campaign&q=medium'); await alive();
  await G(() => { window.__irontide.game.debugInput = { keys: [] }; });
  await page.waitForTimeout(1800); await shot('camp-start');
  // compass check: face north / east / toward the objective
  for (const [name, yaw] of [['north', 0], ['east', -Math.PI / 2], ['south', Math.PI], ['west', Math.PI / 2]]) {
    await G((y) => { window.__irontide.game.debugInput = { keys: [], yaw: y, pitch: 0 }; }, yaw); await frames(4);
    console.log(name, JSON.stringify(await G(() => { const h = window.__irontide.game.hud.cmp; return { heading: +h.heading.toFixed(1), markers: h.markers.map((m) => `${m.kind}@${m.bearing.toFixed(0)}/${Math.round(m.dist)}m`) }; })));
    if (name === 'east') await shot('camp-east');
  }
}

if (want('states')) {
  await page.goto(base + '/?auto=dm&bots=0&q=medium'); await alive();
  await G(() => { const g = window.__irontide.game; g.debugInput = { keys: [], yaw: -2.2, pitch: -0.04, fire: true }; });
  await page.waitForTimeout(1300); await G(() => { window.__irontide.game.debugInput.fire = false; }); await frames(3); await shot('st-fired');
  await G(() => { window.__irontide.game.startReload(); }); await page.waitForTimeout(900); await shot('st-reload');
  await page.waitForTimeout(2200);
  await G(() => { const g = window.__irontide.game, p = g.me.pos; g.me.ammo.carbine.mag = 4; g.hud.setHealth(28); g.hud.setHealth = () => {};
    g.obj = { i: 2, n: 6, kind: 'interact', text: 'Shut down the generator', at: [p.x + 40, 0.6, p.z], prompt: 'Hold F to kill the generator' }; g.hud.setObjective(g.obj); g.hud.objProgress('interact', 0.4, 0, 3);
    g.hud.subtitle('OVERWATCH', 'Generator is north-east, behind the sheet-metal screens. Kill it and their floodlights go.');
    g.hud.killfeed('You', 'Kessler', 'carbine', true, true, false); g.hud.killfeed('Marek', 'Ito', 'marksman', false, false, false);
    g.hud.chat('Voss', 'push the quay, I have the crane'); g.hud.damageFrom(1.2); });
  for (const [name, yaw] of [['objEast-faceEast', -Math.PI / 2], ['objEast-faceNorth', 0], ['objEast-faceWest', Math.PI / 2]]) {
    await G((y) => { const g = window.__irontide.game; g.debugInput = { keys: [], yaw: y, pitch: 0 }; g.hud.gunfire(g.me.pos.x + 12, g.me.pos.z - 20); g.hud.gunfire(g.me.pos.x - 30, g.me.pos.z - 4); }, yaw); await frames(4);
    console.log(name, JSON.stringify(await G(() => { const h = window.__irontide.game.hud.cmp; return { heading: +h.heading.toFixed(1), obj: h.markers.filter((m) => m.kind === 'obj').map((m) => +m.bearing.toFixed(1)) }; })));
    await shot('st-' + name);
  }
  await G(() => { const g = window.__irontide.game; g.switchWeapon('marksman'); }); await page.waitForTimeout(900); await shot('st-rifle');
  await G(() => { const g = window.__irontide.game; g.switchWeapon('pistol'); g.hud.prompt = ((f) => (t, p) => f.call(g.hud, 'Hold F to kill the generator', 0.55))(g.hud.prompt); }); await page.waitForTimeout(700); await shot('st-pistol-prompt');
  await G(() => { const g = window.__irontide.game; g.hud.death('Killed by Kessler — redeploying…'); }); await frames(2); await shot('st-death');
  await G(() => { const g = window.__irontide.game; g.hud.death(null); g.hud.banner('Mission complete', 'Time 6:42', 'Press Esc to return to the menu'); }); await frames(2); await shot('st-banner');
  await G(() => { const g = window.__irontide.game; g.hud.banner(null); g.setPaused(true); document.querySelector('#pause').classList.remove('hidden'); }); await frames(2); await shot('st-pause');
}

for (const mode of ['dm', 'tdm']) {
  if (!want(mode)) continue;
  await page.goto(`${base}/?auto=${mode}&bots=11&q=medium`); await alive();
  await G(() => { window.__irontide.game.debugInput = { keys: ['KeyW'], pitch: 0 }; });
  await page.waitForTimeout(5000); await shot(mode + '-hud');
  await G(() => { window.__irontide.game.debugInput = { keys: ['Tab'] }; }); await frames(4); await shot(mode + '-scores');
}
console.log('errors:', errors.length);
await browser.close();
