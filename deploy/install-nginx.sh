#!/usr/bin/env bash
# Adds the /rr/ location to the dev.nbs.narxoz.kz nginx site (HTTPS server block).
# Run on the server with: sudo bash deploy/install-nginx.sh
set -euo pipefail

SITE=/etc/nginx/sites-enabled/dev.nbs.narxoz.kz
SNIPPET="$(dirname "$0")/nginx-rr.conf"
ANCHOR="    # BASQAR API"
BACKUP_DIR="${SUDO_USER:+/home/$SUDO_USER}/nginx-backups"

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo"; exit 1; }
[ -f "$SITE" ] || { echo "Not found: $SITE"; exit 1; }

if grep -q "location /rr/" "$SITE"; then
  echo "Already installed: /rr/ location exists in $SITE"
  exit 0
fi
grep -qF "$ANCHOR" "$SITE" || { echo "Anchor '$ANCHOR' not found; add $SNIPPET manually"; exit 1; }

# Backup outside sites-enabled so nginx does not load it.
mkdir -p "$BACKUP_DIR"
BACKUP="$BACKUP_DIR/dev.nbs.narxoz.kz.$(date +%Y%m%d%H%M%S)"
cp "$SITE" "$BACKUP"
echo "Backup: $BACKUP"

awk -v anchor="$ANCHOR" -v snippet="$SNIPPET" '
  $0 == anchor && !done { while ((getline line < snippet) > 0) print line; done = 1 }
  { print }
' "$BACKUP" > "$SITE"

if nginx -t; then
  systemctl reload nginx
  echo "OK: https://dev.nbs.narxoz.kz/rr/"
else
  echo "nginx -t failed, restoring backup"
  cp "$BACKUP" "$SITE"
  nginx -t && systemctl reload nginx
  exit 1
fi
