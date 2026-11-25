// What a first visit costs: opens the game with an empty cache and prints what it downloads and where the time goes.
//   node scripts/load-test.mjs <url> [level] [Mbit/s]
// level: the level behind the menu (default: the game's own). Mbit/s: also slow the download to that rate, 100 ms away.
// Exits 1 when the page logs an error, when the download is over BUDGET_MB, or when more than LATE programs are compiled
// while the first frame is drawn (each one stops the game until it is compiled; the rest compile behind the loading screen).
import { launch } from './browser.mjs';

const BUDGET_MB = 60, LATE = 8;                 // the heaviest level, Ropewalk, is 57 MB; a frame compiles 5 programs late
const [base, level = '', mbit = '0'] = process.argv.slice(2);
if (!base) { console.error('usage: node scripts/load-test.mjs <url> [level] [Mbit/s]'); process.exit(1); }

const { browser, page, errors } = await launch();
const cdp = await page.context().newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
if (+mbit > 0) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: (+mbit * 1e6) / 8, uploadThroughput: 1e6 });
const files = new Map();
cdp.on('Network.requestWillBeSent', (e) => files.set(e.requestId, { path: new URL(e.request.url).pathname }));
cdp.on('Network.responseReceived', (e) => { const f = files.get(e.requestId); if (f) f.packed = e.response.headers['content-encoding'] || e.response.headers['Content-Encoding'] || ''; });
cdp.on('Network.loadingFinished', (e) => { const f = files.get(e.requestId); if (f) f.bytes = e.encodedDataLength; });

const kind = (p) => (p.includes('/hdri/') ? 'sky' : p.includes('/tex/') ? 'surface textures' : p.includes('/models/') ? (/\.(gltf|glb|bin)$/.test(p) ? 'models' : 'prop textures') : p.endsWith('.js') ? 'code' : p.endsWith('.woff2') ? 'fonts' : 'page');
const mb = (n) => (n / 1e6).toFixed(2).padStart(7) + ' MB';

const t0 = Date.now();
await page.goto(`${base.replace(/\/$/, '')}/${level ? '?level=' + level : ''}`);
await page.waitForFunction(() => !document.querySelector('#menu').classList.contains('hidden') && document.querySelector('#loading').classList.contains('hidden'));
const seconds = (Date.now() - t0) / 1000;
await page.waitForTimeout(1000);                                         // fonts the canvas asks for late
const got = [...files.values()].filter((f) => f.bytes != null), total = got.reduce((n, f) => n + f.bytes, 0), by = {};
for (const f of got) { const k = kind(f.path); by[k] ||= { n: 0, bytes: 0 }; by[k].n++; by[k].bytes += f.bytes; }
const state = await page.evaluate(() => ({ level: window.__irontide.game ? document.querySelector('#tbLevel').textContent : '', marks: performance.getEntriesByType('measure').map((m) => [m.name, Math.round(m.duration)]), stats: window.__irontide.engine.stats }));

console.log(`${state.level}: the menu after ${seconds.toFixed(1)} s${+mbit ? ` at ${mbit} Mbit/s` : ''} · ${got.length} files, ${mb(total).trim()}`);
for (const [k, v] of Object.entries(by).sort((a, b) => b[1].bytes - a[1].bytes)) console.log(`  ${k.padEnd(18)} ${String(v.n).padStart(4)} files ${mb(v.bytes)}`);
console.log('  largest: ' + got.sort((a, b) => b.bytes - a.bytes).slice(0, 5).map((f) => `${f.path.split('/').pop()} ${mb(f.bytes).trim()}${f.packed ? ' (' + f.packed + ')' : ''}`).join(', '));
console.log('  ' + state.marks.map(([name, ms]) => `${name} ${(ms / 1000).toFixed(1)} s`).join(' · '));
const late = state.stats.late || [];
console.log(`  shader programs: ${state.stats.programs}, compiled while drawing: ${late.length}${late.length ? ' (' + [...new Set(late)].join(', ') + ')' : ''}`);
console.log('errors:', errors.length);
await browser.close();
const fail = [errors.length && 'the page logged an error', total > BUDGET_MB * 1e6 && `the download is over ${BUDGET_MB} MB`, late.length > LATE && `${late.length} programs were compiled while drawing (${LATE} allowed)`].filter(Boolean);
if (fail.length) { console.error('FAILED: ' + fail.join('; ')); process.exit(1); }
