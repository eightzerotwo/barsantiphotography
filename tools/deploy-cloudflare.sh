#!/bin/bash
# Publish the site to Cloudflare Pages (project "barsantiphotography").
# First time on a machine: run `npx wrangler login` in a terminal.
set -euo pipefail
cd "$(dirname "$0")/.."
SITE=$(tools/build-site.sh)
# Cloudflare Pages: clean URLs (/about instead of /about.html) and long cache for images
printf '/about /about.html 200\n/residential /residential.html 200\n/commercial /commercial.html 200\n' > "$SITE/_redirects"
printf '/img/*\n  Cache-Control: public, max-age=31536000, immutable\n' > "$SITE/_headers"
npx --yes wrangler@latest pages deploy "$SITE" --project-name barsantiphotography --commit-dirty=true
