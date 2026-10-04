// Builds the site into ./dist from the photo folder named in src/site.json.
//
// Folder rules (no code changes needed to add work):
//   <photos>/*.jpg            -> home page ("Home")
//   <photos>/<Folder>/*.jpg   -> one collection page per folder, e.g. Residential/ -> residential.html
//   <folder>/order.txt        -> optional, one filename per line; listed files come first in that order
//   <folder>/captions.txt     -> optional, "filename | caption" per line, shown in the lightbox
//
// Requires: node, sips (macOS), cwebp (brew install webp)

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, copyFileSync } from 'node:fs';
import { execFileSync, execFile } from 'node:child_process';
import { join, basename, extname } from 'node:path';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const ROOT = new URL('.', import.meta.url).pathname;
const SITE = JSON.parse(readFileSync(join(ROOT, 'src/site.json'), 'utf8'));
const DIST = join(ROOT, 'dist');
const IMG = join(DIST, 'img');
const WIDTHS = [480, 960, 1600, 2400];
const YEAR = new Date().getFullYear();
// "over 15 years": years since SITE.since, rounded down to the nearest five, so it stays true as time passes
const EXPERIENCE = `over ${Math.floor((YEAR - SITE.since) / 5) * 5} years of experience`;
const TAGLINE = SITE.tagline.replace('{Experience}', EXPERIENCE[0].toUpperCase() + EXPERIENCE.slice(1)).replace('{experience}', EXPERIENCE);

mkdirSync(IMG, { recursive: true });

// ---------- photo discovery ----------
const isPhoto = (f) => /\.(jpe?g|png|tiff?)$/i.test(f) && !f.startsWith('.');

function readLines(p) {
  return existsSync(p) ? readFileSync(p, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : [];
}

function slugify(s) {
  return s.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Camera filenames make poor captions; human ones ("Living room 1") are usable.
function autoCaption(file) {
  const stem = file.replace(/\.[^.]+$/, '').trim();
  if (/^(img|dsc|dji|_?[0-9a-z]{3,4}\d{4})/i.test(stem)) return '';
  return stem.replace(/[-_]?(edit|hdr)(-\d+)?/gi, '').replace(/\s+\d+$/, '').replace(/\s+/g, ' ').trim();
}

function dims(p) {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', p], { encoding: 'utf8' });
  const w = +out.match(/pixelWidth:\s*(\d+)/)[1];
  const h = +out.match(/pixelHeight:\s*(\d+)/)[1];
  return { w, h };
}

function listFolder(dir) {
  const files = readdirSync(dir).filter((f) => isPhoto(f) && statSync(join(dir, f)).isFile());
  const order = readLines(join(dir, 'order.txt'));
  // captions.txt: "filename | caption | architect / builder | town, state" (later fields optional)
  const caps = Object.fromEntries(
    readLines(join(dir, 'captions.txt')).map((l) => l.split('|').map((s) => s.trim())).filter((a) => a.length >= 2).map((a) => [a[0], { caption: a[1], credit: a[2] ?? '', town: a[3] ?? '' }])
  );
  const rank = (f) => (order.includes(f) ? order.indexOf(f) : order.length + 1);
  files.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, undefined, { numeric: true }));
  // Slugs must not depend on ordering: names that collide (e.g. "St Pauls School" and
  // "St. Pauls School") each get a short hash of their exact filename appended.
  const base = (f) => slugify(basename(dir) === basename(SITE.photos) ? f : basename(dir) + '-' + f);
  const counts = {}; for (const f of files) counts[base(f)] = (counts[base(f)] || 0) + 1;
  const hash = (str) => { let x = 0; for (const ch of str) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x.toString(36).slice(0, 5); };
  return files.map((f) => {
    const src = join(dir, f);
    const { w, h } = dims(src);
    const slug = counts[base(f)] > 1 ? `${base(f)}-${hash(f)}` : base(f);
    return {
      file: f,
      src,
      slug,
      w, h, ratio: w / h,
      caption: caps[f]?.caption ?? autoCaption(f),
      credit: caps[f]?.credit ?? '',
      town: caps[f]?.town ?? '',
      aerial: /^dji/i.test(f),
      mtime: statSync(src).mtimeMs,
    };
  });
}

