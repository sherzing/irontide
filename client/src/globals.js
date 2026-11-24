// Uniforms shared by reference between the engine, surface materials, rain and level shaders.
import * as THREE from 'three';

const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
blank.needsUpdate = true;

export const G = {
  uTime: { value: 0 },
  uWet: { value: 0 },                       // 0 dry .. 1 soaked (level weather)
  uRain: { value: 0 },                      // 0 none .. 1 heavy: animated ripples, streaks
  tRefl: { value: blank },                  // planar reflection of everything above uReflY
  uReflMat: { value: new THREE.Matrix4() }, // world -> reflection texture uv
  uReflOn: { value: 0 },
  uReflY: { value: 0 },
  tCover: { value: blank },                 // top-down height map: what the rain can reach
  uCover: { value: new THREE.Vector4(0, 0, 1, 1) },   // x0, z0, 1/width, 1/depth
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunCol: { value: new THREE.Color(1, 1, 1) },
  uSkyCol: { value: new THREE.Color(0.5, 0.6, 0.7) },
};

// height encoding used by the cover map (8 bit): y = v * COVER_RANGE + COVER_MIN
export const COVER_MIN = -8, COVER_RANGE = 56;
export const blankTexture = blank;
