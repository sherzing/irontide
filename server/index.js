// IRONTIDE dedicated server: serves the built client (dist/) and hosts WebSocket rooms.
// Each room runs one authoritative GameSim (shared/sim.js). Up to MAX_PLAYERS (64) players per room.
//   node server/index.js [--port 8787] [--mode tdm|dm|campaign] [--fill 12] [--skill normal] [--level drydock]
//   node server/index.js --check     prints the settings it would start with and exits (1 if one is unusable)
import { createHash } from 'node:crypto';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { WebSocketServer } from 'ws';
import { GameSim, TICK, MAX_PLAYERS } from '../shared/sim.js';
import { LEVELS, DEFAULT_LEVEL, recommendedPlayers } from '../shared/levels/index.js';
import { SKILLS } from '../shared/bots.js';
import { parseLook } from '../shared/crews.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : process.env[k.toUpperCase()] ?? d; };
const PORT = +arg('port', 8787);
const ROOM_LEVELS = Object.keys(LEVELS).filter((id) => !LEVELS[id].training);      // a training level is played alone, from the menu
const DEFAULTS = { mode: arg('mode', 'tdm'), fill: +arg('fill', 12), skill: arg('skill', 'normal'), level: arg('level', DEFAULT_LEVEL) };
const MODES = ['dm', 'tdm', 'campaign'];
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
let BUILD = { version: 'dev' };                   // a packaged release carries build.json (scripts/package.mjs)
try { BUILD = JSON.parse(readFileSync(join(ROOT, 'build.json'), 'utf8')); } catch { /* a source checkout has none */ }

const CONFIG = 78;                                // exit code for a setting to fix; the service units do not restart on it
// A setting no room could use stops the server here, where the operator sees it, not in the first room a player opens.
const unusable = [
  !(Number.isInteger(PORT) && PORT > 0 && PORT < 65536) && `port "${arg('port')}" (1-65535)`,
  !MODES.includes(DEFAULTS.mode) && `mode "${DEFAULTS.mode}" (${MODES.join(', ')})`,
  !(Number.isInteger(DEFAULTS.fill) && DEFAULTS.fill >= 0 && DEFAULTS.fill <= MAX_PLAYERS) && `fill "${arg('fill')}" (0-${MAX_PLAYERS})`,
  !Object.hasOwn(SKILLS, DEFAULTS.skill) && `skill "${DEFAULTS.skill}" (${Object.keys(SKILLS).join(', ')})`,
  !ROOM_LEVELS.includes(DEFAULTS.level) && `level "${DEFAULTS.level}" (${ROOM_LEVELS.join(', ')})`,
].filter(Boolean);
if (unusable.length) { console.error(`Unusable setting: ${unusable.join('; ')}`); process.exit(CONFIG); }
if (process.argv.includes('--check')) { console.log(`settings OK: port ${PORT}, mode ${DEFAULTS.mode}, fill ${DEFAULTS.fill}, skill ${DEFAULTS.skill}, level ${DEFAULTS.level}`); process.exit(0); }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.sky': 'application/octet-stream', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon' };

