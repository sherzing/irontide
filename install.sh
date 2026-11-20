#!/bin/sh
# IRONTIDE installer. Puts a release on this machine, stores its settings and, where systemd is present, runs it as
# a service. It needs a POSIX shell, tar and Node.js 18 or newer. Run it again to update or to change a setting: a
# value given as a flag replaces the stored one, the others stay.
#
#   sh install.sh [options]                                  inside an unpacked release, or beside irontide.tar.gz
#   sh install.sh --from <archive file or http address>      that archive
#   curl -fsSL <release>/install.sh | sh -s -- [options]     downloads the latest release
#
# INSTALL.md walks through a whole installation and lists what each failure message means.
set -eu

REPO=https://github.com/sherzing/irontide
MIN_NODE=18                 # also in scripts/package.mjs
NAME=irontide               # the service, the archive and the default folder carry this name

usage() {
  cat <<EOF
Usage: sh install.sh [options]

  --dir DIR        where to install (default: /opt/$NAME as root, ~/$NAME otherwise)
  --port N         TCP port for the web page and the game (default 8787)
  --mode M         what a new room plays when its first player does not say:
  --fill N           mode, the player count bots fill it up to, the bots' skill
  --skill S          and the level. docs/configuration.md lists the values;
  --level L          left out, the server's defaults apply
  --service KIND   system, user, none or auto (default): a system service as root,
                   a user service otherwise, none where systemd is missing
  --from SRC       the release archive: a file or an http(s) address (default:
                   the release this script sits in or beside, otherwise the
                   latest release on GitHub)
  --uninstall      stop the service and remove the installation in --dir
EOF
}

say() { printf '%s\n' "$*"; }
die() { printf 'install.sh: %s\n' "$*" >&2; exit 1; }

has_systemd() { [ -d /run/systemd/system ] && command -v systemctl >/dev/null 2>&1; }
has_user_systemd() { has_systemd && systemctl --user show-environment >/dev/null 2>&1; }
ctl() { kind=$1; shift; if [ "$kind" = user ]; then systemctl --user "$@"; else systemctl "$@"; fi; }
unit_of() { if [ "$1" = user ]; then say "$UNIT_USER"; else say "$UNIT_SYSTEM"; fi; }
owns() { [ -f "$1" ] && grep -qxF "ExecStart=/bin/sh $DIR/start.sh" "$1"; }        # the unit file $1 starts this installation
stored() { if [ -f "$DIR/$NAME.env" ]; then sed -n "s/^$1=//p" "$DIR/$NAME.env" | tail -n 1; fi; }

find_node() {
  NODE=$(command -v node || true)
  [ -n "$NODE" ] || die "Node.js is not installed, or not on this user's PATH. Install Node.js $MIN_NODE or newer and run this again."
  [ "$("$NODE" -p 'process.versions.node.split(".")[0]')" -ge "$MIN_NODE" ] || die "Node.js $("$NODE" -v) is too old: IRONTIDE needs $MIN_NODE or newer."
  NODE=$("$NODE" -p 'process.execPath')
}

download() {            # $1 address, $2 file
  "$NODE" --no-warnings -e '
    const [url, out] = process.argv.slice(1), file = require("fs").createWriteStream(out);
    (async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error("the server answered " + r.status);
      const total = +r.headers.get("content-length") >> 20;
      let got = 0, shown = 0;
      for await (const chunk of r.body) {
        if (!file.write(chunk)) await new Promise((go) => file.once("drain", go));
        got += chunk.length;
        if (got - shown >= 50 << 20) { shown = got; console.log("  " + (got >> 20) + (total ? " of " + total : "") + " MB"); }
      }
      await new Promise((done) => file.end(done));
    })().catch((e) => { console.error("install.sh: could not download " + url + ": " + e.message); process.exit(1); });
  ' "$1" "$2"
}

