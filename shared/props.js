// Prop catalogue: model bounds (metres, from the glTF files) and how each collides.
// min/max are the model-space bounding box; props are placed with their base on the given y.
const P = (min, max, surf = 'metal', collide = true, extra = {}) => ({ min, max, surf, collide, ...extra });
export const PROP_DEFS = {
  Barrel_01: P([-0.28, -0.01, -0.28], [0.28, 0.87, 0.28]),
  barrel_03: P([-0.32, 0, -0.32], [0.32, 0.93, 0.32]),
  wooden_crate_02: P([-0.26, -0.03, -0.58], [0.26, 0.44, 0.58], 'wood'),
  old_military_crate: P([-0.53, -0.10, -0.23], [0.40, 0.26, 0.46], 'wood'),
  wooden_military_crate: P([-0.62, -0.03, -0.26], [0.62, 0.38, 0.47], 'wood'),
  concrete_road_barrier: P([-0.77, -0.01, -0.29], [0.77, 0.82, 0.34], 'concrete'),
  metal_jerrycan: P([-0.17, 0, -0.09], [0.18, 0.46, 0.08], 'metal', false),
  ammo_box: P([-0.04, -0.02, -0.13], [0.04, 0.16, 0.13], 'metal', false),
  medical_box: P([-0.26, -0.04, -0.17], [0.26, 0.08, 0.35], 'metal', false),
  propane_tank: P([-0.17, 0, -0.17], [0.17, 0.55, 0.17]),
  portable_generator: P([-0.41, -0.01, -0.28], [0.40, 0.58, 0.28]),
  old_tyre: P([-0.30, -0.30, -0.08], [0.30, 0.30, 0.08], 'rubber', false),
  hand_truck: P([-0.30, 0, -0.10], [0.30, 1.40, 0.60], 'metal', true, { bullet: false, sight: false }),
  street_lamp_01: P([-0.35, 0, -0.19], [0.35, 3.87, 0.19], 'metal', true, { colMin: [-0.09, 0, -0.09], colMax: [0.09, 3.6, 0.09] }),
  lifebuoy: P([-0.39, -0.46, -0.07], [0.39, 0.38, 0.08], 'rubber', false),
  ocean_buoy: P([-0.48, -0.81, -0.48], [0.59, 1.85, 0.48]),
  cement_bag: P([-0.23, 0, -0.35], [0.23, 0.18, 0.35], 'dirt'),
  plastic_crate_01: P([-0.15, 0, -0.20], [0.15, 0.26, 0.20], 'wood', false),
  security_light: P([-0.16, -0.36, -0.03], [0.16, 0.17, 0.39], 'metal', false),
  exterior_aircon_unit: P([-0.39, -0.32, -0.22], [0.41, 0.61, 0.16], 'metal', false),
  power_box_01: P([-0.17, -0.25, -0.05], [0.33, 0.25, 0.05], 'metal', false),
  trashbag: P([-0.26, 0, -0.24], [0.27, 0.57, 0.22], 'dirt'),
  utility_box_01: P([-0.26, 0, -0.21], [0.26, 1.12, 0.22]),
  cardboard_box_01: P([-0.19, -0.18, -0.23], [0.19, 0.16, 0.29], 'wood'),
  metal_tool_chest: P([-0.34, -0.19, -0.16], [0.34, 0.31, 0.15]),
  industrial_storage_cart: P([-0.80, 0, -0.55], [0.80, 1.38, 0.55]),
  vintage_radio_transceiver: P([-0.18, -0.11, -0.23], [0.30, 0.33, 0.17], 'metal', false),
  // Breakers
  portable_welding_cart: P([-0.42, 0, -0.39], [0.42, 1.56, 0.27]),
  small_lpg_tank: P([-0.20, 0, -0.20], [0.21, 0.64, 0.20]),
  Barrel_02: P([-0.24, 0, -0.24], [0.24, 0.88, 0.24]),
  rusted_wheel_rim_01: P([-0.20, -0.20, -0.08], [0.20, 0.20, 0.08], 'metal', false),
  lateral_sea_marker: P([-1.50, -1.28, -1.50], [1.50, 5.56, 1.50], 'metal', true, { colMin: [-1.1, -1.28, -1.1], colMax: [1.1, 1.6, 1.1] }),
  // Crosswind
  covered_car: P([-0.85, 0, -2.17], [0.94, 1.41, 2.21], 'dirt'),
  tool_cart: P([-0.66, 0, -0.38], [0.62, 0.96, 0.37]),
  steel_frame_shelves_01: P([-5.49, -0.01, -2.51], [5.49, 21.39, 2.51], 'metal', true, { scale: 0.1 }),      // the file is ten times life size
  utility_box_02: P([-0.46, 0, -0.21], [0.46, 1.12, 0.22]),
  metal_jerrycan_green: P([-0.19, 0, -0.09], [0.17, 0.50, 0.09], 'metal', false),
  concrete_road_barrier_02: P([-0.78, 0, -0.25], [0.79, 1.11, 0.19], 'concrete'),
};

