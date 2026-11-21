// Downloads the CC0 assets (Poly Haven) + the animated soldier (three.js examples) into public/assets.
// Re-runnable: files that already exist are skipped.  Usage: npm run assets
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');
const API = 'https://api.polyhaven.com/files/';

export const TEXTURES = [
  'concrete_floor_worn_001', 'asphalt_02', 'concrete_wall_008', 'container_side',
  'corrugated_iron_02', 'rusty_metal_02', 'metal_plate', 'wood_planks_grey',
  'red_brick_03', 'concrete_pavement_02', 'painted_concrete', 'rusty_metal_grid', 'gravel_concrete_03',
  'coast_sand_01', 'damp_beach_sand', 'rusty_metal_sheet', 'rusty_painted_metal',                       // Breakers
  'aerial_asphalt_01', 'hangar_concrete_floor', 'sparse_grass', 'box_profile_metal_sheet',               // Crosswind
  'cobblestone_05', 'painted_plaster_wall', 'grey_roof_tiles_02',                                        // Ropewalk
];
export const MODELS = [
  'Barrel_01', 'barrel_03', 'wooden_crate_02', 'old_military_crate', 'wooden_military_crate',
  'concrete_road_barrier', 'metal_jerrycan', 'ammo_box', 'medical_box', 'propane_tank',
  'portable_generator', 'old_tyre', 'hand_truck', 'street_lamp_01', 'lifebuoy', 'ocean_buoy',
  'modular_chainlink_fence', 'cement_bag', 'plastic_crate_01', 'security_light',
  'exterior_aircon_unit', 'power_box_01', 'trashbag', 'cardboard_box_01', 'metal_tool_chest',
  'industrial_storage_cart', 'vintage_radio_transceiver', 'utility_box_01',
  'portable_welding_cart', 'small_lpg_tank', 'Barrel_02', 'rusted_wheel_rim_01', 'lateral_sea_marker',  // Breakers
  'covered_car', 'tool_cart', 'steel_frame_shelves_01', 'utility_box_02', 'metal_jerrycan_green', 'concrete_road_barrier_02',   // Crosswind
];
export const HDRIS = ['industrial_sunset_02_puresky', 'belfast_sunset_puresky', 'kloofendal_48d_partly_cloudy_puresky', 'syferfontein_18d_clear_puresky'];

const exists = (p) => stat(p).then((s) => s.size > 0, () => false);
async function dl(url, dest) {
  if (await exists(dest)) return false;
  await mkdir(dirname(dest), { recursive: true });
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status + ' ' + url);
      await writeFile(dest, Buffer.from(await r.arrayBuffer()));
      return true;
    } catch (e) { if (i === 3) throw e; await new Promise((r) => setTimeout(r, 1000 * (i + 1))); }
  }
}
const info = async (id) => (await fetch(API + id)).json();

async function texture(id, res = '2k') {
  const f = await info(id);
  const maps = { diff: f.Diffuse, nor: f.nor_gl, arm: f.arm };
  for (const [k, m] of Object.entries(maps)) {
    if (!m) { console.warn('  missing map', id, k); continue; }
    await dl(m[res].jpg.url, join(ROOT, 'tex', `${id}_${k}.jpg`));
  }
}
async function model(id, res = '1k') {
  const f = await info(id);
  const g = f.gltf[res].gltf;
  const dir = join(ROOT, 'models', id);
  await dl(g.url, join(dir, id + '.gltf'));
  for (const [rel, inc] of Object.entries(g.include || {})) await dl(inc.url, join(dir, rel));
}
async function hdri(id) {
  const f = await info(id);
  await dl(f.hdri['4k'].hdr.url, join(ROOT, 'hdri', id + '.hdr'));
}
async function pool(items, fn, n = 6) {
  const q = [...items];
  await Promise.all(Array.from({ length: n }, async () => {
    while (q.length) { const it = q.shift(); try { await fn(it); console.log('ok', it); } catch (e) { console.error('FAILED', it, e.message); process.exitCode = 1; } }
  }));
}

await pool(TEXTURES, (t) => texture(t));
await pool(MODELS, (m) => model(m));
await pool(HDRIS, hdri, 3);
await dl('https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/models/gltf/Soldier.glb', join(ROOT, 'models', 'Soldier.glb'));
await dl('https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/textures/waternormals.jpg', join(ROOT, 'tex', 'waternormals.jpg'));
// rigged anatomical hand (MIT, WebXR Input Profiles) — the base of the first-person gloves
await dl('https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0.20/dist/profiles/generic-hand/right.glb', join(ROOT, 'models', 'hand', 'right.glb'));
console.log('assets ready in', ROOT);
