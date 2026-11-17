// DRYDOCK — a small harbour freight yard: rain clearing at golden hour, a feeder ship alongside.
// Layout (top view, +z is south / the sea):
//   north wall ─────────────────────────────────────────────
//   west containers │ warehouse (centre-north) │ generator yard + overlook (NE)
//   container lanes │ plaza with gantry crane  │ office block (E)
//   ───────────────── quay edge ── pier (SE) ── open sea ───
import { createKit } from './kit.js';

const { L, box, rbox, wall, stairs, container, prop, light, decal, pickup, spawn, dress, pallets } = createKit();
const deg = Math.PI / 180;

// ---------------------------------------------------------------- ground, quay, pier
box(-34, -28, 34, 22, -3, 0, 'ground');
box(-34, 21.55, 34, 22, 0, 0.22, 'wall');                          // quay kerb
// the rest of the terminal around the yard (out of reach, visual only)
box(-190, -150, -34, 22, -3, 0, 'ground', { collide: false }); box(34, -150, 190, 22, -3, 0, 'ground', { collide: false }); box(-34, -150, 34, -28, -3, 0, 'ground', { collide: false });
box(-190, 21.55, -34, 22, 0, 0.22, 'wall', { collide: false }); box(34, 21.55, 190, 22, 0, 0.22, 'wall', { collide: false });
box(14, 22, 18, 41, -0.35, 0.0, 'wood');                           // pier
box(11, 41, 21, 46, -0.35, 0.0, 'wood');                           // pier head
for (let z = 24; z <= 45; z += 3.5) for (const x of [14.2, 17.8]) box(x - 0.16, z - 0.16, x + 0.16, z + 0.16, -3, z > 40 ? -0.35 : 0.55, 'wood', { collide: z <= 40 });
for (const x of [11.3, 20.7]) for (const z of [41.3, 45.7]) box(x - 0.16, z - 0.16, x + 0.16, z + 0.16, -3, 0.75, 'wood');
for (const x of [-26, -14, -2, 8, 26]) rbox(x, 21.0, 0.42, 0.42, 0, 0.62, 0, 'steel', { visible: false });   // bollards (collision)
dress('bollards', { at: [[-26, 21], [-14, 21], [-2, 21], [8, 21], [26, 21], [-46, 21], [-62, 21], [-80, 21], [44, 21], [60, 21]] });
dress('fenders', { from: -84, to: 6, z: 22, step: 6 });

