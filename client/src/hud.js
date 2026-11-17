// DOM heads-up display. Every setter caches what it last wrote, so calling it each frame costs
// nothing unless a value actually changed; the compass tape is drawn on a small 2D canvas.
import { WEAPONS, WEAPON_ORDER } from '../../shared/weapons.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WNAME = { carbine: 'VK-7', marksman: 'Kestrel', pistol: 'P-9', fall: 'the sea' };
const CARD = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const COL = { acc: '#4fd8c4', accHi: '#9af3e6', ink: '#f2efe8', dim: 'rgba(242,239,232,0.62)', mute: 'rgba(242,239,232,0.4)', danger: '#ff5a3c', warn: '#ffb347' };
const SPAN = 120;                       // degrees of heading visible across the compass tape
const wrap180 = (d) => ((d + 540) % 360) - 180;

export class Hud {
  constructor() {
    this.el = $('#hud'); this.cross = $('#crosshair'); this.ci = [...this.cross.children];
    this.hit = $('#hitmarker'); this.hitT = 0; this.subT = 0; this.dmg = []; this.shots = [];
    const q = (root, s) => root.querySelector(s);
    const h = $('#health'), a = $('#ammo'), o = $('#objective'), m = $('#match'), p = $('#prompt');
    h.querySelector('.segs').innerHTML = '<i></i>'.repeat(10);
    this.d = {
      health: h, hpN: q(h, '.n'), hpSeg: [...h.querySelectorAll('.segs i')],
      ammo: a, mag: q(a, '.mag'), res: q(a, '.res'), wname: q(a, '.name'), wmode: q(a, '.mode'), ticks: q(a, '.ticks'), rl: q(a, '.rl i'), others: q(a, '.others'),
      obj: o, objPips: q(o, '.pips'), objIdx: q(o, '.idx'), objX: q(o, '.x'), objP: q(o, '.p'), objPi: q(o, '.p i'), objE: q(o, '.e'),
      match: m, mT: q(m, '.t'), mA: q(m, '.s1 b'), mAl: q(m, '.s1 span'), mB: q(m, '.s2 b'), mBl: q(m, '.s2 span'),
      prompt: p, promptT: q(p, 'span'), promptP: q(p, 'i'),
      marker: $('#marker'), sub: $('#subtitle'), death: $('#death'), deathP: $('#death p'), banner: $('#banner'), score: $('#scoreboard'),
      kill: $('#killfeed'), chat: $('#chatlog'), net: $('#netstat'), dmg: $('#dmgdir'),
    };
    this.c = {};                           // last written values
    this.am = { key: null, size: 0, tick: [], other: [] };
    // compass
    this.cv = $('#compass canvas'); this.cx = this.cv.getContext('2d');
    this.cmp = { heading: 0, sig: -1, last: -999, markers: [], dirty: true, px: 0, pz: 0, hasPos: false };
    addEventListener('resize', () => this.sizeCompass());
    this.sizeCompass();
    if (document.fonts?.load) Promise.all(['700 20px "Saira Extra Condensed"', '700 12px "JetBrains Mono"', '500 12px "JetBrains Mono"'].map((f) => document.fonts.load(f))).then(() => { this.cmp.dirty = true; }, () => {});
  }

  // one cached write helper: returns true when the value changed
  set(k, v) { if (this.c[k] === v) return false; this.c[k] = v; return true; }
  show(on) { this.el.classList.toggle('hidden', !on); if (on) { this.sizeCompass(); this.cmp.dirty = true; } }

