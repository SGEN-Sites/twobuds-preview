/* scripts/parts/visit.js — VISIT pages (VISIT-owned). Loaded on every page: each part no-ops when its elements are absent.
   Copy buttons (contact + press fact sheet) · deal countdown on the LED board (events) · subway-line route progress
   (delivery + store page). Classic script (no modules, no fetch): works from the file:// folder copy. Scroll work goes through
   site.js TwoBuds.onScroll({read, write}) so it shares FX's one rAF (all reads first, then all writes); a plain rAF fallback
   covers a page without site.js. prefers-reduced-motion = the route is drawn full and every stop lit, nothing moves. */
(function () {
  'use strict';
  var doc = document;
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var toast = function (m) { var TB = window.TwoBuds; if (TB && TB.toast) TB.toast(m); };

  /* ---------- copy to clipboard ---------- */
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t).catch(function () { return legacyCopy(t); });
    return legacyCopy(t);
  }
  function legacyCopy(t) {
    return new Promise(function (res, rej) {
      var ta = doc.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
      doc.body.appendChild(ta); ta.select();
      var ok = false; try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
      doc.body.removeChild(ta); if (ok) res(); else rej(new Error('copy failed'));
    });
  }
  function done(b, label) { b.classList.add('is-done'); var t = b.querySelector('span:not(.sr-only)'); var was = t ? t.textContent : ''; if (t) t.textContent = 'Copied'; toast(label + ' copied'); setTimeout(function () { b.classList.remove('is-done'); if (t) t.textContent = was; }, 1800); }
  $$('[data-visit-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-visit-copy') || ''; if (!t) return;
      copyText(t).then(function () { done(b, t); }, function () { toast('Copy did not work here. ' + t); });
    });
  });
  $$('[data-visit-copy-sheet]').forEach(function (b) {
    b.addEventListener('click', function () {
      var sheet = b.closest('[data-visit-sheet]'); if (!sheet) return;
      var lines = $$('.visit-sheet__row', sheet).map(function (r) { var dt = r.querySelector('dt'), dd = r.querySelector('dd'); return (dt ? dt.textContent.trim() : '') + ': ' + (dd ? dd.textContent.replace(/\s+/g, ' ').trim() : ''); });
      copyText('Two Buds Dispensary · fact sheet\n' + lines.join('\n')).then(function () { done(b, 'Fact sheet'); }, function () { toast('Copy did not work here. Select the text instead.'); });
    });
  });

  /* ---------- deal countdown (end dates from the Nov 5, 2026 menu): "3 days left" / "Last day" / "Ended" ---------- */
  var ends = $$('[data-visit-ends]');
  if (ends.length) {
    var now = Date.now(), DAY = 864e5;
    ends.forEach(function (el) {
      var t = Date.parse(el.getAttribute('data-visit-ends')); if (!t) return;
      var d = t - now, txt;
      if (d <= 0) { txt = 'Ended · see the live menu'; el.classList.add('is-ended'); }
      else if (d < DAY) { txt = 'Last day'; el.classList.add('is-soon'); }
      else { var n = Math.ceil(d / DAY); txt = n + (n === 1 ? ' day left' : ' days left'); if (n <= 3) el.classList.add('is-soon'); }
      el.setAttribute('title', el.textContent); el.textContent = txt;
    });
  }

  /* ---------- count safety net (VISIT pages only): data-count="<n>" carries the real number. When FX's prime and run
     observers report in the same frame (a jump or fast scroll straight onto the number), the count can stay primed at 0;
     a zero still showing 260ms after the number entered the viewport is restarted through FX's public TwoBuds.fx.count(),
     or the real text is put back. A number is never left showing 0. ---------- */
  var counts = $$('.page-visit [data-count]').filter(function (el) { return /\d/.test(el.getAttribute('data-count') || ''); });
  if (counts.length && 'IntersectionObserver' in window) {
    var NUMRE = /\d[\d,]*(?:\.\d+)?/;
    var fixCount = function (el) {
      var want = el.getAttribute('data-count'), t = el.textContent || '', m = NUMRE.exec(t);
      if (!m || parseFloat(m[0].replace(/,/g, '')) !== 0 || !(parseFloat(want.replace(/,/g, '')) > 0)) return;
      var r = el.getBoundingClientRect(); if (r.bottom <= 0 || r.top >= (window.innerHeight || 800)) return;
      var TB = window.TwoBuds;
      if (TB && TB.fx && typeof TB.fx.count === 'function') TB.fx.count(el);
      setTimeout(function () { var t2 = el.textContent || '', m2 = NUMRE.exec(t2); if (m2 && parseFloat(m2[0].replace(/,/g, '')) === 0) el.textContent = t2.replace(m2[0], want); }, 1600);
    };
    var cio = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { var el = en.target; setTimeout(function () { fixCount(el); }, 260); } }); }, { threshold: 0 });
    counts.forEach(function (el) { cio.observe(el); });
  }

  /* ---------- route line: the subway line fills and each stop lights as the steps scroll through ---------- */
  var routes = $$('[data-visit-route]');
  if (routes.length) {
    var stops = routes.map(function (r) { return $$('.visit-route__stop', r); });
    var tops = [], heights = [], vh = 800;
    var read = function () { vh = window.innerHeight || 800; routes.forEach(function (r, k) { var b = r.getBoundingClientRect(); tops[k] = b.top; heights[k] = b.height; }); };
    var write = function () {
      routes.forEach(function (r, k) {
        var p = reduce ? 1 : Math.min(1, Math.max(0, (vh * 0.78 - tops[k]) / Math.max(1, heights[k] * 0.9)));
        r.style.setProperty('--route-p', p.toFixed(3));
        var list = stops[k], n = list.length;
        list.forEach(function (s, j) { s.classList.toggle('is-lit', p >= (n > 1 ? j / (n - 1) : 0) - 0.001); });
      });
    };
    var TB = window.TwoBuds;
    if (TB && typeof TB.onScroll === 'function') {
      TB.onScroll({ read: read, write: write });
      if (typeof TB.onResize === 'function') TB.onResize(function () { read(); write(); });
    } else {
      var raf = 0;
      var tick = function () { raf = 0; read(); write(); };
      window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(tick); }, { passive: true });
      window.addEventListener('resize', function () { if (!raf) raf = requestAnimationFrame(tick); });
    }
    read(); write();
  }
})();
