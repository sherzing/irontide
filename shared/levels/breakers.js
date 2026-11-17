// BREAKERS — a shipbreaking beach at noon. A freighter has been hauled up the tidal flat and is being cut apart
// from the bow back; what is left of it splits the yard in two.
// Layout (top view, +z is south / the sea), 120 m x 108 m:
//   north fence ── gate ── stores ── yard office (NE)
//   west beach: severed bow, camp, lifeboat │ THE HULK: hold 1 · hold 2 · engine room · stern in the surf │ east yard: plate park, crane, gas store
//   ───────────── tide line (z = 40) ── shallows (wading) ── deep water
// Ways across the hull: round the cut face (north), through hold 1, hold 2 or the engine room, or wade round the stern.
import { createKit } from './kit.js';

const { L, box, rbox, wall, frame, container, prop, light, decal, pickup, spawn, dress } = createKit();

// ---------------------------------------------------------------- ground and sea
box(-60, -55, 60, 28, -3, 0, 'sand');
box(-60, 28, 60, 40, -3, 0, 'wetsand');                              // the flat the tide has just left
box(-60, 40, 60, 53, -3, -0.35, 'wetsand');                          // shallows: wading depth, then the bottom drops away
for (const [x0, z0, x1, z1, m] of [[-420, -420, -60, 28, 'sand'], [60, -420, 420, 28, 'sand'], [-60, -420, 60, -55, 'sand'], [-420, 28, -60, 40, 'wetsand'], [60, 28, 420, 40, 'wetsand']]) box(x0, z0, x1, z1, -3, 0, m, { collide: false });
for (let x = -54; x <= 54; x += 9) decal('stain', x + Math.sin(x) * 3, 28 + Math.cos(x * 1.3) * 1.5, 11, 6, x * 7);   // breaks up the edge of the wet sand

// ---------------------------------------------------------------- yard fence (sheet iron on posts), running out into the sea
const FENCE = 3.2, SHEET = ['#8a8f8c', '#6f7b78', '#9a8f7c', '#7a6a5c', '#8c9aa0', '#a0988a'];
const fence = (x0, z0, x1, z1, y0 = 0) => {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len / 3), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n, h = FENCE - ((i * 7) % 3) * 0.12;
    if (alongX) box(x0 + (x1 - x0) * a, z0 - 0.06, x0 + (x1 - x0) * b, z0 + 0.06, y0, h, 'corrugated', { tint: SHEET[(i * 5 + 1) % SHEET.length] });
    else box(x0 - 0.06, z0 + (z1 - z0) * a, x0 + 0.06, z0 + (z1 - z0) * b, y0, h, 'corrugated', { tint: SHEET[(i * 3 + 2) % SHEET.length] });
  }
};
fence(-60, -55, -5, -55); fence(5, -55, 60, -55);
box(-5, -55.12, 5, -54.88, 0, 3.4, 'steel', { tint: '#5d6a70' });     // the yard gate, shut
for (const x of [-5.2, 5.2]) box(x - 0.2, -55.2, x + 0.2, -54.8, 0, 3.8, 'wall');
fence(-60, -55, -60, 40); fence(60, -55, 60, 40);
fence(-60, 40, -60, 53, -0.5); fence(60, 40, 60, 53, -0.5);

