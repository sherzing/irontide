# IRONTIDE

Browser first-person shooter. `client/` renders (three.js), `server/` hosts rooms (Node, WebSocket), and `shared/` is
the game itself — rules, bots, levels — run by both. [README.md](README.md) has the layout, the render pipeline and
the level format.

## Local setup

1. `npm ci`. Done when `node_modules/.bin/vite` exists.
2. `npm run assets` (downloads about 370 MB into `assets-src/`, then builds what the game ships into `public/assets/`,
   a few minutes of encoding; re-run it after an interruption, it skips what is there). Done when it exits 0 and
   `public/assets/models/concrete_road_barrier/concrete_road_barrier.lod.gltf` exists.
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
| `shared/weapons.js`, a hit volume, or `humanFire` in `shared/sim.js` | `node scripts/ballistics.mjs` | Exit code 0 |
| `install.sh`, `scripts/package.mjs` | `npm run package`, then `sh release/install.sh --from release/irontide.tar.gz --dir <new folder> --port <free port> --service none` | The first prints `started and joined OK`; the second exits 0 and prints `is installed in <new folder>` |
| `client/` | `npm run build`, then `node scripts/play-test.mjs <out prefix> "http://localhost:<port>/?auto=dm&bots=9&level=<id>"` for each level the change can reach (the training range: `?auto=range`) | It prints `errors: 0`, and you have opened every screenshot it saved |
| `client/src/audio.js`, or a new sound | `npm run build`, then `node scripts/sound-test.mjs http://localhost:<port>` (a minute) | Exit code 0 |
| What a first visit downloads or compiles: `scripts/optimize-assets.mjs`, an asset, a loader, a material or shader, a render pass | `npm run build`, restart the server, then `node scripts/load-test.mjs http://localhost:<port>` | Exit code 0 |

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
- **Scripting a match.** `?auto=dm|tdm|campaign|range|multi` skips the menu. `window.__irontide` exposes `game`, `engine`,
  `settings` and `chars`. `game.debugInput = { yaw, pitch, keys: ['KeyW'], fire, ads }` plays for you.
- **Frame rates.** Measure with `&dr=0`, because dynamic resolution hides the cost, and report the GPU and the
  quality preset with the number. `&perf=1` (in play: P) shows all of it on screen: frames a second, the slowest of
  the last 240 frames, the resolution drawn, the preset and the GPU (`client/src/perf.js`).
