// Small authoring kit for levels. A level is plain data; these helpers just make writing it pleasant.
// Coordinates: +x east, +z south, +y up, metres. Yaw in degrees in the helpers (stored as radians).
export const rad = (d) => (d * Math.PI) / 180;

export function createKit() {
  const L = { solids: [], containers: [], props: [], lights: [], decals: [], pickups: [], dressing: [] };

  /** Axis-aligned box from min/max extents. */
  const box = (x0, z0, x1, z1, y0, y1, mat, o = {}) => {
    const s = { c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], h: [Math.abs(x1 - x0) / 2, (y1 - y0) / 2, Math.abs(z1 - z0) / 2], mat, surf: o.surf || SURF[mat] || 'concrete', ...o };
    L.solids.push(s); return s;
  };
  /** Rotated box: centre (x,z), size w×d, from y0 with height h. */
  const rbox = (x, z, w, d, y0, h, yawDeg, mat, o = {}) => {
    const s = { c: [x, y0 + h / 2, z], h: [w / 2, h / 2, d / 2], yaw: rad(yawDeg), mat, surf: o.surf || SURF[mat] || 'concrete', ...o };
    L.solids.push(s); return s;
  };
  /** Wall along X (at z) or along Z (at x) with rectangular openings [{a,b,y0,y1}] in wall coordinates. */
  const wall = (axis, at, from, to, y0, y1, th, mat, openings = [], o = {}) => {
    const piece = (a, b, ya, yb) => {
      if (b - a < 0.01 || yb - ya < 0.01) return;
      if (axis === 'x') box(a, at - th / 2, b, at + th / 2, ya, yb, mat, o);
      else box(at - th / 2, a, at + th / 2, b, ya, yb, mat, o);
    };
    let cur = from;
    for (const op of [...openings].sort((p, q) => p.a - q.a)) {
      piece(cur, op.a, y0, y1);
      piece(op.a, op.b, y0, op.y0 ?? y0);
      piece(op.a, op.b, op.y1 ?? y1, y1);
      cur = op.b;
    }
    piece(cur, to, y0, y1);
  };
  /** Stairs rising along +dir ('x+','x-','z+','z-') starting at (x,z) = centre of the first tread. */
  const stairs = (x, z, dir, width, rise, n, mat = 'plate', run = 0.34) => {
    const [dx, dz] = { 'x+': [1, 0], 'x-': [-1, 0], 'z+': [0, 1], 'z-': [0, -1] }[dir];
    const hgt = rise / n;
    for (let i = 0; i < n; i++) {
      const cx = x + dx * run * i, cz = z + dz * run * i;
      const hw = dx ? run / 2 : width / 2, hd = dz ? run / 2 : width / 2;
      box(cx - hw, cz - hd, cx + hw, cz + hd, 0, hgt * (i + 1), mat);
    }
  };
  const container = (x, z, yawDeg, color, o = {}) => { const c = { x, z, y: 0, yaw: rad(yawDeg), color, ...o }; L.containers.push(c); return c; };
  const prop = (model, x, z, yawDeg = 0, o = {}) => { const p = { model, x, y: 0, z, yaw: rad(yawDeg), ...o }; L.props.push(p); return p; };
  const light = (x, y, z, color = 0xffc58a, intensity = 30, dist = 14, o = {}) => L.lights.push({ pos: [x, y, z], color, intensity, dist, ...o });
  const decal = (kind, x, z, w, d, yawDeg = 0, o = {}) => L.decals.push({ kind, x, z, w, d, yaw: rad(yawDeg), ...o });
  const pickup = (kind, x, z, y = 0) => L.pickups.push({ kind, x, y, z });
  const spawn = (x, z, yawDeg = 0) => ({ x, y: 0, z, yaw: rad(yawDeg) });
  /** Visual-only scenery built by client/src/dressing.js (gantry, ship, stsCrane, stacks, sign, lightMast …). yaw in degrees. */
  const dress = (type, o = {}) => { const d = { type, ...o, yaw: rad(o.yaw || 0) }; L.dressing.push(d); return d; };
  /** Stack of n timber pallets with a matching collider. */
  const pallets = (x, z, yawDeg = 0, n = 4) => { dress('pallets', { at: [[x, z, yawDeg, n]] }); rbox(x, z, 1.2, 0.8, 0, n * 0.146, yawDeg, 'wood', { visible: false }); };
  return { L, box, rbox, wall, stairs, container, prop, light, decal, pickup, spawn, dress, pallets };
}

// default bullet-impact / footstep surface per material
export const SURF = {
  ground: 'concrete', asphalt: 'concrete', wall: 'concrete', painted: 'concrete', plaster_in: 'concrete', floor_in: 'concrete',
  brick: 'concrete', gravel: 'dirt', corrugated: 'metal', rust: 'metal', plate: 'metal', steel: 'metal', grid: 'metal',
  wood: 'wood', container: 'metal',
};
