// CROSSWIND — a coastal airfield on a cold, clear morning. The runway is shut: a freighter lies on its belly
// across it and both ends are blocked with containers.
// Layout (top view, +z is south / the sea), 240 m x 232 m. Three lanes run west-east between the two ends:
//   service road ───────────────────────────────────────────────────────────
//   motor pool (W) │ HANGAR 1 │ boiler house │ HANGAR 2 │ generators │ HANGAR 3 │ freight shed (E)     close range
//                  │ apron: parked aircraft, ground vehicles, freight, the operations block and tower   mid range
//   taxiway ── grass ── RUNWAY (wreck, fire tender, barricades) ── grass                                  long range
//   fuel farm (SW) ──────── substation ──────── radar station (SE)
//   fence ── dunes ── sea
import { createKit } from './kit.js';

const { L, box, rbox, wall, stairs, frame, container, prop, light, decal, pickup, spawn, dress, pallets } = createKit();
const HID = { visible: false, surf: 'metal' };

// ---------------------------------------------------------------- ground: tiles that meet edge to edge (nothing overlaps, so nothing flickers at a distance)
const TURF = '#b9cc9c';      // winter grass: the texture alone reads as bare earth
const G = (x0, z0, x1, z1, mat) => box(x0, z0, x1, z1, -2, 0, mat, mat === 'grass' ? { tint: TURF } : {});
G(-120, -120, 120, -116, 'grass'); G(-120, -116, 120, -108, 'runway');                                  // service road
G(-120, -108, -104, -68, 'grass'); G(104, -108, 120, -68, 'grass'); G(-104, -108, 104, -104, 'apron');
G(-104, -104, -84, -68, 'apron'); G(-84, -104, -44, -68, 'hangarfloor'); G(-44, -104, -20, -68, 'apron'); G(-20, -104, 20, -68, 'hangarfloor');
G(20, -104, 44, -68, 'apron'); G(44, -104, 84, -68, 'hangarfloor'); G(84, -104, 104, -68, 'apron');
G(-120, -68, 120, 10, 'apron');                                                                      // apron
G(-120, 10, 120, 28, 'runway');                                                                         // taxiway
G(-120, 28, -78, 42, 'grass'); G(-78, 28, -62, 42, 'runway'); G(-62, 28, 62, 42, 'grass'); G(62, 28, 78, 42, 'runway'); G(78, 28, 120, 42, 'grass');
G(-120, 42, 120, 72, 'runway');                                                                         // the runway
G(-120, 72, 120, 84, 'grass');
G(-120, 84, -104, 106, 'grass'); G(-104, 84, -60, 106, 'apron'); G(-60, 84, -14, 106, 'grass'); G(-14, 84, 14, 106, 'gravel'); G(14, 84, 60, 106, 'grass'); G(60, 84, 104, 106, 'apron'); G(104, 84, 120, 106, 'grass');
G(-120, 106, 120, 112, 'grass');
// the rest of the field, out of reach
const far = (x0, z0, x1, z1, mat) => box(x0, z0, x1, z1, -2, 0, mat, { collide: false, ...(mat === 'grass' ? { tint: TURF } : {}) });
for (const s of [-1, 1]) { const a = s < 0 ? -760 : 120, b = s < 0 ? -120 : 760; far(a, -760, b, 10, 'grass'); far(a, 10, b, 28, 'runway'); far(a, 28, b, 42, 'grass'); far(a, 42, b, 72, 'runway'); far(a, 72, b, 150, 'grass'); }
far(-120, -760, 120, -120, 'grass'); far(-120, 112, 120, 150, 'grass');

// ---------------------------------------------------------------- perimeter: chain-link north and south, containers across the paved ends
const WIRE = { visible: false, bullet: false, sight: false, railing: true, surf: 'metal' };
box(-120, -120.1, 120, -119.9, 0, 3, 'steel', WIRE); box(-120, 111.9, 120, 112.1, 0, 3, 'steel', WIRE);
for (const x of [-120, 120]) { box(x - 0.1, -120, x + 0.1, 8, 0, 3, 'steel', WIRE); box(x - 0.1, 74, x + 0.1, 112, 0, 3, 'steel', WIRE); }
dress('fence', { pts: [[-120, 8], [-120, -120], [120, -120], [120, 8]] }); dress('fence', { pts: [[120, 74], [120, 112], [-120, 112], [-120, 74]] });
dress('fence', { pts: [[-320, -120], [-120, -120]], barbed: false }); dress('fence', { pts: [[120, -120], [320, -120]], barbed: false });
dress('fence', { pts: [[-320, 112], [-120, 112]], barbed: false }); dress('fence', { pts: [[120, 112], [320, 112]], barbed: false });
const BOXES = ['#8a2f25', '#2f5d7a', '#b4772a', '#3d6b45', '#c9c2b2', '#31485c', '#7a3b2a', '#c8b23a'];
for (const [x, s] of [[-121.4, 1], [121.4, 3]]) for (let i = 0; i < 11; i++) { const z = 11.2 + i * 6.12; container(x, z, 90, BOXES[(i * 3 + s) % 8]); if ((i + s) % 4) container(x, z, 90, BOXES[(i * 5 + s + 2) % 8], { y: 2.59 }); }

// ---------------------------------------------------------------- hangars
const EAVE = 8, HZ0 = -104, HZ1 = -68;
/** One hangar: walls with the big door in the south gable; leaves = door panels [[xa, xb], ...]; the pitched roof is scenery. */
function hangar(num, x0, x1, tint, door, leaves) {
  const xm = (x0 + x1) / 2;
  wall('x', HZ1, x0, x1, 0, EAVE, 0.3, 'cladding', [{ a: door[0], b: door[1], y0: 0, y1: 6.6 }], { tint });
  wall('x', HZ0, x0, x1, 0, EAVE, 0.3, 'cladding', [{ a: xm - 2.4, b: xm + 2.4, y0: 0, y1: 4.4 }, { a: x1 - 5.2, b: x1 - 3.7, y0: 0, y1: 2.3 }], { tint });
  wall('z', x0, HZ0, HZ1, 0, EAVE, 0.3, 'cladding', [{ a: -88, b: -86.4, y0: 0, y1: 2.3 }], { tint });
  wall('z', x1, HZ0, HZ1, 0, EAVE, 0.3, 'cladding', [{ a: -84, b: -82.4, y0: 0, y1: 2.3 }], { tint });
  for (const [a, b] of leaves) box(a, HZ1 + 0.2, b, HZ1 + 0.38, 0, 6.8, 'cladding', { tint: '#59666b' });
  box(door[0] - 0.4, HZ1 + 0.15, door[1] + 0.4, HZ1 + 0.45, 6.8, 7.1, 'steel', { collide: false });                                    // door track
  box(x0 - 0.7, HZ0 - 0.7, x1 + 0.7, HZ1 + 0.7, EAVE, EAVE + 0.15, 'steel', { visible: false });                                    // stops shots at the eaves; the roof above is scenery
  dress('hangar', { x0, x1, z0: HZ0, z1: HZ1, eave: EAVE, ridge: 11.6, tint, num });
}
hangar(1, -84, -44, '#9aa7ab', [-78, -50], [[-84.4, -78], [-50, -43.6]]);
hangar(2, -20, 20, '#a8a08c', [-14, 14], [[-14.2, -2], [14, 20.4]]);
hangar(3, 44, 84, '#8f9a8a', [50, 78], [[50, 56], [72, 78]]);