// ---------------------------------------------------------------- perimeter
const WALL_H = 4;
box(-34, -29, 34, -28, 0, WALL_H, 'wall');
box(34, -29, 35, 22, 0, WALL_H, 'wall');
box(-35, -29, -34, 22, 0, WALL_H, 'wall');
for (let x = -30; x <= 30; x += 6) box(x - 0.25, -28.12, x + 0.25, -27.88, 0, WALL_H + 0.12, 'wall', { collide: false });   // wall piers
for (let z = -24; z <= 18; z += 6) { box(33.88, z - 0.25, 34.12, z + 0.25, 0, WALL_H + 0.12, 'wall', { collide: false }); box(-34.12, z - 0.25, -33.88, z + 0.25, 0, WALL_H + 0.12, 'wall', { collide: false }); }
dress('razorWire', { a: [-34, -28.5], b: [34, -28.5], y: WALL_H });
dress('razorWire', { a: [34.5, -28], b: [34.5, 22], y: WALL_H });
dress('razorWire', { a: [-34.5, 22], b: [-34.5, -28], y: WALL_H });
// backdrop beyond the walls (unreachable, sells the scale): sheds, a chimney, the rest of the terminal
box(-30, -56, 2, -37, 0, 13, 'corrugated', { collide: false });
box(-30.4, -56.4, 2.4, -36.6, 13, 13.3, 'steel', { collide: false });
box(8, -52, 34, -38, 0, 9.5, 'brick', { collide: false });
box(7.7, -52.3, 34.3, -37.7, 9.5, 9.8, 'wall', { collide: false });
box(-2, -44, 3, -40, 0, 26, 'wall', { collide: false });           // chimney stack
dress('shedTrim', { x0: -30, x1: 2, z: -37, h: 13, id: 'DRYDOCK  7' });
dress('shedTrim', { x0: 8, x1: 34, z: -38, h: 9.5 });
dress('stacks', { x: 0, z: -32.4, yaw: 0, rows: 2, cols: 10, minH: 1, maxH: 3, seed: 11, holes: 0.12, face: 1 });
dress('stacks', { x: -40.6, z: -3.4, yaw: 90, rows: 3, cols: 8, minH: 1, maxH: 4, seed: 4, holes: 0.1, gapX: 0.9, face: 1 });
dress('stacks', { x: 40.6, z: -3.4, yaw: 90, rows: 3, cols: 8, minH: 2, maxH: 5, seed: 7, holes: 0.05, face: -1 });
dress('stacks', { x: -62, z: -24, yaw: 0, rows: 5, cols: 4, minH: 2, maxH: 5, seed: 21, shadow: false });
dress('stacks', { x: 70, z: -12, yaw: 0, rows: 7, cols: 5, minH: 1, maxH: 5, seed: 22, shadow: false });
dress('stacks', { x: 62, z: -52, yaw: 90, rows: 4, cols: 5, minH: 2, maxH: 5, seed: 23, shadow: false });
dress('stacks', { x: 47, z: -40, yaw: 0, rows: 5, cols: 3, minH: 2, maxH: 5, seed: 31, shadow: false, lod: 1 });
dress('stacks', { x: -50, z: -42, yaw: 0, rows: 5, cols: 4, minH: 2, maxH: 5, seed: 32, shadow: false, lod: 1 });
dress('stacks', { x: 58, z: 6, yaw: 90, rows: 4, cols: 5, minH: 2, maxH: 5, seed: 33, shadow: false });
dress('stacks', { x: -100, z: -20, yaw: 0, rows: 8, cols: 5, minH: 1, maxH: 5, seed: 34, shadow: false });
dress('stacks', { x: 104, z: -34, yaw: 0, rows: 8, cols: 5, minH: 1, maxH: 5, seed: 35, shadow: false });
dress('stacks', { x: -72, z: -62, yaw: 90, rows: 6, cols: 4, minH: 1, maxH: 5, seed: 24, shadow: false });
dress('lightMast', { x: -36.6, z: -31.2, h: 25, intensity: 620, dist: 62, priority: 3 });
dress('lightMast', { x: 36.6, z: -31.2, h: 25, intensity: 520, dist: 60, priority: 2 });
dress('lightMast', { x: 37, z: 20, h: 22, intensity: 360, dist: 46, priority: 1 });
dress('lightMast', { x: -54, z: 6, h: 27, light: false }); dress('lightMast', { x: 58, z: -30, h: 27, light: false }); dress('lightMast', { x: 96, z: 8, h: 27, light: false });
// the berth: a feeder ship alongside the west quay, ship-to-shore cranes, far shore
dress('ship', { x: -40, z: 30.5, len: 96, beam: 15.5, deck: 8.4, name: 'HALCYON TIDE', port: 'VALPARAISO', seed: 5,
  lines: [[32, [48, 0.6, -9.5]], [27, [38, 0.6, -9.5]], [4, [14, 0.6, -9.5]], [-6, [-6, 0.6, -9.5]], [-30, [-22, 0.6, -9.5]], [-38, [-40, 0.6, -9.5]]] });
dress('stsCrane', { x: -64, z: 19, color: '#2f5d7a' });
dress('stsCrane', { x: -112, z: 19, color: '#2f5d7a', boomUp: true });
dress('stsCrane', { x: 74, z: 19, color: '#a8442c', boomUp: true });
dress('stsCrane', { x: 122, z: 19, color: '#a8442c', boomUp: true });
dress('skyline', { from: -75, to: 75, r0: 150, r1: 280, n: 18, seed: 3, hMin: 9, hMax: 34 });
dress('skyline', { from: 75, to: 112, r0: 220, r1: 420, n: 9, seed: 8, hMin: 8, hMax: 26, tanks: 0.6 });
dress('skyline', { from: 248, to: 285, r0: 230, r1: 420, n: 9, seed: 12, hMin: 8, hMax: 30, tanks: 0.4 });
dress('skyline', { from: 130, to: 235, r0: 520, r1: 760, n: 22, seed: 15, hMin: 10, hMax: 40, tanks: 0.2, y: -1.5 });
dress('breakwater', { a: [150, 120], b: [40, 178] });
dress('ship', { x: 210, z: 250, yaw: 205, len: 120, beam: 18, deck: 9, name: 'OSTRAL VEGA', port: 'ROTTERDAM', seed: 9, cargo: 0.85, cranes: 0, lod: 2 });

