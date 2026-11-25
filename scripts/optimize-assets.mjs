// Builds what the game ships (public/assets/) from the downloads (assets-src/):
//   node scripts/optimize-assets.mjs                  whatever is missing or older than its download
//   node scripts/optimize-assets.mjs <name> ...       those again: a texture set (asphalt_02), a prop or a sky
//   node scripts/optimize-assets.mjs --force          everything again
// - A surface texture (2k JPEG, 1–5 MB) becomes an AVIF of the same size in pixels; together they are a third of the bytes.
// - A sky (.hdr) becomes a .sky: the same values to the last bit, packed tighter (client/src/sky.js reads it).
// - A scanned prop becomes <id>.lod.gltf: its 5k–90k triangles cut to a budget (a road barrier alone is 61k) and its
//   textures 1k AVIFs. 2k textures on ~70 small props would cost well over 1 GB of video memory.
// Everything is also built again after a number below changed.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, dedup, prune, join, flatten, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const SRC = fileURLToPath(new URL('../assets-src/', import.meta.url)), OUT = fileURLToPath(new URL('../public/assets/', import.meta.url));

// AVIF quality of every texture, with full-resolution colour (4:4:4: a normal map keeps its direction in the colour).
// At 80 a 2k texture differs from its download by 2–3 of 255 steps on average. scripts/load-test.mjs shows what a start downloads.
const QUALITY = 80, EFFORT = 2;                 // effort 4 takes seven times as long for the same bytes
const TEX = 1024;                                 // edge of a prop's textures, px
// triangle budget per prop (default below); small or already light props are left alone
const BUDGET = { default: 3500, concrete_road_barrier: 2600, street_lamp_01: 5000, modular_chainlink_fence: 9000, portable_generator: 6000, vintage_radio_transceiver: 6000, industrial_storage_cart: 5000, hand_truck: 4000, exterior_aircon_unit: 4000,
  // placed by the dozen on the large levels, so they are kept lighter
  concrete_road_barrier_02: 1100, metal_jerrycan_green: 900, steel_frame_shelves_01: 1600, small_lpg_tank: 1500, rusted_wheel_rim_01: 800, utility_box_02: 1500, tool_cart: 2400, portable_welding_cart: 2600, lateral_sea_marker: 2400 };
const FULL = ['ammo_box'];                        // props the game also shows as scanned (the pickups): <id>.gltf beside the .lod
const AS_IS = ['models/Soldier.glb', 'models/hand/right.glb'];

if (!existsSync(SRC + 'tex')) { console.error('assets-src/ holds no downloads. Run "npm run assets": it downloads them, or takes over those of a checkout from before assets-src/ existed.'); process.exit(1); }
const args = process.argv.slice(2), only = args.filter((a) => !a.startsWith('--'));
const stamp = JSON.stringify({ format: 1, QUALITY, EFFORT, TEX, BUDGET, FULL }), stampFile = OUT + '.built';
const changed = !existsSync(stampFile) || readFileSync(stampFile, 'utf8') !== stamp, all = changed || (args.includes('--force') && !only.length);
if (changed) { console.log('first build, or a setting changed: building everything'); rmSync(OUT, { recursive: true, force: true }); }
const wanted = (name) => all || !only.length || only.includes(name);
const stale = (out, src) => all || only.length > 0 || !existsSync(out) || statSync(out).mtimeMs < statSync(src).mtimeMs;
const size = (dir) => readdirSync(dir, { withFileTypes: true, recursive: true }).reduce((n, e) => n + (e.isFile() ? statSync(`${e.parentPath}/${e.name}`).size : 0), 0);
const mb = (n) => (n / 1e6).toFixed(1) + ' MB';
/** Runs the jobs a few at a time: an AVIF encode keeps several cores busy for seconds. */
async function pool(jobs, n = Math.max(2, availableParallelism() >> 2)) { const q = [...jobs]; await Promise.all(Array.from({ length: n }, async () => { while (q.length) await q.shift()(); })); }
const avif = (image) => image.avif({ quality: QUALITY, effort: EFFORT, chromaSubsampling: '4:4:4' });

// ---- surface textures
mkdirSync(OUT + 'tex', { recursive: true });
let made = 0;
await pool(readdirSync(SRC + 'tex').filter((f) => f.endsWith('.jpg')).map((f) => async () => {
  const src = SRC + 'tex/' + f, out = OUT + 'tex/' + f.replace(/\.jpg$/, '.avif');
  if (!wanted(f.replace(/(_diff|_nor|_arm)?\.jpg$/, '')) || !stale(out, src)) return;
  await avif(sharp(src)).toFile(out); made++;
  console.log(`${f.padEnd(40)} ${mb(statSync(src).size).padStart(8)} -> ${mb(statSync(out).size).padStart(7)}`);
}));