port_free() {           # $1 port. Fails with 2 where this user may not open it, with 1 where another program holds it
  "$NODE" -e '
    const s = require("net").createServer();
    s.once("error", (e) => process.exit(e.code === "EACCES" ? 2 : 1));
    s.listen(+process.argv[1], () => s.close(() => process.exit(0)));
  ' "$1"
}

healthy() {             # the server on $PORT is this installation: it reports this build and serves the game's page
  "$NODE" --no-warnings -e '
    const [port, file] = process.argv.slice(1), want = require(file).built, base = "http://127.0.0.1:" + port;
    (async () => {
      for (let i = 0; i < 60; i++) {
        try {
          const build = await (await fetch(base + "/version")).json(), page = await (await fetch(base + "/")).text();
          if (build.built === want && page.includes("IRONTIDE")) process.exit(0);
        } catch {}
        await new Promise((go) => setTimeout(go, 250));
      }
      process.exit(1);
    })();
  ' "$PORT" "$DIR/app/build.json"
}

addresses() {           # where a browser on another machine finds the server
  "$NODE" -p '
    const port = process.argv[1], found = Object.entries(require("os").networkInterfaces())
      .filter(([name]) => !/^(lo|docker|br-|veth|virbr)/.test(name)).flatMap(([, list]) => list)
      .filter((a) => a.family === "IPv4" && !a.internal).map((a) => "http://" + a.address + ":" + port + "/");
    (found.length ? found : ["http://localhost:" + port + "/"]).join("   ");
  ' "$PORT"
}

drop_unit() {           # $1 kind: stop, disable and delete this installation's unit of that kind
  unit=$(unit_of "$1")
  owns "$unit" || return 0
  [ "$1" = user ] || [ -n "$ROOT" ] || die "This installation runs as a system service. Changing or removing that needs root: run this with sudo."
  ctl "$1" disable --now "$NAME" >/dev/null 2>&1 || true
  rm -f "$unit"
  ctl "$1" daemon-reload || true
  say "Removed the $1 service $NAME."
}

write_unit() {
  if [ "$KIND" = system ]; then
    cat > "$UNIT_SYSTEM" <<EOF
# Written by IRONTIDE's install.sh. Settings are in $DIR/$NAME.env.
[Unit]
Description=IRONTIDE game server
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/bin/sh $DIR/start.sh
DynamicUser=yes
AmbientCapabilities=CAP_NET_BIND_SERVICE
Restart=on-failure
RestartSec=2
RestartPreventExitStatus=78

[Install]
WantedBy=multi-user.target
EOF
  else
    mkdir -p "$(dirname "$UNIT_USER")"
    cat > "$UNIT_USER" <<EOF
# Written by IRONTIDE's install.sh. Settings are in $DIR/$NAME.env.
[Unit]
Description=IRONTIDE game server

[Service]
ExecStart=/bin/sh $DIR/start.sh
Restart=on-failure
RestartSec=2
RestartPreventExitStatus=78

[Install]
WantedBy=default.target
EOF
  fi
}

cleanup() {
  [ -z "${BOOT_PID:-}" ] || kill "$BOOT_PID" 2>/dev/null || true
  [ -z "${DIR:-}" ] || { rm -rf "$DIR/app.new" "$DIR/.download.tar.gz" "$DIR/.boot.log"; rmdir "$DIR" 2>/dev/null || true; }      # rmdir takes the folder only when a failed first install left it empty
}

uninstall() {
  [ -f "$DIR/app/build.json" ] || [ -f "$DIR/$NAME.env" ] || die "There is no IRONTIDE installation in $DIR."
  drop_unit system
  if has_user_systemd; then drop_unit user; fi
  rm -rf "$DIR/app" "$DIR/app.new" "$DIR/app.old"
  rm -f "$DIR/$NAME.env" "$DIR/start.sh" "$DIR/.download.tar.gz" "$DIR/.boot.log"
  if rmdir "$DIR" 2>/dev/null; then say "Removed $DIR."; else say "Removed IRONTIDE from $DIR. The folder stays: it holds other files."; fi
}

