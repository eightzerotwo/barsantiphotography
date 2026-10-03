// Generates three alternative design directions (A, B, C) plus a comparison page
// into dist/. Reads dist/photos.json written by build.mjs. Pure HTML/CSS/JS.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const SITE = JSON.parse(readFileSync(join(ROOT, 'src/site.json'), 'utf8'));
const DATA = JSON.parse(readFileSync(join(DIST, 'photos.json'), 'utf8'));
const YEAR = new Date().getFullYear();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const by = Object.fromEntries([...DATA.home, ...DATA.collections.flatMap((c) => c.photos)].map((p) => [p.slug, p]));

// ---------- projects ----------
// Groupings below are only the ones visible in the frames themselves (same building).
// Architect / builder / town are left as fields to fill: nothing here is invented.
const TBD_CREDIT = '<span class="tbd">Architect / Builder</span>';
const TBD_TOWN = '<span class="tbd">Town, State</span>';
const projects = [
  { id: 'hood', title: '100 Hood', type: 'Commercial', frames: ['100-hood', 'img-0278'] },
  { id: 'synagogue', title: 'Synagogue', type: 'Commercial', frames: ['img-0017', 'img-0028', 'img-0033'] },
  { id: 'campus', title: 'Campus, aerial', type: 'Commercial', frames: ['dji-20250528013954-0222-d-hdr'] },
  { id: 'terrace', title: 'Terrace and screened porch', type: 'Residential', frames: ['350a4039-edit'] },
  { id: 'attic', title: 'Attic bedroom', type: 'Residential', frames: ['350a3252-edit'] },
  { id: 'garage', title: 'Garage and main door', type: 'Residential', frames: ['garage-and-main-door'] },
  { id: 'kitchen', title: 'Kitchen looking in', type: 'Residential', frames: ['kitchen-looking-in-edit'] },
  { id: 'living', title: 'Living room', type: 'Residential', frames: ['living-room-1'] },
  { id: 'porch', title: 'Porch', type: 'Residential', frames: ['porch-2'] },
  { id: 'sitting', title: 'Sitting room', type: 'Residential', frames: ['sitting-room-1'] },
  { id: 'walkway', title: 'Walkway', type: 'Residential', frames: ['walkway-2'] },
].map((p) => ({ ...p, photos: p.frames.map((s) => by[s]).filter(Boolean) })).filter((p) => p.photos.length);

// One full project page per design uses the Residential folder as its frame set.
const sample = { id: 'sample', title: 'Project name', type: 'Residential', photos: DATA.collections.find((c) => c.slug === 'residential')?.photos ?? DATA.home };

// ---------- shared markup ----------
const srcset = (p) => p.widths.map((w) => `img/${p.slug}-${w}.webp ${w}w`).join(', ');
const largest = (p) => `img/${p.slug}-${p.widths[p.widths.length - 1]}.webp`;
const img = (p, sizes, attrs = '') =>
  `<img src="img/${p.slug}-${p.widths[0]}.webp" srcset="${srcset(p)}" sizes="${sizes}" width="${p.w}" height="${p.h}" alt="${esc(p.caption || 'Photograph')}" ${attrs}>`;

// Lightbox-capable figure (same contract as main.js)
const fig = (p, i, sizes, eager = false) =>
  `<figure class="ph" style="--r:${p.ratio.toFixed(4)};--ph:url(&quot;${p.tiny}&quot;)" data-index="${i}" data-full="${largest(p)}" data-srcset="${srcset(p)}" data-caption="${esc(p.caption)}"><button type="button" class="ph__btn" aria-label="Open ${esc(p.caption || 'photograph')}">${img(p, sizes, eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"')}</button></figure>`;

// Frames for a project page: portraits pair up side by side, landscapes run full width.
function frames(photos, sizesWide = '(max-width: 640px) 100vw, min(100vw, 1600px)') {
  const out = []; let i = 0;
  for (let k = 0; k < photos.length; k++) {
    const p = photos[k], n = photos[k + 1];
    if (p.ratio < 1 && n && n.ratio < 1) { out.push(`<div class="pair">${fig(p, i++, '50vw')}${fig(n, i++, '50vw')}</div>`); k++; }
    else out.push(`<div class="one">${fig(p, i++, sizesWide, i === 1)}</div>`);
  }
  return out.join('\n');
}

const lightbox = `<div class="lb" id="lightbox" hidden role="dialog" aria-modal="true" aria-label="Photo viewer">
  <button type="button" class="lb__close" data-lb="close" aria-label="Close">×</button>
  <button type="button" class="lb__nav lb__nav--prev" data-lb="prev" aria-label="Previous photo">‹</button>
  <figure class="lb__fig"><img class="lb__img" alt=""><figcaption class="lb__cap"></figcaption></figure>
  <button type="button" class="lb__nav lb__nav--next" data-lb="next" aria-label="Next photo">›</button>
  <div class="lb__count" aria-live="polite"></div>
</div>`;

