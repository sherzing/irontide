// ROPEWALK — the chandlers' quarter behind a fishing harbour, on a clear afternoon. Streets, not yards: three ways
// across between the quay (west) and the goods yard (east), tied together by lanes, with the market square in the middle.
// Layout (top view, +z is south), 116 m x 82 m:
//   north   THE ROPEWALK: one shed, 84 m end to end, with doors to Tar Lane, Rope Lane and Kiln Lane
//   middle  Market Street ── gate ── MARKET SQUARE and its hall ── gate ── Customs Street
//   south   Net Alley ── cooperage yard ── tunnel ── NET LOFT COURT ── passage ── ice house ── Net Alley
//   west edge: the quay and the harbour.   east edge: the goods yard.
// Every lane pinches somewhere (a gate, a tunnel, a door), and no line runs clear from one base to the other.
import { createKit } from './kit.js';

const { L, box, rbox, wall, stairs, container, prop, light, decal, pickup, spawn, dress } = createKit();
/** A stack of n pallets with its collider, in the lighter timber this dry level uses. */
const pallets = (x, z, yawDeg = 0, n = 4) => { dress('pallets', { at: [[x, z, yawDeg, n]], mat: 'timber' }); rbox(x, z, 1.2, 0.8, 0, n * 0.146, yawDeg, 'wood', { visible: false }); };
const B = { minX: -58.5, maxX: 58, minZ: -41, maxZ: 41 };

// ---------------------------------------------------------------- ground: tiles that meet edge to edge
box(-58, -41, -44, 41, -3, 0, 'pavement');                               // the quay
box(-44, -41, 44, 41, -3, 0, 'cobbles');                                 // the quarter
box(44, -41, 58, 41, -3, 0, 'gravel');                                   // the goods yard
box(-58.5, -41, -58, 41, -3, 0.24, 'wall', { tint: '#b9b4a8' });         // quay kerb
// beyond the edges (out of reach)
box(-58.5, -120, -44, -41, -3, 0, 'pavement', { collide: false }); box(-58.5, 41, -44, 120, -3, 0, 'pavement', { collide: false });
box(-58.5, -120, -58, -41, -3, 0.24, 'wall', { collide: false, tint: '#b9b4a8' }); box(-58.5, 41, -58, 120, -3, 0.24, 'wall', { collide: false, tint: '#b9b4a8' });
box(-44, -100, 140, -41, -3, 0, 'cobbles', { collide: false }); box(-44, 41, 140, 100, -3, 0, 'cobbles', { collide: false });
box(58, -41, 140, 41, -3, 0, 'gravel', { collide: false });
box(-44, -420, 140, -100, -3, 0, 'grass', { collide: false }); box(-44, 100, 140, 420, -3, 0, 'grass', { collide: false }); box(140, -420, 460, 420, -3, 0, 'grass', { collide: false });

// ---------------------------------------------------------------- houses
// A house is a mass of wall with a roof. What its street faces show (windows, shutters, doors) is worked out below
// from which faces are open to a street, so a house is written once: footprint, height, colour.
const BOARDS = '#e2d6c6';      // boarded sheds, weathered grey: tar-black boards in shade would hide a soldier
const WASH = { white: '#e4dfd0', cream: '#d8c8a2', ochre: '#c59c62', blue: '#a7b6bb', red: '#a9604e', sage: '#9dab95', buff: '#d2b29e' };
const PAINT = ['#2f4a3c', '#2a3f55', '#6a2a22', '#4c5458', '#2f6a6a', '#7a5a2a'];      // shutters and doors
const houses = [], covers = [];
/**
 * look: a WASH name (lime-washed house), 'brick' (warehouse) or 'boards' (boarded shed). ridge: 'x' or 'z', the way the roof runs.
 * o.enter = { floor, th, open: { n|s|w|e: [[from, to, top = 2.3, sill = 0], ...] } } makes the ground floor a room:
 * walls with those openings (world x or z along that side) under the floors above.
 */
const house = (x0, z0, x1, z1, h, look, ridge, o = {}) => {
  const mat = look === 'brick' ? 'brick' : look === 'boards' ? 'timber' : 'limewash', tint = look === 'brick' ? o.tint : look === 'boards' ? BOARDS : WASH[look];
  const n = houses.length, hs = { x0, z0, x1, z1, h, mat, tint, ridge, style: look === 'brick' ? 'warehouse' : look === 'boards' ? 'shed' : 'house', paint: PAINT[(n * 5 + 2) % PAINT.length], seed: n + 1, ...o };
  houses.push(hs);
  const e = o.enter;
  if (!e) { box(x0, z0, x1, z1, 0, h, mat, { tint }); return hs; }
  const th = e.th ?? 0.35, f = e.floor ?? 3.3, op = (s) => (e.open?.[s] || []).map(([a, b, y1 = 2.3, y0 = 0]) => ({ a, b, y0, y1 }));
  wall('x', z0 + th / 2, x0, x1, 0, f, th, mat, op('n'), { tint }); wall('x', z1 - th / 2, x0, x1, 0, f, th, mat, op('s'), { tint });
  wall('z', x0 + th / 2, z0 + th, z1 - th, 0, f, th, mat, op('w'), { tint }); wall('z', x1 - th / 2, z0 + th, z1 - th, 0, f, th, mat, op('e'), { tint });
  box(x0, z0, x1, z1, f, h, mat, { tint });                                                   // the floors above
  box(x0 + th, z0 + th, x1 - th, z1 - th, f - 0.07, f, 'timber', { collide: false, tint: '#f2e2c8' });   // boarded ceiling
  box(x0 + th, z0 + th, x1 - th, z1 - th, 0, 0.03, e.ground || 'timber', { collide: false, tint: '#e6d6bc' });
  return hs;
};

