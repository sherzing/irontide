// P-9 Service: an original polymer-framed service pistol — slab slide with raked cocking cuts, squared trigger
// guard, accessory groove, bobbed hammer and a stippled grip.
// Unlike the long guns its origin is the middle of the GRIP (the bore runs at y = P9.boreY): the one-handed hold in
// viewmodel.js is authored against the grip, which is 32 mm wide with its front strap at f = +0.034 .. +0.017.
import * as THREE from 'three';
import { PartBuilder, Decals, FIN, rbox, sideExtrude, revolve, cyl } from './vmkit.js';
import { H } from './vmparts.js';

export const P9 = {
  boreY: 0.076,
  sightY: 0.0978,                 // top of the sights
  muzzle: [0, 0.076, -0.184],
  eject: [0.02, 0.09, -0.06],
  slideTravel: 0.034,
  hammer: [-0.047, 0.067],        // hammer pivot [f, y]
};

export function buildPistol(mat) {
  const P = FIN.poly, PH = FIN.phos, BY = P9.boreY;

  // ---------------------------------------------------------------- frame: dust cover, grip, beavertail
  const B = new PartBuilder();
  B.add(P, sideExtrude([[-0.052, 0.0625], [0.174, 0.0625], [0.174, 0.048], [0.166, 0.0415], [0.09, 0.0415], [0.083, 0.046], [0.036, 0.046], [0.0335, 0.036], [0.017, -0.058], [-0.05, -0.064],
    [-0.047, -0.02], [-0.035, 0.02], [-0.037, 0.036], [-0.058, 0.0465], [-0.056, 0.0625]], 0.0324, 0.0066, { round: true }));
  for (let i = 0; i < 3; i++) B.both(FIN.hole, () => rbox(0.0008, 0.0016, 0.05, 0.0002), 0.0158, 0.0445 + i * 0.0001, 0.112 + i * 0.0001);      // accessory groove
  B.both(FIN.hole, () => rbox(0.0008, 0.003, 0.064, 0.0003), 0.0159, 0.047, 0.128);
  // trigger guard: squared, with a finger hook on its front
  B.add(P, sideExtrude([[0.086, 0.046], [0.0965, 0.041], [0.0985, 0.006], [0.091, -0.003], [0.028, -0.0005], [0.0285, 0.0055], [0.086, 0.0035], [0.0905, 0.009], [0.0895, 0.037], [0.083, 0.041]], 0.0135, 0.0022, { round: true }));
  for (let i = 0; i < 4; i++) B.add(FIN.hole, rbox(0.0125, 0.0014, 0.0009, 0.0003), 0, 0.012 + i * 0.006, 0.0992);
  // stippled grip panels, front-strap grooves, back-strap checkering
  for (let r = 0; r < 9; r++) for (let c = 0; c < 5; c++) B.both(FIN.hole, () => rbox(0.0008, 0.0028, 0.0028, 0.0006), 0.0158, 0.022 - r * 0.0088, 0.016 - c * 0.0092 - r * 0.0017);
  for (let i = 0; i < 8; i++) B.add(FIN.hole, rbox(0.026, 0.0013, 0.0011, 0.0003), 0, 0.03 - i * 0.0105, 0.0336 - i * 0.00182 + 0.0001, 0.17);
  for (let i = 0; i < 8; i++) B.add(FIN.hole, rbox(0.022, 0.0013, 0.0011, 0.0003), 0, 0.012 - i * 0.0085, -0.0377 - i * 0.0012, -0.2);
  B.add(PH, sideExtrude([[-0.03, -0.062], [-0.046, -0.064], [-0.047, -0.073], [-0.036, -0.073]], 0.006, 0.0015, { round: true }));               // lanyard loop
  // controls
  B.add(PH, sideExtrude([[0.046, 0.046], [0.054, 0.046], [0.0565, 0.03], [0.0525, 0.014], [0.0475, 0.0135], [0.0495, 0.028]], 0.0072, 0.0014, { round: true }));   // trigger
  B.add(PH, sideExtrude([[0.012, 0.057], [0.054, 0.0575], [0.056, 0.0545], [0.03, 0.0525], [0.012, 0.053]], 0.0028, 0.001), -0.0166, 0, 0);       // slide release
  B.add(PH, sideExtrude([[-0.036, 0.058], [-0.012, 0.06], [-0.008, 0.0555], [-0.03, 0.0515], [-0.038, 0.053]], 0.0034, 0.0012, { round: true }), -0.017, 0, 0);   // control lever
  B.add(FIN.white, cyl(0.0012, 0.0005, 8, 0.0001), -0.0166, 0.0635, -0.02, 0, H, 0); B.add(FIN.red, cyl(0.0012, 0.0005, 8, 0.0001), -0.0166, 0.0635, -0.027, 0, H, 0);
  B.both(PH, () => rbox(0.0026, 0.008, 0.014, 0.001), 0.0142, 0.009, 0.031, 0.25);                                                                // ambidextrous magazine release
  B.both(FIN.steel, () => cyl(0.0026, 0.0012, 10, 0.0003), 0.0162, 0.054, 0.078, 0, H, 0);                                                        // takedown pin
  const body = B.build(mat);

  // ---------------------------------------------------------------- slide (moves): slab sides, raked cuts, sights; the barrel shows in its port
  const Sl = new PartBuilder();
  Sl.add(PH, sideExtrude([[-0.047, 0.0625], [0.177, 0.0625], [0.177, 0.087], [0.171, 0.0925], [-0.041, 0.0925], [-0.047, 0.087]], 0.0304, 0.0032));
  for (let i = 0; i < 9; i++) Sl.both(FIN.hole, () => rbox(0.0009, 0.021, 0.0021, 0.0003), 0.0151, 0.077, -0.008 - i * 0.0041, -0.26);              // cocking serrations
  Sl.add(FIN.hole, rbox(0.019, 0.0016, 0.034, 0.003), 0.0062, 0.0922, 0.062); Sl.add(FIN.hole, rbox(0.0016, 0.012, 0.034, 0.003), 0.0148, 0.086, 0.062);   // ejection port
  Sl.add(FIN.chrome, rbox(0.0145, 0.011, 0.032, 0.002), 0.0052, 0.0855, 0.062);                                                                   // barrel hood
  Sl.add(PH, rbox(0.0014, 0.0034, 0.03, 0.0006), 0.0153, 0.0795, 0.044);                                                                          // extractor
  { const m = revolve([[0.168, 0.0052], [0.168, 0.0082], [0.1845, 0.0082], [0.1845, 0.0052]], 16); m.translate(0, BY, 0); Sl.add(FIN.chrome, m);
    const h = cyl(0.0054, 0.004, 12, 0.0002); h.translate(0, BY, -0.183); Sl.add(FIN.hole, h); }
  Sl.add(FIN.hole, rbox(0.012, 0.01, 0.002, 0.003), 0, 0.068, 0.1772);                                                                            // recoil-spring guide
  // sights: square notch and post, three dots
  Sl.add(PH, sideExtrude([[-0.043, 0.0925], [-0.026, 0.0925], [-0.028, P9.sightY], [-0.043, P9.sightY]], 0.02, 0.001));
  Sl.add(FIN.hole, rbox(0.0042, 0.0042, 0.02, 0.0002), 0, P9.sightY - 0.0012, -0.0345);
  for (const x of [-0.0062, 0.0062]) Sl.add(FIN.white, cyl(0.0013, 0.0006, 8, 0.0001), x, P9.sightY - 0.0022, -0.0432);
  Sl.add(PH, sideExtrude([[0.154, 0.0925], [0.168, 0.0925], [0.164, P9.sightY], [0.156, P9.sightY]], 0.0036, 0.0006));
  Sl.add(FIN.white, cyl(0.0013, 0.0006, 8, 0.0001), 0, P9.sightY - 0.0022, 0.1548);
  const slide = new THREE.Group(); slide.add(Sl.build(mat));

  // ---------------------------------------------------------------- hammer (moves): pivots at P9.hammer
  const Hm = new PartBuilder();
  Hm.add(PH, sideExtrude([[-0.0035, -0.004], [0.004, -0.003], [0.0035, 0.012], [-0.001, 0.02], [-0.008, 0.021], [-0.0105, 0.016], [-0.0055, 0.01]], 0.0076, 0.0016, { round: true }));
  const hammer = new THREE.Group(); hammer.position.set(0, P9.hammer[1], -P9.hammer[0]); hammer.add(Hm.build(mat));

  // ---------------------------------------------------------------- magazine (moves): only its floor plate shows while seated
  const M = new PartBuilder();
  M.add(FIN.steel, sideExtrude([[0.0125, 0.034], [-0.0035, -0.06], [-0.04, -0.063], [-0.0285, 0.034]], 0.0222, 0.002));
  M.add(P, sideExtrude([[0.0215, -0.0575], [-0.053, -0.0635], [-0.0535, -0.0745], [0.0235, -0.0685]], 0.0336, 0.0036, { round: true }));
  for (let i = 0; i < 5; i++) M.both(FIN.hole, () => cyl(0.0016, 0.0008, 8, 0.0002), 0.0112, 0.012 - i * 0.014, -0.012 - i * 0.0024, 0, H, 0);     // witness holes
  { const c = revolve([[-0.024, 0], [-0.024, 0.0049], [-0.005, 0.0049], [-0.005, 0]], 10); c.translate(0, 0.0372, 0); M.add(FIN.brass, c);
    const b = revolve([[-0.005, 0.0047], [0.004, 0.0042], [0.0085, 0.0024], [0.0095, 0]], 10); b.translate(0, 0.0372, 0); M.add(FIN.copper, b); }
  const mag = new THREE.Group(); mag.add(M.build(mat));

  // ---------------------------------------------------------------- markings
  const D = new Decals(), name = D.label('P-9', { size: 60, weight: 700 }), cal = D.label('9 mm × 19   IRONTIDE ARMS', { size: 26, weight: 600 });
  D.put(name, -0.01532, 0.0775, 0.12, 0.0085, 'L'); D.put(cal, -0.01532, 0.0685, 0.105, 0.0042, 'L'); D.put(D.label('IT 552 081', { size: 26, weight: 600 }), 0.01532, 0.0685, 0.11, 0.0042, 'R');
  const decals = D.build(); slide.add(decals);                                                                                                         // the markings are on the slide and travel with it

  const group = new THREE.Group();
  group.add(body, slide, hammer, mag);
  return { group, body, slide, hammer, mag, decals };
}