// ---------------------------------------------------------------- aircraft and vehicles (scenery plus the boxes you bump into)
function cargoPlane(x, z, yawDeg, o = {}) {
  const F = frame(x, z, yawDeg);
  if (!o.wreck) {
    F.box(-3.2, -1.3, 9.4, 1.3, 0.75, 3.7, 'steel', HID); F.box(-11, -0.9, -3.2, 0.9, 2.0, 4.2, 'steel', HID);       // fuselage; you can duck under the tail
    F.box(-2.3, -13.6, 1.1, 13.6, 3.5, 3.95, 'steel', HID);                                                           // wing, overhead
    for (const s of [-1, 1]) { F.box(-2.6, s * 4.9 - 0.62, 2.6, s * 4.9 + 0.62, 2.55, 3.9, 'steel', HID); F.box(-2.3, s * 1.75 - 0.45, 1.2, s * 1.75 + 0.45, 0, 1.3, 'steel', HID); }
    F.box(6.7, -0.3, 7.1, 0.3, 0, 0.8, 'steel', HID); F.box(-11.4, -0.12, -7.3, 0.12, 4.2, 7.8, 'steel', HID); F.box(-10.8, -4.7, -8.5, 4.7, 3.6, 3.85, 'steel', HID);
  } else {                                                                                                            // on its belly, right wing in the grass
    F.box(-3.2, -1.5, 9.6, 1.5, 0, 3.0, 'steel', HID); F.box(-11, -1, -3.2, 1, 0.9, 3.6, 'steel', HID);
    F.box(-2.3, 1.4, 1.1, 5.5, 2.15, 2.9, 'steel', HID); F.box(-2.2, 5.5, 0.9, 9.5, 1.45, 2.4, 'steel', HID); F.box(-1.8, 9.5, 0.7, 13.6, 0.75, 1.8, 'steel', HID);
    F.box(-2.3, -13.6, 1.1, -1.4, 3.1, 4.7, 'steel', HID);
    F.box(-2.6, 4.3, 2.6, 5.5, 1.05, 2.5, 'steel', HID); F.box(-2.6, -5.5, 2.6, -4.3, 2.5, 3.8, 'steel', HID); F.box(-11.4, -0.5, -7.3, 0.7, 3.4, 7.0, 'steel', HID);
  }
  dress('aircraft', { x, z, yaw: yawDeg, kind: 'cargo', ...o });
}
function lightPlane(x, z, yawDeg, o = {}) {
  const F = frame(x, z, yawDeg);
  F.box(-1, -0.65, 2.9, 0.65, 0.75, 2.2, 'steel', HID); F.box(-4.9, -0.2, -1, 0.2, 1.3, 2.0, 'steel', HID); F.box(-0.5, -5.4, 1.1, 5.4, 2.25, 2.5, 'steel', HID);
  for (const s of [-1, 1]) F.box(-0.25, s * 1.2 - 0.2, 0.25, s * 1.2 + 0.2, 0, 0.9, 'steel', HID);
  dress('aircraft', { x, z, yaw: yawDeg, kind: 'light', ...o });
}
const VEH = { truck: [7.8, 2.5, 3.0], bowser: [7.8, 2.5, 3.0], tender: [8.2, 2.56, 3.2], pickup: [5.1, 1.9, 1.95], tug: [3.1, 1.5, 2.15], cart: [3.1, 1.6, 1.8], stairs: [4.8, 2.0, 3.7] };
const vehicle = (type, x, z, yawDeg, color, o = {}) => {
  const [len, wid, h] = VEH[type], a = (yawDeg * Math.PI) / 180, off = type === 'truck' || type === 'bowser' || type === 'tender' ? -0.1 : 0;
  rbox(x + off * Math.cos(a), z - off * Math.sin(a), len, wid, 0.02, h, yawDeg, 'steel', { ...HID, surf: 'metal' });
  dress('vehicle', { kind: type, x, z, yaw: yawDeg, color, ...o });
};
const barriers = (x, z, yawDeg, n, model = 'concrete_road_barrier_02') => { const a = (yawDeg * Math.PI) / 180; for (let i = 0; i < n; i++) prop(model, x + Math.cos(a) * i * 1.62, z - Math.sin(a) * i * 1.62, yawDeg); };
const bags = [];
/** A sandbag wall: scenery plus its collider. */
const sandbag = (x, z, yawDeg, len = 4, h = 1.1) => { bags.push([x, z, yawDeg, len, h]); rbox(x, z, len, 0.7, 0, h, yawDeg, 'wall', { visible: false, surf: 'dirt' }); };
/** A position on open ground: a sandbag horseshoe facing `yawDeg`. */
const nest = (x, z, yawDeg) => { const a = (yawDeg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); sandbag(x, z, yawDeg, 4.2); sandbag(x - c * 2.1 + s * 1.3, z + s * 2.1 + c * 1.3, yawDeg + 90, 2.6); sandbag(x + c * 2.1 + s * 1.3, z - s * 2.1 + c * 1.3, yawDeg + 90, 2.6); };