// north of Market Street, west to east: block A (with the chandlery), Tar Lane, block B, Rope Lane, block C, Kiln Lane, block D (with the weigh house)
house(-44, -33, -31, -24, 8.5, 'brick', 'x');
const CHANDLERY = house(-44, -24, -31, -10, 7.4, 'white', 'z', { enter: { open: { w: [[-18.2, -16.2, 2.3], [-22.6, -20.4, 2.2, 1.0]], e: [[-14.2, -12.2, 2.3], [-21, -18.8, 2.2, 1.0]] } }, name: 'TALLOW & PIKE', sub: 'SHIP CHANDLERS' });
house(-44, -10, -31, -4, 9.4, 'ochre', 'x');
house(-27, -33, -16, -22, 8, 'brick', 'z'); house(-27, -22, -16, -12, 7, 'blue', 'z'); house(-27, -12, -16, -4, 9, 'cream', 'x');
house(-16, -33, -9, -17, 8.6, 'red', 'z'); house(-9, -33, -2.5, -17, 7.4, 'white', 'z');
house(2.5, -33, 9, -17, 9, 'ochre', 'z'); house(9, -33, 16, -17, 7.6, 'brick', 'z');
house(16, -33, 27, -22, 7.4, 'sage', 'z'); house(16, -22, 27, -12, 9, 'brick', 'z'); house(16, -12, 27, -2, 7.6, 'buff', 'x');
house(31, -33, 44, -24, 8, 'blue', 'x');
const WEIGH = house(31, -24, 44, -10, 7, 'brick', 'z', { enter: { open: { e: [[-18.2, -16.2, 2.3], [-22.6, -20.4, 2.2, 1.0]], w: [[-14.2, -12.2, 2.3], [-21, -18.8, 2.2, 1.0]] }, ground: 'floor_in' }, name: 'WEIGH HOUSE' });
house(31, -10, 44, -2, 9.2, 'white', 'x');
// south of Market Street, west half: block E, Cooper's Alley, block F, the houses round the cooperage yard
house(-44, 2, -35, 11, 9, 'blue', 'x'); house(-44, 11, -35, 20, 7.6, 'white', 'x'); house(-44, 20, -32, 28, 8.4, 'brick', 'x');
house(-35, 2, -26, 11, 8, 'ochre', 'z'); house(-35, 11, -26, 20, 7, 'sage', 'z');
house(-44, 32, -32, 44, 8, 'cream', 'x'); house(-32, 38, -16, 44, 6.4, 'boards', 'x');
house(-22.5, 2, -16, 11, 8.6, 'buff', 'z'); house(-22.5, 11, -16, 20, 7.4, 'brick', 'z');
// south of the square: either side of the passage, and the walls of the net loft court
house(-16, 14, -6, 22, 8, 'white', 'x'); house(-6, 14, 5, 22, 9, 'ochre', 'x'); house(9, 14, 16, 22, 8.4, 'red', 'x');
house(-16, 22, -10, 30, 7, 'brick', 'z'); house(-16, 34, -10, 44, 7.6, 'blue', 'z');
house(10, 22, 16, 30, 7.6, 'cream', 'z'); house(10, 34, 16, 44, 7, 'brick', 'z');
const LOFT = house(-10, 40, 10, 44, 7.2, 'boards', 'x', { name: 'NET LOFT' });
// south of Customs Street, east half: block H, Salt Alley, block J, the ice house
house(16, 4, 22.5, 12, 9, 'white', 'z'); house(16, 12, 22.5, 20, 7.6, 'blue', 'z');
house(26, 4, 35, 12, 8, 'brick', 'z'); house(26, 12, 35, 20, 8.6, 'cream', 'z'); house(35, 4, 44, 12, 7.6, 'sage', 'x'); house(35, 12, 44, 20, 9, 'red', 'x');
house(32, 20, 44, 28, 8, 'white', 'x'); house(32, 32, 44, 44, 7.6, 'brick', 'x'); house(16, 38, 32, 44, 7, 'boards', 'x');
const ICE = house(16, 20, 32, 38, 5.6, 'brick', 'x', { enter: { floor: 4.2, th: 0.6, open: { n: [[23.2, 25.3, 2.5]], w: [[30.5, 33.5, 2.6]], e: [[28.6, 31.4, 2.6]] }, ground: 'floor_in' }, name: 'ICE', tint: '#c9b8a6' });
// rooms that bridge a lane: you walk under them
const bridge = (x0, z0, x1, z1, y0, y1, look, sides) => {
  box(x0, z0, x1, z1, y0, y1, look === 'brick' ? 'brick' : 'limewash', { tint: WASH[look] }); covers.push({ x0, z0, x1, z1 });      // the walls under it stay plain
  const seg = { n: [[x1, z0], [x0, z0]], s: [[x0, z1], [x1, z1]], w: [[x0, z0], [x0, z1]], e: [[x1, z1], [x1, z0]] };
  for (const k of sides) dress('facade', { a: seg[k][0], b: seg[k][1], h: y1, lift: y0, style: look === 'brick' ? 'warehouse' : 'house', paint: PAINT[(x0 * 3 + z0) & 3], seed: Math.round(Math.abs(x0 * 7 + z0 * 3)) + 'nswe'.indexOf(k) });
  dress('roof', { x0, z0, x1, z1, y: y1, ridge: sides[0] === 'n' || sides[0] === 's' ? 'x' : 'z', rise: 1.5, mat: look === 'brick' ? 'brick' : 'limewash', tint: WASH[look], seed: 3, pots: false });
};
bridge(-2.5, -20.5, 2.5, -17, 3.4, 7.8, 'cream', 'ns');                         // over Rope Lane, at the square
bridge(5, 14, 9, 22, 3.3, 8.2, 'white', 'ns');                                 // the passage from the square to the court
bridge(-16, 30, -10, 34, 3.1, 7.2, 'brick', 'we');                             // the tunnel from the cooperage yard to the court
bridge(10, 30, 16, 34, 3.1, 7.2, 'cream', 'we');                               // the passage from the court to the ice house
box(5, 14, 9, 22, 3.22, 3.3, 'timber', { collide: false, tint: '#f2e2c8' });
for (const x of [-16, 10]) box(x, 30, x + 6, 34, 3.02, 3.1, 'timber', { collide: false, tint: '#f2e2c8' });

// ---------------------------------------------------------------- the gates of the square: Market Street and Customs Street come in under a wall
wall('z', -16.3, -4, 2, 0, 5.6, 0.6, 'brick', [{ a: -2.6, b: 0.6, y0: 0, y1: 3.3 }]);
wall('z', 16.3, -2, 4, 0, 5.6, 0.6, 'brick', [{ a: -0.6, b: 2.6, y0: 0, y1: 3.3 }]);
for (const x of [-16.3, 16.3]) box(x - 0.42, x < 0 ? -4 : -2, x + 0.42, x < 0 ? 2 : 4, 5.6, 5.8, 'wall', { tint: '#cfc8b8' });

