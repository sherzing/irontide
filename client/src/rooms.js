// The Multiplayer menu's room list: asks a server which rooms are open (GET /status) and keeps a row for each.
// What a server answers is drawn as text only: it may be someone else's server.
import { LEVELS } from '../../shared/levels/index.js';

const MODE = { dm: 'Deathmatch', tdm: 'Team deathmatch', campaign: 'Co-op mission' };
const EVERY = 3000, SLOW = 15000, PATIENCE = 2500, TYPING = 600;      // ms between questions, and to a server that does not answer; ms to wait for an answer; ms a typed address must rest
const SHOWN = 12;                                                    // rows drawn at most
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
// an answer is JSON from a server that may not be ours: only numbers and strings are taken from it
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
const str = (v, most) => (typeof v === 'string' ? v.slice(0, most) : '');

/** One entry of /status as the list uses it. A server of an older build leaves fields out. */
function entry(r) {
  return {
    room: str(r.room, 24), mode: Object.hasOwn(MODE, r.mode) ? r.mode : 'dm', level: str(r.level, 24),
    players: num(r.players), max: num(r.max) || 64, bots: num(r.bots), names: Array.isArray(r.names) ? r.names.slice(0, 64).map((n) => str(n, 16)).filter(Boolean) : [],
    phase: r.phase === 'end' ? 'end' : 'play', timed: typeof r.left === 'number', left: num(r.left), limit: num(r.limit),
    score: Array.isArray(r.score) ? [num(r.score[0]), num(r.score[1])] : num(r.score), stage: num(r.stage), stages: num(r.stages),
  };
}
/** How far along a room's match is, in a few words. */
function progress(r) {
  if (r.mode === 'campaign') return r.stages ? (r.phase === 'end' ? 'Mission complete' : `Objective ${r.stage} of ${r.stages}`) : '';
  if (!r.timed) return '';
  if (r.phase === 'end') return 'Match over · the next one starts';
  return `${r.mode === 'tdm' && Array.isArray(r.score) ? `Blue ${r.score[0]} · Red ${r.score[1]}` : `Lead ${num(r.score)} of ${r.limit}`} · ${clock(r.left)} left`;
}

export class RoomList {
  /**
   * panel: the element that holds the rows (.list) and a line under them (.note).
   * url(): the status address to ask now; watching(): whether the menu is on screen; onJoin(room): a row was clicked;
   * onChange(): what is known about the rooms changed.
   */
  constructor({ panel, url, watching, onJoin, onChange }) {
    Object.assign(this, { panel, list: panel.querySelector('.list'), note: panel.querySelector('.note'), url, watching, onChange });
    this.rooms = []; this.heard = false; this.silent = false;      // heard: the server answered, so a room that is not listed is not open; silent: it did not
    this.from = null; this.busy = null; this.timer = 0; this.misses = 0; this.typing = 0; this.marked = null;
    this.rows = new Map();
    this.list.addEventListener('click', (e) => { const b = e.target.closest('button.room'); if (b && !b.disabled) onJoin(b.dataset.room); });
    document.addEventListener('visibilitychange', () => this.look());
    this.draw(); this.wait();
  }
  /** Asks, if someone is looking at the menu. */
  look() { if (this.watching() && !document.hidden && !this.typing) this.ask(); else this.wait(); }
  /** Looks again EVERY ms from now; a server that did not answer is left alone for SLOW. */
  wait() { clearTimeout(this.timer); this.timer = setTimeout(() => this.look(), this.silent ? SLOW : EVERY); }
  /** The open room of that name, if the server listed one. */
  get(name) { return this.rooms.find((r) => r.room === name); }
  /** People in open rooms. */
  get playing() { return this.rooms.reduce((n, r) => n + r.players, 0); }
  /** The address is being typed: forget the old server's rooms now, and ask the new one when the typing rests. */
  moved() { clearTimeout(this.typing); this.from = null; this.set(null, true); this.typing = setTimeout(() => { this.typing = 0; this.ask(); }, TYPING); }
  /** Marks the row of the room the menu's Join button leads to. */
  mark(name) { this.marked = name; for (const [room, row] of this.rows) row.b.classList.toggle('on', room === name); }

  async ask() {
    const url = this.url();
    if (url !== this.from) { this.from = url; this.set(null, true); }      // another server: what was known is about the old one
    if (this.busy === url) return;
    this.busy = url; clearTimeout(this.timer);
    let rooms = null;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(PATIENCE), cache: 'no-store' });
      const body = res.ok ? await res.json() : null;
      if (Array.isArray(body)) rooms = body.filter((r) => r && typeof r === 'object').map(entry).filter((r, i, all) => r.room && all.findIndex((o) => o.room === r.room) === i);
    } catch { /* no answer, or not a game server */ }
    if (this.busy === url) this.busy = null;
    if (url === this.from) this.set(rooms);
    this.wait();
  }
  /** rooms: the answer, or null for none. One missed answer keeps the list; `forget` drops it at once. */
  set(rooms, forget = false) {
    const was = JSON.stringify([this.heard, this.silent, this.rooms]);
    if (rooms) { this.misses = 0; this.rooms = rooms; this.heard = true; this.silent = false; }
    else if (forget) { this.misses = 0; this.rooms = []; this.heard = false; this.silent = false; }
    else if (++this.misses > 1 || !this.heard) { this.rooms = []; this.heard = false; this.silent = true; }
    if (JSON.stringify([this.heard, this.silent, this.rooms]) === was) return;
    this.draw(); this.onChange?.();
  }

  row(room) {
    const b = el('button', 'room'), row = { b }; b.type = 'button'; b.dataset.room = room;
    for (const [k, tag] of [['level', 'b'], ['mode', 'em'], ['who', 'span'], ['names', 'span'], ['state', 'span'], ['join', 'i']]) b.append(row[k] = el(tag, k));
    b.classList.toggle('on', room === this.marked);
    this.rows.set(room, row);
    return row;
  }
  draw() {
    const shown = this.rooms.slice(0, SHOWN), keep = new Set(shown.map((r) => r.room));
    for (const [room, row] of this.rows) if (!keep.has(room)) { row.b.remove(); this.rows.delete(room); }
    shown.forEach((r, i) => {
      const row = this.rows.get(r.room) || this.row(r.room), full = r.players >= r.max;
      const text = { level: LEVELS[r.level]?.name || r.level, mode: MODE[r.mode], who: [`Room ${r.room}`, count(r.players, 'player'), r.bots ? count(r.bots, 'bot') : ''].filter(Boolean).join(' · '),
        names: r.names.join(', '), state: progress(r), join: full ? 'Full' : 'Join' };
      for (const k in text) if (row[k].textContent !== text[k]) row[k].textContent = text[k];
      row.b.disabled = full;
      if (this.list.children[i] !== row.b) this.list.insertBefore(row.b, this.list.children[i] || null);      // a row that stays where it is keeps the keyboard's focus
    });
    const more = this.rooms.length - shown.length;
    this.panel.classList.toggle('silent', this.silent);
    this.note.textContent = this.silent ? 'No answer from the server.' : !this.heard ? 'Asking the server…'
      : !this.rooms.length ? 'Nobody is playing. Open a room and it is listed here, for everyone who opens this menu.'
      : more > 0 ? `and ${count(more, 'more room')}` : 'A room closes when its last player leaves.';
  }
}
