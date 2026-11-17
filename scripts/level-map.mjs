// Top-down plan of a level (colliders, spawns, objectives) as a PNG:  node scripts/level-map.mjs <out.png> [levelId] [scale px/m]
import { launch } from './browser.mjs';
import { LEVELS, DEFAULT_LEVEL } from '../shared/levels/index.js';
import { levelColliders, CONTAINER } from '../shared/props.js';
const [out, id = DEFAULT_LEVEL, sc = '12'] = process.argv.slice(2);
const level = LEVELS[id], b = level.bounds, S = +sc, pad = 16;
const X0 = b.minX - pad, Z0 = b.minZ - pad, W = (b.maxX - b.minX + pad * 2) * S, H = (b.maxZ - b.minZ + pad * 2) * S;
const { browser, page } = await launch({ width: Math.ceil(W), height: Math.ceil(H) });
await page.setContent(`<body style="margin:0;background:#101418"><canvas id=c width=${Math.ceil(W)} height=${Math.ceil(H)}></canvas></body>`);
await page.evaluate(({ level, cols, X0, Z0, S, L, Wc }) => {
  const g = document.getElementById('c').getContext('2d'); const px = (x) => (x - X0) * S, pz = (z) => (z - Z0) * S;
  g.strokeStyle = '#2a3440'; g.lineWidth = 1; g.font = '10px sans-serif'; g.fillStyle = '#5a6a7a';
  for (let x = Math.ceil(X0 / 10) * 10; x < X0 + 400; x += 10) { g.beginPath(); g.moveTo(px(x), 0); g.lineTo(px(x), 5000); g.stroke(); g.fillText(x, px(x) + 2, 10); }
  for (let z = Math.ceil(Z0 / 10) * 10; z < Z0 + 400; z += 10) { g.beginPath(); g.moveTo(0, pz(z)); g.lineTo(5000, pz(z)); g.stroke(); g.fillText(z, 2, pz(z) - 2); }
  const rect = (c, h, yaw, fill, stroke) => { g.save(); g.translate(px(c[0]), pz(c[2])); g.rotate(-(yaw || 0)); if (fill) { g.fillStyle = fill; g.fillRect(-h[0] * S, -h[2] * S, h[0] * 2 * S, h[2] * 2 * S); } if (stroke) { g.strokeStyle = stroke; g.strokeRect(-h[0] * S, -h[2] * S, h[0] * 2 * S, h[2] * 2 * S); } g.restore(); };
  for (const s of level.solids) { const top = s.c[1] + s.h[1]; if (top <= 0.05) { rect(s.c, s.h, s.yaw, s.mat === 'wood' ? '#3a3020' : '#1b2026'); continue; } }
  for (const s of level.solids) { const top = s.c[1] + s.h[1]; if (top <= 0.05) continue; const low = s.c[1] - s.h[1] > 2.3; rect(s.c, s.h, s.yaw, s.collide === false ? null : low ? 'rgba(90,110,140,0.25)' : top < 1.3 ? '#55606c' : '#8a96a3', s.collide === false ? '#3d4a58' : '#aab'); }
  for (const c of level.containers) { rect([c.x, 0, c.z], [L / 2, 0, Wc / 2], c.yaw, c.deco ? 'rgba(0,0,0,0)' : (c.y ? 'rgba(0,0,0,0)' : c.color), c.y ? '#fff' : '#000'); if (c.open) rect([c.x, 0, c.z], [L / 2 - .3, 0, Wc / 2 - .3], c.yaw, '#101418'); }
  for (const p of level.props) { g.fillStyle = '#d9a441'; g.beginPath(); g.arc(px(p.x), pz(p.z), 3, 0, 7); g.fill(); }
  for (const l of level.lights) { g.strokeStyle = '#ffe08a'; g.beginPath(); g.arc(px(l.pos[0]), pz(l.pos[2]), 6, 0, 7); g.stroke(); }
  const dot = (p, col, t) => { g.fillStyle = col; g.beginPath(); g.arc(px(p.x ?? p[0]), pz(p.z ?? p[p.length - 1 === 1 ? 1 : 2]), 4, 0, 7); g.fill(); if (t) g.fillText(t, px(p.x ?? p[0]) + 6, pz(p.z ?? p[p.length === 2 ? 1 : 2]) + 3); };
  for (const s of level.spawns.dm) dot(s, '#4fd8c4'); for (const s of level.spawns.team1) dot(s, '#7fb8ff'); for (const s of level.spawns.team2) dot(s, '#ff8a70');
  level.pickups.forEach((p) => dot(p, '#fff', 'ammo'));
  const cp = level.campaign; if (cp) { dot(cp.start, '#0f0', 'START'); cp.stages.forEach((st, i) => { if (st.at) dot({ x: st.at[0], z: st.at[2] }, '#ff0', 'OBJ' + (i + 1)); for (const e of [...(st.enemies || []), ...((st.waves || []).flatMap((w) => w.enemies))]) dot({ x: e.at[0], z: e.at[1] }, '#f0f'); }); }
  g.strokeStyle = '#4fd8c4'; g.strokeRect(px(level.bounds.minX), pz(level.bounds.minZ), (level.bounds.maxX - level.bounds.minX) * S, (level.bounds.maxZ - level.bounds.minZ) * S);
}, { level: JSON.parse(JSON.stringify(level)), X0, Z0, S, L: CONTAINER.L, Wc: CONTAINER.W });
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
