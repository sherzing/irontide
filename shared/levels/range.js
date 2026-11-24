// FIRING LINE — the harbour authority's range on reclaimed ground behind the port, a clear morning.
// It is the game's introduction: a short course that teaches moving, the sights, bursts, moving targets and the
// rifle, then leaves the range open for practice. `training: true` keeps it out of the level pickers.
// Layout (top view, +z is south), 48 m x 142 m. The shooter stands at z = 0 and fires north:
//   backstop berm (z = -112) ── 100 m line ── 50 m ── 25 m ── 10 m ── FIRING LINE under the shelter ── yard and gate (south)
//   west lane: 10 m targets and a steel plate │ middle lane: 25 m, 50 m, 100 m │ east lane: moving targets and a steel plate
import { createKit } from './kit.js';

const { L, box, wall, container, prop, spawn, dress, pallets } = createKit();

const W = 24, NORTH = -118, SOUTH = 24, TURF = '#a9c08e';
const sign = (text, x, y, z, yawDeg, o = {}) => dress('sign', { text, x, y, z, yaw: yawDeg, ...o });

// ---------------------------------------------------------------- ground: tiles that meet edge to edge
box(-W, 8, W, SOUTH, -3, 0, 'asphalt');                                   // the yard behind the shelter
box(-W, 0, W, 8, -3, 0, 'pavement');                                      // the shelter's slab
box(-16, -112, 16, 0, -3, 0, 'gravel');                                   // the lanes
box(-W, -112, -16, 0, -3, 0, 'grass', { tint: TURF }); box(16, -112, W, 0, -3, 0, 'grass', { tint: TURF });
box(-W, NORTH, W, -112, -3, 0, 'sand');                                   // under the backstop
for (const [x0, z0, x1, z1] of [[-420, -420, -W, 420], [W, -420, 420, 420], [-W, -420, W, NORTH], [-W, SOUTH, W, 420]]) box(x0, z0, x1, z1, -3, 0, 'grass', { tint: TURF, collide: false });

// ---------------------------------------------------------------- what stops a round: the backstop berm and the side walls
for (const [z0, h] of [[-113.5, 2.2], [-115, 4.4], [-116.5, 6.4]]) box(-W, NORTH, W, z0, 0, h, 'sand');
box(-W - 0.4, NORTH, -W, 8, 0, 3.4, 'wall'); box(W, NORTH, W + 0.4, 8, 0, 3.4, 'wall');
for (let z = -110; z <= 0; z += 10) for (const x of [-W - 0.2, W + 0.2]) box(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 0, 3.6, 'wall', { collide: false });   // piers
// the yard: sheet fence, with the gate in the south side
const fence = (x0, z0, x1, z1) => {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 3), alongX = x0 !== x1, tints = ['#7d878a', '#8c8f86', '#727c80'];
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n, h = 2.6 - ((i * 7) % 3) * 0.08, o = { tint: tints[i % 3] };
    if (alongX) box(x0 + (x1 - x0) * a, z0 - 0.05, x0 + (x1 - x0) * b, z0 + 0.05, 0, h, 'corrugated', o);
    else box(x0 - 0.05, z0 + (z1 - z0) * a, x0 + 0.05, z0 + (z1 - z0) * b, 0, h, 'corrugated', o);
  }
};
fence(-W, 8, -W, SOUTH); fence(W, 8, W, SOUTH); fence(-W, SOUTH, -4, SOUTH); fence(4, SOUTH, W, SOUTH);
box(-4, SOUTH - 0.08, 4, SOUTH + 0.08, 0, 2.8, 'steel', { tint: '#56646b' });      // the gate, shut
for (const x of [-4.2, 4.2]) box(x - 0.2, SOUTH - 0.2, x + 0.2, SOUTH + 0.2, 0, 3.1, 'wall');