// ---------------------------------------------------------------- hangar 1: light aircraft maintenance
lightPlane(-64, -88, -90, { reg: 'TAC 114', livery: { stripe: '#2f5d7a', tail: '#2f5d7a' } });
for (let z = -100; z <= -74; z += 5.2) if (Math.abs(z + 87.2) > 2) prop('steel_frame_shelves_01', -83.1, z, 90);
box(-72, -103.4, -66, -102.4, 0, 0.92, 'wood'); box(-58, -103.4, -52, -102.4, 0, 0.92, 'wood');                       // benches along the back wall
prop('tool_cart', -70.5, -84.5, 20); prop('tool_cart', -57.4, -91.6, -70); prop('metal_tool_chest', -70, -102.9, 0, { y: 0.92 }); prop('metal_tool_chest', -55, -102.9, 0, { y: 0.92 });
prop('Barrel_01', -46.4, -101.6, 0); prop('Barrel_02', -47.3, -102.2, 0); prop('Barrel_01', -46.6, -100.5, 30); prop('wooden_military_crate', -77.5, -72.5, 10); prop('wooden_military_crate', -77.4, -72.4, 95, { y: 0.41 });
prop('wooden_crate_02', -75.8, -71.8, 60); prop('hand_truck', -49, -76, 200); prop('metal_jerrycan_green', -69.2, -85.6, 30); prop('old_tyre', -60.4, -84.6, 0, { lay: true }); prop('old_tyre', -60.5, -84.7, 40, { lay: true, y: 0.16 });
container(-50.5, -95, 90, '#31485c', { open: true });
// ---------------------------------------------------------------- hangar 2: workshop with a stores room and a gallery over it
wall('x', -93, 9, 19.7, 0, 3.05, 0.2, 'plaster', [{ a: 12.5, b: 14, y0: 0, y1: 2.2 }, { a: 15.5, b: 18, y0: 1.0, y1: 2.2 }]); wall('z', 9, -103.7, -93, 0, 3.05, 0.2, 'plaster');
box(8.9, -103.7, 19.7, -92.9, 3.05, 3.2, 'grid', { surf: 'metal' });
stairs(5.58, -102.6, 'x+', 1.5, 3.2, 10, 'plate', 0.36);
box(8.9, -92.98, 19.7, -92.9, 3.2, 4.2, 'grid', { bullet: false, sight: false, railing: true }); box(8.9, -101.8, 8.98, -92.9, 3.2, 4.2, 'grid', { bullet: false, sight: false, railing: true });
prop('steel_frame_shelves_01', 19.0, -100, -90); prop('steel_frame_shelves_01', 19.0, -96.6, -90); prop('cardboard_box_01', 11, -101.6, 20); prop('wooden_military_crate', 15.2, -95.2, 0, { y: 3.2 }); prop('metal_tool_chest', 18.4, -94, -90, { y: 3.2 });
light(14, 2.6, -98.5, 0xffd9a8, 16, 10);
container(-15.4, -98, 90, '#3d6b45'); container(-15.4, -90.4, 90, '#b4772a', { open: true }); container(-15.4, -98, 90, '#c9c2b2', { y: 2.59 });
box(-6, -90, -1, -86.5, 0, 1.5, 'steel', { tint: '#59666b' }); box(-5.4, -89.4, -1.6, -87.1, 1.5, 2.4, 'rust', { tint: '#6a7075' });   // an engine on its stand
prop('tool_cart', -7.6, -85.6, 40); prop('tool_cart', 1.4, -91.2, -20); prop('portable_generator', 4.6, -74.5, 100, { scale: 1.4 }); prop('Barrel_01', -18.6, -72.6, 0); prop('Barrel_02', -18.4, -73.8, 0);
prop('wooden_military_crate', 6.5, -86, 30); prop('wooden_crate_02', 7.8, -84.8, 80); prop('hand_truck', -9.5, -95.5, 30); prop('metal_jerrycan_green', 3.2, -89.6, 0); prop('metal_jerrycan_green', 3.6, -90.2, 50);
pallets(-3.5, -100.5, 4, 6); pallets(-1.9, -100.6, -3, 4); pallets(12.4, -76.5, 80, 5);
// ---------------------------------------------------------------- hangar 3: freight store, aisles between containers
container(52, -97, 90, '#2f5d7a'); container(52, -97, 90, '#c8b23a', { y: 2.59 }); container(52, -88.6, 90, '#8a2f25'); container(60.5, -99.5, 0, '#31485c'); container(60.5, -99.5, 0, '#b4772a', { y: 2.59 });
container(63, -86, 86, '#3d6b45'); container(71, -92, 0, '#c9c2b2', { open: true }); container(76, -99, 90, '#7a3b2a'); container(76, -99, 90, '#2f5d7a', { y: 2.59 }); container(77.5, -84, 90, '#8a2f25');
pallets(57, -80, 10, 7); pallets(58.5, -80.2, -5, 5); pallets(68.4, -78.6, 80, 6); pallets(70, -100.6, 0, 4); pallets(81.4, -92.4, 90, 6);
prop('wooden_military_crate', 66.2, -98.6, 0); prop('wooden_military_crate', 66.3, -98.5, 80, { y: 0.41 }); prop('wooden_crate_02', 46.6, -76.4, 20); prop('cardboard_box_01', 47.4, -78.2, 60); prop('hand_truck', 65.4, -82.4, 110);
prop('industrial_storage_cart', 48, -70.6, 5); prop('Barrel_02', 82.4, -70.4, 0); prop('Barrel_02', 82.6, -71.5, 0); prop('plastic_crate_01', 73.4, -80.2, 30);
// ---------------------------------------------------------------- the gaps between the hangars
const house = (x0, z0, x1, z1, h, mat, tint, door) => {                                                              // a small utility building with one door on its south side
  wall('x', z1, x0, x1, 0, h, 0.25, mat, [{ a: door, b: door + 1.4, y0: 0, y1: 2.2 }], { tint }); wall('x', z0, x0, x1, 0, h, 0.25, mat, [], { tint });
  wall('z', x0, z0, z1, 0, h, 0.25, mat, [], { tint }); wall('z', x1, z0, z1, 0, h, 0.25, mat, [{ a: (z0 + z1) / 2 - 1, b: (z0 + z1) / 2 + 1, y0: 1.1, y1: 2.2 }], { tint });
  box(x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 0.3, h, h + 0.25, 'wall');
};
house(-38, -101, -27, -92, 3.6, 'brick', '#ffffff', -33); box(-29.6, -100, -28.4, -98.8, 3.85, 9, 'brick');           // boiler house and its stack
house(26, -101, 38, -92, 3.4, 'plaster', '#c9c2b2', 30.5);
prop('portable_generator', 34, -96.5, 0, { scale: 1.6 }); prop('utility_box_02', 28.2, -99.8, 0); prop('power_box_01', 26.14, -94, 90, { y: 1.3 }); light(32, 2.9, -96.5, 0xffd9a8, 14, 9); light(-32.5, 3.0, -96.5, 0xffb46b, 14, 9);
prop('Barrel_01', -36.4, -99.4, 0); prop('Barrel_01', -35.6, -99.8, 30); prop('cement_bag', -30, -94, 0);
box(-41.5, -90, -39.5, -86.5, 0, 1.4, 'rust'); box(22, -90.5, 24, -87, 0, 1.4, 'rust');                               // skips
vehicle('pickup', -31, -77, 80, '#5d6a4f'); vehicle('truck', 33, -79, -95, '#4f5d6a');
for (const [x, z] of [[-24.6, -84], [-23.4, -84.4], [-24, -85.2], [41, -72], [41.9, -72.5], [22.6, -98.6], [23.4, -99.4]]) prop((x * 7) % 2 ? 'Barrel_01' : 'Barrel_02', x, z, x * 30);
barriers(-43, -69.6, 0, 3); barriers(38.5, -69.6, 0, 3, 'concrete_road_barrier');
// ---------------------------------------------------------------- service road, behind the hangars
vehicle('truck', -68, -112.4, 4, '#5d6a4f'); vehicle('bowser', 8, -111.6, 182, '#c9c6bb'); vehicle('pickup', 62, -113, -6, '#31485c'); vehicle('truck', 96, -111, 176, '#6a5d4f');
container(-100, -113.5, 0, '#7a3b2a'); container(-30, -105.6, 0, '#31485c'); container(33, -106, 2, '#c9c2b2'); container(-8, -114, 3, '#3d6b45');
barriers(-52, -109, 90, 3); barriers(26, -114, 0, 4); barriers(80, -108.6, 0, 3, 'concrete_road_barrier');
pallets(-94, -106, 10, 6); pallets(48, -106.4, 0, 5); pallets(90, -106, 20, 7);

