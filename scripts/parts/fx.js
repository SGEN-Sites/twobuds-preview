/* scripts/parts/fx.js — the FX engine (FX-owned): the effects contract of docs/REVISION-FINAL.md §2a. Vanilla, classic script,
   defer, runs after site.js; CSS in styles/pages/fx.css. Pointer effects only on (hover: hover) and (pointer: fine);
   prefers-reduced-motion = no motion and everything visible. One rAF loop (reads, then writes), transform/opacity only,
   passive listeners, IntersectionObserver for enter effects, every loop pauses off screen.
   MARKUP CONTRACT — one line per attribute:
   data-spot[="stage|hover|street|paper|screen|<x%> <y%>"] stage light following the pointer (injected <fx-spot>, red/gold/green gel): sections, heroes and big walls (section/header/footer/aside, or a div ≥ 66% vw × 40% vh) rest as a soft screen-blended pool at x/y (default 62% 30%); cards (a/article/li/figure/span/small div) light only on hover; figure / [data-peel] hosts (posters, frames, sleeves) and "paper" use soft-light so ink keeps its colour ("screen" forces screen); touch: slow drift (stage only); reduced motion: static pool (stage only); "street" = warm sodium light. Vars: --spot-size --spot-a --spot-rest --spot-on --spot-blend --spot-z --spot-inset.
   data-tilt[="noglare"]  3D tilt ≤ 8° toward the pointer: .is-tilting + --rx/--ry (deg) and --mx/--my (%) on the element; while tilting fx.css owns its `transform` (perspective + rotateX/Y; optional lift --tilt-lift, default 0 — lift with `translate` in your own :hover, it composes); a moving glare <fx-glare> (skipped with data-glare="off" or when the element / a child already paints a radial ::after glare; dimmer when the element also has data-spot). Vars: --glare-a --glare-z --tilt-lift.
   data-magnetic          (and legacy .btn--magnet) pulls ≤ 6px toward the pointer (inline `translate`, skipped if the element already uses translate) + two speaker-ripple rings on hover / keyboard focus (<fx-ring>, .fx-hot). Vars: --ring-c --ring-z.
   data-beam              when it enters, one light sheen sweeps across the text (a glowing clone seen through a moving window, removed after); .fx-beamed then gives the accent word (.script / [data-accent]) a soft glow. Vars: --beam-color --beam-z.
   data-reveal="wipe|blur|rise|zoom" + data-stagger[="ms"]  entrances (engine + settle sweep in site.js, CSS in fx.css): data-stagger numbers its [data-reveal] children; with data-reveal on the same element its children stagger in.
   data-pulse             one bass thump when it enters: scale 1 → 1.015 → 1 (WAAPI, composite add) + a soft glow flash (<fx-glow>, removed after). Var: --pulse-z.
   data-count             counts up from 0 to the number already written in its text (prefix, suffix, commas, decimals kept) and always ends on that exact text; on screen at load = no count (unless still hidden by an entrance); keep the text static (no other script rewriting it).
   data-vinyl[="spin"]    the record spins on hover / focus-within, and slowly while on screen inside a [data-hero] (or ="spin"); spun element: [data-vinyl-spin], else none when the sleeve has its own *__spin layer, else [data-vinyl-disc] | .vinyl | .record | *__disc (.fx-disc added). fx.css backlight + rim light from --vinyl-glow → --tone → --accent → --gold, unless the sleeve brings its own *__glow element.
   data-eq                equalizer: its child elements bounce (scale-y on top of their own height), staggered (uses each bar's --d delay if set), only while on screen; static under reduced motion.
   data-hero              --hero-p 0 → 1 as the hero scrolls away (KIT .sleeve__rec consumes it); opt-in defaults: [data-hero-media] scales up + dims, [data-hero-copy] drifts up + fades, [data-hero-sleeve] drifts down.
   data-particles="n"     n ≤ 14 (≤ 8 under 600px) slow rising glowing specks (<fx-particles>), only while on screen; none under reduced motion.
   data-peel[="tr|tl|br|bl"]  one paper corner lifts on hover / keyboard focus (<fx-peel> flap + a clip-path corner cut, cut skipped when the element has its own clip-path). Var: --peel-z.
   data-live              no effect of its own: FX toggles .fx-live while the element is on screen (± 160px) so its own infinite CSS animation can pause off screen (e.g. .ticker:not(.fx-live) .ticker__track{animation-play-state:paused}).
   page                   red/gold/green scroll-progress line at the very top (<fx-progress>); skipped on pages with their own reading progress ([data-learn-progress], .learn-progress, [data-own-progress]).
   State classes: .fx-live (on screen) · .is-tilting · .fx-hot · .fx-beamed · .fx-disc · .fx-settled (site.js) · html.pickup-on (site.js).
   API: TwoBuds.fx.scan(root) after inserting markup that uses enter effects · TwoBuds.fx.beam(el) · .pulse(el) · .count(el). */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, win = window;
  var TB = win.TwoBuds = win.TwoBuds || {};
  if (TB.fx) return;
  var mq = function (q) { return !!(win.matchMedia && win.matchMedia(q).matches); };
  var reduce = mq('(prefers-reduced-motion: reduce)');
  var fine = mq('(hover: hover) and (pointer: fine)');
  var HAS_IO = 'IntersectionObserver' in win;
  var WAAPI = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
  var raf = function (f) { return (win.requestAnimationFrame || function (g) { return setTimeout(g, 16); })(f); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var noop = function () {};
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var NOKIDS = /^(IMG|VIDEO|AUDIO|INPUT|TEXTAREA|SELECT|BR|HR|IFRAME|CANVAS|SVG|PICTURE|SOURCE|EMBED|OBJECT|METER|PROGRESS|OPTION)$/;
  function canHost(el) { return !!el && el.nodeType === 1 && !NOKIDS.test(String(el.tagName).toUpperCase()); }
  // an injected layer: one per host, appended last, aria-hidden
  function layer(el, tag, cls) {
    for (var c = el.lastElementChild; c; c = c.previousElementSibling) if (c.localName === tag) return c;
    var x = doc.createElement(tag); x.setAttribute('aria-hidden', 'true'); if (cls) x.className = cls; el.appendChild(x); return x;
  }
  var onScroll = function (h) {
    if (TB.onScroll) return TB.onScroll(h);
    var t = false; win.addEventListener('scroll', function () { if (!t) { t = true; raf(function () { t = false; if (h.read) h.read(); if (h.write) h.write(); }); } }, { passive: true });
  };
  var onResize = function (fn) {
    if (TB.onResize) return TB.onResize(fn);
    var tm = 0; win.addEventListener('resize', function () { clearTimeout(tm); tm = setTimeout(fn, 140); });
  };

  /* ---------- observers: live (on screen ± 160px) and enter (≥ 30% visible, or ≥ 28% of the viewport) ---------- */
  var liveIO = HAS_IO ? new IntersectionObserver(function (es) {
    for (var i = 0; i < es.length; i++) {
      var el = es[i].target, on = es[i].isIntersecting, hs = el.__fxLive || [];
      el.__fxOn = on; el.classList.toggle('fx-live', on);
      for (var k = 0; k < hs.length; k++) hs[k](on, el);
    }
  }, { rootMargin: '160px 0px 160px 0px' }) : null;
  function live(el, fn) {
    if (!el.__fxLive) { el.__fxLive = []; if (liveIO) liveIO.observe(el); }
    el.__fxLive.push(fn);
    if (!liveIO) { el.__fxOn = true; el.classList.add('fx-live'); fn(true, el); } else if (el.__fxOn !== undefined) fn(el.__fxOn, el);
  }
  var enterIO = HAS_IO ? new IntersectionObserver(function (es) {
    for (var i = 0; i < es.length; i++) {
      var en = es[i]; if (!en.isIntersecting) continue;
      if (en.intersectionRatio < 0.3 && en.intersectionRect.height < win.innerHeight * 0.28) continue;
      enterIO.unobserve(en.target); fireEnter(en.target);
    }
  }, { threshold: [0, 0.15, 0.3, 0.5], rootMargin: '0px 0px -5% 0px' }) : null;
  function onEnter(el, fn) { (el.__fxEnter || (el.__fxEnter = [])).push(fn); if (enterIO) enterIO.observe(el); else fireEnter(el); }
  function fireEnter(el) { var fs = el.__fxEnter || []; el.__fxEnter = null; for (var i = 0; i < fs.length; i++) fs[i](el); }

  /* ---------- data-spot ---------- */
  var stageSpots = [];
  function spotMode(el) {
    var v = (el.getAttribute('data-spot') || '').toLowerCase();
    if (/stage|rest/.test(v)) return 'stage';
    if (/hover|card/.test(v)) return 'card';
    var t = String(el.tagName).toUpperCase();
    if (/^(A|ARTICLE|LI|FIGURE|BUTTON|LABEL|SPAN)$/.test(t)) return 'card';
    if (/^(SECTION|HEADER|FOOTER|MAIN|ASIDE)$/.test(t)) return 'stage';
    return (el.offsetWidth >= win.innerWidth * 0.66 && el.offsetHeight >= win.innerHeight * 0.4) ? 'stage' : 'card';
  }
  function spotRest(el) {
    var m = /(-?\d+(?:\.\d+)?)%?\s+(-?\d+(?:\.\d+)?)%?/.exec(el.getAttribute('data-spot') || '');
    return m ? [clamp(parseFloat(m[1]) / 100, -0.2, 1.2), clamp(parseFloat(m[2]) / 100, -0.2, 1.2)] : [0.62, 0.3];
  }
  function spotState(el) {
    var s = el.__fxSpot; if (s) return s;
    var mode = el.__fxSpotMode || spotMode(el), v = (el.getAttribute('data-spot') || '').toLowerCase();
    // paper / printed surfaces (posters, frames, sleeves) are lit with soft-light so ink keeps its colour; dark cards and stages use screen
    var paper = /paper/.test(v) || (!/screen/.test(v) && mode === 'card' && (String(el.tagName).toUpperCase() === 'FIGURE' || el.hasAttribute('data-peel')));
    var L = layer(el, 'fx-spot', 'is-' + mode + (/street/.test(v) ? ' is-street' : '') + (paper ? ' is-paper' : ''));
    s = el.__fxSpot = { kind: 'spot', el: el, L: L, stage: mode === 'stage', rest: spotRest(el), x: 0, y: 0, tx: 0, ty: 0, w: 0, h: 0, on: false, placed: false, moving: false };
    if (s.stage) stageSpots.push(s);
    return s;
  }
  function spotWrite(s) { s.L.style.setProperty('--sx', s.x.toFixed(1) + 'px'); s.L.style.setProperty('--sy', s.y.toFixed(1) + 'px'); }
  function spotPlace(s, w, h, jump) {
    s.w = w || s.w; s.h = h || s.h;
    if (!s.on) { s.tx = s.rest[0] * s.w; s.ty = s.rest[1] * s.h; }
    if (!s.placed || jump) { s.x = s.tx; s.y = s.ty; s.placed = true; spotWrite(s); }
  }
  function scanSpot(el) {
    if (el.__fxSpotScan || !canHost(el)) return; el.__fxSpotScan = true;
    el.__fxSpotMode = spotMode(el);
    if (el.__fxSpotMode !== 'stage') return; // cards get their layer on first hover
    live(el, function (on) {
      if (!on) return;
      var s = spotState(el);
      if (!s.placed) { spotPlace(s, el.offsetWidth, el.offsetHeight); s.L.classList.add('is-rest'); if (!fine && !reduce) s.L.classList.add('is-drift'); }
    });
  }
  onResize(function () { for (var i = 0; i < stageSpots.length; i++) { var s = stageSpots[i]; if (s.placed) spotPlace(s, s.el.offsetWidth, s.el.offsetHeight, !s.on); } });

  /* ---------- data-count ---------- */
  var NUM = /(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?/;
  function countState(el) {
    if (el.__fxC !== undefined) return el.__fxC;
    var st = null, tw = doc.createTreeWalker(el, 4, null), n;
    while ((n = tw.nextNode())) {
      var m = NUM.exec(n.data); if (!m) continue;
      var v = parseFloat((m[1] + (m[2] || '')).replace(/,/g, ''));
      if (isFinite(v) && v > 0) st = { node: n, orig: n.data, pre: n.data.slice(0, m.index), post: n.data.slice(m.index + m[0].length), v: v, dec: m[2] ? m[2].length - 1 : 0, comma: m[1].indexOf(',') >= 0, primed: false, running: false, done: false };
      break;
    }
    el.__fxC = st; return st;
  }
  function fmtCount(st, x) {
    var s = st.dec ? x.toFixed(st.dec) : String(Math.round(x));
    if (st.comma) { var p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); s = p.join('.'); }
    return st.pre + s + st.post;
  }
  function primeCount(el, on) {
    var st = countState(el); if (!st || st.done || st.running) return;
    if (on && !st.primed) { st.primed = true; st.node.data = fmtCount(st, 0); }
    else if (!on && st.primed) { st.primed = false; st.node.data = st.orig; }
  }
  function runCount(el) {
    var st = countState(el); if (!st || st.done || st.running) return;
    if (reduce) { st.node.data = st.orig; st.done = true; return; }
    st.running = true;
    var t0 = 0, dur = st.v < 20 ? 650 : 900;
    var fin = function () { if (st.done) return; st.node.data = st.orig; st.done = true; st.running = false; };
    var step = function (t) { if (st.done) return; if (!t0) t0 = t; var p = Math.min(1, (t - t0) / dur); if (p >= 1) return fin(); st.node.data = fmtCount(st, st.v * (1 - Math.pow(1 - p, 3))); raf(step); };
    raf(step); setTimeout(fin, dur + 900);
  }
  var primeIO = HAS_IO ? new IntersectionObserver(function (es) { es.forEach(function (en) { primeCount(en.target, en.isIntersecting); }); }, { rootMargin: '0px 0px 30% 0px' }) : null;
  var runIO = HAS_IO ? new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      if (!en.isIntersecting) return;
      var st = countState(en.target);
      runIO.unobserve(en.target); if (primeIO) primeIO.unobserve(en.target);
      if (!st || st.done || st.running) return;
      // jumped straight into view (anchor jump, fast fling, restored scroll) or this callback beat the prime observer:
      // prime here and count at once, so a number can never be left zeroed (the prime observer is gone for this element now)
      if (!st.primed) { st.primed = true; st.node.data = fmtCount(st, 0); }
      runCount(en.target);
    });
  }, { threshold: 0 }) : null;
  // printing (or anything that snapshots the page) must never show a primed zero: put every number back first
  var counted = [];
  win.addEventListener('beforeprint', function () { for (var i = 0; i < counted.length; i++) { var st = counted[i].__fxC; if (st && !st.done) { st.node.data = st.orig; st.done = true; st.running = false; st.primed = false; } } });
  function countInit(el) {
    if (el.__fxCi) return; el.__fxCi = true; counted.push(el);
    var st = countState(el); if (!st || reduce || !HAS_IO) return;
    var r = el.getBoundingClientRect(), onScreen = r.bottom > 0 && r.top < win.innerHeight;
    if (onScreen) {
      // on screen at load: count only while it is still hidden by an entrance that has not run yet (no flash of the final number)
      var hid = el.closest('[data-reveal]:not(.is-in)');
      if (!hid) { st.done = true; return; }
      st.primed = true; st.node.data = fmtCount(st, 0); runIO.observe(el);
      return;
    }
    primeIO.observe(el); runIO.observe(el);
  }

  /* ---------- data-beam ---------- */
  function beam(el) {
    if (el.__fxBeamed) return; el.__fxBeamed = true;
    if (reduce || !WAAPI || !canHost(el)) { el.classList.add('fx-beamed'); return; }
    var rv = el.getAttribute('data-reveal'), delay = 140;
    if (rv !== null) delay = rv === 'words' ? 540 + Math.min(12, el.querySelectorAll('.w').length) * 55 : 680;
    setTimeout(function () { runBeam(el); }, delay);
  }
  function runBeam(el) {
    el.classList.add('fx-beamed');
    var cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity < 0.05 || !el.getClientRects().length) return;
    var W = el.clientWidth, H = el.clientHeight; if (W < 24 || H < 12) return;
    var B = doc.createElement('fx-beam'), win_ = doc.createElement('b'), txt = doc.createElement('span');
    B.setAttribute('aria-hidden', 'true'); B.setAttribute('inert', '');
    for (var c = el.firstChild; c; c = c.nextSibling) { if (c.nodeType === 1 && /^fx-/.test(c.localName)) continue; if (c.nodeType === 1 || c.nodeType === 3) txt.appendChild(c.cloneNode(true)); }
    var all = txt.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var e = all[i]; e.removeAttribute('id'); e.removeAttribute('tabindex'); e.removeAttribute('href');
      for (var j = e.attributes.length - 1; j >= 0; j--) { var an = e.attributes[j].name; if (an.indexOf('data-') === 0 || an.indexOf('aria-') === 0) e.removeAttribute(an); }
    }
    var flex = /flex|grid/.test(cs.display);
    txt.style.cssText = 'width:' + W + 'px;padding:' + cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft + ';text-align:' + cs.textAlign +
      (flex ? ';display:' + cs.display.replace('inline-', '') + ';flex-direction:' + cs.flexDirection + ';flex-wrap:' + cs.flexWrap + ';gap:' + cs.gap + ';align-items:' + cs.alignItems + ';justify-content:' + cs.justifyContent : '');
    var pad = 0.25 * (parseFloat(cs.fontSize) || 16), total = Math.round(W + 2 * pad), bw = Math.round(Math.max(150, W * 0.36));
    win_.style.width = bw + 'px';
    win_.appendChild(txt); B.appendChild(win_); el.appendChild(B);
    var opts = { duration: 900, easing: 'cubic-bezier(.42,0,.58,1)', fill: 'both' };
    var kill = function () { if (B.parentNode) B.parentNode.removeChild(B); };
    try {
      var a = win_.animate([{ transform: 'translate3d(' + (-bw) + 'px,0,0)' }, { transform: 'translate3d(' + total + 'px,0,0)' }], opts);
      txt.animate([{ transform: 'translate3d(' + bw + 'px,0,0)' }, { transform: 'translate3d(' + (-total) + 'px,0,0)' }], opts);
      a.onfinish = kill;
    } catch (err) { kill(); }
    setTimeout(kill, 2600);
  }

  /* ---------- data-pulse ---------- */
  function pulse(el) {
    if (el.__fxPulsed || reduce || !WAAPI) return; el.__fxPulsed = true;
    var delay = el.hasAttribute('data-reveal') ? 420 : 160;
    var kf = [{ transform: 'scale(1)' }, { transform: 'scale(1.015)', offset: 0.35 }, { transform: 'scale(1)' }], o = { duration: 640, delay: delay, easing: 'cubic-bezier(.3,.7,.3,1)' };
    try { o.composite = 'add'; el.animate(kf, o); } catch (e) { try { if (getComputedStyle(el).transform === 'none') { delete o.composite; el.animate(kf, o); } } catch (e2) {} }
    if (!canHost(el)) return;
    var G = doc.createElement('fx-glow'); G.setAttribute('aria-hidden', 'true'); el.appendChild(G);
    var kill = function () { if (G.parentNode) G.parentNode.removeChild(G); };
    try { G.animate([{ opacity: 0 }, { opacity: 0.6, offset: 0.3 }, { opacity: 0 }], { duration: 780, delay: delay, easing: 'ease-out', fill: 'both' }).onfinish = kill; } catch (e) { kill(); }
    setTimeout(kill, delay + 1800);
  }

  /* ---------- data-vinyl ---------- */
  var DISC = '[data-vinyl-disc],.vinyl,.record,[class$="__disc"],[class*="__disc "]';
  var spinning = [], vReq = 0;
  function vinylState(el) {
    if (el.__fxV !== undefined) return el.__fxV;
    var st = null, tgt = el.querySelector('[data-vinyl-spin]');
    if (!tgt && !el.querySelector('[class*="__spin"]')) tgt = el.querySelector(DISC);
    if (tgt && WAAPI && !reduce) {
      tgt.classList.add('fx-disc');
      var a = null;
      try { a = tgt.animate([{ rotate: '0deg' }, { rotate: '360deg' }], { duration: 1800, iterations: Infinity, composite: 'add' }); }
      catch (e) { try { a = tgt.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 1800, iterations: Infinity }); } catch (e2) { a = null; } }
      if (a) { a.pause(); st = { el: el, a: a, rate: 0, hover: false, focus: false, view: false, slow: /spin/.test(el.getAttribute('data-vinyl') || '') || !!el.closest('[data-hero]') }; }
    }
    el.__fxV = st; return st;
  }
  function vWant(st) { return st.hover || st.focus ? 1 : (st.slow && st.view ? 0.14 : 0); }
  function vKick(st) { if (spinning.indexOf(st) < 0) spinning.push(st); if (!vReq) vReq = raf(vTick); }
  function vTick() {
    vReq = 0;
    for (var i = spinning.length - 1; i >= 0; i--) {
      var st = spinning[i], w = vWant(st), d = w - st.rate;
      if (Math.abs(d) < 0.012) { st.rate = w; spinning.splice(i, 1); } else st.rate += d * (d > 0 ? 0.085 : 0.05);
      try {
        if (st.rate <= 0.006) { if (st.a.playState === 'running') st.a.pause(); }
        else { if (st.a.updatePlaybackRate) st.a.updatePlaybackRate(st.rate); else st.a.playbackRate = st.rate; if (st.a.playState !== 'running') st.a.play(); }
      } catch (e) {}
    }
    if (spinning.length) vReq = raf(vTick);
  }
  function vinylInit(el) {
    if (el.__fxVi) return; el.__fxVi = true;
    var slow = /spin/.test(el.getAttribute('data-vinyl') || '') || !!el.closest('[data-hero]');
    if (slow) live(el, function (on) { var st = vinylState(el); if (st) { st.view = on; vKick(st); } });
  }
  function vinylSet(el, key, on) { var st = vinylState(el); if (!st || st[key] === on) return; st[key] = on; vKick(st); }

  /* ---------- data-particles ---------- */
  function particles(el) {
    if (el.__fxP || reduce || !canHost(el)) return; el.__fxP = true;
    var n = clamp(parseInt(el.getAttribute('data-particles'), 10) || 10, 1, 14); if (win.innerWidth < 600) n = Math.min(n, 8);
    var P = layer(el, 'fx-particles'), cols = ['var(--gold)', 'rgba(255,228,170,.95)', 'var(--gold)', 'var(--red)', 'var(--green)'], html = '';
    var seed = 11 + (el.className.length || 0); var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (var i = 0; i < n; i++) {
      var s = 2 + rnd() * 3.2, d = 11 + rnd() * 9;
      html += '<i style="--x:' + (4 + rnd() * 92).toFixed(1) + '%;--s:' + s.toFixed(1) + 'px;--d:' + d.toFixed(1) + 's;--dl:' + (-rnd() * d).toFixed(1) + 's;--dx:' + Math.round((rnd() - 0.5) * 70) + 'px;--o:' + (0.4 + rnd() * 0.45).toFixed(2) + ';--c:' + cols[i % cols.length] + '"></i>';
    }
    P.innerHTML = html;
    var size = function () { P.style.setProperty('--rise', Math.round((el.offsetHeight || 600) * 1.04) + 'px'); };
    size(); onResize(size);
  }

  /* ---------- data-peel ---------- */
  function peel(el) {
    if (el.__fxPeel || reduce || !canHost(el)) return; el.__fxPeel = true;
    var c = String(el.getAttribute('data-peel') || '').toLowerCase(); if (!/^(tr|tl|br|bl)$/.test(c)) c = 'tr';
    var own = getComputedStyle(el).clipPath;
    el.classList.add('fx-peel--' + c); if (!own || own === 'none') el.classList.add('fx-peel-cut');
    var F = layer(el, 'fx-peel'); if (!F.firstChild) F.appendChild(doc.createElement('i'));
    var size = function () { el.style.setProperty('--peel-px', Math.round(clamp((el.offsetWidth || 400) * 0.075, 30, 58)) + 'px'); };
    size(); onResize(size);
  }

  /* ---------- data-hero: --hero-p ---------- */
  // heroes are measured every scroll frame (one or two per page): a jump back to the top must never leave a stale value
  var heroes = [];
  function heroRead(h) { var r = h.el.getBoundingClientRect(); h.np = r.height > 0 ? clamp(-r.top / r.height, 0, 1) : 0; }
  function heroWrite(h) { if (Math.abs(h.np - h.p) > 0.002 || (h.np === 0 && h.p !== 0) || (h.np === 1 && h.p !== 1)) { h.p = h.np; h.el.style.setProperty('--hero-p', h.p.toFixed(3)); } }
  function heroInit(el) {
    if (el.__fxH) return; var h = el.__fxH = { el: el, p: -1, np: 0 }; heroes.push(h);
    heroRead(h); heroWrite(h);
    live(el, function (on) { if (on) { heroRead(h); heroWrite(h); } });
  }
  onScroll({
    read: function () { for (var i = 0; i < heroes.length; i++) heroRead(heroes[i]); },
    write: function () { for (var i = 0; i < heroes.length; i++) heroWrite(heroes[i]); }
  });

  /* ---------- page scroll-progress line ---------- */
  if (!reduce && doc.body && !doc.querySelector('[data-learn-progress], .learn-progress, [data-own-progress]')) {
    // a window slides in from the left while the gradient inside it counter-slides, so the line fills red → gold → green
    var PR = doc.createElement('fx-progress'), prWin = doc.createElement('i'), prBar = doc.createElement('b'), prP = -1, prN = 0;
    PR.setAttribute('aria-hidden', 'true'); prWin.appendChild(prBar); PR.appendChild(prWin); doc.body.appendChild(PR);
    onScroll({
      read: function () { var max = root.scrollHeight - win.innerHeight; prN = max > 0 ? clamp((win.scrollY || root.scrollTop || 0) / max, 0, 1) : 0; },
      write: function () { if (Math.abs(prN - prP) > 0.0005) { prP = prN; var o = ((prN - 1) * 100).toFixed(3); prWin.style.transform = 'translate3d(' + o + '%,0,0)'; prBar.style.transform = 'translate3d(' + (-o) + '%,0,0)'; } }
    });
  }

  /* ---------- pointer effects (fine pointer, motion allowed): spot · tilt + glare · magnetic + ring · vinyl hover · cursor glow ---------- */
  var HSEL = '[data-spot],[data-tilt],[data-magnetic],.btn--magnet,[data-vinyl]';
  var PAPER = '.zine,.paper,.band--paper,.hstory__page,.hrew__ticket,.review,.pull,.agegate';
  var over = [], moving = [], ptrX = -1, ptrY = -1, req = 0, glow = null, glowOn = false;
  function isMag(el) { return el.hasAttribute('data-magnetic') || el.classList.contains('btn--magnet'); }
  function ownGlare(el) {
    var has = function (n) { try { var a = getComputedStyle(n, '::after'); return a.content !== 'none' && /radial-gradient/.test(a.backgroundImage); } catch (e) { return false; } };
    if (has(el)) return true;
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (has(c)) return true;
    return false;
  }
  function tiltState(el) {
    var t = el.__fxTilt; if (t) return t;
    t = el.__fxTilt = { el: el, on: false, G: null };
    var off = /off|none|no/.test(el.getAttribute('data-glare') || '') || /noglare/.test(el.getAttribute('data-tilt') || '');
    if (!off && canHost(el) && !ownGlare(el)) { t.G = layer(el, 'fx-glare'); if (el.hasAttribute('data-spot')) t.G.style.setProperty('--glare-a', '.16'); }
    return t;
  }
  function magState(el) {
    var m = el.__fxMag; if (m) return m;
    var tr = ''; try { tr = getComputedStyle(el).translate; } catch (e) {}
    m = el.__fxMag = { kind: 'mag', el: el, on: false, x: 0, y: 0, tx: 0, ty: 0, pull: !tr || tr === 'none' || tr === '0px', moving: false };
    if (canHost(el)) {
      var R = layer(el, 'fx-ring'); if (!R.firstChild) { R.appendChild(doc.createElement('i')); R.appendChild(doc.createElement('i')); }
      var w = el.offsetWidth || 120, h = el.offsetHeight || 48;
      R.style.setProperty('--ring-sx', (1 + 26 / w).toFixed(3)); R.style.setProperty('--ring-sy', (1 + 26 / h).toFixed(3));
    }
    return m;
  }
  function ring(el) { if (!canHost(el)) return; magState(el); el.classList.remove('fx-hot'); void el.offsetWidth; el.classList.add('fx-hot'); }
  function addMoving(k) { if (!k.moving) { k.moving = true; moving.push(k); } kick(); }
  function kick() { if (!req) req = raf(tick); }
  // the element's untransformed box: live bbox centre (minus our own pull) + layout size (offset sizes ignore the tilt)
  function box(el) {
    var b = el.getBoundingClientRect(), w = el.offsetWidth || b.width, h = el.offsetHeight || b.height;
    var cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    if (el.__fxMag && el.__fxMag.pull) { cx -= el.__fxMag.x; cy -= el.__fxMag.y; }
    return { left: cx - w / 2, top: cy - h / 2, width: w, height: h };
  }
  function enter(el) {
    if (el.hasAttribute('data-spot') && canHost(el)) { var s = spotState(el); if (s.stage && !s.placed) { spotPlace(s, el.offsetWidth, el.offsetHeight); s.L.classList.add('is-rest'); } s.on = true; s.L.classList.add('is-on'); s.fresh = !s.stage; addMoving(s); }
    if (el.hasAttribute('data-tilt')) { var t = tiltState(el); t.on = true; el.classList.add('is-tilting'); }
    if (isMag(el)) { var m = magState(el); m.on = true; if (canHost(el)) el.classList.add('fx-hot'); if (m.pull) addMoving(m); }
    if (el.hasAttribute('data-vinyl')) vinylSet(el, 'hover', true);
  }
  function leave(el) {
    var s = el.__fxSpot; if (s && s.on) { s.on = false; s.L.classList.remove('is-on', 'is-dim'); if (s.stage) { s.tx = s.rest[0] * s.w; s.ty = s.rest[1] * s.h; addMoving(s); } }
    var t = el.__fxTilt; if (t && t.on) { t.on = false; el.classList.remove('is-tilting'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); }
    var m = el.__fxMag; if (m && m.on) { m.on = false; m.tx = 0; m.ty = 0; el.classList.remove('fx-hot'); if (m.pull) addMoving(m); }
    if (el.hasAttribute('data-vinyl')) vinylSet(el, 'hover', false);
  }
  function tick() {
    req = 0;
    var i, el, k, b, more = false, boxes = [];
    // read
    for (i = 0; i < over.length; i++) boxes[i] = box(over[i]);
    for (i = 0; i < moving.length; i++) { k = moving[i]; if (k.kind === 'spot' && k.on) { var j = over.indexOf(k.el); k.bx = j >= 0 ? boxes[j] : box(k.el); } }
    // write
    for (i = 0; i < over.length; i++) {
      el = over[i]; b = boxes[i]; if (!b.width || !b.height) continue;
      var px = clamp((ptrX - b.left) / b.width, 0, 1), py = clamp((ptrY - b.top) / b.height, 0, 1);
      var t = el.__fxTilt;
      if (t && t.on) {
        el.style.setProperty('--ry', ((px - 0.5) * 16).toFixed(2) + 'deg'); el.style.setProperty('--rx', ((0.5 - py) * 16).toFixed(2) + 'deg');
        el.style.setProperty('--mx', (px * 100).toFixed(1) + '%'); el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
        if (t.G) { t.G.style.setProperty('--gx', (px * b.width).toFixed(1) + 'px'); t.G.style.setProperty('--gy', (py * b.height).toFixed(1) + 'px'); }
      }
      var m = el.__fxMag;
      if (m && m.on && m.pull) { m.tx = clamp((ptrX - (b.left + b.width / 2)) / (b.width / 2), -1, 1) * 6; m.ty = clamp((ptrY - (b.top + b.height / 2)) / (b.height / 2), -1, 1) * 6; }
    }
    for (i = moving.length - 1; i >= 0; i--) {
      k = moving[i];
      if (k.kind === 'spot' && k.on && k.bx) { k.w = k.bx.width; k.h = k.bx.height; k.tx = ptrX - k.bx.left; k.ty = ptrY - k.bx.top; }
      if (k.kind === 'spot' && k.fresh) { k.fresh = false; k.x = k.tx; k.y = k.ty; }
      var f = k.kind === 'spot' ? (k.stage ? 0.11 : 0.28) : 0.22, dx = k.tx - k.x, dy = k.ty - k.y;
      if (Math.abs(dx) < 0.35 && Math.abs(dy) < 0.35) {
        k.x = k.tx; k.y = k.ty;
        if (!k.on) { moving.splice(i, 1); k.moving = false; }
      } else { k.x += dx * f; k.y += dy * f; more = true; }
      if (k.kind === 'spot') spotWrite(k);
      else k.el.style.translate = (!k.on && !k.moving) ? '' : k.x.toFixed(2) + 'px ' + k.y.toFixed(2) + 'px';
    }
    if (glow && glowOn) glow.style.transform = 'translate3d(' + ptrX + 'px,' + ptrY + 'px,0)';
    if (more) kick();
  }
  if (fine && !reduce) {
    glow = doc.createElement('div'); glow.className = 'cursor-glow'; glow.setAttribute('aria-hidden', 'true'); doc.body.appendChild(glow);
    doc.addEventListener('pointerover', function (e) {
      if (e.pointerType === 'touch') return;
      var chain = [];
      for (var n = e.target; n && n.nodeType === 1; n = n.parentElement) if (n.matches && n.matches(HSEL)) chain.push(n);
      var i;
      for (i = 0; i < over.length; i++) if (chain.indexOf(over[i]) < 0) leave(over[i]);
      for (i = 0; i < chain.length; i++) if (over.indexOf(chain[i]) < 0) enter(chain[i]);
      over = chain;
      // the innermost light wins: outer pools dim while the pointer is on an inner spot (a poster on a lit wall)
      var first = true, inSpot = false;
      for (i = 0; i < chain.length; i++) { var sp = chain[i].__fxSpot; if (!sp) continue; inSpot = true; sp.L.classList.toggle('is-dim', !first); first = false; }
      var t = e.target, paper = t && t.closest ? t.closest(PAPER) : null;
      glowOn = !paper && !inSpot; glow.classList.toggle('is-on', glowOn);
      ptrX = e.clientX; ptrY = e.clientY; kick();
    }, { passive: true });
    doc.addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; ptrX = e.clientX; ptrY = e.clientY; if (over.length || glowOn) kick(); }, { passive: true });
    doc.addEventListener('pointerout', function (e) { if (!e.relatedTarget) { for (var i = 0; i < over.length; i++) leave(over[i]); over = []; glowOn = false; glow.classList.remove('is-on'); } }, { passive: true });
    onScroll({ write: function () { if (over.length) kick(); } });
  }
  // keyboard: vinyl spins while focus is inside the sleeve; magnetic buttons ring on :focus-visible
  if (!reduce) {
    doc.addEventListener('focusin', function (e) {
      var t = e.target; if (!t || !t.closest) return;
      var v = t.closest('[data-vinyl]'); if (v) vinylSet(v, 'focus', true);
      var m = t.closest('[data-magnetic], .btn--magnet'); var fv = false; try { fv = t.matches(':focus-visible'); } catch (er) { fv = true; }
      if (m && fv) ring(m);
    });
    doc.addEventListener('focusout', function (e) {
      var t = e.target; if (!t || !t.closest) return;
      var v = t.closest('[data-vinyl]'); if (v && !(e.relatedTarget && v.contains(e.relatedTarget))) vinylSet(v, 'focus', false);
      var m = t.closest('[data-magnetic], .btn--magnet'); if (m && !(m.__fxMag && m.__fxMag.on)) m.classList.remove('fx-hot');
    });
  }

  /* ---------- scan ---------- */
  function scan(scope) {
    var r = scope || doc;
    $$('[data-spot]', r).forEach(scanSpot);
    $$('[data-eq], [data-live]', r).forEach(function (el) { if (!el.__fxEq) { el.__fxEq = true; live(el, noop); } });
    if (reduce) { $$('[data-beam]', r).forEach(function (el) { el.classList.add('fx-beamed'); }); return; }
    $$('[data-particles]', r).forEach(function (el) { if (!el.__fxPi) { el.__fxPi = true; live(el, function (on) { if (on) particles(el); }); } });
    $$('[data-peel]', r).forEach(function (el) { if (!el.__fxPe) { el.__fxPe = true; live(el, function (on) { if (on) peel(el); }); } });
    $$('[data-beam]', r).forEach(function (el) { if (!el.__fxBe) { el.__fxBe = true; onEnter(el, beam); } });
    $$('[data-pulse]', r).forEach(function (el) { if (!el.__fxPu) { el.__fxPu = true; onEnter(el, pulse); } });
    $$('[data-count]', r).forEach(countInit);
    $$('[data-vinyl]', r).forEach(vinylInit);
    $$('[data-hero]', r).forEach(heroInit);
  }
  TB.fx = {
    scan: scan,
    beam: function (el) { if (el) { el.__fxBeamed = false; beam(el); } },
    pulse: function (el) { if (el) { el.__fxPulsed = false; pulse(el); } },
    count: function (el) { var st = el && countState(el); if (st && !st.running) { st.done = false; st.primed = true; st.node.data = fmtCount(st, 0); runCount(el); } },
    reduce: reduce, fine: fine
  };
  scan(doc);
  if (TB.frame) TB.frame();
})();