// ---------------------------------------------------------------- the shelter over the firing line
const ROOF = 3.0;
box(-16, 0.2, 16, 7.8, ROOF, ROOF + 0.14, 'corrugated', { tint: '#8a9499' });
for (const x of [-16, -8, 8, 16]) for (const z of [0.5, 7.5]) box(x - 0.09, z - 0.09, x + 0.09, z + 0.09, 0, ROOF, 'steel', { tint: '#4c565b' });
wall('x', 7.6, -16, 16, 0, ROOF, 0.16, 'corrugated', [{ a: -2, b: 2, y1: 2.3 }, { a: -12, b: -6, y0: 1.1, y1: 2.2 }, { a: 6, b: 12, y0: 1.1, y1: 2.2 }], { tint: '#77838a' });
for (const x of [-8, 8]) box(x - 0.04, 0.5, x + 0.04, 3.2, 0, 1.5, 'wood');         // screens between the bays
for (const x of [-12, -4, 4, 12]) box(x - 0.9, 0.55, x + 0.9, 1.15, 0, 0.95, 'wood');   // shooting benches
sign('FIRING LINE', 0, ROOF - 0.45, 0.28, 180, { h: 0.34, color: '#e9e4d6', worn: 0.35 });
sign('LIVE FIRE\nEAR PROTECTION', 0, 2.62, 7.7, 0, { h: 0.2, color: '#d8452e', worn: 0.4 });
box(-16, 0.18, 16, 0.32, 0, 0.012, 'painted', { tint: '#d9b21c', collide: false });      // the yellow line nobody steps over while others shoot

// ---------------------------------------------------------------- lanes: distance boards and the steel plates
for (const d of [10, 25, 50, 100]) {
  sign(`${d} M`, -17.2, 0.03, -d, 0, { h: 1.1, flat: true, color: '#f2efe6', worn: 0.25 });
  for (const x of [-22.5, 22.5]) { box(x - 0.05, -d - 0.05, x + 0.05, -d + 0.05, 0, 2.1, 'steel', { tint: '#4c565b' }); box(x - 0.8, -d - 0.03, x + 0.8, -d + 0.03, 2.1, 3.0, 'painted', { tint: '#e8e3d3' }); sign(String(d), x, 2.55, -d + 0.05, 0, { h: 0.62, color: '#1f2426', worn: 0.2 }); }
}
// a steel plate shows where the rounds land: every hit leaves its mark
const plate = (x, z, w, h) => {
  box(x - w / 2, z - 0.04, x + w / 2, z + 0.04, 0.35, 0.35 + h, 'steel', { tint: '#c9ced0' });
  for (const sx of [-1, 1]) box(x + sx * (w / 2 - 0.1) - 0.05, z - 0.06, x + sx * (w / 2 - 0.1) + 0.05, z + 0.3, 0, 0.35, 'steel', { tint: '#4c565b' });
  sign('+', x, 0.35 + h / 2, z + 0.05, 0, { h: Math.min(w, h) * 0.5, color: '#c8321e', worn: 0 });
};
plate(-19.5, -15, 2.4, 2.4); plate(19.5, -50, 3.2, 2.8);
// low cover on the moving-target lane, so a runner is lost for a moment
box(9.4, -39.4, 11.6, -39.0, 0, 1.25, 'wall');

// ---------------------------------------------------------------- the yard
container(-19.5, 20, 0, '#2f5d7c'); container(20, 17, 90, '#8a3b2e');
pallets(-9.5, 12.5, 15, 5); pallets(9, 10.2, -8, 3);
prop('old_military_crate', -5.2, 9.3, 12); prop('old_military_crate', -6.4, 9.2, -30); prop('metal_tool_chest', 5.6, 9.2, 185);
prop('concrete_road_barrier', -12, 20.5, 0); prop('concrete_road_barrier', 12, 21, 4);
prop('old_tyre', 20.5, 10.5, 0); prop('old_tyre', 21.2, 11.4, 40); prop('barrel_03', -21.5, 10, 0); prop('barrel_03', -20.6, 10.6, 60);

// ---------------------------------------------------------------- the course
// A target is a soldier who never shoots: `target` names its line, `face` is the bearing it looks along,
// `to` and `speed` make it walk between `at` and `to`. Stages count targets dropped on the line they name.
const stand = (target, x, z, o = {}) => ({ at: [x, z], w: 'carbine', target, face: 180, ...o });
const TARGETS = [                                            // spread so that, from the middle of the line, none stands behind another
  stand('near', -9, -10), stand('near', -6.5, -10), stand('near', -4, -10),
  stand('mid', -2, -25), stand('mid', 1, -25), stand('mid', 4, -25),
  stand('long', -7, -50), stand('long', -1, -50), stand('long', 5, -50),
  stand('moving', 7, -20, { to: [15, -20], speed: 1.7 }), stand('moving', 15, -40, { to: [7, -40], speed: 4.6 }),
  stand('far', -5, -100), stand('far', 1, -100), stand('far', 7, -100, { crouch: true }),
];
const OFFICER = 'RANGE OFFICER';