// ---------------------------------------------------------------- the hulk
const CUT = -18, AFT = 40, STERN = 52, HB = 7.5, D = 8.5, HY = 5, PLATING = '#b9c2c4';
const H = frame(0, 0, HY);
const HOLES = { w: [[-12, -6, 4.2], [10, 15, 3.6], [30, 33.5, 3.0]], e: [[-9, -3, 4.2], [13, 19, 3.8], [31, 35, 3.0]] };
const shell = (x, holes, extra = []) => {
  H.wall('z', x, CUT, AFT, 0, 2.4, 0.3, 'antifoul', holes.map(([a, b, h]) => ({ a, b, y0: 0, y1: Math.min(h, 2.4) })), { tint: PLATING });
  H.wall('z', x, CUT, AFT, 2.4, D, 0.3, 'hull', [...holes.filter((h) => h[2] > 2.4).map(([a, b, h]) => ({ a, b, y0: 2.4, y1: h })), ...extra], { tint: PLATING });
};
shell(-HB + 0.15, HOLES.w, [{ a: 19.5, b: 24, y0: 3.9, y1: 5.1 }]);   // the slit above the hold 2 gallery looks out over the west beach
shell(HB - 0.15, HOLES.e);
H.box(-HB + 0.3, CUT, HB - 0.3, AFT, 0, 0.1, 'rust', { surf: 'metal', tint: '#8a7868' });                                 // tank top: the floor of the holds
// transverse bulkheads: hold 1 | hold 2 | engine room | steering flat
H.wall('x', 4, -HB + 0.3, HB - 0.3, 0.1, D, 0.25, 'rust', [{ a: -1.6, b: 1.6, y0: 0.1, y1: 3.2 }, { a: 3.4, b: 5.6, y0: 4.4, y1: 6 }]);
H.wall('x', 26, -HB + 0.3, HB - 0.3, 0.1, D, 0.25, 'rust', [{ a: 2.4, b: 4.6, y0: 0.1, y1: 2.5 }, { a: -5.6, b: -3.9, y0: 0.1, y1: 2.3 }]);
H.box(-HB, AFT - 0.15, HB, AFT + 0.15, 0, D, 'rust');
H.box(-HB + 0.3, CUT, -3, CUT + 0.25, 0.1, 3.3, 'rust');                                                 // what is left of the collision bulkhead
// decks: the side decks, the cross decks between the hatches and the deck over the engine room
H.box(-HB, CUT, -4.6, AFT, D - 0.2, D, 'rust'); H.box(4.6, CUT, HB, AFT, D - 0.2, D, 'rust');
H.box(-4.6, CUT, 1.5, CUT + 2, D - 0.2, D, 'rust'); H.box(-4.6, 2.5, 4.6, 5.5, D - 0.2, D, 'rust');
H.box(-4.6, 25, -1.6, AFT, D - 0.2, D, 'rust'); H.box(1.6, 25, 4.6, AFT, D - 0.2, D, 'rust'); H.box(-1.6, 25, 1.6, 30.5, D - 0.2, D, 'rust'); H.box(-1.6, 35.5, 1.6, AFT, D - 0.2, D, 'rust');   // engine-room skylight left open
// hold 2: a gallery along the west side, reached by a stair
H.box(-HB + 0.3, 18, -3.2, 25.75, 2.65, 2.8, 'grid', { surf: 'metal' });
H.stairs(-0.31, 19, 'x-', 1.4, 2.7, 9, 'plate', 0.34, 0.1);
for (const [x, z] of [[-3.3, 18.1], [-3.3, 25.6], [-3.3, 21.9]]) H.box(x - 0.08, z - 0.08, x + 0.08, z + 0.08, 0.1, 2.65, 'steel');
H.box(-3.26, 19.8, -3.18, 25.75, 2.8, 3.8, 'grid', { bullet: false, sight: false, railing: true });
H.box(-HB + 0.3, 17.96, -3.2, 18.04, 2.8, 3.8, 'grid', { bullet: false, sight: false, railing: true });
// engine room: the main engine, still on its bed
H.box(-2.6, 29, 2.6, 37, 0.1, 3.4, 'rust', { tint: '#5a6166', surf: 'metal' });
H.box(-1.9, 29.6, 1.9, 36.4, 3.4, 4.3, 'rust', { tint: '#4a5156', surf: 'metal' });
for (let z = 30.2; z < 36.5; z += 1.25) H.box(-1.2, z - 0.4, 1.2, z + 0.4, 4.3, 4.75, 'plate', { collide: false });
// stern: the counter overhangs the surf (the shape is scenery; these are what you bump into)
H.box(-HB, AFT, HB, AFT + 1.5, -0.5, D, 'hull', { visible: false });
H.box(-6.6, AFT + 1.5, 6.6, STERN - 0.4, 3.4, D, 'hull', { visible: false });
H.box(-0.3, AFT + 1.5, 0.3, AFT + 2.8, -0.5, 3.5, 'hull', { visible: false });
H.box(-1.25, AFT + 3.9, 1.25, AFT + 4.8, -0.5, 2.9, 'hull', { visible: false });
H.box(-0.14, AFT + 5.3, 0.14, AFT + 7.1, -0.5, 3.4, 'hull', { visible: false });
H.box(-6.2, 27, 6.2, 39, D, D + 10.4, 'painted', { visible: false });                                    // accommodation block
const winchAt = [2, -40], tow = H.local(winchAt[0], winchAt[1] + 0.7);
dress('hulk', { x: H.x, z: H.z, yaw: HY, beam: HB * 2, depth: D, cut: CUT, aft: AFT, stern: STERN, holes: HOLES, hatches: [[CUT + 2, 2.5, 4.6], [5.5, 25, 4.6]], house: [27, 39], tow: [tow[0], 1.9, tow[1]], tint: PLATING });
// things left in the holds
const plates = [], heaps = [];
/** A stack of cut plate: scenery plus one collider. */
const stack = (x, z, yawDeg, w = 6, d = 2.4, h = 1) => { plates.push([x, z, yawDeg, w, d, h]); rbox(x, z, w, d, 0, h, yawDeg, 'rust', { visible: false, surf: 'metal' }); };
/** A heap of offcuts: scenery plus a low collider in its middle. */
const heap = (x, z, r = 2.5, h = 1.4) => { heaps.push([x, z, r, h]); rbox(x, z, r * 1.1, r * 1.1, 0, h * 0.62, 30, 'rust', { visible: false, surf: 'metal' }); };
const hp = (lx, lz) => H.pt(lx, lz);
/** A spawn point given in the hull's own coordinates, standing on the tank top. */
const inHull = (lx, lz, facing) => { const p = hp(lx, lz); return spawn(+p[0].toFixed(2), +p[1].toFixed(2), facing, 0.1); };
{ let p = hp(-4.2, -1.5); stack(p[0], p[1], HY + 90, 5, 2.2, 1.2); p = hp(3.6, -13.5); stack(p[0], p[1], HY + 80, 5, 2.2, 0.8); p = hp(4.3, 1.2); heap(p[0], p[1], 2, 1.3);
  p = hp(0.5, 12.5); stack(p[0], p[1], HY + 4, 5, 2.2, 1.3); p = hp(5.6, 8.9); container(p[0], p[1], HY + 90, '#31485c', { open: true });
  p = hp(-5.4, 7.2); heap(p[0], p[1], 1.6, 1.1); p = hp(5.2, 23); stack(p[0], p[1], HY + 90, 4.5, 2.2, 1.0); }
