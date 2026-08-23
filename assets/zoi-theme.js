/* ZOI theme controller — include on every page: <script src="/assets/zoi-theme.js"></script>
   Cycles dark -> light -> gold. Persists to localStorage 'zoi_theme'. Respects system on first load.
   Any element with id="themeBtn" (or [data-theme-toggle]) becomes the toggle. */
(function () {
  "use strict";
  var THEMES = ["dark", "light", "gold"];
  var KEY = "zoi_theme";
  var root = document.documentElement;
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function apply(t) { root.setAttribute("data-theme", THEMES.indexOf(t) === -1 ? "dark" : t); }
  var initial = read();
  if (!initial) {
    var light = false;
    try { light = window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches; } catch (e) {}
    initial = light ? "light" : "dark";
  }
  apply(initial);
  function bind() {
    var btns = document.querySelectorAll("#themeBtn,[data-theme-toggle]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", function () {
        var cur = root.getAttribute("data-theme") || "dark";
        var next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
        apply(next); save(next);
      });
    }
    var yr = document.getElementById("yr");
    if (yr) { try { yr.textContent = String(new Date().getFullYear()); } catch (e) {} }
    markCurrent();
    reflectSession();
    motion();
  }

  /* Reveal-on-scroll, a scroll-progress hairline, and a header that lifts once
     you leave the top. Cheap, passive, and skipped entirely for anyone who has
     asked for reduced motion. */
  /* ── motion ───────────────────────────────────────────────────────────
     The CSS in zoi-theme.css does the animating. This does only the things CSS
     cannot: inject the decorative layers so no page has to carry markup for
     them, feed the pointer position and stagger indices in as custom
     properties, split headlines into words, and count numbers up.

     It also deliberately does NOT re-implement reveals when the browser
     supports scroll-driven animations. Two systems animating the same element
     is how content ends up stuck at opacity 0. */
  function motion() {
    var reduce = false;
    try { reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    var cssScroll = false;
    try { cssScroll = window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()'); } catch (e) {}

    /* -- scroll progress + header lift (still cheapest in JS) -- */
    var bar = document.createElement('div');
    bar.className = 'zoi-prog';
    document.body.appendChild(bar);
    var header = document.querySelector('.zoi-header');
    var raf = 0;
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var h = document.documentElement;
        var max = h.scrollHeight - h.clientHeight;
        bar.style.width = max > 0 ? ((h.scrollTop / max) * 100).toFixed(2) + '%' : '0';
        if (header) header.classList.toggle('stuck', h.scrollTop > 8);
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* -- the light field and the grain --
       Injected rather than pasted into sixteen pages, so there is one place to
       change them and no page can be left behind. */
    if (!document.querySelector('.zoi-light')) {
      var light = document.createElement('div');
      light.className = 'zoi-light';
      light.setAttribute('aria-hidden', 'true');
      light.innerHTML = '<i></i><i></i><i></i>';
      document.body.insertBefore(light, document.body.firstChild);
      var grain = document.createElement('div');
      grain.className = 'zoi-grain';
      grain.setAttribute('aria-hidden', 'true');
      document.body.appendChild(grain);
      // A page that shipped its own dead .glow div no longer needs it.
      var old = document.querySelector('.glow');
      if (old) old.remove();
    }

    /* -- pointer-tracked highlight --
       One delegated listener for the whole document, coalesced into a frame.
       Per-card listeners on a 60-card grid is how a page starts dropping
       frames on a trackpad. */
    if (window.matchMedia && matchMedia('(hover:hover)').matches) {
      var litRaf = 0, lastEv = null;
      document.addEventListener('pointermove', function (e) {
        lastEv = e;
        if (litRaf) return;
        litRaf = requestAnimationFrame(function () {
          litRaf = 0;
          var t = lastEv && lastEv.target;
          var el = t && t.closest ? t.closest('.zoi-lit, .card, .lcard, .relcard, .ecard, '+'.cgrid > *, .dcats > *, .apps-grid > *, .grid > *') : null;
          if (!el) return;
          var r = el.getBoundingClientRect();
          el.style.setProperty('--mx', (((lastEv.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
          el.style.setProperty('--my', (((lastEv.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
        });
      }, { passive: true });
    }

    /* -- stagger indices --
       CSS can offset an animation per child, but only if it knows the index. */
    var groups = document.querySelectorAll('.zoi-stagger');
    for (var g = 0; g < groups.length; g++) {
      var kids = groups[g].children;
      for (var k = 0; k < kids.length; k++) {
        kids[k].style.setProperty('--i', Math.min(k, 12));
      }
    }

    /* -- headline word reveal --
       Split on words, wrap each in a masking span. Skipped entirely under
       reduced motion so the markup is never rewritten for nothing. */
    if (!reduce) {
      var heads = document.querySelectorAll('[data-words]');
      for (var hh = 0; hh < heads.length; hh++) split(heads[hh]);
    }

    /* -- count numbers up --
       Only for elements that opt in, and only from a real final value already
       in the DOM, so nothing invents a figure. */
    if (!reduce && 'IntersectionObserver' in window) {
      var nums = document.querySelectorAll('[data-count]');
      if (nums.length) {
        var nio = new IntersectionObserver(function (ents) {
          ents.forEach(function (en) {
            if (!en.isIntersecting) return;
            countUp(en.target);
            nio.unobserve(en.target);
          });
        }, { threshold: 0.4 });
        for (var n = 0; n < nums.length; n++) nio.observe(nums[n]);
      }
    }

    /* -- reveals --
       CSS owns this when it can. The observer below exists only for browsers
       without scroll-driven animations. */
    /* Opt-in only, on purpose. The previous version auto-tagged every .card,
       .lcard, .relcard and .unlock li on every page — which meant a page could
       have content start at opacity 0 without anyone having asked for it, and
       any container the animation could not resolve against left that content
       invisible. Reveals now apply to elements a page has actually marked, plus
       top-level sections, which are always in the root scrollport. */
    var targets = document.querySelectorAll('[data-reveal], .zoi-rise, body > section, main > section');
    if (!cssScroll && !reduce && 'IntersectionObserver' in window && targets.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en, i) {
          if (!en.isIntersecting) return;
          var el = en.target;
          setTimeout(function () { el.classList.add('in'); }, Math.min(i * 45, 320));
          io.unobserve(el);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
      Array.prototype.forEach.call(targets, function (el) {
        el.setAttribute('data-reveal', '');
        io.observe(el);
      });
    } else if (cssScroll && !reduce) {
      // mark them so the CSS timeline picks them up
      Array.prototype.forEach.call(targets, function (el) { el.setAttribute('data-reveal', ''); });
    }

    /* -- watchdog --
       The last line of defence. Whatever the cause — a nested scroller, a
       transformed ancestor, a tab panel revealed after load, a browser quirk we
       have not met — no visitor should ever be shown a blank space where content
       should be. Anything on screen that is still transparent after the page has
       settled gets the animation removed. It runs three times, cheaply, and then
       stops. */
    if (cssScroll && !reduce) {
      var checks = 0;
      var watchdog = function () {
        checks++;
        var vh = window.innerHeight || 800;
        var list = document.querySelectorAll('[data-reveal], .zoi-rise, .zoi-stagger > *, .zoi-wipe, '+'.cgrid > *, .dcats > *, .apps-grid > *, .grid > *, .crow > *');
        for (var i = 0; i < list.length; i++) {
          var el = list[i];
          if (el.hasAttribute('data-reveal-off')) continue;
          var r = el.getBoundingClientRect();
          if (r.bottom < 0 || r.top > vh || r.width < 4 || r.height < 4) continue;
          var cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          if (parseFloat(cs.opacity) < 0.06) {
            el.setAttribute('data-reveal-off', '');
            if (window.console && console.debug) {
              console.debug('[zoi] reveal watchdog released a stuck element', el);
            }
          }
        }
        if (checks < 3) setTimeout(watchdog, checks === 1 ? 700 : 2000);
      };
      setTimeout(watchdog, 400);
      // A tab or accordion revealed later gets re-checked without polling.
      window.addEventListener('load', function () { setTimeout(watchdog, 300); }, { once: true });
    }

    /* -- the meander needs its own path length to draw itself -- */
    var mnd = document.querySelectorAll('.zoi-meander path');
    for (var m = 0; m < mnd.length; m++) {
      try {
        var len = Math.ceil(mnd[m].getTotalLength());
        mnd[m].style.setProperty('--len', len);
      } catch (e) {}
    }
  }

  /** Wrap every word in a masking span so it can rise from behind its own line. */
  function split(el) {
    if (el.dataset.split === '1') return;
    var walk = [], i;
    // Only touch text nodes, so nested markup (an <em>, a <span class="serif">)
    // survives intact rather than being flattened into a string.
    (function collect(node) {
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) walk.push(c);
        else if (c.nodeType === 1) collect(c);
      }
    })(el);
    var idx = 0;
    for (i = 0; i < walk.length; i++) {
      var tn = walk[i];
      var words = tn.nodeValue.split(/(\s+)/);
      if (words.length < 2 && !tn.nodeValue.trim()) continue;
      var frag = document.createDocumentFragment();
      for (var w = 0; w < words.length; w++) {
        var word = words[w];
        if (!word) continue;
        if (/^\s+$/.test(word)) { frag.appendChild(document.createTextNode(word)); continue; }
        var outer = document.createElement('span');
        outer.className = 'zoi-w';
        var inner = document.createElement('span');
        inner.style.setProperty('--i', idx++);
        inner.textContent = word;
        outer.appendChild(inner);
        frag.appendChild(outer);
      }
      tn.parentNode.replaceChild(frag, tn);
    }
    el.classList.add('zoi-words');
    el.dataset.split = '1';
  }

  /**
   * Count an element's existing number up to itself.
   * Reads the value already rendered, so it can only ever animate toward a
   * figure the page already stated — it cannot introduce one.
   */
  function countUp(el) {
    var text = (el.textContent || '').trim();
    var m = text.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    if (!m) return;
    var target = parseFloat(m[0]);
    if (!isFinite(target) || target === 0) return;
    var prefix = text.slice(0, text.indexOf(m[0])), suffix = text.slice(text.indexOf(m[0]) + m[0].length);
    var dec = (m[0].split('.')[1] || '').length;
    var dur = Math.min(1500, 420 + Math.log10(Math.abs(target) + 1) * 380);
    var t0 = 0;
    el.style.fontVariantNumeric = 'tabular-nums';
    function frame(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur);
      // ease-out cubic: fast, then settles, so the final number is readable
      var v = target * (1 - Math.pow(1 - p, 3));
      el.textContent = prefix + v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suffix;
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = text;   // land exactly on the real string
    }
    requestAnimationFrame(frame);
  }

  /* Highlight the pillar you're on, in the one shared header. */
  function markCurrent() {
    var path = location.pathname.replace(/index\.html$/, "");
    if (path.length > 1) path = path.replace(/\/$/, "");
    var links = document.querySelectorAll(".zoi-nav a");
    var best = null, bestLen = -1;
    for (var i = 0; i < links.length; i++) {
      var href = (links[i].getAttribute("href") || "").split("#")[0].replace(/\/$/, "");
      if (!href) continue;
      if (path === href || (href !== "" && path.indexOf(href + "/") === 0)) {
        if (href.length > bestLen) { best = links[i]; bestLen = href.length; }
      }
    }
    if (best) best.setAttribute("aria-current", "page");
  }

  /* One CTA, honest about session state. Reads the same zoi_auth record every
     page already writes, and only claims a session when the token is unexpired. */
  function signedIn() {
    try {
      var a = JSON.parse(localStorage.getItem("zoi_auth") || "null");
      return !!(a && a.access_token && (!a.expires_at || a.expires_at * 1000 > Date.now()));
    } catch (e) { return false; }
  }
  function reflectSession() {
    var cta = document.getElementById("zoiCta");
    if (!cta) return;
    if (signedIn()) {
      cta.textContent = "My suite";
      cta.setAttribute("href", "/social");
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
