#!/usr/bin/env bash
# Adds HTTPS in front of the server with Caddy, which gets and renews a free
# Let's Encrypt certificate automatically. Run once, after setup-vm.sh, from
# inside your clone of this repo:
#
#   sudo bash deploy/setup-https.sh yourname.duckdns.org
#
# Before running: your domain must already point at this VM's external IP,
# and the VM needs both "Allow HTTP traffic" and "Allow HTTPS traffic" ticked.
#
# Afterwards Caddy owns ports 80 and 443 (http:// redirects to https://), and
# Pokemon Showdown moves to port 8000 behind it. Safe to re-run.

set -euo pipefail

DOMAIN="${1:-}"
SHOWDOWN_PORT=8000

if [ "$(id -u)" -ne 0 ]; then
	echo "Please run with sudo: sudo bash deploy/setup-https.sh yourname.duckdns.org" >&2
	exit 1
fi
if [ -z "$DOMAIN" ]; then
	echo "Usage: sudo bash deploy/setup-https.sh yourname.duckdns.org" >&2
	exit 1
fi
if [ ! -f /etc/systemd/system/showdown.service ]; then
	echo "Run deploy/setup-vm.sh first." >&2
	exit 1
fi

# Let's Encrypt can only issue the certificate if the domain reaches this VM
MY_IP="$(curl -s -H 'Metadata-Flavor: Google' \
	http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip \
	|| true)"
DOMAIN_IP="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1 {print $1}' || true)"
if [ -n "$MY_IP" ] && [ "$DOMAIN_IP" != "$MY_IP" ]; then
	echo "$DOMAIN points to '${DOMAIN_IP:-nothing}', but this VM's IP is $MY_IP." >&2
	echo "Point the domain at $MY_IP (e.g. on duckdns.org), wait a minute, and re-run." >&2
	exit 1
fi

if ! command -v caddy >/dev/null; then
	echo "=== Installing Caddy ==="
	apt-get update
	apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
		| gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
		> /etc/apt/sources.list.d/caddy-stable.list
	apt-get update
	apt-get install -y caddy
fi

echo "=== Moving Pokemon Showdown to port $SHOWDOWN_PORT ==="
sed -i -E "s|^(ExecStart=.* pokemon-showdown( start)?( --skip-build)?) [0-9]+$|\1 $SHOWDOWN_PORT|" \
	/etc/systemd/system/showdown.service
grep '^ExecStart=' /etc/systemd/system/showdown.service
systemctl daemon-reload
systemctl restart showdown

echo "=== Configuring Caddy for $DOMAIN ==="
cat > /etc/caddy/Caddyfile <<EOF
# Managed by deploy/setup-https.sh
$DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:$SHOWDOWN_PORT
}
EOF
systemctl enable caddy
systemctl restart caddy

echo
echo "=== Done! ==="
echo "In a minute (once the certificate is issued) your server is at: https://$DOMAIN/"
echo "http://$DOMAIN/ and plain http links redirect there automatically."
echo "Logs:  sudo journalctl -u caddy -f    (certificate problems show up here)"