const hprop = (model, lx, lz, yawDeg = 0, o = {}) => { const p = hp(lx, lz); return prop(model, p[0], p[1], HY + yawDeg, { y: 0.1, ...o }); };
hprop('portable_welding_cart', -5.9, -4.6, 60); hprop('small_lpg_tank', -5.2, -5.4, 0); hprop('small_lpg_tank', -5.6, -3.7, 30);
hprop('portable_welding_cart', 5.6, 20.8, -100); hprop('propane_tank', 6.2, 21.9, 0); hprop('Barrel_02', -6.3, 9.2, 0); hprop('Barrel_02', -6.4, 8.3, 40); hprop('Barrel_01', -5.6, 8.7, 10);
hprop('wooden_military_crate', 0.8, 22.4, 12); hprop('wooden_crate_02', 1.9, 23.2, 70); hprop('metal_tool_chest', -6.6, 24.6, 90, { y: 2.8 }); hprop('cardboard_box_01', -6.4, 20.2, 15, { y: 2.8 });
hprop('Barrel_02', 5.9, 27.6, 0); hprop('Barrel_02', 6.3, 28.5, 20); hprop('metal_tool_chest', -6.3, 37.8, 180); hprop('metal_jerrycan', 4.4, 38.6, 60); hprop('old_tyre', -4.8, 27.2, 0, { lay: true });
{ const a = hp(4.4, 28.2), b = hp(-4.6, 38); light(a[0], 3.2, a[1], 0xffb46b, 34, 13, { priority: 3 }); light(b[0], 3.2, b[1], 0xffb46b, 34, 13, { priority: 3 }); }

