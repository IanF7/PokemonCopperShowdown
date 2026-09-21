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
git fetch origin
git reset --hard '@{u}'

echo "=== Rebuilding server ==="
cd pokemon-showdown
npm ci --omit=dev --no-audit --no-fund
node build

echo "=== Restarting ==="
sudo systemctl restart showdown
echo "Done. Logs: sudo journalctl -u showdown -f"