// ---- skies
/** The pixels of a Radiance .hdr as it stores them: four bytes each (red, green, blue, shared exponent), rows from the top. */
function rgbe(buf) {
  let p = 0; const line = () => { let s = ''; while (buf[p] !== 10) s += String.fromCharCode(buf[p++]); p++; return s; };
  while (line() !== '') { /* header */ }
  const m = line().match(/^-Y (\d+) \+X (\d+)$/); if (!m) throw new Error('rows are not stored from the top, left to right');
  const H = +m[1], W = +m[2], data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    if (buf[p] !== 2 || buf[p + 1] !== 2 || ((buf[p + 2] << 8) | buf[p + 3]) !== W) throw new Error('rows are not run-length coded');
    p += 4;
    for (let c = 0; c < 4; c++) for (let x = 0; x < W;) { let n = buf[p++]; if (n > 128) { n -= 128; const v = buf[p++]; while (n--) data[(y * W + x++) * 4 + c] = v; } else while (n--) data[(y * W + x++) * 4 + c] = buf[p++]; }
  }
  return { W, H, data };
}
/**
 * A .sky file is gzip of: "SKY1", width, height (32 bits each, low byte first), then the red bytes of all pixels, the green,
 * the blue, the exponents, each byte as its difference from the one left of it. A sky is smooth, so the differences are
 * small and repeat: the file is a third of the .hdr.
 */
function sky({ W, H, data }) {
  const n = W * H, out = new Uint8Array(12 + n * 4), view = new DataView(out.buffer);
  out.set([83, 75, 89, 49]); view.setUint32(4, W, true); view.setUint32(8, H, true);
  for (let c = 0; c < 4; c++) for (let y = 0; y < H; y++) for (let x = 0, left = 0; x < W; x++) { const v = data[(y * W + x) * 4 + c]; out[12 + c * n + y * W + x] = (v - left) & 255; left = v; }
  return gzipSync(out, { level: 9 });
}
mkdirSync(OUT + 'hdri', { recursive: true });
for (const f of readdirSync(SRC + 'hdri').filter((f) => f.endsWith('.hdr'))) {
  const src = SRC + 'hdri/' + f, out = OUT + 'hdri/' + f.replace(/\.hdr$/, '.sky');
  if (!wanted(f.replace(/\.hdr$/, '')) || !stale(out, src)) continue;
  writeFileSync(out, sky(rgbe(readFileSync(src)))); made++;
  console.log(`${f.padEnd(40)} ${mb(statSync(src).size).padStart(8)} -> ${mb(statSync(out).size).padStart(7)}`);
}

// ---- props
const tris = (doc) => { let n = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) n += (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3; return Math.round(n); };
const textures = (resize) => textureCompress({ encoder: sharp, targetFormat: 'avif', quality: QUALITY, effort: EFFORT * 100 / 9, chromaSubsampling: '4:4:4', ...(resize ? { resize: [resize, resize] } : {}) });
/** Names a document's files and writes it: the .gltf, its buffer and its textures side by side. */
async function write(io, doc, file, tag) {
  const id = file.split('/').pop().replace(/(\.lod)?\.gltf$/, '');
  doc.getRoot().listTextures().forEach((t, i) => t.setURI(`${tag}_${i}.avif`));
  doc.getRoot().listBuffers().forEach((b, i) => b.setURI(`${id}${tag === 'lod' ? '.lod' : ''}${i || ''}.bin`));
  await io.write(file, doc);
}
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await pool(readdirSync(SRC + 'models').map((id) => async () => {
  const src = `${SRC}models/${id}/${id}.gltf`, dir = `${OUT}models/${id}/`, out = `${dir}${id}.lod.gltf`;
  if (!existsSync(src) || !wanted(id) || !stale(out, src)) return;
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const doc = await io.read(src), before = tris(doc), budget = BUDGET[id] ?? BUDGET.default;
  await doc.transform(dedup(), flatten(), join({ keepNamed: false }), weld());
  if (before > budget * 1.15) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: budget / before, error: 0.02, lockBorder: false }));
  await doc.transform(prune(), textures(TEX));
  await write(io, doc, out, 'lod'); made++;
  if (FULL.includes(id)) { const full = await io.read(src); await full.transform(textures()); await write(io, full, `${dir}${id}.gltf`, 'full'); }
  console.log(`${id.padEnd(28)} ${String(before).padStart(6)} -> ${String(tris(doc)).padStart(6)} tris, ${doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().length, 0)} draw(s), ${doc.getRoot().listTextures().length} textures @ ${TEX}px, ${mb(size(dir))}`);
}));
for (const f of AS_IS) if ((all || !only.length) && stale(OUT + f, SRC + f)) { mkdirSync(dirname(OUT + f), { recursive: true }); copyFileSync(SRC + f, OUT + f); made++; }

writeFileSync(stampFile, stamp);
console.log(`${made} file${made === 1 ? '' : 's'} built. assets-src/ ${mb(size(SRC))} -> public/assets/ ${mb(size(OUT))}`);