// ---------------------------------------------------------------- warehouse (x -12..10, z -16..-2)
const WH = { x0: -12, x1: 10, z0: -16, z1: -2, h: 6.5 };
wall('x', WH.z0, WH.x0, WH.x1, 0, WH.h, 0.2, 'corrugated', [{ a: -3, b: 0.5, y0: 0, y1: 3.2 }]);          // north (back door)
wall('z', WH.x0, WH.z0, WH.z1, 0, WH.h, 0.2, 'corrugated', [{ a: -11.5, b: -7, y0: 0, y1: 3.8 }]);         // west door
wall('z', WH.x1, WH.z0, WH.z1, 0, WH.h, 0.2, 'corrugated', [{ a: -12.5, b: -8, y0: 0, y1: 3.8 }, { a: -5.5, b: -3.5, y0: 1.1, y1: 2.4 }]);
wall('x', WH.z1, WH.x0, WH.x1, 0, WH.h, 0.2, 'corrugated', [{ a: -9, b: -3, y0: 0, y1: 4.4 }, { a: 1, b: 7, y0: 0, y1: 4.4 }]); // two bay doors south
for (const x of [-12, -1, 10]) for (const z of [-16, -9, -2]) box(x - 0.18, z - 0.18, x + 0.18, z + 0.18, 0, WH.h, 'steel', { tint: '#8c4a3a' });
// roof: corrugated strips with skylight gaps that throw light shafts
for (let i = 0, z = WH.z0 - 0.4; i < 5; i++, z += 3.0) box(WH.x0 - 0.5, z, WH.x1 + 0.5, Math.min(z + 2.45, WH.z1 + 0.4), WH.h, WH.h + 0.12, 'corrugated', { collide: i === 0 });
box(WH.x0 - 0.5, WH.z0 - 0.4, WH.x1 + 0.5, WH.z1 + 0.4, WH.h + 0.12, WH.h + 0.2, 'steel', { visible: false }); // roof collider
for (const z of [-12.5, -9, -5.5]) box(WH.x0, z - 0.1, WH.x1, z + 0.1, WH.h - 0.45, WH.h, 'steel', { collide: false });
// interior
box(-5.5, -12.2, -1.5, -11.2, 0, 1.15, 'wall');                    // low concrete divider
box(2.5, -7.4, 3.5, -4.2, 0, 1.15, 'wall');
container(4.6, -12.6, 8, '#3d6b45');
prop('industrial_storage_cart', -9.3, -4.2, 78);
prop('metal_tool_chest', -10.9, -13.6, 90, { y: 0 });
prop('wooden_military_crate', -6.6, -6.2, 12);
prop('wooden_military_crate', -6.5, -6.25, 5, { y: 0.41 });
prop('wooden_crate_02', -7.9, -6.9, 80);
prop('Barrel_01', -2.0, -14.9, 0); prop('Barrel_01', -1.3, -15.1, 40); prop('barrel_03', 0.9, -14.8, 10);
prop('cement_bag', 7.6, -4.4, 0); prop('cement_bag', 7.65, -4.45, 6, { y: 0.18 }); prop('cement_bag', 7.55, -4.4, -5, { y: 0.36 });
prop('cement_bag', 8.3, -4.5, 90); prop('cement_bag', 8.35, -4.45, 84, { y: 0.18 });
prop('hand_truck', 8.9, -6.2, 200);
prop('cardboard_box_01', -10.8, -9.3, 15); prop('cardboard_box_01', -10.6, -10.1, -20);
light(-6, 5.2, -9, 0xffb46b, 46, 16, { shadow: true, priority: 4 }); light(4.5, 5.2, -6, 0xffb46b, 46, 16, { shadow: true, priority: 4 });

