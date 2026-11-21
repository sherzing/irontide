// Weapon tuning shared by client, bots and server validation.
// spread / adsSpread / moveSpread: half-angle of the cone a shot leaves in (hip, sights up, added at walking speed).
// bloom: added per shot while the trigger is worked, up to maxBloom. recoil: [up, side] the view is kicked per shot;
// climb: the most one burst lifts the view. scripts/ballistics.mjs prints what a table of these does to a target.
const D = Math.PI / 180;
export const WEAPONS = {
  carbine: {
    slot: 0, name: 'VK-7 Carbine', auto: true, rpm: 720, dmg: 24, head: 1.8, legs: 0.8,
    mag: 30, reserve: 150, reload: 2.1, range: 120, falloff: [25, 70, 0.6],
    spread: 1.5 * D, adsSpread: 0.12 * D, moveSpread: 1.2 * D, bloom: 0.22 * D, maxBloom: 1.6 * D,
    recoil: [0.5 * D, 0.2 * D], climb: 2.4 * D, adsFov: 52, adsTime: 0.2, drawTime: 0.45,
  },
  smg: {
    slot: 1, name: 'Halyard 45', auto: true, rpm: 620, dmg: 20, head: 1.6, legs: 0.8,
    mag: 25, reserve: 125, reload: 2.0, range: 70, falloff: [12, 40, 0.5],
    spread: 1.9 * D, adsSpread: 0.3 * D, moveSpread: 0.8 * D, bloom: 0.2 * D, maxBloom: 1.8 * D,
    recoil: [0.42 * D, 0.24 * D], climb: 2.2 * D, adsFov: 58, adsTime: 0.15, drawTime: 0.36,
  },
  // pellets: one trigger pull throws this many shots inside the spread cone; dmg is per pellet
  shotgun: {
    slot: 2, name: 'Marlin 12', auto: false, rpm: 190, pellets: 8, dmg: 14, head: 1.4, legs: 0.8,
    mag: 7, reserve: 35, reload: 3.1, range: 45, falloff: [7, 26, 0.2],
    spread: 2.7 * D, adsSpread: 2.2 * D, moveSpread: 0.5 * D, bloom: 0, maxBloom: 0,
    recoil: [2.6 * D, 0.7 * D], climb: 5 * D, adsFov: 62, adsTime: 0.2, drawTime: 0.5,
  },
  marksman: {
    slot: 3, name: 'Kestrel .338', auto: false, rpm: 46, dmg: 88, head: 2.2, legs: 0.8,
    mag: 5, reserve: 30, reload: 3.0, range: 250, falloff: [80, 200, 0.85],
    spread: 3.2 * D, adsSpread: 0.02 * D, moveSpread: 2.5 * D, bloom: 0, maxBloom: 0,
    recoil: [2.4 * D, 0.5 * D], climb: 4 * D, adsFov: 22, adsTime: 0.3, drawTime: 0.6, bolt: true,
  },
  pistol: {
    slot: 4, name: 'P-9 Service', auto: false, rpm: 420, dmg: 30, head: 1.7, legs: 0.8,
    mag: 15, reserve: 75, reload: 1.5, range: 70, falloff: [15, 45, 0.5],
    spread: 1.1 * D, adsSpread: 0.25 * D, moveSpread: 0.7 * D, bloom: 0.4 * D, maxBloom: 2 * D,
    recoil: [1.0 * D, 0.4 * D], climb: 3.2 * D, adsFov: 60, adsTime: 0.14, drawTime: 0.3,
  },
};
export const WEAPON_ORDER = ['carbine', 'smg', 'shotgun', 'marksman', 'pistol'];      // number keys 1-5, in this order

export function damageAt(w, dist, zone) {
  const [a, b, min] = w.falloff;
  const k = dist <= a ? 1 : dist >= b ? min : 1 - (1 - min) * ((dist - a) / (b - a));
  const z = zone === 'head' ? w.head : zone === 'legs' ? w.legs : 1;
  return Math.round(w.dmg * k * z);
}

// ---- aim: what a shot does. One copy for the client, its crosshair and scripts/ballistics.mjs -----------------------
/** Half-angle of the cone a shot leaves in, radians. s: { ads: 0..1 sights up, speed: m/s, bloom: rad, air, crouch } */
export function spreadOf(w, s) {
  let a = w.spread + (w.adsSpread - w.spread) * s.ads + w.moveSpread * Math.min(1, s.speed / 4.5) * (1 - s.ads * 0.6) + s.bloom * (1 - s.ads * 0.75);
  if (s.air) a += 0.05;
  return s.crouch ? a * 0.75 : a;
}
/** land, back: 1/s the kick reaches the view and leaves it again. ads, crouch: what they leave of the kick. */
export const RECOIL = { land: 28, back: 9, ads: 0.72, crouch: 0.85 };
/** Seconds after a shot before the view starts back: never between two shots of a held trigger. */
const rest = (w) => (w.auto ? 60 / w.rpm + 0.04 : 0.1);
/** A player's recoil: p, y = kick still to land; up, side = kick in the view that will come back; sum, drift = what this burst has kicked so far. */
export const newRecoil = () => ({ p: 0, y: 0, up: 0, side: 0, sum: 0, drift: 0, bloom: 0 });
/** One shot. The view climbs w.climb in a burst and then only wobbles; the side kick pulls back towards the middle. */
export function kick(w, r, ads, crouch, rnd = Math.random) {
  const k = (ads > 0.5 ? RECOIL.ads : 1) * (crouch ? RECOIL.crouch : 1), full = w.recoil[0] * k * (0.85 + rnd() * 0.3), room = w.climb * k - r.sum;
  const up = room > full ? full : room + (rnd() - 0.5) * 0.4 * full, side = (rnd() - 0.5) * 2 * w.recoil[1] * k - r.drift * 0.25;
  r.p += up; r.sum += up; r.y += side; r.drift += side;
  r.bloom = Math.min(w.maxBloom, r.bloom + w.bloom);
}
/** Advances the recoil by dt and returns [pitch, yaw] to add to the view. since: seconds since the last shot. */
export function recoilStep(w, r, dt, since) {
  const a = Math.min(1, dt * RECOIL.land), ap = r.p * a, ay = r.y * a;
  r.p -= ap; r.y -= ay; r.up += ap; r.side += ay;
  if (since <= rest(w)) return [ap, ay];
  const b = Math.min(1, dt * RECOIL.back), bp = r.up * b, by = r.side * b;      // the trigger rests: the view comes back to where it was
  r.up -= bp; r.side -= by; r.sum -= r.sum * b; r.drift -= r.drift * b; r.bloom -= r.bloom * b;
  return [ap - bp, ay - by];
}
/** The player moved the view by (dp, dy) themselves. What they have pulled back already is not given back a second time. */
export function recoilPulled(r, dp, dy) {
  if (dp < 0) r.up = Math.max(0, r.up + dp);
  if (dy * r.side < 0) r.side = Math.abs(dy) >= Math.abs(r.side) ? 0 : r.side + dy;
}
