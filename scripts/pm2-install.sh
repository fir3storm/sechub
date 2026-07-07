#!/usr/bin/env bash
# Register SecHub with PM2 and enable auto-start after VPS reboot.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> SecHub PM2 setup (cwd: $ROOT)"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "Installing PM2 globally..."
  sudo npm install -g pm2
fi

mkdir -p logs

# Load .env so PORT and other vars are available to PM2
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  echo "Loaded .env"
else
  echo "Warning: .env not found — copy .env.example and configure it first."
fi

echo "==> Stopping old processes (if any)..."
pm2 delete sechub-web sechub-worker 2>/dev/null || true

echo "==> Starting from ecosystem.config.cjs..."
pm2 start ecosystem.config.cjs

echo "==> Saving process list for reboot..."
pm2 save

echo ""
echo "==> Enable auto-start on boot (run the command PM2 prints below with sudo):"
pm2 startup systemd -u "${USER}" --hp "${HOME}" || true

echo ""
pm2 status
echo ""
echo "Done. After 'pm2 startup', rebooting the VPS will bring SecHub back automatically."
echo "Useful commands:"
echo "  pm2 status"
echo "  pm2 logs sechub-web"
echo "  pm2 logs sechub-worker"
echo "  pm2 restart ecosystem.config.cjs"