// ---------------------------------------------------------------- apron
cargoPlane(-9, -41, -8, { reg: 'TAC 207' });
lightPlane(-66, -52, 28, { reg: 'TAC 131', livery: { stripe: '#3d6b45', tail: '#3d6b45' } });
lightPlane(72, -26, 195, { reg: 'TAC 152', livery: { stripe: '#b4772a', tail: '#31485c' } });
vehicle('stairs', -3.4, -36.4, 82, '#c9c6bb'); vehicle('bowser', 5.5, -52, 172, '#c9c6bb'); vehicle('tug', -24, -31, 10, '#c8b23a');
vehicle('cart', -28.2, -30.4, 10, '#59666b'); vehicle('cart', -32, -29.7, 12, '#59666b'); vehicle('cart', -35.8, -28.9, 12, '#59666b');
vehicle('truck', 28, -58, 96, '#5d6a4f'); vehicle('pickup', -44, -22, 190, '#d9a81c', { text: 'FOLLOW ME' }); vehicle('tug', 44, -18, -150, '#c8b23a'); vehicle('cart', 47.6, -16.4, -150, '#59666b');
container(50, -50, 0, '#8a2f25'); container(50, -47.3, 2, '#2f5d7a'); container(50, -50, 0, '#c8b23a', { y: 2.59 }); container(58.5, -37, 90, '#3d6b45'); container(31, -24, 4, '#c9c2b2', { open: true });
container(-86, -24, 86, '#31485c'); container(-90, -56, 4, '#b4772a'); container(-90, -56, 4, '#7a3b2a', { y: 2.59 }); container(92, -52, 90, '#2f5d7a'); container(22, -40, 60, '#7a3b2a');
prop('covered_car', -88, -40.5, 0); prop('covered_car', -84.6, -40, 4); prop('covered_car', 86.5, -31, 92); prop('covered_car', -52, -16.4, 80); prop('covered_car', 66, -62, 20);
barriers(-58, -34, 12, 4); barriers(14, -27, -20, 4); barriers(64, -48, 80, 3, 'concrete_road_barrier'); barriers(-38, -60, 90, 3, 'concrete_road_barrier'); barriers(-74, -20, 0, 4); barriers(80, -14.5, 5, 4);
pallets(-18, -57, 20, 6); pallets(-16.4, -57.6, 14, 4); pallets(36, -34, 70, 5); pallets(-72, -36, 0, 7); pallets(8, -20, 40, 5); pallets(74, -44, 10, 6);
prop('tool_cart', -13.6, -47.4, 30); prop('Barrel_01', -5.4, -47.2, 0); prop('Barrel_02', 12.2, -34.6, 0); prop('metal_jerrycan_green', 4.2, -49.2, 20); prop('wooden_military_crate', -20.5, -43, 10); prop('wooden_crate_02', -21.6, -44.2, 70);
prop('wooden_military_crate', 40.2, -43.2, 0); prop('wooden_military_crate', 40.3, -43.1, 90, { y: 0.41 }); prop('Barrel_02', -62.4, -44.6, 0); prop('tool_cart', -61.2, -48.6, 100); prop('old_tyre', 70.4, -22.4, 0, { lay: true });
for (const [x, z] of [[-100, -66], [100, -66], [-48, -13], [48, -13]]) { dress('lightMast', { x, z, h: 20, lit: false }); box(x - 0.7, z - 0.7, x + 0.7, z + 0.7, 0, 0.8, 'wall', { visible: false }); box(x - 0.34, z - 0.34, x + 0.34, z + 0.34, 0.8, 20, 'steel', { visible: false }); }
nest(-34, -44, 80); nest(34, -30, -100); nest(-56, -64, 170);