const SLIDESHOW = 'Slideshow';   // optional folder: its photos become the hero rotation and nothing else
const home = listFolder(SITE.photos);
const slideshow = existsSync(join(SITE.photos, SLIDESHOW)) ? listFolder(join(SITE.photos, SLIDESHOW)) : [];
const collections = readdirSync(SITE.photos)
  .filter((d) => !d.startsWith('.') && d !== SLIDESHOW && statSync(join(SITE.photos, d)).isDirectory())
  .sort((a, b) => { // order from site.json collectionOrder; anything unlisted follows alphabetically
    const o = SITE.collectionOrder ?? []; const ia = o.indexOf(a), ib = o.indexOf(b);
    return (ia < 0 ? o.length : ia) - (ib < 0 ? o.length : ib) || a.localeCompare(b);
  })
  .map((d) => ({ title: d, slug: slugify(d), photos: listFolder(join(SITE.photos, d)) }))
  .filter((c) => c.photos.length);

// ---------- image encoding ----------
// Anything not exported as sRGB is converted to sRGB first (browsers assume sRGB
// for the web); the ICC profile is kept in the WebP either way so colour survives.
const SRGB = '/System/Library/ColorSync/Profiles/sRGB Profile.icc';
function srgbSource(photo) {
  const prof = execFileSync('sips', ['-g', 'profile', photo.src], { encoding: 'utf8' });
  if (/sRGB/i.test(prof)) return photo.src;
  const tmp = join(IMG, `.${photo.slug}-srgb.jpg`);
  if (!existsSync(tmp) || statSync(tmp).mtimeMs < photo.mtime) {
    execFileSync('sips', ['--matchTo', SRGB, photo.src, '--out', tmp], { stdio: 'ignore' });
    console.log(`  converted to sRGB: ${photo.file}`);
  }
  return tmp;
}

async function encode(photo) {
  const jobs = [];
  const src = srgbSource(photo);
  for (const w of WIDTHS) {
    if (w > photo.w * 1.05) continue; // never upscale
    const out = join(IMG, `${photo.slug}-${w}.webp`);
    if (existsSync(out) && statSync(out).mtimeMs > photo.mtime) {
      const d = dims(out);                              // stale or swapped file? re-encode
      if (Math.abs(d.w / d.h - photo.ratio) / photo.ratio < 0.01) continue;
    }
    jobs.push(execFileP('cwebp', ['-quiet', '-q', '86', '-sharp_yuv', '-metadata', 'icc', '-resize', String(w), '0', src, '-o', out]));
  }
  await Promise.all(jobs);
  photo.widths = WIDTHS.filter((w) => w <= photo.w * 1.05);
  photo.tiny = '';
}

// Share-card image: link previews are safest with a JPEG, so the lead photo also gets a 1600px JPEG.
function shareImage(photo) {
  const w = Math.min(1600, photo.w), h = Math.round(w / photo.ratio);
  const out = join(IMG, `${photo.slug}-share.jpg`);
  if (!(existsSync(out) && statSync(out).mtimeMs > photo.mtime && Math.abs(dims(out).w / dims(out).h - photo.ratio) / photo.ratio < 0.01)) {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85', '-Z', String(w), srgbSource(photo), '--out', out], { stdio: 'ignore' });
  }
  return { file: `img/${photo.slug}-share.jpg`, w, h };
}

async function pool(items, n, fn) {
  const q = [...items];
  await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()); }));
}

