# IRONTIDE

Browser first-person shooter (three.js / WebGL2). Three levels and three ways to play:

| Level | Size | Suits | Setting |
| --- | --- | --- | --- |
| **Drydock** | small, 68 × 75 m | 8–24 players | Harbour freight yard, rain clearing at golden hour, a feeder ship alongside |
| **Breakers** | medium, 120 × 108 m | 12–32 players | Shipbreaking beach at noon: a freighter hauled up the tidal flat and half cut apart |
| **Crosswind** | large, 240 × 232 m | 24–64 players | Coastal airfield on a cold clear morning: hangars, apron, a closed runway with a wreck on it |

- **Quick match** – deathmatch or team deathmatch against 1–63 bots (three skill levels) on any level
- **Campaign** – "Low Tide", a six-objective mission on Drydock (also playable co-op via multiplayer)
- **Multiplayer** – dedicated WebSocket server, rooms of up to **64 players**, bots fill empty slots; the first player picks the level

Five weapons, all carried at once and picked with the number keys:

| Key | Weapon | Kind |
| --- | --- | --- |
| 1 | VK-7 Carbine | automatic rifle, 30 rounds |
| 2 | Halyard 45 | submachine gun, 25 rounds |
| 3 | Marlin 12 | semi-automatic shotgun, 7 shells of 8 pellets |
| 4 | Kestrel .338 | bolt-action sniper rifle with a scope, 5 rounds |
| 5 | P-9 Service | pistol, 15 rounds |

Eight crews decide what a soldier wears, four for each side: Harbour Watch, Cutter Crew, Clearance Divers and Bar Pilots on
BLUE; Wreckers, Night Shift, Dead Freight and Low Tide Runners on RED. A player picks one for each side under **Crew** in
the menu; bots are dealt crews of their side. A crew is looks only (`shared/crews.js`).

## Run

```bash
npm install
npm run assets      # downloads the CC0 textures/models/skies into public/assets (~370 MB, once) and builds light prop models
npm run play        # builds the client and starts the server on http://localhost:8787
```

`npm run assets` ends with `scripts/optimize-models.mjs`, which writes a simplified `.lod.gltf` next to every scanned prop
(a single road barrier is 61k triangles as downloaded). Re-run it alone with `npm run optimize`.

Development: `npm run dev` (Vite with hot reload + game server; Vite proxies `/ws` to port 8787).

Server options: `node server/index.js --port 8787 --mode tdm|dm|campaign --fill 12 --skill easy|normal|hard --level drydock|breakers|crosswind`.
Other machines join by opening `http://<your-ip>:8787` (or entering `<your-ip>:8787` under Multiplayer → Server).
`GET /status` lists the live rooms. The first player into a room decides its mode, level and bot fill.

Installing a packaged release on another machine, with no build there: [INSTALL.md](INSTALL.md). `npm run package` makes the release.
Hosting it for other people, with hardware requirements: [docs/server-setup.md](docs/server-setup.md).
Every setting and where it lives: [docs/configuration.md](docs/configuration.md). Guide for coding agents: [AGENTS.md](AGENTS.md).

## Layout

| Path | What |
| --- | --- |
| `shared/` | Engine-agnostic game core used by both browser and server: collision, navigation grid, weapons and what a shot does (`weapons.js`), bot AI, crews (`crews.js`), the authoritative `GameSim`, level data |
| `shared/levels/` | Levels as plain data (`drydock.js`, `breakers.js`, `crosswind.js`), authoring helpers (`kit.js`), registry (`index.js`) |
| `client/src/` | Renderer + post chain (`engine.js`), level builder (`levelbuild.js`), instanced containers (`containers.js`), scenery builders (`dressing.js`, `dressing-yard.js`, `dressing-airfield.js`), surface shaders (`materials.js`), rain (`rain.js`), FX, first-person weapons (`viewmodel.js`, `vmkit.js`, `vmparts.js` and one file per gun: `vmcarbine.js`, `vmsmg.js`, `vmshotgun.js`, `vmsniper.js`, `vmpistol.js`), soldiers (`characters.js`), what each crew wears (`crewkit.js`) and how they fall when killed (`ragdoll.js`), HUD (`hud.js`, `ui.css`), session (`game.js`), transports (`net.js`) |
| `server/index.js` | Static file server + WebSocket rooms, one `GameSim` per room |
| `install.sh`, `scripts/package.mjs` | The installer for a packaged release, and the script that packs one into `release/` |
| `scripts/` | Asset fetcher, headless sim test (`sim-test.mjs`), server protocol test (`net-test.mjs`), the model of what the weapons do (`ballistics.mjs`), Playwright screenshot/playtest tools and benches (`aim-lab.mjs`, `crew-sheet.mjs`, `death-strip.mjs`, `vm-lab.mjs`) |

Solo modes run the very same `GameSim` in-process (`LocalTransport`), so quick match, campaign and multiplayer share one code path.

## Match size

The game caps a match at 64 players, humans and bots together (`MAX_PLAYERS` in `shared/sim.js`). That is the game's limit,
not a level's: each level says what size it suits with `players: { min, max }` — 8–24 on Drydock, 24–64 on Crosswind. The menu shows that range
next to the level name and as a band on the bot and fill sliders, and warns when a match is set larger; `/status` reports it
per room. A level without the field gets an estimate from its floor area (`recommendedPlayers` in `shared/levels/index.js`).
When a match has more players than the level has spawn points, players are placed on free floor next to them.