  // ------------------------------------------------------------------ vitals
  setHealth(hp) {
    const v = Math.max(0, Math.ceil(hp)); if (!this.set('hp', v)) return;
    const d = this.d; d.hpN.textContent = v; d.health.classList.toggle('low', v < 35);
    const lit = Math.ceil(v / 10); for (let i = 0; i < 10; i++) d.hpSeg[i].classList.toggle('off', i >= lit);
  }
  /** x (optional): { size: magazine capacity, reload: 0..1 or -1, ammo: {weapon:{mag,res}} for the other-weapons line } */
  setAmmo(mag, res, name, slot, low, x) {
    const d = this.d, am = this.am, key = WEAPON_ORDER.find((k) => WEAPONS[k].slot === slot) || WEAPON_ORDER[0], W = WEAPONS[key], size = x?.size ?? W.mag;
    if (am.key !== key || am.size !== size) {
      am.key = key; am.size = size; this.c.mag = this.c.res = null;
      d.ticks.innerHTML = '<i></i>'.repeat(size); am.tick = [...d.ticks.children];
      d.wname.textContent = name; d.wmode.textContent = W.auto ? 'Auto' : W.bolt ? 'Bolt' : 'Semi';
      am.other = WEAPON_ORDER.filter((k) => k !== key).map((k) => {
        const s = document.createElement('span'); s.innerHTML = `<kbd>${WEAPONS[k].slot + 1}</kbd>${esc(WEAPONS[k].name.split(' ')[0])} <b></b>`;
        return { k, el: s, b: s.querySelector('b'), txt: null };
      });
      d.others.replaceChildren(...am.other.map((o) => o.el));
    }
    if (this.set('mag', mag)) { d.mag.textContent = mag; for (let i = 0; i < am.tick.length; i++) am.tick[i].classList.toggle('off', i >= mag); }
    if (this.set('res', res)) d.res.textContent = res;
    const r = x?.reload ?? -1, st = r >= 0 ? 'reloading' : mag <= 0 ? 'empty' : low ? 'low' : '';
    if (this.set('ammoSt', st)) d.ammo.className = 'vital ' + st;
    if (r >= 0 && this.set('rl', Math.round(r * 200))) d.rl.style.width = (r * 100).toFixed(1) + '%';
    if (x?.ammo) for (const o of am.other) { const a = x.ammo[o.k]; if (!a) continue; const t = a.mag + '/' + a.res; if (o.txt !== t) { o.txt = t; o.b.textContent = t; o.el.classList.toggle('dry', a.mag + a.res === 0); } }
  }
  setCrosshair(px, visible) {
    if (this.set('chV', !!visible)) this.cross.style.opacity = visible ? 1 : 0;
    const g = Math.round(px); if (!this.set('chG', g)) return;
    const [l, r, u, dn] = this.ci;
    l.style.left = -g - 9 + 'px'; r.style.left = g + 'px'; u.style.top = -g - 9 + 'px'; dn.style.top = g + 'px';
  }
  hitmarker(kill) { this.hit.classList.toggle('kill', !!kill); this.hitT = kill ? 0.45 : 0.22; this.hit.style.opacity = 1; }
  damageFrom(worldAngle) { const b = document.createElement('b'); this.d.dmg.appendChild(b); this.dmg.push({ b, a: worldAngle, t: 1.6 }); }

  // ------------------------------------------------------------------ feeds
  killfeed(killer, victim, weapon, hs, me, selfKill) {
    const d = document.createElement('div'); if (me) d.className = 'me';
    d.innerHTML = selfKill ? `${esc(victim)} <em>lost to ${WNAME[weapon] || 'the sea'}</em>` : `${esc(killer)} <em>${WNAME[weapon] || ''}${hs ? ' · head' : ''}</em> ${esc(victim)}`;
    const k = this.d.kill; k.prepend(d); while (k.children.length > 6) k.lastChild.remove(); setTimeout(() => d.remove(), 6100);
  }
  chat(name, text) { const d = document.createElement('div'); d.innerHTML = `<b>${esc(name)}</b>${esc(text)}`; const l = this.d.chat; l.appendChild(d); while (l.children.length > 6) l.firstChild.remove(); setTimeout(() => d.remove(), 9100); }
  netstat(t) { if (this.set('net', t)) this.d.net.textContent = t; }

