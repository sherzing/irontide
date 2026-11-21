// Visual effects: particles, bullet-hole decals, tracers, muzzle flashes, shell casings, dust motes.
import * as THREE from 'three';
import { canvasTex, softDot } from './materials.js';
import { G } from './globals.js';

const N = 1400;
const SURF_COL = { concrete: [0.62, 0.6, 0.56], dirt: [0.45, 0.38, 0.3], wood: [0.6, 0.48, 0.34], metal: [0.5, 0.5, 0.5], rubber: [0.1, 0.1, 0.1], water: [0.8, 0.85, 0.9], flesh: [0.35, 0.02, 0.02] };
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1), _n = new THREE.Vector3();

export class FX {
  constructor(engine) {
    this.engine = engine; const root = this.root = engine.fx;
    // ---------------- particles (single draw call, premultiplied so additive + alpha share it)
    const g = this.pg = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 4); this.siz = new Float32Array(N * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('psize', new THREE.BufferAttribute(this.siz, 2).setUsage(THREE.DynamicDrawUsage));
    this.p = Array.from({ length: N }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, s0: 0, s1: 0, r: 1, g: 1, b: 1, a: 1, add: 0, grav: 0, drag: 0 }));
    this.pi = 0;
    this.pmat = new THREE.ShaderMaterial({
      uniforms: { map: { value: softDot() }, scale: { value: 800 } },
      vertexShader: 'attribute vec4 pcol; attribute vec2 psize; varying vec4 vC; varying float vAdd; uniform float scale; void main(){ vC = pcol; vAdd = psize.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = psize.x * scale / max(0.1, -mv.z); }',
      fragmentShader: 'uniform sampler2D map; varying vec4 vC; varying float vAdd; void main(){ float a = texture2D(map, gl_PointCoord).a * vC.a; if (a < 0.003) discard; gl_FragColor = vec4(vC.rgb * a, a * (1.0 - vAdd)); }',
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    const pts = new THREE.Points(g, this.pmat); pts.frustumCulled = false; pts.renderOrder = 5; root.add(pts);

    // ---------------- bullet holes
    this.DN = 220; this.di = 0;
    const holeTex = canvasTex(64, (c, s) => {
      const r = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(5,5,5,1)'); r.addColorStop(0.22, 'rgba(10,9,8,0.95)'); r.addColorStop(0.4, 'rgba(40,36,32,0.55)'); r.addColorStop(1, 'rgba(60,55,50,0)');
      c.fillStyle = r; c.fillRect(0, 0, s, s);
      c.strokeStyle = 'rgba(15,13,12,0.5)'; c.lineWidth = 1;
      for (let i = 0; i < 9; i++) { const a = Math.random() * 6.28, l = s * (0.2 + Math.random() * 0.26); c.beginPath(); c.moveTo(s / 2, s / 2); c.lineTo(s / 2 + Math.cos(a) * l, s / 2 + Math.sin(a) * l); c.stroke(); }
    });
    this.decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: holeTex, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }), this.DN);
    this.decals.frustumCulled = false; this.decals.count = 0; this.decals.renderOrder = 2; root.add(this.decals);

    // ---------------- tracers
    const tg = new THREE.PlaneGeometry(1, 1); tg.translate(0, 0.5, 0);        // grows along +Y
    const tg2 = tg.clone().rotateY(Math.PI / 2);
    const tgeo = new THREE.BufferGeometry();
    tgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...tg.attributes.position.array, ...tg2.attributes.position.array]), 3));
    tgeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([...tg.attributes.uv.array, ...tg2.attributes.uv.array]), 2));
    tgeo.setIndex([...tg.index.array, ...Array.from(tg2.index.array, (i) => i + 4)]);
    const ttex = canvasTex(32, (c, s) => { const gr = c.createLinearGradient(0, 0, s, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, s, s); const g2 = c.createLinearGradient(0, 0, 0, s); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(0.3, 'rgba(0,0,0,1)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); c.globalCompositeOperation = 'destination-in'; c.fillStyle = g2; c.fillRect(0, 0, s, s); });
    this.tracers = Array.from({ length: 48 }, () => {
      const m = new THREE.Mesh(tgeo, new THREE.MeshBasicMaterial({ map: ttex, color: new THREE.Color(5, 3.0, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      m.visible = false; m.frustumCulled = false; root.add(m);
      return { m, t: 0, dur: 0, o: new THREE.Vector3(), d: new THREE.Vector3(), len: 0 };
    });
    this.ti = 0;

    // ---------------- world muzzle flashes (other players) + flash lights
    const ftex = canvasTex(128, (c, s) => {
      c.translate(s / 2, s / 2);
      for (let i = 0; i < 7; i++) { c.rotate(Math.random() * 6.28); const l = s * (0.25 + Math.random() * 0.24), w = s * 0.08; const gr = c.createLinearGradient(0, 0, l, 0); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(1, 'rgba(255,150,40,0)'); c.fillStyle = gr; c.beginPath(); c.moveTo(0, -w); c.lineTo(l, 0); c.lineTo(0, w); c.fill(); }
      const r = c.createRadialGradient(0, 0, 0, 0, 0, s * 0.22); r.addColorStop(0, 'rgba(255,255,240,1)'); r.addColorStop(1, 'rgba(255,200,90,0)'); c.fillStyle = r; c.fillRect(-s / 2, -s / 2, s, s);
    });
    this.flashTex = ftex;
    this.flashes = Array.from({ length: 10 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ftex, color: new THREE.Color(6, 4, 2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); s.visible = false; root.add(s); return { s, t: 0 }; });
    this.fi = 0;
    this.lights = Array.from({ length: 2 }, () => { const l = new THREE.PointLight(0xffb060, 0, 14, 2); engine.scene.add(l); return { l, t: 0 }; });
    this.li = 0;

    // ---------------- shell casings
    const sg = new THREE.CylinderGeometry(0.006, 0.006, 0.028, 6); sg.rotateZ(Math.PI / 2);
    const sm = new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 1, roughness: 0.3 });
    this.shells = Array.from({ length: 24 }, () => { const m = new THREE.Mesh(sg, sm); m.visible = false; engine.scene.add(m); return { m, v: new THREE.Vector3(), w: new THREE.Vector3(), t: 0, floor: 0, rest: false }; });
    this.si = 0;

    // ---------------- dust motes drifting in the air around the camera
    const MN = 260, mp = new Float32Array(MN * 3);
    for (let i = 0; i < MN * 3; i++) mp[i] = (Math.random() - 0.5) * 18;
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    this.motes = new THREE.Points(mg, new THREE.ShaderMaterial({
      uniforms: { map: { value: softDot() }, cam: { value: new THREE.Vector3() }, t: { value: 0 }, scale: { value: 800 }, tint: { value: new THREE.Color(2.2, 1.6, 1.0) } },
      vertexShader: 'uniform vec3 cam; uniform float t, scale; varying float vA; void main(){ vec3 p = position + vec3(sin(t * 0.21 + position.z) * 0.6, t * 0.05 + sin(t * 0.3 + position.x) * 0.2, cos(t * 0.17 + position.y) * 0.6); p = mod(p - cam + 9.0, 18.0) - 9.0; vec4 mv = viewMatrix * vec4(p + cam, 1.0); float d = length(p); vA = smoothstep(9.0, 5.0, d) * smoothstep(0.3, 1.5, d); gl_Position = projectionMatrix * mv; gl_PointSize = 0.022 * scale / max(0.1, -mv.z); }',
      fragmentShader: 'uniform sampler2D map; uniform vec3 tint; varying float vA; void main(){ float a = texture2D(map, gl_PointCoord).a * vA * 0.5; gl_FragColor = vec4(tint * a, 0.0); }',
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    }));
    this.motes.frustumCulled = false; root.add(this.motes);
  }

  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, add = 0, grav = 0, drag = 0) {
    const i = this.pi; this.pi = (i + 1) % N;
    const p = this.p[i];
    p.life = p.max = life; p.vx = vx; p.vy = vy; p.vz = vz; p.s0 = s0; p.s1 = s1; p.r = r; p.g = g; p.b = b; p.a = a; p.add = add; p.grav = grav; p.drag = drag;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
  }

  impact(p, n, surf = 'concrete', decal = true) {
    const c = SURF_COL[surf] || SURF_COL.concrete, R = Math.random;
    const light = this.engine.sunTint || 1.4;
    const k = surf === 'flesh' ? 5 : surf === 'metal' ? 3 : 8;
    for (let i = 0; i < k; i++) {
      const sp = 0.6 + R() * 2.2;
      this.emit(p.x, p.y, p.z, n.x * sp + (R() - 0.5) * 1.5, n.y * sp + (R() - 0.3) * 1.5, n.z * sp + (R() - 0.5) * 1.5, 0.45 + R() * 0.7, 0.05, 0.35 + R() * 0.5,
        c[0] * light, c[1] * light, c[2] * light, surf === 'flesh' ? 0.6 : 0.3, 0, surf === 'flesh' ? 5 : 0.4, 2.5);
    }
    if (surf === 'metal' || surf === 'concrete') {
      const sparks = surf === 'metal' ? 10 : 3;
      for (let i = 0; i < sparks; i++) { const sp = 3 + R() * 7; this.emit(p.x, p.y, p.z, n.x * sp + (R() - 0.5) * 6, n.y * sp + (R() - 0.2) * 6, n.z * sp + (R() - 0.5) * 6, 0.12 + R() * 0.3, 0.035, 0.01, 9, 5, 1.8, 1, 1, 12, 0.5); }
    }
    if (surf !== 'flesh' && surf !== 'water') for (let i = 0; i < 4; i++) { const sp = 2 + R() * 3; this.emit(p.x, p.y, p.z, n.x * sp + (R() - 0.5) * 3, n.y * sp + R() * 2.5, n.z * sp + (R() - 0.5) * 3, 0.5 + R() * 0.4, 0.022, 0.016, c[0] * 0.7, c[1] * 0.7, c[2] * 0.7, 1, 0, 14, 0.3); }
    if (surf === 'water') for (let i = 0; i < 10; i++) this.emit(p.x, p.y, p.z, (R() - 0.5) * 1.5, 2 + R() * 3.5, (R() - 0.5) * 1.5, 0.5 + R() * 0.4, 0.06, 0.2, 1.6, 1.7, 1.8, 0.5, 0, 11, 0.5);
    if (decal && surf !== 'flesh' && surf !== 'water') {
      const i = this.di; this.di = (i + 1) % this.DN; this.decals.count = Math.max(this.decals.count, i + 1);
      _n.set(n.x, n.y, n.z); _q.setFromUnitVectors(_z, _n);
      const s = 0.075 + R() * 0.05;
      _m.compose(_v.set(p.x + n.x * 0.006, p.y + n.y * 0.006, p.z + n.z * 0.006), _q.multiply(new THREE.Quaternion().setFromAxisAngle(_z, R() * 6.28)), _s.set(s, s, s));
      this.decals.setMatrixAt(i, _m); this.decals.instanceMatrix.needsUpdate = true;
    }
  }

  tracer(o, e) {
    const tr = this.tracers[this.ti]; this.ti = (this.ti + 1) % this.tracers.length;
    tr.o.copy(o); tr.d.copy(e).sub(o); tr.len = tr.d.length(); if (tr.len < 2.5) return; tr.d.divideScalar(tr.len);
    tr.t = 0; tr.dur = tr.len / 300; tr.m.visible = true;
    tr.m.quaternion.setFromUnitVectors(_v.set(0, 1, 0), tr.d);
  }
  flash(pos, size = 0.5, lightIntensity = 26) {
    const f = this.flashes[this.fi]; this.fi = (this.fi + 1) % this.flashes.length;
    f.s.position.copy(pos); f.s.scale.setScalar(size * (0.8 + Math.random() * 0.5)); f.s.material.rotation = Math.random() * 6.28; f.s.visible = true; f.t = 0.045;
    const l = this.lights[this.li]; this.li = (this.li + 1) % this.lights.length;
    l.l.position.copy(pos); l.l.intensity = lightIntensity; l.t = 0.06;
    for (let i = 0; i < 2; i++) this.emit(pos.x, pos.y, pos.z, (Math.random() - 0.5) * 0.4, 0.3 + Math.random() * 0.3, (Math.random() - 0.5) * 0.4, 0.6 + Math.random() * 0.5, 0.06, 0.4, 0.8, 0.8, 0.8, 0.1, 0, -0.3, 1.5);
  }
  shell(pos, vel, floorY) {
    const s = this.shells[this.si]; this.si = (this.si + 1) % this.shells.length;
    s.m.position.copy(pos); s.v.copy(vel); s.w.set(Math.random() * 30, Math.random() * 30, Math.random() * 30); s.t = 2.5; s.floor = floorY + 0.008; s.rest = false; s.m.visible = true;
  }

  update(dt, camera) {
    const scale = this.engine.renderer.getDrawingBufferSize(_v).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    this.pmat.uniforms.scale.value = scale;
    const pos = this.pos, col = this.col, siz = this.siz;
    for (let i = 0; i < N; i++) {
      const p = this.p[i];
      if (p.life <= 0) { if (siz[i * 2] !== 0) siz[i * 2] = 0; continue; }
      p.life -= dt;
      if (p.life <= 0) { siz[i * 2] = 0; continue; }
      const k = 1 - p.life / p.max, dr = Math.max(0, 1 - p.drag * dt);
      p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - p.grav * dt;
      pos[i * 3] += p.vx * dt; pos[i * 3 + 1] += p.vy * dt; pos[i * 3 + 2] += p.vz * dt;
      siz[i * 2] = p.s0 + (p.s1 - p.s0) * k; siz[i * 2 + 1] = p.add;
      col[i * 4] = p.r; col[i * 4 + 1] = p.g; col[i * 4 + 2] = p.b; col[i * 4 + 3] = p.a * (1 - k) * Math.min(1, k * 12);
    }
    const g = this.pg; g.attributes.position.needsUpdate = true; g.attributes.pcol.needsUpdate = true; g.attributes.psize.needsUpdate = true;

    for (const tr of this.tracers) {
      if (!tr.m.visible) continue;
      tr.t += dt;
      const head = Math.min(tr.len, tr.t * 300), seg = Math.min(9, tr.len * 0.6), tail = Math.max(0, head - seg);
      if (tr.t > tr.dur + seg / 300) { tr.m.visible = false; continue; }
      tr.m.position.copy(tr.o).addScaledVector(tr.d, tail);
      const w = 0.03 + tr.m.position.distanceTo(camera.position) * 0.0016;
      tr.m.scale.set(w, Math.max(0.01, head - tail), w);
    }
    for (const f of this.flashes) if (f.s.visible) { f.t -= dt; if (f.t <= 0) f.s.visible = false; }
    for (const l of this.lights) if (l.l.intensity > 0) { l.t -= dt; if (l.t <= 0) l.l.intensity = 0; }
    for (const s of this.shells) {
      if (!s.m.visible) continue;
      s.t -= dt; if (s.t <= 0) { s.m.visible = false; continue; }
      if (s.rest) continue;
      s.v.y -= 12 * dt; s.m.position.addScaledVector(s.v, dt);
      s.m.rotation.x += s.w.x * dt; s.m.rotation.y += s.w.y * dt;
      if (s.m.position.y < s.floor) { s.m.position.y = s.floor; if (Math.abs(s.v.y) < 0.9) { s.rest = true; s.m.rotation.set(0, Math.random() * 6, 0); } else { s.v.y *= -0.4; s.v.x *= 0.6; s.v.z *= 0.6; } }
    }
    this.motes.visible = G.uRain.value < 0.05;                      // dust hangs in dry air only
    const mu = this.motes.material.uniforms; mu.cam.value.copy(camera.position); mu.t.value += dt; mu.scale.value = scale;
  }
}
