#!/bin/bash
# Publish the site to Cloudflare as a Worker with static assets (Cloudflare's current home for
# static sites; "Pages" deployments are routed here). First time on a machine: `npx wrangler login`.
set -euo pipefail
cd "$(dirname "$0")/.."
SITE=$(tools/build-site.sh)
printf '/img/*\n  Cache-Control: public, max-age=31536000, immutable\n' > "$SITE/_headers"
cat > "$SITE/../wrangler.jsonc" <<JSON
{
  "name": "barsantiphotography",
  "compatibility_date": "2026-10-01",
  "assets": { "directory": "./site", "html_handling": "auto-trailing-slash", "not_found_handling": "404-page" }
}
JSON
cd "$SITE/.." && npx --yes wrangler@latest deploy 2>&1 | grep -vE '^\s*$|Metrics'
