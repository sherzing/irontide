# IRONTIDE

Browser first-person shooter. `client/` renders (three.js), `server/` hosts rooms (Node, WebSocket), and `shared/` is
the game itself — rules, bots, levels — run by both. [README.md](README.md) has the layout, the render pipeline and
the level format.

## Local setup

1. `npm ci`. Done when `node_modules/.bin/vite` exists.
2. `npm run assets` (downloads about 370 MB; re-run it after an interruption, it skips what is there). Done when it
   exits 0 and `public/assets/models/concrete_road_barrier/concrete_road_barrier.lod.gltf` exists.
3. `npm run build`. Done when `dist/index.html` exists and `dist/assets/tex/` holds textures.
4. Start `node server/index.js --port <free port>` in the background. Done when
   `curl -s localhost:<port>/status` prints `[]`.
5. For the browser checks: `npx playwright-core install chromium`. Done when `~/.cache/ms-playwright/` holds a
   `chromium-*` folder.

## Green

A change is finished when every check its files touch is **green**.

| Touched | Check | Green |
| --- | --- | --- |
| `shared/` | `node scripts/sim-test.mjs` | Exit code 0 |
| `server/`, or a message between client and server | Restart the server, then `node scripts/net-test.mjs ws://localhost:<port>` | It reports the cap connected and one more player rejected, at 20 snapshots a second |
| `install.sh`, `scripts/package.mjs` | `npm run package`, then `sh release/install.sh --from release/irontide.tar.gz --dir <new folder> --port <free port> --service none` | The first prints `started and joined OK`; the second exits 0 and prints `is installed in <new folder>` |
| `client/` | `npm run build`, then `node scripts/play-test.mjs <out prefix> "http://localhost:<port>/?auto=dm&bots=9&level=<id>"` for each level the change can reach | It prints `errors: 0`, and you have opened every screenshot it saved |

## Gotchas

- **Stale.** The server serves `dist/` and keeps `shared/` in memory. After a `client/` change, rebuild. After a
  `shared/` or `server/` change, rebuild and restart the server. A browser and a server on different `shared/`
  versions disagree silently.
- **Fast loop.** `npx vite --port <free port>` serves `client/` with hot reload. Quick match and campaign run the
  whole game in the browser, so they need no server; multiplayer through Vite needs the server on the proxy port in
  `vite.config.js`.
- **Headless.** The browser scripts drive Playwright's Linux Chromium on the machine's GPU
  (`scripts/browser.mjs`). On a machine without a GPU set `SWIFT=1`: the pictures are right, the frame rates mean
  nothing.
- **Scripting a match.** `?auto=dm|tdm|campaign|multi` skips the menu. `window.__irontide` exposes `game`, `engine`,
  `settings` and `chars`. `game.debugInput = { yaw, pitch, keys: ['KeyW'], fire, ads }` plays for you.
- **Frame rates.** Measure with `&dr=0`, because dynamic resolution hides the cost, and report the GPU and the
  quality preset with the number.
- **Levels.** Every spawn point and campaign enemy stands on open floor; sim-test checks it on every level.
  `dressing` is looks only: what a player can touch is a solid, so a scenery builder and its colliders are written
  as a pair (see `cargoPlane` in `shared/levels/crosswind.js`, and `openLeaves` in `shared/props.js`, which gives an
  open container's door leaves to both the picture and the colliders).
- **Ground** is flat tiles that meet edge to edge. Overlapping floors flicker at a distance, and bots walk only at
  `groundY`.
- **`dress(type, {...})`** overwrites `type` with an option of that name; scenery options use `kind`.
- **Looking at a level.** `client/dev.html?level=<id>&p=x,y,z&yaw=&pitch=` is a free camera;
  `node scripts/level-map.mjs out.png <id>` draws the plan.
- **Weapons** are modelled in code on one skeleton (`client/src/vmparts.js`). Keep a gun's pistol grip, trigger and
  fore-end where the skeleton puts them and the hand poses in `client/src/viewmodel.js` fit it. Judge them on the
  bench: `npx vite --port 5177`, then `node scripts/vm-lab.mjs out.jpg views <weapon>` (also `strip <weapon> reload`).
  A single-shot weapon fires once per trigger press, so a scripted match must release `fire` between shots.
- **Deaths** are a ragdoll (`client/src/ragdoll.js`): particles on the joints, which the skeleton follows. Judge a
  change on the bench: `npx vite --port 5177`, then `node scripts/death-strip.mjs out.jpg` films one death
  (`from=180 move=5 head=1 at=wall` and more, listed at the top of the script) and
  `node scripts/death-strip.mjs - trials=40` kills forty soldiers every which way and counts the odd ones: a foot
  thrown into the air, a body that never comes to rest. Forty deaths give 0 odd, now and then 1.
- **Props** load from `<id>.lod.gltf`, which `npm run optimize` writes. Run it after adding a model.
- **Installer.** `install.sh` is POSIX `sh` (it runs under dash and BusyBox) and holds no list of valid settings:
  it asks the release's own server with `--check`. An installed copy runs the `install.sh` packed inside it, so
  repack before testing a change through `<folder>/app/install.sh`.
- **Names** of shipping lines, vessels and weapons are fictional. Invent new ones the same way.

## Reference

- **Configuration** — changing a default, limit or tuning value (server flags, room and address-bar parameters,
  player settings, quality presets, weapons, bots, match rules): [docs/configuration.md](docs/configuration.md) says
  where each one lives.
- **Installing** — putting a release on a machine, updating or removing one, building and publishing a release:
  [INSTALL.md](INSTALL.md).
- **Hosting** — hardware sizing for a player count, letting players in, HTTPS, limits:
  [docs/server-setup.md](docs/server-setup.md).
