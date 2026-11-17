// Builds light-weight versions of the scanned Poly Haven props:  node scripts/optimize-models.mjs [modelId ...]
// The originals are 5k–90k triangles each (a road barrier alone is 61k). For every model this writes
// <id>/<id>.lod.gltf (+ .lod.bin and 1k lod_*.jpg textures) next to the original. The game loads the
// .lod version for level props and keeps the originals for the first-person weapons.
// 2k textures on ~70 small props would otherwise cost well over 1 GB of video memory.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, dedup, prune, join, flatten, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../public/assets/models/', import.meta.url));
// triangle budget per model (default below); small or already light models are left alone
const BUDGET = { default: 3500, concrete_road_barrier: 2600, street_lamp_01: 5000, modular_chainlink_fence: 9000, portable_generator: 6000, vintage_radio_transceiver: 6000, industrial_storage_cart: 5000, hand_truck: 4000, exterior_aircon_unit: 4000,
  // placed by the dozen on the large levels, so they are kept lighter
  concrete_road_barrier_02: 1100, metal_jerrycan_green: 900, steel_frame_shelves_01: 1600, small_lpg_tank: 1500, rusted_wheel_rim_01: 800, utility_box_02: 1500, tool_cart: 2400, portable_welding_cart: 2600, lateral_sea_marker: 2400 };
const SKIP = new Set(['service_pistol', 'bolt_action_rifle_7_62']);          // viewed up close in first person
const TEX = 1024;

const tris = (doc) => { let n = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) n += (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3; return Math.round(n); };

await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const only = process.argv.slice(2);
for (const id of readdirSync(root)) {
  const src = `${root}${id}/${id}.gltf`;
  if (!existsSync(src) || !statSync(`${root}${id}`).isDirectory() || SKIP.has(id) || (only.length && !only.includes(id))) continue;
  const doc = await io.read(src);
  const before = tris(doc), budget = BUDGET[id] ?? BUDGET.default;
  await doc.transform(dedup(), flatten(), join({ keepNamed: false }), weld());
  if (before > budget * 1.15) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: budget / before, error: 0.02, lockBorder: false }));
  await doc.transform(prune());
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [TEX, TEX], quality: 86 }));
  doc.getRoot().listTextures().forEach((t, i) => t.setURI(`lod_${i}.jpg`));
  doc.getRoot().listBuffers().forEach((b, i) => b.setURI(`${id}.lod${i || ''}.bin`));
  await io.write(`${root}${id}/${id}.lod.gltf`, doc);
  console.log(`${id.padEnd(28)} ${String(before).padStart(6)} -> ${String(tris(doc)).padStart(6)} tris, ${doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().length, 0)} draw(s), ${doc.getRoot().listTextures().length} textures @ ${TEX}px`);
}
