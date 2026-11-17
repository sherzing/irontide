# Running an IRONTIDE server

One Node.js process serves the game's web page and hosts the matches. Players need a browser and the server's address,
nothing else.

## Requirements

### Server

| | Needed | Basis |
| --- | --- | --- |
| Processor | 1 core | The server is single-threaded, so every room shares one core. A full 64-player room used 17% of one core in testing. |
| Memory | 1 GB | The running server holds 90–150 MB. Building the client peaks at about 450 MB. |
| Disk | 1.5 GB free | An installed copy is about 970 MB: 400 MB assets, 400 MB built client (it contains a copy of the assets), 170 MB packages. |
| Upload | 5 Mbit/s for one 24-player room, 35 Mbit/s for one full 64-player room | See the table below. Every new player also downloads 137–260 MB once, depending on the levels they play. |
| Open port | One TCP port (8787 unless you change it) | The web page and the game traffic share it. |
| Software | Node.js 22.12 or newer, npm, git | Tested with Node 22.23 on Ubuntu 26.04 (x86-64). Vite, which builds the client, also accepts Node 20.19+. |

Measured load of one room (simulated players on the same machine as the server, an Intel i9-13900H laptop):

| Players in the room | Processor, share of one core | Traffic to each player | Server upload if all are human |
| --- | --- | --- | --- |
| 12 | 7–8% | 0.06–0.10 Mbit/s | about 1 Mbit/s |
| 24 | 8% | 0.12–0.20 Mbit/s | 3–5 Mbit/s |
| 64 | 16–17% | 0.3–0.5 Mbit/s | 20–33 Mbit/s |

The lower figures are players standing still, the higher ones a room full of fighting bots; real matches fall in
between. Traffic grows with the square of the room size, because every player is sent every other player's state
20 times a second. The level makes little difference to the server: 64 bots cost 0.2 ms of each 50 ms tick on any of
the three. None of this has been measured over the internet, or on a small rented server.

### Players

- A desktop browser with WebGL2. Tested in Chromium 156; Firefox and Safari are untested.
- Keyboard and mouse. There are no touch or gamepad controls, so phones and tablets do not work.
- Any graphics chip of the last several years. Measured on Intel UHD integrated graphics at 1600×900, in frames per
  second on Low / Medium / High: Drydock with 10 players 60 / 45 / 25, Breakers with 32 players 60 / 58 / 44, Crosswind
  with 64 players 60 / 47 / 40. Dynamic resolution, on by default, lowers the render resolution to hold the frame rate.
- The first visit downloads 137 MB for Drydock; Breakers adds 59 MB and Crosswind 64 MB when a player first loads
  them (260 MB for all three). The browser keeps the files for a day.

## Install

```bash
git clone https://github.com/sherzing/irontide.git
cd irontide
npm ci
npm run assets
npm run build
```

- `npm ci` installs the packages.
- `npm run assets` downloads the textures, models and skies (about 400 MB) from Poly Haven, the three.js repository
  and jsDelivr, then writes light versions of the prop models. It skips files that are already there, so it is safe
  to run again after an interrupted download. It takes about half a minute on a fast connection.
- `npm run build` builds the client into `dist/`, including a copy of the assets. The server only serves `dist/`.

## Start

```bash
node server/index.js --port 8787
```

It prints `IRONTIDE server on http://localhost:8787  (rooms default: tdm, fill 12)`.

Check it from the server itself:

```bash
curl http://localhost:8787/status      # prints [] while no room is open
```

Then open `http://<server-address>:8787/` in a browser on another machine.

The server's options (default mode, bot fill, bot skill, level, port) are in
[configuration.md](configuration.md#1-server).

## Let players in

1. Open the port in the server's firewall, for example `sudo ufw allow 8787/tcp`. On a home connection, also forward
   that TCP port on the router to the server.
2. Give players the address `http://<server-address>:8787/`.
3. In the menu they choose **Multiplayer**, type a callsign and a room name, and press **Join room**. The *Server*
   field stays empty when the page was loaded from this server.

A room is created by the first player who joins it; that player's mode, level and fill settings apply to the room. Bots
hold the empty slots up to the fill number. A room closes when its last player leaves, and its scores go with it.

Each level states the match size it suits: Drydock 8–24 players, Breakers 12–32, Crosswind 24–64. The game allows up to
64 in a room on any of them; the menu warns above the level's range.

## Keep it running

A systemd unit, as `/etc/systemd/system/irontide.service`:

```ini
[Unit]
Description=IRONTIDE game server
After=network-online.target
Wants=network-online.target

[Service]
User=irontide
WorkingDirectory=/opt/irontide
ExecStart=/usr/bin/node server/index.js --port 8787
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
```

Adjust the user, the directory and the path to `node` (`which node` prints it), then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now irontide
journalctl -u irontide -f          # room and player log
```

This unit passes `systemd-analyze verify`; it has not been run as an installed service.

## HTTPS (optional)

The game works over plain HTTP, which is how it has been tested. For a public address, put a reverse proxy with a
certificate in front. It must pass WebSocket connections on `/ws` through to the server. With Caddy that is:

```
play.example.com {
    reverse_proxy localhost:8787
}
```

When the page is loaded over HTTPS the client connects with `wss://` to the same host by itself. This proxy setup has
not been tested with IRONTIDE.

## Updating

```bash
git pull
npm ci
npm run assets
npm run build
sudo systemctl restart irontide
```

Restarting ends every running match, because rooms live in memory. Players get the new client on their next reload.

## Limits to know before opening it to the internet

- **No accounts.** Anyone who can reach the address can join any room, under any callsign.
- **No cheat protection to speak of.** Each player's browser reports its own position and its own hits. The server
  only checks fire rate, range and line of sight.
- **Nothing is saved.** Scores and rooms exist only while the room has players.
- **One core.** All rooms run in one process on one core.
- **No compression or CDN.** The server sends the first-visit download (137–260 MB) itself, uncompressed.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Page shows `Not found. Run "npm run build" first` | `dist/` is missing | `npm run build` |
| The page stays on `Loading assets` | Assets were not downloaded before the build | `npm run assets`, then `npm run build` again |
| Works on the server, times out from other machines | Firewall, router or VPN access rules block the port | Open the TCP port on each of them |
| Page loads, but joining a room fails | Something in front of the server does not forward WebSockets | Forward `/ws` with the upgrade headers |
| `Server is full (64 players)` | The room has 64 human players | Join another room name |
| Low frame rate for one player | Their graphics chip | Settings → Graphics quality: Low or Medium |
