/* learn.js — LEARN interactions (LEARN-owned): blog topic filter, table-of-contents scroll spy + reading progress,
   FAQ search + expand all, site-map finder, strain "search the menu" buttons. Every block no-ops when its
   elements are absent (this file loads on every page). Vanilla, defer, after site.js (window.TwoBuds). */
(function () {
  'use strict';
  var doc = document;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var TB = window.TwoBuds || {};
  function reveal(scope) { if (TB.reveal) TB.reveal(scope); }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function norm(s) { s = String(s == null ? '' : s).toLowerCase(); try { s = s.normalize('NFKD').replace(/[̀-ͯ]/g, ''); } catch (e) {} return s.replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim(); }
  function cols(n, opts) { if (n <= opts[0]) return Math.max(1, n); for (var i = 0; i < opts.length; i++) if (n % opts[i] !== 1) return opts[i]; return opts[0]; }
  function matches(txt, terms) { for (var i = 0; i < terms.length; i++) if (txt.indexOf(terms[i]) < 0) return false; return true; }

  /* ---------- blog hub: filter by topic (no-JS = every guide visible, bar stays hidden) ---------- */
  (function () {
    var bar = $('[data-learn-filter]'), grid = $('[data-learn-grid]'); if (!bar || !grid) return;
    var chips = $$('[data-filter]', bar), cards = $$('.learn-card', grid), count = $('[data-learn-count]', bar);
    bar.hidden = false;
    function apply(key, push) {
      var n = 0, label = '';
      cards.forEach(function (c) { var on = key === 'all' || c.getAttribute('data-cat') === key; c.hidden = !on; if (on) n++; });
      chips.forEach(function (b) { var on = b.getAttribute('data-filter') === key; b.setAttribute('aria-pressed', on ? 'true' : 'false'); if (on) label = b.getAttribute('data-label') || ''; });
      grid.style.setProperty('--cl', String(cols(n, [3, 4, 2]))); grid.style.setProperty('--cm', String(cols(n, [2, 3])));
      if (count) count.textContent = key === 'all' ? 'Showing all ' + n + ' guides' : 'Showing ' + n + ' of ' + cards.length + ' guides · ' + label;
      reveal(grid);
      if (push) { try { history.replaceState(null, '', key === 'all' ? location.pathname + location.search : '#topic-' + key); } catch (e) {} }
    }
    chips.forEach(function (b) { b.addEventListener('click', function () { apply(b.getAttribute('data-filter'), true); }); });
    function fromHash() { var m = /^#topic-([\w-]+)$/.exec(location.hash || ''); if (m && $('[data-filter="' + m[1] + '"]', bar)) apply(m[1], false); }
    window.addEventListener('hashchange', fromHash);
    fromHash();
  })();

  /* ---------- table of contents: active section + reading progress (posts, FAQ topics) ---------- */
  (function () {
    var links = $$('[data-toc-link]'), art = $('[data-learn-article]'), bar = $('[data-learn-progress]'), tbar = $('[data-learn-prog]');
    if (!links.length && !bar) return;
    var ids = [];
    links.forEach(function (a) { var id = decodeURIComponent((a.getAttribute('href') || '').replace(/^#/, '')); if (id && ids.indexOf(id) < 0) ids.push(id); });
    var targets = ids.map(function (id) { return doc.getElementById(id); }).filter(Boolean);
    var current = null;
    function setActive(id) {
      if (id === current) return; current = id;
      links.forEach(function (a) { var on = !!id && a.getAttribute('href') === '#' + id; a.classList.toggle('is-active', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    }
    function spy() {
      var vh = window.innerHeight, line = vh * 0.3, best = null;
      for (var i = 0; i < targets.length; i++) { if (targets[i].getBoundingClientRect().top - line <= 0) best = targets[i].id; }
      if (!best && targets[0] && targets[0].getBoundingClientRect().top < vh) best = targets[0].id;
      setActive(best);
      if (art && (bar || tbar)) {
        var r = art.getBoundingClientRect(), total = r.height - vh * 0.5;
        var p = total > 0 ? Math.min(1, Math.max(0, (vh * 0.5 - r.top) / total)) : 0;
        var tf = 'scaleX(' + p.toFixed(4) + ')';
        if (bar) bar.style.transform = tf; if (tbar) tbar.style.transform = tf;
      }
    }
    var tick = false;
    window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(function () { tick = false; spy(); }); } }, { passive: true });
    window.addEventListener('resize', debounce(spy, 120));
    window.addEventListener('load', spy);
    spy();
    $$('.learn-tocm a').forEach(function (a) { a.addEventListener('click', function () { var d = a.closest('details'); if (d) d.open = false; }); });
  })();

  /* ---------- FAQs: search + expand / collapse all ---------- */
  (function () {
    var root = $('[data-faq-root]'); if (!root) return;
    var tools = $('[data-faq-tools]', root), input = $('[data-faq-search]', root), allBtn = $('[data-faq-all]', root);
    var status = $('[data-faq-status]', root), empty = $('[data-faq-empty]', root);
    var groups = $$('[data-faq-group]', root), items = $$('.faq__item', root);
    if (!items.length) return;
    if (tools) tools.hidden = false;
    items.forEach(function (d) { d.__txt = norm(d.textContent); });
    var busy = false;
    function syncAll() {
      if (!allBtn) return;
      var vis = items.filter(function (d) { return !d.hidden; });
      var expanded = vis.length > 0 && vis.every(function (d) { return d.open; });
      allBtn.setAttribute('aria-pressed', expanded ? 'true' : 'false');
      var t = $('.btn__t', allBtn); if (t) t.textContent = expanded ? 'Collapse all' : 'Expand all';
    }
    function run() {
      var q = norm(input ? input.value : ''), terms = q ? q.split(' ') : [], shown = 0;
      busy = true;
      items.forEach(function (d) {
        var ok = !terms.length || matches(d.__txt, terms);
        d.hidden = !ok; if (ok) shown++;
        if (ok && q.length >= 3) { if (!d.open) { d.open = true; d.__auto = true; } }
        else if (d.__auto) { d.open = false; d.__auto = false; }
      });
      groups.forEach(function (g) { g.hidden = !$$('.faq__item', g).some(function (d) { return !d.hidden; }); });
      busy = false;
      if (empty) empty.hidden = shown > 0;
      if (status) status.textContent = terms.length ? (shown ? shown + (shown === 1 ? ' answer matches' : ' answers match') + ' “' + input.value.trim() + '”' : 'No answers match') : '';
      syncAll();
    }
    if (input) {
      input.addEventListener('input', debounce(run, 110));
      input.addEventListener('keydown', function (e) { if (e.key === 'Escape' && input.value) { e.stopPropagation(); input.value = ''; run(); } });
    }
    if (allBtn) allBtn.addEventListener('click', function () {
      var open = allBtn.getAttribute('aria-pressed') !== 'true';
      busy = true; items.forEach(function (d) { if (!d.hidden) { d.open = open; d.__auto = false; } }); busy = false;
      syncAll();
    });
    root.addEventListener('toggle', function () { if (!busy) syncAll(); }, true);
    if (input && input.value) run(); else syncAll();
  })();

  /* ---------- site map: find a page (opens the groups that hold matches) ---------- */
  (function () {
    var root = $('[data-sm-root]'); if (!root) return;
    var tools = $('[data-sm-tools]', root), input = $('[data-sm-search]', root), status = $('[data-sm-status]', root), empty = $('[data-sm-empty]', root);
    var items = $$('[data-sm-item]', root), blocks = $$('[data-sm-block]', root);
    if (!input || !items.length) return;
    if (tools) tools.hidden = false;
    items.forEach(function (li) { li.__txt = norm(li.textContent); });
    var blockItems = blocks.map(function (b) { return $$('[data-sm-item]', b); });
    function run() {
      var q = norm(input.value), terms = q ? q.split(' ') : [], shown = 0;
      items.forEach(function (li) { var ok = !terms.length || matches(li.__txt, terms); li.hidden = !ok; if (ok) shown++; });
      blocks.forEach(function (b, i) {
        var any = blockItems[i].some(function (li) { return !li.hidden; });
        b.hidden = !any;
        if (b.tagName === 'DETAILS') { if (terms.length && any) { if (!b.open) { b.open = true; b.__auto = true; } } else if (b.__auto) { b.open = false; b.__auto = false; } }
      });
      if (empty) empty.hidden = shown > 0;
      if (status) status.textContent = terms.length ? (shown ? shown + (shown === 1 ? ' page matches' : ' pages match') : 'No pages match') : '';
    }
    input.addEventListener('input', debounce(run, 140));
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape' && input.value) { e.stopPropagation(); input.value = ''; run(); } });
    if (input.value) run();
  })();

  /* ---------- strain hero record: turns slowly only while the hero is on screen (CSS pauses it under .is-idle) ---------- */
  (function () {
    var rec = $('.learn-sleeve--hero'); if (!rec || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (es) { es.forEach(function (en) { rec.classList.toggle('is-idle', !en.isIntersecting); }); }, { threshold: 0 }).observe(rec);
  })();

  /* ---------- strain pages: "Search Gelato" opens the header search pre-filled (no JS = /store/ link) ---------- */
  $$('[data-learn-search]').forEach(function (a) {
    a.addEventListener('click', function (e) { if (typeof TB.openSearch === 'function') { e.preventDefault(); TB.openSearch(a.getAttribute('data-learn-search') || ''); } });
  });
})();
