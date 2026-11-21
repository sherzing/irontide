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
  const wallWith = (bx) => (axis, at, from, to, y0, y1, th, mat, openings = [], o = {}) => {
    const piece = (a, b, ya, yb) => {
      if (b - a < 0.01 || yb - ya < 0.01) return;
      if (axis === 'x') bx(a, at - th / 2, b, at + th / 2, ya, yb, mat, o);
      else bx(at - th / 2, a, at + th / 2, b, ya, yb, mat, o);
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
  /** Stairs rising along +dir ('x+','x-','z+','z-') starting at (x,z) = centre of the first tread. y0 = the floor they start on. */
  const stairsWith = (bx) => (x, z, dir, width, rise, n, mat = 'plate', run = 0.34, y0 = 0) => {
    const [dx, dz] = { 'x+': [1, 0], 'x-': [-1, 0], 'z+': [0, 1], 'z-': [0, -1] }[dir];
    const hgt = rise / n;
    for (let i = 0; i < n; i++) {
      const cx = x + dx * run * i, cz = z + dz * run * i;
      const hw = dx ? run / 2 : width / 2, hd = dz ? run / 2 : width / 2;
      bx(cx - hw, cz - hd, cx + hw, cz + hd, y0, y0 + hgt * (i + 1), mat);
    }
  };
  const wall = wallWith(box), stairs = stairsWith(box);
  /**
   * A local frame at (ox, oz) turned by yawDeg: the same box / wall / stairs helpers in its own coordinates, for
   * anything that should not sit square to the map (a beached hull, a parked aircraft). pt(lx, lz) gives world [x, z].
   */
  const frame = (ox, oz, yawDeg = 0) => {
    const a = rad(yawDeg), cs = Math.cos(a), sn = Math.sin(a);
    const pt = (lx, lz) => [ox + lx * cs + lz * sn, oz - lx * sn + lz * cs];
    const fbox = (x0, z0, x1, z1, y0, y1, mat, o = {}) => { const [x, z] = pt((x0 + x1) / 2, (z0 + z1) / 2); return rbox(x, z, Math.abs(x1 - x0), Math.abs(z1 - z0), y0, y1 - y0, yawDeg, mat, o); };
    /** A box turned by localYawDeg inside the frame: centre (lx, lz), size w x d, from y0 with height h. */
    const frbox = (lx, lz, w, d, y0, h, localYawDeg, mat, o = {}) => { const [x, z] = pt(lx, lz); return rbox(x, z, w, d, y0, h, yawDeg + localYawDeg, mat, o); };
    /** World (x, z) -> the frame's own [lx, lz]. */
    const local = (wx, wz) => { const dx = wx - ox, dz = wz - oz; return [dx * cs - dz * sn, dx * sn + dz * cs]; };
    return { box: fbox, rbox: frbox, wall: wallWith(fbox), stairs: stairsWith(fbox), pt, local, yaw: yawDeg, x: ox, z: oz };
  };
  const container = (x, z, yawDeg, color, o = {}) => { const c = { x, z, y: 0, yaw: rad(yawDeg), color, ...o }; L.containers.push(c); return c; };
  const prop = (model, x, z, yawDeg = 0, o = {}) => { const p = { model, x, y: 0, z, yaw: rad(yawDeg), ...o }; L.props.push(p); return p; };
  const light = (x, y, z, color = 0xffc58a, intensity = 30, dist = 14, o = {}) => L.lights.push({ pos: [x, y, z], color, intensity, dist, ...o });
  const decal = (kind, x, z, w, d, yawDeg = 0, o = {}) => L.decals.push({ kind, x, z, w, d, yaw: rad(yawDeg), ...o });
  const pickup = (kind, x, z, y = 0) => L.pickups.push({ kind, x, y, z });
  /** Spawn point. facing = compass bearing in degrees the player looks along: 0 = north (-z), 90 = east (+x), 180 = south. y = the floor it stands on. */
  const spawn = (x, z, facing = 0, y = 0) => ({ x, y, z, yaw: rad(-facing) });
  /** Visual-only scenery built by client/src/dressing.js (gantry, ship, stsCrane, stacks, sign, lightMast …). yaw in degrees. */
  const dress = (type, o = {}) => { const d = { type, ...o, yaw: rad(o.yaw || 0) }; L.dressing.push(d); return d; };
  /** Stack of n timber pallets with a matching collider. */
  const pallets = (x, z, yawDeg = 0, n = 4) => { dress('pallets', { at: [[x, z, yawDeg, n]] }); rbox(x, z, 1.2, 0.8, 0, n * 0.146, yawDeg, 'wood', { visible: false }); };
  return { L, box, rbox, wall, stairs, frame, container, prop, light, decal, pickup, spawn, dress, pallets };
}

// default bullet-impact / footstep surface per material
export const SURF = {
  ground: 'concrete', asphalt: 'concrete', wall: 'concrete', painted: 'concrete', plaster_in: 'concrete', floor_in: 'concrete',
  brick: 'concrete', gravel: 'dirt', corrugated: 'metal', rust: 'metal', plate: 'metal', steel: 'metal', grid: 'metal',
  wood: 'wood', container: 'metal', pavement: 'concrete',
  sand: 'dirt', wetsand: 'dirt', grass: 'dirt', runway: 'concrete', hangarfloor: 'concrete', apron: 'concrete', plaster: 'concrete', hull: 'metal', antifoul: 'metal', cladding: 'metal',
  cobbles: 'concrete', limewash: 'concrete', slate: 'concrete', timber: 'wood',
};
