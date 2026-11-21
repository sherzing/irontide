// Halyard 45: an original blowback submachine gun in the boxy-polymer idiom — tall slab-sided receiver, straight
// stick magazine, side-folding skeleton stock, a left-side cocking handle and a tube red dot on a full-length rail.
// Same skeleton as the carbine (see vmparts.js), so it shares the carbine's hand poses.
import * as THREE from 'three';
import { PartBuilder, Decals, FIN, rbox, sideExtrude, axisExtrude, revolve, cyl, roundRect } from './vmkit.js';
import { H, stadium, pistolGrip, triggerGroup, topRail, pins, foldedSight, roundLens, pivoted } from './vmparts.js';

export const SMG_DIM = {
  sightY: 0.0668,                 // red-dot axis above the bore
  muzzle: [0, 0, -0.352],
  eject: [0.03, 0.006, -0.04],
  magPivot: [0, -0.075, -0.07],
  boltTravel: 0.068,
};

export function buildSmg(mat) {
  const B = new PartBuilder(), P = FIN.poly, A = FIN.anod, S = SMG_DIM.sightY;

  // ---------------------------------------------------------------- receiver: one tall polymer shell that runs on into the handguard
  B.add(P, sideExtrude([[-0.118, -0.022], [0.108, -0.022], [0.122, -0.031], [0.282, -0.031], [0.3, -0.014], [0.3, 0.02], [0.292, 0.029], [-0.1, 0.029], [-0.118, 0.014]], 0.044, 0.0045, { round: true }));
  B.add(P, sideExtrude([[-0.112, -0.02], [0.111, -0.02], [0.111, -0.058], [0.106, -0.09], [0.038, -0.094], [0.034, -0.066], [-0.046, -0.066], [-0.052, -0.06], [-0.112, -0.058]], 0.036, 0.003, { round: true }));
  B.add(P, sideExtrude([[0.108, -0.08], [0.109, -0.092], [0.037, -0.096], [0.036, -0.085]], 0.041, 0.002, { round: true }));       // flared magazine well
  // raised side panels with a milled pocket, vent slots along the handguard, grip strakes underneath
  B.both(P, () => sideExtrude(roundRect(0.0, 0.004, 0.19, 0.036, 0.006), 0.0022, 0.0009), 0.0222, 0, 0);
  B.both(FIN.hole, () => sideExtrude(roundRect(-0.04, 0.004, 0.07, 0.016, 0.003), 0.0006, 0), 0.0236, 0, 0);
  for (let i = 0; i < 4; i++) B.both(FIN.hole, () => sideExtrude(stadium(0.152 + i * 0.036, 0.0, 0.026, 0.0085), 0.0012, 0), 0.0218, 0, 0);
  for (let i = 0; i < 6; i++) B.add(FIN.hole, rbox(0.03, 0.0012, 0.0032, 0.0004), 0, -0.0312, 0.148 + i * 0.022);
  for (let i = 0; i < 5; i++) B.both(FIN.hole, () => rbox(0.0008, 0.0016, 0.05, 0.0002), 0.0182, -0.07 - i * 0.0042, 0.073);
  B.add(FIN.hole, rbox(0.0014, 0.02, 0.058, 0.004), 0.0218, 0.005, 0.04);                              // ejection port
  B.add(FIN.hole, rbox(0.0014, 0.0075, 0.1, 0.003), -0.0218, 0.014, 0.07);                              // cocking-handle slot
  pins(B, [[-0.098, -0.037], [0.099, -0.037], [0.27, -0.016], [-0.09, 0.016]], 0.0222);
  B.both(FIN.steel, () => cyl(0.0056, 0.002, 12, 0.0005), 0.0224, -0.012, 0.135, 0, H, 0);              // sling sockets
  // ---------------------------------------------------------------- barrel: short, with a three-lug collar
  B.add(FIN.phos, revolve([[0.286, 0], [0.286, 0.0105], [0.302, 0.0105], [0.305, 0.0092], [0.334, 0.0092], [0.336, 0.0112], [0.346, 0.0112], [0.352, 0.0096], [0.352, 0.0056], [0.33, 0.0052], [0.33, 0]], 18));
  for (let k = 0; k < 3; k++) B.add(FIN.phos, rbox(0.0052, 0.0036, 0.007, 0.001), Math.cos(k * 2.094 + H) * 0.0118, Math.sin(k * 2.094 + H) * 0.0118, 0.341, 0, 0, k * 2.094);
  B.add(A, axisExtrude(roundRect(0, -0.004, 0.036, 0.04, 0.007), 0.296, 0.304, 0.0012, { holes: [roundRect(0, 0, 0.022, 0.022, 0.0105, 6)] }));   // front trunnion plate

  // ---------------------------------------------------------------- controls
  triggerGroup(B, P);
  for (const sx of [-1, 1]) {                                                                            // ambidextrous selector
    B.add(FIN.phos, cyl(0.0062, 0.0028, 14, 0.0006), sx * 0.0188, -0.04, -0.064, 0, H, 0);
    B.add(FIN.phos, rbox(0.003, 0.0052, 0.024, 0.0014), sx * 0.0206, -0.0355, -0.0545, 0.5, 0, 0);
    B.add(FIN.white, cyl(0.0015, 0.0005, 8, 0.0001), sx * 0.0182, -0.0285, -0.05, 0, H, 0);
    B.add(FIN.red, cyl(0.0015, 0.0005, 8, 0.0001), sx * 0.0182, -0.0285, -0.079, 0, H, 0);
  }
  B.add(FIN.phos, sideExtrude([[0.03, -0.068], [0.04, -0.07], [0.041, -0.094], [0.033, -0.1], [0.028, -0.09]], 0.012, 0.002, { round: true }));   // paddle magazine release
  B.add(FIN.phos, rbox(0.0034, 0.02, 0.012, 0.0014), -0.0196, -0.03, 0.02);                              // bolt catch
  pistolGrip(B, P);

  // ---------------------------------------------------------------- rail, back-up sights, red dot
  topRail(B, -0.1, 0.29, 0.029);
  foldedSight(B, -0.082, 0.0385); foldedSight(B, 0.268, 0.0385);
  const of = 0.036;
  B.add(A, rbox(0.03, 0.0075, 0.046, 0.0015), 0, 0.0422, of);                                             // mount base
  B.add(A, rbox(0.012, 0.011, 0.03, 0.002), 0, 0.0495, of);                                               // riser
  B.add(FIN.phos, rbox(0.0034, 0.0072, 0.03, 0.0014), -0.017, 0.042, of + 0.004);
  B.add(A, axisExtrude(roundRect(0, S, 0.04, 0.04, 0.0195, 7), of - 0.03, of + 0.03, 0.0016, { holes: [roundRect(0, S, 0.031, 0.031, 0.0153, 7)] }));   // tube
  B.add(A, axisExtrude(roundRect(0, S, 0.0445, 0.0445, 0.022, 7), of + 0.026, of + 0.034, 0.001, { holes: [roundRect(0, S, 0.033, 0.033, 0.0163, 7)] }));  // front bezel
  B.add(A, cyl(0.0078, 0.012, 14, 0.001), 0.0236, S, of - 0.006, 0, H, 0);                                // brightness dial
  for (let k = 0; k < 8; k++) B.add(FIN.hole, rbox(0.0122, 0.0011, 0.0011, 0.0003), 0.0238, S + Math.sin(k * 0.785) * 0.0074, of - 0.006 - Math.cos(k * 0.785) * 0.0074);
  B.add(FIN.steel, cyl(0.0042, 0.004, 12, 0.0006), 0, S + 0.021, of - 0.004, H, 0, 0);                    // elevation cap
  B.add(A, cyl(0.0058, 0.0085, 12, 0.0008), -0.0224, S - 0.006, of + 0.012, 0, H, 0);                     // battery cap

  // ---------------------------------------------------------------- side-folding skeleton stock
  B.add(A, rbox(0.04, 0.046, 0.016, 0.003), 0, -0.004, -0.124);                                           // hinge block
  B.add(FIN.steel, cyl(0.004, 0.05, 10, 0.0006), 0.014, -0.004, -0.124, H, 0, 0);
  B.add(P, sideExtrude([[-0.13, 0.02], [-0.13, 0.008], [-0.318, 0.008], [-0.318, 0.022], [-0.3, 0.026]], 0.02, 0.004, { round: true }));     // upper strut (cheek rail)
  B.add(P, sideExtrude([[-0.13, -0.014], [-0.13, -0.027], [-0.318, -0.078], [-0.318, -0.064]], 0.014, 0.003, { round: true }));              // lower strut
  B.add(P, sideExtrude([[-0.316, 0.026], [-0.316, -0.086], [-0.334, -0.092], [-0.342, -0.086], [-0.342, 0.02], [-0.334, 0.028]], 0.034, 0.005, { round: true }));
  B.add(FIN.rubber, sideExtrude([[-0.342, 0.02], [-0.342, -0.086], [-0.35, -0.08], [-0.35, 0.014]], 0.032, 0.003, { round: true }));
  for (let i = 0; i < 5; i++) B.add(FIN.hole, rbox(0.0335, 0.0012, 0.0012, 0.0003), 0, -0.07 + i * 0.02, -0.3508);

  const body = B.build(mat);

  // ---------------------------------------------------------------- magazine (moves): straight stick with a witness strip
  const mp = SMG_DIM.magPivot, M = new PartBuilder();
  M.add(P, sideExtrude([[0.043, -0.05], [0.046, -0.232], [0.103, -0.228], [0.099, -0.05]], 0.0262, 0.0032, { round: true }));
  M.add(P, sideExtrude([[0.042, -0.229], [0.107, -0.224], [0.108, -0.236], [0.043, -0.241]], 0.03, 0.003, { round: true }));              // floor plate
  M.both(FIN.glassDark, () => rbox(0.0008, 0.11, 0.008, 0.0003), 0.0132, -0.15, 0.062, 0.02);                                              // translucent strip
  for (let i = 0; i < 3; i++) M.both(FIN.hole, () => rbox(0.0008, 0.0016, 0.04, 0.0002), 0.0132, -0.2 - i * 0.008, 0.074);
  M.both(FIN.phos, () => rbox(0.0042, 0.0045, 0.046, 0.001), 0.0092, -0.0478, 0.071);                                                      // feed lips
  { const c = revolve([[0.05, 0], [0.05, 0.0058], [0.052, 0.006], [0.07, 0.006], [0.07, 0]], 12); c.translate(0, -0.0455, 0); M.add(FIN.brass, c);
    const b = revolve([[0.07, 0.0056], [0.08, 0.0053], [0.086, 0.0034], [0.088, 0.0008], [0.088, 0]], 12); b.translate(0, -0.0455, 0); M.add(FIN.copper, b); }
  const mag = pivoted(M.build(mat), mp);

  // ---------------------------------------------------------------- bolt group (moves): bolt face in the port + the forward cocking handle
  const G = new PartBuilder();
  G.add(FIN.chrome, rbox(0.004, 0.0185, 0.07, 0.0012), 0.0196, 0.005, 0.034);
  for (let i = 0; i < 4; i++) G.add(FIN.hole, rbox(0.0008, 0.019, 0.0016, 0.0002), 0.0216, 0.005, 0.012 + i * 0.006);
  G.add(FIN.phos, rbox(0.0085, 0.0058, 0.009, 0.0012), -0.0242, 0.014, 0.102);
  G.add(P, sideExtrude([[0.094, 0.0075], [0.112, 0.0075], [0.1145, 0.0105], [0.1145, 0.0175], [0.112, 0.0205], [0.094, 0.0205]], 0.0135, 0.003, { round: true }), -0.0335, 0, 0);
  const bolt = new THREE.Group(); bolt.add(G.build(mat));

  const lens = roundLens(S, of + 0.004, 0.0152);

  // ---------------------------------------------------------------- markings
  const D = new Decals(), name = D.label('HALYARD 45', { size: 56, weight: 700 }), cal = D.label('CAL .45   IRONTIDE ARMS\nSER IT 318 204', { size: 26, weight: 600 });
  D.put(name, -0.02334, 0.0135, -0.062, 0.0086, 'L'); D.put(cal, -0.02334, -0.006, -0.048, 0.0105, 'L'); D.put(name, 0.02334, -0.008, -0.03, 0.0078, 'R');
  const sS = D.label('S', { size: 40 }), s1 = D.label('1', { size: 40 }), sA = D.label('A', { size: 40 });
  for (const [face, sx] of [['L', -1], ['R', 1]]) { D.put(sS, sx * 0.01812, -0.0285, -0.0445, 0.0044, face); D.put(s1, sx * 0.01812, -0.0262, -0.064, 0.0044, face); D.put(sA, sx * 0.01812, -0.0285, -0.0845, 0.0044, face); }
  D.put(D.label('RD-1', { size: 40 }), -0.02012, S + 0.001, of, 0.006, 'L');
  const decals = D.build();

  const group = new THREE.Group();
  group.add(body, mag, bolt, lens, decals);
  return { group, body, mag, bolt, lens, decals };
}
