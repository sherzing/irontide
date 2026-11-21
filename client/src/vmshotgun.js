// Marlin 12: an original gas-operated semi-automatic shotgun — barrel over a tube magazine, polymer fore-end,
// pistol-grip stock, ghost-ring sights on a short rail and a side saddle of spare shells.
// Same skeleton as the carbine (see vmparts.js): the firing hand uses the carbine's pose.
import * as THREE from 'three';
import { PartBuilder, Decals, FIN, rbox, sideExtrude, axisExtrude, revolve, cyl, roundRect } from './vmkit.js';
import { H, FINX, pistolGrip, triggerGroup, topRail, pins } from './vmparts.js';

export const SHOTGUN_DIM = {
  sightY: 0.0475,                 // ghost-ring axis above the bore
  muzzle: [0, 0, -0.602],
  eject: [0.03, 0.004, -0.03],
  boltTravel: 0.07,
  port: [0, -0.034, 0.07],        // loading port under the receiver [x, y, forward]
};

/** One 12-bore shell lying along the bore axis, base at f = 0. */
export function shellGeo(B, x = 0, y = 0, f = 0, rx = 0, ry = 0, rz = 0) {
  B.add(FINX.hull, revolve([[0.016, 0.0102], [0.062, 0.0102], [0.066, 0.0092], [0.066, 0]], 12), x, y, f, rx, ry, rz);
  B.add(FIN.brass, revolve([[0, 0], [0, 0.0108], [0.0015, 0.011], [0.003, 0.0104], [0.016, 0.0104]], 12), x, y, f, rx, ry, rz);
}

