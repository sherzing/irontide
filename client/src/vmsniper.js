// Kestrel .338: an original magnum bolt-action sniper rifle — olive composite chassis stock with a thumbhole grip and
// an adjustable cheek piece, a heavy fluted barrel with a ported brake, a five-round box magazine, a folded bipod and
// a 50 mm telescopic sight. Same skeleton as the carbine (see vmparts.js): the firing hand uses the carbine's pose.
import * as THREE from 'three';
import { PartBuilder, Decals, FIN, rbox, sideExtrude, axisExtrude, revolve, cyl, roundRect } from './vmkit.js';
import { H, FINX, oct, circle, pistolGrip, triggerGroup, topRail, pivoted } from './vmparts.js';

export const SNIPER_DIM = {
  sightY: 0.0665,                 // scope axis above the bore
  muzzle: [0, 0, -0.792],
  eject: [0.03, 0.02, -0.02],
  boltY: 0.012,                   // bolt axis above the bore line used by the stock (the action sits high in the bed)
  boltTravel: 0.094,
  magPivot: [0, -0.034, -0.07],
};

export function buildSniper(mat) {
  const B = new PartBuilder(), O = FINX.od, A = FIN.anod, PH = FIN.phos, S = SNIPER_DIM.sightY;

  // ---------------------------------------------------------------- barrel: heavy, fluted, with a two-chamber brake
  B.add(PH, revolve([[0.12, 0], [0.12, 0.0155], [0.2, 0.0155], [0.215, 0.0135], [0.716, 0.0112], [0.716, 0]], 20));
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + 0.26; B.add(FIN.hole, rbox(0.0036, 0.0016, 0.36, 0.0007), Math.cos(a) * 0.0124, Math.sin(a) * 0.0124, 0.44, 0, 0, a + H); }     // flutes
  B.add(PH, revolve([[0.712, 0.0112], [0.716, 0.0135], [0.724, 0.0135], [0.724, 0.007]], 16));
  B.add(PH, axisExtrude(roundRect(0, 0, 0.036, 0.027, 0.006), 0.724, 0.792, 0.0018, { holes: [circle(0.0062, 12)] }));
  for (const f of [0.742, 0.768]) { B.add(FIN.hole, rbox(0.0368, 0.0155, 0.013, 0.003), 0, 0, f); }                                       // brake ports

  // ---------------------------------------------------------------- chassis stock (one olive shell: fore-end, action bed, thumbhole butt)
  B.add(O, sideExtrude([[-0.116, -0.004], [-0.116, -0.062], [-0.052, -0.066], [0.034, -0.066], [0.038, -0.052], [0.112, -0.052], [0.13, -0.05], [0.42, -0.044], [0.44, -0.03], [0.44, -0.012], [0.13, -0.008], [0.118, -0.004]], 0.046, 0.009, { round: true }));
  // the butt wraps round behind the grip as an open C: that opening is the thumbhole
  B.add(O, sideExtrude([[-0.1, 0.0], [-0.16, 0.012], [-0.19, 0.03], [-0.345, 0.03], [-0.378, 0.022], [-0.382, -0.112], [-0.345, -0.12], [-0.21, -0.174], [-0.1, -0.174], [-0.1, -0.152], [-0.19, -0.136], [-0.248, -0.092], [-0.254, -0.046], [-0.2, -0.022], [-0.1, -0.03]], 0.044, 0.0095, { round: true }));
  pistolGrip(B, O);
  B.add(FIN.rubber, sideExtrude([[-0.38, 0.02], [-0.382, -0.112], [-0.4, -0.106], [-0.398, 0.014]], 0.042, 0.005, { round: true }));     // butt pad
  B.add(FIN.poly, sideExtrude([[-0.372, 0.024], [-0.374, -0.114], [-0.382, -0.112], [-0.38, 0.022]], 0.045, 0.002));                      // spacer
  B.add(FIN.poly, sideExtrude([[-0.2, 0.03], [-0.33, 0.03], [-0.33, 0.05], [-0.316, 0.056], [-0.214, 0.056], [-0.2, 0.048]], 0.04, 0.009, { round: true }));   // adjustable cheek piece
  for (const f of [-0.235, -0.3]) { B.add(FIN.steel, cyl(0.0034, 0.02, 10, 0.0006), 0, 0.03, f, H, 0, 0); B.add(PH, cyl(0.0072, 0.006, 12, 0.0012), 0.0238, 0.014, f, 0, H, 0); }
  for (let i = 0; i < 7; i++) B.both(FIN.hole, () => rbox(0.001, 0.0016, 0.03, 0.0003), 0.0228, -0.03, 0.2 + i * 0.03, 0, 0, 0.5);        // fore-end grip cuts
  B.both(FIN.steel, () => cyl(0.0056, 0.002, 12, 0.0005), 0.0224, -0.03, 0.4, 0, H, 0);                                                  // sling sockets
  B.both(FIN.steel, () => cyl(0.0056, 0.002, 12, 0.0005), 0.0214, -0.06, -0.33, 0, H, 0);

  // ---------------------------------------------------------------- action: flat-bottomed receiver, bolt shroud, magazine housing
  const BY = SNIPER_DIM.boltY;
  B.add(PH, axisExtrude(oct(0.0185, BY), -0.108, 0.13, 0.002));
  B.add(PH, sideExtrude([[-0.108, -0.012], [0.13, -0.012], [0.13, BY], [-0.108, BY]], 0.034, 0.002));
  B.add(FIN.hole, rbox(0.0016, 0.016, 0.1, 0.004), 0.0178, BY + 0.004, 0.03);                                                             // ejection / loading port
  B.add(FIN.hole, rbox(0.0016, 0.006, 0.07, 0.002), 0.0176, BY - 0.006, -0.066);                                                          // bolt-handle raceway
  B.add(A, rbox(0.012, 0.01, 0.014, 0.003), 0.0185, BY - 0.012, -0.108);                                                                  // bolt stop
  B.add(FIN.red, cyl(0.0018, 0.0006, 8, 0.0002), 0.0182, BY + 0.016, -0.098, 0, H, 0);                                                    // safety witness
  B.add(PH, sideExtrude([[0.036, -0.05], [0.036, -0.07], [0.108, -0.07], [0.11, -0.05]], 0.034, 0.003, { round: true }));                 // magazine housing
  B.add(PH, sideExtrude([[0.028, -0.066], [0.038, -0.068], [0.04, -0.086], [0.03, -0.09]], 0.012, 0.002, { round: true }));               // magazine catch
  triggerGroup(B, PH);

  // ---------------------------------------------------------------- telescopic sight on a one-piece rail
  topRail(B, -0.1, 0.13, BY + 0.0185);
  const RY = BY + 0.028;
  for (const f of [-0.045, 0.085]) {                                                                                                      // rings
    B.add(A, rbox(0.03, S - RY + 0.004, 0.02, 0.002), 0, (S + RY) / 2 - 0.006, f);
    B.add(A, axisExtrude(roundRect(0, S, 0.046, 0.046, 0.0225, 7), f - 0.011, f + 0.011, 0.0014, { holes: [circle(0.0152, 16, 0, S)] }));
    for (const sx of [-1, 1]) for (const dy of [-0.012, 0.012]) B.add(FIN.steel, cyl(0.0022, 0.004, 8, 0.0004), sx * 0.021, S + dy, f, 0, H, 0);
  }
  { const g = revolve([[-0.124, 0], [-0.124, 0.0205], [-0.118, 0.0222], [-0.072, 0.0222], [-0.062, 0.0152], [0.022, 0.0152], [0.028, 0.019], [0.062, 0.019], [0.068, 0.0152], [0.13, 0.0152], [0.19, 0.0292], [0.262, 0.0292], [0.262, 0.0262], [0.25, 0.0258], [0.25, 0]], 24);
    g.translate(0, S, 0); B.add(A, g); }
  for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; B.add(FIN.hole, rbox(0.002, 0.0012, 0.016, 0.0004), Math.cos(a) * 0.0224, S + Math.sin(a) * 0.0224, -0.096, 0, 0, a + H); }   // zoom-ring knurl
  B.add(A, cyl(0.0118, 0.016, 16, 0.0016), 0, S + 0.0268, 0.045, H, 0, 0);                                                                // elevation turret
  B.add(A, cyl(0.0118, 0.016, 16, 0.0016), 0.0268, S, 0.045, 0, H, 0);                                                                    // windage turret
  B.add(A, cyl(0.0132, 0.012, 16, 0.0016), -0.0258, S, 0.045, 0, H, 0);                                                                   // parallax knob
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; B.add(FIN.white, rbox(0.0008, 0.0006, 0.0034, 0.0002), Math.cos(a) * 0.0114, S + 0.0222, 0.045 + Math.sin(a) * 0.0114); }
  { const l = cyl(0.026, 0.0012, 24, 0.0002); l.translate(0, S, 0); B.add(FINX.glassBlue, l, 0, 0, 0.251); const e = cyl(0.0185, 0.0012, 20, 0.0002); e.translate(0, S, 0); B.add(FIN.glassDark, e, 0, 0, -0.1225); }
  B.add(FIN.rubber, axisExtrude(roundRect(0, S, 0.047, 0.047, 0.0232, 7), -0.136, -0.123, 0.002, { holes: [circle(0.019, 16, 0, S)] }));  // eyecup

  // ---------------------------------------------------------------- bipod, folded forward under the fore-end
  B.add(A, rbox(0.036, 0.014, 0.03, 0.003), 0, -0.05, 0.405);
  for (const sx of [-1, 1]) {
    B.add(A, cyl(0.0062, 0.21, 12, 0.001), sx * 0.021, -0.056, 0.52);
    B.add(PH, cyl(0.0048, 0.07, 10, 0.0008), sx * 0.021, -0.056, 0.635);
    B.add(FIN.rubber, cyl(0.0082, 0.022, 12, 0.003), sx * 0.021, -0.056, 0.672);
    B.add(A, cyl(0.0084, 0.012, 12, 0.0012), sx * 0.021, -0.056, 0.42);
  }

  const body = B.build(mat);

  // ---------------------------------------------------------------- bolt (moves): body, shroud, handle with a ball knob. Origin on the bolt axis.
  const G = new PartBuilder();
  { const b = cyl(0.0098, 0.15, 14, 0.001); G.add(FIN.chrome, b, 0, 0, 0.02); }
  for (let k = 0; k < 5; k++) { const a = k * 1.2566; G.add(FIN.hole, rbox(0.0026, 0.001, 0.09, 0.0004), Math.cos(a) * 0.0096, Math.sin(a) * 0.0096, 0.03, 0, 0, a + H); }   // bolt flutes
  G.add(PH, cyl(0.0125, 0.03, 14, 0.002), 0, 0, -0.118);                                                                                  // shroud
  G.add(PH, rbox(0.03, 0.0085, 0.011, 0.003), 0.024, -0.004, -0.092, 0, 0, -0.24);                                                        // handle root
  G.add(PH, cyl(0.0048, 0.03, 10, 0.001), 0.047, -0.0105, -0.092, 0, H, 0);
  { const knob = new THREE.SphereGeometry(0.0118, 14, 10); G.add(FIN.poly, knob, 0.064, -0.014, -0.092); }
  const bolt = new THREE.Group(); bolt.position.set(0, BY, 0); bolt.add(G.build(mat));      // built round its own axis, then lifted into the action

  // ---------------------------------------------------------------- magazine (moves)
  const mp = SNIPER_DIM.magPivot, M = new PartBuilder();
  M.add(PH, sideExtrude([[0.041, -0.03], [0.04, -0.112], [0.1, -0.108], [0.104, -0.03]], 0.027, 0.003, { round: true }));
  M.add(FIN.poly, sideExtrude([[0.037, -0.108], [0.104, -0.104], [0.105, -0.116], [0.038, -0.12]], 0.031, 0.003, { round: true }));
  for (let i = 0; i < 2; i++) M.both(FIN.hole, () => rbox(0.0008, 0.03, 0.004, 0.0003), 0.0136, -0.085, 0.055 + i * 0.03);
  { const c = revolve([[0.046, 0], [0.046, 0.0074], [0.086, 0.0072], [0.094, 0.0048], [0.098, 0.0046]], 12); c.translate(0, -0.0262, 0); M.add(FIN.brass, c);
    const b = revolve([[0.098, 0.0044], [0.108, 0.0036], [0.116, 0.0012], [0.117, 0]], 12); b.translate(0, -0.0262, 0); M.add(FIN.copper, b); }
  const mag = pivoted(M.build(mat), mp);

  // ---------------------------------------------------------------- markings
  const D = new Decals(), name = D.label('KESTREL', { size: 56, weight: 700 }), cal = D.label('.338 MAG   IRONTIDE ARMS\nSER IT 090 415', { size: 26, weight: 600 });
  D.put(name, -0.02332, -0.03, 0.3, 0.0098, 'L'); D.put(name, 0.02332, -0.03, 0.3, 0.0098, 'R'); D.put(cal, -0.01722, BY - 0.002, 0.03, 0.0078, 'L');
  D.put(D.label('3-12×50', { size: 36 }), -0.01542, S + 0.002, 0.1, 0.0052, 'L');
  const decals = D.build();

  const group = new THREE.Group();
  group.add(body, mag, bolt, decals);
  return { group, body, mag, bolt, decals };
}