// ---------------------------------------------------------------- the ropewalk (inside: x -41.6..41.6, z -40.6..-33.4)
const RW = { x0: -42, x1: 42, z0: -41, z1: -33, eave: 4.2, th: 0.4 };
const RW_DOORS = [{ a: -30.5, b: -27.5, y0: 0, y1: 2.8 }, { a: -2, b: 2, y0: 0, y1: 3.2 }, { a: 27.5, b: 30.5, y0: 0, y1: 2.8 }];
wall('x', RW.z0 + 0.2, RW.x0, RW.x1, 0, RW.eave, RW.th, 'brick', [-34, -22, -10, 10, 22, 34].map((x) => ({ a: x - 1.1, b: x + 1.1, y0: 1.5, y1: 3.0 })));
wall('x', RW.z1 - 0.2, RW.x0, RW.x1, 0, RW.eave, RW.th, 'brick', RW_DOORS);
for (const x of [RW.x0 + 0.2, RW.x1 - 0.2]) wall('z', x, RW.z0 + 0.4, RW.z1 - 0.4, 0, RW.eave, RW.th, 'brick', [{ a: -39.2, b: -34.8, y0: 0, y1: 3.3 }]);
box(RW.x0 + 0.4, RW.z0 + 0.4, RW.x1 - 0.4, RW.z1 - 0.4, 0, 0.03, 'timber', { collide: false, tint: '#e6d6bc' });
covers.push({ x0: RW.x0, z0: RW.z0, x1: RW.x1, z1: RW.z1 });
// what stands in it
const coils = [], bales = [], casks = [], carts = [];
/** A stack of coiled rope: n coils high. */
const coil = (x, z, n = 5) => { coils.push([x, z, n]); rbox(x, z, 1.15, 1.15, 0, n * 0.25, 22, 'wood', { visible: false }); };
/** Hemp bales, w along x by d along z, h high. */
const bale = (x, z, w, d, h, yawDeg = 0) => { bales.push([x, z, w, d, h, yawDeg]); rbox(x, z, w, d, 0, h, yawDeg, 'wood', { visible: false }); };
/** Casks on their sides, two below and one on top. */
const cask = (x, z, yawDeg = 0, rows = 1) => { casks.push([x, z, yawDeg, rows]); rbox(x, z, 1.75, 1.25 * rows, 0, 1.5, yawDeg, 'wood', { visible: false }); };
/** A two-wheeled hand cart. */
const cart = (x, z, yawDeg = 0) => { carts.push([x, z, yawDeg]); rbox(x, z, 2.3, 1.2, 0, 1.05, yawDeg, 'wood', { visible: false }); };
// the bobbin racks stand out from opposite walls: you pass the west one on the south side and the east one on the north,
// so nothing looks from one great door to the other
const RACK = { [-1]: [-40.6, -35.6], 1: [-38.4, -33.4] };
for (const s of [-1, 1]) {
  box(s * 17 - 0.45, RACK[s][0], s * 17 + 0.45, RACK[s][1], 0, 2.1, 'timber', { tint: '#f2e2c8' });
  box(s * 36.6 - 1.1, -40.5, s * 36.6 + 1.1, -39.0, 0, 1.7, 'steel', { visible: false });      // the laying machine at each end
  bale(s * 23.5, -34.5, 2.6, 1.6, 1.4); bale(s * 23.3, -34.5, 1.3, 1.5, 0.7);
  coil(s * 10.5, -34.3, 5); coil(s * 9.2, -34.5, 3); coil(s * 31.5, -39.8, 4);
  prop('wooden_military_crate', s * 5.2, -39.7, 4); prop('wooden_military_crate', s * 5.3, -39.75, -3, { y: 0.41 }); prop('wooden_crate_02', s * 6.6, -39.6, 80); prop('Barrel_01', s * 4.2, -40, 0);
  prop('Barrel_02', s * 13.8, -40.1, 0); prop('Barrel_02', s * 14.5, -40, 30);
  light(s * 28, 3.5, -37, 0xffcf96, 26, 15, { priority: 2 }); light(s * 9, 3.5, -37, 0xffcf96, 26, 15, { priority: 2 });
}
cart(0.3, -38.9, 6); coil(-1.6, -39.9, 2);
dress('ropeworks', { ...RW, doors: RW_DOORS.map((d) => [d.a, d.b, d.y1]), ends: [-39.2, -34.8, 3.3], windows: [-34, -22, -10, 10, 22, 34], racks: [[-17, ...RACK[-1]], [17, ...RACK[1]]], jennies: [-36.6, 36.6] });

// ---------------------------------------------------------------- the chandlery and the weigh house: a way through block A and block D
for (const s of [-1, 1]) {
  const x = (lx) => s * lx;      // the two rooms mirror each other
  box(Math.min(x(40.6), x(36.2)), -20.8, Math.max(x(40.6), x(36.2)), -19.8, 0, 1.05, 'timber', { tint: '#f2e2c8' });      // counter
  box(Math.min(x(35), x(34)), -14.5, Math.max(x(35), x(34)), -11, 0, 2.1, 'timber', { tint: '#dccab0' });                  // shelves by the lane door
  light(x(37.5), 2.8, -17, 0xffd9a8, 18, 10, { priority: 1 });
}
prop('steel_frame_shelves_01', -37.6, -23.2, 0); prop('Barrel_01', -42.6, -11.2, 0); prop('Barrel_02', -42.7, -12.1, 20); prop('wooden_crate_02', -41.4, -10.9, 80); prop('cardboard_box_01', -39, -20.3, 10, { y: 1.05 });
prop('lifebuoy', -43.55, -13.6, 90, { y: 1.9 }); prop('metal_jerrycan', -33.2, -22.6, 30); prop('metal_tool_chest', -38, -20.3, 0, { y: 1.05 });
prop('utility_box_02', 42.9, -11.4, -90); prop('wooden_military_crate', 40.6, -23, 0); prop('wooden_military_crate', 40.5, -22.95, 6, { y: 0.41 }); prop('hand_truck', 33, -22.8, 160); prop('cement_bag', 42.4, -13.4, 0); prop('cement_bag', 42.45, -13.45, 8, { y: 0.18 });
box(36.4, -16.2, 38.6, -14, 0, 0.3, 'plate');                             // the weighing platform
box(38.9, -15.6, 39.3, -14.6, 0, 2.2, 'steel', { tint: '#4a5a4a' });      // and its scale column