// ---------- layout: justified rows ----------
// Pack photos into rows whose aspect ratios sum to about TARGET, so every row
// fills the width and images inside a row share a height. Landscape 3:2 = 1.5,
// portrait 2:3 = 0.67. A row of one wide landscape reads as a full-bleed beat.
// Cadence: targets per row, cycling. 1.6 lets one landscape run full width as a beat;
// 3.2 packs a wider row of three. Collections start on a full-width beat.
const CADENCE_HOME = [2.7, 2.7, 1.6, 3.2, 2.7, 1.6];
const CADENCE_COLLECTION = [1.6, 2.7, 2.7, 3.2, 1.6, 2.7];
function rows(photos, cadence = CADENCE_HOME) {
  const out = [];
  let row = [], sum = 0;
  const target = () => cadence[out.length % cadence.length];
  for (const p of photos) {
    const t = target();
    if (row.length && sum + p.ratio > t && Math.abs(sum - t) < Math.abs(sum + p.ratio - t)) {
      out.push(row); row = []; sum = 0;
    }
    row.push(p); sum += p.ratio;
  }
  if (row.length) out.push(row);
  return out;
}

// ---------- HTML ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Wrap known firm names in links to their home pages (site.json "firms"). Longest names first
// so "Lee Kennedy Co." is matched before any shorter overlap.
const FIRMS = Object.entries(SITE.firms ?? {}).sort((a, b) => b[0].length - a[0].length);
function linkFirms(text) {
  let html = esc(text);
  for (const [name, url] of FIRMS) {
    const e = esc(name);
    html = html.split(e).join(`<a href="${esc(url)}" target="_blank" rel="noopener">${e}</a>`);
  }
  return html;
}

function picture(p, { sizes, eager = false, index }) {
  const srcset = p.widths.map((w) => `img/${p.slug}-${w}.webp ${w}w`).join(', ');
  const largest = p.widths[p.widths.length - 1];
  const line = [p.caption, p.credit, p.town].filter(Boolean).join(' | ');
  const alt = line || `${SITE.name} photograph`;
  // A credit line appears over the frame (on hover) only once credit data exists in captions.txt.
  const cap = (p.credit || p.town) ? `\n  <figcaption class="ph__cap">${linkFirms(line)}</figcaption>` : '';
  return `<figure class="ph" style="--r:${p.ratio.toFixed(4)}" data-index="${index}" data-full="img/${p.slug}-${largest}.webp" data-srcset="${srcset}" data-title="${esc(p.caption)}" data-credit="${esc(p.credit)}" data-town="${esc(p.town)}" data-caption="${esc(line)}">
  <button type="button" class="ph__btn" aria-label="Open ${esc(alt)}">
    <img src="img/${p.slug}-${p.widths[0]}.webp" srcset="${srcset}" sizes="${sizes}" width="${p.w}" height="${p.h}" alt="${esc(alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"'}>
  </button>${cap}
</figure>`;
}

function gallery(photos, { startIndex = 0, cadence = CADENCE_HOME, insertAfter = -1, insert = '' } = {}) {
  let i = startIndex;
  return rows(photos, cadence).map((row, r) => {
    const sum = row.reduce((s, p) => s + p.ratio, 0);
    const html = `<div class="row">\n${row.map((p) => {
      const share = Math.round((p.ratio / sum) * 100);
      return picture(p, { sizes: `(max-width: 640px) 100vw, ${share}vw`, index: i++ });
    }).join('\n')}\n</div>`;
    return r === insertAfter ? html + '\n' + insert : html;
  }).join('\n');
}

// ---------- composition: two independent columns, staggered edges ----------
// 12-column grid in container-width units (cqw), rows of 0.4cqw. The page is built in
// segments; each segment splits the width into two columns of different widths and
// stacks photos into whichever column is shorter, so edges stagger instead of lining up.
// Portraits only go into columns 5 wide or narrower. When both columns end within a
// small tolerance, a full-width landscape runs as a beat and the next segment starts
// with a different split. Text blocks flow through the same columns.
const COLS = 12, GAP = 0.5, UNIT = 0.4;
const CW = (100 - (COLS - 1) * GAP) / COLS;
const W = (s) => s * CW + (s - 1) * GAP;
const H = (s, ratio) => W(s) / ratio;
const U = (h) => Math.round(h / UNIT);
const SPLITS = [[5, 7], [7, 5], [4, 8], [8, 4], [5, 7], [7, 5]];   // always one column 5 or narrower: verticals and text live there

