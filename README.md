# IRONTIDE

Browser first-person shooter (three.js / WebGL2). One small level — **Drydock**, a harbour freight yard with rain
clearing at golden hour and a feeder ship alongside — with three ways to play:

- **Quick match** – deathmatch or team deathmatch against 1–63 bots (three skill levels)
- **Campaign** – "Low Tide", a six-objective mission on Drydock (also playable co-op via multiplayer)
- **Multiplayer** – dedicated WebSocket server, rooms of up to **64 players**, bots fill empty slots

## Run

```bash
npm install
npm run assets      # downloads the CC0 textures/models/skies into public/assets (~285 MB, once) and builds light prop models
npm run play        # builds the client and starts the server on http://localhost:8787
```

`npm run assets` ends with `scripts/optimize-models.mjs`, which writes a simplified `.lod.gltf` next to every scanned prop
(a single road barrier is 61k triangles as downloaded). Re-run it alone with `npm run optimize`.

Development: `npm run dev` (Vite with hot reload + game server; Vite proxies `/ws` to port 8787).

Server options: `node server/index.js --port 8787 --mode tdm|dm|campaign --fill 12 --skill easy|normal|hard`.
Other machines join by opening `http://<your-ip>:8787` (or entering `<your-ip>:8787` under Multiplayer → Server).
`GET /status` lists the live rooms. The first player into a room decides its mode and bot fill.

## Layout

| Path | What |
| --- | --- |
| `shared/` | Engine-agnostic game core used by both browser and server: collision, navigation grid, weapons, bot AI, the authoritative `GameSim`, level data |
| `shared/levels/` | Levels as plain data (`drydock.js`), authoring helpers (`kit.js`), registry (`index.js`) |
| `client/src/` | Renderer + post chain (`engine.js`), level builder (`levelbuild.js`), instanced containers (`containers.js`), scenery builders (`dressing.js`), surface shaders (`materials.js`), rain (`rain.js`), FX, first-person weapons (`viewmodel.js`, `vmkit.js`, `vmcarbine.js`), characters, HUD (`hud.js`, `ui.css`), session (`game.js`), transports (`net.js`) |
| `server/index.js` | Static file server + WebSocket rooms, one `GameSim` per room |
| `scripts/` | Asset fetcher, headless sim test (`sim-test.mjs`), server protocol test (`net-test.mjs`), Playwright screenshot/playtest tools |

Solo modes run the very same `GameSim` in-process (`LocalTransport`), so quick match, campaign and multiplayer share one code path.

## Match size

The game caps a match at 64 players, humans and bots together (`MAX_PLAYERS` in `shared/sim.js`). That is the game's limit,
not a level's: each level says what size it suits with `players: { min, max }` — Drydock is 8–24. The menu shows that range
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

## Adding a level

1. Copy `shared/levels/drydock.js` to a new file and change the geometry. A level is data: `solids` (boxes with a material),
   `containers`, `props` (models from `shared/props.js`), `lights`, `decals`, `pickups`, `spawns`, `dressing`, `env`, `shots`,
   `players` (the match size it suits) and optionally a `campaign` (stages of type `reach`, `eliminate`, `interact`, `defend`).
2. Register it in `shared/levels/index.js`.

`dressing` is visual-only scenery placed with `dress(type, {...})` from the kit and built by `client/src/dressing.js`:
`gantry`, `stsCrane`, `ship`, `lightMast`, `stacks`, `sign`, `skyline`, `breakwater`, `cones`, `pallets`, `bollards`,
`fenders`, `razorWire`, `cables`, `shedTrim`. It never collides — give anything the player can touch a solid
(`{ visible: false }` hides the collider when the dressing provides the look, as the gantry crane does).

`env` sets the mood: `hdri`, `sunAzimuth`, `sunElevation`, sun colour and intensity, `fog` (colour away from and toward
the sun, density, height falloff), `shafts` (volumetric sun shafts and lamp glow), `weather: { rain, wet }`, `water`,
`bloom` and `grade`. A dry, clear level is just `weather: { rain: 0, wet: 0 }` and a lower fog density.
`shots` are the slow camera moves shown behind the menu.

Collision, the bot navigation grid, shadows and the menu's level picker are all derived from that data — nothing else to wire up.
New textures/models: add their Poly Haven ids to `scripts/fetch-assets.mjs`, then to `MATS` in `client/src/materials.js` or `PROP_DEFS` in `shared/props.js`.
`client/dev.html?p=x,y,z&yaw=..&pitch=..` is a free camera view for checking a level, `node scripts/level-map.mjs out.png`
draws a top-down plan with colliders, spawns and objectives, and `client/vmlab.html` is a bench for the first-person weapons.

## Tests

```bash
node scripts/sim-test.mjs                      # 64-player match, spawn checks, team match, full campaign run (no browser)
node scripts/net-test.mjs ws://localhost:8787  # joins 64 clients, checks the 65th is refused
node scripts/play-test.mjs /tmp/shot "http://localhost:8787/?auto=dm&bots=6"   # drives a match in headless Chromium
```

The browser scripts use the machine's GPU through ANGLE/EGL (`scripts/browser.mjs`); `SWIFT=1` forces software rendering.

## Credits

Textures, models and HDRIs: [Poly Haven](https://polyhaven.com) (CC0). Soldier model and water normal map: three.js examples.
First-person hand rig: the "generic hand" from [WebXR Input Profiles](https://github.com/immersive-web/webxr-input-profiles) (MIT),
dressed in-engine as gloves.
Fonts (SIL Open Font License 1.1, bundled in `client/fonts/` next to their licence texts): Saira Stencil One, Saira Condensed
and Saira Extra Condensed by Omnibus-Type; JetBrains Mono by JetBrains. All shipping-line names, liveries and vessel names in
the level are fictional.

The game's own code is MIT-licensed, see `LICENSE`.
