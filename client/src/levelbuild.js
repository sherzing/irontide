// Turns level data (shared/levels/*.js) into renderable three.js objects.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getMaterial, loadTex, canvasTex, softDot, patchSurface, SURF_VERT_PARS, SURF_VERT, SURF_FRAG_PARS, surfUniforms } from './materials.js';
import { buildContainers } from './containers.js';
import { buildDressing } from './dressing.js';
import { G, COVER_MIN, COVER_RANGE } from './globals.js';
import { PROP_DEFS, CONTAINER } from '../../shared/props.js';

const gltf = new GLTFLoader();
const modelCache = new Map();
/** Loads a prop model. lod = the simplified version written by scripts/optimize-assets.mjs. */
export function loadModel(id, lod = false) {
  const key = id + (lod ? ':lod' : '');
  if (!modelCache.has(key)) {
    const url = (l) => (id.endsWith('.glb') ? `/assets/models/${id}` : `/assets/models/${id}/${id}${l ? '.lod' : ''}.gltf`);
    const prep = (g) => {
      g.scene.updateMatrixWorld(true);
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        if (Object.keys(o.geometry.morphAttributes).length) { o.geometry.morphAttributes = {}; o.morphTargetInfluences = undefined; }   // props are static: shape keys would only break instancing
        for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) if (o.material[k]) o.material[k].anisotropy = 8;
        // glTF transmission would make three.js render the whole scene a second time, every frame, for one lamp lens
        if (o.material.transmission > 0) { o.material.transmission = 0; o.material.thickness = 0; o.material.roughness = Math.min(o.material.roughness, 0.15); o.material.needsUpdate = true; }
        if (lod && !o.material.userData.wet) { o.material.userData.wet = true; patchSurface(o.material, { macro: false, dark: 0.8, wetRough: 0.55 }); }
      });
      return g;
    };
    modelCache.set(key, gltf.loadAsync(url(lod)).then(prep));
  }
  return modelCache.get(key);
}

/** Box with UVs in metres (so every surface gets the same texel density). */
function boxGeo(s, tile, color) {
  const [hx, hy, hz] = s.h, yaw = s.yaw || 0;
  const g = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  // world-anchored UVs for axis-aligned boxes so neighbouring pieces line up
  const ox = yaw ? 0 : s.c[0], oy = s.c[1], oz = yaw ? 0 : s.c[2];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + ox, y = pos.getY(i) + oy, z = pos.getZ(i) + oz;
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    if (nx > 0.5) uv.setXY(i, z / tile, y / tile);
    else if (ny > 0.5) uv.setXY(i, x / tile, z / tile);
    else uv.setXY(i, x / tile, y / tile);
  }
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw).setPosition(s.c[0], s.c[1], s.c[2]));
  return g;
}

/** Top-down height map of everything rain cannot fall through (roofs, containers, the ground). */
function buildCover(level, extraContainers) {
  const b = level.bounds, pad = 8, cell = 0.25;
  const x0 = b.minX - pad, z0 = b.minZ - pad, w = Math.ceil((b.maxX - b.minX + pad * 2) / cell), h = Math.ceil((b.maxZ - b.minZ + pad * 2) / cell);
  const hgt = new Float32Array(w * h).fill(level.env.water ? level.env.water.y : (b.groundY ?? 0));
  const stamp = (cx, cz, hx, hz, yaw, top) => {
    const cs = Math.cos(yaw), sn = Math.sin(yaw), ex = Math.abs(hx * cs) + Math.abs(hz * sn), ez = Math.abs(hx * sn) + Math.abs(hz * cs);
    const i0 = Math.max(0, Math.floor((cx - ex - x0) / cell)), i1 = Math.min(w - 1, Math.ceil((cx + ex - x0) / cell));
    const j0 = Math.max(0, Math.floor((cz - ez - z0) / cell)), j1 = Math.min(h - 1, Math.ceil((cz + ez - z0) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = x0 + (i + 0.5) * cell - cx, dz = z0 + (j + 0.5) * cell - cz, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
      if (Math.abs(lx) <= hx + cell * 0.5 && Math.abs(lz) <= hz + cell * 0.5 && top > hgt[j * w + i]) hgt[j * w + i] = top;
    }
  };
  for (const s of level.solids) if (s.cover !== false && !s.railing) stamp(s.c[0], s.c[2], s.h[0], s.h[2], s.yaw || 0, s.c[1] + s.h[1]);
  for (const c of [...level.containers, ...extraContainers]) stamp(c.x, c.z, CONTAINER.L / 2, CONTAINER.W / 2, c.yaw || 0, (c.y || 0) + CONTAINER.H);
  const data = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i++) data[i] = Math.max(0, Math.min(255, Math.round(((hgt[i] - COVER_MIN) / COVER_RANGE) * 255)));
  const tex = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  const at = (x, z) => { const i = Math.floor((x - x0) / cell), j = Math.floor((z - z0) / cell); return i < 0 || j < 0 || i >= w || j >= h ? -1e3 : hgt[j * w + i]; };
  return { tex, rect: new THREE.Vector4(x0, z0, 1 / (w * cell), 1 / (h * cell)), at };
}

