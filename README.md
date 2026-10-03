# Barsanti Photography — site

Static site, no framework. Photos live outside the repo in the folder named by
`photos` in `src/site.json` (currently `~/Desktop/Website`). The build turns that
folder into the site:

    ~/Desktop/Website/*.jpg             -> home page ("Home"); the hero rotates through the first photo
                                           and every other landscape root photo (frame = average shape)
    ~/Desktop/Website/Residential/*.jpg -> residential.html
    ~/Desktop/Website/<Any folder>/     -> one page per folder, added to the nav automatically
    ~/Desktop/Website/Slideshow/        -> the hero rotation only (not in the nav, not in the grid);
                                           photos must share the first one's shape

Optional per-folder files:

    order.txt      one filename per line; listed files come first, in that order
    captions.txt   "filename | caption | architect / builder | town, state" per line
                   (later fields optional). Caption shows in the lightbox; once an architect/builder or town
                   is given, a credit line also appears under the photo in the grid.

## Credits

    python3 tools/sync-captions.py   # fills captions.txt from file names (e.g. "entry 1 John Cole.jpg")

Known projects live in the RULES list at the top of that script; add a line per new client.

## Build

    npm run build          # writes dist/ (only re-encodes photos that changed)

Requires `cwebp` (`brew install webp`). Each photo becomes 480/960/1600/2400px WebP
plus a 24px placeholder; the browser picks the size it needs. Export JPEGs at full
size, sRGB; the build never upscales.

## Publish

    tools/deploy-cloudflare.sh   # Cloudflare Pages (needs `npx wrangler login` once per machine)
    tools/deploy.sh              # GitHub Pages fallback: pushes the built site to the gh-pages branch

Both build first, then upload a clean copy of `dist/` (site pages and images only).

## Edit text

`src/site.json` holds the tagline, about text, contact details and region. The tagline may use
`{Experience}`, which the build fills with "Over N years of experience" from `since`, rounded down to 5s. `collectionOrder` sets the nav order of
the folders. `clients` and `publications` are empty lists; fill them and a Clients / Published in block appears on About.
`src/styles.css` and `src/main.js` are copied into `dist/` as-is.