  // ------------------------------------------------------------------ match / objective
  /** m: null | { left, tdm, a, al, b, bl } — a/b are the two figures, al/bl their small labels */
  setMatch(m) {
    const d = this.d; if (this.set('matchOn', !!m)) d.match.classList.toggle('hidden', !m); if (!m) return;
    const t = Math.max(0, m.left | 0);
    if (this.set('mT', t)) { d.mT.textContent = `${(t / 60) | 0}:${String(t % 60).padStart(2, '0')}`; d.mT.classList.toggle('hot', t <= 30); }
    if (this.set('mTdm', !!m.tdm)) d.match.classList.toggle('tdm', !!m.tdm);
    if (this.set('mA', m.a)) d.mA.textContent = m.a; if (this.set('mAl', m.al)) d.mAl.textContent = m.al ?? '';
    if (this.set('mB', m.b)) d.mB.textContent = m.b; if (this.set('mBl', m.bl)) d.mBl.textContent = m.bl ?? '';
  }
  setObjective(o) {
    const d = this.d; d.obj.classList.toggle('hidden', !o); if (!o) return;
    d.objPips.innerHTML = Array.from({ length: o.n }, (_, i) => `<i class="${i < o.i ? 'done' : i === o.i ? 'cur' : ''}"></i>`).join('');
    d.objIdx.textContent = `${String(o.i + 1).padStart(2, '0')}/${String(o.n).padStart(2, '0')}`;
    d.objX.textContent = o.text;
    d.objP.style.display = o.kind === 'defend' || o.kind === 'interact' ? '' : 'none'; d.objPi.style.width = '0%'; d.objE.textContent = ''; this.c.objE = '';
  }
  objProgress(kind, p, left, en) {
    const d = this.d; d.objPi.style.width = Math.round(p * 100) + '%';
    const t = kind === 'defend' ? `Hold <b>${left}s</b> · Hostiles <b>${en}</b>` : en ? `Hostiles remaining <b>${en}</b>` : '';
    if (this.set('objE', t)) d.objE.innerHTML = t;
  }
  marker(x, y, text, visible) {
    const m = this.d.marker; if (this.set('mkV', !!visible)) m.classList.toggle('hidden', !visible); if (!visible) return;
    m.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
    if (this.set('mkT', text)) m.textContent = text;
  }
  subtitle(who, text) { const s = this.d.sub; s.innerHTML = `<b>${esc(who)}</b><span>${esc(text)}</span>`; s.style.opacity = 1; this.subT = 3.2 + text.length * 0.055; }
  prompt(text, p = 0) {
    const d = this.d; if (this.set('prT', text || null)) { d.prompt.classList.toggle('hidden', !text); if (text) d.promptT.innerHTML = esc(text).replace(/\b(F)\b/, '<kbd>$1</kbd>'); }
    if (text && this.set('prP', Math.round(p * 100))) d.promptP.style.width = Math.round(p * 100) + '%';
  }
  death(text) { if (!this.set('death', text ?? null)) return; this.d.death.classList.toggle('hidden', text == null); if (text != null) this.d.deathP.textContent = text; }
  banner(title, sub = '', sub2 = '') { const b = this.d.banner; b.classList.toggle('hidden', !title); if (title) { b.querySelector('h1').textContent = title; b.querySelector('p').textContent = sub; b.querySelector('.s').textContent = sub2; } }
  scoreboard(show, data) {
    const el = this.d.score; if (this.set('sbOn', !!show)) el.classList.toggle('hidden', !show); if (!show || !data) return;
    const rows = [...data.rows].sort((a, b) => b.k - a.k || a.d - b.d || (a.name < b.name ? -1 : 1));
    // one table per column, so that a full 64-player match fits on screen: the two teams side by side, or the
    // free-for-all ranking split into two or three columns. Row height shrinks with the longest column (--n in ui.css).
    let cols;
    if (data.teams) cols = [1, 2].map((t) => ({ cls: 't' + t, head: t === 1 ? 'Blue team' : 'Red team', rows: rows.filter((r) => r.team === t), from: 0 }));
    else { const n = rows.length > 40 ? 3 : rows.length > 16 ? 2 : 1, per = Math.ceil(rows.length / n); cols = Array.from({ length: n }, (_, c) => ({ cls: '', head: 'Player', rows: rows.slice(c * per, (c + 1) * per), from: c * per })); }
    const table = (c) => `<table class="${c.cls}"><tr><th class="r">#</th><th>${c.head}</th><th class="n">Kills</th><th class="n">Deaths</th></tr>${c.rows.map((r, i) =>
      `<tr class="${r.me ? 'me' : ''}"><td class="r">${c.from + i + 1}</td><td>${esc(r.name)}${r.bot ? '<span class="bot">BOT</span>' : ''}</td><td class="n">${r.k}</td><td class="n">${r.d}</td></tr>`).join('')}</table>`;
    const html = `<h3>${esc(data.title)}</h3><div class="sub lbl">${rows.length} in the yard${data.teams ? ' · blue vs red' : ''}</div><div class="cols">${cols.map(table).join('')}</div>`;
    if (this.set('sbHtml', html)) { el.innerHTML = html; el.dataset.cols = cols.length; el.style.setProperty('--n', Math.max(8, ...cols.map((c) => c.rows.length))); }
  }