function compose(photos, texts, startIndex = 0) {
  // merge text blocks into the sequence at their requested photo positions
  const q = [];
  photos.forEach((p, k) => { texts.filter((t) => t.after === k).forEach((t) => q.push({ kind: 'text', ...t })); q.push({ kind: 'img', p }); });
  texts.filter((t) => t.after >= photos.length).forEach((t) => q.push({ kind: 'text', ...t }));
  let i = startIndex, top = 0, seg = 0;
  const cells = [];
  const isP = (p) => p.ratio < 1;
  const emit = (c, s, y, h, html, kind, ratio = 0) => cells.push({ c, s, y, h, html, kind, ratio });
  const img = (p, s) => picture(p, { sizes: `(max-width: 640px) 100vw, ${Math.round((s / 12) * 100)}vw`, index: i++ });
  const fits = (it, s) => it.kind === 'text' ? (s >= 4 && s <= 5) : (isP(it.p) ? s <= 5 : true);
  const height = (it, s) => it.kind === 'text' ? it.minCqw + 2 : H(s, it.p.ratio);

  while (q.length) {
    const [wa, wb] = SPLITS[seg++ % SPLITS.length];
    const cols = [{ c: 1, s: wa, y: top }, { c: 1 + wa, s: wb, y: top }];
    let placed = 0;
    while (q.length) {
      const order = cols[0].y <= cols[1].y ? [cols[0], cols[1]] : [cols[1], cols[0]];
      let done = false;
      // Once the segment is long enough, try to end it level: look ahead for the item
      // whose height closes the gap, or stretch a pending text block to fill it.
      if (placed >= 4) {
        const short = order[0], gap = order[1].y - short.y - GAP;
        const ahead = q.slice(0, 6);
        const kk = ahead.findIndex((it) => it.kind === 'img' && fits(it, short.s) && Math.abs(height(it, short.s) - gap) <= 3);
        if (kk >= 0) {
          const it = q.splice(kk, 1)[0];
          const h = height(it, short.s);
          emit(short.c, short.s, short.y, h, it.kind === 'text' ? it.html : img(it.p, short.s), it.kind, it.p?.ratio);
          short.y += h + GAP; placed++;
          break;                                     // level: segment ends here
        }
      }
      for (const col of order) {
        const k = q.findIndex((it) => fits(it, col.s));
        if (k < 0 || k > 2) continue;                 // look at most three items ahead
        const it = q.splice(k, 1)[0];
        const h = height(it, col.s);
        emit(col.c, col.s, col.y, h, it.kind === 'text' ? it.html : img(it.p, col.s), it.kind, it.p?.ratio);
        col.y += h + GAP; placed++; done = true; break;
      }
      if (!done) { // nothing within lookahead fits: search the whole queue, then force
        let k = q.findIndex((it) => fits(it, order[0].s)); let col = order[0];
        if (k < 0) { k = q.findIndex((it) => fits(it, order[1].s)); col = order[1]; }
        if (k < 0) { k = 0; col = order[0]; }
        const it = q.splice(k, 1)[0]; const h = height(it, col.s);
        emit(col.c, col.s, col.y, h, it.kind === 'text' ? it.html : img(it.p, col.s), it.kind, it.p?.ratio); col.y += h + GAP; placed++;
      }
      const diff = Math.abs(cols[0].y - cols[1].y);
      if (placed >= 4 && diff <= 3) break;         // columns level enough: end the segment
      if (placed >= 16) break;
    }
    top = Math.max(cols[0].y, cols[1].y);
    // (no full-width beats: the hero is the only full-width image)
  }
  cells.sort((a, b) => a.y - b.y || a.c - b.c);
  phoneLayout(cells);
  return cells.map((it) => `<div class="cell${it.kind === 'text' ? ' cell--text' + (it.c > 1 ? ' cell--right' : '') + (it.y === 0 ? ' cell--lead' : '') : ''}" style="--c:${it.c};--s:${it.s};--r:${U(it.y) + 1};--n:${U(it.h)};--mc:${it.mc};--ms:${it.ms}">${it.html}</div>`).join('\n');
}

