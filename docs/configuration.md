# Configuration

Four layers. The first three need no code change; the fourth is code and data.

## 1. Server

Set when the server starts. A command-line flag wins over the environment variable.

| Flag | Environment | Default | Meaning |
| --- | --- | --- | --- |
| `--port` | `PORT` | `8787` | TCP port for the web page and the game traffic |
| `--mode` | `MODE` | `tdm` | Mode of a new room when the first player does not ask for one: `dm`, `tdm` or `campaign` |
| `--fill` | `FILL` | `12` | Player count that bots fill a new room up to, 0–64, when the first player does not ask for one |
| `--skill` | `SKILL` | `normal` | Bot skill in every multiplayer room: `easy`, `normal` or `hard`. Players cannot change it per room |
| `--level` | `LEVEL` | `drydock` | Level of a new room when the first player does not ask for one: `drydock`, `breakers`, `crosswind` or `ropewalk` |

```bash
node server/index.js --port 9000 --mode dm --fill 24 --skill hard
```

`GET /status` returns the open rooms as JSON, one object each: `room` (its name), `mode`, `level`, `players` (the
humans in it), `names` (their callsigns), `bots`, `max` (the cap), `recommended` (the level's suggested size) and
`phase` (`play` or `end`). A match adds `left` (seconds), `score` (`[BLUE, RED]`, or the leader's kills in a
deathmatch) and `limit`; a co-op room adds `stage` and `stages` instead. Any web page may read it: the menu on
another host lists this server's rooms when a player names it under Server.
`GET /version` returns the build: version, commit and build time for a packaged release, `{"version":"dev"}` in a
source checkout.

An unusable value stops the server at start with exit code 78 and a line naming the value and the accepted ones.
`node server/index.js --check`, with the same flags or environment, prints the settings it would use and exits
without starting.

An installation made with `install.sh` keeps the ones that were set as `PORT=`, `MODE=`, `FILL=`, `SKILL=` and
`LEVEL=` lines in `irontide.env` in its folder; a key that is absent takes the default above. See
[INSTALL.md](../INSTALL.md#day-to-day).

## 2. Room

Decided by the first player who joins a room name, from the menu's Multiplayer fields. They travel as parameters of
the WebSocket address `/ws`. Later joiners' values are ignored.

The menu lists the server's open rooms beside these fields, from `GET /status`; a click on one joins it. How often
it asks (every 3 s, every 15 s while the server does not answer) is `EVERY` and `SLOW` in `client/src/rooms.js`.

| Parameter | Menu field | Meaning |
| --- | --- | --- |
| `room` | Room | Room name, up to 24 characters. Default `public` |
| `name` | Callsign | Player name, up to 16 characters |
| `mode` | If new | `dm`, `tdm` or `campaign` (co-op) |
| `fill` | Fill to | Players that bots fill the room up to, 0–64 |
| `level` | Level | Level id: `drydock`, `breakers`, `crosswind` or `ropewalk`. A co-op room always plays Drydock, the level with the mission |

## 3. Player

Menu → Settings. Stored in the browser's local storage under the key `irontide`.

| Setting | Values | Default |
| --- | --- | --- |
| Callsign (`name`) | up to 16 characters; also under Multiplayer | `Player` and a random number |
| Graphics quality (`quality`) | `low`, `medium`, `high`, `ultra` | `high` |
| Dynamic resolution (`dynres`) | `on`, `off` | `on` |
| Mouse sensitivity (`sens`) | 2–40 | 14 |
| Invert mouse up / down (`invertY`) | `off`, `on` | `off` |
| Aim with the right mouse button (`aim`) | `toggle` (click on, click off), `hold` | `toggle` |
| Field of view (`fov`) | 60–100 | 78 |
| Volume (`volume`) | 0–100 | 80 |
| Crew (`look`), in the menu's Crew drawer | one crew for BLUE (`b`), one for RED (`r`), and which of the two is worn in a deathmatch (`d`) | Harbour Watch, Wreckers, the BLUE one |
| Quick match (`q`) | game type, level, bots 1–63, bot skill | deathmatch, 9 bots, Regular |
| Campaign (`c`) | difficulty | Regular |
| Multiplayer (`m`) | server, room, mode, level, fill 0–64 | this host, `public`, team deathmatch, Drydock, 12 |

Address-bar parameters, mainly for testing:

| Parameter | Effect |
| --- | --- |
| `?q=low` | Start with that graphics quality |
| `?dr=0` | Dynamic resolution off |
| `?auto=dm`, `tdm`, `campaign`, `range`, `multi` | Skip the menu and start that mode (`range` is Training) |
| `&bots=20` | Bots for `auto=dm` or `auto=tdm` |
| `&skill=easy` | Bot skill for `auto=dm` or `auto=tdm` |
| `&level=crosswind` | The level for quick match and for a new multiplayer room |

## 4. Game rules and content

Code and data. `shared/` runs in both the browser and the server, so after a change here rebuild the client and
restart the server.

| What | Where |
| --- | --- |
| Players per match (hard cap) | `MAX_PLAYERS` in `shared/sim.js` |
| Simulation and snapshot rate | `TICK` in `shared/sim.js` |
| Match time limit and score limit | `GameSim` constructor defaults in `shared/sim.js` (`timeLimit`, `scoreLimit`) |
| Weapons: damage, fire rate, magazine, pellets, reload, recoil, spread | `WEAPONS` in `shared/weapons.js`. `node scripts/ballistics.mjs` prints what the table does to a target |
| How spread adds up; how fast a kick lands, how much of it sights and crouching leave, how fast the view comes back | `spreadOf` and `RECOIL` in `shared/weapons.js` |
| What a player's shot can hit on a soldier | `HIT`, `HEAD` and `HEAD_R` in `client/src/characters.js` |
| What a bot's shot can hit | `hitCharacter` in `shared/collision.js` |
| Which shots the server refuses: rate, range, line of sight, and how far it trusts the client's own account | `humanFire` in `shared/sim.js` |
| Crews: names, sides, colours, kit | `CREWS` in `shared/crews.js`; the shape of each kit item in `KIT` in `client/src/crewkit.js` |
| The training course: steps, what the range officer says, where the targets stand | `campaign` and `TARGETS` in `shared/levels/range.js` |
| Which weapons exist and their number keys | `WEAPON_ORDER` in `shared/weapons.js` |
| How a weapon is held, aimed and reloaded on screen | `DEFS` in `client/src/viewmodel.js` |
| How hard a weapon shoves the body it kills | `SHOVE` in `client/src/ragdoll.js` |
| How a killed soldier falls: weight, joint stops, friction, gravity | the constants at the top of `client/src/ragdoll.js` |
| How long a body lies, and how many lie at once | `LINGER` and `MAX_LYING` in `client/src/characters.js` |
| Bot skill levels and bot names | `SKILLS` and `BOT_NAMES` in `shared/bots.js` |
| Player size, eye height, step height | `PLAYER` in `shared/collision.js` |
| Leaning (Q and E): how far the head goes to the side, how fast, how much the view tilts, how close it comes to a wall | `LEAN` in `shared/collision.js` |
| How the soldier bends when he leans | `LEAN_POSE` in `client/src/characters.js`. `node scripts/aim-lab.mjs lean out.jpg` shows the pose and checks his head against the leaning view |
| Which levels exist | `LEVELS` in `shared/levels/index.js`. One with `training: true` is the Training mode's and is not offered for matches |
| A level's recommended match size | `players: { min, max }` in `shared/levels/<id>.js` |
| A level's mood: sky, sun, fog, rain, bloom, colour grade | `env` in `shared/levels/<id>.js` |
| How far the sun's shadows reach on a wide level | `SHADOW_FIT` and `SHADOW_RANGE` in `client/src/engine.js`; `env.shadowRange` for one level |
| How direct the bots' routes are | `weight` in `shared/nav.js` |
| A level's layout, spawn points, pickups, campaign | `shared/levels/<id>.js`; format in the README, "Adding a level" |
| Ropewalk's houses: footprint, height, colour, which have a room to walk into | the `house(...)` calls in `shared/levels/ropewalk.js`; the colours in `WASH` and `PAINT` there |
| What a house, a warehouse or a boarded shed shows the street | `B.facade` in `client/src/dressing-town.js` |
| Which level is the default | `DEFAULT_LEVEL` in `shared/levels/index.js` |
| Graphics quality presets | `QUALITY` in `client/src/engine.js` |
| Textures and models to download | lists at the top of `scripts/fetch-assets.mjs` |
| How hard the shipped textures are compressed, how large a prop's textures are, a prop's triangle budget | `QUALITY`, `TEX` and `BUDGET` in `scripts/optimize-assets.mjs`; `npm run optimize` then builds everything again |
| How long a browser keeps the game's files before it asks whether they changed | `keep` in `server/index.js` |
| How much a first visit may download, and how many shader programs may be compiled while drawing, before the load check fails | `BUDGET_MB` and `LATE` in `scripts/load-test.mjs` |
| Dev server port and WebSocket proxy | `vite.config.js` |

The options inside a `QUALITY` preset:

| Option | Controls |
| --- | --- |
| `scale`, `dpr` | Render resolution: a multiplier, and the highest device pixel ratio used |
| `shadow`, `shadowEvery` | Sun shadow map size, and how many frames pass between its updates |
| `msaa` | Anti-aliasing samples (0 = off) |
| `ao` | Ambient occlusion resolution (0 = off) |
| `vol` | Ray steps for the sun shafts (0 = off) |
| `refl` | Resolution of the wet-ground reflection (0 = off) |
| `vmAO` | Contact shadows on the first-person weapon (0 = off) |
| `aniso` | Texture anisotropy |
| `rain` | Amount of rain streaks and splashes |
| `lights`, `pointShadows` | How many of the level's lamps are lit, and whether lamps cast shadows |
