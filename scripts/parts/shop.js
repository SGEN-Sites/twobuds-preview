/* scripts/parts/shop.js — SHOP pages (SHOP-owned): inline menu search, browse tabs, category filters + sort,
   deals deep links, brands A–Z filter, and the R15 sticky-bar guard (the bar never covers a shop control).
   Every block no-ops when its elements are absent (this file loads on every page). */
(function () {
  'use strict';
  var doc = document, TB = window.TwoBuds || {};
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var reduce = !!TB.reduce;
  var params; try { params = new URLSearchParams(location.search); } catch (e) { params = { get: function () { return null; } }; }

  /* ---------- inline search: hands the query to the header search overlay ---------- */
  (function () {
    var form = $('[data-shop-search]'); if (!form || !TB.openSearch) return;
    var input = $('[data-shop-q]', form);
    form.addEventListener('submit', function (e) { e.preventDefault(); TB.openSearch(input.value || ''); });
    input.addEventListener('input', function () { if (input.value.trim()) { var q = input.value; input.value = ''; TB.openSearch(q); } });
    $$('[data-shop-try]').forEach(function (b) { b.addEventListener('click', function () { TB.openSearch(b.getAttribute('data-shop-try')); }); });
    var q0 = params.get('q'); if (q0) setTimeout(function () { TB.openSearch(q0); }, 80);
  })();

  /* ---------- browse tabs (store hub) ---------- */
  $$('[data-shop-tabs]').forEach(function (box) {
    var tabs = $$('[role="tab"]', box); if (!tabs.length) return;
    function select(t, focus) {
      tabs.forEach(function (x) {
        var on = x === t, p = doc.getElementById(x.getAttribute('aria-controls'));
        x.setAttribute('aria-selected', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1;
        if (p) { p.hidden = !on; if (on) { var tr = $('.rail__track', p); if (tr) { tr.scrollLeft = 0; tr.dispatchEvent(new Event('scroll')); } } }
      });
      if (focus) t.focus();
      t.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t, false); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, j = null;
        if (k === 'ArrowRight') j = (i + 1) % tabs.length; else if (k === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length; else if (k === 'Home') j = 0; else if (k === 'End') j = tabs.length - 1;
        if (j !== null) { e.preventDefault(); select(tabs[j], true); }
      });
    });
    box.classList.add('is-ready');
  });

  /* ---------- category grid: brand / type / kind / deal filters + sort, chunked re-flow, URL state ---------- */
  (function () {
    var bar = $('[data-shop-filters]'), grid = $('[data-shop-grid]'); if (!bar || !grid) return;
    var CH = 12, total = parseInt(bar.getAttribute('data-total'), 10) || 0, PAGE = parseInt(grid.getAttribute('data-paged'), 10) || 0, limit = PAGE || 1e9;
    var more = $('[data-f-more]'), moreT = $('[data-f-more-t]'), moreB = $('[data-f-more-b]'), moreBar = $('[data-f-more-bar]');
    var endTile = $('[data-end-tile]', grid);
    var cells = $$('.shop-cell', grid).filter(function (c) { return !c.hasAttribute('data-end-tile'); }).map(function (el, i) {
      var d = (el.firstElementChild && el.firstElementChild.dataset) || {};
      return { el: el, idx: i, cat: d.cat || '', brand: d.brand || '', strain: d.strain || '', price: d.price === '' || d.price == null ? NaN : parseFloat(d.price), name: d.name || '', order: parseFloat(d.order) || 0, sub: el.getAttribute('data-sub') || '', deal: el.getAttribute('data-deal') === '1' };
    });
    // aisle tiles (the /store/ full menu): one category at a time, "All" = none; they sit outside the filter bar
    var aisles = $$('[data-f-cat]');
    var park = doc.createElement('div'); park.hidden = true; park.className = 'shop-park'; grid.parentNode.insertBefore(park, grid.nextSibling);
    var selBrand = $('[data-f-brand]', bar), selSort = $('[data-f-sort]', bar), count = $('[data-f-count]', bar), clear = $('[data-f-clear]', bar);
    var empty = $('[data-f-empty]'), clear2 = $('[data-f-clear-2]');
    var chips = $$('[data-f-strain], [data-f-sub], [data-f-deal]', bar);
    var section = bar.closest('section') || grid;
    var st = { cat: '', brand: '', strain: [], sub: [], deal: false, sort: 'order' };
    function pressed(attr) { return chips.filter(function (c) { return c.hasAttribute(attr) && c.getAttribute('aria-pressed') === 'true'; }).map(function (c) { return c.getAttribute(attr); }); }
    function read() { var a = aisles.filter(function (c) { return c.getAttribute('aria-pressed') === 'true'; })[0]; st.cat = a ? a.getAttribute('data-f-cat') : ''; st.brand = selBrand ? selBrand.value : ''; st.strain = pressed('data-f-strain'); st.sub = pressed('data-f-sub'); st.deal = pressed('data-f-deal').length > 0; st.sort = selSort ? selSort.value : 'order'; }
    function active() { return !!(st.cat || st.brand || st.strain.length || st.sub.length || st.deal); }
    function setAisle(v) { aisles.forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-f-cat') === v ? 'true' : 'false'); }); }
    function endBps(n) { return [n % 4 === 1 ? 'lg' : '', n % 3 === 1 ? 'md' : '', n % 2 === 1 ? 'sm' : ''].filter(Boolean).join(' '); }
    // "menu order" = the order the page lists them in (aisle by aisle on /store/, the menu's own order inside a category)
    var cmp = {
      order: function (a, b) { return a.idx - b.idx; },
      'price-asc': function (a, b) { return (isNaN(a.price) ? 1e9 : a.price) - (isNaN(b.price) ? 1e9 : b.price) || a.idx - b.idx; },
      'price-desc': function (a, b) { return (isNaN(b.price) ? -1 : b.price) - (isNaN(a.price) ? -1 : a.price) || a.idx - b.idx; },
      name: function (a, b) { return a.name.localeCompare(b.name) || a.idx - b.idx; }
    };
    function apply(fromUser, keepLimit) {
      read(); if (!keepLimit) limit = PAGE || 1e9; grid.removeAttribute('data-paged');
      var vis = cells.filter(function (c) {
        if (st.cat && c.cat !== st.cat) return false;
        if (st.brand && c.brand !== st.brand) return false;
        if (st.strain.length && st.strain.indexOf(c.strain) < 0) return false;
        if (st.sub.length && st.sub.indexOf(c.sub) < 0) return false;
        if (st.deal && !c.deal) return false;
        return true;
      }).sort(cmp[st.sort] || cmp.order);
      var all = vis.length; vis = vis.slice(0, limit); var paged = vis.length < all;
      var keep = {}; vis.forEach(function (c) { keep[cells.indexOf(c)] = 1; });
      var chunks = $$('.shop-chunk', grid), need = Math.max(1, Math.ceil(vis.length / CH));
      while (chunks.length < need) { var ch = doc.createElement('div'); ch.className = 'shop-chunk'; grid.appendChild(ch); chunks.push(ch); }
      cells.forEach(function (c, i) { if (!keep[i]) park.appendChild(c.el); });
      chunks.forEach(function (ch, i) {
        var part = vis.slice(i * CH, i * CH + CH).map(function (c) { return c.el; });
        if (endTile && vis.length && !paged && i === need - 1) part.push(endTile);
        if (ch.replaceChildren) ch.replaceChildren.apply(ch, part); else { while (ch.firstChild) ch.removeChild(ch.firstChild); part.forEach(function (n) { ch.appendChild(n); }); }
      });
      if (endTile && (!vis.length || paged)) park.appendChild(endTile);
      grid.setAttribute('data-end', paged ? '' : endBps(vis.length));
      if (more) { more.hidden = !paged; if (moreT) moreT.textContent = 'Showing ' + vis.length.toLocaleString('en-US') + ' of ' + all.toLocaleString('en-US'); if (moreBar) moreBar.style.setProperty('--p', (vis.length / Math.max(1, all)).toFixed(3)); if (moreB) moreB.querySelector('.btn__t').textContent = 'Show ' + Math.min(PAGE, all - vis.length) + ' more'; }
      grid.hidden = !vis.length; if (empty) empty.hidden = !!vis.length;
      var n = all, word = n === 1 ? ' product' : ' products';
      if (count) count.innerHTML = active() ? 'Showing <strong>' + n.toLocaleString('en-US') + '</strong> of ' + total.toLocaleString('en-US') : '<strong>' + n.toLocaleString('en-US') + '</strong>' + word;
      if (clear) clear.hidden = !active();
      try {
        var u = new URL(location.href), sp = u.searchParams;
        ['cat', 'brand', 'type', 'kind', 'deal', 'sort'].forEach(function (k) { sp.delete(k); });
        if (st.cat) sp.set('cat', st.cat); if (st.brand) sp.set('brand', st.brand); if (st.strain.length) sp.set('type', st.strain.join(',')); if (st.sub.length) sp.set('kind', st.sub.join(',')); if (st.deal) sp.set('deal', '1'); if (st.sort !== 'order') sp.set('sort', st.sort);
        history.replaceState(history.state, '', u.pathname + (sp.toString() ? '?' + sp.toString() : '') + u.hash);
      } catch (e) {}
      if (fromUser) {
        var top = section.getBoundingClientRect().top;
        if (top < 0) { var hh = parseFloat(getComputedStyle(doc.documentElement).getPropertyValue('--header-h')) || 76; window.scrollBy({ top: bar.getBoundingClientRect().top - hh - 16, behavior: reduce ? 'auto' : 'smooth' }); }
      }
    }
    function reset() { if (selBrand) selBrand.value = ''; chips.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); }); setAisle(''); apply(true); }
    chips.forEach(function (c) { c.addEventListener('click', function () { c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); apply(true); }); });
    aisles.forEach(function (c) { c.addEventListener('click', function () { setAisle(c.getAttribute('data-f-cat')); apply(true); }); });
    if (selBrand) selBrand.addEventListener('change', function () { apply(true); });
    if (selSort) selSort.addEventListener('change', function () { apply(true); });
    if (clear) clear.addEventListener('click', reset);
    if (clear2) clear2.addEventListener('click', reset);
    function shown() { return $$('.shop-chunk .shop-cell:not([data-end-tile])', grid); }
    if (moreB) moreB.addEventListener('click', function () {
      var before = shown().length; limit += PAGE; apply(false, true);
      var next = shown()[before], a = next && next.querySelector('a');
      if (a) { try { a.focus({ preventScroll: true }); } catch (e) {} }
    });
    // initial state from the URL (brand pages link here with ?brand=<slug>)
    var b0 = params.get('brand'), t0 = params.get('type'), k0 = params.get('kind'), s0 = params.get('sort'), c0 = params.get('cat');
    if (c0 && aisles.some(function (c) { return c.getAttribute('data-f-cat') === c0; })) setAisle(c0);
    if (b0 && selBrand && $$('option', selBrand).some(function (o) { return o.value === b0; })) selBrand.value = b0;
    if (t0) t0.split(',').forEach(function (v) { chips.forEach(function (c) { if (c.getAttribute('data-f-strain') === v) c.setAttribute('aria-pressed', 'true'); }); });
    if (k0) k0.split(',').forEach(function (v) { chips.forEach(function (c) { if (c.getAttribute('data-f-sub') === v) c.setAttribute('aria-pressed', 'true'); }); });
    if (params.get('deal') === '1') chips.forEach(function (c) { if (c.hasAttribute('data-f-deal')) c.setAttribute('aria-pressed', 'true'); });
    if (s0 && selSort && $$('option', selSort).some(function (o) { return o.value === s0; })) selSort.value = s0;
    apply(false);
    TB.shopFilter = { apply: apply, reset: reset };
  })();

  /* ---------- deals: #promo-<id> deep links open that deal's product list ---------- */
  (function () {
    if (!$('.shop-deal')) return;
    function openHash() {
      var h = (location.hash || '').slice(1); if (!/^promo-\d+$/.test(h)) return;
      var el = doc.getElementById(h); if (!el) return;
      var d = $('details', el); if (d && !d.open) d.open = true;
    }
    openHash(); window.addEventListener('hashchange', openHash);
  })();

  /* ---------- R15: the sticky pickup bar (site.js) never covers a shop control. While the filter bar, "Show more" or the product
     page's order box sits in the bar's band at the bottom of the viewport, body.shop-yield slides the bar away (shop.css); it comes
     back as soon as the control has moved clear. Reads in the shared scroll frame (TwoBuds.onScroll), writes only on a change. ---------- */
  (function () {
    var bar = $('[data-pickup-bar]'), body = doc.body; if (!bar || !body || !body.classList.contains('page-shop')) return;
    var guards = $$('[data-shop-filters], [data-f-more], .shop-buy'); if (!guards.length) return;
    var html = doc.documentElement, on = false, want = false, barH = bar.offsetHeight || 80;
    function read() {
      want = false; if (!html.classList.contains('pickup-on')) return;
      var vh = window.innerHeight, band = vh - barH - 26; // the bar (14px off the bottom) + a 12px breathing gap
      for (var i = 0; i < guards.length; i++) {
        var g = guards[i]; if (g.hidden || !g.getClientRects().length) continue;
        var r = g.getBoundingClientRect(); if (r.bottom > band && r.top < vh) { want = true; return; }
      }
    }
    function write() { if (want !== on) { on = want; body.classList.toggle('shop-yield', on); } }
    function sync() { read(); write(); }
    if (TB.onScroll) TB.onScroll({ read: read, write: write }); else window.addEventListener('scroll', sync, { passive: true });
    var resized = function () { barH = bar.offsetHeight || barH; sync(); };
    if (TB.onResize) TB.onResize(resized); else window.addEventListener('resize', resized);
    // the bar also shows / hides without a scroll (age gate, drawer, typing, ×, "Show more" moving): follow html.pickup-on and clicks
    if ('MutationObserver' in window) new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ['class'] });
    doc.addEventListener('click', function () { setTimeout(sync, 60); }, true);
    sync();
  })();

  /* ---------- brands A–Z: type to filter ---------- */
  (function () {
    var input = $('[data-az-filter]'); if (!input) return;
    var rows = $$('[data-az-name]'), groups = $$('[data-az-group]'), count = $('[data-az-count]'), empty = $('[data-az-empty]'), total = rows.length;
    function run() {
      var q = input.value.toLowerCase().trim(), n = 0;
      rows.forEach(function (r) { var on = !q || r.getAttribute('data-az-name').indexOf(q) >= 0; r.hidden = !on; if (on) n++; });
      groups.forEach(function (g) { g.hidden = !$$('[data-az-name]', g).some(function (r) { return !r.hidden; }); });
      if (count) count.textContent = q ? n + ' of ' + total + ' brands' : total + ' brands';
      if (empty) empty.hidden = n > 0;
    }
    input.addEventListener('input', run);
  })();
})();
