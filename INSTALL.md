# Installing IRONTIDE

A **release** is one archive, `irontide.tar.gz` (about 330 MB): the built game, its server and the server's
dependencies. Its installer, `install.sh`, unpacks the release, has the server check the settings, starts it and
confirms that it answers. Nothing is compiled, and nothing besides the archive is downloaded.

One process serves the web page and hosts the matches on one TCP port. Players need a desktop browser and the
address.

| The machine needs | |
| --- | --- |
| Node.js 18 or newer, `tar`, a POSIX `sh` | No npm, git or build tools |
| `curl` | For the download line and the checks in this guide. The installer itself does not use it |
| 1.1 GB of free disk | An installation is 370 MB. A download keeps the archive beside it until it is unpacked, and an update holds the old copy until the new one is in place |
| One free TCP port | 8787 unless you choose another |

Processor, memory and bandwidth for a given number of players:
[docs/server-setup.md](docs/server-setup.md#requirements).

## Install

1. **Node.js.** Run `node -v` as the user who will run the installer: root for a machine-wide installation.
   Done when it prints `v18` or higher. Otherwise install Node.js first: on Ubuntu 24.04 `apt-get install -y nodejs`
   gives 18.19; for other systems see <https://nodejs.org/en/download>.

2. **Run the installer**, as root for a machine-wide installation or as an ordinary user for one that needs no root
   ([What it sets up](#what-it-sets-up) shows the difference). Its options carry the settings: `--port`, and
   `--mode`, `--fill`, `--skill` and `--level` for what a new room plays
   ([their values](docs/configuration.md#1-server)). `--help` lists every option.

   From the published release (write `| sudo sh -s --` when you are not root and want it machine-wide):

   ```sh
   curl -fsSL https://github.com/sherzing/irontide/releases/latest/download/install.sh | sh -s -- --port 8787
   ```

   From `install.sh` and `irontide.tar.gz` side by side in one folder on the machine:

   ```sh
   sh install.sh --port 8787
   ```

   From the archive alone, by taking the installer out of it first:

   ```sh
   tar -xzf <path>/irontide.tar.gz -C /tmp irontide/install.sh
   sh /tmp/irontide/install.sh --from <path>/irontide.tar.gz --port 8787
   ```

   Done when it exits 0, its last block starts
   `IRONTIDE <version> is installed in <folder> and running on port <port>.`, and that block's `Settings` line shows
   the values you asked for.
   - It ends `... and is stopped again`: the machine has no systemd, so continue at
     [Without systemd](#without-systemd).
   - It ends with a line starting `install.sh:`: that line names the fault, the fix, and whether anything was
     changed. [When it stops](#when-it-stops) covers the faults a message cannot fully explain.
   - The download answers 404: no release is published. Build one, see [Building a release](#building-a-release).

3. **Let players reach it.** The installer's `Play` line lists the machine's addresses; `<address>` is the one the
   players will use. Run `curl -s http://<address>:<port>/status` on **another machine**. Done when it prints `[]`.
   When it times out, open the TCP port wherever something filters it, then repeat the check: the machine's firewall
   (`ufw allow <port>/tcp`, or `firewall-cmd --permanent --add-port=<port>/tcp && firewall-cmd --reload`), the
   hosting provider's firewall, and on a home connection a port forward on the router. With no second machine at
   hand, have the person open `http://<address>:<port>/` and confirm that the menu appears.

4. **Hand over.** Done when the person has three things from you: the address to give players, the installation
   folder, and the fact that anyone who can reach the address can join, because there are no accounts
   ([limits](docs/server-setup.md#limits-to-know-before-opening-it-to-the-internet)). For an address on the public
   internet with a certificate, see [HTTPS](docs/server-setup.md#https-optional).

## What it sets up

| | Run as root | Run as an ordinary user |
| --- | --- | --- |
| Folder (`--dir` changes it) | `/opt/irontide` | `~/irontide` |
| Service | `/etc/systemd/system/irontide.service`, under a throwaway unprivileged user | `~/.config/systemd/user/irontide.service` |
| Control | `systemctl status\|restart\|stop irontide` | `systemctl --user status\|restart\|stop irontide` |
| Log | `journalctl -u irontide -f` | `journalctl --user -u irontide -f` |
| Starts at boot | Yes | Once lingering is on for the user. The installer turns it on, or prints the `sudo loginctl enable-linger` command when it may not |
| Ports below 1024 | Yes | No |

```text
<folder>/
├── app/              the release; an update replaces it
├── irontide.env      the settings; an update keeps them
└── start.sh          starts the server in the foreground with those settings
```

The service restarts the server when it crashes. It leaves it stopped when a setting is unusable (exit code 78),
with the reason in the log.

## Day to day

- **Is it running?** `curl -s http://localhost:<port>/version` prints the build that answers, and
  `curl -s http://localhost:<port>/status` the open rooms (`[]` when there are none). The server's first log line
  states the settings it started with.
- **Change a setting.** Run the installed copy's installer with the new value, for example
  `sh <folder>/app/install.sh --level crosswind --fill 24`. It checks the value, keeps every setting you did not
  name, and restarts the server. Done when its `Settings` line shows the new value beside the ones you kept.
  Editing `irontide.env` and restarting the service does the same without the check.
- **Update.** Repeat step 2 with the new release. The settings stay. Restarting ends every running match; players
  get the new game on their next reload.
- **Uninstall.** `sh <folder>/app/install.sh --uninstall`, with `--dir <folder>` when it is not the default folder.
  It removes the service, `app/`, `irontide.env` and `start.sh`, and the folder when nothing else is in it.

Each of these needs the rights the installation was made with: root for a machine-wide one.

## Without systemd

Containers, macOS and other machines without systemd get the files and settings but no service: the installer
starts the server once to prove that it answers, then stops it. Run `<folder>/start.sh` under whatever keeps a
process alive there (a container's command, launchd, a terminal multiplexer). It runs in the foreground and logs to
standard output. Before an update, stop that server: the installer needs the port free for its test start.

To run a release with no installer at all, on any system with Node.js 18, unpack the whole archive and start the
server in it:

```sh
tar -xzf irontide.tar.gz && cd irontide && node server/index.js --port 8787
```

## When it stops

| Message or symptom | Cause | Fix |
| --- | --- | --- |
| `Node.js is not installed, or not on this user's PATH` under `sudo`, though `node -v` works without it | Node.js is installed for one user only (nvm and similar), and `sudo` uses another `PATH` | Run the installer without `sudo` for a per-user installation, or install Node.js machine-wide |
| `A service named irontide already runs another installation` | The service name is taken by a copy in another folder | Update that copy with `--dir <its folder>`, or add `--service none` for a second copy and run its `start.sh` yourself |
| `The <kind> service irontide is set up, but the server does not answer` | The server started and failed; the installer printed its log above the message | Act on the log. The new release is in place, so correct the cause and run the installer again |
| Answers on the machine, times out from others | A firewall, a router or VPN access rules filter the port | Step 3 |

## Building a release

In a source checkout, with Node.js 22.12 or newer and npm:

```sh
npm ci
npm run assets       # downloads about 370 MB of textures, models and skies; run it again after an interruption
npm run package      # builds the client, packs release/irontide.tar.gz, then unpacks and starts it as a test
```

Done when the last command prints `started and joined OK`. `release/` then holds `irontide.tar.gz` and
`install.sh`. Copy both into one folder on the target machine and continue at step 2, or publish them, after which
the `curl` line in step 2 installs that release:

```sh
gh release create v<version> release/irontide.tar.gz release/install.sh
```

## Tested on

| System | Node.js | What ran |
| --- | --- | --- |
| Ubuntu 24.04, systemd 255 (container) | 18.19 | Machine-wide and per-user installation with their services, update, changed settings, port 80, restart after a crash, start at boot, uninstall |
| Debian 12 (container, no systemd) | 18.20 | Installation, a joined match through `start.sh`, uninstall |
| Alpine 3.24 (container, BusyBox `sh` and `tar`) | 22.23 | The same |
| Ubuntu 26.04 | 22.23 | Installation without a service, changed settings, uninstall |

Not tested: macOS, Windows, distributions that enforce SELinux (Fedora, RHEL), and the download from GitHub.
