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
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