// ---------------------------------------------------------------- office block (x 20..30, z -3..6)
const OF = { x0: 20, x1: 30, z0: -3, z1: 6, h: 3.1 };
const officeWalls = (inset, mat, th, trim = 0) => {
  const a = inset, x0 = OF.x0 + trim, x1 = OF.x1 - trim, z0 = OF.z0 + trim, z1 = OF.z1 - trim;
  wall('z', OF.x0 + a, z0, z1, 0, OF.h, th, mat, [{ a: 0.4, b: 1.8, y0: 0, y1: 2.2 }, { a: 3.2, b: 5.0, y0: 1.0, y1: 2.2 }]);   // west: door + window
  wall('z', OF.x1 - a, z0, z1, 0, OF.h, th, mat, [{ a: -1.2, b: 0.8, y0: 1.0, y1: 2.2 }]);
  wall('x', OF.z0 + a, x0, x1, 0, OF.h, th, mat, [{ a: 22, b: 24.2, y0: 1.0, y1: 2.2 }, { a: 26.2, b: 27.6, y0: 0, y1: 2.2 }]); // north: window + door
  wall('x', OF.z1 - a, x0, x1, 0, OF.h, th, mat, [{ a: 24, b: 26.4, y0: 1.0, y1: 2.2 }]);
};
officeWalls(0.09, 'brick', 0.18);
officeWalls(0.25, 'plaster_in', 0.14, 0.18);
box(OF.x0 - 0.3, OF.z0 - 0.3, OF.x1 + 0.3, OF.z1 + 0.3, OF.h, OF.h + 0.3, 'wall');             // roof slab
box(OF.x0 + 0.3, OF.z0 + 0.3, OF.x1 - 0.3, OF.z1 - 0.3, OF.h - 0.04, OF.h, 'plaster_in', { collide: false });
box(OF.x0 + 0.3, OF.z0 + 0.3, OF.x1 - 0.3, OF.z1 - 0.3, 0, 0.03, 'floor_in', { collide: false });
wall('x', 1.6, OF.x0 + 0.3, OF.x1 - 0.3, 0, OF.h, 0.14, 'plaster_in', [{ a: 25.6, b: 27, y0: 0, y1: 2.2 }]);   // partition
box(22.2, 3.4, 24.6, 4.3, 0, 0.78, 'wood');                         // desk
prop('vintage_radio_transceiver', 23.4, 3.85, 180, { y: 0.78, tag: 'intel' });
prop('metal_tool_chest', 29.0, -1.9, -90);
prop('cardboard_box_01', 28.9, 4.9, 30); prop('cardboard_box_01', 28.2, 5.2, -12);
prop('exterior_aircon_unit', 19.75, 4.2, -90, { y: 1.9 });
prop('power_box_01', 19.85, -1.6, -90, { y: 1.2 });
light(25, 2.7, -0.8, 0xffd9a8, 16, 9); light(25, 2.7, 3.8, 0xffd9a8, 16, 9);

// ---------------------------------------------------------------- west container lanes
container(-24, -19, 0, '#2f5d7a');
container(-24, -19, 0, '#8a2f25', { y: 2.59 });
container(-27.5, -9.5, 90, '#3d6b45');
container(-19.2, -8.5, 24, '#b4772a');
container(-23, 2.5, 0, '#c9c2b2', { open: true });
container(-19, 11.5, 90, '#2f5d7a');
container(-27.5, 14.5, 0, '#8a2f25');
container(-27.5, 14.5, 0, '#b4772a', { y: 2.59 });
container(-30.5, -1, 90, '#8a2f25');
container(-24, -19, 0, '#3d6b45', { y: 5.18 });
container(-27.5, -9.5, 90, '#b4772a', { y: 2.59 });
container(-19, 11.5, 90, '#c9c2b2', { y: 2.59 }); container(-19, 11.5, 90, '#8a2f25', { y: 5.18 });
container(-30.5, -1, 90, '#2f5d7a', { y: 2.59 });
container(-27.5, 14.5, 0, '#31485c', { y: 5.18 });
// new cover: north lane, east alley, south-east apron, under the gantry
container(-8, -26.4, 0, '#7a3b2a'); container(-8, -26.4, 0, '#2f5d7a', { y: 2.59 });
container(8.6, -26.4, 0, '#3d6b45');
container(15.2, -5.6, 90, '#c8b23a'); container(15.2, -5.6, 90, '#8a2f25', { y: 2.59 });
container(27.5, 14.2, 90, '#2f5d7a'); container(27.5, 14.2, 90, '#b4772a', { y: 2.59 });
container(-4.2, 10.3, 0, '#31485c');
prop('concrete_road_barrier', -16.5, 0.2, 90); prop('concrete_road_barrier', -16.5, 1.9, 90);
prop('Barrel_01', -21.6, -5.2, 0); prop('barrel_03', -22.4, -5.6, 30);
prop('old_tyre', -25.2, 6.6, 0, { y: 0, lay: true }); prop('old_tyre', -25.25, 6.62, 40, { y: 0.16, lay: true });
prop('wooden_crate_02', -23.4, 2.4, 6); prop('plastic_crate_01', -22.2, 2.9, 20);
prop('trashbag', -32.6, -13.5, 0); prop('trashbag', -33.0, -12.7, 70);
prop('wooden_military_crate', -14.5, 13.8, -30); prop('wooden_crate_02', -15.6, 14.9, 60);
prop('street_lamp_01', -15, -18.5, 90); light(-15, 3.7, -18.2, 0xffc27a, 60, 20, { shadow: false });
prop('street_lamp_01', -31, 7, 0); light(-30.7, 3.7, 7, 0xffc27a, 60, 20);