// ---------------------------------------------------------------- market square (x -16..16, z -17..14): the hall on its iron columns, stalls, the pump
const HALL = { x0: -8, x1: 8, z0: -9, z1: 5, eave: 4.3 };
const HALL_COLS = [];
for (const x of [-8, -2.7, 2.7, 8]) for (const z of [-9, 5]) HALL_COLS.push([x, z]);
HALL_COLS.push([-8, -2], [8, -2]);
for (const [x, z] of HALL_COLS) box(x - 0.14, z - 0.14, x + 0.14, z + 0.14, 0, HALL.eave, 'steel', { visible: false });
box(-1.65, -1.65, 1.65, 1.65, 0, 3.1, 'limewash', { tint: '#4f7462' });                                   // the market clerk's kiosk: it closes the line through both gates
dress('marketHall', { ...HALL, cols: HALL_COLS, kiosk: [0, 0, 3.3, 3.1] });
const stalls = [];
/** A market stall: a counter under a striped awning, boarded up the back to above head height. Its front is +z before it is turned. */
const stall = (x, z, yawDeg, color) => {
  const a = (yawDeg * Math.PI) / 180;
  stalls.push([x, z, yawDeg, color]); rbox(x, z, 2.6, 1.0, 0, 0.95, yawDeg, 'wood', { visible: false });
  rbox(x - 0.46 * Math.sin(a), z - 0.46 * Math.cos(a), 2.6, 0.08, 0, 2.2, yawDeg, 'wood', { visible: false });
};
// two stalls back to back with the lane on each side of the kiosk: nobody looks from Rope Lane through to the court
stall(-3.25, -6.2, 0, '#a8442c'); stall(-5.85, -6.2, 0, '#c8b23a'); stall(5.2, -6.2, 0, '#2f5d7a'); stall(-5.4, 2.6, 180, '#3d6b45'); stall(3.25, 2.6, 180, '#c8b23a'); stall(5.85, 2.6, 180, '#a8442c');
stall(-12.6, -11, 80, '#2f5d7a'); stall(12.4, 9.4, -95, '#a8442c'); stall(-11.6, 9.8, 100, '#c8b23a');
cart(11.2, -12.6, 30); cask(-12.8, 4.6, 90);
box(9.6, -4.2, 10.6, -3.2, 0, 1.15, 'wall', { tint: '#b9b4a8' });         // the pump and its trough
box(10.6, -4.3, 12.6, -3.1, 0, 0.62, 'wall', { tint: '#b9b4a8' });
dress('pump', { x: 10.1, z: -3.7 });
prop('wooden_crate_02', -3.6, -7.4, 10); prop('plastic_crate_01', -6.6, -4.9, 0); prop('plastic_crate_01', -6.1, -4.8, 30); prop('plastic_crate_01', 6.9, -5, 12); prop('Barrel_01', 3.2, 3.9, 0);
prop('plastic_crate_01', 4.1, 3.6, 40); prop('wooden_crate_02', -3.2, 3.8, 70); prop('Barrel_02', -14.6, -15.4, 0); prop('Barrel_02', -13.9, -15.7, 0); prop('wooden_military_crate', 14.4, -15.6, 90);
prop('street_lamp_01', -14.6, 12.6, 45); prop('street_lamp_01', 14.6, -15.6, 225); prop('trashbag', 15.2, 12.9, 0); prop('trashbag', 14.6, 13.3, 60);
pallets(-9.5, 12.6, 8, 5); pallets(13.4, 5.6, 80, 4);

// ---------------------------------------------------------------- streets and lanes: what you can get behind
cart(-35.5, -2.6, 4); bale(-25.5, 0.9, 1.6, 1.2, 1.3, 8); prop('Barrel_01', -40.6, 1.3, 0); prop('Barrel_02', -41.4, 1.2, 0); prop('wooden_crate_02', -21.4, -3.4, 10); prop('wooden_crate_02', -21.3, -3.35, 96, { y: 0.47 });
cart(36.5, 2.6, 184); bale(24, -0.9, 1.6, 1.2, 1.3, -8); prop('Barrel_01', 40.6, -1.3, 0); prop('barrel_03', 41.4, -1.2, 0); prop('wooden_military_crate', 20.6, 3.4, 4); prop('wooden_military_crate', 20.7, 3.35, -5, { y: 0.41 });
cask(-30.2, -26.5, 90); prop('Barrel_02', -27.6, -9.2, 0); prop('Barrel_02', -27.7, -8.3, 0); prop('trashbag', -30.5, -5, 0);
cask(30.2, -26.5, 90); prop('Barrel_01', 27.6, -8.6, 0); prop('wooden_crate_02', 27.7, -7.4, 5); prop('trashbag', 30.5, -3, 0);
prop('wooden_crate_02', -2, -26, 90); prop('wooden_crate_02', -1.95, -26.05, 84, { y: 0.47 }); prop('Barrel_01', 2, -23, 0); prop('Barrel_01', 1.9, -22.1, 0); pallets(-1.8, -29.6, 90, 6);
prop('Barrel_02', -22.9, 8.2, 0); prop('wooden_military_crate', -25.5, 13.6, 90); prop('trashbag', -25.6, 4, 0);
prop('Barrel_01', 22.9, 10.2, 0); prop('wooden_crate_02', 25.6, 15, 0); prop('trashbag', 25.6, 6, 0);
prop('wooden_crate_02', -38, 28.6, 0); prop('Barrel_02', -41, 31.4, 0); prop('Barrel_02', -40.2, 31.5, 0); prop('wooden_military_crate', 38, 31.4, 0); prop('Barrel_01', 41, 28.6, 0);
prop('cardboard_box_01', 5.5, 20, 0); prop('wooden_crate_02', 8.4, 16.4, 90);
light(-13, 2.6, 32, 0xffcf96, 20, 9, { priority: 2 }); light(13, 2.6, 32, 0xffcf96, 20, 9, { priority: 2 }); light(7, 2.8, 18, 0xffcf96, 20, 9, { priority: 2 }); light(0, 2.9, -18.7, 0xffcf96, 16, 8, { priority: 1 });

// ---------------------------------------------------------------- cooperage yard (x -32..-16, z 20..38)
pallets(-24.5, 30.3, 90, 15); pallets(-24.4, 31.6, 86, 15); pallets(-24.5, 32.8, 92, 12);      // staves stacked to season: they close the line from Net Alley into the tunnel
cask(-27.6, 27.4, 80, 2); cask(-18.6, 24.6, 0); cask(-29.6, 35.4, 10); cart(-28.6, 24.2, 100);
dress('shelter', { x: -19, z: 35.6, yaw: 0, w: 5, d: 4, h: 2.9, color: '#c9b894', drop: 0.6 });
for (const [x, z] of [[-21.4, 33.7], [-16.6, 33.7]]) box(x - 0.06, z - 0.06, x + 0.06, z + 0.06, 0, 2.9, 'steel', { visible: false });
box(-21, 36.6, -17.4, 37.6, 0, 0.9, 'timber', { tint: '#f2e2c8' });         // the cooper's bench
prop('Barrel_01', -31.2, 21, 0); prop('Barrel_01', -30.4, 20.9, 0); prop('barrel_03', -30.8, 21.8, 0); prop('Barrel_02', -17, 37.2, 0, { y: 0.9 }); prop('metal_tool_chest', -19.6, 37.1, 0, { y: 0.9 });
pallets(-26.8, 36.9, 4, 6); pallets(-16.9, 28.6, 90, 4); prop('hand_truck', -31.3, 26.2, 90);