// Phone rhythm (≤640px), on the same 12-column grid: landscapes run full width, with every third one
// stepped in to nine columns on alternating sides; two portraits in a row share a row, their widths
// proportional to their shapes so they stand the same height; a lone portrait sits eight columns wide,
// alternating left and right. Text blocks take the full width. Photos stay whole at every size.
function phoneLayout(cells) {
  let land = 0, side = 0;
  for (let i = 0; i < cells.length; i++) {
    const it = cells[i];
    if (it.kind === 'text') { it.mc = 1; it.ms = 12; continue; }
    if (it.ratio < 1) {
      // desktop placement is explicit, so the DOM may be reordered for the phone: pull a portrait
      // from the next two cells up beside this one so the pair shares a row
      const k = [i + 2, i + 3].find((j) => j < cells.length && cells[j].kind === 'img' && cells[j].ratio < 1 && cells[i + 1]?.kind === 'img');
      if (k !== undefined) cells.splice(i + 1, 0, cells.splice(k, 1)[0]);
      const nx = cells[i + 1];
      if (nx && nx.kind === 'img' && nx.ratio < 1) {
        const s1 = Math.max(4, Math.min(8, Math.round((12 * it.ratio) / (it.ratio + nx.ratio))));
        it.mc = 1; it.ms = s1; nx.mc = 1 + s1; nx.ms = 12 - s1; i++;
      } else { it.ms = 8; it.mc = side++ % 2 ? 5 : 1; }
      continue;
    }
    if (land++ % 3 === 2) { it.ms = 9; it.mc = side++ % 2 ? 4 : 1; } else { it.mc = 1; it.ms = 12; }
  }
}