// ---------------------------------------------------------------- north yard: winch, stores, office
dress('winch', { x: winchAt[0], z: winchAt[1], yaw: HY });
rbox(winchAt[0], winchAt[1], 4.4, 3.4, 0, 2.3, HY, 'steel', { visible: false, surf: 'metal' });
container(-11, -51.4, 0, '#31485c'); container(-11, -51.4, 0, '#8a2f25', { y: 2.59 }); container(-19.5, -50.8, 5, '#c9c2b2');
container(13, -51.4, 0, '#3d6b45', { open: true }); container(21.5, -51, -4, '#b4772a');
const OF = { x0: 30, x1: 42, z0: -52.5, z1: -44.5, h: 3 };                                                // yard office: sheet-iron shed with a desk and the day's ledgers
wall('x', OF.z1, OF.x0, OF.x1, 0, OF.h, 0.16, 'corrugated', [{ a: 31.2, b: 32.7, y0: 0, y1: 2.2 }, { a: 35.5, b: 38, y0: 1.0, y1: 2.1 }], { tint: '#a9b0a8' });
wall('x', OF.z0, OF.x0, OF.x1, 0, OF.h, 0.16, 'corrugated', [], { tint: '#a9b0a8' });
wall('z', OF.x0, OF.z0, OF.z1, 0, OF.h, 0.16, 'corrugated', [{ a: -50.6, b: -49.2, y0: 0, y1: 2.2 }], { tint: '#9aa49c' });
wall('z', OF.x1, OF.z0, OF.z1, 0, OF.h, 0.16, 'corrugated', [{ a: -49.6, b: -47.4, y0: 1.0, y1: 2.1 }], { tint: '#9aa49c' });
box(OF.x0 - 0.5, OF.z0 - 0.4, OF.x1 + 0.5, OF.z1 + 1.6, OF.h, OF.h + 0.12, 'corrugated', { tint: '#7d6a58' });
box(OF.x0 + 0.1, OF.z0 + 0.1, OF.x1 - 0.1, OF.z1 - 0.1, 0, 0.04, 'wood', { collide: false });
for (const x of [OF.x0 - 0.3, OF.x1 + 0.3]) box(x - 0.06, OF.z1 + 1.4, x + 0.06, OF.z1 + 1.52, 0, OF.h, 'steel', { collide: false });
box(38.4, -51.9, 40.9, -50.9, 0, 0.78, 'wood'); prop('vintage_radio_transceiver', 39.6, -51.4, 180, { y: 0.78 }); prop('cardboard_box_01', 41.2, -45.6, 20); prop('metal_tool_chest', 30.8, -51.8, 0);
light(36, 2.6, -48.5, 0xffd9a8, 14, 9);
dress('sign', { text: 'YARD OFFICE', x: 34.6, y: 2.62, z: OF.z1 + 0.1, h: 0.26, color: '#1c1c1a', bg: '#d8d2c0', worn: 0.4 });
dress('sign', { text: 'PLOT 14', x: 0, y: 2.4, z: -54.84, h: 0.7, color: '#e6e0d0', worn: 0.7 });
prop('portable_generator', 26.2, -46.5, 100, { scale: 1.4 }); prop('metal_jerrycan', 25.2, -45.4, 30); prop('Barrel_01', 24.6, -47.6, 0); prop('Barrel_02', 25.4, -48.3, 0);
heap(15, -30, 3, 1.5); heap(-13, -33, 2.4, 1.3); stack(-4, -29, 96, 6, 2.4, 1.1); stack(9.5, -22.5, 10, 5, 2.4, 0.7);
rbox(-9, -24, 5.5, 0.22, 0, 3.2, 12, 'hull'); rbox(21, -36, 6, 0.22, 0, 3.4, 78, 'antifoul');           // shell plates stood on edge
prop('concrete_road_barrier', -2.5, -47.5, 90); prop('concrete_road_barrier', 6.5, -47, 84);