const lbCss = `
.lb{position:fixed;inset:0;z-index:50;background:rgba(14,15,16,.96);color:#ecebe7;display:grid;grid-template-columns:64px 1fr 64px;align-items:center;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
.lb[hidden]{display:none}
.lb__fig{margin:0;grid-column:2;display:flex;flex-direction:column;align-items:center;gap:14px;min-width:0}
.lb__img{max-width:100%;max-height:min(86vh,86dvh);width:auto;height:auto;object-fit:contain}
.lb__cap{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#b9bab6;min-height:1em;text-align:center}
.lb__nav,.lb__close{color:#ecebe7;font-size:40px;font-weight:300;line-height:1;opacity:.8;width:64px;height:96px;display:grid;place-items:center;background:none;border:0;cursor:pointer}
.lb__nav:hover,.lb__close:hover{opacity:1}
.lb__nav--prev{grid-column:1}.lb__nav--next{grid-column:3}
.lb__close{position:absolute;top:calc(8px + env(safe-area-inset-top,0px));right:8px;height:56px;font-size:32px}
.lb__count{position:absolute;left:20px;bottom:calc(16px + env(safe-area-inset-bottom,0px));font-size:12px;letter-spacing:.14em;color:#8c8f8c;font-variant-numeric:tabular-nums}
@media (max-width:640px){.lb{grid-template-columns:1fr}.lb__fig{grid-column:1;padding-inline:12px}.lb__nav{position:absolute;top:50%;transform:translateY(-50%);width:48px}.lb__nav--prev{left:0}.lb__nav--next{right:0}}
body.lb-open{overflow:hidden}
.ph{margin:0;position:relative;min-width:0}
.ph__btn{display:block;width:100%;padding:0;border:0;background:var(--bg-2) var(--ph) center/cover no-repeat;cursor:pointer;aspect-ratio:var(--r);overflow:hidden}
.ph__btn img{width:100%;height:100%;object-fit:cover;display:block}
.ph__btn:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:var(--gap)}
.one{display:block}
@media (max-width:560px){.pair{grid-template-columns:1fr}}
@media (prefers-reduced-motion:no-preference){.ph__btn img{transition:opacity .4s ease}.ph__btn img:not([data-loaded]){opacity:0}.ph__btn img[data-loaded]{opacity:1}}
.tbd{border-bottom:1px dotted currentColor;opacity:.55}
`;

