/* Two Buds Dispensary preview — BRONX SOUND SYSTEM core interactions (vanilla, no dependencies, defer).
   Age gate · header · mega menus · drawer · search · reveals (+ stagger, settle sweep) · parallax · rails ·
   scroll-through pin · hero video · hours (America/New_York) · sticky pickup bar · toasts.
   Pointer / light / sound effects (spot, tilt, magnetic, beam, pulse, count, vinyl, eq, hero, particles, peel,
   scroll progress) live in scripts/parts/fx.js. prefers-reduced-motion = no motion at all.
   Page parts (scripts/parts/*.js) can use window.TwoBuds: reveal(scope), onScroll({read, write}), onResize(fn),
   openSearch(q), closeSearch(), pickupSync(), toast(msg). */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, body = doc.body;
  var mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var reduce = mq('(prefers-reduced-motion: reduce)');
  var fine = mq('(hover: hover) and (pointer: fine)');
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var ROOT = root.getAttribute('data-root') || './';
  var siteEl = $('[data-site]');
  // scroll hooks run once per frame: every read() first, then every write() (no layout thrash); a bare function = write
  var scrollHooks = [], resizeHooks = [];
  var pickupSync = null, searchOpen = false;
  // focus without scrolling: the header is sticky inside html's scroll-padding-top, so a plain focus() on a header control
  // (focus return after the drawer / search / a mega menu closes) made Chrome jump the page up by hundreds of pixels
  var focusNoScroll = function (el) { if (!el || !el.focus) return; try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} } };
  var TB = window.TwoBuds = window.TwoBuds || {};
  TB.root = ROOT; TB.reduce = reduce; TB.fine = fine;
  TB.onScroll = function (h) { if (h) scrollHooks.push(typeof h === 'function' ? { write: h } : h); };
  TB.onResize = function (fn) { if (typeof fn === 'function') resizeHooks.push(fn); };

  function focusables(el) { return $$('a[href], button:not([disabled]), input:not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex="-1"])', el).filter(function (x) { return x.getClientRects().length > 0; }); }
  function trap(el, e) {
    if (e.key !== 'Tab') return;
    var f = focusables(el); if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  var inertCount = 0;
  function setInert(on) { inertCount = Math.max(0, inertCount + (on ? 1 : -1)); if (siteEl) { if (inertCount) siteEl.setAttribute('inert', ''); else siteEl.removeAttribute('inert'); } }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  /* ---------- age gate (fail closed: shown until confirmed) ---------- */
  var gate = $('[data-agegate]');
  if (gate && root.classList.contains('age-pending')) {
    setInert(true);
    var yes = $('[data-age-yes]', gate), no = $('[data-age-no]', gate), denied = $('[data-age-denied]', gate);
    setTimeout(function () { focusNoScroll(yes); }, 60);
    yes.addEventListener('click', function () {
      try { localStorage.setItem('twobuds-age-ok', String(Date.now())); } catch (e) {}
      root.classList.remove('age-pending'); setInert(false); playHero(); if (pickupSync) pickupSync();
    });
    no.addEventListener('click', function () { if (denied) denied.hidden = false; });
    gate.addEventListener('keydown', function (e) { trap(gate, e); });
  }

  /* ---------- header: pinned; glass after 10px ---------- */
  var header = $('[data-header]');
  function headerSync() { if (header) header.classList.toggle('is-scrolled', (window.scrollY || 0) > 10); }
  function measureHeader() { if (header) root.style.setProperty('--header-h', Math.round(header.getBoundingClientRect().height) + 'px'); }

  /* ---------- hours: today + open now, in America/New_York ---------- */
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  function nyNow() {
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
      var m = {}; parts.forEach(function (p) { m[p.type] = p.value; });
      return { day: m.weekday, mins: (parseInt(m.hour, 10) % 24) * 60 + parseInt(m.minute, 10) };
    } catch (e) { var d = new Date(); return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()], mins: d.getHours() * 60 + d.getMinutes() }; }
  }
  function toMin(s) { var p = String(s).split(':'); return parseInt(p[0], 10) * 60 + parseInt(p[1] || '0', 10); }
  function fmtT(mins) { var h = Math.floor(mins / 60) % 24, m = mins % 60, ap = h >= 12 ? 'PM' : 'AM', hh = ((h + 11) % 12) + 1; return hh + (m ? ':' + (m < 10 ? '0' : '') + m : '') + ' ' + ap; }
  function hoursState(by) {
    var now = nyNow(), t = by[now.day], st = { day: now.day, open: false, text: '', today: '' };
    if (t) {
      var r = t.split('-'), o = toMin(r[0]), c = toMin(r[1]);
      st.today = 'Today ' + fmtT(o) + ' – ' + fmtT(c);
      if (now.mins >= o && now.mins < c) { st.open = true; st.text = 'Open now · until ' + fmtT(c); }
      else if (now.mins < o) st.text = 'Closed · opens ' + fmtT(o);
    }
    if (!st.text) { var nd = by[DAYS[(DAYS.indexOf(now.day) + 1) % 7]]; st.text = nd ? 'Closed · opens ' + fmtT(toMin(nd.split('-')[0])) + ' tomorrow' : 'Closed today'; }
    return st;
  }
  (function hours() {
    var src = $('[data-hours]'); if (!src) return;
    var by; try { by = JSON.parse(src.getAttribute('data-hours')); } catch (e) { return; }
    var st = hoursState(by);
    $$('[data-open-pill]').forEach(function (el) { el.textContent = st.text; el.classList.toggle('is-closed', !st.open); });
    $$('[data-hours] [data-day]').forEach(function (row) { row.classList.toggle('is-today', row.getAttribute('data-day') === st.day); });
    $$('[data-today-hours] span').forEach(function (el) { el.textContent = st.today ? st.today + (st.open ? ' · open now' : ' · closed now') : st.text; });
  })();

  /* ---------- mega menus ---------- */
  var megas = $$('[data-mega]');
  function closeMegas(except) { megas.forEach(function (it) { if (it !== except && it.classList.contains('is-open')) { it.classList.remove('is-open'); var b = $('.nav__top', it); if (b) b.setAttribute('aria-expanded', 'false'); } }); }
  megas.forEach(function (it) {
    var b = $('.nav__top', it), timer = 0, openedAt = 0;
    function open() { clearTimeout(timer); if (!it.classList.contains('is-open')) openedAt = Date.now(); closeMegas(it); it.classList.add('is-open'); b.setAttribute('aria-expanded', 'true'); }
    function close(delay) { clearTimeout(timer); timer = setTimeout(function () { it.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); }, delay); }
    b.addEventListener('click', function (e) { e.preventDefault(); if (it.classList.contains('is-open') && Date.now() - openedAt > 350) close(0); else open(); });
    if (fine) { it.addEventListener('mouseenter', open); it.addEventListener('mouseleave', function () { close(200); }); }
    it.addEventListener('focusout', function (e) { if (!it.contains(e.relatedTarget)) close(120); });
    it.addEventListener('keydown', function (e) { if (e.key === 'Escape' && it.classList.contains('is-open')) { close(0); focusNoScroll(b); e.stopPropagation(); } });
  });
  doc.addEventListener('click', function (e) { if (!e.target.closest || !e.target.closest('[data-mega]')) closeMegas(); });

  /* ---------- drawer ---------- */
  var burger = $('[data-burger]'), drawer = $('[data-drawer]'), drawerFrom = null;
  function toggleDrawer(force) {
    if (!burger || !drawer) return;
    var isOpen = drawer.classList.contains('is-open');
    var open = typeof force === 'boolean' ? force : !isOpen;
    if (open === isOpen) return;
    if (open) {
      drawerFrom = doc.activeElement; drawer.removeAttribute('inert'); drawer.classList.add('is-open'); body.classList.add('drawer-open'); setInert(true);
      burger.setAttribute('aria-expanded', 'true');
      setTimeout(function () { var x = $('[data-drawer-close]', drawer); if (x) focusNoScroll(x); }, 40);
    } else {
      drawer.classList.remove('is-open'); drawer.setAttribute('inert', ''); body.classList.remove('drawer-open'); setInert(false);
      burger.setAttribute('aria-expanded', 'false'); if (drawerFrom && drawerFrom.focus) focusNoScroll(drawerFrom);
    }
    if (pickupSync) pickupSync();
  }
  if (burger) burger.addEventListener('click', function () { toggleDrawer(true); });
  if (drawer) {
    var dx = $('[data-drawer-close]', drawer); if (dx) dx.addEventListener('click', function () { toggleDrawer(false); });
    drawer.addEventListener('click', function (e) { if (e.target.closest('a[href]')) toggleDrawer(false); });
    drawer.addEventListener('keydown', function (e) { trap(drawer, e); });
  }
  resizeHooks.push(function () { if (window.innerWidth >= 1024) toggleDrawer(false); });

  /* ---------- search overlay (menu index loaded on first open) ---------- */
  var search = $('[data-search]'), sIn, sRes, sStat, sQuick, sData = null, sLoading = false, sFrom = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var CATN = { flower: 'Flower', preroll: 'Pre-Rolls', carts: 'Carts', concentrate: 'Concentrates', edible: 'Edibles', wellness: 'Wellness', cbd: 'CBD', accessory: 'Accessories', 'pet-friendly': 'Pets' };
  function runSearch() {
    if (!sData) return;
    var q = (sIn.value || '').toLowerCase().trim().replace(/\s+/g, ' ');
    if (sQuick) sQuick.hidden = !!q;
    if (!q) { sRes.innerHTML = ''; sStat.textContent = ''; return; }
    var terms = q.split(' '), out = [];
    for (var i = 0; i < sData.length; i++) {
      var d = sData[i], t = (d.t || '').toLowerCase(), hay = t + ' ' + (d.b || '').toLowerCase() + ' ' + (CATN[d.c] || d.c || '').toLowerCase() + ' ' + (d.k || '').toLowerCase(), ok = true;
      for (var j = 0; j < terms.length; j++) if (hay.indexOf(terms[j]) < 0) { ok = false; break; }
      if (ok) out.push({ d: d, s: (t.indexOf(q) === 0 ? 3 : 0) + (t.indexOf(q) >= 0 ? 2 : 0) + ((d.b || '').toLowerCase().indexOf(q) === 0 ? 1 : 0) });
    }
    out.sort(function (a, b) { return b.s - a.s; });
    var total = out.length; out = out.slice(0, 40);
    sRes.innerHTML = out.map(function (o) {
      var d = o.d, im = d.i ? ROOT + String(d.i).replace(/^\/+/, '') : '';
      return '<li><a href="' + esc(ROOT + 'store/product/' + d.s + '/') + '">' + (im ? '<img src="' + esc(im) + '" alt="" loading="lazy" width="56" height="56">' : '<span></span>') + '<span><span class="sr-t">' + esc(d.t) + '</span><span class="sr-b">' + esc([d.b, CATN[d.c] || d.c, d.k].filter(Boolean).join(' · ')) + '</span></span>' + (typeof d.p === 'number' ? '<span class="sr-p">from $' + d.p.toFixed(2) + '</span>' : '<span></span>') + '</a></li>';
    }).join('');
    sStat.textContent = total ? (total > 40 ? 'Top 40 of ' + total : total) + (total === 1 ? ' product' : ' products') + ' for “' + sIn.value.trim() + '”' : 'No matches. Try a brand, a strain or a category.';
  }
  function openSearch(q) {
    if (!search) return;
    sFrom = doc.activeElement; search.hidden = false; searchOpen = true; setInert(true); closeMegas();
    requestAnimationFrame(function () { search.classList.add('is-open'); });
    if (typeof q === 'string') sIn.value = q;
    setTimeout(function () { focusNoScroll(sIn); }, 30);
    if (!sData && !sLoading) {
      sLoading = true; sStat.textContent = 'Loading the menu…';
      fetch(search.getAttribute('data-json')).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) { sData = d; sLoading = false; sStat.textContent = ''; runSearch(); }).catch(function () { sLoading = false; sStat.textContent = 'Search could not load. The live menu has every product.'; });
    } else runSearch();
    if (pickupSync) pickupSync();
  }
  function closeSearch() {
    if (!search || !searchOpen) return;
    searchOpen = false; search.classList.remove('is-open'); setInert(false);
    setTimeout(function () { if (!searchOpen) search.hidden = true; }, 260);
    if (sFrom && sFrom.focus) focusNoScroll(sFrom); if (pickupSync) pickupSync();
  }
  if (search) {
    sIn = $('[data-search-input]', search); sRes = $('[data-search-results]', search); sStat = $('[data-search-status]', search); sQuick = $('[data-search-quick]', search);
    sIn.addEventListener('input', debounce(runSearch, 90));
    $('[data-search-close]', search).addEventListener('click', closeSearch);
    search.addEventListener('click', function (e) { if (e.target === search) closeSearch(); });
    search.addEventListener('keydown', function (e) { trap(search, e); });
    $$('[data-search-open]').forEach(function (b) { b.addEventListener('click', function () { openSearch(); }); });
  }
  TB.openSearch = openSearch; TB.closeSearch = closeSearch;

  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (searchOpen) closeSearch(); else if (drawer && drawer.classList.contains('is-open')) toggleDrawer(false); else closeMegas();
  });

  /* ---------- reveals: [data-reveal] = default | words | pop | wipe | blur | rise | zoom (CSS: core.css + fx.css) ----------
     data-stagger on a parent numbers its [data-reveal] children (--i, unless already set; capped at 9). data-stagger WITH
     data-reveal on the same element staggers that element's children. A bare data-stagger (no reveal inside) reveals its
     children. IntersectionObserver + a scroll-settle sweep 140 ms after scrolling stops (fast flings never leave blank blocks).
     .fx-settled is added once an entrance has finished (fx.css then drops its transitions and the wipe's clip). */
  $$('[data-stagger]').forEach(function (p) {
    var ms = parseInt(p.getAttribute('data-stagger'), 10); if (ms > 0) p.style.setProperty('--stagger-step', ms + 'ms');
    var kids;
    if (p.hasAttribute('data-reveal')) kids = Array.prototype.slice.call(p.children);
    else {
      kids = $$('[data-reveal]', p).filter(function (k) { return k.parentElement && k.parentElement.closest('[data-stagger]') === p; });
      if (!kids.length) { p.setAttribute('data-reveal', ''); kids = Array.prototype.slice.call(p.children); }
    }
    kids.forEach(function (k, i) { if (!k.style.getPropertyValue('--i')) k.style.setProperty('--i', String(Math.min(i, 9))); });
  });
  var io = null;
  function settleLater(el) {
    if (reduce) { el.classList.add('fx-settled'); return; }
    var n = el.hasAttribute('data-stagger') ? Math.min(9, el.children.length) : Math.min(12, parseFloat(el.style.getPropertyValue('--i')) || 0);
    var step = parseInt(el.getAttribute('data-stagger'), 10) || (el.parentElement && el.parentElement.closest('[data-stagger]') ? parseInt(el.parentElement.closest('[data-stagger]').getAttribute('data-stagger'), 10) : 0) || 70;
    setTimeout(function () { el.classList.add('fx-settled'); }, 1150 + n * step);
  }
  function reveal(el) { if (el.classList.contains('is-in')) return; el.classList.add('is-in'); if (io) io.unobserve(el); settleLater(el); }
  function sweep() { var vh = window.innerHeight, list = $$('[data-reveal]:not(.is-in)'); for (var i = 0; i < list.length; i++) if (list[i].getBoundingClientRect().top < vh) reveal(list[i]); }
  if (reduce || !('IntersectionObserver' in window)) $$('[data-reveal]').forEach(reveal);
  else {
    io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) reveal(en.target); }); }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
    $$('[data-reveal]').forEach(function (el) { io.observe(el); });
    var settle = 0; window.addEventListener('scroll', function () { clearTimeout(settle); settle = setTimeout(sweep, 140); }, { passive: true });
    setTimeout(sweep, 500);
    window.addEventListener('load', function () { setTimeout(sweep, 200); });
  }
  doc.addEventListener('toggle', function (e) { var d = e.target; if (d && d.open) $$('[data-reveal]', d).forEach(reveal); }, true);
  TB.reveal = function (scope) { $$('[data-reveal]', scope || doc).forEach(reveal); };

  /* ---------- parallax on floaters [data-depth] (translate only, capped so objects stay on screen; reads, then writes) ---------- */
  var depthEls = reduce ? [] : $$('[data-depth]'), depthY = [];
  scrollHooks.push({
    read: function () {
      if (!depthEls.length) return;
      var vh = window.innerHeight, cap = window.innerWidth < 768 ? 36 : 70;
      for (var i = 0; i < depthEls.length; i++) {
        var el = depthEls[i], d = parseFloat(el.getAttribute('data-depth')) || 0, host = el.offsetParent || el.parentElement;
        depthY[i] = null; if (!host) continue;
        var r = host.getBoundingClientRect(); if (r.bottom < -300 || r.top > vh + 300) continue;
        var c = (r.top + Math.min(r.height, vh) / 2) - vh / 2; depthY[i] = Math.max(-cap, Math.min(cap, -c * d * 0.22));
      }
    },
    write: function () { for (var i = 0; i < depthEls.length; i++) if (depthY[i] != null) depthEls[i].style.translate = '0 ' + depthY[i].toFixed(1) + 'px'; }
  });

  /* ---------- rails: arrows + mouse drag ---------- */
  $$('[data-rail]').forEach(function (rail) {
    var track = $('.rail__track', rail), prev = $('[data-rail-prev]', rail), next = $('[data-rail-next]', rail), nav = $('.rail__nav', rail);
    if (!track) return;
    function upd() { var max = track.scrollWidth - track.clientWidth - 2; if (prev) prev.disabled = track.scrollLeft <= 2; if (next) next.disabled = track.scrollLeft >= max; if (nav) nav.style.visibility = max <= 0 ? 'hidden' : ''; }
    function go(dir) { track.scrollBy({ left: dir * Math.max(240, track.clientWidth * 0.8), behavior: reduce ? 'auto' : 'smooth' }); }
    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });
    track.addEventListener('scroll', function () { requestAnimationFrame(upd); }, { passive: true });
    resizeHooks.push(upd); upd();
    if (fine) {
      var down = false, sx = 0, sl = 0, moved = false;
      track.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' || e.button !== 0) return; down = true; moved = false; sx = e.clientX; sl = track.scrollLeft; });
      window.addEventListener('pointermove', function (e) { if (!down) return; var d = e.clientX - sx; if (!moved && Math.abs(d) > 6) { moved = true; track.classList.add('is-dragging'); } if (moved) track.scrollLeft = sl - d; });
      window.addEventListener('pointerup', function () { if (!down) return; down = false; setTimeout(function () { track.classList.remove('is-dragging'); }, 0); });
      track.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
      track.addEventListener('dragstart', function (e) { e.preventDefault(); });
    }
  });

  /* ---------- scroll-through pin (home categories): ≥1024 fine pointer = pinned; else native swipe rail ---------- */
  (function () {
    var pin = $('[data-pin]'); if (!pin) return;
    var track = $('[data-pin-track]', pin), vp = $('[data-pin-viewport]', pin), bar = $('[data-pin-bar]', pin), count = $('[data-pin-count]', pin);
    var prev = $('[data-pin-prev]', pin), next = $('[data-pin-next]', pin);
    var n = $$('.hcat__item', pin).filter(function (i) { return !i.classList.contains('hcat__item--end'); }).length || 1;
    var pinned = false, travel = 0, p = 0;
    function setProg(q) { if (bar) bar.style.setProperty('--p', q.toFixed(3)); if (count) { var k = Math.min(n, 1 + Math.floor(q * n * 0.999)); count.textContent = (k < 10 ? '0' : '') + k; } }
    function railSync() { var max = vp.scrollWidth - vp.clientWidth; setProg(max > 0 ? vp.scrollLeft / max : 0); if (prev) prev.disabled = vp.scrollLeft <= 2; if (next) next.disabled = vp.scrollLeft >= max - 2; }
    function read() { if (!pinned) return; var r = pin.getBoundingClientRect(), total = r.height - window.innerHeight; p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0; }
    function write() { if (!pinned) return; track.style.translate = (-p * travel).toFixed(1) + 'px 0'; setProg(p); }
    function setup() {
      var want = !reduce && mq('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
      if (want !== pinned) { pinned = want; pin.classList.toggle('is-pinned', pinned); track.style.translate = ''; }
      travel = pinned ? Math.max(0, track.scrollWidth - vp.clientWidth) : 0;
      if (pinned) { read(); write(); } else railSync();
    }
    vp.addEventListener('scroll', function () { if (!pinned) requestAnimationFrame(railSync); }, { passive: true });
    var step = function (dir) { var it = $('.hcat__item', pin); vp.scrollBy({ left: dir * (it ? it.getBoundingClientRect().width + 16 : 300), behavior: reduce ? 'auto' : 'smooth' }); };
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });
    scrollHooks.push({ read: read, write: write }); resizeHooks.push(setup);
    setup();
    window.addEventListener('load', setup);
  })();

  /* ---------- hero video: portrait file on phones, poster + still underneath, tap retry, pause button ---------- */
  var heroVid = null, userPaused = false, toggle = $('[data-video-toggle]');
  function playHero() { if (!heroVid || userPaused || reduce) return; var p = heroVid.play(); if (p && p.catch) p.catch(function () {}); }
  (function () {
    var vids = $$('[data-hero-video]'); if (!vids.length || reduce) return;
    for (var i = 0; i < vids.length; i++) { var m = vids[i].getAttribute('data-media'); if (!m || mq(m)) { heroVid = vids[i]; break; } }
    if (!heroVid) return;
    var v = heroVid; v.muted = true; v.defaultMuted = true; v.setAttribute('muted', ''); v.playsInline = true; v.setAttribute('playsinline', ''); v.loop = true; v.autoplay = true; v.preload = 'auto';
    v.addEventListener('playing', function () { v.classList.add('is-playing'); if (toggle) toggle.hidden = false; });
    v.addEventListener('error', function () { v.classList.remove('is-playing'); if (toggle) toggle.hidden = true; });
    v.src = v.getAttribute('data-video');
    playHero();
    var retry = function () { playHero(); doc.removeEventListener('touchstart', retry); doc.removeEventListener('click', retry); };
    doc.addEventListener('touchstart', retry, { passive: true }); doc.addEventListener('click', retry);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) playHero(); else if (!v.paused) v.pause(); }); }, { threshold: 0.05 }).observe(v);
    if (toggle) toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      if (v.paused) { userPaused = false; playHero(); toggle.classList.remove('is-paused'); toggle.setAttribute('aria-label', 'Pause the background video'); }
      else { userPaused = true; v.pause(); toggle.classList.add('is-paused'); toggle.setAttribute('aria-label', 'Play the background video'); }
    });
  })();

  /* ---------- sticky pickup bar (every page, shop pages included): shown once the hero ([data-hero], else main's first
     section) has scrolled above 30% of the viewport; hidden at the footer, while the drawer / search is open, while a text
     field has focus and under the age gate; × hides it for the session. Sets --bottom-stack (bar height + 24px, 0 when
     hidden) and html.pickup-on so page CSS can lift fixed controls / reserve space. Touches the DOM only on a change. ---------- */
  (function () {
    var bar = $('[data-pickup-bar]'); if (!bar) return;
    var main = $('#main'), hero = (main && $('[data-hero]', main)) || (main && main.firstElementChild), foot = $('[data-footer]');
    var dismissed = false; try { dismissed = sessionStorage.getItem('twobuds-pickup-x') === '1'; } catch (e) {}
    var footIn = false, typing = false, past = false, shown = false, barH = 0, stack = '';
    function readPast() { if (hero && hero.isConnected) { var r = hero.getBoundingClientRect(); past = r.bottom < window.innerHeight * 0.3; } else past = (window.scrollY || 0) > window.innerHeight * 0.8; }
    function setStack() { var v = shown ? (barH + 24) + 'px' : '0px'; if (v !== stack) { stack = v; root.style.setProperty('--bottom-stack', v); } }
    function apply() {
      var on = !dismissed && past && !footIn && !typing && !searchOpen && !body.classList.contains('drawer-open') && !root.classList.contains('age-pending');
      if (on === shown) return;
      shown = on; bar.classList.toggle('is-visible', on); root.classList.toggle('pickup-on', on);
      if (on && !barH) barH = bar.offsetHeight;
      setStack();
    }
    pickupSync = function () { readPast(); apply(); };
    TB.pickupSync = pickupSync;
    scrollHooks.push({ read: readPast, write: apply });
    if (foot && 'IntersectionObserver' in window) new IntersectionObserver(function (es) { footIn = es[es.length - 1].isIntersecting; apply(); }, { rootMargin: '0px 0px 40px 0px' }).observe(foot);
    var TYPING = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=reset]), textarea, select, [contenteditable="true"]';
    doc.addEventListener('focusin', function (e) { var t = e.target; if (t && t.matches && t.matches(TYPING)) { typing = true; apply(); } });
    doc.addEventListener('focusout', function () { typing = false; setTimeout(pickupSync, 60); });
    var x = $('[data-pickup-close]', bar);
    if (x) x.addEventListener('click', function () { dismissed = true; try { sessionStorage.setItem('twobuds-pickup-x', '1'); } catch (e) {} apply(); });
    resizeHooks.push(function () { barH = bar.offsetHeight || barH; setStack(); pickupSync(); });
    barH = bar.offsetHeight;
  })();

  /* ---------- toasts ---------- */
  var toasts = $('[data-toasts]');
  TB.toast = function (msg, ms) { if (!toasts) return; var t = doc.createElement('div'); t.className = 'toast'; t.textContent = msg; toasts.appendChild(t); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, ms || 3200); };

  /* ---------- main loop: one rAF per scroll frame — every read first, then every write ---------- */
  var ticking = false;
  function frame() {
    ticking = false;
    var i, h;
    for (i = 0; i < scrollHooks.length; i++) { h = scrollHooks[i]; if (h.read) h.read(); }
    headerSync();
    for (i = 0; i < scrollHooks.length; i++) { h = scrollHooks[i]; if (h.write) h.write(); }
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
  window.addEventListener('resize', debounce(function () { measureHeader(); for (var i = 0; i < resizeHooks.length; i++) resizeHooks[i](); frame(); }, 120));
  TB.frame = function () { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  measureHeader(); frame();
  // fx.js (and other parts) register scroll hooks after this file ran: run one frame once they are in, so first paint is right
  doc.addEventListener('DOMContentLoaded', function () { TB.frame(); });
})();
