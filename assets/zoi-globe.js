/*!
 * zoi-globe.js — the hero globe.
 *
 * A slowly turning 3D Earth with great-circle arcs running from Greece to every
 * city in the diaspora, sized by how many listings are actually there.
 *
 * Deliberately TILE-FREE. It draws the bundled Natural Earth coastline
 * (assets/zoi-land.js) as GeoJSON instead of loading a basemap, so the hero
 * costs zero tile requests, works with no network after first load, and reads as
 * a stylised globe rather than a detailed map — which is what a hero wants.
 *
 * Honesty: arc weights and city sizes come from live counts. Coordinates come
 * from a static gazetteer (a city does not move); counts are never baked in.
 *
 * Needs MapLibre GL and assets/zoi-land.js. Exposes ZoiGlobe.
 */
(function (global) {
  'use strict';

  var ATHENS = [23.7275, 37.9838];
  /* The story an arc tells is "Greece -> somewhere that kept it going", so no
     arc is drawn to the homeland itself. Without this, the ~40 Greek and Cypriot
     cities in the gazetteer bundle into an unreadable knot at the origin. They
     still appear as dots — they are the reason the arcs exist. */
  var HOMELAND = { 'greece': 1, 'cyprus': 1, 'gr': 1, 'cy': 1 };

  /* ---------- geometry ---------- */

  /**
   * Great-circle interpolation. A straight line between two points in Mercator
   * is not the path anyone travels, and on a globe it visibly cuts through the
   * planet — so the arcs are sampled along the actual great circle.
   */
  function greatCircle(a, b, steps) {
    steps = steps || 48;
    var toR = Math.PI / 180, toD = 180 / Math.PI;
    var lat1 = a[1] * toR, lon1 = a[0] * toR, lat2 = b[1] * toR, lon2 = b[0] * toR;
    var dLat = lat2 - lat1, dLon = lon2 - lon1;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var d = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
    if (d === 0) return [a.slice(), b.slice()];
    var out = [];
    for (var i = 0; i <= steps; i++) {
      var f = i / steps;
      var A = Math.sin((1 - f) * d) / Math.sin(d);
      var B = Math.sin(f * d) / Math.sin(d);
      var x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
      var y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
      var z = A * Math.sin(lat1) + B * Math.sin(lat2);
      out.push([Math.atan2(y, x) * toD, Math.atan2(z, Math.sqrt(x * x + y * y)) * toD]);
    }
    return out;
  }

  /** Meridians and parallels, so the sphere reads as a sphere while it turns. */
  function graticule(step) {
    step = step || 30;
    var feats = [], lng, lat;
    for (lng = -180; lng < 180; lng += step) {
      var m = [];
      for (lat = -80; lat <= 80; lat += 4) m.push([lng, lat]);
      feats.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: m } });
    }
    for (lat = -60; lat <= 60; lat += step) {
      var pl = [];
      for (lng = -180; lng <= 180; lng += 4) pl.push([lng, lat]);
      feats.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pl } });
    }
    return { type: 'FeatureCollection', features: feats };
  }

  /**
   * The bundled coastline, as GeoJSON polygons.
   * zoi-land.js stores flat [lng,lat,...] rings with UNWRAPPED longitudes (see
   * the header comment there for why). Two of the 102 rings run slightly past
   * 180, so they are shifted back by whole turns; the small remaining sliver of
   * north-east Siberia is clamped rather than split, which is invisible at hero
   * scale and avoids re-deriving polygon interiors at runtime.
   */
  function landGeoJSON() {
    var rings = global.ZOI_LAND || [];
    var polys = [];
    for (var r = 0; r < rings.length; r++) {
      var flat = rings[r], coords = [], i;
      if (flat.length < 8) continue;
      var mn = Infinity, mx = -Infinity;
      for (i = 0; i < flat.length; i += 2) { if (flat[i] < mn) mn = flat[i]; if (flat[i] > mx) mx = flat[i]; }
      // Shift by whole turns so the ring's MIDPOINT sits in range. Using its
      // maximum instead moved all of Afro-Eurasia (which runs -17.6 to 190.1
      // unwrapped) a full turn off-range, where the clamp below collapsed the
      // entire continent onto the antimeridian and the globe rendered empty.
      var shift = -360 * Math.round(((mn + mx) / 2) / 360);
      for (i = 0; i < flat.length; i += 2) {
        var lng = flat[i] + shift;
        if (lng > 180) lng = 180; else if (lng < -180) lng = -180;
        coords.push([lng, flat[i + 1]]);
      }
      var f = coords[0], l = coords[coords.length - 1];
      if (f[0] !== l[0] || f[1] !== l[1]) coords.push([f[0], f[1]]);
      if (coords.length >= 4) polys.push([coords]);
    }
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: polys } }]
    };
  }

  /* ---------- palette ---------- */
  function palette() {
    var BM = global.ZoiBasemap;
    var theme = (global.document.documentElement.getAttribute('data-theme') || 'dark');
    var T = (BM && BM.TOKENS[theme]) || { bg: '#080a0e', tx: '#f3f6fa', gold: '#d9b26a', acc: '#6ea8ff', green: '#61c497', mut: '#8b95a3' };
    var mix = BM ? BM.mix : function (a) { return a; };
    var dark = theme !== 'light';
    return {
      space:   dark ? mix(T.bg, '#000000', 0.4) : mix(T.bg, '#0d1b2a', 0.06),
      sea:     dark ? mix(T.bg, T.acc, 0.16) : mix('#cfe0ee', T.acc, 0.10),
      land:    dark ? mix(T.bg, T.tx, 0.115) : mix(T.bg, T.tx, 0.10),
      coast:   dark ? mix(T.bg, T.tx, 0.30) : mix(T.bg, T.tx, 0.34),
      grat:    dark ? mix(T.bg, T.tx, 0.16) : mix(T.bg, T.tx, 0.13),
      arc:     T.gold,
      arcGlow: mix(T.gold, T.bg, 0.55),
      city:    T.acc,
      origin:  T.gold,
      halo:    dark ? mix(T.bg, T.acc, 0.5) : mix('#ffffff', T.acc, 0.4),
      dark:    dark
    };
  }

  function style(P) {
    return {
      version: 8,
      // No glyphs and no sprite: this globe carries no labels or icons, so it
      // needs no font or image server at all.
      sources: {
        land: { type: 'geojson', data: landGeoJSON() },
        grat: { type: 'geojson', data: graticule(30) },
        arcs: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
        cities: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
        origin: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: ATHENS } } }
      },
      projection: { type: 'globe' },
      sky: {
        'sky-color': P.space, 'horizon-color': P.halo, 'fog-color': P.space,
        'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.1,
        'atmosphere-blend': 0.85
      },
      layers: [
        { id: 'space', type: 'background', paint: { 'background-color': P.sea } },
        { id: 'grat', type: 'line', source: 'grat',
          paint: { 'line-color': P.grat, 'line-width': 0.6, 'line-opacity': 0.55 } },
        { id: 'land', type: 'fill', source: 'land',
          paint: { 'fill-color': P.land, 'fill-outline-color': P.coast } },
        { id: 'coast', type: 'line', source: 'land',
          paint: { 'line-color': P.coast, 'line-width': 0.7, 'line-opacity': 0.8 } },
        // two passes: a soft wide glow under a crisp thin line
        { id: 'arc-glow', type: 'line', source: 'arcs',
          layout: { 'line-cap': 'round' },
          paint: { 'line-color': P.arcGlow, 'line-width': ['interpolate', ['linear'], ['get', 'w'], 0, 3, 1, 9],
                   'line-opacity': 0.5, 'line-blur': 4 } },
        { id: 'arc', type: 'line', source: 'arcs',
          layout: { 'line-cap': 'round' },
          paint: { 'line-color': P.arc, 'line-width': ['interpolate', ['linear'], ['get', 'w'], 0, 0.7, 1, 2.4],
                   'line-opacity': 0.9 } },
        // the moving pulse, drawn as a dashed copy whose offset is animated
        { id: 'arc-pulse', type: 'line', source: 'arcs',
          layout: { 'line-cap': 'round' },
          paint: { 'line-color': P.dark ? '#ffffff' : P.arc, 'line-width': 1.7,
                   'line-opacity': 0.75, 'line-dasharray': [0, 4, 3] } },
        { id: 'city-halo', type: 'circle', source: 'cities',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'w'], 0, 4, 1, 15],
            'circle-color': ['case', ['==', ['get', 'home'], 1], P.origin, P.city],
            'circle-opacity': 0.18, 'circle-blur': 0.5
          } },
        { id: 'city', type: 'circle', source: 'cities',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'w'], 0, 1.8, 1, 5.5],
            'circle-color': ['case', ['==', ['get', 'home'], 1], P.origin, P.city],
            'circle-opacity': 0.95,
            'circle-stroke-width': 0.8, 'circle-stroke-color': P.space, 'circle-stroke-opacity': 0.7
          } },
        { id: 'origin-halo', type: 'circle', source: 'origin',
          paint: { 'circle-radius': 16, 'circle-color': P.origin, 'circle-opacity': 0.16, 'circle-blur': 0.7 } },
        { id: 'origin', type: 'circle', source: 'origin',
          paint: { 'circle-radius': 4.5, 'circle-color': P.origin,
                   'circle-stroke-width': 1.2, 'circle-stroke-color': P.space } }
      ]
    };
  }

  /* ---------- mount ---------- */

  /**
   * mount(el, opts) -> { setData, destroy, map }
   * opts: { spin:true, spinSpeed:0.9 (deg/sec), zoom:1.55, interactive:true,
   *         onPick(cityOrNull) }
   */
  function mount(el, opts) {
    opts = opts || {};
    var MB = global.maplibregl;
    if (!MB || typeof MB.Map !== 'function' || !el) return null;

    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var P = palette();
    var map;
    try {
      map = new MB.Map({
        container: el,
        style: style(P),
        center: opts.center || [14, 30],
        zoom: opts.zoom == null ? 1.55 : opts.zoom,
        minZoom: 0.6, maxZoom: 4,
        attributionControl: false,
        interactive: opts.interactive !== false,
        scrollZoom: false,          // a hero must never trap the page scroll
        doubleClickZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchZoomRotate: false,
        keyboard: false,
        fadeDuration: 0
      });
    } catch (e) { return null; }

    var dead = false, raf = 0, spinning = opts.spin !== false && !reduce, dash = 0;
    var lastT = 0, dashT = 0;

    function frame(t) {
      if (dead) return;
      raf = global.requestAnimationFrame(frame);
      if (!lastT) lastT = t;
      var dt = Math.min(80, t - lastT); lastT = t;

      if (spinning) {
        var c = map.getCenter();
        var speed = opts.spinSpeed == null ? 0.9 : opts.spinSpeed;   // deg/sec
        map.setCenter([((c.lng + speed * dt / 1000 + 180) % 360) - 180, c.lat]);
      }
      // march the dash pattern so each arc reads as travelling outward
      dashT += dt;
      if (dashT > 55 && map.getLayer('arc-pulse')) {
        dashT = 0;
        dash = (dash + 1) % 7;
        var pat = [0, 4, 3];
        pat = [dash * 0.5, 3, 4];
        try { map.setPaintProperty('arc-pulse', 'line-dasharray', pat); } catch (e) {}
      }
    }

    map.on('load', function () {
      if (dead) return;
      raf = global.requestAnimationFrame(frame);
      el.setAttribute('data-ready', '1');
    });

    // pause while off-screen or on a hidden tab — a hero must not burn a battery
    var io = null;
    if (global.IntersectionObserver) {
      io = new global.IntersectionObserver(function (es) {
        var vis = es.some(function (e) { return e.isIntersecting; });
        spinning = vis && opts.spin !== false && !reduce;
        if (vis && !raf && !dead) { lastT = 0; raf = global.requestAnimationFrame(frame); }
        if (!vis && raf) { global.cancelAnimationFrame(raf); raf = 0; }
      }, { threshold: 0.05 });
      io.observe(el);
    }
    function onVis() {
      if (global.document.hidden) { if (raf) { global.cancelAnimationFrame(raf); raf = 0; } }
      else if (!raf && !dead) { lastT = 0; raf = global.requestAnimationFrame(frame); }
    }
    global.document.addEventListener('visibilitychange', onVis);

    // dragging should feel like spinning a globe: pause the idle rotation,
    // resume a moment after the user lets go
    var resumeT;
    map.on('mousedown', function () { spinning = false; });
    map.on('touchstart', function () { spinning = false; });
    map.on('dragend', function () {
      clearTimeout(resumeT);
      resumeT = setTimeout(function () { spinning = opts.spin !== false && !reduce; }, 2600);
    });

    /**
     * setData(cities) where cities is [{name, lat, lng, n}].
     * Weights are normalised against the largest city so one huge cluster
     * cannot flatten everything else to invisibility.
     */
    var pending = null, lastCities = null;
    function setData(cities) {
      if (dead) return;
      // mount() returns before the style has loaded, so the sources may not
      // exist yet. Queue and replay on load — the first version returned
      // silently here, which is why the globe rendered with no arcs at all.
      if (!map.getSource || !map.getSource('arcs')) {
        pending = cities;
        map.once('load', function () { if (!dead && pending) { var c = pending; pending = null; setData(c); } });
        return;
      }
      cities = (cities || []).filter(function (c) {
        return c && isFinite(c.lat) && isFinite(c.lng);
      });
      lastCities = cities;
      var max = 1;
      cities.forEach(function (c) { if ((c.n || 0) > max) max = c.n; });
      // sqrt, so a 900-listing city reads as bigger than a 30-listing one
      // without erasing it
      var w = function (n) { return Math.sqrt((n || 0) / max); };

      var away = cities.filter(function (c) {
        return !HOMELAND[String(c.country || '').trim().toLowerCase()];
      });
      map.getSource('arcs').setData({
        type: 'FeatureCollection',
        features: away.map(function (c) {
          return {
            type: 'Feature',
            properties: { w: w(c.n), name: c.name || '', n: c.n || 0 },
            geometry: { type: 'LineString', coordinates: greatCircle(ATHENS, [c.lng, c.lat], 44) }
          };
        })
      });
      map.getSource('cities').setData({
        type: 'FeatureCollection',
        features: cities.map(function (c) {
          return {
            type: 'Feature',
            properties: { w: w(c.n), name: c.name || '', n: c.n || 0,
                          home: HOMELAND[String(c.country || '').trim().toLowerCase()] ? 1 : 0 },
            geometry: { type: 'Point', coordinates: [c.lng, c.lat] }
          };
        })
      });
    }

    if (typeof opts.onPick === 'function') {
      map.on('click', function (e) {
        var f = map.queryRenderedFeatures(e.point, { layers: ['city', 'city-halo'] })[0];
        opts.onPick(f ? f.properties : null);
      });
      map.on('mousemove', function (e) {
        var f = map.queryRenderedFeatures(e.point, { layers: ['city', 'city-halo'] })[0];
        map.getCanvas().style.cursor = f ? 'pointer' : '';
      });
    }

    // repaint on a theme flip, same as the main map
    var mo = new global.MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        if (ms[i].attributeName === 'data-theme') {
          var data = { arcs: null, cities: null };
          try {
            data.arcs = map.getSource('arcs')._data;
            data.cities = map.getSource('cities')._data;
          } catch (e2) {}
          P = palette();
          map.setStyle(style(P), { diff: false });
          map.once('styledata', function () {
            try {
              if (data.arcs) map.getSource('arcs').setData(data.arcs);
              if (data.cities) map.getSource('cities').setData(data.cities);
            } catch (e3) {}
          });
          if (lastCities) map.once('styledata', function () { setData(lastCities); });
          return;
        }
      }
    });
    mo.observe(global.document.documentElement, { attributes: true });

    return {
      map: map,
      setData: setData,
      destroy: function () {
        dead = true;
        if (raf) global.cancelAnimationFrame(raf);
        if (io) io.disconnect();
        mo.disconnect();
        global.document.removeEventListener('visibilitychange', onVis);
        try { map.remove(); } catch (e) {}
      }
    };
  }

  /* ---------- lazy mount ----------
   * MapLibre is ~276KB gzipped. A hero must not make anyone pay that before
   * first paint, so the globe injects its dependencies only once the container
   * is actually near the viewport, and never blocks rendering. Until then the
   * container is just a styled panel.
   */
  var loading = {};
  function script(src) {
    if (loading[src]) return loading[src];
    loading[src] = new Promise(function (res, rej) {
      var existing = global.document.querySelector('script[src="' + src + '"]');
      if (existing && existing.dataset.loaded === '1') return res();
      var s = global.document.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { s.dataset.loaded = '1'; res(); };
      s.onerror = function () { rej(new Error('failed to load ' + src)); };
      global.document.head.appendChild(s);
    });
    return loading[src];
  }

  function needed() {
    var jobs = [];
    if (!global.maplibregl) jobs.push(script('/assets/vendor/maplibre-gl.js'));
    if (!global.ZOI_LAND) jobs.push(script('/assets/zoi-land.js'));
    if (!global.ZOI_CITIES) jobs.push(script('/assets/zoi-cities.js'));
    if (!global.ZoiBasemap) jobs.push(script('/assets/zoi-basemap.js'));
    return Promise.all(jobs);
  }

  function stylesheet(href) {
    if (global.document.querySelector('link[href="' + href + '"]')) return;
    var l = global.document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    global.document.head.appendChild(l);
  }

  /** The gazetteer, as the shape setData() wants. */
  function cityData(limit) {
    var raw = global.ZOI_CITIES || [];
    var out = [];
    // Take the largest diaspora cities first so a limit never spends its whole
    // budget on Greek towns and leaves the diaspora undrawn.
    raw = raw.slice().sort(function (a, b) {
      var ha = HOMELAND[String(a[1]).toLowerCase()] ? 1 : 0;
      var hb = HOMELAND[String(b[1]).toLowerCase()] ? 1 : 0;
      return (ha - hb) || (b[4] - a[4]);
    });
    for (var i = 0; i < raw.length && (!limit || out.length < limit); i++) {
      var c = raw[i];
      // weight only — the gazetteer carries no counts by design
      out.push({ name: c[0], country: c[1], lat: c[2], lng: c[3], n: c[4] * c[4] });
    }
    return out;
  }

  /**
   * lazy(el, opts) — mounts when `el` first comes near the viewport.
   * Returns a promise resolving to the instance, or null if it cannot run.
   */
  function lazy(el, opts) {
    if (!el) return Promise.resolve(null);
    opts = opts || {};
    return new Promise(function (resolve) {
      var started = false;
      function go() {
        if (started) return;
        started = true;
        if (io) io.disconnect();
        stylesheet('/assets/vendor/maplibre-gl.css');
        needed().then(function () {
          var inst = mount(el, opts);
          if (inst) {
            inst.setData(cityData(opts.limit || 90));
            el.setAttribute('data-live', '1');
          }
          resolve(inst);
        }, function () { resolve(null); });   // no globe is better than a broken page
      }
      var io = global.IntersectionObserver
        ? new global.IntersectionObserver(function (es) {
            if (es.some(function (e) { return e.isIntersecting; })) go();
          }, { rootMargin: '320px' })
        : null;
      if (io) io.observe(el); else go();
    });
  }

  global.ZoiGlobe = {
    mount: mount, lazy: lazy, cityData: cityData, greatCircle: greatCircle, graticule: graticule,
    landGeoJSON: landGeoJSON, palette: palette, style: style, ATHENS: ATHENS
  };
})(typeof window !== 'undefined' ? window : globalThis);
