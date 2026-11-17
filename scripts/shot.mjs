// node scripts/shot.mjs <outPrefix> <url> [more "name=url" ...]   — headless screenshots via Playwright's Chromium
import { launch } from './browser.mjs';
const { browser, page } = await launch();
const [prefix, ...shots] = process.argv.slice(2);
let i = 0;
for (const s of shots) {
  const [name, url] = s.includes('=http') ? [s.slice(0, s.indexOf('=')), s.slice(s.indexOf('=') + 1)] : [String(i), s];
  await page.goto(url);
  await page.waitForFunction(() => window.__frames > (window.__needFrames || 8), null, { timeout: 180000 });
  if (process.env.EVAL) console.log(name, JSON.stringify(await page.evaluate(process.env.EVAL)));
  await page.waitForTimeout(+(process.env.WAIT || 600));
  await page.screenshot({ path: `${prefix}-${name}.jpg`, type: 'jpeg', quality: 88 });
  console.log('saved', `${prefix}-${name}.jpg`); i++;
}
await browser.close();