// ---------------------------------------------------------------- west beach: the severed bow, the camp, a lifeboat
const BW = frame(-35, -36, 205), BOW = { hb: 7.5, len: 13, h: 10.4 };
for (const s of [-1, 1]) {
  BW.rbox(s * 6.2, 3.58, 0.35, 7.7, 0, BOW.h, s * -19.6, 'hull', { visible: false });
  BW.rbox(s * 2.5, 10.1, 0.35, 7.75, 0, BOW.h, s * -39.9, 'hull', { visible: false });
}
dress('bowBlock', { x: BW.x, z: BW.z, yaw: BW.yaw, beam: BOW.hb * 2, depth: 9.4, len: BOW.len, tint: PLATING });
{ const p = BW.pt(1.5, 4.2); prop('Barrel_01', p[0], p[1], 0); const q = BW.pt(-2.2, 6.4); prop('wooden_military_crate', q[0], q[1], 40); }
container(-53, -18, 90, '#b4772a'); container(-53, -9, 90, '#2f5d7a', { open: true });
dress('shelter', { x: -46.6, z: -13.5, yaw: 90, w: 7, d: 4.6, h: 2.7, color: '#3f6e8c' });
prop('Barrel_01', -44.6, -16.6, 0); prop('wooden_crate_02', -47.4, -11, 30); prop('plastic_crate_01', -46.2, -10.4, 10); prop('cement_bag', -48.6, -15.2, 0); prop('old_tyre', -44, -9.6, 0, { lay: true });
dress('lifeboat', { x: -41, z: 6, yaw: 75 });
rbox(-41, 6, 7.2, 2.6, 0, 2.5, 75, 'painted', { visible: false, surf: 'metal' });
dress('anchor', { x: -23, z: 15.5, yaw: 0.7, s: 1.25, to: [-9.2, 21.5] });
rbox(-23, 15.5, 2.9, 4.4, 0, 0.62, 40, 'rust', { visible: false, surf: 'metal' });
prop('lateral_sea_marker', -33, 33.5, 20);
stack(-20, -19, 15, 6, 2.4, 1.2); stack(-29.5, -3, 80, 6, 2.4, 0.8); stack(-48, 9, 0, 6, 2.4, 1.4); stack(-17.5, 3.5, 95, 5, 2.4, 1.0); stack(-49, 26, 86, 6, 2.4, 1.1);
heap(-27, 23, 3, 1.5); heap(-47, -33, 2.5, 1.3);
rbox(-22, -8.5, 5.5, 0.22, 0, 3.4, 20, 'hull'); rbox(-29, 12.5, 6, 0.22, 0, 3.0, -35, 'antifoul'); rbox(-17, 27, 5, 0.22, 0, 2.8, 80, 'hull');
rbox(-44, 20, 6, 0.22, 0, 3.2, 10, 'antifoul'); rbox(-37, -14.5, 5, 0.22, 0, 3.0, 100, 'rust'); rbox(-13.5, 36, 5, 0.22, 0, 2.6, 30, 'hull');
prop('Barrel_02', -30.6, 13.8, 0); prop('Barrel_02', -31.3, 14.6, 30); prop('portable_welding_cart', -20.4, -6.6, 200); prop('small_lpg_tank', -19.4, -7.4, 0);
prop('rusted_wheel_rim_01', -24.6, 24.6, 0, { lay: true }); prop('rusted_wheel_rim_01', -25.4, 25.5, 50, { lay: true, y: 0.02 }); prop('old_tyre', -38.2, 16.4, 0, { lay: true });