// ---------------------------------------------------------------- plaza + gantry crane (centre-south)
for (const x of [-9, 9]) {                                           // crane colliders (the visible crane is dressing)
  for (const z of [8, 17]) box(x - 0.35, z - 0.35, x + 0.35, z + 0.35, 0, 10, 'steel', { visible: false });
  box(x - 0.6, 7.4, x + 0.6, 17.6, 0, 0.35, 'steel', { visible: false });
}
box(-10.6, 11.6, 10.6, 13.4, 10, 11.2, 'steel', { collide: false, visible: false });   // girder (rain shadow only)
container(2.4, 12.5, 78, '#8a2f25', { y: 0.5, hang: true });
dress('gantry', { x: 0, z: 12.5, span: 18, base: 9, h: 10, trolley: 2.4, hook: { y: 0.5 + 2.59, yaw: 78 * deg }, id: 'RMG 02' });
prop('concrete_road_barrier', -3.2, 5.2, 0); prop('concrete_road_barrier', -1.6, 5.2, 0); prop('concrete_road_barrier', 5.4, 4.6, 14);
prop('wooden_military_crate', -4.8, 15.6, 10); prop('wooden_military_crate', -4.7, 15.5, 100, { y: 0.41 });
prop('wooden_crate_02', -6.2, 16.6, 30);
prop('Barrel_01', 10.9, 6.2, 0); prop('Barrel_01', 11.6, 6.6, 55); prop('barrel_03', 11.1, 7.2, 10);
prop('metal_jerrycan', 10.2, 7.0, 40);
prop('lifebuoy', 13.6, 21.0, 0, { y: 0.02, lay: true });
prop('old_tyre', 12.8, 20.4, 0, { y: 0, lay: true });
box(11.2, 13.2, 13.6, 15.6, 0, 1.3, 'wood', { visible: false });      // pallet stacks (colliders; the pallets are dressing)
box(11.4, 13.4, 13.4, 15.4, 1.3, 2.0, 'wood', { visible: false });
dress('pallets', { at: [[11.82, 13.62, 0, 9], [13.02, 13.6, 2, 9], [11.8, 14.42, -2, 9], [13.0, 14.4, 1, 9], [11.82, 15.2, 3, 9], [13.0, 15.2, -1, 9]] });
dress('pallets', { y: 1.314, at: [[12.0, 13.85, 4, 5], [12.9, 14.75, 90, 5]] });
prop('cement_bag', 12.2, 14.2, 20, { y: 2.0 });
prop('street_lamp_01', 0, 20.6, 90); light(0, 3.7, 20.2, 0xffc27a, 70, 22);

// ---------------------------------------------------------------- generator yard + overlook (NE)
container(27, -21, 0, '#c9c2b2');
box(23.9, -19.6, 30.1, -17.9, 2.55, 2.67, 'grid', { surf: 'metal' });          // catwalk beside the container top
for (const x of [24.1, 29.9]) box(x - 0.06, -18.0, x + 0.06, -17.9, 0, 2.55, 'steel', { collide: false });
stairs(22.0, -18.75, 'x+', 1.5, 2.55, 7, 'plate', 0.3);
box(23.9, -17.95, 30.1, -17.87, 2.67, 3.6, 'grid', { bullet: false, sight: false, railing: true });
box(30.05, -19.6, 30.13, -17.9, 2.67, 3.6, 'grid', { bullet: false, sight: false, railing: true });
prop('portable_generator', 22.5, -11.5, 20, { tag: 'generator', scale: 1.5 });
prop('propane_tank', 24.2, -11.0, 0); prop('propane_tank', 24.7, -11.4, 50);
prop('utility_box_01', 20.6, -12.2, 90);
prop('metal_jerrycan', 21.6, -10.4, 120); prop('metal_jerrycan', 21.2, -10.7, 80);
rbox(17.2, -14.5, 0.25, 6, 0, 2.3, 0, 'corrugated');                 // sheet-metal screens
rbox(20.5, -8.2, 5, 0.25, 0, 2.3, 0, 'corrugated');
prop('concrete_road_barrier', 15.2, -22.5, 60); prop('concrete_road_barrier', 16.4, -24.2, 50);
prop('Barrel_01', 31.8, -9.4, 0); prop('barrel_03', 32.6, -9.9, 0); prop('Barrel_01', 32.4, -8.8, 30);
prop('wooden_military_crate', 31.2, -25.6, 0); prop('wooden_crate_02', 32.6, -25.2, 90);
prop('street_lamp_01', 18.5, -26.8, 0); light(18.8, 3.7, -26.8, 0xffc27a, 60, 20, { shadow: false });
prop('security_light', 33.9, 12, -90, { y: 4.2 }); light(32.8, 4.0, 12, 0xfff0d8, 45, 18, { shadow: false });
prop('concrete_road_barrier', 22.5, 12.2, 0); prop('concrete_road_barrier', 24.1, 12.2, 0); prop('concrete_road_barrier', 29, 15, 90);
prop('industrial_storage_cart', 31.6, 18.6, 10);
prop('ocean_buoy', 30.5, 9.4, 0);