- **Levels.** Every spawn point and campaign enemy stands on open floor; sim-test checks it on every level.
  `dressing` is looks only: what a player can touch is a solid, so a scenery builder and its colliders are written
  as a pair (see `cargoPlane` in `shared/levels/crosswind.js`, and `openLeaves` in `shared/props.js`, which gives an
  open container's door leaves to both the picture and the colliders).
- **Streets.** Ropewalk is written house by house (`house(...)` in `shared/levels/ropewalk.js`); roofs, and the
  windows and doors of every face open to a street, are derived from that list. A solid that stands against a house
  goes into `houses` or `covers`, or the house draws windows into it. `node scripts/level-lines.mjs ropewalk` prints
  whether one base sees the other (0 lines is right: a boat, containers and the bobbin racks are placed to keep it
  so) and how far each side walks to the middle of each lane (equal is right).
- **Timber.** A tint multiplies a texture, and the planks of `wood` are dark: tinted, or in shade on a dry level,
  they go black. Use `timber` (the same planks, lighter) with a pale tint, and `matte` for painted joinery.
- **Ground** is flat tiles that meet edge to edge. Overlapping floors flicker at a distance, and bots walk only at
  `groundY`.
- **`dress(type, {...})`** overwrites `type` with an option of that name; scenery options use `kind`.
- **Looking at a level.** `client/dev.html?level=<id>&p=x,y,z&yaw=&pitch=` is a free camera;
  `node scripts/level-map.mjs out.png <id>` draws the plan.
- **Weapons** are modelled in code on one skeleton (`client/src/vmparts.js`). Keep a gun's pistol grip, trigger and
  fore-end where the skeleton puts them and the hand poses in `client/src/viewmodel.js` fit it. Judge them on the
  bench: `npx vite --port 5177`, then `node scripts/vm-lab.mjs out.jpg views <weapon>` (also `strip <weapon> reload`).
  A single-shot weapon fires once per trigger press, so a scripted match must release `fire` between shots.
- **Aim.** A shot leaves the screen's centre along the view of the frame it is fired in. Spread, recoil and its way
  back are functions in `shared/weapons.js`, used by the client and by `node scripts/ballistics.mjs`, which prints
  what a weapon table does to a target and fails when a held trigger stops hitting or the view stops coming back.
  A player's shots are tested against capsules on the soldier's bones (`HIT` in `client/src/characters.js`); bots
  shoot at three upright volumes (`hitCharacter`). The server only refuses what cannot be (`humanFire`). In the
  browser, with `npx vite --port 5177`: `node scripts/aim-lab.mjs volumes out.jpg` paints what a shot hits over
  the soldier, `sights out.png` shows each sight against the screen's centre, `lag` measures a shot trailing a
  turning view (0 is right).
- **Lean.** Q and E move a player's view to the side (`LEAN` in `shared/collision.js`) and bend the soldier the
  others see (`LEAN_POSE` in `client/src/characters.js`); the lean travels in the state flags (`leanBits`). His head
  must be where the leaning view is, or a player shoots from where nobody can hit him. With `npx vite --port 5177`:
  `node scripts/aim-lab.mjs lean out.jpg` shows the pose with what a shot hits and fails when head and view are more
  than 4 cm apart. Bots do not lean; their sight, their aim and `hitCharacter` follow a player who does.
- **Slide.** A crouch pressed in a sprint (`SLIDE` in `shared/collision.js`; the movement is in `client/src/game.js`)
  sits the soldier the others see down into `SLIDE_POSE` (`client/src/characters.js`); it travels in the state
  flags (`SLIDING`, with the crouch bit, so bots and the server take a slider for a crouching player). The pose is
  bent on top of the idle stance, so its angles are not what they look like: with `npx vite --port 5177`,
  `node scripts/aim-lab.mjs slide out.jpg` shows it, prints where each leg joint is and fails when his head is more
  than 6 cm from the sliding view or a foot is under the floor.
- **Bots** (`shared/bots.js`) look one way and go another when nobody is in sight: eyes on the corner ahead, a
  glance aside (`GAIT`). The soldier model has only forward strides, so the client turns his legs the way he
  travels and his waist to where he looks (`TWIST` in `client/src/characters.js`, players included); without that
  he walks like a crab. `node scripts/sim-test.mjs` checks the paces and that the view turns without a jolt.
- **Crews** (`shared/crews.js`) are looks only: the body texture repainted and kit hung on bones
  (`client/src/crewkit.js`). `node scripts/crew-sheet.mjs out.jpg` shows them all, front and back. BLUE's crews
  stay cold-coloured and RED's warm: that is how a team is told apart.
- **Room list.** The menu lists the server's open rooms from `GET /status` (`client/src/rooms.js`); what a room
  says of its match comes from `GameSim.status()`. Judge a change with a server running:
  `node scripts/ui-shot.mjs out http://localhost:<port> rooms` puts players into two rooms, saves the menu and
  joins one by a click. A server that may not be ours answers too: its text goes in as text, never as HTML.
- **Training.** `shared/levels/range.js` is a level with `training: true` whose campaign is the course. Its
  `enemies` with `target` set are practice targets: they never shoot and get back up where they stood.
- **Deaths** are a ragdoll (`client/src/ragdoll.js`): particles on the joints, which the skeleton follows. Judge a
  change on the bench: `npx vite --port 5177`, then `node scripts/death-strip.mjs out.jpg` films one death
  (`from=180 move=5 head=1 at=wall` and more, listed at the top of the script) and
  `node scripts/death-strip.mjs - trials=40` kills forty soldiers every which way and counts the odd ones: a foot
  thrown into the air, a body that never comes to rest. Forty deaths give 0 odd, now and then 1.
- **Assets.** `assets-src/` holds the downloads; the game ships what `npm run optimize` builds from them into
  `public/assets/`: AVIF textures, `.sky` skies (`client/src/sky.js` reads them) and `<id>.lod.gltf` props. Run it
  after adding a texture, model or sky, then rebuild. After a first build or a changed setting it rebuilds the whole
  folder: restart a running Vite, which lists `public/` when it starts.
- **Sound** is synthesised (`client/src/audio.js`). A one-shot is a voice: `out()` opens it, `noise()` and `tone()`
  play into it, and its nodes leave the audio graph when it ends. A node left connected costs audio time until the
  browser's next big garbage collection, and the sound of a busy match breaks up, but only after about 25 s: a
  short listen proves nothing, `node scripts/sound-test.mjs <url>` does.
- **Odd.** "My shots were swallowed" and "the sound broke up" are answered by the server's log. Every 10 s it
  prints a `!` line for each player something odd happened to, and a `sums for` line when they leave: shots that
  arrived in a bunch or were refused and hits refused (`e.odd`, counted by `humanFire` in `shared/sim.js`), messages
  dropped or kept back (`server/index.js`), and what the player's own client reports (`client/src/health.js`): sound
  not played, slow frames, late snapshots, ping. A new way for the server to drop something gets a counter there.
- **Loading.** A first visit costs megabytes and shader programs; `node scripts/load-test.mjs <url>` prints both.
  A lit program takes about 0.1 s to compile, so keep them few. A number written into shader text makes one program
  per value: pass it as a uniform (`uSurf` in `patchSurface`). A pass that draws the scene under other lights than
  the main pass compiles every lit material a second time: the mirror pass keeps the camera's light for that.
  `Engine.precompile` starts a frame's programs behind the loading screen through `draw()` and `pass()` in
  `render()`; draw a new pass through them.
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
