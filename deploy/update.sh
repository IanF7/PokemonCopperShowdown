#!/usr/bin/env bash
# Pull the latest code from GitHub onto the VM, rebuild, and restart.
#
#   bash deploy/update.sh
#
# Your PC is the source of truth: make changes there, build, commit, push,
# then run this on the VM. Any edits made directly on the VM to tracked files
# are overwritten (pokemon-showdown/config is backed up first, just in case).

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

BACKUP="$HOME/showdown-config-backup-$(date +%Y%m%d-%H%M%S)"
cp -r pokemon-showdown/config "$BACKUP"
echo "=== Backed up server config to $BACKUP ==="

echo "=== Pulling latest code ==="
OLD_LOCK="$(git rev-parse HEAD:pokemon-showdown/package-lock.json)"
git fetch origin
git reset --hard '@{u}'
NEW_LOCK="$(git rev-parse HEAD:pokemon-showdown/package-lock.json)"

echo "=== Rebuilding server ==="
cd pokemon-showdown
mkdir -p logs/repl # not in git; the server crashes on startup without it
# Reinstalling compiles better-sqlite3 from source, which takes 20+ minutes on
# an e2-micro, so only do it when the dependencies actually changed.
if [ "$OLD_LOCK" != "$NEW_LOCK" ] || [ ! -d node_modules ]; then
	npm ci --omit=dev --no-audit --no-fund
else
	echo "(dependencies unchanged, skipping npm install)"
fi
node build

echo "=== Restarting ==="
sudo systemctl restart showdown
echo "Done. Logs: sudo journalctl -u showdown -f"
