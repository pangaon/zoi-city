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
  function motion() {
    var reduce = false;
    try { reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

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

    if (reduce || !('IntersectionObserver' in window)) return;
    // Anything the page marks, plus the obvious content blocks.
    var targets = document.querySelectorAll('[data-reveal], .sec, .lcard, .card, .relcard, .unlock li');
    if (!targets.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en, i) {
        if (!en.isIntersecting) return;
        var el = en.target;
        // stagger within a batch so a grid cascades instead of popping
        setTimeout(function () { el.classList.add('in'); }, Math.min(i * 45, 320));
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    Array.prototype.forEach.call(targets, function (el) {
      el.setAttribute('data-reveal', '');
      io.observe(el);
    });
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