  // ------------------------------------------------------------------ compass
  /** Notes hostile gunfire at a world position; shows as a short-lived red tick on the compass. */
  gunfire(x, z) {
    for (const s of this.shots) if (Math.abs(s.x - x) < 2.5 && Math.abs(s.z - z) < 2.5) { s.t = 1.8; s.x = x; s.z = z; return; }
    if (this.shots.length >= 12) this.shots.shift();
    this.shots.push({ x, z, t: 1.8 });
  }
  /** headingDeg: 0 = north (−z), 90 = east (+x). markers: [{ bearing, kind: 'obj'|'ammo'|…, label?, dist? }]. pos: player {x,z} (for gunfire ticks). */
  setCompass(headingDeg, markers = [], pos = null) {
    const c = this.cmp; c.heading = headingDeg; c.markers = markers;
    if (pos) { c.px = pos.x; c.pz = pos.z; c.hasPos = true; }
    let sig = markers.length; for (const m of markers) sig = (sig * 31 + Math.round(m.bearing * 4) + Math.round(m.dist || 0) * 1009 + (m.kind === 'obj' ? 7 : 3)) | 0;
    if (sig !== c.sig) { c.sig = sig; c.dirty = true; }
  }
  sizeCompass() {
    const cv = this.cv, w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    this.cu = W / 660; this.cmp.dirty = true;                 // canvas pixels per design unit (tape is 660 x 82 units)
  }
  drawCompass() {
    const c = this.cmp, g = this.cx, W = this.cv.width, H = this.cv.height, u = this.cu; if (!W || !u) return;
    const h = c.heading, ppd = W / SPAN, mid = W / 2;
    const shadow = (blur = 3, col = 'rgba(0,0,0,0.95)', oy = 1) => { g.shadowColor = col; g.shadowBlur = blur * u; g.shadowOffsetY = oy * u; };
    g.clearRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; shadow();
    // tape: hairline, ticks every 5°, labels every 15°
    g.fillStyle = 'rgba(242,239,232,0.3)'; g.fillRect(0, 26 * u, W, Math.max(1, u));
    const first = Math.ceil((h - SPAN / 2) / 5) * 5;
    for (let deg = first; deg <= h + SPAN / 2; deg += 5) {
      const dd = ((deg % 360) + 360) % 360, x = Math.round(mid + (deg - h) * ppd);
      const card = dd % 45 === 0, major = dd % 15 === 0, len = (card ? 14 : major ? 10 : 6) * u, w = Math.max(1, Math.round((card ? 2.4 : major ? 1.6 : 1.2) * u));
      g.fillStyle = card ? COL.ink : major ? 'rgba(242,239,232,0.85)' : 'rgba(242,239,232,0.55)';
      g.fillRect(x - w / 2, 26 * u, w, len);
      if (card) {
        const name = CARD[dd / 45], main = name.length === 1;
        g.font = `${main ? 700 : 600} ${(main ? 25 : 17) * u}px "Saira Extra Condensed", sans-serif`;
        g.fillStyle = name === 'N' ? COL.accHi : main ? COL.ink : COL.dim;
        g.fillText(name, x, 61 * u);
      } else if (major) {
        g.font = `500 ${10.5 * u}px "JetBrains Mono", monospace`; g.fillStyle = COL.dim;
        g.fillText(String(dd).padStart(3, '0'), x, 55 * u);
      }
    }
    // hostile gunfire: red ticks that fade (arrow at the edge when outside the visible arc)
    if (c.hasPos) for (const s of this.shots) {
      const b = Math.atan2(s.x - c.px, -(s.z - c.pz)) * 57.29578, off = wrap180(b - h), lim = SPAN / 2 - 23;
      const x = mid + Math.max(-lim, Math.min(lim, off)) * ppd;
      g.globalAlpha = Math.min(1, s.t / 0.9); g.fillStyle = COL.danger; shadow(8, 'rgba(255,60,30,0.95)', 0);
      if (Math.abs(off) > lim) { const sg = Math.sign(off); g.beginPath(); g.moveTo(x + sg * 8 * u, 33 * u); g.lineTo(x, 26 * u); g.lineTo(x, 40 * u); g.fill(); }
      else { g.fillRect(x - 1.75 * u, 22 * u, 3.5 * u, 21 * u); g.beginPath(); g.moveTo(x - 5 * u, 16 * u); g.lineTo(x + 5 * u, 16 * u); g.lineTo(x, 22 * u); g.fill(); }
      g.globalAlpha = 1; shadow();
    }
    // pinned markers: supply pips first, objective on top
    const OL = SPAN / 2 - 25; let oLo = 1e9, oHi = -1e9;          // arc the objective marker + its label occupy
    for (const m of c.markers) if (m.kind === 'obj') { const o = wrap180(m.bearing - h), x = Math.max(-OL, Math.min(OL, o)), left = o > OL; oLo = Math.min(oLo, x - (left ? 17 : 5)); oHi = Math.max(oHi, x + (left ? 5 : 17)); }
    for (const m of c.markers) {
      if (m.kind === 'obj') continue;
      const off = wrap180(m.bearing - h);
      if (Math.abs(off) > SPAN / 2 - 22 || (m.dist != null && m.dist < 2.5) || (off > oLo && off < oHi)) continue;
      const x = mid + off * ppd, y = 71 * u, r = 3.4 * u;
      g.strokeStyle = COL.warn; g.lineWidth = 1.6 * u; g.strokeRect(x - r, y - r, r * 2, r * 2);
      g.fillStyle = COL.warn; g.fillRect(x - 1.1 * u, y - 1.1 * u, 2.2 * u, 2.2 * u);
    }
    for (const m of c.markers) {
      if (m.kind !== 'obj') continue;
      const off = wrap180(m.bearing - h), lim = OL, out = Math.abs(off) > lim, sg = Math.sign(off);
      const x = mid + Math.max(-lim, Math.min(lim, off)) * ppd, y = 71 * u, r = 6 * u;
      g.fillStyle = COL.acc; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.fill();
      if (out) { g.beginPath(); g.moveTo(x + sg * (r + 8 * u), y); g.lineTo(x + sg * (r + 2.5 * u), y - 4.5 * u); g.lineTo(x + sg * (r + 2.5 * u), y + 4.5 * u); g.fill(); }
      if (m.dist != null) {
        const left = out && sg > 0;                       // keep the text inside the tape when pinned to the right edge
        g.font = `700 ${12.5 * u}px "JetBrains Mono", monospace`; g.fillStyle = COL.accHi; g.textAlign = left ? 'right' : 'left';
        g.fillText(`${m.label ? m.label + ' ' : ''}${Math.round(m.dist)}m`, x + (left ? -1 : 1) * (r + (out && !left ? 13 : 6) * u), y + 4.5 * u);
        g.textAlign = 'center';
      }
    }
    // heading readout + caret
    const num = String(Math.round(h) % 360).padStart(3, '0'), name = CARD[Math.round(h / 45) % 8];
    g.font = `700 ${14.5 * u}px "JetBrains Mono", monospace`; const wNum = g.measureText(num).width;
    g.font = `700 ${11 * u}px "JetBrains Mono", monospace`; const wName = g.measureText(name).width, gap = 6 * u, x0 = mid - (wNum + gap + wName) / 2;
    g.textAlign = 'left'; g.fillStyle = COL.accHi; g.fillText(name, x0 + wNum + gap, 13 * u);
    g.font = `700 ${14.5 * u}px "JetBrains Mono", monospace`; g.fillStyle = COL.ink; g.fillText(num, x0, 13.5 * u);
    g.fillStyle = COL.acc; g.beginPath(); g.moveTo(mid - 5.5 * u, 17.5 * u); g.lineTo(mid + 5.5 * u, 17.5 * u); g.lineTo(mid, 25 * u); g.fill();
  }

