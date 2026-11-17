// Renderer, lighting environment and the post-processing pipeline.
//
// Frame:  shadow maps -> planar reflection (wet ground) -> scene (MSAA, HDR, depth texture)
//         -> ambient occlusion from depth -> ray-marched sun shafts + lamp glow (half res, blurred)
//         -> composite (AO, height fog, in-scatter) -> bloom -> tone map + grade -> screen
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { G, blankTexture } from './globals.js';

// scale: render resolution multiplier · dpr: device-pixel-ratio cap · vol: shaft ray steps · refl: reflection resolution scale
export const QUALITY = {
  low: { scale: 0.8, dpr: 1, shadow: 2048, shadowEvery: 3, vmAO: 0, msaa: 0, ao: 0, vol: 0, refl: 0, aniso: 4, rain: 0.45, lights: 6, pointShadows: false },
  medium: { scale: 1, dpr: 1.25, shadow: 2048, shadowEvery: 2, msaa: 2, ao: 0, vol: 12, refl: 0.4, aniso: 8, rain: 0.7, lights: 10, pointShadows: false },
  high: { scale: 1, dpr: 1.5, shadow: 4096, shadowEvery: 2, msaa: 4, ao: 0.5, vol: 20, refl: 0.5, aniso: 8, rain: 1, lights: 14, pointShadows: false },
  ultra: { scale: 1, dpr: 2, shadow: 4096, msaa: 4, ao: 1, vol: 32, refl: 0.75, aniso: 16, rain: 1.4, lights: 16, pointShadows: true },
};
const MAX_GLOW = 16;
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// ---- sun shafts: march the view ray through height fog, sampling the sun's shadow map; plus analytic lamp glow
const VolShader = {
  uniforms: {
    tDepth: { value: null }, tShadow: { value: null }, uProjInv: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uShadowMat: { value: new THREE.Matrix4() },
    uCamPos: { value: new THREE.Vector3() }, uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() },
    uDensity: { value: 0.01 }, uFall: { value: 0.08 }, uBaseY: { value: 0 }, uMaxDist: { value: 90 }, uGlow: { value: 1 }, uG: { value: 0.72 },
    uLightPos: { value: Array.from({ length: MAX_GLOW }, () => new THREE.Vector4()) }, uLightCol: { value: Array.from({ length: MAX_GLOW }, () => new THREE.Color()) }, uLightN: { value: 0 },
  },
  vertexShader: VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tDepth; uniform highp sampler2DShadow tShadow;
    uniform mat4 uProjInv, uCamWorld, uShadowMat; uniform vec3 uCamPos, uSunDir, uSunCol;
    uniform float uDensity, uFall, uBaseY, uMaxDist, uGlow, uG;
    uniform vec4 uLightPos[${MAX_GLOW}]; uniform vec3 uLightCol[${MAX_GLOW}]; uniform int uLightN;
    varying vec2 vUv;
    float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    float hg(float c, float g){ float g2 = g * g; return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5); }
    void main(){
      float depth = texture2D(tDepth, vUv).r;
      vec4 vp = uProjInv * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0); vp.xyz /= vp.w;
      float dist = length(vp.xyz);
      vec3 rd = normalize(mat3(uCamWorld) * vp.xyz);
      bool sky = depth >= 0.999999;
      vec3 col = vec3(0.0);
      #if STEPS > 0
        float tmax = sky ? uMaxDist : min(dist, uMaxDist);
        float dt = tmax / float(STEPS);
        float t = dt * ign(gl_FragCoord.xy);
        float sum = 0.0, tr = 1.0;
        for (int i = 0; i < STEPS; i++) {
          vec3 p = uCamPos + rd * t;
          float dens = uDensity * exp(-(p.y - uBaseY) * uFall);
          vec4 sc = uShadowMat * vec4(p, 1.0);
          float vis = 1.0;
          if (sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z > 0.0 && sc.z < 1.0) vis = texture(tShadow, vec3(sc.xy, sc.z - 0.0008));
          sum += tr * dens * vis;
          tr *= exp(-dens * dt);
          t += dt;
        }
        float c = dot(rd, uSunDir);
        col += uSunCol * (sum * dt) * (hg(c, uG) * 0.6 + hg(c, 0.15) * 0.4) * 0.0796;
      #endif
      // lamps: closed-form in-scatter of a 1/r^2 light with a hard range, up to the first surface
      float tm = sky ? 4000.0 : dist;
      for (int i = 0; i < ${MAX_GLOW}; i++) {
        if (i >= uLightN) break;
        vec3 q = uCamPos - uLightPos[i].xyz; float R = uLightPos[i].w;
        float b = dot(rd, q), h2 = dot(q, q) - b * b;
        if (h2 > R * R) continue;
        float s = sqrt(R * R - h2), t0 = max(-b - s, 0.0), t1 = min(-b + s, tm);
        if (t1 <= t0) continue;
        float h = sqrt(max(h2, 0.0009));
        float I = (atan((t1 + b) / h) - atan((t0 + b) / h)) / h - (t1 - t0) / (R * R);
        col += uLightCol[i] * max(I, 0.0) * uGlow;
      }
      gl_FragColor = vec4(col, dist);
    }`,
};

// ---- depth-aware separable blur for the half-res volumetric buffer
const BlurShader = {
  uniforms: { tIn: { value: null }, uDir: { value: new THREE.Vector2() } },
  vertexShader: VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tIn; uniform vec2 uDir; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tIn, vUv); float d0 = c.a, w = 0.227; vec3 acc = c.rgb * w;
      float gk[4]; gk[0] = 0.1945; gk[1] = 0.1216; gk[2] = 0.0541; gk[3] = 0.0162;
      for (int i = 0; i < 4; i++) {
        for (int sgn = -1; sgn <= 1; sgn += 2) {
          vec4 s = texture2D(tIn, vUv + uDir * float((i + 1) * sgn) * 1.5);
          float ww = gk[i] * exp(-abs(s.a - d0) / (0.12 * d0 + 0.08));
          acc += s.rgb * ww; w += ww;
        }
      }
      gl_FragColor = vec4(acc / w, d0);
    }`,
};