// ---------------------------------------------------------------- net loft court (x -10..10, z 22..40): a boat on the chocks, nets drying, the loft gallery
const BOAT = [0.4, 31.8, 82];      // across the court, between the tunnel and the passage: go round her by the bow or the stern
rbox(BOAT[0], BOAT[1], 7.4, 2.5, 0, 2.3, BOAT[2], 'wood', { visible: false });
dress('boat', { x: BOAT[0], z: BOAT[1], yaw: BOAT[2], len: 7.6, beam: 2.6, color: '#2f5d7a', chocks: true, name: 'KITTIWAKE' });
const GAL = 2.8;      // the gallery along the loft: a stair at each end, one for each side of the court
box(-9.6, 38.5, 9.6, 40, GAL - 0.14, GAL, 'timber', { tint: '#f2e2c8' });
for (const x of [-9.3, 9.3]) stairs(x, 34.4, 'z+', 1.3, GAL, 9, 'timber', 0.5);
for (const x of [-8.6, -4.3, 0, 4.3, 8.6]) box(x - 0.08, 38.5, x + 0.08, 38.66, 0, GAL - 0.14, 'timber');
box(-8.6, 38.46, 8.6, 38.54, GAL, GAL + 1.0, 'grid', { bullet: false, sight: false, railing: true, visible: false });
for (const x of [-8.65, 8.65]) box(x - 0.04, 34.2, x + 0.04, 38.5, 0.3, GAL + 1.0, 'grid', { bullet: false, sight: false, railing: true, visible: false });
dress('gallery', { x0: -9.6, x1: 9.6, z0: 38.5, z1: 40, y: GAL, stairs: [[-9.3, 34.15, 38.65, 1.3, 1], [9.3, 34.15, 38.65, 1.3, -1]], posts: [-8.6, -4.3, 0, 4.3, 8.6] });
dress('netRack', { a: [8.6, 23.4], b: [8.6, 29], h: 2.9, color: '#3b5a4a' }); dress('netRack', { a: [-3.5, 23.2], b: [3, 23.2], h: 2.9, color: '#6a4a3a' });
for (const [x, z] of [[8.6, 23.4], [8.6, 29], [-3.5, 23.2], [3, 23.2]]) box(x - 0.07, z - 0.07, x + 0.07, z + 0.07, 0, 2.9, 'wood', { visible: false });
coil(6.6, 36.6, 4); coil(-6.2, 24.4, 3); prop('lateral_sea_marker', 6.4, 25.2, 30, { scale: 0.62 });
prop('plastic_crate_01', -4, 36.9, 0); prop('plastic_crate_01', -3.5, 37.2, 30); prop('plastic_crate_01', -4.05, 36.95, 10, { y: 0.26 }); prop('ocean_buoy', 3.2, 37, 0, { scale: 0.7 });
prop('lifebuoy', 2.4, 39.92, 0, { y: GAL + 1.3 });      // nothing stands on the gallery: it is 1.5 m wide

// ---------------------------------------------------------------- ice house (inside: x 16.6..31.4, z 20.6..37.4): brick piers and ice under sawdust
for (const x of [21.3, 26.7]) for (const z of [25.4, 33.2]) box(x - 0.45, z - 0.45, x + 0.45, z + 0.45, 0, 4.2, 'brick', { tint: '#c9b8a6' });
const ice = [];
/** Blocks of ice stacked under sacking. */
const iceStack = (x, z, w, d, h) => { ice.push([x, z, w, d, h]); box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0, h, 'painted', { visible: false }); };
iceStack(24, 30.9, 1.6, 2.8, 1.9); iceStack(18.4, 24, 2.4, 1.6, 1.5); iceStack(29.6, 35.4, 2.4, 1.6, 1.2); iceStack(19, 36, 3, 1.4, 1.0); iceStack(29.4, 23.2, 1.6, 2.6, 1.5);
dress('iceStacks', { at: ice });
prop('hand_truck', 30.6, 26.6, -90); prop('Barrel_01', 17.4, 28.6, 0); prop('wooden_crate_02', 22.6, 36.8, 0); prop('metal_jerrycan', 26.2, 21.3, 40);
light(24, 3.6, 22.8, 0xcfe4ff, 20, 11, { priority: 2 }); light(24, 3.6, 35.4, 0xcfe4ff, 20, 11, { priority: 2 });

// ---------------------------------------------------------------- the quay (west): boats up for paint, fish boxes, the harbour beyond
const QBOAT = [-47, -36.6, 90];      // hauled out across the ropewalk's west door: the walk does not see the quay
rbox(QBOAT[0], QBOAT[1], 8.4, 2.8, 0, 2.4, QBOAT[2], 'wood', { visible: false });
dress('boat', { x: QBOAT[0], z: QBOAT[1], yaw: QBOAT[2], len: 8.6, beam: 2.9, color: '#a8442c', chocks: true, house: true, name: 'MERCY GALE' });
container(-47.8, -1, 90, '#31485c'); pallets(-47.8, -4.6, 0, 12); pallets(-47.8, 2.6, 4, 12);      // set down across the mouth of Market Street: the square does not see the quay
cart(-48.4, 12.4, 80); bale(-53.4, 25, 2.4, 1.4, 1.2, 86); cask(-47.2, -8.4, 0); coil(-55.6, -6.6, 4); coil(-54.4, -7.4, 2);
pallets(-51.6, 3.4, 4, 7); pallets(-51.5, 4.4, -3, 5); pallets(-47, 36.6, 90, 6); bale(-55, 11.6, 2.4, 1.4, 1.2, 4);
prop('plastic_crate_01', -50.4, 3.2, 0); prop('plastic_crate_01', -50.3, 3.7, 20); prop('plastic_crate_01', -50.35, 3.4, 8, { y: 0.26 }); prop('Barrel_01', -56.6, -39.6, 0); prop('Barrel_02', -55.8, -40, 0);
prop('ocean_buoy', -55.4, 33.6, 0); prop('lifebuoy', -44.12, 14.4, 90, { y: 1.5 }); prop('street_lamp_01', -45, -3.6, 0); prop('street_lamp_01', -45, 30.6, 0); prop('old_tyre', -56.6, -16, 0, { lay: true });
prop('wooden_military_crate', -46.4, 22.6, 90); prop('wooden_crate_02', -45.4, 23.4, 10); prop('concrete_road_barrier', -49.6, -16.4, 80);
for (const z of [-36, -24, -12, 0, 12, 24, 36]) rbox(-57.2, z, 0.42, 0.42, 0, 0.62, 0, 'steel', { visible: false });
dress('bollards', { at: [-36, -24, -12, 0, 12, 24, 36, -52, -68, 52, 68].map((z) => [-57.2, z]) });
wall('x', -41.2, -58, -42, 0, 2.8, 0.4, 'brick'); wall('x', 41.2, -58, -44, 0, 2.8, 0.4, 'brick');     // the quay is closed off at both ends
for (const z of [-41.2, 41.2]) { box(-58, z - 0.26, z < 0 ? -42 : -44, z + 0.26, 2.8, 2.92, 'wall', { tint: '#cfc8b8' }); box(-54, z - 0.25, -49, z + 0.25, 0, 2.6, 'limewash', { collide: false, tint: '#4f7462' }); }

