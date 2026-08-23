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