// ---------------------------------------------------------------- east yard: plate park, crawler crane, gas store
stack(19, -13, 90, 6, 2.4, 1.3); stack(19, -3.5, 90, 6, 2.4, 0.9); stack(19.5, 23, 88, 6, 2.4, 1.5);
stack(27, -17, 0, 6, 2.4, 1.6); stack(27, -12.5, 0, 6, 2.4, 0.7); stack(35.5, -17, 0, 6, 2.4, 1.1); stack(35.5, -12.5, 2, 6, 2.4, 2.0);
stack(44, -3, 90, 6, 2.4, 1.4); stack(44, 7, 86, 6, 2.4, 1.0); stack(38, 21, 0, 6, 2.4, 1.2); stack(30, 29, 8, 6, 2.4, 0.8); stack(47, 27, 90, 5, 2.4, 1.6);
dress('crawlerCrane', { x: 27, z: 6, yaw: -90, boom: 38, angle: 64 });
rbox(27, 6, 5.2, 6.5, 0, 1.15, -90, 'steel', { visible: false, surf: 'metal' }); rbox(28.4, 6, 3.4, 6.4, 1.15, 2.6, -90, 'steel', { visible: false, surf: 'metal' });
const GS = { x0: 43, x1: 50, z0: -37, z1: -31 };                                                          // gas store: cylinders for the cutting torches behind a block wall
wall('x', GS.z0, GS.x0, GS.x1, 0, 2.3, 0.2, 'wall'); wall('z', GS.x1, GS.z0, GS.z1, 0, 2.3, 0.2, 'wall'); wall('z', GS.x0, GS.z0, GS.z1, 0, 1.1, 0.2, 'wall');
box(GS.x0 - 0.3, GS.z0 - 0.3, GS.x1 + 0.3, GS.z1 + 0.4, 2.5, 2.6, 'corrugated', { tint: '#7d6a58' });
for (const [x, z] of [[GS.x0, GS.z1], [GS.x1, GS.z1]]) box(x - 0.07, z - 0.07, x + 0.07, z + 0.07, 0, 2.5, 'steel');
for (let i = 0; i < 5; i++) { prop('propane_tank', 44.2 + i * 0.75, -36.2, i * 40, { scale: 1.5 }); prop('small_lpg_tank', 44.4 + i * 0.9, -35.2, i * 25); }
dress('sign', { text: 'GAS STORE\nNO NAKED FLAME', x: 46.5, y: 1.6, z: GS.z0 - 0.11, yaw: 180, h: 0.2, color: '#16140f', bg: '#d6a21a', worn: 0.3 });
container(53.5, -20, 90, '#8a2f25'); container(53.5, -20, 90, '#c8b23a', { y: 2.59 }); container(53.5, 13, 90, '#3d6b45'); container(52, 36, 84, '#31485c');
dress('shelter', { x: 52.5, z: -4, yaw: -90, w: 7, d: 4.6, h: 2.7, color: '#9a5a2c' });
prop('wooden_military_crate', 52.4, -5.4, 10); prop('wooden_crate_02', 53.2, -2.4, 70); prop('Barrel_02', 50.6, -6.8, 0); prop('cement_bag', 51.4, -1.2, 40); prop('hand_truck', 50.4, -2.2, 120);
heap(39, 35, 2.8, 1.4); heap(33, -30, 2.6, 1.3);
rbox(17.5, 34.5, 6, 0.22, 0, 3.0, -15, 'antifoul'); rbox(36, 6.5, 5.5, 0.22, 0, 3.2, 70, 'hull'); rbox(24, -27, 5, 0.22, 0, 2.9, -30, 'rust'); rbox(41, -22, 5.5, 0.22, 0, 3.3, 5, 'hull');
prop('portable_welding_cart', 16.6, 14.6, 110); prop('small_lpg_tank', 17.4, 15.6, 0); prop('Barrel_01', 23.4, -1.2, 0); prop('Barrel_02', 24.2, -0.6, 0); prop('rusted_wheel_rim_01', 31.4, 16.2, 0, { lay: true });
prop('concrete_road_barrier', 13.5, 4.5, 80); prop('concrete_road_barrier', 13.9, 6.2, 84); prop('old_tyre', 45.4, 16.8, 0, { lay: true }); prop('old_tyre', 45.5, 16.9, 30, { lay: true, y: 0.16 });
dress('plates', { at: plates }); dress('scrap', { at: heaps });

