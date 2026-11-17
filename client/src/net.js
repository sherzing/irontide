// Transports. Both expose: send(msg), onMessage, update(dt), close(), local(bool), ping.
import { GameSim, TICK } from '../../shared/sim.js';

/** Runs the authoritative sim in-process (quick game with bots, campaign). */
export class LocalTransport {
  constructor(opts, name) {
    this.local = true; this.ping = 0; this.onMessage = () => {}; this.onClose = () => {};
    this.queue = []; this.acc = 0; this.id = 1; this.paused = false;
    this.sim = new GameSim(opts, {
      send: (id, m) => { if (id === this.id) this.queue.push(m); },
      broadcast: (m, except) => { if (except !== this.id) this.queue.push(m); },
    });
    this.sim.addPlayer(this.id, name);
  }
  send(m) { this.sim.handle(this.id, m); }
  update(dt) {
    if (!this.paused) {
      this.acc = Math.min(this.acc + dt, 0.25);
      while (this.acc >= TICK) { this.acc -= TICK; this.sim.tick(TICK); }
    }
    if (this.queue.length) { const q = this.queue; this.queue = []; for (const m of q) this.onMessage(m); }
  }
  close() {}
}

/** WebSocket connection to server/index.js. */
export class WsTransport {
  constructor(url) {
    this.local = false; this.ping = 0; this.onMessage = () => {}; this.onClose = () => {}; this.pingT = 0; this.open = false;
    this.ready = new Promise((res, rej) => {
      const ws = this.ws = new WebSocket(url);
      const to = setTimeout(() => { rej(new Error('Connection timed out')); ws.close(); }, 8000);
      ws.onopen = () => { clearTimeout(to); this.open = true; res(); };
      ws.onerror = () => { clearTimeout(to); rej(new Error('Could not reach the server')); };
      ws.onclose = (e) => { this.open = false; this.onClose(e.reason || 'Disconnected from server'); };
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'pong') { this.ping = Math.round(performance.now() - m.c); return; }
        this.onMessage(m);
      };
    });
  }
  send(m) { if (this.open && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  update(dt) { this.pingT += dt; if (this.pingT > 2) { this.pingT = 0; this.send({ t: 'ping', c: performance.now() }); } }
  close() { this.ws.onclose = null; this.ws.close(); }
}
