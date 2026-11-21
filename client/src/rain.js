// Rain: falling streaks in a box that follows the camera, and splash rings where drops land.
// Both are GPU-instanced and animated entirely in the vertex shader; the level's cover map keeps
// the rain out of buildings and puts the splashes on whatever surface is highest.
import * as THREE from 'three';
import { G, COVER_MIN, COVER_RANGE } from './globals.js';

const NL = 8;
const COVER = `texture2D(tCover, (P - uCover.xy) * uCover.zw).r * ${COVER_RANGE.toFixed(1)} + (${COVER_MIN.toFixed(1)})`;
const LIGHTING = /* glsl */`
  uniform vec3 uAmb, uSun, uSunDir; uniform vec4 uLPos[${NL}]; uniform vec3 uLCol[${NL}]; uniform int uLN;
  vec3 dropLight(vec3 p, vec3 view){
    vec3 c = uAmb + uSun * (0.08 + 1.6 * pow(max(dot(view, uSunDir), 0.0), 6.0));
    for (int i = 0; i < ${NL}; i++) { if (i >= uLN) break; vec3 d = uLPos[i].xyz - p; c += uLCol[i] / (1.5 + dot(d, d)); }
    return c;
  }`;

export class Rain {
  constructor(engine) {
    this.engine = engine;
    this.group = new THREE.Group(); this.group.name = 'rain'; this.group.renderOrder = 6;
    engine.scene.add(this.group); engine.noReflect.push(this.group);
    this.u = {
      uCam: { value: new THREE.Vector3() }, uVel: { value: new THREE.Vector3(1.7, -11.5, 0.9) }, uBox: { value: new THREE.Vector3(28, 20, 28) }, uAmount: { value: 1 },
      uAmb: { value: new THREE.Color() }, uSun: { value: new THREE.Color() }, uSunDir: G.uSunDir,
      uLPos: { value: Array.from({ length: NL }, () => new THREE.Vector4()) }, uLCol: { value: Array.from({ length: NL }, () => new THREE.Color()) }, uLN: { value: 0 },
      uTime: G.uTime, tCover: G.tCover, uCover: G.uCover,
    };
    this.build();
  }