export function buildShotgun(mat) {
  const B = new PartBuilder(), P = FIN.poly, A = FIN.anod, S = SHOTGUN_DIM.sightY;

  // ---------------------------------------------------------------- barrel, magazine tube, clamp
  B.add(FIN.phos, revolve([[0.1, 0], [0.1, 0.0142], [0.16, 0.0142], [0.168, 0.0126], [0.596, 0.0122], [0.602, 0.0114], [0.602, 0.0096], [0.57, 0.0094], [0.57, 0]], 20));
  { const t = revolve([[0.1, 0], [0.1, 0.0128], [0.486, 0.0128], [0.49, 0.0142], [0.508, 0.0142], [0.512, 0.0126], [0.516, 0.0094], [0.516, 0]], 18); t.translate(0, -0.0292, 0); B.add(FIN.phos, t); }
  for (let k = 0; k < 10; k++) { const c = cyl(0.0146, 0.0014, 18, 0.0004); c.translate(0, -0.0292, -(0.492 + k * 0.0016)); B.add(FIN.hole, c); }   // knurled cap
  B.add(A, axisExtrude(roundRect(0, -0.0145, 0.036, 0.062, 0.012), 0.44, 0.458, 0.002, { holes: [roundRect(0, 0, 0.0252, 0.0252, 0.0124, 6), roundRect(0, -0.0292, 0.0262, 0.0262, 0.0129, 6)] }));   // barrel clamp
  B.both(FIN.steel, () => cyl(0.0034, 0.002, 10, 0.0004), 0.0184, -0.0145, 0.449, 0, H, 0);
  // front sight: blade between two protective ears
  B.add(A, rbox(0.016, 0.006, 0.03, 0.0015), 0, 0.0148, 0.578);
  B.add(FIN.phos, rbox(0.0026, S - 0.012, 0.012, 0.0008), 0, 0.0148 + (S - 0.012) / 2, 0.578);
  B.add(FIN.white, rbox(0.0028, 0.003, 0.0014, 0.0005), 0, S - 0.0005, 0.5718);
  B.both(A, () => sideExtrude([[0.564, 0.016], [0.592, 0.016], [0.588, S + 0.006], [0.57, S + 0.006]], 0.0026, 0.0008), 0.0078, 0, 0);

  // ---------------------------------------------------------------- receiver
  B.add(A, sideExtrude([[-0.114, -0.034], [0.096, -0.034], [0.108, -0.024], [0.108, 0.024], [0.094, 0.0305], [-0.094, 0.0305], [-0.114, 0.018]], 0.0405, 0.0035, { round: true }));
  B.add(FIN.hole, rbox(0.0014, 0.021, 0.072, 0.004), 0.0202, 0.004, 0.032);                              // ejection port
  B.add(FIN.hole, rbox(0.024, 0.0014, 0.07, 0.004), 0, -0.0344, 0.068);                                  // loading port
  B.add(FIN.steel, rbox(0.02, 0.002, 0.062, 0.001), 0, -0.0326, 0.066, -0.06);                           // shell lifter
  B.both(A, () => sideExtrude(roundRect(-0.03, -0.004, 0.12, 0.03, 0.005), 0.0016, 0.0007), 0.0204, 0, 0);
  pins(B, [[-0.07, -0.02], [0.02, -0.024], [0.085, 0.012]], 0.0206, 0.003);
  B.add(FIN.phos, rbox(0.0036, 0.012, 0.016, 0.0015), 0.0212, -0.018, 0.092);                            // bolt release
  B.add(FIN.phos, cyl(0.0052, 0.003, 12, 0.0006), 0.0208, -0.021, -0.012, 0, H, 0);                      // cross-bolt safety
  B.add(FIN.red, cyl(0.0034, 0.0006, 10, 0.0002), 0.0224, -0.021, -0.012, 0, H, 0);
  // side saddle: six spare shells on the left
  B.add(A, rbox(0.004, 0.03, 0.15, 0.0015), -0.0222, 0.0, -0.01);
  for (let i = 0; i < 6; i++) { B.add(P, rbox(0.012, 0.027, 0.02, 0.004, 2), -0.0296, 0.0, 0.05 - i * 0.0236); shellGeo(B, -0.0312, -0.031, 0.05 - i * 0.0236, H, 0, 0); }

  // ---------------------------------------------------------------- fore-end: polymer shell round barrel and tube
  B.add(P, sideExtrude([[0.108, -0.052], [0.352, -0.052], [0.372, -0.04], [0.372, -0.002], [0.36, 0.006], [0.108, 0.006]], 0.047, 0.0095, { round: true }));
  for (let i = 0; i < 9; i++) B.both(FIN.hole, () => rbox(0.001, 0.0016, 0.02, 0.0003), 0.0232, -0.031, 0.138 + i * 0.025, 0, 0, 0.5);    // grip cuts
  for (let i = 0; i < 9; i++) B.add(FIN.hole, rbox(0.03, 0.0012, 0.004, 0.0004), 0, -0.0522, 0.14 + i * 0.025);
  B.both(FIN.hole, () => sideExtrude(roundRect(0.24, -0.0105, 0.2, 0.0065, 0.003), 0.0012, 0), 0.0229, 0, 0);                          // vent channel

  // ---------------------------------------------------------------- trigger group, grip, stock
  B.add(P, sideExtrude([[-0.112, -0.034], [0.03, -0.034], [0.034, -0.066], [-0.046, -0.066], [-0.052, -0.06], [-0.112, -0.058]], 0.034, 0.003, { round: true }));
  triggerGroup(B, P);
  pistolGrip(B, P);
  B.add(P, sideExtrude([[-0.112, 0.018], [-0.15, 0.022], [-0.3, 0.026], [-0.334, 0.022], [-0.338, -0.094], [-0.31, -0.102], [-0.215, -0.062], [-0.15, -0.052], [-0.112, -0.05]], 0.036, 0.008, { round: true }));
  B.add(FIN.rubber, sideExtrude([[-0.336, 0.02], [-0.338, -0.094], [-0.352, -0.088], [-0.35, 0.014]], 0.034, 0.004, { round: true }));
  for (let i = 0; i < 6; i++) B.add(FIN.hole, rbox(0.0352, 0.0012, 0.0012, 0.0003), 0, -0.076 + i * 0.016, -0.3515);
  B.add(P, sideExtrude([[-0.18, 0.026], [-0.3, 0.03], [-0.3, 0.04], [-0.19, 0.04]], 0.03, 0.006, { round: true }));                     // cheek riser
  B.both(FIN.steel, () => cyl(0.0056, 0.002, 12, 0.0005), 0.0184, -0.02, -0.29, 0, H, 0);                                              // sling sockets

  // ---------------------------------------------------------------- rail and ghost-ring rear sight
  topRail(B, -0.092, 0.094, 0.0305);
  B.add(A, rbox(0.024, 0.006, 0.026, 0.0015), 0, 0.0428, -0.072);
  { const ring = new THREE.TorusGeometry(0.0062, 0.0017, 6, 18); B.add(FIN.phos, ring, 0, S, -0.072); }
  B.add(FIN.phos, rbox(0.0044, S - 0.0518, 0.004, 0.001), 0, 0.0458 + (S - 0.0518) / 2, -0.072);
  B.both(A, () => sideExtrude([[-0.086, 0.045], [-0.058, 0.045], [-0.062, S + 0.0085], [-0.082, S + 0.0085]], 0.0026, 0.0008), 0.0106, 0, 0);
  B.add(FIN.steel, cyl(0.0034, 0.004, 10, 0.0005), 0.0138, 0.0428, -0.072, 0, H, 0);

  const body = B.build(mat);

  // ---------------------------------------------------------------- bolt (moves): bolt body in the port and its cocking handle
  const G = new PartBuilder();
  G.add(FIN.chrome, rbox(0.004, 0.019, 0.076, 0.0012), 0.0182, 0.004, 0.032);
  G.add(FIN.hole, rbox(0.0008, 0.0095, 0.03, 0.0003), 0.0203, 0.006, 0.04);
  G.add(FIN.phos, cyl(0.0048, 0.02, 12, 0.001), 0.0298, 0.004, 0.012, 0, H, 0);
  G.add(FIN.phos, cyl(0.0064, 0.007, 12, 0.0014), 0.039, 0.004, 0.012, 0, H, 0);
  const bolt = new THREE.Group(); bolt.add(G.build(mat));

  // ---------------------------------------------------------------- the shell the loading hand carries
  const Sh = new PartBuilder(); shellGeo(Sh);
  const shell = new THREE.Group(); shell.add(Sh.build(mat));

  // ---------------------------------------------------------------- markings
  const D = new Decals(), name = D.label('MARLIN 12', { size: 56, weight: 700 }), cal = D.label('12 GA  76 mm   IRONTIDE ARMS\nSER IT 127 660', { size: 26, weight: 600 });
  D.put(name, 0.02122, 0.0155, -0.05, 0.0082, 'R'); D.put(cal, 0.02122, -0.024, 0.045, 0.0092, 'R'); D.put(name, -0.02072, 0.0225, 0.07, 0.007, 'L');
  const decals = D.build();

  const group = new THREE.Group();
  group.add(body, bolt, decals);
  return { group, body, bolt, shell, decals };
}