const nav = (active) => {
  const items = [['index.html', 'Home'], ...collections.map((c) => [`${c.slug}.html`, c.title]), ['about.html', 'About']];
  return `<nav class="nav" aria-label="Site">${items.map(([href, label]) =>
    `<a href="${href}"${href === active ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
};

const header = (active) => `<header class="top">
  <a class="mark" href="index.html" aria-label="${SITE.name}, home"><span class="mark__name">Barsanti</span><span class="mark__sub">Photography</span></a>
  ${nav(active)}
</header>`;

const contactLinks = () => `<a href="tel:+1${SITE.phone.replace(/\D/g, '')}">${SITE.phone}</a>
      <a href="mailto:${SITE.email}">${SITE.email}</a>
      <a href="${SITE.facebook}" rel="me noopener" target="_blank">Facebook</a>`;

const footer = () => `<footer class="foot">
  <div class="foot__grid">
    <div class="foot__brand">
      <span class="mark mark--foot"><span class="mark__name">Barsanti</span><span class="mark__sub">Photography</span></span>
      <p class="foot__line">Architectural and interior photography, Vermont and Massachusetts.</p>
    </div>
    <div>
      <h2 class="foot__h">Contact</h2>
      <p class="foot__list"><span>Nate Barsanti</span>${contactLinks()}</p>
    </div>
    <div>
      <h2 class="foot__h">Based in</h2>
      <p class="foot__list"><span>${esc(SITE.region)}</span></p>
    </div>
  </div>
  <p class="foot__legal">© ${YEAR} ${SITE.name}. All photographs are copyrighted and may not be used without permission.</p>
</footer>`;

const lightbox = () => `<div class="lb" id="lightbox" hidden role="dialog" aria-modal="true" aria-label="Photo viewer">
  <button type="button" class="lb__close" data-lb="close" aria-label="Close">×</button>
  <button type="button" class="lb__nav lb__nav--prev" data-lb="prev" aria-label="Previous photo">‹</button>
  <figure class="lb__fig"><img class="lb__img" alt=""><figcaption class="lb__cap"></figcaption></figure>
  <button type="button" class="lb__nav lb__nav--next" data-lb="next" aria-label="Next photo">›</button>
  <div class="lb__count" aria-live="polite"></div>
</div>`;

// Share cards (iMessage, Slack, Facebook) read the og: tags: a clean name, the tagline, and the lead slide.
const head = (title, desc, { ogTitle = SITE.name, image = null, path = '' } = {}) => `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(desc)}">
${SITE.url ? `<meta property="og:url" content="${esc(SITE.url)}/${path}">` : ''}
${image && SITE.url ? (({ file, w, h }) => `<meta property="og:image" content="${esc(SITE.url)}/${file}">
<meta property="og:image:width" content="${w}">
<meta property="og:image:height" content="${h}">
<meta name="twitter:card" content="summary_large_image">`)(shareImage(image)) : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,400..600&family=Roboto+Flex:wdth,wght@100..125,300..700&display=swap">
<link rel="stylesheet" href="styles.css">`;

// body markup shared by the full page and the artifact-preview fragment
function body(active, main) {
  return `${header(active)}
<main class="page" style="container-type: inline-size">
${main}
</main>
${footer()}
${lightbox()}
<script src="main.js" defer></script>`;
}

const doc = (title, desc, active, main, share) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head(title, desc, share)}
</head>
<body>
${body(active, main)}
</body>
</html>
`;

let _home;
function homePage() {
  if (_home) return _home;
  return (_home = buildHomePage());
}
function buildHomePage() {
  // Slides: the Slideshow folder if it has photos, else the root folder's photos that share
  // the lead's shape. The frame is sized to the TALLEST slide and every slide sits on its
  // bottom edge, so each photo shows whole: nothing is cropped, scaled oddly, or filled in.
  const pool = slideshow.length ? slideshow : home;
  const hero = pool[0];
  const slides = slideshow.length ? pool : pool.filter((p) => Math.abs(p.ratio - hero.ratio) / hero.ratio < 0.005);
  const rest = slideshow.length ? home : home.filter((p) => p !== hero);
  const heroRatio = Math.min(...slides.map((p) => p.ratio));
  const slideHtml = slides.map((p, i) => {
    const srcset = p.widths.map((w) => `img/${p.slug}-${w}.webp ${w}w`).join(', ');
    const line = [p.caption, p.credit, p.town].filter(Boolean).join(' | ');
    const alt = line || `${SITE.name} photograph`;
    const cap = (p.credit || p.town) ? `<div class="hero__cap">${linkFirms(line)}</div>` : '';
    return `<div class="hero__slide${i === 0 ? ' is-on' : ''}"><figure class="hero__fig" style="--sr:${p.ratio.toFixed(4)}"><img src="img/${p.slug}-${p.widths[0]}.webp" srcset="${srcset}" sizes="100vw" width="${p.w}" height="${p.h}" alt="${esc(alt)}"${i === 0 ? ' fetchpriority="high"' : i === 1 ? '' : ' loading="lazy" decoding="async"'}>${cap}</figure></div>`;
  }).join('\n');
  const texts = [
    { after: 0, minCqw: 19, html: `<div class="blk blk--statement">
  <h1 class="blk__h">${esc(TAGLINE)}</h1>
  <p class="blk__meta"><span class="blk__name">Nate Barsanti</span><span>${esc(SITE.region)}</span></p>
  <p class="blk__link"><a href="about.html">About Nate</a></p>
</div>` },
    { after: 6, minCqw: 17, html: `<div class="blk blk--note">
  <p class="blk__label">On a shoot</p>
  <p class="blk__p">For architects, interior designers, builders and developers: exteriors and interiors on the ground or with drone, and video when a project calls for motion. Remote viewing is available, so you can always be in the loop on every frame.</p>
  <p class="blk__link"><a href="about.html">More about the work</a></p>
</div>` },
    { after: 13, minCqw: 18, html: `<nav class="blk blk--index" aria-label="Site index">
  <p class="blk__label idx__label">Explore</p>
  <ul class="idx">
${collections.map((c) => `    <li class="idx__row"><a href="${c.slug}.html">${esc(c.title)}</a></li>`).join('\n')}
    <li class="idx__row"><a href="about.html">About</a></li>
  </ul>
  <address class="idx__contact">
    <span class="idx__name">Nate Barsanti</span>
    <a href="tel:+1${SITE.phone.replace(/\D/g, '')}">${SITE.phone}</a>
    <a href="mailto:${SITE.email}">${SITE.email}</a>
  </address>
