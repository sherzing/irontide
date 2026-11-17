// Weapon tuning shared by client, bots and server validation.
const D = Math.PI / 180;
export const WEAPONS = {
  carbine: {
    slot: 0, name: 'VK-7 Carbine', auto: true, rpm: 720, dmg: 24, head: 1.8, legs: 0.8,
    mag: 30, reserve: 150, reload: 2.1, range: 120, falloff: [25, 70, 0.6],
    spread: 1.5 * D, adsSpread: 0.12 * D, moveSpread: 1.2 * D, bloom: 0.22 * D, maxBloom: 1.6 * D,
    recoil: [0.95 * D, 0.38 * D], adsFov: 52, adsTime: 0.2, drawTime: 0.45,
  },
  marksman: {
    slot: 1, name: 'Kestrel 7.62', auto: false, rpm: 46, dmg: 82, head: 2.2, legs: 0.8,
    mag: 5, reserve: 30, reload: 2.9, range: 250, falloff: [80, 200, 0.85],
    spread: 3.2 * D, adsSpread: 0.02 * D, moveSpread: 2.5 * D, bloom: 0, maxBloom: 0,
    recoil: [2.8 * D, 0.6 * D], adsFov: 22, adsTime: 0.3, drawTime: 0.6, bolt: true,
  },
  pistol: {
    slot: 2, name: 'P-9 Service', auto: false, rpm: 420, dmg: 30, head: 1.7, legs: 0.8,
    mag: 12, reserve: 72, reload: 1.5, range: 70, falloff: [15, 45, 0.5],
    spread: 1.1 * D, adsSpread: 0.25 * D, moveSpread: 0.7 * D, bloom: 0.4 * D, maxBloom: 2 * D,
    recoil: [1.5 * D, 0.5 * D], adsFov: 60, adsTime: 0.14, drawTime: 0.3,
  },
};
export const WEAPON_ORDER = ['carbine', 'marksman', 'pistol'];

export function damageAt(w, dist, zone) {
  const [a, b, min] = w.falloff;
  const k = dist <= a ? 1 : dist >= b ? min : 1 - (1 - min) * ((dist - a) / (b - a));
  const z = zone === 'head' ? w.head : zone === 'legs' ? w.legs : 1;
  return Math.round(w.dmg * k * z);
}