  // ------------------------------------------------------------------ per frame
  update(dt, viewYaw) {
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) this.hit.style.opacity = 0; }
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) this.d.sub.style.opacity = 0; }
    for (let i = this.dmg.length - 1; i >= 0; i--) {
      const d = this.dmg[i]; d.t -= dt;
      if (d.t <= 0) { d.b.remove(); this.dmg.splice(i, 1); continue; }
      d.b.style.opacity = Math.min(1, d.t); d.b.style.transform = `rotate(${viewYaw - d.a}rad)`;
    }
    const c = this.cmp; let live = false;
    for (let i = this.shots.length - 1; i >= 0; i--) { const s = this.shots[i]; s.t -= dt; live = true; if (s.t <= 0) this.shots.splice(i, 1); }
    if (c.dirty || live || Math.abs(wrap180(c.heading - c.last)) > 0.02) { c.dirty = false; c.last = c.heading; this.drawCompass(); }
  }
  reset() {
    const d = this.d; d.kill.innerHTML = ''; d.chat.innerHTML = '';
    this.setObjective(null); this.setMatch(null); this.death(null); this.banner(null); this.prompt(null); this.marker(0, 0, '', false); this.scoreboard(false);
    d.sub.style.opacity = 0; for (const x of this.dmg) x.b.remove(); this.dmg = []; this.shots = [];
    this.cmp.markers = []; this.cmp.sig = -1; this.cmp.dirty = true; this.c = {}; this.am.key = null;
  }
}
