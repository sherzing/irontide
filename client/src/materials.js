// PBR material library built from Poly Haven texture sets (diff / nor_gl / arm), plus the shared
// "weathered surface" shader patch: tiling break-up, grime, rain wetness, puddles and planar reflections.
import * as THREE from 'three';
import { G, COVER_MIN, COVER_RANGE } from './globals.js';

const loader = new THREE.TextureLoader();
const cache = new Map();
let aniso = 8;
export const setAnisotropy = (a) => { aniso = a; for (const p of cache.values()) p.then((t) => { t.anisotropy = a; t.needsUpdate = true; }); };

export function loadTex(file, srgb = false) {
  const key = file + (srgb ? ':s' : '');
  if (!cache.has(key)) {
    cache.set(key, loader.loadAsync('/assets/tex/' + file).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }));
  }
  return cache.get(key);
}

/** Greyscale, mean-normalised copy of a colour texture so it can be tinted per-vertex. */
function grayCopy(tex) {
  const img = tex.image, c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  let sum = 0;
  for (let i = 0; i < p.length; i += 4) { const l = 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]; p[i] = l; sum += l; }
  const k = 190 / (sum / (p.length / 4));
  for (let i = 0; i < p.length; i += 4) { const l = Math.min(255, p[i] * k); p[i] = p[i + 1] = p[i + 2] = l; }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// material key -> texture set + look. `tile` = metres covered by one texture repeat.
// ground: puddles + slab joints · planar: may show the planar reflection · dark: albedo multiplier when soaked
export const MATS = {
  ground: { id: 'asphalt_02', tile: 3.0, ground: true, planar: true, dark: 0.5 },
  asphalt: { id: 'asphalt_02', tile: 3, ground: true, planar: true, dark: 0.5 },
  pavement: { id: 'concrete_pavement_02', tile: 3.2, ground: true, planar: true, dark: 0.6 },
  wall: { id: 'concrete_wall_008', tile: 3.2, dark: 0.66 },
  painted: { id: 'painted_concrete', tile: 2.6, dark: 0.75 },
  plaster_in: { id: 'concrete_wall_008', tile: 2.6, env: 0.22, color: 0xcfc8b8 },
  floor_in: { id: 'concrete_floor_worn_001', tile: 2.6, env: 0.22 },
  brick: { id: 'red_brick_03', tile: 1.5, dark: 0.68 },
  gravel: { id: 'gravel_concrete_03', tile: 2.4, planar: true, dark: 0.55 },
  corrugated: { id: 'corrugated_iron_02', tile: 2.2, env: 0.75, dark: 0.85 },
  rust: { id: 'rusty_metal_02', tile: 2.0, dark: 0.8 },
  plate: { id: 'metal_plate', tile: 1.4, dark: 0.85 },
  steel: { id: 'rusty_metal_02', tile: 2.4, color: 0x6f7377, gray: true, dark: 0.85 },
  paint: { id: 'rusty_metal_02', tile: 3.4, gray: true, dark: 0.88, rough: 0.8, metal: 0.25 },   // painted structural steel / hull plating, tinted per vertex
  grid: { id: 'rusty_metal_grid', tile: 1.0, dark: 0.85 },
  wood: { id: 'wood_planks_grey', tile: 2.2, planar: true, dark: 0.55 },
  container: { id: 'container_side', tile: 2.59, gray: true, dark: 0.85 },
  // soft = natural or rolled ground: no slab joints
  sand: { id: 'coast_sand_01', tile: 4.2, ground: true, soft: true, dark: 0.62 },
  wetsand: { id: 'damp_beach_sand', tile: 5.5, ground: true, soft: true, dark: 0.62, rough: 0.55 },
  grass: { id: 'sparse_grass', tile: 3.6, ground: true, soft: true, dark: 0.7 },
  runway: { id: 'aerial_asphalt_01', tile: 16, ground: true, soft: true, planar: true, dark: 0.5 },
  hangarfloor: { id: 'hangar_concrete_floor', tile: 4, ground: true, planar: true, dark: 0.6, env: 0.5 },
  apron: { id: 'concrete_floor_worn_001', tile: 5.5, ground: true, planar: true, dark: 0.6, rough: 1.25 },   // cast concrete in 7 m bays
  plaster: { id: 'concrete_wall_008', tile: 3.0, dark: 0.7 },                                  // rendered outside wall, tinted per box
  hull: { id: 'rusty_metal_sheet', tile: 3.4, dark: 0.85 },                            // ship plating: grey paint going to rust
  antifoul: { id: 'rusty_painted_metal', tile: 3.2, dark: 0.85 },                      // red bottom paint with rust runs
  cladding: { id: 'box_profile_metal_sheet', tile: 2.4, gray: true, env: 0.7, dark: 0.85 },   // profiled steel sheet, tinted per box
};