// ---------------------------------------------------------------- the goods yard (east): a siding, a loading bank, the customs gate
container(47.4, -37, 90, '#8a2f25'); container(47.4, -37, 90, '#c9c2b2', { y: 2.59 });      // across the ropewalk's east door
container(47.8, 1, 90, '#3d6b45'); pallets(47.8, -2.6, 0, 12); pallets(47.8, 4.6, -4, 12);      // and across the mouth of Customs Street
cask(53.6, -21, 90, 2); coil(55.2, -18.4, 4);
prop('covered_car', 48.6, 33.4, 12); cart(48.2, -9.6, 100); cask(47.4, 9.6, 0); bale(55, -6.4, 2.4, 1.4, 1.2, -4); bale(54.9, -6.4, 1.2, 1.3, 0.6, -4);
pallets(50.6, -33, 8, 7); pallets(50.7, -34.1, -4, 4); pallets(46.6, 23.4, 90, 5);
prop('concrete_road_barrier', 49.6, 2.4, 96); prop('concrete_road_barrier', 49.4, 4.1, 90); prop('Barrel_01', 45.6, -30.4, 0); prop('barrel_03', 46.4, -30.9, 0); prop('wooden_military_crate', 46, 36.4, 0);
prop('street_lamp_01', 45, 5.6, 180); prop('street_lamp_01', 45, -29, 180); prop('old_tyre', 56.6, 26, 0, { lay: true }); prop('old_tyre', 56.5, 26.1, 30, { lay: true, y: 0.16 }); prop('utility_box_01', 57.3, 6, -90);
wall('z', 58.2, -41, 41, 0, 3.2, 0.4, 'brick', []);                        // yard wall
box(57.94, -3, 58.06, 3, 0, 3.0, 'steel', { tint: '#4a5a52' });           // the customs gate, shut
for (const z of [-3.3, 3.3]) box(57.7, z - 0.3, 58.5, z + 0.3, 0, 3.7, 'wall', { tint: '#cfc8b8' });
box(57.95, -41, 58.45, 41, 3.2, 3.32, 'wall', { tint: '#cfc8b8' });
wall('x', -41.2, 42, 58, 0, 3.2, 0.4, 'brick'); wall('x', 41.2, 44, 58, 0, 3.2, 0.4, 'brick');
dress('rails', { x: 55.2, z0: -40.6, z1: 40.6 });

// ---------------------------------------------------------------- what the street faces show, and the roofs
{
  const eps = 0.06, inside = (x, z) => x > B.minX - 1 && x < B.maxX + 1 && z > B.minZ - 0.5 && z < B.maxZ + 0.5;
  const SIDE = {
    n: (r) => ({ lo: r.x0, hi: r.x1, touch: (o) => Math.abs(o.z1 - r.z0) < eps && [o.x0, o.x1], seg: (u0, u1) => [[u1, r.z0], [u0, r.z0]], out: (u) => [u, r.z0 - 1] }),
    s: (r) => ({ lo: r.x0, hi: r.x1, touch: (o) => Math.abs(o.z0 - r.z1) < eps && [o.x0, o.x1], seg: (u0, u1) => [[u0, r.z1], [u1, r.z1]], out: (u) => [u, r.z1 + 1] }),
    w: (r) => ({ lo: r.z0, hi: r.z1, touch: (o) => Math.abs(o.x1 - r.x0) < eps && [o.z0, o.z1], seg: (u0, u1) => [[r.x0, u0], [r.x0, u1]], out: (u) => [r.x0 - 1, u] }),
    e: (r) => ({ lo: r.z0, hi: r.z1, touch: (o) => Math.abs(o.x0 - r.x1) < eps && [o.z0, o.z1], seg: (u0, u1) => [[r.x1, u1], [r.x1, u0]], out: (u) => [r.x1 + 1, u] }),
  };
  for (const r of houses) {
    const span = r.ridge === 'x' ? r.z1 - r.z0 : r.x1 - r.x0;
    dress('roof', { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, y: r.h, ridge: r.ridge, rise: Math.max(1.5, Math.min(3.6, span * 0.3)), mat: r.mat, tint: r.tint, seed: r.seed, flat: r === ICE });
    for (const k of 'nswe') {
      const f = SIDE[k](r);
      let free = [[f.lo, f.hi]];
      for (const o of [...houses, ...covers]) {
        const t = o !== r && f.touch(o);
        if (t) free = free.flatMap(([a, b]) => [[a, Math.min(b, t[0])], [Math.max(a, t[1]), b]]).filter(([a, b]) => b - a > 1.4);
      }
      for (const [u0, u1] of free) {
        const o = f.out((u0 + u1) / 2);
        if (!inside(o[0], o[1])) continue;
        const [a, b] = f.seg(u0, u1), along = (u) => Math.hypot((k === 'n' || k === 's' ? u : a[0]) - a[0], (k === 'w' || k === 'e' ? u : a[1]) - a[1]);
        const open = (r.enter?.open?.[k] || []).filter(([p, q]) => q > u0 && p < u1).map(([p, q, top = 2.3, sill = 0]) => [Math.min(along(p), along(q)), Math.max(along(p), along(q)), top, sill]);
        dress('facade', { a, b, h: r.h, style: r.style, paint: r.paint, tint: r.tint, mat: r.mat, seed: r.seed * 4 + 'nswe'.indexOf(k), open, room: r.enter ? r.enter.floor ?? 3.3 : 0, name: r.name, sub: r.sub });
      }
    }
  }
}
dress('coils', { at: coils }); dress('bales', { at: bales }); dress('casks', { at: casks }); dress('carts', { at: carts }); dress('stalls', { at: stalls });
dress('arch', { x: -16.3, z0: -2.6, z1: 0.6, y: 3.3, th: 0.6 }); dress('arch', { x: 16.3, z0: -0.6, z1: 2.6, y: 3.3, th: 0.6 });

