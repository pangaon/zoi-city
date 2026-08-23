/*!
 * zoi-map.js — the Zoi world map.
 * Classic script (NO ES modules). Zero runtime dependencies.
 * Needs: /assets/zoi-land.js (coastline) and, optionally, /assets/zoi-emblem.js
 * (for the category colour wheel — falls back to its own copy of the wheel).
 *
 * Canvas 2D, Web Mercator, grid clustering. All the geometry is pure and
 * exported on ZoiMap so it can be unit-tested without a DOM.
 *
 * HONESTY: only listings that actually carry coordinates are plotted, and the
 * page says how many that is out of the whole directory. Cluster counts are
 * exact — they are a count of the points in the cell, never an estimate.
 */
(function (global) {
  'use strict';

  /* ================= pure geometry ================= */

  var TILE = 256;
  function clampLat(lat) { return Math.max(-85.05112878, Math.min(85.05112878, lat)); }

  /** Web Mercator, normalised to 0..1 (so scale = TILE * 2^zoom). */
  function lngToNx(lng) { return (lng + 180) / 360; }
  function latToNy(lat) {
    var s = Math.sin(clampLat(lat) * Math.PI / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  }
  function nxToLng(nx) { return nx * 360 - 180; }
  function nyToLat(ny) {
    var t = Math.PI * (1 - 2 * ny);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(t) - Math.exp(-t)));
  }

  /** view = {cx,cy (normalised centre), z, w, h}. Returns pixel coords. */
  function project(lng, lat, view) {
    var s = TILE * Math.pow(2, view.z);
    return {
      x: (lngToNx(lng) - view.cx) * s + view.w / 2,
      y: (latToNy(lat) - view.cy) * s + view.h / 2
    };
  }
  function unproject(px, py, view) {
    var s = TILE * Math.pow(2, view.z);
    var nx = (px - view.w / 2) / s + view.cx;
    var ny = (py - view.h / 2) / s + view.cy;
    return { lng: nxToLng(nx), lat: nyToLat(Math.max(0, Math.min(1, ny))) };
  }

  /** Great-circle distance in km — used by "near me". */
  function haversine(aLat, aLng, bLat, bLng) {
    var R = 6371, toR = Math.PI / 180;
    var dLat = (bLat - aLat) * toR, dLng = (bLng - aLng) * toR;
    var la1 = aLat * toR, la2 = bLat * toR;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /**
   * Grid clustering in screen space. Points within the same `cell`-pixel square
   * merge; a cell holding one point stays a real point so you can always click
   * through to a listing. Counts are exact.
   */
  function cluster(points, view, cell) {
    cell = cell || 46;
    var grid = {}, out = [];
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      var pt = project(p.lng, p.lat, view);
      // cull generously so panning feels continuous
      if (pt.x < -cell * 2 || pt.y < -cell * 2 || pt.x > view.w + cell * 2 || pt.y > view.h + cell * 2) continue;
      var key = (Math.floor(pt.x / cell) + ':' + Math.floor(pt.y / cell));
      var c = grid[key];
      if (!c) {
        c = grid[key] = { x: pt.x, y: pt.y, sx: pt.x, sy: pt.y, n: 1, items: [p], types: {} };
        c.types[p.entity_type] = 1;
        out.push(c);
      } else {
        c.n++; c.sx += pt.x; c.sy += pt.y;
        c.x = c.sx / c.n; c.y = c.sy / c.n;
        c.types[p.entity_type] = (c.types[p.entity_type] || 0) + 1;
        if (c.items.length < 12) c.items.push(p);   // keep a few for the panel
      }
    }
    // draw the biggest last so it sits on top
    out.sort(function (a, b) { return a.n - b.n; });
    return out;
  }

  /** Nearest cluster to a pixel, within `r` px. */
  function hit(px, py, clusters, r) {
    r = r || 20;
    var best = null, bd = r * r;
    for (var i = clusters.length - 1; i >= 0; i--) {
      var c = clusters[i];
      var dx = c.x - px, dy = c.y - py, d = dx * dx + dy * dy;
      var rad = radiusFor(c.n) + 6;
      if (d <= Math.max(bd, rad * rad)) { best = c; bd = d; }
    }
    return best;
  }
  function radiusFor(n) {
    if (n <= 1) return 3.6;
    // sqrt keeps a 900-place cluster legible next to a 5-place one instead of
    // swallowing half the map
    return Math.min(15, 4.2 + Math.sqrt(n) * 0.85);
  }

  /** Bounding box of a set of points, padded, as a view. */
  function fit(points, w, h, pad) {
    pad = pad == null ? 0.12 : pad;
    if (!points.length) return { cx: 0.5, cy: 0.42, z: 1.4, w: w, h: h };
    var minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (var i = 0; i < points.length; i++) {
      var nx = lngToNx(points[i].lng), ny = latToNy(points[i].lat);
      if (nx < minX) minX = nx; if (nx > maxX) maxX = nx;
      if (ny < minY) minY = ny; if (ny > maxY) maxY = ny;
    }
    var dx = Math.max(maxX - minX, 1e-6), dy = Math.max(maxY - minY, 1e-6);
    dx *= (1 + pad * 2); dy *= (1 + pad * 2);
    var z = Math.log2(Math.min(w / (TILE * dx), h / (TILE * dy)));
    return {
      cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
      z: Math.max(0.6, Math.min(14, z)), w: w, h: h
    };
  }

  /* ---------- the category colour wheel, shared with the emblems ----------
   * Emblems express colour as CSS color-mix(); canvas needs real numbers, so we
   * read the four brand tokens once and blend in JS. Same wheel, same slots, so
   * a pin and its card agree.
   */
  var SLOT = {
    business: 0, vendor: 1, event: 2, artist: 3, creator: 4, venue: 5,
    church: 6, school: 7, professional: 8, travel_place: 9, sports: 10, organization: 11
  };
  var WHEEL = ['--gold', '--red', '--acc', '--green'];
  function readTokens(el) {
    var cs = global.getComputedStyle(el || global.document.documentElement);
    var t = {};
    WHEEL.forEach(function (k) { t[k] = parseColor(cs.getPropertyValue(k).trim()) || [217, 178, 106]; });
    t.tx = parseColor(cs.getPropertyValue('--tx').trim()) || [243, 246, 250];
    t.mut = parseColor(cs.getPropertyValue('--mut').trim()) || [139, 149, 163];
    t.line = parseColor(cs.getPropertyValue('--line2').trim()) || [255, 255, 255];
    t.card = parseColor(cs.getPropertyValue('--card').trim()) || [20, 26, 34];
    t.bg = parseColor(cs.getPropertyValue('--bg').trim()) || [8, 10, 14];
    return t;
  }
  function parseColor(v) {
    if (!v) return null;
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
    if (m) {
      var h = m[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(v);
    if (m) return [+m[1], +m[2], +m[3]];
    return null;
  }
  function mix(a, b, w) {
    return [Math.round(a[0] * w + b[0] * (1 - w)),
            Math.round(a[1] * w + b[1] * (1 - w)),
            Math.round(a[2] * w + b[2] * (1 - w))];
  }
  function colourFor(type, tokens) {
    var slot = SLOT[type] == null ? 0 : SLOT[type];
    var seg = Math.floor(slot / 3) % 4, step = slot % 3;
    var a = tokens[WHEEL[seg]], b = tokens[WHEEL[(seg + 1) % 4]];
    if (step === 0) return a;
    return mix(a, b, step === 1 ? 0.67 : 0.33);
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  global.ZoiMap = {
    TILE: TILE,
    lngToNx: lngToNx, latToNy: latToNy, nxToLng: nxToLng, nyToLat: nyToLat,
    project: project, unproject: unproject, haversine: haversine,
    cluster: cluster, hit: hit, radiusFor: radiusFor, fit: fit,
    readTokens: readTokens, parseColor: parseColor, mix: mix,
    colourFor: colourFor, rgba: rgba, SLOT: SLOT
  };
})(typeof window !== 'undefined' ? window : globalThis);