export const CONTAINER = { L: 6.06, H: 2.59, W: 2.44 };
/** A container's doors: where a hinge sits (±x at an end, ±z from the centre line), how wide a leaf is, and the leaf's bottom and top edge. */
export const DOOR = { hingeX: CONTAINER.L / 2 - 0.035, hingeZ: CONTAINER.W / 2 - 0.16, leaf: CONTAINER.W / 2 - 0.166, y0: 0.125, y1: CONTAINER.H - 0.135 };

/** Expands a level description into the flat collider list used by World. */
export function levelColliders(level) {
  const out = [];
  for (const s of level.solids) {
    if (s.collide === false) continue;
    out.push({ c: s.c, h: s.h, yaw: s.yaw, surf: s.surf, solid: s.solid, bullet: s.bullet, sight: s.sight });
  }
  for (const c of level.containers || []) out.push(...containerBoxes(c));
  for (const p of level.props || []) {
    const d = PROP_DEFS[p.model];
    if (!d || !d.collide || p.collide === false) continue;
    const s = (p.scale || 1) * (d.scale || 1), mn = d.colMin || d.min, mx = d.colMax || d.max;
    const hx = (mx[0] - mn[0]) / 2 * s, hy = (mx[1] - mn[1]) / 2 * s, hz = (mx[2] - mn[2]) / 2 * s;
    const ox = (mx[0] + mn[0]) / 2 * s, oz = (mx[2] + mn[2]) / 2 * s;
    const yaw = p.yaw || 0, cs = Math.cos(yaw), sn = Math.sin(yaw);
    out.push({
      c: [p.x + ox * cs + oz * sn, p.y + (mx[1] - d.min[1]) * s - hy - (mx[1] - mn[1] > 0 ? 0 : 0), p.z - ox * sn + oz * cs],
      h: [hx, hy, hz], yaw, surf: d.surf, bullet: d.bullet, sight: d.sight,
    });
  }
  return out;
}

const hash = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };
/**
 * The four door leaves of an open container, swung back past its corners, in the container's own frame: the hinge at
 * (x, z), the leaf turned by `a` about +y from pointing along `dir`·z. The picture (client/src/containers.js) and
 * the colliders below are both made from this.
 */
export function openLeaves(c) {
  const out = [];
  for (const end of [1, -1]) {
    const k = end > 0 ? 1 : 2, turn = end > 0 ? 0 : Math.PI;
    out.push({ x: end * DOOR.hingeX, z: end * DOOR.hingeZ, a: turn - 1.85 - hash(c.x, k, c.z) * 0.25, dir: -1 });
    out.push({ x: end * DOOR.hingeX, z: -end * DOOR.hingeZ, a: turn + 1.95 + hash(c.z, k, c.x) * 0.22, dir: 1 });
  }
  return out;
}

export function containerBoxes(c) {
  const { L, H, W } = CONTAINER, yaw = c.yaw || 0, y = c.y || 0;
  if (!c.open) return [{ c: [c.x, y + H / 2, c.z], h: [L / 2, H / 2, W / 2], yaw, surf: 'metal' }];
  const cs = Math.cos(yaw), sn = Math.sin(yaw), t = 0.08;
  const at = (lx, ly, lz, hx, hy, hz, turn = 0) => ({ c: [c.x + lx * cs + lz * sn, y + ly, c.z - lx * sn + lz * cs], h: [hx, hy, hz], yaw: yaw + turn, surf: 'metal' });
  const out = [
    at(0, 0.07, 0, L / 2, 0.07, W / 2),                  // floor
    at(0, H - t / 2, 0, L / 2, t / 2, W / 2),            // roof
    at(0, H / 2, -W / 2 + t / 2, L / 2, H / 2, t / 2),   // sides
    at(0, H / 2, W / 2 - t / 2, L / 2, H / 2, t / 2),
  ];
  for (const f of openLeaves(c)) {                       // the door leaves
    const mid = f.dir * DOOR.leaf / 2;
    out.push(at(f.x + mid * Math.sin(f.a), (DOOR.y0 + DOOR.y1) / 2, f.z + mid * Math.cos(f.a), 0.03, (DOOR.y1 - DOOR.y0) / 2, DOOR.leaf / 2, f.a));
  }
  return out;
}