export default {
  id: 'range',
  name: 'Firing Line',
  blurb: 'Port authority range · clear morning · 10 to 100 m',
  pitch: 'The range behind the port. Walk the course once to learn the weapons, then stay and shoot: every weapon, endless ammunition, targets that get back up.',
  training: true,
  players: { min: 2, max: 8 },
  env: {
    hdri: 'syferfontein_18d_clear_puresky',
    sunAzimuth: 118, sunElevation: 34,
    sunColor: '#fff1dc', sunIntensity: 5.6,
    exposure: 0.86, skyIntensity: 0.9, ambient: 1.05,
    fog: { color: '#b3c2cc', sunColor: '#eadcc4', density: 0.0012, falloff: 0.03 },
    shafts: { density: 0.0014, strength: 0.2, distance: 150, anisotropy: 0.4, glow: 2 },
    weather: { rain: 0, wet: 0 },
    bloom: { strength: 0.12, radius: 0.8, threshold: 1.3 },
    grade: { saturation: 0.98, contrast: 0.22, vignette: 0.28, shadows: [0.0, 0.006, 0.014], highlights: [0.022, 0.012, -0.01] },
    glare: 0.35, sunCap: 18,
  },
  bounds: { minX: -W, maxX: W, minZ: NORTH, maxZ: SOUTH, groundY: 0, maxY: 8 },
  ...L,
  shots: [
    { from: [-10, 1.7, 4.5], to: [8, 1.8, 4.2], look: [0, 1.3, -30], fov: 50, dur: 16 },
    { from: [20, 6, -70], to: [14, 4.5, -44], look: [0, 1.2, -8], fov: 48, dur: 16 },
    { from: [-6, 1.5, -34], to: [4, 1.6, -30], look: [0, 1.4, -25], lookTo: [0.5, 1.4, -50], fov: 46, dur: 14 },
  ],
  spawns: {
    dm: [spawn(-12, 16, 0), spawn(0, 14, 0), spawn(12, 16, 0), spawn(-20, 4, 60), spawn(20, 4, 300), spawn(-12, -30, 90), spawn(12, -30, 270), spawn(-20, -60, 120),
      spawn(20, -60, 240), spawn(0, -75, 180), spawn(-12, -100, 150), spawn(12, -100, 210)],
    team1: [spawn(-14, 16, 0), spawn(-7, 14, 0), spawn(0, 16, 0), spawn(7, 14, 0), spawn(14, 16, 0), spawn(-20, 5, 30), spawn(20, 5, 330), spawn(0, 11, 0)],
    team2: [spawn(-14, -104, 180), spawn(-7, -106, 180), spawn(0, -104, 180), spawn(7, -106, 180), spawn(14, -104, 180), spawn(-20, -98, 160), spawn(20, -98, 200), spawn(0, -108, 180)],
  },
  campaign: {
    title: 'FIRING LINE',
    brief: 'Target practice. A six-step course on the port authority range teaches the weapons; after it the range stays open, with every weapon and endless ammunition.',
    start: spawn(0, 14, 0),
    stages: [
      { type: 'reach', text: 'Walk to the firing line', at: [0, 0, 1.6], r: 2.6, enemies: TARGETS,
        say: [OFFICER, 'Welcome to the range. W, A, S, D to move, mouse to look. Come up to the yellow line.'] },
      { type: 'score', text: 'Drop the targets at 10 m', line: 'near', kills: 3,
        say: [OFFICER, 'Left mouse fires. At ten metres you can shoot from the hip: the crosshair shows how wide the shots fall.'] },
      { type: 'score', text: 'Sights up: targets at 25 m', line: 'mid', kills: 3,
        say: [OFFICER, 'Right mouse raises the sights. Standing still, the first round goes exactly where they point. R reloads.'] },
      { type: 'score', text: 'Short bursts at 50 m', line: 'long', kills: 3,
        say: [OFFICER, 'The carbine climbs while you hold the trigger. Fire three or four rounds and let it settle, or pull down a little as you fire.'] },
      { type: 'score', text: 'Drop two moving targets', line: 'moving', kills: 2,
        say: [OFFICER, 'Right-hand lane, twenty and forty metres. Keep the sights moving with the target as you fire. Key 2 is the submachine gun, 3 the shotgun.'] },
      { type: 'score', text: 'Rifle: two targets at 100 m', line: 'far', kills: 2,
        say: [OFFICER, 'Key 4, the Kestrel. Crouch with C to steady it and aim for the head: one round is enough.'] },
      { type: 'free', text: 'Free practice',
        say: [OFFICER, 'That is the course. The range is yours: every weapon, endless ammunition. The steel plates left and right show where your rounds land. Escape leaves.'] },
    ],
    outro: null,
  },
};