const doc = ({ title, desc, fonts, css, body, script = '' }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=swap">
<style>${css}</style>
</head>
<body>
${body}
${script}
</body>
</html>
`;


const frag = ({ title, fonts, css, body, script = '' }) => `<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=swap">
<style>${css}</style>
${body}
${script}
`;
function emit(name, args) {
  writeFileSync(join(DIST, `${name}.html`), doc(args));
  writeFileSync(join(DIST, `${name}-index.html`), frag(args));
}
const contactLinks = `<a href="mailto:${SITE.email}">${SITE.email}</a><a href="tel:+1${SITE.phone.replace(/\D/g, '')}">${SITE.phone}</a>`;
const credit = (p) => `<span class="c1">${esc(p.title)}</span><span class="c2">${TBD_CREDIT}</span><span class="c3">${TBD_TOWN}</span>`;
const prevNext = (design) => `<nav class="pn" aria-label="Projects"><a href="${design}.html">← All projects</a><a href="${design}-project.html">Next project →</a></nav>`;

// =====================================================================
// DESIGN A — "Index": typographic project list with a live preview.
// After Hufton+Crow's list view and Iwan Baan's text index. One typeface.
// =====================================================================
const cssA = `
:root{--bg:#fbfbfa;--bg-2:#efefec;--ink:#121212;--ink-2:#4a4a47;--mute:#7b7b77;--rule:#e3e3df;--accent:#1f4d6e;--gap:12px;--font:"Instrument Sans","Helvetica Neue",Arial,sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--bg:#121212;--bg-2:#1c1c1b;--ink:#ececea;--ink-2:#bdbdb8;--mute:#8d8d88;--rule:#2b2b29;--accent:#93b8d3}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#121212;--bg-2:#1c1c1b;--ink:#ececea;--ink-2:#bdbdb8;--mute:#8d8d88;--rule:#2b2b29;--accent:#93b8d3}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font);font-size:15px;line-height:1.45;padding-inline:clamp(16px,3vw,40px)}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
a:hover{color:var(--accent)}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.top{display:grid;grid-template-columns:1fr auto 1fr;align-items:baseline;gap:16px 24px;padding-block:20px 16px;border-bottom:1px solid var(--rule)}
.mark{font-weight:600;letter-spacing:-.01em;font-size:16px}
.sub{color:var(--mute);font-size:13px}
.nav{display:flex;gap:22px;justify-content:end;font-size:14px}
.nav a[aria-current]{border-bottom:1px solid var(--ink)}
@media (max-width:720px){.top{grid-template-columns:1fr auto}.sub{grid-column:1/-1;order:3}}
.idx{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:32px clamp(24px,4vw,64px);padding-block:28px 48px;align-items:start}
.list{margin:0;padding:0;list-style:none;border-top:1px solid var(--rule)}
.row{display:grid;grid-template-columns:84px minmax(0,1.3fr) minmax(0,1fr) minmax(0,.7fr);gap:14px;align-items:center;padding-block:10px;border-bottom:1px solid var(--rule);cursor:pointer}
.row:hover,.row.is-active{background:var(--bg-2)}
.row .th{width:84px;aspect-ratio:3/2;overflow:hidden;background:var(--bg-2)}
.row .th img{width:100%;height:100%;object-fit:cover}
.row .c1{font-weight:500}
.row .c2,.row .c3{color:var(--mute);font-size:13.5px}
.row .n{color:var(--mute);font-size:12px;font-variant-numeric:tabular-nums;text-align:right}
.count{color:var(--mute);font-size:13px;margin:0 0 10px}
.prev{position:sticky;top:20px}
.prev .frame{aspect-ratio:3/2;display:grid;place-items:center;background:var(--bg-2);overflow:hidden}
.prev .frame img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain}
.prev .cap{display:flex;justify-content:space-between;gap:12px;padding-top:10px;color:var(--mute);font-size:13px}
@media (max-width:860px){.idx{grid-template-columns:1fr}.prev{display:none}.row{grid-template-columns:120px 1fr}.row .th{width:120px}.row .c3,.row .n{display:none}}
.foot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px;border-top:1px solid var(--rule);padding-block:20px 40px;color:var(--mute);font-size:13px}
.foot div{display:flex;gap:20px}
/* project page */
.proj{padding-block:32px 48px;display:grid;gap:28px}
.proj-head{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:16px 48px;align-items:end;padding-bottom:20px;border-bottom:1px solid var(--rule)}
.proj-head h1{margin:0;font-size:clamp(26px,3.4vw,40px);font-weight:500;letter-spacing:-.02em;line-height:1.1}
.proj-head dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:4px 18px;font-size:14px}
.proj-head dt{color:var(--mute)}.proj-head dd{margin:0}
.proj-head p{margin:0;max-width:60ch;color:var(--ink-2)}
@media (max-width:720px){.proj-head{grid-template-columns:1fr}}
.frames{display:grid;gap:var(--gap)}
.pn{display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid var(--rule);font-size:14px}
${lbCss}`;

const listA = projects.map((p, i) => {
  const ph = p.photos[0];
  return `<li class="row${i === 0 ? ' is-active' : ''}" data-full="${largest(ph)}" data-srcset="${srcset(ph)}" data-title="${esc(p.title)}" data-n="${p.photos.length}" tabindex="0" role="link" data-href="a-project.html">
    <div class="th">${img(ph, '120px', 'loading="lazy"')}</div>
    <div><span class="c1">${esc(p.title)}</span><br><span class="c2">${TBD_CREDIT}</span></div>
    <span class="c3">${TBD_TOWN}</span>
    <span class="n">${p.photos.length} ${p.photos.length === 1 ? 'frame' : 'frames'}</span>
  </li>`;
}).join('\n');

const first = projects[0].photos[0];
const bodyA = (active, main) => `<header class="top">
  <a class="mark" href="a.html">Barsanti Photography</a>
  <span class="sub">Architectural photographer, Vermont and New England</span>
  <nav class="nav"><a href="a.html"${active === 'work' ? ' aria-current="page"' : ''}>Work</a><a href="about.html">About</a><a href="mailto:${SITE.email}">Contact</a></nav>