// ---------------------------------------------------------------- north lane (behind the warehouse)
prop('concrete_road_barrier', -6, -22.2, 0); prop('concrete_road_barrier', 6.5, -20.6, 20);
prop('wooden_military_crate', 1.4, -25.9, 0); prop('Barrel_01', 2.9, -26.6, 0);
prop('trashbag', -11.2, -17.0, 0);
box(-14.5, -27.9, -13, -26.4, 0, 1.4, 'rust');                        // dumpster-ish steel bin

// ---------------------------------------------------------------- painted lines, stains
decal('line', 0, 3.2, 44, 0.14, 0, { color: '#d8b13a' });
decal('line', 0, 19.2, 60, 0.14, 0, { color: '#d8b13a' });
decal('line', -13.6, 9, 0.14, 20, 0, { color: '#d8b13a' });
decal('line', 13.4, -8, 0.14, 22, 0, { color: '#e8e4d8' });
decal('hatch', 2.4, 12.5, 8, 4.4, 78, { color: '#d8b13a' });
decal('stain', -4, 9, 7, 5, 30); decal('stain', 22, -11, 5, 4, 0); decal('stain', -20, -4, 6, 6, 60);
decal('stain', 12, 6.5, 4, 3, 10); decal('stain', 4, -22, 8, 4, 0); decal('stain', -26, 9, 5, 6, 80);

// ---------------------------------------------------------------- signage, lane markings, cones, pallets
const sign = (text, x, y, z, yawDeg, o = {}) => dress('sign', { text, x, y, z, yaw: yawDeg, ...o });
sign('W2', -1, 5.35, -1.88, 0, { h: 1.3, color: '#e6e0d0', worn: 0.7 });                          // warehouse south face, between the bay doors
sign('W2', -12.12, 5.2, -4.5, -90, { h: 1.2, color: '#e6e0d0', worn: 0.7 });
sign('KEEP CLEAR', -6, 0.012, 1.2, 0, { h: 0.7, color: '#d8b13a', flat: true }); sign('KEEP CLEAR', 4, 0.012, 1.2, 0, { h: 0.7, color: '#d8b13a', flat: true });
sign('BERTH 7', -14, 0.012, 20.1, 0, { h: 0.9, color: '#e8e4d8', flat: true });
sign('CRANE TRACK', 0, 0.012, 6.4, 0, { h: 0.55, color: '#d8b13a', flat: true });
for (const [t, x, z] of [['A1', -27, -14.6], ['A2', -22.6, -3.4], ['B1', -27.6, 9.4], ['B2', -15.6, 6.2], ['C1', 16.6, -9.4], ['C2', 24.2, 9.6]]) sign(t, x, 0.012, z, 0, { h: 1.3, color: '#e8e4d8', flat: true });
sign('AUTHORISED\nPERSONNEL ONLY', 19.86, 2.45, 2.6, -90, { h: 0.16, color: '#f4f0e4', bg: '#a52a1e', worn: 0.2 });   // office west wall
sign('GENERATOR\nDANGER 400 V', 17.06, 1.75, -14.5, -90, { h: 0.2, color: '#16140f', bg: '#d6a21a', worn: 0.25 });
sign('GATE 3', 0, 3.2, -27.86, 0, { h: 0.8, color: '#e6e0d0', worn: 0.8 });
sign('MAX 20 km/h', -33.86, 2.9, -8, 90, { h: 0.5, color: '#e6e0d0', worn: 0.8 }); sign('NO SMOKING', 33.86, 2.9, 2, -90, { h: 0.5, color: '#e6e0d0', worn: 0.8 });
dress('cones', { at: [[-10.6, 6.4], [-10.4, 18.8, 1], [10.5, 18.6], [7.4, 6.2], [20.4, -9.6], [18.2, -7.1, 1], [-14.2, -21.5], [1.6, -18.4], [29.8, 12.2], [13.2, 20.6], [-17.4, 17.4]] });
pallets(-12.4, -19.6, 12, 5); pallets(18.6, 19.4, -8, 6); pallets(-33, 12.4, 90, 4); pallets(31.4, -4.2, 4, 7); pallets(-14.6, 4.2, 80, 3);
// container bay outlines and wheel lanes
for (const [x, z, w, d] of [[-24, -19, 6.5, 2.9], [-27.5, 14.5, 6.5, 2.9], [-8, -26.4, 6.5, 2.9], [8.6, -26.4, 6.5, 2.9]]) { decal('line', x, z - d / 2, w, 0.1, 0, { color: '#e8e4d8' }); decal('line', x, z + d / 2, w, 0.1, 0, { color: '#e8e4d8' }); decal('line', x - w / 2, z, 0.1, d, 0, { color: '#e8e4d8' }); decal('line', x + w / 2, z, 0.1, d, 0, { color: '#e8e4d8' }); }
decal('line', 0, -17.6, 56, 0.12, 0, { color: '#e8e4d8' }); decal('line', 0, -21.6, 56, 0.12, 0, { color: '#d8b13a' });
decal('line', -13.6, -14, 0.12, 20, 0, { color: '#e8e4d8' }); decal('line', 19.2, 14, 0.12, 14, 0, { color: '#e8e4d8' });
decal('hatch', -6, 0.2, 6, 3.2, 0, { color: '#d8b13a' }); decal('hatch', 4, 0.2, 6, 3.2, 0, { color: '#d8b13a' });
decal('hatch', 16, 20.4, 4.4, 2.2, 0, { color: '#e8e4d8' });
decal('stain', 9, -22, 9, 5, 20); decal('stain', -9, 3, 6, 5, 70); decal('stain', 16, 8, 6, 7, 40); decal('stain', -28, -22, 7, 5, 10); decal('stain', 28, -4, 6, 6, 0); decal('stain', 0, 16, 9, 5, 12);

