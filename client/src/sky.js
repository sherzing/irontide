// Reads a sky (.sky, written by scripts/optimize-assets.mjs from a downloaded .hdr) into the float texture that
// three.js's HDRLoader makes of that .hdr: the same values, a third of the download.
import * as THREE from 'three';

const STEP = Array.from({ length: 256 }, (_, e) => Math.pow(2, e - 128) / 255);      // what one step of a colour byte is worth under exponent e

export async function loadSky(name) {
  const res = await fetch(`/assets/hdri/${name}.sky`);
  if (!res.ok) throw new Error(`Sky ${name}: ${res.status}`);
  const b = new Uint8Array(await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  if (b[0] !== 83 || b[1] !== 75 || b[2] !== 89 || b[3] !== 49) throw new Error(`Sky ${name}: not a .sky file`);
  const view = new DataView(b.buffer), W = view.getUint32(4, true), H = view.getUint32(8, true), n = W * H, data = new Float32Array(n * 4);
  // after the 12 bytes: all red bytes, all green, all blue, all exponents, each as its difference from the byte left of it
  for (let y = 0, i = 12, o = 0; y < H; y++) {
    for (let x = 0, r = 0, g = 0, bl = 0, e = 0; x < W; x++, i++, o += 4) {
      r = (r + b[i]) & 255; g = (g + b[i + n]) & 255; bl = (bl + b[i + 2 * n]) & 255; e = (e + b[i + 3 * n]) & 255;
      const s = STEP[e]; data[o] = r * s; data[o + 1] = g * s; data[o + 2] = bl * s; data[o + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  tex.colorSpace = THREE.LinearSRGBColorSpace; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.flipY = true;      // rows run from the top
  tex.mapping = THREE.EquirectangularReflectionMapping; tex.needsUpdate = true;
  return tex;
}