</header>
${main}
<footer class="foot"><div>${contactLinks}</div><span>© ${YEAR} Barsanti Photography</span></footer>`;

const scriptA = `<script>
(function(){
  var rows=[].slice.call(document.querySelectorAll('.row')),img=document.getElementById('prev-img'),cap=document.getElementById('prev-cap'),n=document.getElementById('prev-n');
  function set(r){rows.forEach(function(x){x.classList.toggle('is-active',x===r)});img.srcset=r.getAttribute('data-srcset');img.sizes='60vw';img.src=r.getAttribute('data-full');cap.textContent=r.getAttribute('data-title');n.textContent=r.getAttribute('data-n')+(r.getAttribute('data-n')==='1'?' frame':' frames')}
  rows.forEach(function(r){r.addEventListener('mouseenter',function(){set(r)});r.addEventListener('focus',function(){set(r)});r.addEventListener('click',function(){location.href=r.getAttribute('data-href')});r.addEventListener('keydown',function(e){if(e.key==='Enter')location.href=r.getAttribute('data-href')})});
})();
</script>`;

emit('a', {
  title: 'Barsanti Photography', desc: SITE.tagline,
  fonts: 'family=Instrument+Sans:wght@400;500;600',
  css: cssA,
  body: bodyA('work', `<main class="idx">
  <section>
    <p class="count">${projects.length} projects</p>
    <ol class="list">${listA}</ol>
  </section>
  <aside class="prev" aria-live="polite">
    <div class="frame">${img(first, '60vw', 'id="prev-img" fetchpriority="high"')}</div>
    <div class="cap"><span id="prev-cap">${esc(projects[0].title)}</span><span id="prev-n">${projects[0].photos.length} frames</span></div>
  </aside>
</main>`),
  script: scriptA,
});

emit('a-project', {
  title: `${sample.title} · Barsanti Photography`, desc: SITE.tagline,
  fonts: 'family=Instrument+Sans:wght@400;500;600',
  css: cssA,
  body: bodyA('work', `<main class="proj">
  <header class="proj-head">
    <div><h1><span class="tbd">${esc(sample.title)}</span></h1><p>Optional two-sentence note about the project: what was built, for whom, and what the photographs set out to show.</p></div>
    <dl><dt>Architect</dt><dd>${TBD_CREDIT.replace('Architect / Builder', 'Firm name')}</dd><dt>Builder</dt><dd><span class="tbd">Firm name</span></dd><dt>Location</dt><dd>${TBD_TOWN}</dd><dt>Type</dt><dd>${sample.type}</dd><dt>Frames</dt><dd>${sample.photos.length}</dd></dl>
  </header>
  <section class="frames">${frames(sample.photos)}</section>
  ${prevNext('a')}
