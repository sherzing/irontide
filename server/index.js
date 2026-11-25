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
function getRoom(name, q) {
  let r = rooms.get(name);
  if (r) return r;
  const mode = MODES.includes(q.get('mode')) ? q.get('mode') : DEFAULTS.mode;
  const fill = Math.max(0, Math.min(MAX_PLAYERS, Number.isFinite(+q.get('fill')) && q.get('fill') !== null ? +q.get('fill') : DEFAULTS.fill));
  const level = ROOM_LEVELS.includes(q.get('level')) ? q.get('level') : DEFAULTS.level;
  r = { name, clients: new Map() };
  r.sim = new GameSim({ mode, fill, skill: DEFAULTS.skill, level }, {
    send: (id, m) => { const ws = r.clients.get(id); if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); },
    broadcast: (m, except) => { const s = JSON.stringify(m); for (const [id, ws] of r.clients) if (id !== except && ws.readyState === 1 && ws.bufferedAmount < 1 << 20) ws.send(s); },
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
  room.clients.set(id, ws);
  room.sim.addPlayer(id, (q.get('name') || 'Player').replace(/[^\w \-.]/g, '').slice(0, 16) || 'Player', parseLook(q.get('look')));
  console.log(`[room ${roomName}] + ${id} (${room.clients.size}/${MAX_PLAYERS})`);
  let budget = 120; ws.alive = true;
  const refill = setInterval(() => { budget = 120; }, 1000);
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (data) => {
    if (--budget < 0) return;                       // crude flood protection
    let m; try { m = JSON.parse(data); } catch { return; }
    room.sim.handle(id, m);
  });
  ws.on('close', () => {
    clearInterval(refill); room.clients.delete(id); room.sim.removePlayer(id);
    console.log(`[room ${roomName}] - ${id} (${room.clients.size}/${MAX_PLAYERS})`);
    if (room.clients.size === 0) { rooms.delete(roomName); console.log(`[room ${roomName}] closed`); }
  });
});

setInterval(() => { for (const r of rooms.values()) { try { r.sim.tick(TICK); } catch (e) { console.error('[tick]', e); } } }, TICK * 1000);
setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 15000);
wss.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is already in use by another program.` : e); process.exit(CONFIG); });   // ws passes the listener's errors on
server.listen(PORT, () => console.log(`IRONTIDE ${BUILD.version} server on http://localhost:${PORT}  (a new room plays ${DEFAULTS.mode} on ${DEFAULTS.level}, filled to ${DEFAULTS.fill}, bots ${DEFAULTS.skill})`));
