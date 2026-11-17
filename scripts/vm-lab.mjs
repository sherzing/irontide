// Viewmodel lab driver (see client/src/vmlab.js).
//   node scripts/vm-lab.mjs <out.jpg> views <weapon>                 hip / aimed / orbit views
//   node scripts/vm-lab.mjs <out.jpg> strip <weapon> <clip> [n] [view]   animation filmstrip (first-person by default)
//   node scripts/vm-lab.mjs <out.jpg> poses <weapon>                 sprint / firing / draw / landing poses
//   node scripts/vm-lab.mjs - trace                                  continuity + frame-rate stability report
//   node scripts/vm-lab.mjs <out.jpg> eval '<js run in page>'
import { launch } from './browser.mjs';
const [out, mode, a1, a2, a3, a4] = process.argv.slice(2);
const base = process.env.BASE || 'http://127.0.0.1:5177';
const { browser, page, errors } = await launch({ width: +(process.env.W || 1600), height: +(process.env.H || 900) });
await page.goto(base + '/vmlab.html');
await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
if (process.env.YAW) await page.evaluate((y) => { window.lab.camera.rotation.y = y; }, +process.env.YAW);
const shot = async () => { if (out !== '-') { await page.screenshot({ path: out, type: 'jpeg', quality: 90 }); console.log('saved', out); } };
if (mode === 'views') {
  await page.evaluate((w) => {
    const L = window.lab, s = L.state, cam = L.camera;
    L.vm.setWeapon(w); L.settle(1.5);
    const hip = () => { s.ads = false; cam.fov = 78; L.settle(0.8); }, ads = () => { s.ads = true; cam.fov = 52; L.settle(0.8); };
    L.sheet([{ view: 'left', pre: hip }, { view: 'right' }, { view: 'q' }, { view: 'top' }, { view: 'q2' }, { view: 'under' }], 2);
  }, a1);
  await shot();
} else if (mode === 'fp') {
  await page.evaluate(([w, what]) => {
    const L = window.lab, s = L.state, cam = L.camera;
    L.vm.setWeapon(w); L.settle(1.5);
    if (what === 'ads') { s.ads = true; cam.fov = { carbine: 52, pistol: 60, marksman: 40 }[w]; } else { s.ads = false; cam.fov = 78; }
    L.settle(0.9); L.sheet([{ view: 'fp' }], 1);
  }, [a1, a2 || 'hip']);
  await shot();
} else if (mode === 'hands') {
  await page.evaluate(([w, fl, fr]) => {
    const L = window.lab, s = L.state, cam = L.camera;
    L.vm.setWeapon(w); s.ads = false; cam.fov = 78; L.settle(1.5);
    const l = { focus: JSON.parse(fl), dist: 0.62 }, r = { focus: JSON.parse(fr), dist: 0.62 };
    L.sheet([{ view: 'left', ...l }, { view: 'under', ...l }, { view: 'q', ...l }, { view: 'rear', ...l }, { view: 'front', ...l }, { view: 'top', ...l }, { view: 'right', ...r }, { view: 'rear', ...r }, { view: 'q', ...r }, { view: 'under', ...r }, { view: 'front', ...r }, { view: 'left', ...r }], 4);
  }, [a1, a2 || '[0,-0.03,-0.26]', a3 || '[0,-0.09,0.08]']);
  await shot();
} else if (mode === 'strip') {
  await page.evaluate(([w, clip, n, view]) => {
    const L = window.lab, s = L.state, cam = L.camera, WE = { carbine: [2.1, 720], pistol: [1.5, 420], marksman: [2.9, 46] }[w];
    L.vm.setWeapon(w); s.ads = false; cam.fov = 78; L.settle(1.5);
    const dur = clip === 'reload' ? WE[0] : 60 / WE[1] * 0.85, cells = []; let t = 0;
    for (let k = 0; k < n; k++) {
      const target = (k + 0.5) / n;
      cells.push({ view, focus: [0, -0.05, -0.05], dist: 2.4, pre: () => { while (t < target) { t = Math.min(target, t + (1 / 120) / dur); s[clip] = t; L.step(1 / 120); } } });
    }
    L.sheet(cells, n > 8 ? 4 : n > 4 ? Math.ceil(n / 2) : n);
    s[clip] = -1;
  }, [a1, a2 || 'reload', +(a3 || 12), a4 || 'fp']);
  await shot();
} else if (mode === 'frames') {       // frames <weapon> <clip> <t1,t2,...> [view] [cols]
  await page.evaluate(([w, clip, times, view, cols]) => {
    const L = window.lab, s = L.state, cam = L.camera, WE = { carbine: [2.1, 720], pistol: [1.5, 420], marksman: [2.9, 46] }[w];
    L.vm.setWeapon(w); s.ads = false; cam.fov = 78; L.settle(1.5);
    const dur = clip === 'reload' ? WE[0] : 60 / WE[1] * 0.85; let t = 0;
    L.sheet(times.map((target) => ({ view, focus: [0, -0.06, -0.06], dist: 1.0, pre: () => { while (t < target) { t = Math.min(target, t + (1 / 120) / dur); s[clip] = t; L.step(1 / 120); } } })), cols);
    s[clip] = -1;
  }, [a1, a2, a3.split(',').map(Number), a4 || 'fp', +(process.argv[8] || 3)]);
  await shot();
} else if (mode === 'side') {         // side <weapon> : left + right orthographic-ish views with a 5 cm grid (red = origin axes)
  await page.evaluate(([w, marks]) => {
    const L = window.lab, s = L.state, cam = L.camera;
    L.vm.setWeapon(w); s.ads = false; cam.fov = 78; L.settle(1.5); L.grid(); if (marks) L.mark(JSON.parse(marks));
    const o = { focus: [0, -0.02, w === 'pistol' ? -0.05 : -0.25], dist: w === 'pistol' ? 2.2 : 6, fov: w === 'pistol' ? 9 : 10 };
    L.sheet([{ view: 'left', ...o }, { view: 'right', ...o }, { view: 'top', ...o }, { view: 'rear', ...o, fov: o.fov * 0.6 }], 2);
  }, [a1, a2]);
  await shot();
} else if (mode === 'orbit') {        // orbit <weapon> <focus [x,y,z]> <dist> <view,view,...>   (env CLIP, T to pose a clip first)
  await page.evaluate(([w, focus, dist, views, clip, T]) => {
    const L = window.lab, s = L.state, cam = L.camera, WE = { carbine: [2.1, 720], pistol: [1.5, 420], marksman: [2.9, 46] }[w];
    L.vm.setWeapon(w); s.ads = false; cam.fov = 78; L.settle(1.5);
    if (clip) { const dur = clip === 'reload' ? WE[0] : 60 / WE[1] * 0.85; let t = 0; while (t < T) { t = Math.min(T, t + (1 / 120) / dur); s[clip] = t; L.step(1 / 120); } }
    L.sheet(views.map((v) => (v === 'fp' ? { view: 'fp' } : { view: v, focus, dist })), views.length > 4 ? 3 : views.length > 1 ? 2 : 1);
  }, [a1, JSON.parse(a2), +a3, a4.split(','), process.env.CLIP || '', +(process.env.T || 0)]);
  await shot();
} else if (mode === 'poses') {
  await page.evaluate((w) => {
    const L = window.lab, s = L.state, cam = L.camera;
    L.vm.setWeapon(w); s.ads = false; cam.fov = 78; L.settle(1.5);
    L.sheet([
      { view: 'fp', pre: () => { s.sprint = true; s.speed = 6.7; L.settle(0.8); } },
      { view: 'fp', pre: () => { s.sprint = false; s.speed = 4.6; L.settle(0.7); } },
      { view: 'fp', pre: () => { s.speed = 0; L.settle(0.8); L.vm.fire(); L.step(1 / 120, 2); } },
      { view: 'fp', pre: () => { L.step(1 / 120, 5); } },
      { view: 'fp', pre: () => { L.settle(0.6); L.vm.landT = 1.2; L.step(1 / 120, 14); } },
      { view: 'fp', pre: () => { L.settle(0.8); L.vm.setWeapon(w === 'pistol' ? 'carbine' : 'pistol'); L.step(1 / 120, 8); } },
      { view: 'fp', pre: () => { L.settle(1.2); L.vm.setWeapon(w); L.step(1 / 120, w === 'marksman' ? 50 : 34); } },
      { view: 'fp', pre: () => { L.settle(1.2); s.look = { x: 40, y: 0 }; L.step(1 / 120, 14); s.look = { x: 0, y: 0 }; } },
    ], 4);
  }, a1);
  await shot();
} else if (mode === 'trace') {
  const r = await page.evaluate(() => {
    const L = window.lab, out = [];
    for (const [w, clips] of Object.entries({ carbine: ['reload'], pistol: ['reload'], marksman: ['reload', 'bolt'] })) {
      if (!L.vm.weapons[w]) continue;
      for (const c of clips) {
        if (!L.vm.weapons[w].clips[c]) continue;
        for (const dt of [1 / 2000, 1 / 500]) out.push(L.trace(w, c, dt));
        out.push(L.trace(w, c, 1 / 1000, { interrupt: 0.42 }));
        if (c === 'reload' && w !== 'marksman') out.push(L.trace(w, c, 1 / 1000, { lock: true }));
        for (const dt of [1 / 144, 1 / 30, 0.1]) out.push(L.trace(w, c, dt));
      }
    }
    return out;
  });
  // verdicts: speeds must be bounded (no teleports), independent of the step size (a pop would scale with 1/dt), and the
  // pose must come back to rest whatever the frame rate.
  const LIM = { v: 6, w: 45, f: 45 }; let fails = 0; const by = {};
  for (const t of r) {
    const tag = `${t.weapon} ${t.clip}`, o = by[tag] || (by[tag] = { fine: [], rates: [] });
    let mv = 0, mw = 0, mf = 0;
    for (const [k, v] of Object.entries(t.res)) { if (k === 'fingers') mf = Math.max(mf, v.w); else { mv = Math.max(mv, v.v || 0); mw = Math.max(mw, v.w || 0); } }
    if (t.lock) console.log(`      (last-round lock; released by the end of the reload: ${!t.locked})`);
    const ok = mv < LIM.v && mw < LIM.w && mf < LIM.f; if (!ok) fails++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${tag.padEnd(16)} dt=1/${String(Math.round(1 / t.dt)).padEnd(5)}${t.interrupt ? ' interrupted@' + t.interrupt + ' swap=' + JSON.stringify(t.swap) : ''}  max ${mv.toFixed(2)} m/s  ${mw.toFixed(1)} rad/s  fingers ${mf.toFixed(1)} rad/s  end=${JSON.stringify(t.end)}`);
    if (process.env.VERBOSE) for (const [k, v] of Object.entries(t.res)) console.log('        ', k.padEnd(8), JSON.stringify(v));
    if (!t.interrupt && !t.lock) { if (t.dt < 1 / 400) o.fine.push([mv, mw]); o.rates.push(t.end); }
  }
  for (const [tag, o] of Object.entries(by)) {
    const [a, b] = o.fine, ratio = a && b ? Math.max(a[0] / b[0], b[0] / a[0], a[1] / b[1], b[1] / a[1]) : 1;
    const spread = Math.max(...[0, 1, 2].map((k) => Math.max(...o.rates.map((e) => e[k])) - Math.min(...o.rates.map((e) => e[k]))));
    const ok = ratio < 1.15 && spread < 0.006; if (!ok) fails++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${tag.padEnd(16)} step-size independence x${ratio.toFixed(3)}   rest-pose spread across 1/2000..1/10 s steps: ${(spread * 1000).toFixed(2)} mm`);
  }
  console.log(fails ? `CONTINUITY: ${fails} FAILED` : 'CONTINUITY: all passed');
} else if (mode === 'eval') { console.log(JSON.stringify(await page.evaluate(a1))); await shot(); }
console.log('errors:', errors.length);
await browser.close();