// ---------------------------------------------------------------- operations block and control tower
const OPS = { x0: -16, x1: 12, z0: -9, z1: 7, h: 4 }, CREAM = '#d2ccba';
wall('x', OPS.z0, OPS.x0, OPS.x1, 0, OPS.h, 0.3, 'plaster', [{ a: -5, b: -3.4, y0: 0, y1: 2.3 }, { a: -13, b: -10, y0: 1.0, y1: 2.4 }, { a: -1, b: 2, y0: 1.0, y1: 2.4 }, { a: 5, b: 8, y0: 1.0, y1: 2.4 }], { tint: CREAM });
wall('x', OPS.z1, OPS.x0, OPS.x1, 0, OPS.h, 0.3, 'plaster', [{ a: 1.5, b: 3.1, y0: 0, y1: 2.3 }, { a: -12, b: -9, y0: 1.0, y1: 2.4 }, { a: -6, b: -3, y0: 1.0, y1: 2.4 }, { a: 6, b: 9, y0: 1.0, y1: 2.4 }], { tint: CREAM });
wall('z', OPS.x0, OPS.z0, OPS.z1, 0, OPS.h, 0.3, 'plaster', [{ a: -1.5, b: 0.1, y0: 0, y1: 2.3 }, { a: 3, b: 5.4, y0: 1.0, y1: 2.4 }], { tint: CREAM });
wall('z', OPS.x1, OPS.z0, OPS.z1, 0, OPS.h, 0.3, 'plaster', [{ a: 3.6, b: 5.8, y0: 1.0, y1: 2.4 }, { a: -8, b: -5.6, y0: 1.0, y1: 2.4 }], { tint: CREAM });
wall('z', -6, OPS.z0 + 0.15, OPS.z1 - 0.15, 0, OPS.h, 0.16, 'plaster_in', [{ a: -3.2, b: -1.7, y0: 0, y1: 2.2 }]);
wall('z', 3, OPS.z0 + 0.15, OPS.z1 - 0.15, 0, OPS.h, 0.16, 'plaster_in', [{ a: 1, b: 2.5, y0: 0, y1: 2.2 }, { a: -6.4, b: -4.9, y0: 0, y1: 2.2 }]);
wall('x', -1, -5.92, 2.92, 0, OPS.h, 0.16, 'plaster_in', [{ a: -2.6, b: -1.1, y0: 0, y1: 2.2 }]);
box(OPS.x0 + 0.15, OPS.z0 + 0.15, OPS.x1 - 0.15, OPS.z1 - 0.15, 0, 0.03, 'floor_in', { collide: false }); box(OPS.x0 + 0.15, OPS.z0 + 0.15, OPS.x1 - 0.15, OPS.z1 - 0.15, OPS.h - 0.04, OPS.h, 'plaster_in', { collide: false });
box(OPS.x0 - 0.4, OPS.z0 - 0.4, OPS.x1 + 0.4, OPS.z1 + 0.4, OPS.h, OPS.h + 0.3, 'wall');                              // roof slab: an overlook, up the outside stair
const PAR = { y0: OPS.h + 0.3, y1: OPS.h + 1.25 };
box(OPS.x0 - 0.4, OPS.z0 - 0.4, OPS.x1 + 0.4, OPS.z0 - 0.15, PAR.y0, PAR.y1, 'wall'); box(OPS.x0 - 0.4, OPS.z1 + 0.15, OPS.x1 + 0.4, OPS.z1 + 0.4, PAR.y0, PAR.y1, 'wall');
box(OPS.x1 + 0.15, OPS.z0 - 0.4, OPS.x1 + 0.4, OPS.z1 + 0.4, PAR.y0, PAR.y1, 'wall'); box(OPS.x0 - 0.4, -2.4, OPS.x0 - 0.15, OPS.z1 + 0.4, PAR.y0, PAR.y1, 'wall'); box(OPS.x0 - 0.4, OPS.z0 - 0.4, OPS.x0 - 0.15, -5.4, PAR.y0, PAR.y1, 'wall');
stairs(-17.25, -9.0, 'z+', 1.7, 4.3, 14, 'wall', 0.34); box(-18.1, -4.41, -16.4, -2.4, 0, 4.3, 'wall');
box(-14.6, 3.2, -9.6, 4.4, 0, 0.78, 'wood'); box(-14.8, -7.6, -13.6, -4.4, 0, 0.78, 'wood'); box(5.5, -8.3, 10.5, -7.2, 0, 0.78, 'wood');
prop('vintage_radio_transceiver', 8, -7.75, 180, { y: 0.78 }); prop('metal_tool_chest', 11.2, 5.9, -90); prop('cardboard_box_01', -15, 6, 20); prop('cardboard_box_01', -0.6, 5.9, -10); prop('steel_frame_shelves_01', -4.6, 6.3, 0); prop('steel_frame_shelves_01', 0.5, -8.3, 0);
light(-11, 3.3, -1, 0xffe2c0, 18, 11); light(-1.5, 3.3, 3, 0xffe2c0, 16, 10); light(7.5, 3.3, -1, 0xffe2c0, 18, 11, { priority: 2 });
box(12, -4.5, 18.5, 2, 0, 16, 'plaster', { tint: CREAM });                                                           // tower shaft
dress('tower', { x: 15.25, z: -1.25, w: 3.25, h: 16 });
dress('sign', { text: 'OPERATIONS', x: -4, y: 3.2, z: OPS.z0 - 0.16, yaw: 180, h: 0.5, color: '#2a2e33', worn: 0.5 }); dress('sign', { text: 'CROSSWIND', x: 15.25, y: 9, z: 2.02, h: 0.8, color: '#2a2e33', worn: 0.5 });
prop('exterior_aircon_unit', 12.32, 5, 90, { y: 2.4 }); prop('utility_box_02', -15.4, 8, 0); prop('concrete_road_barrier_02', -8, 9.2, 0); prop('concrete_road_barrier_02', -6.4, 9.2, 0); prop('concrete_road_barrier_02', 6, -11.4, 0); prop('concrete_road_barrier_02', 7.6, -11.4, 0);

// ---------------------------------------------------------------- west end: motor pool and gatehouse
const shed = (x0, x1, open, tint) => {                                                                               // three bays, open towards the field
  const back = open > 0 ? x0 : x1, front = open > 0 ? x1 : x0;
  wall('z', back + open * 0.15, -62, -22, 0, 5, 0.3, 'corrugated', [], { tint }); wall('x', -62, x0, x1, 0, 5, 0.3, 'corrugated', [], { tint }); wall('x', -22, x0, x1, 0, 5, 0.3, 'corrugated', [], { tint });
  for (const z of [-48.7, -35.3]) wall('x', z, Math.min(back, back + open * 8.5), Math.max(back, back + open * 8.5), 0, 5, 0.2, 'corrugated', [], { tint });
  for (const z of [-62, -48.7, -35.3, -22]) box(front - 0.2, z - 0.2, front + 0.2, z + 0.2, 0, 5, 'steel');
  box(x0 - 0.5, -62.5, x1 + 0.5, -21.5, 5, 5.2, 'corrugated', { tint: '#6a6f6c' });
};
shed(-118.5, -108, 1, '#8a8f84');
vehicle('truck', -113, -55.4, 0, '#5d6a4f'); vehicle('pickup', -113.5, -42, 2, '#5d6a4f'); pallets(-115.5, -30.5, 0, 7); pallets(-115.4, -28.9, 6, 5); prop('tool_cart', -112, -26.4, 60); prop('Barrel_01', -116.8, -33.6, 0); prop('Barrel_01', -116.6, -24, 0); prop('old_tyre', -110.4, -31.4, 0, { lay: true });
house(-118, -12, -109, -3, 3.2, 'plaster', '#c2c6ba', -114.5);
vehicle('bowser', -104, 2.5, 20, '#c9c6bb'); container(-112, -72, 0, '#3d6b45'); container(-108, -84, 90, '#c9c2b2'); container(-108, -96, 90, '#8a2f25'); barriers(-103, -18, 90, 4); barriers(-98, -70, 0, 3);
// ---------------------------------------------------------------- east end: freight shed and gatehouse
shed(108, 118.5, -1, '#8f8a7c');
container(113.5, -55.4, 0, '#2f5d7a'); container(113.5, -55.4, 0, '#b4772a', { y: 2.59 }); container(113.5, -42, 0, '#8a2f25', { open: true }); pallets(115.5, -30.6, 0, 8); pallets(115.4, -28.8, -5, 6); pallets(111.5, -26, 80, 4); prop('hand_truck', 110.6, -31, 40); prop('Barrel_02', 116.8, -24.2, 0);
house(109, -12, 118, -3, 3.2, 'plaster', '#c2c6ba', 112);
vehicle('truck', 104, 2, 160, '#6a5d4f'); container(112, -72, 0, '#c8b23a'); container(108, -84, 90, '#31485c'); container(108, -96, 90, '#7a3b2a'); barriers(103, -18, 90, 4); barriers(94, -70, 0, 3);

