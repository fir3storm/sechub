#!/usr/bin/env bash
# Confirm the BullMQ ingest worker and repeatable schedule are healthy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "==> PM2 worker status"
pm2 describe sechub-worker 2>/dev/null | grep -E "status|uptime|restarts" || echo "sechub-worker not running"

echo ""
echo "==> Recent worker logs (look for 'Auto news fetcher active')"
pm2 logs sechub-worker --lines 15 --nostream 2>/dev/null || true

echo ""
echo "==> Redis connectivity"
redis-cli -u "${REDIS_URL:-redis://127.0.0.1:6379}" PING 2>/dev/null || echo "Redis ping failed — check REDIS_URL and redis-server"

echo ""
echo "If worker is missing, run: npm run pm2:setup"
echo "After deploy, run: npm run pm2:restart"
