// Fade-in on load + a keyboard-friendly lightbox. No dependencies.
(function () {
  'use strict';

  // Mark images as loaded so the placeholder fades out (see styles.css).
  document.querySelectorAll('.ph__btn img').forEach(function (img) {
    var done = function () { img.setAttribute('data-loaded', ''); };
    if (img.complete && img.naturalWidth) done(); else img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });

  // Hero rotation: crossfade every few seconds; still for reduced-motion users; paused in background tabs.
  var hero = document.getElementById('hero');
  if (hero && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var slides = hero.querySelectorAll('.hero__slide');
    if (slides.length > 1) {
      var cur = 0;
      setInterval(function () {
        if (document.hidden) return;
        slides[cur].classList.remove('is-on');
        cur = (cur + 1) % slides.length;
        slides[cur].classList.add('is-on');
      }, 5000);
    }
  }

  var lb = document.getElementById('lightbox');
  if (!lb) return;
  var figs = Array.prototype.slice.call(document.querySelectorAll('.ph'));
  if (!figs.length) return;
  var img = lb.querySelector('.lb__img');
  var cap = lb.querySelector('.lb__cap');
  var count = lb.querySelector('.lb__count');
  var current = -1, lastFocus = null;

  function show(i) {
    current = (i + figs.length) % figs.length;
    var f = figs[current];
    img.srcset = f.getAttribute('data-srcset');
    img.sizes = '100vw';
    img.src = f.getAttribute('data-full');
    img.alt = f.getAttribute('data-caption') || '';
    cap.textContent = f.getAttribute('data-caption') || '';
    count.textContent = (current + 1) + ' / ' + figs.length;
    // warm the neighbours
    [current + 1, current - 1].forEach(function (n) {
      var nf = figs[(n + figs.length) % figs.length];
      var pre = new Image(); pre.srcset = nf.getAttribute('data-srcset'); pre.sizes = '100vw'; pre.src = nf.getAttribute('data-full');
    });
  }
  function open(i) {
    lastFocus = document.activeElement;
    show(i);
    lb.hidden = false;
    document.body.classList.add('lb-open');
    lb.querySelector('[data-lb="next"]').focus();
  }
  function close() {
    lb.hidden = true;
    document.body.classList.remove('lb-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  figs.forEach(function (f, i) {
    f.querySelector('.ph__btn').addEventListener('click', function () { open(i); });
  });
  lb.addEventListener('click', function (e) {
    var act = e.target.closest('[data-lb]');
    if (act) {
      var a = act.getAttribute('data-lb');
      if (a === 'close') close(); else if (a === 'next') show(current + 1); else if (a === 'prev') show(current - 1);
      return;
    }
    if (e.target === lb || e.target.classList.contains('lb__fig')) close();
  });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') show(current + 1);
    else if (e.key === 'ArrowLeft') show(current - 1);
  });

  // touch swipe
  var x0 = null;
  lb.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
  }, { passive: true });
})();
