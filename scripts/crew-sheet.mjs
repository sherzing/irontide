// Every crew (shared/crews.js) on one sheet, front and back, to judge a repaint or a piece of kit.
//   node scripts/crew-sheet.mjs <out.jpg> [crew ...]      all crews, or the ones named
// Needs the dev server: npx vite --port 5177 (BASE overrides the address).
import { launch } from './browser.mjs';
import { writeFileSync } from 'node:fs';
const [out, ...only] = process.argv.slice(2);
const { browser, page, errors } = await launch();
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5177'}/?q=low`);
await page.waitForFunction(() => window.__irontide?.chars.looks);
const img = await page.evaluate(async (only) => {
  const { chars } = window.__irontide;
  const crews = window.__irontide.crews, ids = only.length ? only : Object.keys(crews), cw = Math.floor(1600 / ids.length), ch = Math.round(cw * 1.7);
  const c = document.createElement('canvas'); c.style.cssText = `position:fixed;left:0;top:0;width:${cw}px;height:${ch}px;z-index:-1`; document.body.append(c);
  const p = chars.preview(c), sheet = document.createElement('canvas'); sheet.width = cw * ids.length; sheet.height = ch * 2 + 26;
  const g = sheet.getContext('2d'); g.fillStyle = '#20262c'; g.fillRect(0, 0, sheet.width, sheet.height);
  ids.forEach((id, i) => {
    p.show(id);
    for (const [row, a] of [[0, 0.4], [1, Math.PI - 0.4]]) { p.face(a); p.frame(row ? 0 : 0.3, 0); g.drawImage(c, i * cw, 26 + row * ch, cw, ch); }
    g.fillStyle = crews[id].side === 1 ? '#8fc4ff' : crews[id].side === 2 ? '#ff9a80' : '#ddd'; g.font = '600 15px system-ui'; g.textAlign = 'center'; g.fillText(crews[id].name, i * cw + cw / 2, 18);
  });
  return sheet.toDataURL('image/jpeg', 0.9);
}, only);
writeFileSync(out, Buffer.from(img.split(',')[1], 'base64'));
console.log('errors:', errors.length);
await browser.close();