main() {
  DIR='' FROM='' KIND=auto UNINSTALL='' BOOT_PID=''
  F_PORT='' F_MODE='' F_FILL='' F_SKILL='' F_LEVEL=''
  while [ $# -gt 0 ]; do
    case "$1" in --*=*) arg=$1; shift; set -- "${arg%%=*}" "${arg#*=}" "$@" ;; esac
    case "$1" in --dir|--from|--service|--port|--mode|--fill|--skill|--level) [ $# -ge 2 ] || die "$1 needs a value." ;; esac
    case "$1" in
      --dir) DIR=$2; shift 2 ;;
      --from) FROM=$2; shift 2 ;;
      --service) KIND=$2; shift 2 ;;
      --port) F_PORT=$2; shift 2 ;;
      --mode) F_MODE=$2; shift 2 ;;
      --fill) F_FILL=$2; shift 2 ;;
      --skill) F_SKILL=$2; shift 2 ;;
      --level) F_LEVEL=$2; shift 2 ;;
      --uninstall) UNINSTALL=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) die "Unknown option $1. --help lists the options." ;;
    esac
  done
  case "$KIND" in auto|system|user|none) ;; *) die "--service takes auto, system, user or none." ;; esac

  ROOT=''; if [ "$(id -u)" = 0 ]; then ROOT=1; fi
  if [ -z "$DIR" ]; then
    if [ -n "$ROOT" ]; then DIR=/opt/$NAME
    elif [ -n "${HOME:-}" ]; then DIR=$HOME/$NAME
    else die "HOME is not set: give the folder with --dir."; fi
  fi
  case "$DIR" in /*) ;; *) DIR=$(pwd -P)/$DIR ;; esac
  DIR=${DIR%/}
  case "$DIR" in ''|*[!A-Za-z0-9._/-]*) die "The folder may hold letters, digits, dots, dashes and underscores only: $DIR" ;; esac
  UNIT_SYSTEM=/etc/systemd/system/$NAME.service
  UNIT_USER=${XDG_CONFIG_HOME:-${HOME:-/root}/.config}/systemd/user/$NAME.service
  trap cleanup EXIT
  trap 'exit 130' INT TERM

  if [ -n "$UNINSTALL" ]; then uninstall; exit 0; fi

  find_node
  command -v tar >/dev/null 2>&1 || die "tar is not installed."

  # ---- which service, if any
  if [ "$KIND" = auto ]; then
    if owns "$UNIT_SYSTEM"; then KIND=system
    elif owns "$UNIT_USER"; then KIND=user
    elif [ -n "$ROOT" ] && has_systemd; then KIND=system
    elif [ -z "$ROOT" ] && has_user_systemd; then KIND=user
    else KIND=none; fi
  fi
  case "$KIND" in
    system)
      [ -n "$ROOT" ] || die "A system service needs root: run this with sudo, or pass --service user."
      has_systemd || die "This machine does not run systemd: pass --service none." ;;
    user)
      has_user_systemd || die "There is no systemd user session here (systemctl --user fails): pass --service none, or run this as root for a system service." ;;
  esac
  RUNUSER=''; if [ "$KIND" = system ] && command -v runuser >/dev/null 2>&1; then RUNUSER=1; fi
  if [ -n "$RUNUSER" ]; then                      # the system service runs as an unprivileged user, who must reach Node and, further down, the files
    runuser -u nobody -- "$NODE" -e 0 2>/dev/null || die "A system service cannot run $NODE: it sits in a private folder. Install Node.js system-wide, or run this without sudo for a per-user installation."
  fi
  if [ "$KIND" != none ]; then
    unit=$(unit_of "$KIND")
    if [ -f "$unit" ] && ! owns "$unit"; then
      die "A service named $NAME already runs another installation (see $unit). Give that installation's folder with --dir to update it, or pass --service none for a second copy."
    fi
  fi

  # ---- where the release comes from
  SELF=''; case "$0" in *install.sh) if [ -f "$0" ]; then SELF=$(cd "$(dirname "$0")" && pwd -P); fi ;; esac
  SRC_DIR='' SRC_FILE='' URL=''
  if [ -n "$FROM" ]; then
    case "$FROM" in
      http://*|https://*) URL=$FROM ;;
      *) [ -f "$FROM" ] || die "There is no archive at $FROM."; SRC_FILE=$FROM ;;
    esac
  elif [ -n "$SELF" ] && [ -f "$SELF/build.json" ] && [ -f "$SELF/dist/index.html" ]; then SRC_DIR=$SELF
  elif [ -n "$SELF" ] && [ -f "$SELF/$NAME.tar.gz" ]; then SRC_FILE=$SELF/$NAME.tar.gz
  elif [ -n "$SELF" ] && [ -f "$SELF/scripts/package.mjs" ]; then
    die "This folder is the source code, not a release. Build one with \"npm run package\" and run release/install.sh, or pass --from <archive>."
  else URL=$REPO/releases/latest/download/$NAME.tar.gz
  fi

  # ---- the port: free, or held by this installation's own running service
  OLD_PORT=$(stored PORT)
  PORT=${F_PORT:-$OLD_PORT}; PORT=${PORT:-8787}
  case "$PORT" in *[!0-9]*) PORT=0 ;; esac
  { [ "$PORT" -ge 1 ] && [ "$PORT" -le 65535 ]; } || die "--port takes a number from 1 to 65535."
  ours=''
  for kind in system user; do
    if [ "$PORT" = "$OLD_PORT" ] && owns "$(unit_of "$kind")" && ctl "$kind" is-active --quiet "$NAME" 2>/dev/null; then ours=1; fi
  done
  if [ -z "$ours" ]; then
    port_free "$PORT" || case $? in
      2) die "Port $PORT is below 1024, which only a system service may open: run this with sudo, or pass a higher --port. Nothing was changed." ;;
      *) die "Port $PORT is in use by another program. Pass a free one with --port, or stop that program. Nothing was changed." ;;
    esac
  fi

  # ---- the release, into app.new
  mkdir -p "$DIR" 2>/dev/null || die "Cannot create $DIR: run this with sudo, or give another folder with --dir."
  [ -w "$DIR" ] || die "Cannot write to $DIR: run this with sudo, or give another folder with --dir."
  NEW=$DIR/app.new
  if [ "$SRC_DIR" = "$DIR/app" ]; then
    NEW=$DIR/app                                  # the installed copy's own install.sh: settings and service only
  else
    rm -rf "$NEW"; mkdir "$NEW"
    if [ -n "$URL" ]; then
      say "Downloading $URL"
      download "$URL" "$DIR/.download.tar.gz"
      SRC_FILE=$DIR/.download.tar.gz
    fi
    if [ -n "$SRC_FILE" ]; then
      say "Unpacking into $DIR"
      tar -xzof "$SRC_FILE" -C "$NEW" --strip-components=1 || die "Could not unpack $SRC_FILE. Nothing was changed."
    else
      say "Copying into $DIR"
      cp -R "$SRC_DIR/." "$NEW/"
    fi
    [ -f "$NEW/build.json" ] && [ -f "$NEW/server/index.js" ] && [ -f "$NEW/dist/index.html" ] || die "That is not an IRONTIDE release. Nothing was changed."
  fi

  # ---- settings: flags over stored values; the release's own server judges them
  MODE=${F_MODE:-$(stored MODE)}; FILL=${F_FILL:-$(stored FILL)}; SKILL=${F_SKILL:-$(stored SKILL)}; LEVEL=${F_LEVEL:-$(stored LEVEL)}
  set -- "PORT=$PORT"
  [ -z "$MODE" ] || set -- "$@" "MODE=$MODE"
  [ -z "$FILL" ] || set -- "$@" "FILL=$FILL"
  [ -z "$SKILL" ] || set -- "$@" "SKILL=$SKILL"
  [ -z "$LEVEL" ] || set -- "$@" "LEVEL=$LEVEL"
  SETTINGS=$(env -i "$@" "$NODE" "$NEW/server/index.js" --check) || die "Nothing was changed. Correct the setting above and run this again."

  if [ "$KIND" = system ]; then
    chmod a+rx "$DIR"; chmod -R a+rX "$NEW"
    if [ -n "$RUNUSER" ]; then
      runuser -u nobody -- test -r "$NEW/build.json" || die "A system service cannot read $DIR. Give a folder outside the home folders, such as /opt/$NAME. Nothing was changed."
    fi
  fi

  # ---- from here on the machine changes
  for other in system user; do
    if [ "$other" != "$KIND" ] && { [ "$other" = system ] || has_user_systemd; }; then drop_unit "$other"; fi
  done
  if [ "$NEW" != "$DIR/app" ]; then
    rm -rf "$DIR/app.old"
    if [ -d "$DIR/app" ]; then mv "$DIR/app" "$DIR/app.old"; fi
    mv "$NEW" "$DIR/app"
    rm -rf "$DIR/app.old"
  fi
  {
    say "# IRONTIDE server settings: PORT, MODE, FILL, SKILL, LEVEL. app/docs/configuration.md lists their values."
    say "# A key that is missing takes the server's default. Restart the server after a change."
    for line in "$@"; do say "$line"; done
  } > "$DIR/$NAME.env"
  cat > "$DIR/start.sh" <<EOF
#!/bin/sh
# Starts the IRONTIDE server in the foreground with the settings in $NAME.env. Written by install.sh.
set -a; . "$DIR/$NAME.env"; set +a
cd "$DIR/app" && exec "$NODE" server/index.js
EOF
  chmod 755 "$DIR/start.sh"

  VERSION=$("$NODE" -p 'const b = require(process.argv[1]); b.version + " (" + b.commit + ")"' "$DIR/app/build.json")
  note=''
  if [ "$KIND" = none ]; then
    "$DIR/start.sh" > "$DIR/.boot.log" 2>&1 &
    BOOT_PID=$!
    if healthy; then ok=1; else ok=''; fi
    kill "$BOOT_PID" 2>/dev/null || true; wait "$BOOT_PID" 2>/dev/null || true; BOOT_PID=''
    if [ -z "$ok" ]; then cat "$DIR/.boot.log" >&2; die "The server is installed in $DIR but did not answer on port $PORT. Its output is above."; fi
  else
    write_unit
    ctl "$KIND" daemon-reload
    ctl "$KIND" enable "$NAME" >/dev/null 2>&1
    ctl "$KIND" restart "$NAME"
    if [ "$KIND" = user ]; then
      journal="journalctl --user -u $NAME"; control="systemctl --user"
      if [ "$(loginctl show-user "$(id -un)" -p Linger --value 2>/dev/null)" != yes ] && ! loginctl enable-linger "$(id -un)" 2>/dev/null; then
        note="The server stops when $(id -un) logs out. To keep it running, and start it at boot: sudo loginctl enable-linger $(id -un)"
      fi
    else
      journal="journalctl -u $NAME"; control="systemctl"
    fi
    if ! healthy; then
      $journal -n 25 --no-pager >&2 || true
      die "The $KIND service $NAME is set up, but the server does not answer on port $PORT. Its log is above."
    fi
  fi

  say ""
  if [ "$KIND" = none ]; then
    say "IRONTIDE $VERSION is installed in $DIR. It started and answered on port $PORT, and is stopped again."
    say "  Start      $DIR/start.sh      (runs in the foreground; nothing on this machine keeps it running)"
  else
    say "IRONTIDE $VERSION is installed in $DIR and running on port $PORT."
    say "  Service    $NAME ($KIND): $control status|restart|stop $NAME"
    say "  Log        $journal -f"
  fi
  say "  Play       $(addresses)"
  say "  Settings   $DIR/$NAME.env      (${SETTINGS#settings OK: })"
  [ -z "$note" ] || say "  Note       $note"
}

main "$@"