// ---------------------------------------------------------------- taxiway, verges and the runway
vehicle('tender', 22, 49, 150, '#a8281c'); cargoPlane(42, 58.5, 200, { wreck: true, reg: 'TAC 219' });
container(-46, 49, 90, '#8a2f25'); container(-46, 64.5, 90, '#2f5d7a'); container(-43.3, 64.5, 90, '#c9c2b2'); barriers(-47, 55.2, 90, 3);
container(88, 51, 84, '#3d6b45'); container(90, 65.5, 96, '#b4772a'); barriers(88.5, 57, 90, 3);
vehicle('cart', -8, 66, 12, '#59666b'); vehicle('cart', -11.8, 66.8, 12, '#59666b'); vehicle('tug', -4.4, 65.2, 14, '#c8b23a'); vehicle('pickup', -82, 60, 28, '#31485c'); vehicle('truck', 70, 46, 186, '#5d6a4f');
container(-15, 46.5, 6, '#31485c'); container(8, 68, -4, '#7a3b2a'); container(-100, 52, 80, '#c8b23a'); container(104, 60, 100, '#2f5d7a'); container(-104, 68, 96, '#3d6b45'); container(102, 46, 86, '#8a2f25');
vehicle('truck', -30, 19, 3, '#4f5d6a'); vehicle('pickup', 34, 21.5, 176, '#6a5d4f'); container(-70, 14.5, 0, '#b4772a'); container(74, 24, 0, '#31485c'); container(2, 24.4, 3, '#3d6b45'); barriers(-52, 26, 0, 4); barriers(52, 12.6, 0, 4);
barriers(-70, 35, 90, 4, 'concrete_road_barrier'); barriers(70, 35, 90, 4, 'concrete_road_barrier');
nest(-30, 31, 180); nest(12, 39, 0); nest(46, 31, 180); nest(-92, 37, 0); nest(96, 33, 180); nest(-20, 76, 0); nest(58, 78, 0); nest(-76, 77, 0);
for (const [x, z] of [[-50, 34], [-8, 33], [28, 36], [86, 38], [-110, 32], [-40, 79], [20, 80], [88, 79], [-100, 79]]) { box(x - 2, z - 0.25, x + 2, z + 0.25, 0, 0.95, 'wall'); box(x - 2.2, z - 0.5, x - 1.8, z + 0.5, 0, 1.15, 'wall'); box(x + 1.8, z - 0.5, x + 2.2, z + 0.5, 0, 1.15, 'wall'); }   // culvert headwalls
dress('windsock', { x: -22, z: 36, dir: 250 });
dress('taxiSign', { at: [[-60, 30.5, 0, 'A', 'loc'], [-60, 39.5, 0, '09-27'], [60, 30.5, 0, 'B', 'loc'], [60, 39.5, 0, '09-27'], [-80, 30.5, 0, 'A →'], [80, 30.5, 0, '← B'], [0, 29.5, 0, 'APRON ↑']] });
for (const [x, z] of [[-60, 30.5], [-60, 39.5], [60, 30.5], [60, 39.5], [-80, 30.5], [80, 30.5], [0, 29.5]]) box(x - 0.9, z - 0.1, x + 0.9, z + 0.1, 0, 1, 'steel', { visible: false });

// ---------------------------------------------------------------- south: fuel farm, substation, radar station
const FF = { x0: -100, x1: -66, z0: 88, z1: 104 };
wall('x', FF.z0, FF.x0, FF.x1, 0, 1.1, 0.3, 'wall', [{ a: -86, b: -82, y0: 0, y1: 1.1 }]); wall('x', FF.z1, FF.x0, FF.x1, 0, 1.1, 0.3, 'wall');
wall('z', FF.x0, FF.z0, FF.z1, 0, 1.1, 0.3, 'wall'); wall('z', FF.x1, FF.z0, FF.z1, 0, 1.1, 0.3, 'wall', [{ a: 94, b: 98, y0: 0, y1: 1.1 }]);
dress('fuelTanks', { x: -84, z: 97, n: 3, len: 12, r: 1.6, gap: 4.4 });
for (let i = 0; i < 3; i++) { const z = 97 + (i - 1) * 4.4; box(-89.4, z - 1.45, -78.6, z + 1.45, 0.95, 4.1, 'steel', HID); for (const x of [-87.6, -80.4]) box(x - 0.25, z - 1.36, x + 0.25, z + 1.36, 0, 1.1, 'wall', { visible: false }); }
house(-74, 98, -68, 103, 2.8, 'plaster', '#c2c6ba', -72.4);
vehicle('bowser', -58, 93, 96, '#c9c6bb'); barriers(-64, 86, 0, 3); prop('utility_box_02', -77, 89.6, 0); prop('Barrel_02', -67.4, 89.4, 0); prop('Barrel_02', -68.3, 90, 0); container(-94, 108.5, 0, '#31485c');
dress('sign', { text: 'FUEL  NO SMOKING', x: -84, y: 0.62, z: FF.z0 - 0.17, yaw: 180, h: 0.3, color: '#16140f', bg: '#d6a21a', worn: 0.3 });
house(-6, 90, 6, 98, 3.4, 'brick', '#ffffff', -1);                                                                    // substation
for (const x of [-10.5, 10.5]) { box(x - 1.1, 93, x + 1.1, 96, 0, 2.3, 'steel', { tint: '#6f7a7d' }); box(x - 1.5, 92.6, x + 1.5, 96.4, 0, 0.3, 'wall'); box(x - 0.3, 93.6, x + 0.3, 95.4, 2.3, 3.2, 'steel', { tint: '#8a8f93', collide: false }); }
wall('x', 102.5, -13, 13, 0, 1.4, 0.25, 'wall'); barriers(-13, 87, 0, 3, 'concrete_road_barrier'); barriers(9, 87, 0, 3, 'concrete_road_barrier'); light(0, 2.9, 94, 0xffd9a8, 12, 8);
const RS = { x0: 72, x1: 92, z0: 90, z1: 102, h: 4.4 };
wall('x', RS.z0, RS.x0, RS.x1, 0, RS.h, 0.3, 'plaster', [{ a: 76, b: 77.6, y0: 0, y1: 2.3 }, { a: 81, b: 84, y0: 1.0, y1: 2.4 }, { a: 86.5, b: 89.5, y0: 1.0, y1: 2.4 }], { tint: '#c2c6ba' });
wall('x', RS.z1, RS.x0, RS.x1, 0, RS.h, 0.3, 'plaster', [{ a: 78, b: 81, y0: 1.0, y1: 2.4 }], { tint: '#c2c6ba' });
wall('z', RS.x0, RS.z0, RS.z1, 0, RS.h, 0.3, 'plaster', [{ a: 95, b: 97.4, y0: 1.0, y1: 2.4 }], { tint: '#c2c6ba' }); wall('z', RS.x1, RS.z0, RS.z1, 0, RS.h, 0.3, 'plaster', [{ a: 96.6, b: 98.2, y0: 0, y1: 2.3 }], { tint: '#c2c6ba' });
wall('z', 82, RS.z0 + 0.15, RS.z1 - 0.15, 0, RS.h, 0.16, 'plaster_in', [{ a: 95, b: 96.5, y0: 0, y1: 2.2 }]);
box(RS.x0 + 0.15, RS.z0 + 0.15, RS.x1 - 0.15, RS.z1 - 0.15, 0, 0.03, 'floor_in', { collide: false }); box(RS.x0 - 0.4, RS.z0 - 0.4, RS.x1 + 0.4, RS.z1 + 0.4, RS.h, RS.h + 0.3, 'wall');
dress('radome', { x: 86, z: 96, y: RS.h + 0.3, r: 4.2, base: 1.2 }); box(82.6, 92.6, 89.4, 99.4, RS.h + 0.3, RS.h + 9, 'plaster', { visible: false });
dress('latticeMast', { x: 98, z: 88, h: 27 }); box(97.2, 87.2, 98.8, 88.8, 0, 6, 'steel', { visible: false });
box(74, 91.4, 78.5, 92.4, 0, 0.78, 'wood'); prop('vintage_radio_transceiver', 76.4, 91.9, 180, { y: 0.78 }); prop('steel_frame_shelves_01', 91.2, 93, -90); light(77, 3.4, 96, 0xffe2c0, 16, 10); light(87, 3.4, 96, 0xffe2c0, 14, 9);
prop('portable_generator', 68.4, 99, 90, { scale: 1.5 }); prop('utility_box_02', 71.6, 100.6, 90); vehicle('pickup', 66, 88, 100, '#5d6a4f'); container(100, 100, 90, '#3d6b45'); barriers(62, 96, 90, 3); prop('Barrel_01', 93.4, 91, 0); prop('Barrel_01', 94.2, 91.6, 0);
dress('sandbags', { at: bags });

