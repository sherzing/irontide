// VK-7 carbine: an original short-stroke-piston carbine modelled procedurally. Bore axis = weapon z axis
// (forward is -z); all dimensions in metres. Static parts are merged into one mesh; the magazine and the
// bolt group (carrier + left-side charging handle) are separate so they can move.
import * as THREE from 'three';
import { PartBuilder, Decals, FIN, rbox, sideExtrude, axisExtrude, revolve, cyl, roundRect, place } from './vmkit.js';

const H = Math.PI / 2;
const oct = (R, cy = 0) => Array.from({ length: 8 }, (_, k) => { const a = (22.5 + k * 45) * Math.PI / 180, r = R / Math.cos(Math.PI / 8); return [Math.cos(a) * r, cy + Math.sin(a) * r]; });
const circle = (r, n = 14, cx = 0, cy = 0) => Array.from({ length: n }, (_, k) => { const a = k / n * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
const stadium = (cf, cy, len, w, n = 5) => {
  const out = [], r = w / 2, h = len / 2 - r;
  for (let i = 0; i <= n; i++) { const a = -H + i / n * Math.PI; out.push([cf + h + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  for (let i = 0; i <= n; i++) { const a = H + i / n * Math.PI; out.push([cf - h + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
};

export const CARBINE_DIM = {
  sightY: 0.0695,                 // height of the optic axis above the bore
  muzzle: [0, 0, -0.612],
  eject: [0.03, 0.006, -0.03],
  magPivot: [0, -0.075, -0.068],  // magazine group origin (top of the magazine well)
  boltTravel: 0.072,
  lens: { y: 0.0695, f: 0.047, w: 0.0375, h: 0.0255 },
};

export function buildCarbine(mat) {
  const B = new PartBuilder(), A = FIN.anod, P = FIN.poly;

  // ---------------------------------------------------------------- barrel, gas system, muzzle device
  B.add(FIN.phos, revolve([[0.1, 0], [0.1, 0.0108], [0.2, 0.0108], [0.206, 0.0096], [0.43, 0.0096], [0.436, 0.0086], [0.556, 0.0086], [0.556, 0]], 18));
  B.add(FIN.phos, cyl(0.0052, 0.215, 10), 0, 0.0165, 0.2225);                                    // piston tube
  B.add(FIN.phos, rbox(0.022, 0.03, 0.03, 0.004), 0, 0.006, 0.318);                              // gas block
  B.add(FIN.steel, cyl(0.0028, 0.006, 8), 0, 0.0165, 0.336);                                     // gas regulator
  B.add(FIN.phos, revolve([[0.55, 0.0086], [0.553, 0.0118], [0.557, 0.0128], [0.565, 0.0128], [0.568, 0.0115], [0.606, 0.0115], [0.61, 0.0108], [0.612, 0.0096], [0.612, 0.0048], [0.585, 0.0044], [0.585, 0]], 18));
  for (let i = 0; i < 3; i++) {                                                                  // brake ports
    B.add(FIN.hole, rbox(0.0236, 0.0052, 0.0072, 0.002), 0, 0, 0.576 + i * 0.0115);
    B.add(FIN.hole, rbox(0.0048, 0.0236, 0.0052, 0.002), 0, 0.0005, 0.5818 + i * 0.0115);
  }
  B.add(FIN.steel, cyl(0.0105, 0.003, 16, 0.0006), 0, 0, 0.5495);                                // crush washer

  // ---------------------------------------------------------------- handguard: slotted octagonal shell
  const HG0 = 0.118, HG1 = 0.446, R = 0.0228, T = 0.0028, side = 2 * R * Math.tan(Math.PI / 8) + 0.0012;
  const slots = (n, f0, pitch) => Array.from({ length: n }, (_, i) => stadium(f0 + i * pitch, 0, 0.03, 0.0066));
  for (const [deg, holes] of [[0, slots(7, 0.152, 0.041)], [180, slots(7, 0.152, 0.041)], [-90, slots(7, 0.152, 0.041)], [45, slots(7, 0.152, 0.041)], [135, slots(7, 0.152, 0.041)], [-45, slots(3, 0.152, 0.041)], [-135, slots(3, 0.152, 0.041)]]) {
    const g = sideExtrude([[HG0, -side / 2], [HG1, -side / 2], [HG1, side / 2], [HG0, side / 2]], T, 0.0006, { holes });
    g.translate(R - T / 2, 0, 0); g.rotateZ(deg * Math.PI / 180);
    B.add(A, g);
  }
  B.add(A, axisExtrude(oct(R + 0.0016), HG0 - 0.004, HG0 + 0.012, 0.0012, { holes: [circle(0.0135)] }));       // barrel-nut collar
  B.add(A, axisExtrude(oct(R + 0.0004), HG1 - 0.004, HG1 + 0.0015, 0.001, { holes: [circle(0.0125)] }));       // nose ring
  B.add(A, axisExtrude([[-0.0088, 0.0205], [0.0088, 0.0205], [0.0088, 0.0295], [-0.0088, 0.0295]], HG0, HG1 + 0.0015, 0.0006));   // rail riser
  for (const f of [0.142, 0.43]) B.both(FIN.steel, () => cyl(0.0026, 0.0012, 8, 0.0003), R + 0.0003, -0.0062, f, 0, H, 0);        // handguard screws
  // hand stop + rail covers (the only earth-tone furniture)
  B.add(P, sideExtrude([[0.306, -R + 0.001], [0.372, -R + 0.001], [0.366, -0.034], [0.35, -0.047], [0.336, -0.049], [0.324, -0.043], [0.312, -0.03]], 0.021, 0.004, { round: true }));
  for (const sx of [-1, 1]) {
    B.add(FIN.fde, rbox(0.0032, 0.0172, 0.076, 0.0012, 2), sx * (R + 0.0014), 0, 0.378);
    for (let i = 0; i < 6; i++) B.add(FIN.fde, rbox(0.0012, 0.0172, 0.0034, 0.0005), sx * (R + 0.0032), 0, 0.348 + i * 0.012);
  }
  B.add(FIN.fde, rbox(0.0172, 0.0032, 0.05, 0.0012, 2), 0, -R - 0.0014, 0.408);

  // ---------------------------------------------------------------- top rail (receiver + handguard, continuous)
  B.add(A, axisExtrude([[-0.0084, 0.029], [0.0084, 0.029], [0.0084, 0.0333], [0.0106, 0.0355], [-0.0106, 0.0355], [-0.0084, 0.0333]], -0.108, HG1 + 0.0015, 0.0005));
  { const tooth = [[-0.0106, 0.0355], [0.0106, 0.0355], [0.008, 0.0385], [-0.008, 0.0385]];
    for (let k = 0; k < 55; k++) B.add(A, axisExtrude(tooth, -0.106 + k * 0.01, -0.106 + k * 0.01 + 0.0053, 0.0004)); }

  // ---------------------------------------------------------------- upper receiver
  B.add(A, sideExtrude([[-0.112, -0.02], [0.118, -0.02], [0.118, 0.022], [0.106, 0.029], [-0.098, 0.029], [-0.112, 0.016]], 0.04, 0.0024));
  for (const sx of [-1, 1]) B.add(A, rbox(0.002, 0.0045, 0.19, 0.0008), sx * 0.0202, -0.0145, 0.0);       // reinforcing rib
  B.add(A, sideExtrude([[-0.112, -0.018], [-0.118, -0.014], [-0.118, 0.012], [-0.112, 0.016]], 0.036, 0.0015));   // rear trunnion plate
  B.add(FIN.hole, rbox(0.0014, 0.0205, 0.066, 0.004), 0.0199, 0.004, 0.03);                               // ejection port
  B.add(A, rbox(0.0028, 0.0165, 0.066, 0.001), 0.0212, -0.0155, 0.03);                                    // dust cover (open)
  B.add(A, sideExtrude([[-0.03, -0.006], [-0.004, -0.006], [-0.004, 0.014], [-0.018, 0.014]], 0.0065, 0.0012), 0.0215, 0, 0);   // brass deflector
  B.add(FIN.hole, rbox(0.0014, 0.0072, 0.094, 0.003), -0.0199, 0.008, 0.066);                             // charging-handle track
  B.both(FIN.steel, () => cyl(0.0034, 0.0014, 10, 0.0004), 0.0203, 0.012, -0.085, 0, H, 0);               // trunnion cross pins
  B.both(FIN.steel, () => cyl(0.0034, 0.0014, 10, 0.0004), 0.0203, -0.006, 0.108, 0, H, 0);

  // ---------------------------------------------------------------- lower receiver, controls
  B.add(A, sideExtrude([[-0.112, -0.02], [0.111, -0.02], [0.111, -0.058], [0.106, -0.088], [0.037, -0.093], [0.033, -0.066], [-0.046, -0.066], [-0.052, -0.06], [-0.112, -0.06]], 0.034, 0.002));
  B.add(A, sideExtrude([[0.107, -0.079], [0.108, -0.09], [0.036, -0.095], [0.035, -0.084]], 0.039, 0.0018));          // flared magazine-well lip
  B.add(A, sideExtrude([[0.034, -0.066], [0.036, -0.098], [-0.046, -0.098], [-0.049, -0.066], [-0.045, -0.066], [-0.0425, -0.0942], [0.0322, -0.0942], [0.0302, -0.066]], 0.011, 0.001));   // trigger guard
  B.add(FIN.phos, sideExtrude([[-0.012, -0.066], [-0.005, -0.066], [-0.002, -0.078], [-0.0045, -0.088], [-0.0085, -0.089], [-0.0075, -0.078]], 0.0065, 0.0012, { round: true }));   // trigger
  B.add(FIN.steel, cyl(0.0041, 0.0362, 12, 0.0006), 0, -0.037, -0.098, 0, H, 0);                          // takedown + pivot pins
  B.add(FIN.steel, cyl(0.0041, 0.0362, 12, 0.0006), 0, -0.037, 0.099, 0, H, 0);
  B.add(FIN.steel, cyl(0.0022, 0.0352, 8, 0.0004), 0, -0.047, -0.012, 0, H, 0);
  B.add(FIN.steel, cyl(0.0022, 0.0352, 8, 0.0004), 0, -0.041, -0.034, 0, H, 0);
  for (const sx of [-1, 1]) {                                                                             // ambidextrous selector
    B.add(FIN.phos, cyl(0.0062, 0.0028, 14, 0.0006), sx * 0.0178, -0.04, -0.064, 0, H, 0);
    B.add(FIN.phos, rbox(0.003, 0.0052, 0.022, 0.0014), sx * 0.0196, -0.0355, -0.0555, 0.5, 0, 0);
    B.add(FIN.white, cyl(0.0015, 0.0005, 8, 0.0001), sx * 0.0172, -0.0285, -0.05, 0, H, 0);
    B.add(FIN.red, cyl(0.0015, 0.0005, 8, 0.0001), sx * 0.0172, -0.0285, -0.079, 0, H, 0);
  }
  B.add(FIN.phos, rbox(0.003, 0.021, 0.0115, 0.0014), -0.0182, -0.031, 0.018);                            // bolt catch
  B.add(FIN.phos, rbox(0.0042, 0.009, 0.0135, 0.0018), -0.0188, -0.043, 0.018);
  B.add(FIN.phos, cyl(0.0048, 0.003, 12, 0.0006), 0.0178, -0.037, 0.028, 0, H, 0);                        // magazine release
  B.add(A, rbox(0.002, 0.012, 0.02, 0.0008), 0.018, -0.037, 0.028);
  B.add(FIN.steel, cyl(0.0058, 0.0022, 12, 0.0005), -0.0178, -0.03, -0.103, 0, H, 0);                     // sling socket
  { const ring = new THREE.TorusGeometry(0.0085, 0.0015, 6, 16); ring.rotateY(H); B.add(FIN.steel, ring, -0.0225, -0.0375, -0.103, 0.25, 0, 0); }

  // ---------------------------------------------------------------- machined relief on the receiver flats (both sides)
  B.both(A, () => rbox(0.0014, 0.0032, 0.1, 0.0006), 0.0204, 0.0185, -0.045);                              // upper stiffening ribs
  B.both(A, () => rbox(0.0014, 0.0032, 0.064, 0.0006), 0.0204, -0.0015, -0.066);
  B.both(A, () => sideExtrude(roundRect(0.076, 0.006, 0.05, 0.024, 0.004), 0.0018, 0.0007), 0.0203, 0, 0);      // raised forward panel
  B.both(FIN.hole, () => sideExtrude(roundRect(0.076, 0.006, 0.04, 0.015, 0.003), 0.0006, 0), 0.0212, 0, 0);    // …with a milled pocket
  for (const f of [-0.098, 0.099]) B.both(A, () => cyl(0.0074, 0.0016, 16, 0.0005), 0.0172, -0.037, f, 0, H, 0);  // pin bosses
  B.both(A, () => sideExtrude([[0.034, -0.062], [0.112, -0.062], [0.112, -0.03], [0.1, -0.024], [0.034, -0.024]], 0.0014, 0.0006, { holes: [[[0.04, -0.057], [0.106, -0.057], [0.106, -0.033], [0.097, -0.029], [0.04, -0.029]]] }), 0.0174, 0, 0);   // magazine-well fence
  for (let i = 0; i < 5; i++) B.both(FIN.hole, () => rbox(0.0008, 0.0016, 0.05, 0.0002), 0.0172, -0.07 - i * 0.0042, 0.072);     // magwell grip grooves
  for (let i = 0; i < 7; i++) B.both(A, () => cyl(0.0016, 0.0009, 6, 0.0002), 0.0203, 0.0255, -0.1 + i * 0.03, 0, H, 0);       // top-cover rivets
  for (let i = 0; i < 9; i++) B.both(FIN.hole, () => rbox(0.0009, 0.0015, 0.021, 0.0002), 0.0151, -0.086 - i * 0.008, -0.079 - i * 0.0019);   // grip checkering
  B.both(FIN.steel, () => cyl(0.0058, 0.002, 14, 0.0005), R + 0.0006, -0.0105, 0.137, 0, H, 0);                // handguard QD sockets
  B.both(FIN.hole, () => cyl(0.0036, 0.0022, 12, 0.0002), R + 0.0008, -0.0105, 0.137, 0, H, 0);
  for (let i = 0; i < 4; i++) B.add(P, rbox(0.0372, 0.0022, 0.004, 0.0008), 0, 0.0305, -0.276 + i * 0.03);          // cheek-rest ribs
  B.add(FIN.steel, cyl(0.0052, 0.038, 12, 0.0006), 0, -0.05, -0.312, 0, H, 0);                                  // stock sling bar
  B.add(A, rbox(0.012, 0.007, 0.02, 0.002), 0.0195, -0.012, -0.128);                                           // stock latch

  // ---------------------------------------------------------------- pistol grip
  B.add(P, sideExtrude([[-0.047, -0.064], [-0.052, -0.09], [-0.071, -0.158], [-0.076, -0.166], [-0.108, -0.167], [-0.114, -0.158], [-0.103, -0.104], [-0.099, -0.075], [-0.108, -0.06], [-0.1, -0.054], [-0.09, -0.058]], 0.0295, 0.0065, { round: true }));
  B.add(P, rbox(0.0305, 0.006, 0.04, 0.002, 2), 0, -0.1645, -0.0925, 0.02);                                // grip floor plate

  // ---------------------------------------------------------------- stock
  B.add(A, rbox(0.036, 0.05, 0.02, 0.003), 0, -0.006, -0.128);                                            // hinge block
  B.add(FIN.steel, cyl(0.004, 0.052, 10, 0.0006), -0.012, -0.006, -0.128, H, 0, 0);
  B.add(A, cyl(0.0125, 0.168, 16, 0.001), 0, 0.004, -0.218);                                              // receiver extension tube
  B.add(A, sideExtrude([[-0.136, -0.024], [-0.136, -0.036], [-0.3, -0.082], [-0.3, -0.068]], 0.012, 0.002));   // lower strut
  B.add(P, sideExtrude([[-0.296, 0.024], [-0.296, -0.09], [-0.318, -0.097], [-0.329, -0.09], [-0.329, 0.02], [-0.32, 0.028]], 0.036, 0.005, { round: true }));
  B.add(FIN.rubber, sideExtrude([[-0.329, 0.02], [-0.329, -0.09], [-0.337, -0.085], [-0.337, 0.015]], 0.034, 0.003, { round: true }));
  B.add(P, sideExtrude([[-0.15, 0.012], [-0.29, 0.012], [-0.29, 0.03], [-0.165, 0.03], [-0.15, 0.022]], 0.034, 0.007, { round: true }));   // cheek rest

  // ---------------------------------------------------------------- folding back-up sights
  for (const f of [-0.085, 0.4315]) {
    B.add(A, rbox(0.0212, 0.007, 0.03, 0.0012), 0, 0.042, f);
    B.add(A, rbox(0.0115, 0.0052, 0.036, 0.0014), 0, 0.0478, f - 0.004);
    B.add(FIN.phos, cyl(0.0024, 0.0225, 8, 0.0004), 0, 0.0445, f + 0.012, 0, H, 0);
  }

  // ---------------------------------------------------------------- holographic sight
  const S = CARBINE_DIM.sightY, of = 0.031;
  B.add(A, rbox(0.03, 0.0085, 0.066, 0.0015), 0, 0.04275, of);                                            // clamp base
  B.add(A, rbox(0.0055, 0.0105, 0.05, 0.0015), -0.0168, 0.0385, of);
  B.add(FIN.phos, rbox(0.0032, 0.0072, 0.034, 0.0014), -0.0208, 0.0385, of + 0.004);                      // QD lever
  B.add(FIN.steel, cyl(0.0042, 0.0042, 10, 0.0006), -0.0205, 0.0385, of - 0.014, 0, H, 0);
  B.add(A, rbox(0.039, 0.0125, 0.058, 0.003, 2), 0, 0.05, of);                                            // electronics housing
  B.add(A, axisExtrude(roundRect(0, S + 0.001, 0.0475, 0.0345, 0.0065), of - 0.025, of + 0.025, 0.0012, { holes: [roundRect(0, S, 0.0375, 0.0255, 0.0032)] }));   // window hood
  B.add(A, axisExtrude([[-0.0245, S - 0.012], [-0.0275, S - 0.008], [-0.0275, S + 0.012], [-0.0245, S + 0.0165], [-0.0235, S + 0.0165], [-0.0235, S - 0.012]], of - 0.02, of + 0.02, 0.0008));   // guard wings
  B.add(A, axisExtrude([[0.0245, S - 0.012], [0.0235, S - 0.012], [0.0235, S + 0.0165], [0.0245, S + 0.0165], [0.0275, S + 0.012], [0.0275, S - 0.008]], of - 0.02, of + 0.02, 0.0008));
  B.add(A, cyl(0.0076, 0.011, 14, 0.001), 0.0225, 0.05, of - 0.014, 0, H, 0);                             // battery cap
  B.add(FIN.hole, rbox(0.0125, 0.0012, 0.0016, 0.0004), 0.0282, 0.05, of - 0.014, 0, H, 0);
  for (const x of [-0.009, 0.009]) B.add(FIN.rubber, rbox(0.0075, 0.0048, 0.0024, 0.001), x, 0.05, of - 0.0296);   // brightness buttons
  B.add(FIN.steel, cyl(0.0036, 0.0026, 10, 0.0005), 0, S + 0.0193, of, H, 0, 0);                          // elevation
  B.add(FIN.steel, cyl(0.0036, 0.0026, 10, 0.0005), 0.0288, S, of, 0, H, 0);                              // windage

  // ---------------------------------------------------------------- weapon light (left side, where the shooter sees it) with its switch cable
  { const LX = -(R + 0.0148), g = revolve([[0.336, 0], [0.336, 0.0088], [0.34, 0.0102], [0.404, 0.0102], [0.407, 0.0132], [0.436, 0.0132], [0.439, 0.012], [0.439, 0.0104], [0.4345, 0.01], [0.4345, 0]], 18);
    g.translate(LX, 0.002, 0); B.add(A, g);
    for (let i = 0; i < 5; i++) B.add(A, cyl(0.0108, 0.0022, 18, 0.0005), LX, 0.002, 0.35 + i * 0.011);            // cooling fins
    B.add(FIN.glassDark, cyl(0.01, 0.001, 18, 0.0002), LX, 0.002, 0.4348);
    B.add(FIN.steel, cyl(0.0112, 0.0016, 18, 0.0004), LX, 0.002, 0.4375);                                         // bezel
    B.add(FIN.rubber, cyl(0.0084, 0.006, 12, 0.0015), LX, 0.002, 0.334);
    B.add(A, rbox(0.008, 0.015, 0.032, 0.002), -(R + 0.004), 0.002, 0.378);                                       // mount
    B.add(FIN.steel, cyl(0.0024, 0.0012, 8, 0.0003), -(R + 0.0084), 0.002, 0.369, 0, H, 0); B.add(FIN.steel, cyl(0.0024, 0.0012, 8, 0.0003), -(R + 0.0084), 0.002, 0.387, 0, H, 0);
    // pressure pad on the top-left flat, cable looping back to the tail cap
    B.add(FIN.rubber, rbox(0.0125, 0.0042, 0.05, 0.0018, 2), -0.0165, 0.0195, 0.262, 0, 0, 0.785);
    const pts = [[LX, 0.004, 0.331], [LX - 0.004, 0.012, 0.318], [-0.0215, 0.0235, 0.305], [-0.0185, 0.0222, 0.289]];
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), c = cyl(0.0017, len + 0.002, 6, 0.0003);
      c.lookAt(new THREE.Vector3(b[0] - a[0], b[1] - a[1], -(b[2] - a[2]))); B.add(FIN.rubber, c, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); } }

  // ---------------------------------------------------------------- aiming module on the top rail (sits below the optic's line of sight)
  { const f0 = 0.332, f1 = 0.408, y0 = 0.0388, y1 = 0.0562, P2 = FIN.fde;
    B.add(P2, sideExtrude([[f0, y0], [f1, y0], [f1, y1 - 0.003], [f1 - 0.004, y1], [f0 + 0.006, y1], [f0, y1 - 0.005]], 0.05, 0.0022));
    B.add(A, rbox(0.054, 0.0045, 0.03, 0.0012), 0, y0 + 0.001, 0.37);                                              // clamp
    B.add(FIN.steel, cyl(0.0034, 0.004, 10, 0.0005), -0.0275, y0 + 0.001, 0.37, 0, H, 0);
    for (const [x, r] of [[-0.013, 0.0062], [0.004, 0.0048], [0.0165, 0.0048]]) { B.add(A, cyl(r + 0.0014, 0.004, 14, 0.0006), x, y0 + 0.0092, f1 + 0.0012); B.add(FIN.glassDark, cyl(r, 0.0012, 14, 0.0002), x, y0 + 0.0092, f1 + 0.0036); }
    for (const x of [-0.012, 0.012]) B.add(FIN.steel, cyl(0.0036, 0.0028, 10, 0.0005), x, y1 + 0.001, 0.352, H, 0, 0);    // zeroing turrets
    B.add(FIN.rubber, rbox(0.014, 0.0024, 0.012, 0.001), 0, y1 + 0.0006, 0.392);                                   // fire button
    B.add(FIN.steel, cyl(0.0042, 0.0034, 12, 0.0006), 0.0262, y0 + 0.0092, 0.346, 0, H, 0); }                      // mode switch

  const body = B.build(mat);

  // ---------------------------------------------------------------- magazine (moves)
  const mp = CARBINE_DIM.magPivot, M = new PartBuilder();
  M.add(FIN.fde, sideExtrude([[0.041, -0.05], [0.0425, -0.11], [0.0495, -0.165], [0.058, -0.204], [0.118, -0.197], [0.108, -0.16], [0.1005, -0.11], [0.097, -0.05]], 0.0232, 0.0032, { round: true }));
  M.add(FIN.fde, sideExtrude([[0.054, -0.201], [0.122, -0.193], [0.1235, -0.204], [0.0555, -0.213]], 0.0262, 0.003, { round: true }));     // floor plate
  for (let i = 0; i < 4; i++) M.add(FIN.fde, sideExtrude([[0.05 + i * 0.002, -0.118 - i * 0.017], [0.103 + i * 0.0028, -0.113 - i * 0.017], [0.1035 + i * 0.0028, -0.118 - i * 0.017], [0.0505 + i * 0.002, -0.123 - i * 0.017]], 0.0246, 0.0012, { round: true }));   // grip ribs
  M.both(FIN.phos, () => rbox(0.0038, 0.0045, 0.05, 0.001), 0.0088, -0.0478, 0.069);                       // feed lips
  for (const [x, y] of [[0.0028, -0.0455], [-0.0032, -0.0525]]) {                                         // top rounds
    const c = revolve([[0.046, 0], [0.046, 0.0047], [0.047, 0.0047], [0.0475, 0.0041], [0.0485, 0.0047], [0.079, 0.0047], [0.084, 0.0032], [0.089, 0.0031]], 10); c.translate(x, y, 0); M.add(FIN.brass, c);
    const b = revolve([[0.089, 0.0029], [0.095, 0.0027], [0.101, 0.0016], [0.104, 0.0004], [0.104, 0]], 10); b.translate(x, y, 0); M.add(FIN.copper, b);
  }
  const magMesh = M.build(mat); magMesh.geometry.translate(-mp[0], -mp[1], -mp[2]);
  const mag = new THREE.Group(); mag.position.set(...mp); mag.add(magMesh);

  // ---------------------------------------------------------------- bolt group (moves): carrier + charging handle
  const G = new PartBuilder();
  G.add(FIN.chrome, rbox(0.004, 0.0185, 0.08, 0.0012), 0.0176, 0.004, 0.026);
  for (let i = 0; i < 5; i++) G.add(FIN.hole, rbox(0.0008, 0.019, 0.0016, 0.0002), 0.0196, 0.004, 0.0 + i * 0.006);
  G.add(FIN.phos, rbox(0.0075, 0.0058, 0.009, 0.0012), -0.0222, 0.008, 0.102);                             // handle stem
  G.add(FIN.phos, sideExtrude([[0.094, 0.0018], [0.111, 0.0018], [0.1135, 0.0048], [0.1135, 0.0112], [0.111, 0.0142], [0.094, 0.0142]], 0.0125, 0.0028, { round: true }), -0.0312, 0, 0);
  const boltMesh = G.build(mat);
  const bolt = new THREE.Group(); bolt.add(boltMesh);

  // ---------------------------------------------------------------- lens with collimated reticle
  const L = CARBINE_DIM.lens;
  const lens = new THREE.Mesh(new THREE.PlaneGeometry(L.w, L.h), null);
  lens.position.set(0, L.y, -L.f); lens.renderOrder = 8; lens.frustumCulled = false;

  // ---------------------------------------------------------------- markings
  const D = new Decals(), wh = { color: '#cfcdc6' };
  const name = D.label('VK-7', { size: 64, weight: 700 }), cal = D.label('CAL 5.56×45   IRONTIDE ARMS\nSER IT 204 771', { size: 26, weight: 600 });
  D.put(name, -0.02012, 0.0105, -0.052, 0.0105, 'L'); D.put(cal, -0.02012, 0.0082, 0.058, 0.0118, 'L');
  D.put(name, 0.02012, 0.019, -0.07, 0.0085, 'R');
  const sS = D.label('S', { size: 40 }), s1 = D.label('1', { size: 40 }), sA = D.label('A', { size: 40 });
  for (const [face, sx] of [['L', -1], ['R', 1]]) { D.put(sS, sx * 0.01712, -0.0285, -0.0445, 0.0044, face); D.put(s1, sx * 0.01712, -0.0262, -0.064, 0.0044, face); D.put(sA, sx * 0.01712, -0.0285, -0.0845, 0.0044, face); }
  D.put(D.label('HX-2', { size: 44 }), -0.02762, CARBINE_DIM.sightY + 0.002, 0.031, 0.0068, 'L'); D.put(D.label('HX-2', { size: 44 }), 0.02762, CARBINE_DIM.sightY + 0.002, 0.031, 0.0068, 'R');
  D.put(D.label('LASER  VIS · IR\nCLASS 3R', { size: 22, color: '#18160f', bg: '#d2a51c', pad: 6 }), 0.004, 0.05645, 0.372, 0.011, 'T');
  D.put(D.label('AVOID EXPOSURE', { size: 20, color: '#18160f', bg: '#d2a51c', pad: 5 }), -0.02512, 0.0485, 0.372, 0.0042, 'L');
  D.put(D.label('800 lm', { size: 30 }), -(R + 0.0148) - 0.0104, 0.002, 0.378, 0.0046, 'L');
  for (let k = 0; k < 14; k++) D.put(D.label(String(k * 2 + 2), { size: 28, weight: 600 }), -0.0098, 0.0334, -0.0836 + k * 0.04, 0.0026, 'L');        // rail slot numbers
  const decals = D.build();

  const group = new THREE.Group();
  group.add(body, mag, bolt, lens, decals);
  return { group, body, mag, bolt, lens, decals };
}