// ---------------------------------------------------------------- names on the walls
const sign = (text, x, y, z, yawDeg, o = {}) => dress('sign', { text, x, y, z, yaw: yawDeg, h: 0.2, color: '#f1ece0', bg: '#1f2d3a', worn: 0.2, ...o });
sign('MARKET STREET', -43.88, 2.9, -5.6, -90); sign('MARKET STREET', -27.5, 2.9, -4.12, 180); sign('CUSTOMS STREET', 43.88, 2.9, -3.4, 90); sign('CUSTOMS STREET', 27.5, 2.9, 4.12, 0);
sign('TAR LANE', -31.12, 2.9, -6, 90); sign('KILN LANE', 31.12, 2.9, -4, -90); sign('ROPE LANE', -2.62, 2.9, -22, 90);
sign("COOPER'S ALLEY", -26.12, 2.9, 4, 90); sign('SALT ALLEY', 26.12, 2.9, 6, -90); sign('NET ALLEY', -43.88, 2.9, 27, -90); sign('NET ALLEY', 43.88, 2.9, 33, 90);
sign('ROPEWALK No 2', -42.12, 3.75, -37, -90, { h: 0.34, bg: null, color: '#e9e4d6', worn: 0.6 }); sign('ROPEWALK No 2', 42.12, 3.75, -37, 90, { h: 0.34, bg: null, color: '#e9e4d6', worn: 0.6 });
sign('FISH MARKET', 0, 4.02, 5.34, 0, { h: 0.3, bg: '#2f4a3c', worn: 0.15 }); sign('FISH MARKET', 0, 4.02, -9.34, 180, { h: 0.3, bg: '#2f4a3c', worn: 0.15 });

// ---------------------------------------------------------------- beyond the edges (out of reach): the harbour, the rest of the town, the line inland
dress('boat', { x: -62.4, z: -14, yaw: 92, len: 11, beam: 3.6, color: '#3d6b45', house: true, mast: true, afloat: -1.3, name: 'SILVER DARLING' });
dress('boat', { x: -62.2, z: 9, yaw: 86, len: 9, beam: 3.1, color: '#2f5d7a', house: true, mast: true, afloat: -1.3, name: 'NORTH STAR' });
dress('boat', { x: -63.4, z: 30, yaw: 95, len: 7, beam: 2.5, color: '#c9c2b2', afloat: -1.3 });
dress('boat', { x: -92, z: -30, yaw: 20, len: 10, beam: 3.3, color: '#a8442c', house: true, mast: true, afloat: -1.3 }); dress('boat', { x: -104, z: 18, yaw: 150, len: 8, beam: 2.8, color: '#c8b23a', house: true, afloat: -1.3 });
dress('quay', { x: -58.5, z0: -38, z1: 38, water: -1.3, ladders: [-30, 18] });
dress('rope', { a: [-57.2, 0.5, -12], b: [-60.9, 0.2, -10.2], sag: 0.25 }); dress('rope', { a: [-57.2, 0.5, 12], b: [-60.8, 0.1, 10.6], sag: 0.25 }); dress('rope', { a: [-57.2, 0.5, 24], b: [-62.2, -0.2, 27.6], sag: 0.3 });
dress('breakwater', { a: [-250, -150], b: [-150, 70], water: -1.3, seed: 5 });
dress('ship', { x: -330, z: 190, yaw: 200, len: 110, beam: 17, deck: 9, name: 'OSTRAL VEGA', port: 'ROTTERDAM', seed: 9, cargo: 0.7, cranes: 0, lod: 2, water: -1.3 });
// the rest of the town: houses nobody reaches, written like the others
const far = (x0, z0, x1, z1, h, look, ridge) => { const mat = look === 'brick' ? 'brick' : look === 'boards' ? 'timber' : 'limewash', tint = look === 'brick' ? undefined : look === 'boards' ? BOARDS : WASH[look]; box(x0, z0, x1, z1, 0, h, mat, { tint, collide: false }); dress('roof', { x0, z0, x1, z1, y: h, ridge, rise: Math.max(1.5, Math.min(3.6, (ridge === 'x' ? z1 - z0 : x1 - x0) * 0.3)), mat, tint, seed: Math.round(Math.abs(x0 * 3 + z0 * 7)) }); };
far(-44, -53, -32, -41.5, 8.6, 'cream', 'x'); far(-44, -66, -32, -53, 7.4, 'brick', 'x'); far(-44, -80, -30, -66, 9.2, 'white', 'x'); far(-44, -96, -31, -80, 7.8, 'blue', 'x');      // along the quay, north
far(-44, 44, -32, 56, 7.6, 'white', 'x'); far(-44, 56, -31, 70, 9, 'red', 'x'); far(-44, 70, -32, 84, 7.4, 'cream', 'x'); far(-44, 84, -30, 98, 8.4, 'brick', 'x');                  // and south
far(-30, -52, -8, -45.5, 5.2, 'boards', 'x'); far(-6, -53, 20, -46, 5.8, 'boards', 'x'); far(22, -52, 40, -45.5, 5, 'boards', 'x');                                                           // boarded stores behind the ropewalk
far(-28, -70, -12, -58, 8.4, 'sage', 'z'); far(-8, -72, 8, -60, 9.6, 'white', 'x'); far(12, -70, 30, -58, 8, 'buff', 'z'); far(34, -74, 52, -60, 9, 'brick', 'x');
far(42, -58, 60, -41.6, 9, 'brick', 'z'); far(44, 41.6, 60, 58, 8.2, 'ochre', 'z');                                                                                                   // closing the ends of the goods yard
far(63, -34, 82, -10, 7, 'brick', 'z'); far(63, 6, 80, 36, 6.2, 'boards', 'z'); far(88, -52, 104, -34, 8.4, 'white', 'x'); far(90, -24, 108, -6, 9.4, 'cream', 'z');                     // goods sheds and the houses behind them
far(88, 4, 104, 22, 8, 'blue', 'x'); far(86, 30, 106, 46, 9, 'sage', 'z'); far(64, 44, 82, 60, 7.6, 'red', 'x'); far(112, -40, 130, -22, 8.6, 'ochre', 'x'); far(114, 0, 132, 18, 8, 'white', 'z');
far(-20, 48, -2, 62, 8.6, 'cream', 'x'); far(2, 48, 20, 60, 8, 'blue', 'z'); far(24, 48, 42, 62, 9, 'white', 'x'); far(-28, 66, -8, 80, 8.2, 'buff', 'z'); far(-4, 66, 16, 80, 9.2, 'brick', 'x'); far(20, 66, 40, 82, 8.4, 'sage', 'z');
box(96, -8, 99, -5, 0, 27, 'brick', { collide: false });                                                                                                                              // the gasworks chimney
dress('skyline', { cx: 60, cz: 0, from: 40, to: 150, r0: 170, r1: 300, n: 16, seed: 3, hMin: 8, hMax: 26, tanks: 0.3 });
dress('mounds', { a: [-40, -330], b: [420, -300], n: 14, w: 70, h: 20, seed: 5, color: '#8f9a7c', spread: 50 });
dress('mounds', { a: [330, -260], b: [360, 300], n: 12, w: 80, h: 26, seed: 11, color: '#869276', spread: 50 });
dress('mounds', { a: [-40, 330], b: [380, 310], n: 12, w: 70, h: 18, seed: 14, color: '#8f9a7c', spread: 50 });