// ---------------------------------------------------------------- paint on the ground
const W = '#e8e4d8', Y = '#d8b13a';
decal('line', 0, 43.6, 240, 0.9, 0, { color: W }); decal('line', 0, 70.4, 240, 0.9, 0, { color: W });                 // runway edges
for (let x = -105; x <= 105; x += 50) decal('line', x, 57, 30, 0.9, 0, { color: W });                                 // centre line
for (const x of [-64, 64]) for (const z of [50.5, 63.5]) decal('line', x, z, 34, 4.2, 0, { color: W });               // aiming points
for (const x of [-96, 96]) for (const a of [38, -38]) decal('line', x, 57, 24, 2, a, { color: W });                   // closed-runway crosses
decal('line', 0, 19, 240, 0.28, 0, { color: Y }); for (const x of [-70, 70]) { decal('line', x, 30.5, 0.28, 23, 0, { color: Y }); for (const dz of [0, 0.9]) decal('line', x, 40.2 + dz, 16, 0.28, 0, { color: Y }); }
for (const x of [-64, -9, 40]) { decal('line', x, -47, 0.28, 34, 0, { color: Y }); decal('line', x, -30, 7, 0.28, 0, { color: Y }); }   // stand lead-in lines
decal('line', 0, -12.5, 200, 0.22, 0, { color: W }); decal('line', 0, -67, 200, 0.22, 0, { color: Y });
decal('hatch', -28, -30, 16, 4, 12, { color: Y }); decal('hatch', 50, -48.6, 9, 7, 0, { color: Y }); decal('hatch', 0, -63, 30, 3, 0, { color: Y }); decal('hatch', -64, -65.4, 26, 2.4, 0, { color: '#b8291e' }); decal('hatch', 64, -65.4, 26, 2.4, 0, { color: '#b8291e' });
dress('sign', { text: '27', x: -112, z: 57, yaw: 90, h: 9, color: W, flat: true, worn: 0.6 }); dress('sign', { text: '09', x: 112, z: 57, yaw: -90, h: 9, color: W, flat: true, worn: 0.6 });
for (const [t, x, z] of [['1', -64, -62], ['2', -9, -62], ['3', 40, -62]]) dress('sign', { text: t, x, z, h: 2.2, color: Y, flat: true, worn: 0.5 });
for (const [x, z, w, d, a] of [[-9, -40, 12, 8, 10], [42, 58, 16, 10, 30], [30, 54, 9, 7, 80], [-64, -52, 6, 5, 0], [5, -52, 7, 5, 40], [-31, -77, 5, 4, 0], [22, 49, 8, 5, 20], [-84, 97, 9, 6, 0], [-113, -50, 7, 6, 0], [60, -86, 8, 6, 10], [-64, -88, 7, 6, 60], [0, -84, 9, 7, 20], [54, 62, 10, 6, 150]]) decal('stain', x, z, w, d, a);

// ---------------------------------------------------------------- beyond the wire (out of reach)
dress('treeline', { a: [420, -168], b: [-420, -168], depth: 60, n: 280, seed: 3 }); dress('treeline', { a: [420, -236], b: [-420, -236], depth: 50, n: 130, hMin: 12, hMax: 20, seed: 8 });      // a -> b runs east to west, so the belt grows north
dress('ridge', { from: -80, to: 80, r: 1000, n: 12, h: 60, w: 340, seed: 2, color: '#3f4f4c' }); dress('ridge', { from: 60, to: 110, r: 1200, n: 5, h: 40, w: 320, seed: 7, color: '#465654' }); dress('ridge', { from: -110, to: -60, r: 1200, n: 5, h: 40, w: 320, seed: 9, color: '#465654' });
dress('mounds', { a: [-420, 138], b: [420, 140], n: 40, w: 20, h: 3.6, seed: 5, color: '#b5ae8c', spread: 10 });
dress('approach', { x0: 150, x1: 420, z: 57 }); dress('approach', { x0: -150, x1: -420, z: 57 });
for (const [x, z, w, d, h, m, t] of [[-190, -40, 44, 30, 9, 'cladding', '#8f9a8a'], [-200, 100, 20, 14, 5, 'plaster', '#c2c6ba'], [186, -60, 40, 34, 10, 'cladding', '#9aa7ab'], [204, 96, 18, 14, 4.5, 'brick', '#ffffff'], [-260, -70, 30, 24, 7, 'corrugated', '#8a8f84']]) box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0, h, m, { collide: false, tint: t });
dress('aircraft', { x: 196, z: -18, yaw: 100, kind: 'cargo', reg: 'TAC 204' }); dress('aircraft', { x: -176, z: -8, yaw: -70, kind: 'light', reg: 'TAC 109' });
dress('latticeMast', { x: -230, z: 96, h: 34 }); dress('lightMast', { x: 150, z: -66, h: 20, lit: false }); dress('lightMast', { x: -150, z: -66, h: 20, lit: false });

