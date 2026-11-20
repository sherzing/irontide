// Packs a release into release/: irontide.tar.gz (the built client, the server, the game core and the server's
// dependencies, with install.sh and INSTALL.md on top) and a copy of install.sh to publish beside it.
// A machine needs only Node.js to run the archive: no npm, no asset download, no build.
//   npm run package        builds the client first, then runs this
// The archive counts as packed once it has been unpacked outside the repository, started and joined by a player.
import { execFileSync, spawn } from 'node:child_process';
import { copyFile, cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const at = (...p) => join(ROOT, ...p);
const exists = (p) => stat(p).then(() => true, () => false);
const die = (msg) => { console.error(msg); process.exit(1); };
const json = async (p) => JSON.parse(await readFile(p, 'utf8'));
const git = (...a) => { try { return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };

const SERVER_IMPORTS = ['ws'];                    // the packages server/ and shared/ import; the start below fails if one is missing
const MIN_NODE = 18;                              // also in install.sh
const pkg = await json(at('package.json'));

// the client must be built, with the assets in it
for (const f of ['dist/index.html', 'dist/assets/models/concrete_road_barrier/concrete_road_barrier.lod.gltf'])
  if (!await exists(at(f))) die(`${f} is missing. Run "npm run assets", then "npm run package" again.`);

// ---- stage
const stage = at('.work', 'package', 'irontide'), put = (...p) => join(stage, ...p);
await rm(at('.work', 'package'), { recursive: true, force: true });
await mkdir(put('docs'), { recursive: true }); await mkdir(put('licenses')); await mkdir(put('node_modules'));
for (const d of ['server', 'shared', 'dist']) await cp(at(d), put(d), { recursive: true });
for (const f of ['install.sh', 'INSTALL.md', 'CREDITS.md', 'LICENSE', 'docs/server-setup.md', 'docs/configuration.md']) await copyFile(at(f), put(f));
for (const f of await readdir(at('client', 'fonts'))) if (f.endsWith('.txt')) await copyFile(at('client', 'fonts', f), put('licenses', f));

const deps = {}, todo = [...SERVER_IMPORTS];      // each import and whatever it depends on in turn
while (todo.length) {
  const name = todo.pop(); if (deps[name]) continue;
  const m = await json(at('node_modules', name, 'package.json'));
  deps[name] = m.version; todo.push(...Object.keys(m.dependencies || {}));
  await cp(at('node_modules', name), put('node_modules', name), { recursive: true });
}

const commit = git('rev-parse', '--short', 'HEAD') || 'unknown', dirty = git('status', '--porcelain') !== '';
const build = { name: pkg.name, version: pkg.version, commit: commit + (dirty ? '+changes' : ''), built: new Date().toISOString() };
await writeFile(put('build.json'), JSON.stringify(build, null, 2) + '\n');
await writeFile(put('package.json'), JSON.stringify({
  name: pkg.name, version: pkg.version, private: true, type: 'module', license: 'MIT',
  scripts: { start: 'node server/index.js' }, engines: { node: `>=${MIN_NODE}` }, dependencies: deps,
}, null, 2) + '\n');

// ---- archive
await mkdir(at('release'), { recursive: true });
const archive = at('release', 'irontide.tar.gz');
execFileSync('tar', ['-czf', archive, '-C', at('.work', 'package'), 'irontide'], { stdio: 'inherit' });
await copyFile(at('install.sh'), at('release', 'install.sh'));
const count = async (dir) => { let bytes = 0, files = 0; for (const e of await readdir(dir, { withFileTypes: true, recursive: true })) if (e.isFile()) { bytes += (await stat(join(e.parentPath, e.name))).size; files++; } return [bytes, files]; };
const [bytes, files] = await count(stage);
await rm(at('.work', 'package'), { recursive: true, force: true });

// ---- prove it: unpack outside the repository (inside it, Node would find the repository's packages), start, join
const tmp = await mkdtemp(join(tmpdir(), 'irontide-pack-'));
let server, log = '';
try {
  execFileSync('tar', ['-xzf', archive, '-C', tmp]);
  const port = await new Promise((res) => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
  server = spawn(process.execPath, ['server/index.js'], { cwd: join(tmp, 'irontide'), env: { PATH: process.env.PATH, PORT: String(port) } });
  server.stdout.on('data', (d) => { log += d; }); server.stderr.on('data', (d) => { log += d; });
  const base = `http://127.0.0.1:${port}`, get = (p) => fetch(base + p);
  for (let i = 0; ; i++) { try { await get('/status'); break; } catch { if (i > 40) throw new Error('the packed server did not start'); await new Promise((r) => setTimeout(r, 250)); } }
  const running = await (await get('/version')).json();
  if (running.built !== build.built) throw new Error(`/version answered ${JSON.stringify(running)}`);
  for (const p of ['/', '/assets/models/concrete_road_barrier/concrete_road_barrier.lod.gltf']) { const r = await get(p); if (!r.ok) throw new Error(`${p} answered ${r.status}`); }
  const hi = await new Promise((res, rej) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?name=Packer&room=pack&mode=dm&fill=4`);
    ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'hi') { ws.close(); res(m); } }); ws.on('error', rej); setTimeout(() => rej(new Error('no answer to a join')), 5000);
  });
  if (hi.ents.length !== 4) throw new Error(`a room filled to 4 holds ${hi.ents.length}`);
} catch (e) {
  die(`The archive does not run: ${e.message}\n${log}`);
} finally {
  server?.kill(); await rm(tmp, { recursive: true, force: true });
}

const mb = (n) => (n / 1048576).toFixed(0) + ' MB';
console.log(`\nIRONTIDE ${build.version} (${build.commit})${dirty ? ', packed from a working tree with uncommitted changes' : ''}`);
console.log(`  release/irontide.tar.gz   ${mb((await stat(archive)).size)}, ${files} files, ${mb(bytes)} unpacked; started and joined OK`);
console.log('  release/install.sh        the installer, to publish beside the archive');
console.log('\nInstall it here:      sh release/install.sh --from release/irontide.tar.gz');
console.log(`Publish it:           gh release create v${build.version} release/irontide.tar.gz release/install.sh`);