// ---- composite: ambient occlusion, exponential height fog with a sun-side tint, add the shafts
const CompositeShader = {
  uniforms: {
    tColor: { value: null }, tDepth: { value: null }, tVol: { value: null }, tAO: { value: null },
    uProjInv: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() }, uSunDir: { value: new THREE.Vector3() },
    uFogCol: { value: new THREE.Color(0.5, 0.5, 0.5) }, uFogSun: { value: new THREE.Color(1, 0.7, 0.4) },
    uFogDensity: { value: 0.004 }, uFogFall: { value: 0.06 }, uFogBaseY: { value: 0 }, uFogSky: { value: 1 }, uAO: { value: 1 },
    uProj: { value: new THREE.Vector4() }, uVmScale: { value: 1 }, uVmAO: { value: 1 }, uAspect: { value: 1 },
  },
  vertexShader: VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tColor, tDepth, tVol, tAO;
    uniform mat4 uProjInv, uCamWorld; uniform vec3 uCamPos, uSunDir, uFogCol, uFogSun;
    uniform float uFogDensity, uFogFall, uFogBaseY, uFogSky, uAO, uVmScale, uVmAO, uAspect; uniform vec4 uProj;
    varying vec2 vUv;
    // The first-person weapon is drawn with its own FOV and with depth squeezed into the first 6 % of the range
    // (see materials.js viewmodelDepth). Undo both to get its true view-space position, for contact shadowing.
    vec3 vmPos(vec2 uv){
      float D = texture2D(tDepth, uv).r; if (D > 0.0602) return vec3(0.0, 0.0, -1e3);
      float L = uProj.w / (D / 0.03 - 1.0 + uProj.z); vec2 n = uv * 2.0 - 1.0;
      return vec3(n.x / (uVmScale * uProj.x) * L, n.y / (uVmScale * uProj.y) * L, -L);
    }
    float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    float vmAO(){
      vec3 P = vmPos(vUv), N = normalize(cross(dFdx(P), dFdy(P))); if (N.z < 0.0) N = -N;
      const float R = 0.017; float rad = R * uVmScale * uProj.y / max(-P.z, 0.05) * 0.5, ang = ign(gl_FragCoord.xy) * 6.2832, occ = 0.0;
      for (int i = 0; i < 12; i++) {
        float r = sqrt((float(i) + 0.5) / 12.0) * rad, a = ang + float(i) * 2.399963;
        vec3 v = vmPos(vUv + vec2(cos(a) / uAspect, sin(a)) * r) - P; float d2 = dot(v, v);
        occ += max(0.0, dot(v, N) - 0.0007) / (d2 + 0.000012) * step(d2, R * R * 3.0);
      }
      return clamp(1.0 - occ * (R / 12.0) * 1.15, 0.0, 1.0);
    }
    void main(){
      vec3 col = texture2D(tColor, vUv).rgb;
      float depth = texture2D(tDepth, vUv).r;
      vec4 vp = uProjInv * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0); vp.xyz /= vp.w;
      float dist = length(vp.xyz);
      bool sky = depth >= 0.999999;
      if (dist > 0.14) {                                    // closer than this is the first-person weapon
        vec3 rd = normalize(mat3(uCamWorld) * vp.xyz);
        #ifdef USE_AO
          if (!sky) col *= mix(1.0, texture2D(tAO, vUv).r, uAO);
        #endif
        float d = sky ? 6000.0 * uFogSky : dist;
        float k = uFogFall * rd.y;
        float f = abs(k * d) < 0.001 ? d : (1.0 - exp(-k * d)) / k;
        float T = exp(-uFogDensity * exp(-(uCamPos.y - uFogBaseY) * uFogFall) * f);
        float c = max(dot(rd, uSunDir), 0.0);
        vec3 fog = mix(uFogCol, uFogSun, pow(c, 7.0) * 0.75 + pow(c, 48.0) * 0.15);
        col = col * T + fog * (1.0 - T);
        #ifdef USE_VOL
          col += texture2D(tVol, vUv).rgb;
        #endif
      } else if (uVmAO > 0.0) { float ao = vmAO(); col *= mix(1.0, ao * ao * 0.6 + ao * 0.4, uVmAO); }
      gl_FragColor = vec4(col, 1.0);
    }`,
};

// ---- final: sharpen, tone map (ACES fit), display transform, grade, lens artefacts, overlays
const FinalShader = {
  uniforms: {
    tColor: { value: null }, uTexel: { value: new THREE.Vector2() }, uExposure: { value: 1 }, time: { value: 0 }, aspect: { value: 1 },
    vignette: { value: 0.34 }, grain: { value: 0.03 }, ca: { value: 0.0011 }, hurt: { value: 0 }, scope: { value: 0 }, sharpen: { value: 0.35 },
    sat: { value: 1.04 }, contrast: { value: 0.14 }, uShadowTint: { value: new THREE.Color(0, 0.012, 0.02) }, uHighTint: { value: new THREE.Color(0.02, 0.008, -0.012) },
  },
  vertexShader: VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tColor; uniform vec2 uTexel; uniform float uExposure, time, aspect, vignette, grain, ca, hurt, scope, sharpen, sat, contrast;
    uniform vec3 uShadowTint, uHighTint; varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    vec3 fit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
    vec3 aces(vec3 c){
      const mat3 mi = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 mo = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      return clamp(mo * fit(mi * (c * uExposure / 0.6)), 0.0, 1.0);
    }
    void main(){
      vec2 c = vUv - 0.5; float r2 = dot(c, c);
      vec2 off = c * r2 * ca * 6.0;
      vec3 col = vec3(texture2D(tColor, vUv + off).r, texture2D(tColor, vUv).g, texture2D(tColor, vUv - off).b);
      if (sharpen > 0.0) {
        vec3 n = (texture2D(tColor, vUv + vec2(uTexel.x, 0.0)).rgb + texture2D(tColor, vUv - vec2(uTexel.x, 0.0)).rgb + texture2D(tColor, vUv + vec2(0.0, uTexel.y)).rgb + texture2D(tColor, vUv - vec2(0.0, uTexel.y)).rgb) * 0.25;
        col += clamp((col - n) * sharpen, -0.3 * col, 0.3 * col);
      }
      col = aces(max(col, 0.0));
      col = mix(col * 12.92, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, col));      // sRGB
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, sat);
      col = mix(col, col * col * (3.0 - 2.0 * col), contrast);
      col += uShadowTint * (1.0 - l) * (1.0 - l) + uHighTint * l * l;
      col *= 1.0 - vignette * smoothstep(0.1, 0.62, r2);
      col = mix(col, vec3(l) * vec3(1.0, 0.25, 0.2), hurt * smoothstep(0.02, 0.5, r2) * 0.85);
      col += (hash(vUv * vec2(1920.0, 1080.0) + fract(time) * 100.0) - 0.5) * grain * (1.0 - l * 0.6);
      if (scope > 0.0) {
        vec2 s = vec2(c.x * aspect, c.y); float d = length(s);
        float edge = smoothstep(0.43, 0.445, d);
        float lines = max(step(abs(s.x), 0.0012) * step(0.012, abs(s.y)), step(abs(s.y), 0.0012) * step(0.012, abs(s.x)));
        lines = max(lines, step(abs(s.x), 0.004) * step(0.16, abs(s.y)));
        lines = max(lines, step(abs(s.y), 0.004) * step(0.16, abs(s.x)));
        col = mix(col, vec3(0.0), max(edge, lines * 0.9) * scope);
        col *= mix(1.0, 1.0 - smoothstep(0.25, 0.44, d) * 0.55, scope);
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
};

const mat = (sh, defines) => new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(sh.uniforms), vertexShader: sh.vertexShader, fragmentShader: sh.fragmentShader, defines: defines || {}, depthTest: false, depthWrite: false, toneMapped: false });

export class Engine {
  constructor(canvas, qualityName = 'high') {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: false, alpha: false });
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap; r.shadowMap.autoUpdate = false;
    r.toneMapping = THREE.NoToneMapping;                       // tone mapping happens in the final pass
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.info.autoReset = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.04, 2500);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.fx = new THREE.Group(); this.fx.name = 'fx';          // sprites, tracers, flashes
    this.scene.add(this.fx);
    this.sun = new THREE.DirectionalLight(0xffc48a, 5);
    this.sun.castShadow = true;
    this.scene.add(this.sun, this.sun.target);
    this.sunDir = new THREE.Vector3(0.4, 0.3, 0.6).normalize();
    this.time = 0; this.hurt = 0; this.scope = 0; this.exposure = 1; this.fade = 1; this.eye = 1; this.shelter = 0;
    this.dynamic = true; this.dyn = 1; this._ema = 1 / 60; this._slow = 0; this._fast = 0; this._ceil = 1; this._ceilT = 0;
    this.reflectY = null; this.noReflect = [];                 // objects hidden while the reflection is rendered
    this.glow = [];
    this.stats = { calls: 0, tris: 0 };
    this.quad = new FullScreenQuad();
    this.reflCam = new THREE.PerspectiveCamera();
    this.mVol = null;
    this.setQuality(qualityName);
    addEventListener('resize', () => this.resize());
  }

  setQuality(name) {
    this.qualityName = QUALITY[name] ? name : 'high';
    const q = this.q = QUALITY[this.qualityName];
    this.dyn = 1; this._ceil = 1;
    this.mVol?.dispose(); this.mBlur?.dispose(); this.mComp?.dispose(); this.mFinal?.dispose();
    this.mVol = mat(VolShader, { STEPS: q.vol });
    this.mBlur = mat(BlurShader);
    this.mComp = mat(CompositeShader, { ...(q.ao ? { USE_AO: 1 } : {}), USE_VOL: 1 });
    this.mFinal = mat(FinalShader);
    this.sun.shadow.mapSize.set(q.shadow, q.shadow);
    this.sun.shadow.map?.dispose(); this.sun.shadow.map = null;
    this.buildTargets();
    if (this.env) this.applyEnv(this.env);
  }

  /** Creates the render targets and passes for the current quality preset (sizes are set by fit()). */
  buildTargets() {
    const q = this.q;
    for (const k of ['sceneRT', 'postRT', 'volA', 'volB', 'reflRT']) { this[k]?.depthTexture?.dispose(); this[k]?.dispose(); this[k] = null; }
    this.gtao?.dispose(); this.gtao = null; this.bloom?.dispose();
    const hdr = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.sceneRT = new THREE.WebGLRenderTarget(8, 8, { ...hdr, samples: q.msaa, depthTexture: new THREE.DepthTexture(8, 8) });
    this.postRT = new THREE.WebGLRenderTarget(8, 8, { ...hdr, depthBuffer: false });
    this.volA = new THREE.WebGLRenderTarget(4, 4, { ...hdr, depthBuffer: false });
    this.volB = new THREE.WebGLRenderTarget(4, 4, { ...hdr, depthBuffer: false });
    if (q.refl) this.reflRT = new THREE.WebGLRenderTarget(4, 4, { ...hdr, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    G.tRefl.value = this.reflRT ? this.reflRT.texture : blankTexture;
    if (q.ao) {
      const g = this.gtao = new GTAOPass(this.scene, this.camera, 8, 8, { depthTexture: this.sceneRT.depthTexture });
      g.output = GTAOPass.OUTPUT.Off;
      g.updateGtaoMaterial({ radius: 0.85, distanceExponent: 1.3, thickness: 1.2, scale: 1.4, samples: q.ao >= 1 ? 16 : 10, distanceFallOff: 1, screenSpaceRadius: false });
      g.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: q.ao >= 1 ? 12 : 8 });
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(8, 8), 0.2, 0.75, 1.1);
    this.fit();
  }

  /** Sizes everything to the window, the quality preset and the current dynamic-resolution scale. */
  fit() {
    const q = this.q, r = this.renderer;
    r.setPixelRatio(Math.min(devicePixelRatio || 1, q.dpr) * q.scale * this.dyn);
    r.setSize(innerWidth, innerHeight, false);
    const s = r.getDrawingBufferSize(new THREE.Vector2()), W = Math.max(8, s.x), H = Math.max(8, s.y);
    this.sceneRT.setSize(W, H); this.postRT.setSize(W, H);
    this.volA.setSize(Math.max(4, W >> 1), Math.max(4, H >> 1)); this.volB.setSize(Math.max(4, W >> 1), Math.max(4, H >> 1));
    this.reflRT?.setSize(Math.max(4, Math.round(W * q.refl)), Math.max(4, Math.round(H * q.refl)));
    this.gtao?.setSize(Math.round(W * q.ao), Math.round(H * q.ao));
    this.bloom.setSize(W / 2, H / 2);
    this.mFinal.uniforms.uTexel.value.set(1 / W, 1 / H);
    this.mFinal.uniforms.aspect.value = innerWidth / innerHeight;
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    this.size = { W, H };
  }
  resize() { this.fit(); }

  /** Loads the HDRI sky, finds the sun in it and rotates it to the level's requested azimuth. */
  async loadEnvironment(env, bounds) {
    const tex = await new HDRLoader().setDataType(THREE.FloatType).loadAsync(`/assets/hdri/${env.hdri}.hdr`);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    // --- locate the sun: luminance-weighted centroid of the brightest texels
    const { data, width: W, height: H } = tex.image;
    const stride = data.length / (W * H);
    let max = 0;
    for (let i = 0; i < data.length; i += stride * 7) { const l = data[i] + data[i + 1] + data[i + 2]; if (l > max) max = l; }
    let sx = 0, sy = 0, sz = 0;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * stride, l = data[i] + data[i + 1] + data[i + 2];
      if (l < max * 0.35) continue;
      // three's equirect lookup: u = atan(dir.z, dir.x)/2PI + 0.5, v = asin(dir.y)/PI + 0.5 ; data row 0 = bottom (flipY)
      const phi = (x / W - 0.5) * Math.PI * 2, th = ((tex.flipY ? y / H : 1 - y / H) - 0.5) * Math.PI;
      sx += Math.cos(th) * Math.cos(phi) * l; sy += Math.sin(th) * l; sz += Math.cos(th) * Math.sin(phi) * l;
    }
    const raw = new THREE.Vector3(sx, sy, sz).normalize();
    const az = THREE.MathUtils.degToRad(env.sunAzimuth ?? 200);
    const want = new THREE.Vector3(Math.sin(az), 0, -Math.cos(az));
    const rot = Math.atan2(raw.z, raw.x) - Math.atan2(want.z, want.x);     // rotate sky about Y
    const el = env.sunElevation != null ? THREE.MathUtils.degToRad(env.sunElevation) : Math.max(Math.asin(raw.y), THREE.MathUtils.degToRad(env.minSunElevation ?? 17));
    this.sunDir.set(want.x * Math.cos(el), Math.sin(el), want.z * Math.cos(el)).normalize();
    this.scene.background = tex; this.scene.environment = tex;
    this.scene.backgroundRotation.set(0, rot, 0); this.scene.environmentRotation.set(0, rot, 0);
    this.scene.fog = null;                                                  // fog is a post effect here
    // --- sun light + shadow frustum fitted to the level
    const s = this.sun;
    const cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2;
    s.target.position.set(cx, 0, cz);
    s.position.copy(s.target.position).addScaledVector(this.sunDir, 160);
    s.updateMatrixWorld(); s.target.updateMatrixWorld();
    const cam = s.shadow.camera, inv = new THREE.Matrix4().lookAt(s.position, s.target.position, new THREE.Vector3(0, 1, 0)).invert();
    const bb = new THREE.Box3(), v = new THREE.Vector3();
    for (const x of [bounds.minX - 3, bounds.maxX + 3]) for (const z of [bounds.minZ - 3, bounds.maxZ + 3]) for (const y of [-1.6, bounds.maxY ?? 14]) {
      v.set(x - s.position.x, y - s.position.y, z - s.position.z).applyMatrix4(inv); bb.expandByPoint(v);
    }
    cam.left = bb.min.x; cam.right = bb.max.x; cam.bottom = bb.min.y; cam.top = bb.max.y;
    cam.near = 10; cam.far = -bb.min.z + 30; cam.updateProjectionMatrix();
    s.shadow.bias = -0.0005; s.shadow.normalBias = 0.035; s.shadow.radius = 2.4;
    this.env = env; this.applyEnv(env);
  }

  /** Applies the parts of a level environment that do not need assets (also re-run on quality change). */
  applyEnv(env) {
    const fog = env.fog || {}, vol = env.shafts || {}, w = env.weather || {}, gr = env.grade || {};
    this.scene.environmentIntensity = env.ambient ?? 1; this.scene.backgroundIntensity = env.skyIntensity ?? 1;
    this.exposure = env.exposure ?? 1;
    this.sun.color.set(env.sunColor ?? 0xffb877); this.sun.intensity = env.sunIntensity ?? 5.5;
    const c = this.mComp.uniforms, vu = this.mVol.uniforms, f = this.mFinal.uniforms;
    c.uFogCol.value.set(fog.color ?? '#9aa3aa'); c.uFogSun.value.set(fog.sunColor ?? fog.color ?? '#d9b08a');
    c.uFogDensity.value = fog.density ?? 0.004; c.uFogFall.value = fog.falloff ?? 0.06; c.uFogBaseY.value = fog.baseY ?? 0; c.uFogSky.value = fog.sky ?? 1;
    c.uAO.value = env.ao ?? 0.9;
    vu.uDensity.value = vol.density ?? 0.012; vu.uFall.value = vol.falloff ?? fog.falloff ?? 0.06; vu.uBaseY.value = fog.baseY ?? 0; vu.uMaxDist.value = vol.distance ?? 90;
    vu.uG.value = vol.anisotropy ?? 0.72; vu.uGlow.value = (vol.density ?? 0.012) * 0.0796 * (vol.glow ?? 4);
    vu.uSunCol.value.copy(this.sun.color).multiplyScalar(this.sun.intensity * (vol.strength ?? 1));
    this.bloom.strength = env.bloom?.strength ?? 0.2; this.bloom.radius = env.bloom?.radius ?? 0.75; this.bloom.threshold = env.bloom?.threshold ?? 1.1;
    f.sat.value = gr.saturation ?? 1.04; f.contrast.value = gr.contrast ?? 0.14; f.vignette.value = gr.vignette ?? 0.34; f.grain.value = gr.grain ?? 0.03;
    f.uShadowTint.value.set(...(gr.shadows ?? [0, 0.012, 0.02])); f.uHighTint.value.set(...(gr.highlights ?? [0.02, 0.008, -0.012]));
    G.uWet.value = w.wet ?? (w.rain ? 1 : 0); G.uRain.value = w.rain ?? 0;
    G.uSunDir.value.copy(this.sunDir); G.uSunCol.value.copy(this.sun.color).multiplyScalar(this.sun.intensity);
    G.uSkyCol.value.set(fog.color ?? '#9aa3aa');
    this.reflectY = env.reflectY ?? (G.uWet.value > 0 ? 0 : null);
    G.uReflY.value = this.reflectY ?? 0;
  }

  /** Point lights that should bloom into the haze: [{pos:[x,y,z], color, intensity, range}] */
  setGlowLights(list) { this.glow = list.slice(0, MAX_GLOW); }

  /**
   * Compiles every material for the HDR scene target, uploads all textures and renders one frame from
   * `eye` toward `target`, so the first seconds of play do not hitch (call it behind the loading screen).
   */
  async precompile(eye, target) {
    const r = this.renderer;
    r.setRenderTarget(this.sceneRT);
    try { await r.compileAsync(this.scene, this.camera); } catch { /* optional */ }
    r.setRenderTarget(null);
    const seen = new Set();
    this.scene.traverse((o) => {
      for (const m of [].concat(o.material || [])) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap']) {
        const t = m[k]; if (t && t.isTexture && !seen.has(t) && t.image) { seen.add(t); try { r.initTexture(t); } catch { /* not ready */ } }
      }
    });
    if (eye) { this.camera.position.fromArray(eye); this.camera.lookAt(target[0], target[1], target[2]); this.camera.rotation.order = 'YXZ'; }
    const fade = this.fade; this.fade = 0; this.render(0); this.render(0); this.fade = fade;
  }

  renderReflection() {
    const cam = this.camera, v = this.reflCam, Y = this.reflectY, r = this.renderer;
    const p = _a.setFromMatrixPosition(cam.matrixWorld), rm = _m.extractRotation(cam.matrixWorld);
    const fwd = _b.set(0, 0, -1).applyMatrix4(rm); fwd.y = -fwd.y;
    v.position.set(p.x, 2 * Y - p.y, p.z);
    v.up.set(0, 1, 0).applyMatrix4(rm); v.up.y = -v.up.y;
    v.lookAt(_c.copy(v.position).add(fwd));
    v.near = cam.near; v.far = cam.far; v.updateMatrixWorld();
    v.projectionMatrix.copy(cam.projectionMatrix); v.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
    G.uReflMat.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(v.projectionMatrix).multiply(v.matrixWorldInverse);
    // oblique near plane: nothing below the mirror gets into the reflection
    _pl.setFromNormalAndCoplanarPoint(_b.set(0, 1, 0), _c.set(0, Y + 0.02, 0)).applyMatrix4(v.matrixWorldInverse);
    const cp = _v4.set(_pl.normal.x, _pl.normal.y, _pl.normal.z, _pl.constant), pm = v.projectionMatrix.elements, q = _q4;
    q.x = (Math.sign(cp.x) + pm[8]) / pm[0]; q.y = (Math.sign(cp.y) + pm[9]) / pm[5]; q.z = -1; q.w = (1 + pm[10]) / pm[14];
    cp.multiplyScalar(2 / cp.dot(q));
    pm[2] = cp.x; pm[6] = cp.y; pm[10] = cp.z + 1; pm[14] = cp.w;
    const hidden = [];
    for (const o of [...cam.children, ...this.noReflect]) if (o.visible) { o.visible = false; hidden.push(o); }
    G.uReflOn.value = 0; G.tRefl.value = blankTexture;         // the mirror must not sample itself
    r.setRenderTarget(this.reflRT); r.render(this.scene, v);
    for (const o of hidden) o.visible = true;
    G.uReflOn.value = 1; G.tRefl.value = this.reflRT.texture;
  }

  pass(material, target) { this.quad.material = material; this.renderer.setRenderTarget(target); this.quad.render(this.renderer); }

  /** Lowers the render resolution when frames get slow and raises it again when there is headroom. */
  adapt(dt) {
    if (!this.dynamic || dt <= 0 || dt > 0.25) return;
    this._ema += (dt - this._ema) * 0.08; this._ceilT -= dt;
    if (this._ceilT <= 0) this._ceil = 1;
    if (this._ema > 1 / 47) { this._slow += dt; this._fast = 0; } else if (this._ema < 1 / 56) { this._fast += dt; this._slow = 0; } else { this._slow = this._fast = 0; }
    let next = this.dyn;
    if (this._slow > 1.2 && this.dyn > 0.56) { next = Math.max(0.55, this.dyn * 0.87); this._ceil = this.dyn - 0.01; this._ceilT = 25; }
    else if (this._fast > 5 && this.dyn < this._ceil - 0.02) next = Math.min(this._ceil, this.dyn * 1.1);
    if (next !== this.dyn) { this.dyn = next; this._slow = this._fast = 0; this._ema = 1 / 52; this.fit(); }
  }

  render(dt) {
    this.adapt(dt);
    const r = this.renderer, cam = this.camera, q = this.q;
    this.time += dt; G.uTime.value = this.time;
    r.info.reset();
    cam.updateMatrixWorld();
    // eye adaptation: stop down when facing the low sun, open up under a roof
    const facing = Math.max(0, cam.getWorldDirection(_b).dot(this.sunDir));
    const want = (1 - (this.env?.glare ?? 0.45) * facing * facing * Math.sqrt(facing)) * (1 + this.shelter * (this.env?.indoorBoost ?? 0.3));
    this.eye += (want - this.eye) * Math.min(1, dt * 1.6);
    r.shadowMap.needsUpdate = (this.frame = (this.frame || 0) + 1) % (q.shadowEvery || 1) === 0 || !this.sun.shadow.map;   // shadow maps render in the first scene pass
    if (this.reflRT && this.reflectY != null) this.renderReflection(); else G.uReflOn.value = 0;
    r.setRenderTarget(this.sceneRT); r.render(this.scene, cam);
    this.stats.calls = r.info.render.calls; this.stats.tris = r.info.render.triangles;

    const depth = this.sceneRT.depthTexture, shadow = this.sun.shadow.map?.depthTexture;
    if (this.gtao) this.gtao.render(r, null, null);
    const cu = this.mComp.uniforms, vu = this.mVol.uniforms;
    const useVol = (q.vol > 0 || this.glow.length > 0) && !!shadow;
    if (useVol) {
      vu.tDepth.value = depth; vu.tShadow.value = shadow; vu.uProjInv.value.copy(cam.projectionMatrixInverse); vu.uCamWorld.value.copy(cam.matrixWorld);
      vu.uShadowMat.value.copy(this.sun.shadow.matrix); vu.uCamPos.value.setFromMatrixPosition(cam.matrixWorld); vu.uSunDir.value.copy(this.sunDir);
      const n = Math.min(this.glow.length, q.lights + 2); vu.uLightN.value = n;
      for (let i = 0; i < n; i++) { const g = this.glow[i]; vu.uLightPos.value[i].set(g.pos[0], g.pos[1], g.pos[2], g.range); vu.uLightCol.value[i].set(g.color).multiplyScalar(g.intensity); }
      this.pass(this.mVol, this.volA);
      const bu = this.mBlur.uniforms;
      bu.tIn.value = this.volA.texture; bu.uDir.value.set(1 / this.volA.width, 0); this.pass(this.mBlur, this.volB);
      bu.tIn.value = this.volB.texture; bu.uDir.value.set(0, 1 / this.volA.height); this.pass(this.mBlur, this.volA);
    }
    if (!!this.mComp.defines.USE_VOL !== useVol) { if (useVol) this.mComp.defines.USE_VOL = 1; else delete this.mComp.defines.USE_VOL; this.mComp.needsUpdate = true; }
    cu.tColor.value = this.sceneRT.texture; cu.tDepth.value = depth; cu.tVol.value = this.volA.texture; cu.tAO.value = this.gtao ? this.gtao.gtaoMap : null;
    cu.uProjInv.value.copy(cam.projectionMatrixInverse); cu.uCamWorld.value.copy(cam.matrixWorld); cu.uCamPos.value.setFromMatrixPosition(cam.matrixWorld); cu.uSunDir.value.copy(this.sunDir);
    { const e = cam.projectionMatrix.elements; cu.uProj.value.set(e[0], e[5], e[10], e[14]); cu.uVmScale.value = this.vmScale || 1; cu.uAspect.value = cam.aspect; cu.uVmAO.value = q.vmAO ?? 1; }
    this.pass(this.mComp, this.postRT);
    this.bloom.render(r, null, this.postRT, dt, false);
    const fu = this.mFinal.uniforms;
    fu.tColor.value = this.postRT.texture; fu.time.value = this.time; fu.hurt.value = this.hurt; fu.scope.value = this.scope; fu.uExposure.value = this.exposure * this.fade * this.eye;
    this.pass(this.mFinal, null);
  }
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _m = new THREE.Matrix4(), _pl = new THREE.Plane(), _v4 = new THREE.Vector4(), _q4 = new THREE.Vector4();
