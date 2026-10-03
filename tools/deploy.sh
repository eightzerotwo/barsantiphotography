#!/bin/bash
# Publish the site to the gh-pages branch of eightzerotwo/barsantiphotography (GitHub Pages fallback).
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="eightzerotwo/barsantiphotography"
SITE=$(tools/build-site.sh)
echo "barsantiphotography.com" > "$SITE/CNAME"; touch "$SITE/.nojekyll"
cd "$SITE" && git init -q -b gh-pages && git add -A
git -c user.name="Nate Barsanti" -c user.email="nate.barsanti@me.com" commit -q -m "Publish site $(date '+%Y-%m-%d %H:%M')

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -q --force "https://github.com/$REPO.git" gh-pages && echo "Published to $REPO (gh-pages)"
