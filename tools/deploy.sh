#!/bin/bash
# Build the site and publish dist/ to the gh-pages branch of eightzerotwo/barsantiphotography.
# Usage: tools/deploy.sh            (run from anywhere)
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="eightzerotwo/barsantiphotography"
DOMAIN="barsantiphotography.com"

python3 tools/sync-captions.py >/dev/null
node build.mjs

# a clean copy of just the site: no design studies, no artifact fragments
SITE="$(mktemp -d)/site"; mkdir -p "$SITE"
cp -R dist/img "$SITE/img"
for f in index.html about.html residential.html commercial.html styles.css main.js; do cp "dist/$f" "$SITE/$f"; done
for f in dist/*.html; do b=$(basename "$f"); case "$b" in index.html|about.html|residential.html|commercial.html) ;; a-*|b-*|c-*|a.html|b.html|c.html|compare.html|preview-index.html) ;; *) cp "$f" "$SITE/$b";; esac; done
echo "$DOMAIN" > "$SITE/CNAME"
touch "$SITE/.nojekyll"
printf 'User-agent: *\nAllow: /\nSitemap: https://%s/sitemap.xml\n' "$DOMAIN" > "$SITE/robots.txt"
{ echo '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'; for p in "" about.html residential.html commercial.html; do echo "<url><loc>https://$DOMAIN/$p</loc></url>"; done; echo '</urlset>'; } > "$SITE/sitemap.xml"
cp "$SITE/index.html" "$SITE/404.html"

cd "$SITE"
git init -q -b gh-pages
git add -A
git -c user.name="Nate Barsanti" -c user.email="nate.barsanti@me.com" commit -q -m "Publish site $(date '+%Y-%m-%d %H:%M')

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -q --force "https://github.com/$REPO.git" gh-pages
echo "Published $(ls img | wc -l | tr -d ' ') image files and $(ls *.html | wc -l | tr -d ' ') pages to $REPO (gh-pages)"