export async function buildLevel(level, engine, onProgress = () => {}) {
  const root = new THREE.Group(); root.name = 'level';
  const out = { root, pickups: [], tagged: {}, lights: [], glow: [], cover: null, update: () => {} };
  const white = new THREE.Color(1, 1, 1);
  const propModels = [...new Set(level.props.map((p) => p.model))];
  let done = 0; const total = new Set(level.solids.map((s) => s.mat)).size + propModels.length + 5;
  const step = () => onProgress(++done / total);

  // ---- static solids, merged per material
  const groups = new Map();
  const add = (mat, geo) => { if (!groups.has(mat)) groups.set(mat, []); groups.get(mat).push(geo); };
  const matKeys = new Set(level.solids.filter((s) => s.visible !== false).map((s) => s.mat));
  const mats = {};
  await Promise.all([...matKeys].map(async (k) => { mats[k] = await getMaterial(k); step(); }));
  for (const s of level.solids) {
    if (s.visible === false) continue;
    add(s.mat, boxGeo(s, mats[s.mat].userData.tile, s.tint ? new THREE.Color(s.tint) : white));
  }
  for (const [k, geos] of groups) {
    const m = new THREE.Mesh(mergeGeometries(geos, false), mats[k]);
    m.castShadow = true; m.receiveShadow = true; m.name = 'solid:' + k;
    root.add(m);
    geos.forEach((g) => g.dispose());
  }

  // ---- scenery (cranes, ship, backdrop …) and containers
  const dress = await buildDressing(level.dressing, root); step();
  const all = [...level.containers.filter((c) => c.visible !== false), ...dress.containers];
  root.add(await buildContainers(all.filter((c) => c.shadow !== false), { castShadow: true }));
  root.add(await buildContainers(all.filter((c) => c.shadow === false), { castShadow: false })); step();

  // ---- props: one instanced mesh per model part
  const models = {};
  await Promise.all(propModels.map(async (id) => { models[id] = await loadModel(id, true); step(); }));
  const M = new THREE.Matrix4(), A = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const byModel = new Map();
  // large levels: instances are split into tiles so that the camera can cull what it does not see
  const lb = level.bounds, TILE = Math.max(lb.maxX - lb.minX, lb.maxZ - lb.minZ) > 110 ? 60 : 0;
  for (const p of level.props) {
    const def = PROP_DEFS[p.model], s = (p.scale || 1) * (def.scale || 1);
    M.makeRotationY(p.yaw || 0).setPosition(p.x, p.y, p.z);
    A.compose(new THREE.Vector3(0, -(p.lay ? def.min[2] : def.min[1]) * s, 0), q.setFromEuler(e.set(p.lay ? -Math.PI / 2 : 0, 0, 0)), new THREE.Vector3(s, s, s));
    const m = M.clone().multiply(A);
    const key = p.model + (TILE ? `|${Math.floor(p.x / TILE)},${Math.floor(p.z / TILE)}` : '');
    if (!byModel.has(key)) byModel.set(key, { id: p.model, list: [] });
    byModel.get(key).list.push(m);
    if (p.tag) { const o = new THREE.Object3D(); o.position.set(p.x, p.y, p.z); o.rotation.y = p.yaw || 0; root.add(o); out.tagged[p.tag] = o; }
  }
  for (const { id, list } of byModel.values()) {
    models[id].scene.traverse((o) => {
      if (!o.isMesh) return;
      const im = new THREE.InstancedMesh(o.geometry, o.material, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, A.multiplyMatrices(m, o.matrixWorld)));
      im.castShadow = true; im.receiveShadow = true; im.name = 'prop:' + id;
      if (TILE) im.computeBoundingSphere(); else im.frustumCulled = false;
      root.add(im);
    });
  }

  // ---- lights: the most important ones are real point lights, all of them glow in the haze
  const lights = [...level.lights, ...dress.lights].map((l, i) => ({ ...l, order: (l.priority ?? 0) * 1000 - i })).sort((a, b) => b.order - a.order);
  const dot = softDot();
  lights.forEach((l, i) => {
    if (i < engine.q.lights) {
      const pl = new THREE.PointLight(l.color, l.intensity, l.dist, 1.8);
      pl.position.set(...l.pos);
      if (l.shadow === true && engine.q.pointShadows && out.lights.filter((x) => x.castShadow).length < 2) { pl.castShadow = true; pl.shadow.mapSize.set(512, 512); pl.shadow.bias = -0.002; }
      root.add(pl); out.lights.push(pl);
    }
    if (l.bulb !== false) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(l.color).multiplyScalar(14), toneMapped: false }));
      bulb.position.set(...l.pos); root.add(bulb);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: new THREE.Color(l.color).multiplyScalar(1.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45, toneMapped: false }));
      halo.scale.setScalar(1.3); halo.position.set(...l.pos); engine.fx.add(halo); out.halos = (out.halos || []).concat(halo);
    }
    out.glow.push({ pos: l.pos, color: l.color, intensity: l.intensity * (l.glow ?? 1), range: l.range ?? Math.min(l.dist * 0.4, 7) });
  });

  // ---- decals: painted lines, hazard hatching, stains
  // road paint worn by traffic: fine pitting, a few scuffs along the travel direction, thin cracks
  const worn = (g, s, color) => {
    g.fillStyle = color; g.fillRect(0, 0, s, s);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9000; i++) { g.globalAlpha = Math.random() * 0.55; const r = Math.random() * 1.6 + 0.3; g.beginPath(); g.arc(Math.random() * s, Math.random() * s, r, 0, 7); g.fill(); }
    for (let i = 0; i < 26; i++) { g.globalAlpha = 0.25 + Math.random() * 0.4; g.fillRect(Math.random() * s, Math.random() * s, 20 + Math.random() * 70, 1 + Math.random() * 4); }
    g.strokeStyle = '#000'; g.lineWidth = 1.2;
    for (let i = 0; i < 10; i++) { g.globalAlpha = 0.7; let x = Math.random() * s, y = Math.random() * s; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 9; k++) { x += (Math.random() - 0.5) * 30; y += Math.random() * 22; g.lineTo(x, y); } g.stroke(); }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  };
  const decalMats = {};
  const decalMat = (kind, color) => {
    const key = kind + color;
    if (decalMats[key]) return decalMats[key];
    let map;
    if (kind === 'line') map = canvasTex(512, (g, s) => worn(g, s, color));
    else if (kind === 'hatch') map = canvasTex(512, (g, s) => {
      g.strokeStyle = color; g.lineWidth = 44;
      for (let i = -s; i < s * 2; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke(); }
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 9000; i++) { g.globalAlpha = Math.random() * 0.55; g.beginPath(); g.arc(Math.random() * s, Math.random() * s, Math.random() * 1.8 + 0.3, 0, 7); g.fill(); }
      for (let i = 0; i < 30; i++) { g.globalAlpha = 0.3 + Math.random() * 0.4; g.fillRect(Math.random() * s, Math.random() * s, 20 + Math.random() * 80, 1 + Math.random() * 5); }
    });
    else map = canvasTex(256, (g, s) => {
      for (let i = 0; i < 26; i++) {
        const x = s / 2 + (Math.random() - 0.5) * s * 0.5, y = s / 2 + (Math.random() - 0.5) * s * 0.5, r = s * (0.08 + Math.random() * 0.2);
        const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(12,10,8,0.5)'); gr.addColorStop(1, 'rgba(12,10,8,0)');
        g.fillStyle = gr; g.fillRect(0, 0, s, s);
      }
    });
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    const m = new THREE.MeshStandardMaterial({ map, transparent: true, roughness: kind === 'stain' ? 0.25 : 0.7, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    return (decalMats[key] = patchSurface(m, { macro: false, planar: true, dark: 0.8, wetRough: 0.45 }));
  };
  const decalGeos = new Map();                                    // one mesh per paint, however many marks a level has
  for (const d of level.decals) {
    const g = new THREE.PlaneGeometry(d.w, d.d);
    if (d.kind !== 'stain') { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * d.w / 2, uv.getY(i) * d.d / 2); }
    g.applyMatrix4(M.makeRotationFromEuler(e.set(-Math.PI / 2, 0, d.yaw || 0)).setPosition(d.x, (d.y || 0) + 0.006 + (d.kind === 'stain' ? 0.002 : 0), d.z));
    const mat = decalMat(d.kind, d.color || '#000');
    if (!decalGeos.has(mat)) decalGeos.set(mat, []);
    decalGeos.get(mat).push(g);
  }
  for (const [mat, geos] of decalGeos) {
    const m = new THREE.Mesh(mergeGeometries(geos, false), mat);
    m.receiveShadow = true; m.renderOrder = 1; m.name = 'decals'; root.add(m);
    geos.forEach((g) => g.dispose());
  }

  // ---- water
  if (level.env.water) {
    const wn = await loadTex('waternormals');
    const wm = new THREE.MeshStandardMaterial({ color: level.env.water.color, roughness: 0.07, metalness: 0.0, normalMap: wn, normalScale: new THREE.Vector2(0.55, 0.55), envMapIntensity: 1.25 });
    wm.onBeforeCompile = (sh) => {
      surfUniforms(sh);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + SURF_VERT_PARS).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SURF_VERT);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + SURF_FRAG_PARS)
        .replace('#include <normal_fragment_maps>', `
          vec2 wuv = vWPos.xz;
          vec3 n1 = texture2D(normalMap, wuv * 0.035 + vec2(uTime * 0.012, uTime * 0.008)).xyz * 2.0 - 1.0;
          vec3 n2 = texture2D(normalMap, wuv * 0.11 + vec2(-uTime * 0.02, uTime * 0.016)).xyz * 2.0 - 1.0;
          vec3 n3 = texture2D(normalMap, wuv * 0.41 + vec2(uTime * 0.03, -uTime * 0.035)).xyz * 2.0 - 1.0;
          float vd = length(vViewPosition), farFade = 1.0 / (1.0 + vd * 0.012);
          vec2 rr = (uRain > 0.0 && vd < 45.0) ? ripples(wuv * 1.3, uTime) * uRain * 0.22 * (1.0 - vd / 45.0) : vec2(0.0);
          vec3 mapN = normalize(vec3((n1.xy + n2.xy * 0.8 + n3.xy * 0.5 * farFade) * normalScale * farFade * 1.4 + n1.xy * 0.12 + rr, 1.0));
          normal = normalize(tbn * mapN);`);
    };
    wm.customProgramCacheKey = () => 'water';
    const water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), wm);
    water.rotation.x = -Math.PI / 2; water.position.y = level.env.water.y; water.receiveShadow = true; water.name = 'water';
    root.add(water);
  }
  step();

  // ---- pickups
  const ammo = await loadModel('ammo_box'); step();
  for (const p of level.pickups) {
    const g = new THREE.Group();
    const m = ammo.scene.clone(true); m.scale.setScalar(1.9); g.add(m);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.4, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.7, 1.5), transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
    g.position.set(p.x, p.y + 0.02, p.z);
    root.add(g); out.pickups.push({ group: g, model: m, ring });
  }

  // ---- what the rain can reach
  out.cover = buildCover(level, dress.containers); step();

  out.update = (t) => {
    dress.update?.(t);
    for (let i = 0; i < out.pickups.length; i++) {
      const p = out.pickups[i];
      if (!p.group.visible) continue;
      p.model.rotation.y = t * 1.2 + i; p.model.position.y = 0.32 + Math.sin(t * 2 + i) * 0.05;
      p.ring.material.opacity = 0.45 + Math.sin(t * 3 + i) * 0.2;
    }
  };
  /** Makes this level the active one: shared uniforms, haze lights. */
  out.activate = () => { G.tCover.value = out.cover.tex; G.uCover.value.copy(out.cover.rect); engine.setGlowLights(out.glow); for (const h of out.halos || []) h.visible = true; };
  out.deactivate = () => { for (const h of out.halos || []) h.visible = false; };
  out.activate();
  engine.scene.add(root);
  return out;
}