  build() {
    for (const c of [...this.group.children]) { this.group.remove(c); c.geometry.dispose(); c.material.dispose(); }
    const q = this.engine.q.rain, seeds = (n) => { const a = new Float32Array(n * 4); for (let i = 0; i < a.length; i++) a[i] = Math.random(); return new THREE.InstancedBufferAttribute(a, 4); };
    const blend = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, toneMapped: false, side: THREE.DoubleSide };
    // ---- streaks
    const sg = new THREE.InstancedBufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3)); sg.setIndex([0, 1, 2, 0, 2, 3]);
    sg.setAttribute('aSeed', seeds(Math.round(12000 * q))); sg.instanceCount = Math.round(12000 * q);
    const streaks = new THREE.Mesh(sg, new THREE.ShaderMaterial({
      uniforms: this.u, ...blend,
      vertexShader: /* glsl */`
        attribute vec4 aSeed; uniform vec3 uCam, uVel, uBox; uniform float uTime, uAmount; uniform sampler2D tCover; uniform vec4 uCover;
        varying vec2 vQ; varying vec3 vC; ${LIGHTING}
        void main(){
          float sp = 0.8 + aSeed.w * 0.5;
          vec3 p = aSeed.xyz * uBox + uVel * (uTime * sp);
          p = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5 + uCam;
          vec3 dir = normalize(uVel), toCam = uCam - p; float dist = length(toCam);
          vec3 side = normalize(cross(dir, toCam));
          float len = (0.55 + aSeed.w * 0.5) * (1.0 + dist * 0.03);
          vec3 wp = p - dir * (position.y * len) + side * (position.x * (0.009 + dist * 0.0022));
          vec2 P = p.xz; float cover = ${COVER};
          float a = step(cover + 0.05, p.y) * smoothstep(0.5, 2.0, dist) * (1.0 - smoothstep(uBox.x * 0.36, uBox.x * 0.5, dist)) * step(fract(aSeed.w * 7.13), uAmount);
          vQ = position.xy; vC = dropLight(p, -toCam / dist) * a * (0.55 + aSeed.z * 0.6);
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: 'varying vec2 vQ; varying vec3 vC; void main(){ float a = (1.0 - abs(vQ.x) * 2.0) * smoothstep(0.0, 0.2, vQ.y) * smoothstep(1.0, 0.5, vQ.y); gl_FragColor = vec4(vC * a, 0.0); }',
    }));
    // ---- splashes
    const pg = new THREE.InstancedBufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, -0.5], 3)); pg.setIndex([0, 1, 2, 0, 2, 3]);
    pg.setAttribute('aSeed', seeds(Math.round(2200 * q))); pg.instanceCount = Math.round(2200 * q);
    const splashes = new THREE.Mesh(pg, new THREE.ShaderMaterial({
      uniforms: this.u, ...blend,
      vertexShader: /* glsl */`
        attribute vec4 aSeed; uniform vec3 uCam, uBox; uniform float uTime, uAmount; uniform sampler2D tCover; uniform vec4 uCover;
        varying vec2 vQ; varying vec3 vC; varying float vT; ${LIGHTING}
        float h1(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
        void main(){
          float period = 0.4 + aSeed.w * 0.45, ph = uTime / period + aSeed.z * 10.0, cyc = floor(ph), t = fract(ph);
          vec2 P = aSeed.xy * uBox.xz + vec2(h1(aSeed.xy + cyc * 0.37), h1(aSeed.yx + cyc * 0.71)) * 4.0;
          P = mod(P - uCam.xz + uBox.xz * 0.5, uBox.xz) - uBox.xz * 0.5 + uCam.xz;
          float y = ${COVER}; vec3 p = vec3(P.x, y + 0.015, P.y);
          float dist = distance(p, uCam), s = mix(0.03, 0.17, t);
          float a = (1.0 - t) * (1.0 - t) * (1.0 - smoothstep(uBox.x * 0.34, uBox.x * 0.5, dist)) * step(fract(aSeed.w * 5.31), uAmount) * step(abs(y - uCam.y + 1.6), 9.0);
          vQ = position.xz * 2.0; vT = t; vC = dropLight(p, normalize(p - uCam)) * a * 1.6;
          gl_Position = projectionMatrix * viewMatrix * vec4(p + vec3(position.x * s, 0.0, position.z * s), 1.0);
        }`,
      fragmentShader: 'varying vec2 vQ; varying vec3 vC; varying float vT; void main(){ float r = length(vQ); float a = smoothstep(1.0, 0.82, r) * smoothstep(0.5 + vT * 0.25, 0.8, r) + smoothstep(0.35, 0.0, r) * (1.0 - vT) * 0.6; gl_FragColor = vec4(vC * a, 0.0); }',
    }));
    for (const m of [streaks, splashes]) { m.frustumCulled = false; this.group.add(m); }
  }

  update(dt, camera) {
    const amount = G.uRain.value, u = this.u;
    this.group.visible = amount > 0.01;
    if (!this.group.visible) return;
    u.uCam.value.setFromMatrixPosition(camera.matrixWorld); u.uAmount.value = amount;
    const t = G.uTime.value;
    u.uVel.value.set(1.7 + Math.sin(t * 0.31) * 0.9, -11.5, 0.9 + Math.sin(t * 0.23 + 1.3) * 0.7);
    u.uAmb.value.set(0.15, 0.17, 0.2).multiplyScalar(this.brightness ?? 1);
    u.uSun.value.copy(G.uSunCol.value).multiplyScalar(0.06);
    const glow = this.engine.glow, n = Math.min(NL, glow.length); u.uLN.value = n;
    for (let i = 0; i < n; i++) { const g = glow[i]; u.uLPos.value[i].set(g.pos[0], g.pos[1], g.pos[2], 0); u.uLCol.value[i].set(g.color).multiplyScalar(g.intensity * 0.012); }
  }
}