// ---------------------------------------------------------------- pickups
pickup('ammo', -64, -100); pickup('ammo', 0, -78); pickup('ammo', 14, -98.5, 3.2); pickup('ammo', 67, -90); pickup('ammo', -32.5, -96.5); pickup('ammo', 32, -96.5);
pickup('ammo', -11, 0); pickup('ammo', 7.5, 3); pickup('ammo', -4, 0, 4.3); pickup('ammo', -14, -34); pickup('ammo', 55, -42); pickup('ammo', -78, -40);
pickup('ammo', 36, 54); pickup('ammo', -46, 57); pickup('ammo', 88, 61); pickup('ammo', -72, 100.5); pickup('ammo', 0, 94); pickup('ammo', 77, 96); pickup('ammo', -110.5, -47); pickup('ammo', 113, -48);

export default {
  id: 'crosswind',
  name: 'Crosswind',
  blurb: 'Coastal airfield · cold clear morning · mid to long range',
  pitch: 'Crosswind field is shut and both ends are dug in. Take the hangars, the apron or the long open run across the tarmac.',
  players: { min: 24, max: 64 },
  env: {
    hdri: 'syferfontein_18d_clear_puresky',
    sunAzimuth: 162, sunElevation: 19,
    sunColor: '#ffe2bd', sunIntensity: 6.0,
    exposure: 0.9, skyIntensity: 0.95, ambient: 1.15,
    fog: { color: '#a9b9c9', sunColor: '#e6d6bc', density: 0.0015, falloff: 0.035 },      // thin cold air with a little ground mist
    shafts: { density: 0.0018, strength: 0.22, distance: 150, anisotropy: 0.42, glow: 2 },   // kept low: the sun sits in the players' faces on the southern half
    weather: { rain: 0, wet: 0 },
    water: { y: -1.6, color: '#16303c' },
    bloom: { strength: 0.12, radius: 0.8, threshold: 1.3 },
    grade: { saturation: 0.98, contrast: 0.22, vignette: 0.3, shadows: [-0.004, 0.006, 0.02], highlights: [0.024, 0.012, -0.012] },
    glare: 0.5, sunCap: 18,
  },
  bounds: { minX: -120, maxX: 120, minZ: -120, maxZ: 112, groundY: 0, maxY: 27 },
  ...L,
  shots: [
    { from: [-38, 1.7, -22], to: [-30, 1.9, -26], look: [-9, 3.4, -41], fov: 52, dur: 17 },
    { from: [-96, 1.4, 56], to: [-84, 1.5, 57], look: [42, 2.6, 58.5], fov: 44, dur: 16 },
    { from: [-2, 12, -62], to: [6, 11, -52], look: [10, 9, -4], lookTo: [16, 14, -1], fov: 55, dur: 17 },
    { from: [-64, 2.2, -72], to: [-64, 2.0, -80], look: [-64, 2.4, -96], fov: 60, dur: 15 },
  ],
  spawns: {
    dm: [
      spawn(-112, -112, 120), spawn(-96, -100, 150), spawn(-112, -66, 90), spawn(-106, -16, 90), spawn(-112, 4, 90), spawn(-108, 34, 90), spawn(-112, 78, 60), spawn(-108, 104, 45),
      spawn(-80, -112, 90), spawn(-70, -74, 180), spawn(-74, -30, 100), spawn(-84, 20, 90), spawn(-84, 76, 0), spawn(-62, 96, 0),
      spawn(-48, -108, 90), spawn(-32, -86, 180), spawn(-40, -50, 90), spawn(-46, -6, 90), spawn(-40, 22, 90), spawn(-36, 60, 90), spawn(-38, 96, 0),
      spawn(-10, -112, 180), spawn(8, -80, 180), spawn(-20, -24, 0), spawn(-11, 1.2, 180), spawn(7, -3, 0), spawn(0, 34, 0), spawn(-4, 78, 0), spawn(0, 100.5, 0),
      spawn(32, -86, 180), spawn(26, -46, 270), spawn(30, -4, 270), spawn(28, 16, 270), spawn(30, 68, 300), spawn(36, 98, 0),
      spawn(48, -108, 270), spawn(64, -74, 180), spawn(62, -22, 250), spawn(66, 20, 270), spawn(70, 78, 0), spawn(78, 87, 0),
      spawn(96, -100, 210), spawn(112, -112, 240), spawn(112, -66, 270), spawn(106, -16, 270), spawn(112, 4, 270), spawn(108, 34, 270), spawn(112, 78, 300), spawn(108, 104, 315),
    ],
    team1: [spawn(-114, -110, 110), spawn(-110, -102, 100), spawn(-114, -92, 90), spawn(-104, -104, 120), spawn(-112, -78, 90), spawn(-114, -66, 90), spawn(-104, -66, 100),
      spawn(-112, -18, 90), spawn(-106, -8, 90), spawn(-113.5, -7, 90), spawn(-112, 3, 90), spawn(-114, 9, 90), spawn(-112, 30, 90), spawn(-114, 38, 90),
      spawn(-112, 76, 80), spawn(-114, 84, 80), spawn(-110, 92, 70), spawn(-112, 100, 60), spawn(-108, 108, 50), spawn(-102, 80, 80)],
    team2: [spawn(114, -110, 250), spawn(110, -102, 260), spawn(114, -92, 270), spawn(104, -104, 240), spawn(112, -78, 270), spawn(114, -66, 270), spawn(104, -66, 260),
      spawn(112, -18, 270), spawn(106, -8, 270), spawn(113.5, -7, 270), spawn(112, 6, 270), spawn(114, 9, 270), spawn(112, 30, 270), spawn(114, 38, 270),
      spawn(112, 76, 280), spawn(114, 84, 280), spawn(110, 92, 290), spawn(112, 100, 300), spawn(108, 108, 310), spawn(104, 80, 280)],
  },
};
