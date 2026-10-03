#!/bin/bash
# Build and assemble a clean copy of the site (no design studies or artifact fragments).
# Prints the folder path. Used by deploy.sh and deploy-cloudflare.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
DOMAIN="barsantiphotography.com"
python3 tools/sync-captions.py >/dev/null
node build.mjs >&2
SITE="$(mktemp -d)/site"; mkdir -p "$SITE"
cp -R dist/img "$SITE/img"
for f in index.html about.html residential.html commercial.html styles.css main.js; do cp "dist/$f" "$SITE/$f"; done
for f in dist/*.html; do b=$(basename "$f"); case "$b" in index.html|about.html|residential.html|commercial.html|a-*|b-*|c-*|a.html|b.html|c.html|compare.html|preview-index.html) ;; *) cp "$f" "$SITE/$b";; esac; done
printf 'User-agent: *\nAllow: /\nSitemap: https://%s/sitemap.xml\n' "$DOMAIN" > "$SITE/robots.txt"
{ echo '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'; for p in "" about.html residential.html commercial.html; do echo "<url><loc>https://$DOMAIN/$p</loc></url>"; done; echo '</urlset>'; } > "$SITE/sitemap.xml"
cp "$SITE/index.html" "$SITE/404.html"
echo "$SITE"