</main>
${lightbox}`),
  script: '<script src="main.js" defer></script>',
});

// =====================================================================
// DESIGN B — "Full bleed": dark, one frame at a time, one-line credit.
// After Ema Peter, Ty Cole and Mike Kelley's slideshow homes. Serif wordmark.
// =====================================================================
const cssB = `
:root{color-scheme:dark;--bg:#0e0e0f;--bg-2:#17171a;--ink:#eeece6;--ink-2:#b8b6ae;--mute:#8a8882;--rule:#26262a;--accent:#d8c9a3;--gap:8px;--serif:"EB Garamond","Iowan Old Style",Georgia,serif;--sans:"Figtree","Helvetica Neue",Arial,sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:14px;line-height:1.5;display:flex;flex-direction:column;min-height:100dvh}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
a:hover{color:var(--accent)}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.top{display:flex;justify-content:space-between;align-items:baseline;gap:24px;padding:18px clamp(16px,3vw,40px) 12px}
.mark{font-family:var(--serif);font-size:22px;font-weight:500;letter-spacing:.01em}
.nav{display:flex;gap:22px;font-size:13px;color:var(--ink-2);text-transform:lowercase;letter-spacing:.04em}
.nav a[aria-current]{color:var(--ink)}
.show{flex:1 0 auto;display:grid;grid-template-rows:auto auto;padding-inline:clamp(16px,3vw,40px)}
.stage{position:relative;height:calc(100dvh - 140px)}
.stage .slide{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none}
.stage .slide img{width:100%;height:100%;object-fit:contain}
.stage .slide.is-on{opacity:1;pointer-events:auto}
@media (prefers-reduced-motion:no-preference){.stage .slide{transition:opacity .6s ease}}
.bar{display:grid;grid-template-columns:1fr auto auto;gap:16px 24px;align-items:center;padding-block:14px 18px;font-size:13px;color:var(--ink-2)}
.bar .cred{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar .cred .t{color:var(--ink);font-family:var(--serif);font-size:17px}
.bar .cred .sep{margin-inline:10px;color:var(--mute)}
.bar .ctr{font-variant-numeric:tabular-nums;color:var(--mute)}
.bar .btns{display:flex;gap:6px}
.bar button{background:none;border:1px solid var(--rule);color:var(--ink-2);font:inherit;padding:6px 12px;cursor:pointer;border-radius:2px}
.bar button:hover{border-color:var(--ink-2);color:var(--ink)}
.thumbs{display:none;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;padding:0 clamp(16px,3vw,40px) 24px}
.thumbs.is-open{display:grid}
.thumbs button{padding:0;border:0;background:var(--bg-2);aspect-ratio:3/2;overflow:hidden;cursor:pointer;opacity:.7}
.thumbs button:hover,.thumbs button.is-on{opacity:1;outline:1px solid var(--accent)}
.thumbs img{width:100%;height:100%;object-fit:cover}
@media (max-width:640px){.bar{grid-template-columns:1fr auto}.bar .btns{grid-column:1/-1}.stage{height:calc(100dvh - 190px);max-height:calc(100dvh - 190px)}}
.foot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px;padding:16px clamp(16px,3vw,40px) 28px;color:var(--mute);font-size:12.5px;border-top:1px solid var(--rule)}
.foot div{display:flex;gap:20px}
/* project page */
.proj{padding:8px clamp(8px,1vw,16px) 40px;display:grid;gap:28px;max-width:1800px;margin-inline:auto;width:100%}
.proj-head{text-align:center;padding-block:28px 8px;display:grid;gap:8px;justify-items:center}
.proj-head h1{margin:0;font-family:var(--serif);font-weight:500;font-size:clamp(30px,4vw,48px);letter-spacing:.005em;line-height:1.05}
.proj-head .line{color:var(--ink-2);font-size:14px}
.proj-head .line .sep{margin-inline:10px;color:var(--mute)}
.frames{display:grid;gap:var(--gap)}
.pn{display:flex;justify-content:space-between;padding:12px clamp(8px,2vw,24px) 0;border-top:1px solid var(--rule);font-size:13px;color:var(--ink-2)}
${lbCss}`;

const slidesB = projects.map((p, i) => `<div class="slide${i === 0 ? ' is-on' : ''}" data-title="${esc(p.title)}" data-type="${p.type}">${img(p.photos[0], '100vw', i === 0 ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"')}</div>`).join('\n');
const thumbsB = projects.map((p, i) => `<button type="button" data-i="${i}" class="${i === 0 ? 'is-on' : ''}" aria-label="${esc(p.title)}">${img(p.photos[0], '140px', 'loading="lazy"')}</button>`).join('');

const bodyB = (active, main) => `<header class="top">
  <a class="mark" href="b.html">Barsanti Photography</a>
  <nav class="nav"><a href="b.html"${active === 'work' ? ' aria-current="page"' : ''}>work</a><a href="about.html">about</a><a href="mailto:${SITE.email}">contact</a></nav>
</header>
${main}
<footer class="foot"><div>${contactLinks}</div><span>© ${YEAR} Barsanti Photography · Vermont</span></footer>`;

const scriptB = `<script>
(function(){
  var slides=[].slice.call(document.querySelectorAll('.slide')),th=[].slice.call(document.querySelectorAll('.thumbs button')),t=document.getElementById('cred-t'),ctr=document.getElementById('ctr'),thumbs=document.getElementById('thumbs'),i=0,timer=null;
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function go(k){i=(k+slides.length)%slides.length;slides.forEach(function(s,j){s.classList.toggle('is-on',j===i)});th.forEach(function(b,j){b.classList.toggle('is-on',j===i)});t.textContent=slides[i].getAttribute('data-title');ctr.textContent=(i+1)+' / '+slides.length}
  function arm(){if(reduce)return;clearInterval(timer);timer=setInterval(function(){go(i+1)},6000)}
  document.getElementById('next').addEventListener('click',function(){go(i+1);arm()});
  document.getElementById('prev').addEventListener('click',function(){go(i-1);arm()});
  document.getElementById('tog').addEventListener('click',function(){thumbs.classList.toggle('is-open')});
  th.forEach(function(b){b.addEventListener('click',function(){go(+b.getAttribute('data-i'));arm()})});
  document.addEventListener('keydown',function(e){if(e.key==='ArrowRight'){go(i+1);arm()}else if(e.key==='ArrowLeft'){go(i-1);arm()}});
  var st=document.querySelector('.stage');st.addEventListener('mouseenter',function(){clearInterval(timer)});st.addEventListener('mouseleave',arm);st.addEventListener('click',function(){go(i+1);arm()});
  arm();
})();
</script>`;

emit('b', {
  title: 'Barsanti Photography', desc: SITE.tagline,
  fonts: 'family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Figtree:wght@400;500',
  css: cssB,
  body: bodyB('work', `<main class="show">
  <div class="stage" aria-live="polite">${slidesB}</div>
  <div class="bar">
    <div class="cred"><span class="t" id="cred-t">${esc(projects[0].title)}</span><span class="sep">—</span>${TBD_CREDIT}<span class="sep">—</span>${TBD_TOWN}</div>
    <span class="ctr" id="ctr">1 / ${projects.length}</span>
    <div class="btns"><button type="button" id="prev" aria-label="Previous">‹</button><button type="button" id="next" aria-label="Next">›</button><button type="button" id="tog">thumbnails</button></div>
  </div>
</main>
<div class="thumbs" id="thumbs">${thumbsB}</div>`),
  script: scriptB,
});

emit('b-project', {
  title: `${sample.title} · Barsanti Photography`, desc: SITE.tagline,
  fonts: 'family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Figtree:wght@400;500',
  css: cssB,
  body: bodyB('work', `<main class="proj">
  <header class="proj-head">
    <h1><span class="tbd">${esc(sample.title)}</span></h1>
    <div class="line">${TBD_CREDIT}<span class="sep">—</span>${TBD_TOWN}<span class="sep">—</span>${sample.type}</div>
  </header>
  <section class="frames">${frames(sample.photos, '(max-width: 640px) 100vw, min(100vw, 1800px)')}</section>
  ${prevNext('b')}
</main>
${lightbox}`),
  script: '<script src="main.js" defer></script>',
});

// =====================================================================
// DESIGN C — "Grid": uniform thumbnails, three-line credit, type filters.
// After Jeremy Bittermann and Chuck Choi. Book serif for headings.
// =====================================================================
const cssC = `
:root{--bg:#ffffff;--bg-2:#f2f1ee;--ink:#1b1b1a;--ink-2:#4f4f4c;--mute:#7c7c78;--rule:#e6e5e1;--accent:#7a3b1e;--gap:12px;--serif:"Source Serif 4","Iowan Old Style",Georgia,serif;--sans:"Source Sans 3","Helvetica Neue",Arial,sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--bg:#141413;--bg-2:#1e1e1c;--ink:#ecebe6;--ink-2:#bcbbb4;--mute:#8e8d87;--rule:#2c2c29;--accent:#d9a37e}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#141413;--bg-2:#1e1e1c;--ink:#ecebe6;--ink-2:#bcbbb4;--mute:#8e8d87;--rule:#2c2c29;--accent:#d9a37e}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.5;padding-inline:clamp(16px,3vw,48px)}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
a:hover{color:var(--accent)}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.wrap{max-width:1500px;margin-inline:auto}
.top{display:flex;justify-content:space-between;align-items:baseline;gap:24px;padding-block:26px 10px}
.mark{font-family:var(--serif);font-size:24px;font-weight:500;letter-spacing:-.005em}
.mark small{display:block;font-family:var(--sans);font-size:13px;color:var(--mute);font-weight:400;margin-top:2px}
.nav{display:flex;gap:24px;font-size:15px}
.nav a[aria-current]{border-bottom:1px solid var(--ink)}
.filters{display:flex;gap:18px;padding-block:14px 22px;border-bottom:1px solid var(--rule);margin-bottom:24px;font-size:14px}
.filters button{background:none;border:0;padding:0;font:inherit;color:var(--mute);cursor:pointer}
.filters button[aria-pressed="true"]{color:var(--ink);border-bottom:1px solid var(--ink)}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:36px 24px;padding-bottom:48px}
@media (max-width:960px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:560px){.grid{grid-template-columns:1fr}}
.card{display:grid;gap:10px}
.card .th{aspect-ratio:3/2;overflow:hidden;background:var(--bg-2)}
.card .th img{width:100%;height:100%;object-fit:cover}
@media (prefers-reduced-motion:no-preference){.card .th img{transition:transform .5s ease}.card:hover .th img{transform:scale(1.02)}}
.card .txt{display:grid;gap:1px;font-size:14px;line-height:1.4}
.card .c1{font-family:var(--serif);font-size:17px}
.card .c2,.card .c3{color:var(--mute)}
.foot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px;border-top:1px solid var(--rule);padding-block:20px 40px;color:var(--mute);font-size:14px}
.foot div{display:flex;gap:20px}
/* project page */
.proj{padding-block:20px 48px;display:grid;gap:28px}
.proj-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px 48px;align-items:end;padding-block:12px 22px;border-bottom:1px solid var(--rule)}
.proj-head h1{margin:0;font-family:var(--serif);font-weight:500;font-size:clamp(28px,3.6vw,44px);letter-spacing:-.01em;line-height:1.1}
.proj-head .cr{display:grid;gap:2px;font-size:15px;color:var(--ink-2);text-align:right}
.proj-head .cr .c1{color:var(--ink)}
@media (max-width:720px){.proj-head{grid-template-columns:1fr}.proj-head .cr{text-align:left}}
.frames{display:grid;gap:var(--gap)}
.pn{display:flex;justify-content:space-between;padding-top:14px;border-top:1px solid var(--rule);font-size:15px}
${lbCss}`;

const cardsC = projects.map((p) => `<a class="card" href="c-project.html" data-type="${p.type}">
  <div class="th">${img(p.photos[0], '(max-width:560px) 100vw, (max-width:960px) 50vw, 33vw', 'loading="lazy" decoding="async"')}</div>
  <div class="txt">${credit(p)}</div>
</a>`).join('\n');

const bodyC = (active, main) => `<div class="wrap">
<header class="top">
  <a class="mark" href="c.html">Barsanti Photography<small>Architectural and interior photography · Vermont</small></a>
  <nav class="nav"><a href="c.html"${active === 'work' ? ' aria-current="page"' : ''}>Projects</a><a href="about.html">About</a><a href="mailto:${SITE.email}">Contact</a></nav>
</header>
${main}
<footer class="foot"><div>${contactLinks}</div><span>© ${YEAR} Barsanti Photography</span></footer>
</div>`;

const scriptC = `<script>
(function(){
  var btns=[].slice.call(document.querySelectorAll('.filters button')),cards=[].slice.call(document.querySelectorAll('.card'));
  btns.forEach(function(b){b.addEventListener('click',function(){var f=b.getAttribute('data-filter');btns.forEach(function(x){x.setAttribute('aria-pressed',x===b)});cards.forEach(function(c){c.hidden=f!=='All'&&c.getAttribute('data-type')!==f})})});
})();
</script>`;

emit('c', {
  title: 'Barsanti Photography', desc: SITE.tagline,
  fonts: 'family=Source+Serif+4:opsz,wght@8..60,400;8..60,500&family=Source+Sans+3:wght@400;500',
  css: cssC,
  body: bodyC('work', `<main>
  <div class="filters" role="group" aria-label="Filter projects"><button type="button" data-filter="All" aria-pressed="true">All</button><button type="button" data-filter="Residential" aria-pressed="false">Residential</button><button type="button" data-filter="Commercial" aria-pressed="false">Commercial</button></div>
  <section class="grid">${cardsC}</section>
</main>`),
  script: scriptC,
});

emit('c-project', {
  title: `${sample.title} · Barsanti Photography`, desc: SITE.tagline,
  fonts: 'family=Source+Serif+4:opsz,wght@8..60,400;8..60,500&family=Source+Sans+3:wght@400;500',
  css: cssC,
  body: bodyC('work', `<main class="proj">
  <header class="proj-head">
    <h1><span class="tbd">${esc(sample.title)}</span></h1>
    <div class="cr"><span class="c1">${sample.type} · ${sample.photos.length} frames</span><span>${TBD_CREDIT}</span><span>${TBD_TOWN}</span></div>
  </header>
  <section class="frames">${frames(sample.photos, '(max-width: 640px) 100vw, min(100vw, 1500px)')}</section>
  ${prevNext('c')}
</main>
${lightbox}`),
  script: '<script src="main.js" defer></script>',
});

// =====================================================================
// COMPARISON PAGE (artifact index, fragment: host supplies the skeleton)
// =====================================================================
const card = (href, n, name, after, best, photo, notes) => `<a class="opt" href="${href}">
  <div class="opt__img">${img(photo, '(max-width:700px) 100vw, 50vw', 'loading="lazy"')}</div>
  <div class="opt__txt">
    <p class="opt__n">Direction ${n}</p>
    <h2>${name}</h2>
    <p class="opt__after">After ${after}</p>
    <p>${best}</p>
    <ul>${notes.map((x) => `<li>${x}</li>`).join('')}</ul>
  </div>
</a>`;

const compare = `<title>Barsanti Site Directions</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap">
<style>
:root{--bg:#fafaf8;--bg-2:#eeeeea;--ink:#141414;--ink-2:#4a4a47;--mute:#787874;--rule:#e2e2dd;--accent:#1f4d6e}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--bg:#121212;--bg-2:#1c1c1b;--ink:#ececea;--ink-2:#bdbdb8;--mute:#8d8d88;--rule:#2b2b29;--accent:#93b8d3}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#121212;--bg-2:#1c1c1b;--ink:#ececea;--ink-2:#bdbdb8;--mute:#8d8d88;--rule:#2b2b29;--accent:#93b8d3}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Instrument Sans","Helvetica Neue",Arial,sans-serif;font-size:16px;line-height:1.5;padding-inline:clamp(16px,3vw,40px)}
img{max-width:100%;display:block}
a{color:inherit}
.wrap{max-width:1200px;margin-inline:auto;padding-block:32px 56px;display:grid;gap:36px}
h1{margin:0;font-size:clamp(26px,3.5vw,38px);font-weight:600;letter-spacing:-.02em;line-height:1.1;text-wrap:balance}
.lede{max-width:64ch;color:var(--ink-2);margin:0}
.rules{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px 32px;padding-block:20px;border-block:1px solid var(--rule)}
.rules h3{margin:0 0 4px;font-size:15px;font-weight:600}
.rules p{margin:0;font-size:14px;color:var(--ink-2)}
.opts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}
@media (max-width:700px){.opts{grid-template-columns:1fr}}
.opt{display:grid;grid-template-rows:auto 1fr;text-decoration:none;border:1px solid var(--rule);background:var(--bg);overflow:hidden}
.opt:hover{border-color:var(--ink)}
.opt__img{aspect-ratio:3/2;background:var(--bg-2);overflow:hidden}
.opt__img img{width:100%;height:100%;object-fit:cover}
.opt__txt{padding:16px 18px 18px;display:grid;gap:6px;align-content:start}
.opt__n{margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.opt h2{margin:0;font-size:20px;font-weight:600;letter-spacing:-.01em}
.opt__after{margin:0;font-size:13px;color:var(--mute)}
.opt p{margin:0;font-size:14.5px;color:var(--ink-2)}
.opt ul{margin:4px 0 0;padding-left:18px;font-size:13.5px;color:var(--ink-2)}
.opt li{margin:2px 0}
.note{font-size:14px;color:var(--mute);max-width:70ch;margin:0}
</style>
<div class="wrap">
  <div>
    <h1>Four directions for barsantiphotography.com</h1>
    <p class="lede" style="margin-top:10px">Same photographs, four ways to present them. Each direction is modeled on how a specific top-tier architectural photographer's site works. Open one, then use the browser's back button to return here. Every direction also links to a sample project page, since the research says the project, not the single image, is what wins commissions.</p>
  </div>
  <section class="rules" aria-label="What the research found">
    <div><h3>Credit on every surface</h3><p>Hufton+Crow, Bittermann and Hall+Merrick show project / architect / location under every thumbnail and on every project. Firms search their own names; only credited work gets found and re-shared.</p></div>
    <div><h3>Project sets, not singles</h3><p>Top sites show 15 to 60 frames of one building. Firms want to see a full set before trusting you with theirs. Two frames of a project beat two unrelated frames.</p></div>
    <div><h3>Light and quiet is the default</h3><p>Iwan Baan, Kelley, Choi, Dunn, Warchol, Bittermann and Ryan Bent all use white or off-white. Dark is a deliberate choice for large institutional work (Ema Peter, Ty Cole).</p></div>
    <div><h3>Three to five nav items</h3><p>Work, About, Contact. Personal and fine-art work is walled off. Sector lists of 20 galleries read as the older PhotoFolio generation.</p></div>
    <div><h3>Say how licensing works</h3><p>Chuck Choi spells out that architect, designer and builder can share a license and publications pay. No New England peer does this, and first-time clients need it.</p></div>
    <div><h3>Credit the builder</h3><p>Ryan Bent in Burlington tags architect and builder on each project and lists 17 Vermont design-build firms as clients. That is the local commissioning base.</p></div>
  </section>
  <section class="opts">
    ${card('design-1.html', 1, 'Selected stream', 'a curated selects page (Ryan Bent, Ty Cole)', 'The version already built. Justified rows of full frames, nothing cropped, an expanded grotesque wordmark. Best while the body of work is small and you want the pictures to do all the talking.', by['100-hood'], ['Home is the selects; each folder becomes a gallery', 'Lightbox with keyboard and swipe', 'Needs a credit line added to become project-based'])}
    ${card('a.html', 'A', 'Index', 'Hufton+Crow list view and Iwan Baan', 'A typographic project list with a live preview beside it. Reads like a working studio with a track record, and grows well: every new commission is one more line. One typeface, sentence case.', by['img-0017'], ['Project / architect / town on every row', 'Frame count shows depth per project', 'Sample project page: credit table, frames, prev/next'])}
    ${card('b.html', 'B', 'Full bleed', 'Ema Peter, Ty Cole and Mike Kelley', 'Dark ground, one frame at a time, one-line credit under it, counter and thumbnail toggle. The most cinematic option and the best fit if the work tilts toward institutional and commercial buildings.', by['img-0033'], ['Auto-advances, pauses on hover, arrow keys', 'Serif wordmark, lowercase nav', 'Sample project page: centered credit, edge-to-edge frames'])}
    ${card('c.html', 'C', 'Grid', 'Jeremy Bittermann and Chuck Choi', 'Uniform 3:2 thumbnails in three columns with the three-line credit under each and All / Residential / Commercial filters. The most conventional pattern among top architectural photographers, and the easiest for an architect to scan.', by['residential-ritz-kitchen'], ['Filters work client-side', 'Book serif headings, small sans body', 'Sample project page: credit header, frames, prev/next'])}
  </section>
  <p class="note">Dotted fields like Architect / Builder and Town, State are placeholders to fill from your records; nothing there is invented. Project groupings shown are only the ones visible in the frames themselves (the "100" building, the synagogue). Direction 1's nav still points at its own pages.</p>
</div>`;
writeFileSync(join(DIST, 'compare.html'), compare);
console.log('Wrote a.html a-project.html b.html b-project.html c.html c-project.html compare.html');