// ---------------------------------------------------------------- marks on the ground
decal('stain', -8, -12, 8, 6, 20); decal('stain', 7, 9, 7, 6, 60); decal('stain', -24, 30, 7, 6, 10); decal('stain', 2, 31, 8, 6, 80); decal('stain', 24, 30, 6, 6, 0); decal('stain', -51, -12, 8, 6, 30);
decal('stain', -50, 20, 7, 6, 70); decal('stain', 51, -10, 8, 6, 15); decal('stain', 50, 24, 7, 6, 40); decal('stain', -29, -18, 4, 7, 0); decal('stain', 29, -18, 4, 7, 0); decal('stain', 0, -37, 9, 5, 0);
decal('stain', -30, -37, 8, 5, 10); decal('stain', 30, -37, 8, 5, 5); decal('stain', -36, -1, 8, 4, 0); decal('stain', 34, 1, 8, 4, 0);

// ---------------------------------------------------------------- pickups
pickup('ammo', 0.6, -36.4); pickup('ammo', -38.6, -12.6); pickup('ammo', 38.6, -12.6); pickup('ammo', 2.6, -3.4); pickup('ammo', -19.4, 35.4);
pickup('ammo', 28.6, 29.6); pickup('ammo', 3, 39.25, GAL); pickup('ammo', -54, -27); pickup('ammo', 54, 34); pickup('ammo', -24.2, 17.4); pickup('ammo', 24.2, 17.4);

export default {
  id: 'ropewalk',
  name: 'Ropewalk',
  blurb: 'Harbour quarter · clear afternoon · street fighting, close to long range',
  pitch: 'The old chandlers\' quarter behind the fish quay. Three ways across: down the ropewalk, through the market, or by the back alleys.',
  players: { min: 8, max: 24 },
  env: {
    hdri: 'kloofendal_48d_partly_cloudy_puresky',
    sunAzimuth: 226, sunElevation: 47,
    sunColor: '#ffe6c4', sunIntensity: 6.4,
    exposure: 0.86, skyIntensity: 0.56, ambient: 1.12,
    fog: { color: '#aebccb', sunColor: '#efe2c6', density: 0.0026, falloff: 0.016 },      // sea haze
    shafts: { density: 0.0042, strength: 0.6, distance: 90, anisotropy: 0.55, glow: 2.4 },
    weather: { rain: 0, wet: 0 },
    water: { y: -1.3, color: '#1d3538' },
    bloom: { strength: 0.13, radius: 0.8, threshold: 1.3 },
    grade: { saturation: 1.02, contrast: 0.26, vignette: 0.3, shadows: [0.004, 0.008, 0.016], highlights: [0.026, 0.014, -0.012] },
    glare: 0.3, sunCap: 18,
  },
  bounds: { ...B, groundY: 0, maxY: 16 },
  ...L,
  shots: [
    { from: [-56, 1.7, 23], to: [-53.5, 1.8, 11], look: [-41, 4.2, -14], fov: 55, dur: 17 },
    { from: [-40.5, 1.6, -36.2], to: [-33, 1.7, -36.7], look: [-10, 2.4, -37.4], fov: 58, dur: 16 },
    { from: [14.8, 2.2, -9.2], to: [13, 2.5, -7.4], look: [-2, 2.6, 1], fov: 55, dur: 17 },
    { from: [0.7, 1.6, -31.5], to: [-0.4, 1.7, -25.5], look: [0, 3, -12], fov: 55, dur: 15 },
    { from: [-8, 1.6, 25], to: [-4.5, 1.7, 26.5], look: [6, 3, 36], fov: 60, dur: 15 },
  ],
  spawns: {
    dm: [
      spawn(-55, -36, 120), spawn(-49, -18, 90), spawn(-54, 0, 90), spawn(-50, 17, 90), spawn(-55, 37, 60),
      spawn(55, -36, 240), spawn(50, -15, 270), spawn(54, 0, 270), spawn(51, 20, 270), spawn(55, 37, 300),
      spawn(-39, -37, 90), spawn(-20, -39.6, 90), spawn(4, -35, 180), spawn(20, -39.6, 270), spawn(39, -37, 270),
      spawn(-29, -20, 180), spawn(29, -20, 180), spawn(0, -28, 180), spawn(-37, -17, 90), spawn(37, -17, 270),
      spawn(-38, -1, 90), spawn(38, 1, 270), spawn(-13.6, -14.6, 135), spawn(13.6, 12, 315), spawn(-13, 10, 45), spawn(13, -8, 225),
      spawn(-24.2, 12, 0), spawn(24.2, 12, 0), spawn(-29, 30, 90), spawn(-20.5, 22.5, 180), spawn(-7, 37, 45), spawn(6, 32, 315),
      spawn(18, 31.5, 90), spawn(29, 26.5, 270), spawn(-38, 30, 90), spawn(38, 30, 270), spawn(7, 17, 180),
    ],
    team1: [spawn(-56, -36, 100), spawn(-55, -30, 90), spawn(-56, -19, 90), spawn(-55, -12, 90), spawn(-56, -2, 90), spawn(-56, 7, 90), spawn(-56, 17, 90), spawn(-55, 30, 85),
      spawn(-56, 37, 70), spawn(-50, -35, 100), spawn(-48, -20, 90), spawn(-51, -3, 90), spawn(-50, 8, 90), spawn(-48.5, 18, 90), spawn(-49, 30, 90), spawn(-50, 38, 75)],
    team2: [spawn(56, -36, 260), spawn(55, -29, 270), spawn(56.5, -12, 270), spawn(56, -1, 270), spawn(56, 7, 270), spawn(56.5, 22, 270), spawn(56, 30, 275), spawn(56, 37, 290),
      spawn(52, -31, 265), spawn(48, -20, 270), spawn(52, -3, 270), spawn(52.5, 9, 270), spawn(47.5, 15, 270), spawn(49, 27, 270), spawn(51.5, 37, 285), spawn(46, -14, 270)],
  },
};
