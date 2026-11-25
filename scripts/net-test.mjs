// Protocol smoke test against a running server: node scripts/net-test.mjs [ws://localhost:8090]
import WebSocket from 'ws';
import { MAX_PLAYERS } from '../shared/sim.js';
import { leanBits, leanOf } from '../shared/collision.js';
const base = process.argv[2] || 'ws://localhost:8090';
const connect = (name, room = 'test') => new Promise((res, rej) => {
  const ws = new WebSocket(`${base}/ws?name=${name}&room=${room}&mode=tdm&fill=6`), c = { ws, name, msgs: {}, hi: null, snap: null, closed: null };
  ws.on('message', (d) => { const m = JSON.parse(d); c.msgs[m.t] = (c.msgs[m.t] || 0) + 1; if (m.t === 'hi') { c.hi = m; res(c); } if (m.t === 'snap') c.snap = m; if (m.t === 'full') { c.full = true; res(c); } });
  ws.on('close', (code, reason) => { c.closed = `${code} ${reason}`; }); ws.on('error', rej);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const a = await connect('Alice'), b = await connect('Bob');
console.log('hi:', a.hi.mode, a.hi.level, 'roster', a.hi.ents.length, '| teams', a.hi.ents.find((e) => e.id === a.hi.id).team, b.hi.ents.find((e) => e.id === b.hi.id).team);
a.ws.send(JSON.stringify({ t: 'st', p: [1, 0, 2], yw: 0.5, pt: 0, f: 2 | leanBits(-1), w: 'pistol' }));      // walking, leaning all the way left
a.ws.send(JSON.stringify({ t: 'chat', s: 'hello' }));
await sleep(700);
const sa = b.snap.s.find((s) => s[0] === a.hi.id);
console.log('bob sees alice at', sa.slice(1, 4), 'weapon', sa[7], '| leaning left:', leanOf(sa[6]) === -1 && (sa[6] & 2) === 2, '| entities in snapshot', b.snap.s.length, '| bob msgs', JSON.stringify(b.msgs));
const status = await (await fetch(base.replace('ws', 'http') + '/status')).json(); console.log('status', JSON.stringify(status), '| names its players:', status.find((r) => r.room === 'test')?.names?.join() === 'Alice,Bob');
// fill the room to the cap and try one more
const more = await Promise.all(Array.from({ length: MAX_PLAYERS - 2 }, (_, i) => connect('P' + i)));
await sleep(500);
const last = await connect('Late'); await sleep(300);
console.log(`${MAX_PLAYERS} connected:`, more.every((m) => m.hi), `| player ${MAX_PLAYERS + 1} rejected:`, !!last.full, last.closed, `| snapshot ents with ${MAX_PLAYERS} humans:`, a.snap.s.length);
const t0 = a.msgs.snap; await sleep(2000); console.log('snapshots/s:', (a.msgs.snap - t0) / 2);
for (const c of [a, b, ...more]) c.ws.close();
await sleep(300); console.log('rooms after leave:', JSON.stringify(await (await fetch(base.replace('ws', 'http') + '/status')).json()));
process.exit(0);
