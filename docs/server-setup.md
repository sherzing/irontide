# Running an IRONTIDE server

One Node.js process serves the game's web page and hosts the matches. Players need a browser and the server's address,
nothing else.

## Requirements

### Server

| | Needed | Basis |
| --- | --- | --- |
| Processor | 1 core | The server is single-threaded, so every room shares one core. A full 64-player room used 17% of one core in testing. |
| Memory | 1 GB | The running server holds 90–150 MB. |
| Disk | 1.1 GB free | An installation is 370 MB. Installing keeps the 330 MB archive beside it until it is unpacked, and an update holds the old copy until the new one is in place. |
| Upload | 5 Mbit/s for one 24-player room, 35 Mbit/s for one full 64-player room | See the table below. Every new player also downloads 106–229 MB once, depending on the levels they play. |
| Open port | One TCP port (8787 unless you change it) | The web page and the game traffic share it. |
| Software | Node.js 18 or newer, `tar` | A release carries everything else. [INSTALL.md](../INSTALL.md#tested-on) lists the systems it was tested on. |

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
  with 64 players 58 / 51 / 38. Dynamic resolution, on by default, lowers the render resolution to hold the frame rate.
- The first visit downloads 106 MB for Drydock; Breakers adds 59 MB and Crosswind 64 MB when a player first loads
  them (229 MB for all three). The browser keeps the files for a day.

## Install

[INSTALL.md](../INSTALL.md) is the guide: four steps, each with the check that shows it is done, written so that a
coding agent can carry them out. In short, on the server:

```bash
curl -fsSL https://github.com/sherzing/irontide/releases/latest/download/install.sh | sudo sh -s -- --port 8787
```

This downloads the latest release (about 330 MB), unpacks it into `/opt/irontide`, runs it as the systemd service
`irontide` and prints the address to open. Without `sudo` it installs into `~/irontide` with a per-user service.
Running it again updates the installation and keeps its settings; restarting ends every running match, because rooms
live in memory. Settings, logs, uninstalling and machines without systemd are covered in
[INSTALL.md](../INSTALL.md#day-to-day).

Check it from the server itself:

```bash
curl http://localhost:8787/status      # prints [] while no room is open
```

The server's settings (default mode, bot fill, bot skill, level, port) are in
[configuration.md](configuration.md#1-server).

To host changed code, build your own release from a source checkout:
[INSTALL.md](../INSTALL.md#building-a-release). That needs Node.js 22.12 or newer, npm and 1.5 GB of disk.

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

## Limits to know before opening it to the internet

- **No accounts.** Anyone who can reach the address can join any room, under any callsign.
- **No cheat protection to speak of.** Each player's browser reports its own position and its own hits. The server
  only checks fire rate, range and line of sight.
- **Nothing is saved.** Scores and rooms exist only while the room has players.
- **One core.** All rooms run in one process on one core.
- **No compression or CDN.** The server sends the first-visit download (106–229 MB) itself, uncompressed.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Page shows `Not found. Run "npm run build" first` | A source checkout without `dist/` | `npm run build` |
| The page stays on `Loading assets` | A source checkout built before its assets were downloaded | `npm run assets`, then `npm run build` again |
| The service is `failed` with status `78/CONFIG` | A setting in `irontide.env` is unusable, or the port is taken | `journalctl -u irontide -n 5` names it; correct it and restart the service |
| Works on the server, times out from other machines | Firewall, router or VPN access rules block the port | Open the TCP port on each of them |
| Page loads, but joining a room fails | Something in front of the server does not forward WebSockets | Forward `/ws` with the upgrade headers |
| `Server is full (64 players)` | The room has 64 human players | Join another room name |
| Low frame rate for one player | Their graphics chip | Settings → Graphics quality: Low or Medium |
