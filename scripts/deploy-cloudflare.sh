#!/usr/bin/env bash
# Deploy to Cloudflare Workers (OpenNext + Wrangler).
#
# 1. Edit the exports below (or rely on `.env`).
# 2. From repo root:  bash scripts/deploy-cloudflare.sh
#
set -euo pipefail

# --- edit as needed ---------------------------------------------------------

# Optional Wrangler environment name (empty = default). Must exist in wrangler config if set.
export CLOUDFLARE_ENV="${CLOUDFLARE_ENV:-}"

# 1 = only build + upload Worker (skip `payload migrate` and D1 PRAGMA).
SKIP_DATABASE="${SKIP_DATABASE:-0}"

# ---------------------------------------------------------------------------

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "==> $(pwd)"
echo "==> CLOUDFLARE_ENV=${CLOUDFLARE_ENV:-<default>}  SKIP_DATABASE=$SKIP_DATABASE  USE_WRANGLER_OAUTH=${USE_WRANGLER_OAUTH:-0}"

if [[ "$SKIP_DATABASE" == "1" ]]; then
  pnpm run deploy:app
else
  pnpm run deploy
fi

echo "==> Finished. After first successful deploy, set Worker env NEXT_PUBLIC_SERVER_URL to your https://… URL and redeploy if required."