## Rendering

Each frame: sun shadow map → planar reflection of everything above the ground plane (wet asphalt, puddles) → the scene
into an MSAA HDR target with a depth texture → ambient occlusion from that depth → ray-marched sun shafts through the
shadow map plus lamp glow (half resolution) → composite with height fog → bloom → filmic tone map and grade.
Rain streaks and splash rings are GPU-instanced and use a top-down "cover" height map built from the level, so it stays
dry under roofs. Settings has four quality presets and a dynamic-resolution switch that lowers the render resolution
when frames get slow (the HUD's bottom-left line shows fps and the current resolution scale).
One shadow map covers a level up to 200 m across; on a wider one (Crosswind) it covers the 80 m around the camera and
travels with it. A dry level (`weather: { rain: 0, wet: 0 }`) skips the reflection and rain passes.

## Adding a level

1. Copy one of the files in `shared/levels/` and change the geometry. A level is data: `solids` (boxes with a material),
   `containers`, `props` (models from `shared/props.js`), `lights`, `decals`, `pickups`, `spawns`, `dressing`, `env`, `shots`,
   `players` (the match size it suits), `pitch` (the menu's line about it) and optionally a `campaign` (stages of type
   `reach`, `eliminate`, `interact`, `defend`).
2. Register it in `shared/levels/index.js`.
3. `node scripts/sim-test.mjs` checks it: open spawn points, a full match placed cleanly, bots that find each other.

The kit (`shared/levels/kit.js`) has `box`, `rbox`, `wall` (with door and window openings), `stairs`, `container`, `prop`,
`decal`, `light`, `pickup`, `spawn(x, z, facing)` — facing is a compass bearing, 90 = east — and `frame(x, z, yaw)`,
which gives the same helpers in a turned coordinate system (Breakers' hull, Crosswind's aircraft).
Ground is flat: bots walk only at the level's `groundY`, so a raised floor is a place for players, not bots.
Lay ground materials as tiles that meet edge to edge; two overlapping floors flicker at a distance.

`dressing` is visual-only scenery placed with `dress(type, {...})` from the kit and built by `client/src/dressing.js`:
`gantry`, `stsCrane`, `ship`, `lightMast`, `stacks`, `sign`, `skyline`, `breakwater`, `cones`, `pallets`, `bollards`,
`fenders`, `razorWire`, `cables`, `shedTrim`; the shipbreaking set `hulk`, `bowBlock`, `plates`, `scrap`, `anchor`,
`lifeboat`, `shelter`, `winch`, `crawlerCrane`, `mounds`; and the airfield set `hangar`, `aircraft`, `vehicle`, `tower`,
`radome`, `latticeMast`, `fence`, `fuelTanks`, `windsock`, `sandbags`, `approach`, `treeline`, `ridge`, `taxiSign`.
It never collides — give anything the player can touch a solid
(`{ visible: false }` hides the collider when the dressing provides the look, as the gantry crane does).

`env` sets the mood: `hdri`, `sunAzimuth`, `sunElevation`, sun colour and intensity, `fog` (colour away from and toward
the sun, density, height falloff), `shafts` (volumetric sun shafts and lamp glow), `weather: { rain, wet }`, `water`,
`bloom` and `grade`. A dry, clear level is just `weather: { rain: 0, wet: 0 }` and a lower fog density.
`shots` are the slow camera moves shown behind the menu.

Collision, the bot navigation grid, shadows and the menu's level picker are all derived from that data — nothing else to wire up.
New textures/models: add their Poly Haven ids to `scripts/fetch-assets.mjs`, then to `MATS` in `client/src/materials.js` or `PROP_DEFS` in `shared/props.js`.
`client/dev.html?level=<id>&p=x,y,z&yaw=..&pitch=..` is a free camera view for checking a level,
`node scripts/level-map.mjs out.png <id>` draws a top-down plan with colliders, spawns and objectives, and `client/vmlab.html` is a bench for the first-person weapons
(`node scripts/vm-lab.mjs out.jpg views <weapon>`, with Vite on port 5177).

The guns are modelled in code. They share one skeleton (`client/src/vmparts.js`): the same pistol grip, trigger and
magazine well in the same place, so the hand poses in `viewmodel.js` fit each of them.

## Tests

```bash
node scripts/sim-test.mjs                      # every level: spawn checks, full-match placement, a bot match; then complete matches and the campaign (no browser)
node scripts/net-test.mjs ws://localhost:8787  # joins 64 clients, checks the 65th is refused
node scripts/ballistics.mjs                    # what the weapons do to a target, and what the server makes of honest shots (no browser)
node scripts/play-test.mjs /tmp/shot "http://localhost:8787/?auto=dm&bots=6&level=breakers"   # drives a match in headless Chromium
```

The browser scripts use the machine's GPU through ANGLE/EGL (`scripts/browser.mjs`); `SWIFT=1` forces software rendering.

## Credits

Assets, fonts and the hand rig come from other projects: [CREDITS.md](CREDITS.md). The game's own code is MIT-licensed, see `LICENSE`.
