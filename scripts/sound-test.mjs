// The sound engine in a busy match: does the audio thread keep up?
//   node scripts/sound-test.mjs <url> [seconds] [players]
// Plays a quick match on Drydock (default: 16 players for 60 s) and compares the audio clock with the wall clock every
// 5 s: sound the audio thread did not get to play shows as its clock falling behind. Exits 1 when more than LOST_MS of
// sound went missing, when more than VOICES sounds were left playing at once, or when the page logs an error.
// It has to run for a while: finished sounds that stay connected only break the sound up after about 25 s.
import { launch } from './browser.mjs';

const LOST_MS = 500, VOICES = 40;               // a sound engine that keeps up loses under 200 ms in two minutes
const [base, seconds = '60', players = '16'] = process.argv.slice(2);
if (!base) { console.error('usage: node scripts/sound-test.mjs <url> [seconds] [players]'); process.exit(1); }

const { browser, page, errors } = await launch();
await page.goto(`${base.replace(/\/$/, '')}/?auto=dm&bots=${+players - 1}&level=drydock&q=medium`);
await page.waitForFunction(() => window.__irontide?.game.me?.alive);
await page.evaluate(() => { window.__irontide.game.debugInput = { keys: ['KeyW'], pitch: 0 }; });
console.log(`${players} players on Drydock for ${seconds} s · every 5 s:`);
let clock = null, lost = 0, most = 0;
for (let s = 5; s <= +seconds; s += 5) {
  await page.waitForTimeout(5000);
  const n = await page.evaluate(() => { const a = window.__irontide.game.audio; return { state: a.ctx.state, at: a.ctx.currentTime, wall: performance.now() / 1000, voices: a.live?.length ?? -1, cut: a.cut ?? -1, heap: performance.memory?.usedJSHeapSize || 0 }; });
  const gone = clock ? Math.max(0, (n.wall - clock.wall) - (n.at - clock.at)) : 0; clock = n; lost += gone; most = Math.max(most, n.voices);
  console.log(`  ${String(s).padStart(3)} s  ${n.state} · sound lost ${(gone * 1000).toFixed(0).padStart(5)} ms · voices playing ${String(n.voices).padStart(2)}, not played for being too many ${n.cut} · JS heap ${(n.heap / 1e6).toFixed(0)} MB`);
}
await browser.close();
const ok = lost * 1000 <= LOST_MS && most <= VOICES + 4 && !errors.length;      // a voice that gives way takes 40 ms to fade
console.log(`sound lost in all: ${(lost * 1000).toFixed(0)} ms (allowed ${LOST_MS}) · most voices at once: ${most} (allowed ${VOICES}) · errors: ${errors.length}`, ok ? 'OK' : 'FAILED');
process.exit(ok ? 0 : 1);
