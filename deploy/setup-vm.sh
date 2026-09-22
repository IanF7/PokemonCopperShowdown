#!/usr/bin/env bash
# One-time setup for a Debian/Ubuntu VM (e.g. a free-tier Google Cloud e2-micro).
# Run from inside your clone of this repo:
#
#   sudo bash deploy/setup-vm.sh
#
# Safe to re-run. Installs Node.js, builds the server, and installs a systemd
# service ("showdown") that starts on boot, restarts on crashes, and serves
# the game at http://<VM external IP>/ on port 80.

set -euo pipefail

PORT="${PORT:-80}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_USER="${SUDO_USER:-$(whoami)}"

if [ "$(id -u)" -ne 0 ]; then
	echo "Please run with sudo: sudo bash deploy/setup-vm.sh" >&2
	exit 1
fi

echo "=== Repo: $REPO_DIR, running as user: $RUN_USER, port: $PORT ==="

# An e2-micro only has 1 GB of RAM; swap keeps npm installs and busy moments
# from getting the server killed.
if ! swapon --show | grep -q '/swapfile'; then
	echo "=== Adding 2 GB swap ==="
	fallocate -l 2G /swapfile
	chmod 600 /swapfile
	mkswap /swapfile
	swapon /swapfile
	grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Pokemon Showdown needs Node.js 22+
NODE_MAJOR="$(node -v 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/' || true)"
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 22 ]; then
	echo "=== Installing Node.js 22 ==="
	apt-get update
	apt-get install -y ca-certificates curl git
	curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
	apt-get install -y nodejs
fi

chown -R "$RUN_USER":"$RUN_USER" "$REPO_DIR"

echo "=== Installing server dependencies and building ==="
# The client is already built and committed, so only the server needs building.
# logs/ isn't in git, and the server crashes on startup without logs/repl.
sudo -u "$RUN_USER" bash -c "cd '$REPO_DIR/pokemon-showdown' && mkdir -p logs/repl && npm ci --omit=dev --no-audit --no-fund && node build"

echo "=== Installing systemd service ==="
cat > /etc/systemd/system/showdown.service <<EOF
[Unit]
Description=Pokemon Showdown (self-hosted client + server)
After=network-online.target
Wants=network-online.target

[Service]
User=$RUN_USER
WorkingDirectory=$REPO_DIR/pokemon-showdown
# setup-vm.sh and update.sh already build, so don't rebuild on every start
ExecStart=$(command -v node) pokemon-showdown start --skip-build $PORT
Restart=always
RestartSec=5
# lets a non-root user listen on port 80
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable showdown
systemctl restart showdown

IP="$(curl -s -H 'Metadata-Flavor: Google' \
	http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip \
	|| true)"
echo
echo "=== Done! ==="
if [ "$PORT" = "80" ]; then
	echo "Your server should be up in ~10 seconds at: http://${IP:-<your VM external IP>}/"
else
	echo "Your server should be up in ~10 seconds at: http://${IP:-<your VM external IP>}:$PORT/"
fi
echo "Logs:    sudo journalctl -u showdown -f"
echo "Update:  bash deploy/update.sh"