export const NOISE = /* glsl */`
  float h21(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

// ---- GLSL shared by every weathered surface (also used by the container shader) ----------------
export const SURF_VERT_PARS = 'varying vec3 vWPos; varying vec3 vWNrm;';
export const SURF_VERT = /* glsl */`
  { vec4 wp4 = vec4(transformed, 1.0); vec3 wn3 = objectNormal;
    #ifdef USE_INSTANCING
      wp4 = instanceMatrix * wp4; wn3 = mat3(instanceMatrix) * wn3;
    #endif
    vWPos = (modelMatrix * wp4).xyz; vWNrm = normalize(mat3(modelMatrix) * wn3); }`;
export const SURF_FRAG_PARS = /* glsl */`
  varying vec3 vWPos; varying vec3 vWNrm;
  uniform float uTime, uWet, uRain, uReflOn, uReflY; uniform sampler2D tCover, tRefl; uniform vec4 uCover; uniform mat4 uReflMat;
  ${NOISE}
  float gWet = 0.0, gPuddle = 0.0, gUp = 0.0;
  float coverY(vec2 xz){ return texture2D(tCover, (xz - uCover.xy) * uCover.zw).r * ${COVER_RANGE.toFixed(1)} + (${COVER_MIN.toFixed(1)}); }
  // 1 where rain can reach this fragment (nothing above it), 0 under a roof
  float rainExposure(vec3 p, vec3 n){ return smoothstep(1.0, 0.4, coverY(p.xz + n.xz * 0.45) - p.y); }
  vec2 ripples(vec2 p, float t){
    vec2 acc = vec2(0.0);
    for (int k = 0; k < 2; k++) {
      vec2 q = p * (k == 0 ? 1.0 : 1.73) + float(k) * 13.1; vec2 cell = floor(q), f = fract(q);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 o = vec2(float(i), float(j)), id = cell + o; float h = h21(id + float(k) * 7.3);
        vec2 c = o + vec2(h21(id + 3.1), h21(id + 5.7)) - f;
        float tt = fract(t * (0.75 + h * 0.5) + h * 9.0), d = length(c), r = tt * 0.85;
        acc += (c / max(d, 0.001)) * sin((d - r) * 38.0) * smoothstep(0.09, 0.0, abs(d - r)) * (1.0 - tt) * (1.0 - tt);
      }
    }
    return acc;
  }`;
export const surfUniforms = (sh) => { for (const k of ['uTime', 'uWet', 'uRain', 'uReflOn', 'uReflY', 'tCover', 'tRefl', 'uCover', 'uReflMat']) sh.uniforms[k] = G[k]; };
// planar reflection replaces the environment-map radiance on flat ground near the mirror height
export const PLANAR_FRAG = /* glsl */`
  if (uReflOn > 0.5) {
    vec3 wn = inverseTransformDirection(geometryNormal, viewMatrix);
    float pw = smoothstep(0.7, 0.96, wn.y) * step(abs(vWPos.y - uReflY), 0.25) * smoothstep(0.8, 0.5, material.roughness);
    if (pw > 0.0) {
      vec4 rc = uReflMat * vec4(vWPos + vec3(wn.x, 0.0, wn.z) * 0.9, 1.0);
      radiance = mix(radiance, textureLod(tRefl, rc.xy / rc.w, material.roughness * 8.0).rgb, pw);
    }
  }`;

/**
 * Patches a MeshStandardMaterial with world-space weathering and weather response.
 * opts: macro (tiling break-up + grime), ground (slab joints, puddles, ripples), planar, dark (soaked albedo), wetRough
 */
export function patchSurface(mat, opts = {}) {
  const o = { macro: true, ground: false, soft: false, planar: false, dark: 0.8, wetRough: 0.45, ...opts };
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    surfUniforms(sh);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + SURF_VERT_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SURF_VERT);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + SURF_FRAG_PARS)
      .replace('#include <map_fragment>', `#include <map_fragment>
        gUp = smoothstep(0.3, 0.9, vWNrm.y);
        float sExp = rainExposure(vWPos, vWNrm);
        gWet = uWet * sExp * mix(0.6, 1.0, gUp);
        ${o.macro ? `float macro = fbm(vWPos.xz * 0.11 + vWPos.y * 0.13);
        diffuseColor.rgb *= mix(0.76, 1.12, macro);` : 'float macro = 0.5;'}
        ${o.ground ? `
        ${o.soft ? 'float jd = 1.0;' : `vec2 sj = abs(fract(vWPos.xz / 7.0 + 0.5) - 0.5) * 7.0; float jd = min(sj.x, sj.y);
        float joint = 1.0 - smoothstep(0.012, 0.035, jd);
        diffuseColor.rgb *= (0.9 + 0.2 * h21(floor(vWPos.xz / 7.0 + 0.5))) * mix(1.0, 0.4, joint);`}
        float patchN = fbm(vWPos.xz * 0.045 + 31.7); diffuseColor.rgb *= mix(1.0, 0.72, smoothstep(0.56, 0.6, patchN) * 0.7);
        float pm = fbm(vWPos.xz * 0.21 + 4.7) * 0.72 + vnoise(vWPos.xz * 1.9) * 0.2 + (1.0 - smoothstep(0.0, 0.5, jd)) * 0.07;
        float pth = mix(0.74, 0.535, uWet);
        gPuddle = smoothstep(pth, pth + 0.035, pm) * gWet * gUp;
        gWet = max(gWet * (0.72 + 0.28 * smoothstep(pth - 0.22, pth, pm)), gPuddle);` : o.macro ? `
        float streak = fbm(vec2(dot(vWPos.xz, vec2(1.7, 1.3)) * 2.3, vWPos.y * 0.22));
        float grime = 1.0 - smoothstep(0.0, 1.1, vWPos.y + (macro - 0.5) * 1.2);
        diffuseColor.rgb *= mix(1.0, 0.56, grime * 0.8 * (1.0 - gUp)) * mix(1.0, 0.72, smoothstep(0.5, 0.75, streak) * 0.8 * (1.0 - gUp));` : ''}
        diffuseColor.rgb *= mix(1.0, ${o.dark.toFixed(2)}, gWet);
        ${o.ground ? 'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.5, 0.55, 0.6), gPuddle);' : ''}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        ${o.rough ? `roughnessFactor *= ${o.rough.toFixed(2)};` : ''}
        roughnessFactor = mix(roughnessFactor, max(0.07, roughnessFactor * ${o.wetRough.toFixed(2)}), gWet);
        float riv = smoothstep(0.55, 0.8, vnoise(vec2(dot(vWPos.xz, vec2(7.1, 5.3)), vWPos.y * 0.6 + uTime * 0.22)));
        roughnessFactor = mix(roughnessFactor, 0.1, riv * gWet * (1.0 - gUp) * 0.55 * uRain);
        ${o.ground ? 'roughnessFactor = mix(roughnessFactor, 0.02, gPuddle);' : ''}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        ${o.ground ? `if (gPuddle > 0.01) {
          vec2 rp = uRain > 0.0 ? ripples(vWPos.xz * 1.5, uTime) * uRain * 0.3 : vec2(0.0);
          vec3 rn = normalize(nonPerturbedNormal + (viewMatrix * vec4(rp.x, 0.0, rp.y, 0.0)).xyz);
          normal = normalize(mix(normal, rn, gPuddle));
        }` : ''}`);
    if (o.planar) sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\n' + PLANAR_FRAG);
  };
  const key = 'surf:' + JSON.stringify(o) + (mat.userData.vm ? ':vm' : '');
  mat.customProgramCacheKey = () => key;
  return mat;
}

const matCache = new Map();
export async function getMaterial(key) {
  if (matCache.has(key)) return matCache.get(key);
  const def = MATS[key] || MATS.wall;
  const p = (async () => {
    const [diff, nor, arm] = await Promise.all([loadTex(def.id + '_diff.jpg', true), loadTex(def.id + '_nor.jpg'), loadTex(def.id + '_arm.jpg')]);
    const m = new THREE.MeshStandardMaterial({
      map: def.gray ? grayCopy(diff) : diff, normalMap: nor, aoMap: arm, roughnessMap: arm, metalnessMap: arm,
      roughness: 1, metalness: 1, color: def.color ?? 0xffffff, vertexColors: true, envMapIntensity: def.env ?? 1,
    });
    m.userData.tile = def.tile;
    if (def.metal != null) m.metalness = def.metal;
    patchSurface(m, { ground: !!def.ground, soft: !!def.soft, planar: !!def.planar, dark: def.dark ?? 1, rough: def.rough });
    return m;
  })();
  matCache.set(key, p);
  return p;
}

// ---- small procedural textures -------------------------------------------------------------
export function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = Array.isArray(size) ? size[0] : size; c.height = Array.isArray(size) ? size[1] : size;
  draw(c.getContext('2d'), c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
export const softDot = () => canvasTex(128, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});

/** Makes a material draw in front of the world (first-person weapon) while keeping its own depth order. */
export function viewmodelDepth(mat) {
  if (mat.userData.vm) return mat;
  mat.userData.vm = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\ngl_Position.z = mix(-gl_Position.w, gl_Position.z, 0.06);');
  };
  mat.customProgramCacheKey = () => 'vm';
  return mat;
}