// Files that shrink in transit are sent packed: the code to a third, models to about two thirds. Textures, skies and
// fonts are packed as they lie. A browser asks for brotli only over HTTPS, so plain HTTP gets gzip. A file is packed
// when it is first asked for and kept for as long as it does not change on disk.
const PACKS = new Set(['.html', '.js', '.css', '.json', '.gltf', '.bin', '.glb', '.svg']);
const PACKERS = { br: (b) => promisify(zlib.brotliCompress)(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: b.length } }), gzip: (b) => promisify(zlib.gzip)(b, { level: 9 }) };
const packed = new Map();                         // "encoding file" -> { tag, body: a promise of the packed bytes }
function pack(file, tag, encoding, bytes) {
  const key = encoding + ' ' + file, hit = packed.get(key);
  if (hit?.tag === tag) return hit.body;
  const body = (bytes ? Promise.resolve(bytes) : readFile(file)).then(PACKERS[encoding]);
  packed.set(key, { tag, body }); body.catch(() => packed.delete(key));
  return body;
}
// A file's tag is a hash of its bytes: a browser that holds the file sends the tag back and gets "not changed" instead of
// the file. A build or an update that leaves a texture as it was therefore costs its players no download.
const tags = new Map();                           // file -> { size, mtimeMs, tag }
async function tagged(file, info) {
  const hit = tags.get(file);
  if (hit && hit.size === info.size && hit.mtimeMs === info.mtimeMs) return { tag: hit.tag };
  const bytes = await readFile(file), tag = `W/"${createHash('sha1').update(bytes).digest('base64url').slice(0, 16)}"`;
  tags.set(file, { size: info.size, mtimeMs: info.mtimeMs, tag });
  return { tag, bytes };
}

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    // the open rooms: a menu's room list reads this every few seconds, also the menu of a page served from somewhere else
    if (p === '/status') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }); return res.end(JSON.stringify([...rooms.values()].map((r) => ({ room: r.name, players: r.clients.size, max: MAX_PLAYERS, recommended: recommendedPlayers(r.sim.level), ...r.sim.status() })))); }
    if (p === '/version') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(BUILD)); }
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(DIST, p));
    if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
    const info = await stat(file), ext = extname(file), { tag, bytes } = await tagged(file, info);
    // A file the build named after its content never changes. A texture, model or sky keeps its name, so a browser holds
    // it for a day and afterwards asks whether it changed, using its copy meanwhile.
    const keep = /^\/assets\/[^/]+$/.test(p) ? 'public, max-age=31536000, immutable' : p.startsWith('/assets/') ? 'public, max-age=86400, stale-while-revalidate=2592000' : 'no-cache';
    const head = { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': keep, etag: tag };
    const accepts = String(req.headers['accept-encoding'] || ''), encoding = !PACKS.has(ext) || info.size < 1024 ? '' : /\bbr\b/.test(accepts) ? 'br' : /\bgzip\b/.test(accepts) ? 'gzip' : '';
    if (PACKS.has(ext)) head.vary = 'accept-encoding';
    if (req.headers['if-none-match'] === tag) { res.writeHead(304, head); return res.end(); }
    if (encoding) head['content-encoding'] = encoding;
    const body = encoding ? await pack(file, tag, encoding, bytes) : bytes || await readFile(file);
    res.writeHead(200, { ...head, 'content-length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('Not found. Run "npm run build" first to create dist/.'); }
});

const rooms = new Map();
let nextId = 1;

// What went oddly for a player, so that "the sound broke up" or "my shots were swallowed" can be read from the log
// afterwards. Three sources: the sim counts shots and hits it delayed or refused (e.odd in shared/sim.js); this file
// counts messages over the flood limit and broadcasts kept back from a connection that was not taking them; and the
// player's own client reports every 10 s what only it can see (client/src/health.js): sound its audio thread did not get
// to play, slow frames, late snapshots, ping. Every LOOK seconds a line is logged for each player something odd happened
// to since the last look, and the sums when they leave.
const LOOK = 10, FLOOD = 120;                     // s between two looks; messages a client may send in a second
const ODD = { snd: 200, slow: 3, fps: 25, dry: 3, gap: 250, ping: 200 };      // in one report of a client: from here on it is logged
const num = (v, max) => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0);
const fresh = () => ({ flood: 0, unsent: 0, reports: 0, snd: 0, slow: 0, dry: 0, gap: 0, ping: 0, fps: 0, cut: 0 });
/** A client's report, added to what it reported since the last look (ws.health) and since it joined (ws.odd). */
function health(ws, m) {
  const h = { snd: num(m.snd, 60000), fps: num(m.fps, 1000), slow: num(m.slow, 1000), gap: num(m.gap, 60000), dry: num(m.dry, 1000), ping: num(m.ping, 60000), cut: num(m.cut, 100000) };
  for (const o of [ws.odd, ws.health ||= fresh()]) {
    o.fps = o.reports++ ? Math.min(o.fps, h.fps) : h.fps;
    o.snd += h.snd; o.slow += h.slow; o.dry += h.dry; o.cut += h.cut; o.gap = Math.max(o.gap, h.gap); o.ping = Math.max(o.ping, h.ping);
  }
}
/** What went oddly for the player on ws: since the last look, or with `sums` since they joined. '' if nothing did. */
function oddLine(room, id, ws, sums = false) {
  const e = room.sim.ents.get(id), o = ws.odd, now = { ...e?.odd, flood: o.flood, unsent: o.unsent }, was = sums ? {} : ws.seen, d = (k) => (now[k] || 0) - (was[k] || 0);
  const h = sums ? null : ws.health, parts = [];
  if (!sums) { ws.seen = now; ws.health = null; }
  if (d('late')) parts.push(`${d('late')} shots arrived in a bunch and went out late`);
  if (d('dropped')) parts.push(`${d('dropped')} shots refused: more than the weapon fires`);
  if (d('range')) parts.push(`${d('range')} hits refused: out of range`);
  if (d('sight')) parts.push(`${d('sight')} hits refused: out of sight`);
  if (d('flood')) parts.push(`${d('flood')} messages dropped: over ${FLOOD} a second`);
  if (d('unsent')) parts.push(`${d('unsent')} messages kept back: the connection was not taking them`);
  if (h) {
    if (h.snd >= ODD.snd) parts.push(`${h.snd} ms of sound not played`);
    if (h.slow >= ODD.slow || h.fps < ODD.fps) parts.push(`${h.fps} frames a second, ${h.slow} of them over 100 ms`);
    if (h.dry >= ODD.dry || h.gap >= ODD.gap) parts.push(`${h.dry} snapshots late, the longest wait ${h.gap} ms`);
    if (h.ping >= ODD.ping || parts.length) parts.push(`ping ${h.ping} ms`);
  }
  if (sums) {
    if (d('dead') || d('gone')) parts.push(`${d('dead')} shots after their own death, ${d('gone')} hits on a target already down`);
    if (o.reports) parts.push(`${o.snd} ms of sound not played`, `${o.cut} sounds left out for being too many`, `${o.slow} frames over 100 ms, at worst ${o.fps} a second`, `${o.dry} snapshots late, the longest wait ${o.gap} ms`, `ping up to ${o.ping} ms`);
  }
  return parts.length ? `[room ${room.name}] ${sums ? 'sums for' : '!'} ${id} ${e?.name || ''}: ${parts.join(' · ')}` : '';
}
function getRoom(name, q) {
  let r = rooms.get(name);
  if (r) return r;
  const mode = MODES.includes(q.get('mode')) ? q.get('mode') : DEFAULTS.mode;
  const fill = Math.max(0, Math.min(MAX_PLAYERS, Number.isFinite(+q.get('fill')) && q.get('fill') !== null ? +q.get('fill') : DEFAULTS.fill));
  const level = ROOM_LEVELS.includes(q.get('level')) ? q.get('level') : DEFAULTS.level;
  r = { name, clients: new Map() };
  r.sim = new GameSim({ mode, fill, skill: DEFAULTS.skill, level }, {
    send: (id, m) => { const ws = r.clients.get(id); if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); },
    broadcast: (m, except) => {
      const s = JSON.stringify(m);
      for (const [id, ws] of r.clients) if (id !== except && ws.readyState === 1) { if (ws.bufferedAmount < 1 << 20) ws.send(s); else ws.odd.unsent++; }      // over 1 MB waiting: the connection is not taking them
    },
  });
  rooms.set(name, r);
  const rec = recommendedPlayers(LEVELS[level]);
  console.log(`[room ${name}] created (${mode}, fill ${fill}, ${level}: suits ${rec.min}-${rec.max} players, cap ${MAX_PLAYERS})`);
  return r;
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
wss.on('connection', (ws, req) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const roomName = (q.get('room') || 'public').slice(0, 24);
  const room = getRoom(roomName, q);
  if (room.clients.size >= MAX_PLAYERS) { ws.send(JSON.stringify({ t: 'full' })); return ws.close(1013, `Server is full (${MAX_PLAYERS} players)`); }
  const id = nextId++;
  ws.odd = fresh(); ws.seen = {}; ws.health = null;
  room.clients.set(id, ws);
  room.sim.addPlayer(id, (q.get('name') || 'Player').replace(/[^\w \-.]/g, '').slice(0, 16) || 'Player', parseLook(q.get('look')));
  console.log(`[room ${roomName}] + ${id} (${room.clients.size}/${MAX_PLAYERS})`);
  let budget = FLOOD; ws.alive = true;
  const refill = setInterval(() => { budget = FLOOD; }, 1000);
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (data) => {
    if (--budget < 0) { ws.odd.flood++; return; }   // crude flood protection
    let m; try { m = JSON.parse(data); } catch { return; }
    if (m && m.t === 'health') return health(ws, m);
    room.sim.handle(id, m);
  });
  ws.on('close', () => {
    const sums = oddLine(room, id, ws, true); if (sums) console.log(sums);
    clearInterval(refill); room.clients.delete(id); room.sim.removePlayer(id);
    console.log(`[room ${roomName}] - ${id} (${room.clients.size}/${MAX_PLAYERS})`);
    if (room.clients.size === 0) { rooms.delete(roomName); console.log(`[room ${roomName}] closed`); }
  });
});

setInterval(() => { for (const r of rooms.values()) { try { r.sim.tick(TICK); } catch (e) { console.error('[tick]', e); } } }, TICK * 1000);
setInterval(() => { for (const r of rooms.values()) for (const [id, ws] of r.clients) { const line = oddLine(r, id, ws); if (line) console.log(line); } }, LOOK * 1000);
setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 15000);
wss.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is already in use by another program.` : e); process.exit(CONFIG); });   // ws passes the listener's errors on
server.listen(PORT, () => console.log(`IRONTIDE ${BUILD.version} server on http://localhost:${PORT}  (a new room plays ${DEFAULTS.mode} on ${DEFAULTS.level}, filled to ${DEFAULTS.fill}, bots ${DEFAULTS.skill})`));