// ---------------------------------------------------------------- beyond the fences (out of reach): the next plots, dunes, the roads
dress('ship', { x: -104, z: 16, yaw: 96, len: 118, beam: 18, deck: 9.5, water: 0.4, hull: '#3a4046', boot: '#7a3a2e', house: '#bdb6a4', accent: '#3d6b45', name: 'CALDER STRAIT', port: 'PORT VILA', cargo: 0, cranes: 2, seed: 14, dead: true, lod: 2 });
dress('ship', { x: 112, z: 30, yaw: 84, len: 96, beam: 15.5, deck: 8.4, water: 0.4, hull: '#4a3a34', boot: '#6e2b22', house: '#c6c0ae', accent: '#2f5d7a', name: 'NORTHERN LYRE', port: 'PANAMA', cargo: 0, cranes: 0, seed: 22, dead: true, lod: 2 });
dress('ship', { x: 230, z: 330, yaw: 20, len: 130, beam: 20, deck: 9, name: 'ASTER QUAY', port: 'LIMASSOL', cargo: 0, cranes: 2, seed: 31, dead: true, lod: 2, water: -0.14 });   // at anchor, waiting for the next spring tide
dress('crawlerCrane', { x: -88, z: -34, yaw: 60, boom: 44, angle: 71, color: '#b8291e' }); dress('crawlerCrane', { x: 96, z: -20, yaw: 200, boom: 40, angle: 58 });
dress('mounds', { a: [-240, -92], b: [240, -100], n: 22, w: 22, h: 4.5, seed: 4, spread: 16, color: '#d9c8a4' });
dress('mounds', { a: [-360, -190], b: [360, -200], n: 16, w: 60, h: 13, seed: 9, color: '#cbbb9a', spread: 40 });
dress('plates', { seed: 12, at: [[-72, -30, 10, 6, 2.4, 1.8], [-74, -22, 14, 6, 2.4, 1.2], [-80, -8, 80, 6, 2.4, 2.2], [74, -40, 0, 6, 2.4, 2.0], [78, -32, 6, 6, 2.4, 1.4], [70, 2, 90, 6, 2.4, 1.6], [-70, 30, 20, 6, 2.4, 1.0], [84, 12, 30, 6, 2.4, 1.8]] });
dress('scrap', { seed: 21, at: [[-70, -46, 4, 2.4], [72, -52, 5, 3], [18, -64, 5, 2.6], [-30, -66, 4, 2.2], [78, 24, 4, 2]] });
box(-52, -72, -26, -60, 0, 5.5, 'corrugated', { collide: false, tint: '#8a8f8c' }); box(44, -76, 70, -62, 0, 6.5, 'corrugated', { collide: false, tint: '#9a8f7c' });

// ---------------------------------------------------------------- marks on the sand
decal('stain', -9, -22, 9, 6, 20); decal('stain', 12, -12, 7, 6, 60); decal('stain', 24, 10, 9, 7, 10); decal('stain', -30, 18, 8, 6, 80); decal('stain', 40, -8, 7, 6, 0);
decal('stain', -14, 8, 7, 5, 40); decal('stain', 2, -36, 8, 6, 15); decal('stain', 46, -30, 6, 5, 0); decal('stain', -46, -12, 7, 6, 70); decal('stain', 14, 30, 8, 6, 30);

// ---------------------------------------------------------------- pickups
pickup('ammo', -45.5, -13.5); pickup('ammo', 52.6, -3.6); pickup('ammo', 36, -48.4); pickup('ammo', 1.5, -33);
{ let p = hp(0, -8); pickup('ammo', p[0], p[1], 0.1); p = hp(-5.5, 22.5); pickup('ammo', p[0], p[1], 2.8); p = hp(4.6, 33); pickup('ammo', p[0], p[1], 0.1); }
pickup('ammo', -33, 26); pickup('ammo', 31, 34); { const p = BW.pt(0, 5); pickup('ammo', p[0], p[1]); }

