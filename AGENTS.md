# IRONTIDE

Browser first-person shooter. `client/` renders (three.js), `server/` hosts rooms (Node, WebSocket), and `shared/` is
the game itself — rules, bots, levels — run by both. [README.md](README.md) has the layout, the render pipeline and
the level format.

## Local setup

1. `npm ci`. Done when `node_modules/.bin/vite` exists.
2. `npm run assets` (downloads about 400 MB; re-run it after an interruption, it skips what is there). Done when it
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
  as a pair (see `cargoPlane` in `shared/levels/crosswind.js`).
- **Ground** is flat tiles that meet edge to edge. Overlapping floors flicker at a distance, and bots walk only at
  `groundY`.
- **`dress(type, {...})`** overwrites `type` with an option of that name; scenery options use `kind`.
- **Looking at a level.** `client/dev.html?level=<id>&p=x,y,z&yaw=&pitch=` is a free camera;
  `node scripts/level-map.mjs out.png <id>` draws the plan.
- **Props** load from `<id>.lod.gltf`, which `npm run optimize` writes. Run it after adding a model.
- **Names** of shipping lines, vessels and weapons are fictional. Invent new ones the same way.

## Reference

- **Configuration** — changing a default, limit or tuning value (server flags, room and address-bar parameters,
  player settings, quality presets, weapons, bots, match rules): [docs/configuration.md](docs/configuration.md) says
  where each one lives.
- **Deployment** — hosting it for other people, hardware sizing, systemd, HTTPS:
  [docs/server-setup.md](docs/server-setup.md).
