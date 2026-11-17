// IRONTIDE dedicated server: serves the built client (dist/) and hosts WebSocket rooms.
// Each room runs one authoritative GameSim (shared/sim.js). Up to MAX_PLAYERS (64) players per room.
//   node server/index.js [--port 8787] [--mode tdm|dm|campaign] [--fill 12] [--skill normal] [--level drydock]
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { GameSim, TICK, MAX_PLAYERS } from '../shared/sim.js';
import { LEVELS, DEFAULT_LEVEL, recommendedPlayers } from '../shared/levels/index.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : process.env[k.toUpperCase()] ?? d; };
const PORT = +arg('port', 8787);
const DEFAULTS = { mode: arg('mode', 'tdm'), fill: +arg('fill', 12), skill: arg('skill', 'normal'), level: arg('level', DEFAULT_LEVEL) };
const DIST = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.hdr': 'application/octet-stream', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.ico': 'image/x-icon' };

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/status') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify([...rooms.values()].map((r) => ({ room: r.name, mode: r.sim.mode, players: r.clients.size, max: MAX_PLAYERS, level: r.sim.level.id, recommended: recommendedPlayers(r.sim.level) })))); }
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(DIST, p));
    if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
    await stat(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': p.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache' });
    res.end(await readFile(file));
  } catch { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('Not found. Run "npm run build" first to create dist/.'); }
});

const rooms = new Map();
let nextId = 1;
function getRoom(name, q) {
  let r = rooms.get(name);
  if (r) return r;
  const mode = ['dm', 'tdm', 'campaign'].includes(q.get('mode')) ? q.get('mode') : DEFAULTS.mode;
  const fill = Math.max(0, Math.min(MAX_PLAYERS, Number.isFinite(+q.get('fill')) && q.get('fill') !== null ? +q.get('fill') : DEFAULTS.fill));
  const level = LEVELS[q.get('level')] ? q.get('level') : DEFAULTS.level;
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
  room.sim.addPlayer(id, (q.get('name') || 'Player').replace(/[^\w \-.]/g, '').slice(0, 16) || 'Player');
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
server.listen(PORT, () => console.log(`IRONTIDE server on http://localhost:${PORT}  (rooms default: ${DEFAULTS.mode}, fill ${DEFAULTS.fill})`));