export default {
  id: 'breakers',
  name: 'Breakers',
  blurb: 'Shipbreaking beach · noon heat haze · close to long range',
  pitch: 'A freighter is being cut apart on the Breakers flat. Fight through its holds, or take the long way round over open sand.',
  players: { min: 12, max: 32 },
  env: {
    hdri: 'kloofendal_48d_partly_cloudy_puresky',
    sunAzimuth: 214, sunElevation: 54,
    sunColor: '#fff0d8', sunIntensity: 6.0,
    exposure: 0.8, skyIntensity: 0.5, ambient: 0.78,
    fog: { color: '#b4c2c8', sunColor: '#e9dfc8', density: 0.0034, falloff: 0.012 },      // pale heat haze off the flat
    shafts: { density: 0.0036, strength: 0.5, distance: 110, anisotropy: 0.55, glow: 2 },
    weather: { rain: 0, wet: 0 },
    water: { y: -0.14, color: '#1c2a2b' },
    bloom: { strength: 0.12, radius: 0.8, threshold: 1.35 },
    grade: { saturation: 0.96, contrast: 0.24, vignette: 0.3, shadows: [0.012, 0.01, 0.0], highlights: [0.028, 0.016, -0.014] },
    glare: 0.3, sunCap: 18,
  },
  bounds: { minX: -60, maxX: 60, minZ: -55, maxZ: 53, groundY: 0, maxY: 36 },
  ...L,
  shots: [
    { from: [-9, 1.7, -42], to: [-3, 1.9, -36], look: [1, 5.5, -16], fov: 55, dur: 17 },
    { from: [-46, 1.5, 30], to: [-40, 1.6, 34], look: [0, 9, 40], fov: 52, dur: 15 },
    { from: [44, 11, -40], to: [38, 9.5, -32], look: [4, 4, 6], lookTo: [0, 4, 16], fov: 52, dur: 17 },
    { from: [1.5, 1.6, -15], to: [1.8, 1.7, -4], look: [2.6, 3.2, 14], fov: 62, dur: 15 },
  ],
  spawns: {
    dm: [
      spawn(-56, -50, 120), spawn(-56, -28, 90), spawn(-50, -3, 90), spawn(-56, 14, 90), spawn(-54, 33, 60), spawn(-38, -48, 150),
      spawn(-28, -24, 120), spawn(-34, 0, 90), spawn(-24, 30, 40), spawn(-12, -44, 160), spawn(-13, -12, 90), spawn(-14, 18, 90),
      spawn(0, -50, 180), spawn(1, -26, 180), inHull(0, -9, 180), inHull(-3.5, 9, 0), inHull(2.5, 21, 0), inHull(5, 32.5, 0),
      spawn(13, -40, 200), spawn(13, -8, 270), spawn(14, 24, 270), spawn(24, -24, 240), spawn(31, 15, 270), spawn(24, 36, 300),
      spawn(36, -40, 210), spawn(40, -3, 270), spawn(41, 28, 300), spawn(56, -50, 240), spawn(56, -28, 270), spawn(56, 4, 270),
      spawn(56, 22, 270), spawn(55, 34, 300),
    ],
    team1: [spawn(-56, -50, 100), spawn(-56, -42, 90), spawn(-56, -34, 90), spawn(-56, -26, 90), spawn(-57, -2, 90), spawn(-56, 4, 90), spawn(-56, 14, 90), spawn(-56, 22, 90),
      spawn(-55, 31, 75), spawn(-50, -46, 110), spawn(-49, -27, 90), spawn(-50, -2, 90), spawn(-51, 16, 90), spawn(-52, 36, 70), spawn(-45, -40, 110), spawn(-45, 30, 80)],
    team2: [spawn(56, -50, 260), spawn(56, -42, 270), spawn(56, -34, 270), spawn(56, -27, 270), spawn(57, -12, 270), spawn(56, 4, 270), spawn(57, 22, 270), spawn(56, 30, 280),
      spawn(55, 38, 290), spawn(50, -46, 250), spawn(50, -26, 270), spawn(49, 3, 270), spawn(50, 20, 270), spawn(47, 37, 290), spawn(45, -42, 250), spawn(46, 12, 270)],
  },
};