</nav>` },
  ];
  const main = `<section class="hero" id="hero" style="--r:${heroRatio.toFixed(4)}" aria-label="Featured photographs">
${slideHtml}
</section>
<div class="comp-wrap"><section class="comp" aria-label="Home">
${compose(rest, texts, 0)}
</section></div>`;
  return { main, title: SITE.title, desc: TAGLINE, share: { image: slides[0], path: '' } };
}

function collectionPage(c) {
  const main = `<div class="comp-wrap"><section class="comp comp--collection" aria-label="${esc(c.title)}">
${compose(c.photos, [], 0)}
</section></div>`;
  return { main, title: `${c.title} · ${SITE.name}`, desc: `${c.title} architectural and interior photography by ${SITE.name}.`, share: { ogTitle: `${c.title} · ${SITE.name}`, image: c.photos[0], path: `${c.slug}.html` } };
}

function aboutPage() {
  const a = SITE.about;
  const main = `<section class="about">
  <div class="about__col">
    <h1 class="ttl__h">Nate Barsanti</h1>
    <p class="about__lead">${esc(a.lead)}</p>
    <p>${esc(a.background)}</p>
    <h2 class="about__h">On a shoot</h2>
    <p>${esc(a.shoot)}</p>
    <h2 class="about__h">Licensing</h2>
    <p>${esc(a.licensing)}</p>
  </div>
  <aside class="about__side">
    <h2 class="about__h">Contact</h2>
    <p class="about__contact">
      ${contactLinks()}
    </p>
    <h2 class="about__h">Based in</h2>
    <p>${esc(SITE.region)}</p>
    ${SITE.clients.length ? `<h2 class="about__h">Clients</h2>\n    <ul class="about__list">${SITE.clients.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
    ${SITE.publications.length ? `<h2 class="about__h">Published in</h2>\n    <ul class="about__list">${SITE.publications.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
  </aside>
</section>`;
  return { main, title: `About · ${SITE.name}`, desc: a.lead, share: { ogTitle: `About · ${SITE.name}`, path: 'about.html' } };
}

// ---------- run ----------
const all = [...home, ...slideshow, ...collections.flatMap((c) => c.photos)];
console.log(`Encoding ${all.length} photos (home ${home.length}; slideshow ${slideshow.length}; ${collections.map((c) => `${c.title} ${c.photos.length}`).join(', ')})…`);
const t0 = Date.now();
await pool(all, 6, encode);
console.log(`Images ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const pages = [
  ['index.html', 'index.html', homePage()],
  ...collections.map((c) => [`${c.slug}.html`, `${c.slug}.html`, collectionPage(c)]),
  ['about.html', 'about.html', aboutPage()],
];
for (const [file, active, { main, title, desc, share }] of pages) {
  writeFileSync(join(DIST, file), doc(title, desc, active, main, share));
}
// Artifact preview: same home page as a fragment (the artifact host supplies the document skeleton).
writeFileSync(join(DIST, 'preview-index.html'), `${head(SITE.title, TAGLINE)}\n${body('index.html', homePage().main)}\n`);

copyFileSync(join(ROOT, 'src/styles.css'), join(DIST, 'styles.css'));
copyFileSync(join(ROOT, 'src/main.js'), join(DIST, 'main.js'));
const pj = (p) => ({ file: p.file, slug: p.slug, w: p.w, h: p.h, ratio: p.ratio, widths: p.widths, tiny: p.tiny, caption: p.caption, credit: p.credit, town: p.town, aerial: p.aerial });
writeFileSync(join(DIST, 'photos.json'), JSON.stringify({ home: home.map(pj), collections: collections.map((c) => ({ title: c.title, slug: c.slug, photos: c.photos.map(pj) })) }));
writeFileSync(join(DIST, 'manifest.json'), JSON.stringify({ home: home.map((p) => p.file), collections: collections.map((c) => ({ title: c.title, files: c.photos.map((p) => p.file) })) }, null, 2));
console.log(`Wrote ${pages.length} pages to dist/`);