// ---------------------------------------------------------------- pickups
pickup('ammo', -23, 2.5, 0.14); pickup('ammo', 25.6, -0.8); pickup('ammo', -1, -8); pickup('ammo', 27, -18.7, 2.67);
pickup('ammo', 16, 43); pickup('ammo', -29, -24); pickup('ammo', 30, 19.5);

export default {
  id: 'drydock',
  name: 'Drydock',
  blurb: 'Harbour freight yard · rain at golden hour · close to mid range',
  pitch: 'Live rounds in the Drydock yard. Set the opposition and fight for the quay.',
  players: { min: 8, max: 24 },      // the match size this yard suits; the menu shows it (the game's own cap is MAX_PLAYERS)
  env: {
    hdri: 'belfast_sunset_puresky',
    sunAzimuth: 284,          // compass-style degrees the sun sits at (0 = north/-z, 90 = east); the HDRI is rotated to match
    sunElevation: 13,         // degrees above the horizon used for light and shadows
    sunColor: '#ffb070', sunIntensity: 7.5,
    exposure: 0.92, skyIntensity: 0.46, ambient: 0.62,
    fog: { color: '#3a444e', sunColor: '#c27a44', density: 0.0052, falloff: 0.04 },     // haze: colour away from / toward the sun
    shafts: { density: 0.005, strength: 0.62, distance: 95, anisotropy: 0.5, glow: 3 },   // volumetric sun shafts + lamp glow
    weather: { rain: 0.65, wet: 1 },                                                     // rain 0..1 (streaks, ripples), wet 0..1 (surfaces, puddles)
    water: { y: -1.55, color: '#0b2a33' },
    bloom: { strength: 0.16, radius: 0.8, threshold: 1.25 },
    grade: { saturation: 1.06, contrast: 0.3, vignette: 0.36, shadows: [0, 0.01, 0.02], highlights: [0.02, 0.008, -0.012] },
  },
  bounds: { minX: -34, maxX: 34, minZ: -28, maxZ: 46.5, groundY: 0, maxY: 14 },
  ...L,
  // menu backdrop: slow dolly shots {from, to, look, lookTo?, fov?, dur}
  shots: [
    { from: [19.5, 1.75, 10.6], to: [15, 1.9, 9.2], look: [-4, 4.6, 14.5], fov: 55, dur: 17 },
    { from: [9, 1.25, -24.6], to: [3.5, 1.3, -23.6], look: [-30, 5.5, -20], fov: 50, dur: 15 },
    { from: [31, 9.5, -23], to: [28, 8.4, -17], look: [2, 3, 22], lookTo: [-6, 3, 26], fov: 52, dur: 17 },
    { from: [18.6, 1.7, 39], to: [15.2, 1.9, 31], look: [2, 6, 10], fov: 58, dur: 15 },
  ],
  spawns: {
    dm: [
      spawn(-31, -25, 135), spawn(-31, 19, 45), spawn(30.5, 20.3, -45), spawn(31, -27, -135), spawn(0, -25, 180),
      spawn(-16, -20, 120), spawn(-21, 6.5, 90), spawn(-10, 19, 20), spawn(6, 18.5, -10), spawn(18, 8, -90),
      spawn(27.5, 9, 0), spawn(13, -24, -160), spawn(-3, -6, 180), spawn(6.5, -9.5, 90), spawn(32, -14, -90),
      spawn(-32.5, -5, 90), spawn(16, 44, 0), spawn(-13.5, 6, 90), spawn(25, -24.6, 180), spawn(12.5, -3, -90),
    ],
    team1: [spawn(-31, -25, 120), spawn(-32, -16, 90), spawn(-32.5, -5, 90), spawn(-31, 8.5, 90), spawn(-31, 19, 60), spawn(-28, -24.5, 110), spawn(-24, 19.5, 50), spawn(-29, 5, 90)],
    team2: [spawn(31, -27, -120), spawn(32, -14, -90), spawn(32, -6, -90), spawn(32, 8, -90), spawn(30.5, 20.3, -60), spawn(28, -25.5, -110), spawn(26, 19.5, -50), spawn(32, 14, -90)],
  },
  campaign: {
    title: 'LOW TIDE',
    brief: 'A smuggling crew has taken the Drydock freight yard. Come in off the water, cut their power, lift their radio logs and get back out.',
    start: spawn(16, 44.2, 0),
    stages: [
      { type: 'reach', text: 'Move up the pier to the quay', at: [16, 0, 19], r: 3.5,
        say: ['OVERWATCH', 'You\'re on the pier. Yard is hot — four on the quay. Weapons free.'],
        enemies: [{ at: [4, 9], w: 'carbine' }, { at: [-6, 6], w: 'carbine' }, { at: [11, 3], w: 'pistol' }, { at: [-2, 15], w: 'carbine' }] },
      { type: 'eliminate', text: 'Clear the quay', say: ['OVERWATCH', 'Clear the quay before you push inland.'] },
      { type: 'interact', text: 'Shut down the generator', at: [22.5, 0.6, -11.5], hold: 2.5, prompt: 'Hold F to kill the generator',
        say: ['OVERWATCH', 'Generator is north-east, behind the sheet-metal screens. Kill it and their floodlights go.'],
        enemies: [{ at: [19, -18], w: 'carbine' }, { at: [27, -18.7, 2.67], w: 'marksman', hold: true }, { at: [28, -10], w: 'carbine' }, { at: [14, -12], w: 'pistol' }] },
      { type: 'interact', text: 'Recover the radio logs from the office', at: [23.4, 1.0, 3.85], hold: 2, prompt: 'Hold F to pull the radio logs',
        say: ['OVERWATCH', 'Power is down. Their radio set is in the office block, south of you.'],
        enemies: [{ at: [25, -1], w: 'carbine', hold: true }, { at: [27.5, 4], w: 'pistol', hold: true }, { at: [17, 4], w: 'carbine' }] },
      { type: 'defend', text: 'Hold the warehouse until the boat returns', at: [-1, 0, -9], r: 9, time: 70,
        say: ['OVERWATCH', 'Good copy on the logs. Boat is seventy seconds out — they know you\'re here. Fall back to the warehouse and hold.'],
        waves: [
          { t: 4, enemies: [{ at: [-30, -24], w: 'carbine' }, { at: [-32.4, 4.6], w: 'carbine' }, { at: [-28, 19], w: 'pistol' }, { at: [31, -24], w: 'carbine' }] },
          { t: 26, enemies: [{ at: [-30, -24], w: 'carbine' }, { at: [29, 18], w: 'carbine' }, { at: [0, -26], w: 'carbine' }, { at: [-31, 8], w: 'marksman' }] },
          { t: 48, enemies: [{ at: [-30, -24], w: 'carbine' }, { at: [31, -24], w: 'carbine' }, { at: [-28, 19], w: 'carbine' }, { at: [29, 18], w: 'carbine' }, { at: [0, -26], w: 'pistol' }] },
        ] },
      { type: 'reach', text: 'Get to the boat at the end of the pier', at: [16, 0, 43.5], r: 2.8,
        say: ['OVERWATCH', 'Boat is at the pier head. Move!'],
        enemies: [{ at: [-12, 18], w: 'carbine' }, { at: [24, 14], w: 'carbine' }] },
    ],
    outro: ['OVERWATCH', 'Package aboard. Nice work — Drydock is going to have a quiet night.'],
  },
};
