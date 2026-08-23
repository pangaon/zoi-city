/*!
 * zoi-basemap.js — the Zoi basemap, authored from the brand tokens.
 *
 * Returns a complete MapLibre style spec. NOT a recolour of somebody else's
 * style: every layer here is ours, written against the OpenMapTiles vector
 * schema, so a map of Athens looks like Zoi rather than like a default.
 *
 * One function serves all three themes. The palettes below start from the exact
 * token values in zoi-theme.css and derive every shade by mixing, so dark,
 * light and gold stay coherent with the rest of the site instead of drifting.
 *
 * Classic script. Zero dependencies. Exposes ZoiBasemap.
 *
 * Tiles: OpenFreeMap (OpenMapTiles schema, OpenStreetMap data) — free, no API
 * key, no rate limit. Terrain: Tilezen terrarium DEM on AWS Open Data.
 * Attribution for all of it is required and is rendered by the map page.
 */
(function (global) {
  'use strict';

  var VECTOR = 'https://tiles.openfreemap.org/planet';
  var GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
  var DEM    = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

  // The glyph server only carries these three stacks — referencing anything
  // else silently drops the label, so the set is fixed deliberately.
  var REG = ['Noto Sans Regular'], BOLD = ['Noto Sans Bold'];

  var ATTRIBUTION =
    '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · ' +
    '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · ' +
    '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
  var DEM_ATTRIBUTION =
    '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Tilezen</a>';

  /* ---------------- colour maths ----------------
   * MapLibre needs concrete colours, so we cannot hand it var(--gold). We take
   * the token hexes and mix in JS — same arithmetic color-mix() would do.
   */
  function parse(v) {
    var s = String(v == null ? '' : v).trim();
    var m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*(?:[,/]\s*([\d.%]+)\s*)?\)$/i.exec(s);
    if (m) {
      var a = m[4] == null ? 1 : (/%$/.test(m[4]) ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
      return [+m[1], +m[2], +m[3], a];
    }
    var h = s.replace('#', '');
    if (!/^[0-9a-f]{3,8}$/i.test(h)) return null;
    if (h.length === 3 || h.length === 4) h = h.split('').map(function (c) { return c + c; }).join('');
    var out = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    if (h.length === 8) out.push(parseInt(h.slice(6, 8), 16) / 255);
    return out;
  }
  function fmt(c) {
    return '#' + c.map(function (v) {
      v = Math.max(0, Math.min(255, Math.round(v)));
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
  }
  /** mix(a,b,t) — t is how much of b. mix('#000','#fff',0.5) === mid grey. */
  function mix(a, b, t) {
    var x = parse(a), y = parse(b);
    if (!x || !y) return x ? fmt(x) : (y ? fmt(y) : '#000000');
    return fmt([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
  }
  /** Composite a translucent colour over an opaque one — what the eye sees. */
  function over(fg, bg) {
    var f = parse(fg), b = parse(bg);
    if (!f) return fmt(b || [0, 0, 0]);
    if (!b) return fmt(f);
    var a = f.length > 3 ? f[3] : 1;
    return fmt([f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a)]);
  }
  function rgba(h, a) {
    var c = parse(h) || [0, 0, 0];
    return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + a + ')';
  }

  /* The three token sets, copied from zoi-theme.css. */
  var TOKENS = {
    dark:  { bg: '#060b14', card: '#0f1b2d', tx: '#eef3fa', mut: '#93a4bd',
             acc: '#4f9be8', gold: '#d4af5f', green: '#5bc49a', red: '#e0796b' },
    light: { bg: '#f7f9fc', card: '#ffffff', tx: '#0b2545', mut: '#4a6180',
             acc: '#1668c4', gold: '#96701c', green: '#1b7a55', red: '#b84a38' },
    gold:  { bg: '#0a0906', card: '#191509', tx: '#f6f0e2', mut: '#c4b294',
             acc: '#e0be7a', gold: '#e0be7a', green: '#8fbf9f', red: '#d99a86' }
  };

  /**
   * Derive every colour the style needs from one token set.
   * The `dark` branch inverts the direction of contrast: on a dark map, land is
   * lifted out of the background and water sinks below it; on paper, the
   * opposite reads as a map.
   */
  function palette(name) {
    var T = TOKENS[name] || TOKENS.dark;
    var dark = name !== 'light';
    var gilt = name === 'gold';
    var P = { tx: T.tx, mut: T.mut, gold: T.gold, acc: T.acc, dark: dark };

    if (dark) {
      P.void    = mix(T.bg, '#000000', 0.35);          // beyond the map edge
      // Land and sea must be perceptibly different and the sea must read AS sea.
      // Measured in CIELAB: dE 12.5 apart, water markedly cooler (b* -13 vs
      // land's -3). The first pass had these dE 4.9 apart and looked like one
      // flat surface. Guarded by tests/unit/basemap.test.mjs.
      P.land    = mix(T.bg, T.tx, 0.055);
      P.water   = mix(mix(T.bg, T.acc, 0.20), '#000000', 0.10);
      // The gold theme has no cool token at all — its --acc IS its --gold — so
      // a blue sea cannot be derived from it. Mixing toward --green just yields
      // olive that reads as more land (dE 2.3, invisible). It gets lifted
      // parchment land over an ink sea instead: separation by lightness,
      // dE 13.7, and truer to the theme than a teal we would have invented.
      if (gilt) {
        P.land  = mix(T.bg, T.tx, 0.10);
        P.water = mix(T.bg, '#000000', 0.60);
      }
      P.park    = mix(P.land, T.green, 0.12);
      P.wood    = mix(P.land, T.green, 0.07);
      P.sand    = mix(P.land, T.gold, 0.10);
      P.ice     = mix(P.land, T.tx, 0.10);
      P.built   = mix(P.land, T.tx, 0.03);             // residential wash
      P.bldg    = mix(P.land, T.tx, 0.085);
      P.bldgTop = mix(P.land, T.tx, 0.13);
      P.roadLo  = mix(P.land, T.tx, 0.13);
      P.roadHi  = mix(P.land, T.tx, 0.30);
      P.trunk   = mix(P.land, T.gold, 0.34);
      P.motor   = mix(P.land, T.gold, 0.46);
      P.casing  = mix(P.land, '#000000', 0.45);
      P.rail    = mix(P.land, T.tx, 0.16);
      P.path    = mix(P.land, T.tx, 0.17);
      P.border  = rgba(T.tx, 0.20);
      P.borderS = rgba(T.tx, 0.09);
      P.halo    = mix(T.bg, '#000000', 0.45);
      P.label   = T.tx;
      P.labelLo = mix(T.mut, T.tx, 0.15);
      P.hydroLb = mix(T.acc, T.tx, 0.42);
      P.poi     = mix(T.mut, T.bg, 0.15);
      P.sky     = mix(T.bg, T.acc, 0.16);
      P.horizon = mix(T.bg, T.acc, 0.42);
      P.fog     = mix(T.bg, T.acc, 0.10);
      P.space   = mix(T.bg, '#000000', 0.60);
    } else {
      P.void    = mix(T.bg, '#000000', 0.06);
      P.land    = T.bg;
      P.water   = mix('#cfe0ee', T.acc, 0.10);
      P.park    = mix(P.land, T.green, 0.14);
      P.wood    = mix(P.land, T.green, 0.09);
      P.sand    = mix(P.land, T.gold, 0.12);
      P.ice     = '#ffffff';
      P.built   = mix(P.land, T.tx, 0.035);
      P.bldg    = mix(P.land, T.tx, 0.10);
      P.bldgTop = mix(P.land, T.tx, 0.16);
      P.roadLo  = '#ffffff';
      P.roadHi  = '#ffffff';
      P.trunk   = mix('#ffffff', T.gold, 0.30);
      P.motor   = mix('#ffffff', T.gold, 0.45);
      P.casing  = rgba(T.tx, 0.16);
      P.rail    = rgba(T.tx, 0.26);
      P.path    = rgba(T.tx, 0.24);
      P.border  = rgba(T.tx, 0.26);
      P.borderS = rgba(T.tx, 0.11);
      P.halo    = 'rgba(255,255,255,0.9)';
      P.label   = T.tx;
      P.labelLo = T.mut;
      P.hydroLb = mix(T.acc, T.tx, 0.20);
      P.poi     = mix(T.mut, T.bg, 0.10);
      P.sky     = '#cfe2f5';
      P.horizon = '#e9f0f7';
      P.fog     = '#eef3f8';
      P.space   = '#b9cfe4';
    }
    return P;
  }

  /* ---------------- expression helpers ---------------- */
  function interp(stops) { return ['interpolate', ['linear'], ['zoom']].concat(stops); }
  function expo(base, stops) { return ['interpolate', ['exponential', base], ['zoom']].concat(stops); }

  /**
   * Label text. `greek` swaps in the Greek exonym wherever OSM has one — a real
   * feature for this audience, not decoration: Μελβούρνη, Τορόντο, Γιοχάνεσμπουργκ.
   * Falls back to the local name so nothing ever renders blank.
   */
  function nameField(greek) {
    return greek
      ? ['coalesce', ['get', 'name:el'], ['get', 'name:latin'], ['get', 'name']]
      : ['coalesce', ['get', 'name'], ['get', 'name:latin'], ['get', 'name:el']];
  }

  /**
   * Build the style.
   * opts: { theme, greek:false, terrain:false, buildings3d:true, globe:true }
   */
  function style(opts) {
    opts = opts || {};
    var P = palette(opts.theme || 'dark');
    var greek = !!opts.greek;
    var NF = nameField(greek);

    var sources = {
      openmaptiles: { type: 'vector', url: VECTOR, attribution: ATTRIBUTION }
    };
    if (opts.terrain) {
      sources.dem = {
        type: 'raster-dem', tiles: [DEM], encoding: 'terrarium',
        tileSize: 256, maxzoom: 13, attribution: DEM_ATTRIBUTION
      };
    }

    var layers = [];
    function add(l) { layers.push(l); }
    function omt(id, type, sourceLayer, extra) {
      var l = { id: id, type: type, source: 'openmaptiles', 'source-layer': sourceLayer };
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) l[k] = extra[k];
      return l;
    }

    /* ---- ground ---- */
    add({ id: 'bg', type: 'background', paint: { 'background-color': P.land } });

    add(omt('landcover-ice', 'fill', 'landcover', {
      filter: ['==', ['get', 'class'], 'ice'],
      paint: { 'fill-color': P.ice, 'fill-opacity': 0.55 }
    }));
    add(omt('landcover-wood', 'fill', 'landcover', {
      filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'scrub']]],
      paint: { 'fill-color': P.wood, 'fill-opacity': interp([4, 0, 7, 0.7, 12, 0.45]) }
    }));
    add(omt('landcover-sand', 'fill', 'landcover', {
      filter: ['==', ['get', 'class'], 'sand'],
      paint: { 'fill-color': P.sand, 'fill-opacity': 0.5 }
    }));
    add(omt('landuse-built', 'fill', 'landuse', {
      minzoom: 8,
      filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'quarter', 'neighbourhood']]],
      paint: { 'fill-color': P.built, 'fill-opacity': interp([8, 0, 10, 0.8]) }
    }));
    add(omt('park', 'fill', 'park', {
      paint: { 'fill-color': P.park, 'fill-opacity': interp([6, 0, 9, 0.7]) }
    }));
    add(omt('park-outline', 'line', 'park', {
      minzoom: 12,
      paint: { 'line-color': P.park, 'line-width': 1, 'line-opacity': 0.7 }
    }));

    /* ---- water ---- */
    add(omt('water', 'fill', 'water', {
      // `class: ocean` is drawn as one huge polygon; keeping it in the same
      // layer as lakes means one flat sea colour, which is what we want.
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      paint: { 'fill-color': P.water, 'fill-antialias': true }
    }));
    add(omt('waterway', 'line', 'waterway', {
      minzoom: 7,
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      paint: {
        'line-color': P.water,
        'line-width': interp([7, 0.5, 12, 1.6, 16, 4]),
        'line-opacity': interp([7, 0.5, 10, 1])
      }
    }));

    /* ---- hillshade, when terrain is on ---- */
    if (opts.terrain) {
      add({
        id: 'hillshade', type: 'hillshade', source: 'dem',
        paint: {
          'hillshade-exaggeration': 0.28,
          'hillshade-shadow-color': P.dark ? 'rgba(0,0,0,0.55)' : 'rgba(40,50,60,0.28)',
          'hillshade-highlight-color': P.dark ? rgba(P.tx, 0.10) : 'rgba(255,255,255,0.45)',
          'hillshade-accent-color': 'rgba(0,0,0,0)'
        }
      });
    }

    /* ---- boundaries ----
     * Sub-national lines stay very quiet; national lines carry the map's
     * structure at world zoom, which is where this map is mostly used.
     */
    add(omt('boundary-state', 'line', 'boundary', {
      filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
      minzoom: 4,
      layout: { 'line-join': 'round' },
      paint: { 'line-color': P.borderS, 'line-dasharray': [3, 2], 'line-width': interp([4, 0.5, 10, 1.2]) }
    }));
    add(omt('boundary-country', 'line', 'boundary', {
      filter: ['all', ['<=', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': P.border, 'line-width': interp([1, 0.6, 5, 1.4, 10, 2.2]) }
    }));

    /* ---- buildings ---- */
    add(omt('building', 'fill', 'building', {
      minzoom: 13,
      paint: {
        'fill-color': P.bldg,
        'fill-opacity': interp([13, 0, 14, 0.85, 16, opts.buildings3d === false ? 0.9 : 0.35])
      }
    }));
    if (opts.buildings3d !== false) {
      add(omt('building-3d', 'fill-extrusion', 'building', {
        minzoom: 15,
        paint: {
          'fill-extrusion-color': P.bldgTop,
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 5],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': interp([15, 0, 15.8, 0.85])
        }
      }));
    }

    /* ---- roads ----
     * Casing then fill, minor to major, so junctions knit together instead of
     * showing seams. Widths are exponential in zoom, which is what makes a road
     * network feel physical rather than drawn.
     */
    var MOTOR = ['motorway', 'motorway_link'], TRUNK = ['trunk', 'trunk_link', 'primary', 'primary_link'];

    add(omt('tunnel', 'line', 'transportation', {
      minzoom: 12,
      filter: ['==', ['get', 'brunnel'], 'tunnel'],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': P.roadLo, 'line-dasharray': [1.2, 1.2],
        'line-width': expo(1.6, [12, 0.6, 18, 8]), 'line-opacity': 0.6
      }
    }));

    add(omt('road-path', 'line', 'transportation', {
      minzoom: 14,
      filter: ['in', ['get', 'class'], ['literal', ['path', 'track', 'pedestrian', 'footway']]],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': P.path, 'line-dasharray': [2, 1.6],
        'line-width': expo(1.5, [14, 0.5, 18, 2.4]), 'line-opacity': interp([14, 0, 15, 0.8])
      }
    }));

    add(omt('road-minor-casing', 'line', 'transportation', {
      minzoom: 12,
      filter: ['all', ['!=', ['get', 'brunnel'], 'tunnel'],
        ['in', ['get', 'class'], ['literal', ['minor', 'service', 'residential', 'living_street']]]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': P.casing, 'line-width': expo(1.65, [12, 1.4, 18, 14]), 'line-opacity': interp([12, 0, 13, 1]) }
    }));
    add(omt('road-minor', 'line', 'transportation', {
      minzoom: 12,
      filter: ['all', ['!=', ['get', 'brunnel'], 'tunnel'],
        ['in', ['get', 'class'], ['literal', ['minor', 'service', 'residential', 'living_street']]]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': interp([12, P.roadLo, 16, P.roadHi]),
        'line-width': expo(1.65, [12, 0.5, 18, 10]), 'line-opacity': interp([11.5, 0, 12.5, 1])
      }
    }));

    add(omt('road-secondary-casing', 'line', 'transportation', {
      minzoom: 9,
      filter: ['all', ['!=', ['get', 'brunnel'], 'tunnel'],
        ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary', 'secondary_link', 'tertiary_link']]]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': P.casing, 'line-width': expo(1.6, [9, 1.6, 18, 20]), 'line-opacity': interp([9, 0, 11, 1]) }
    }));
    add(omt('road-secondary', 'line', 'transportation', {
      minzoom: 8,
      filter: ['all', ['!=', ['get', 'brunnel'], 'tunnel'],
        ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary', 'secondary_link', 'tertiary_link']]]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': interp([9, P.roadLo, 15, P.roadHi]),
        'line-width': expo(1.6, [8, 0.6, 18, 15])
      }
    }));

    add(omt('road-trunk-casing', 'line', 'transportation', {
      minzoom: 6,
      filter: ['all', ['!=', ['get', 'brunnel'], 'tunnel'], ['in', ['get', 'class'], ['literal', TRUNK]]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': P.casing, 'line-width': expo(1.55, [6, 1.8, 18, 26]), 'line-opacity': interp([6, 0, 8, 1]) }
    }));
    add(omt('road-trunk', 'line', 'transportation', {
      minzoom: 5,
      filter: ['all', ['!=', ['get', 'brunnel'], 'tunnel'], ['in', ['get', 'class'], ['literal', TRUNK]]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': P.trunk, 'line-width': expo(1.55, [5, 0.7, 18, 20]) }
    }));

    add(omt('road-motorway-casing', 'line', 'transportation', {
      minzoom: 5,
      filter: ['all', ['!=', ['get', 'brunnel'], 'tunnel'], ['in', ['get', 'class'], ['literal', MOTOR]]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': P.casing, 'line-width': expo(1.55, [5, 2.2, 18, 30]), 'line-opacity': interp([5, 0, 7, 1]) }
    }));
    add(omt('road-motorway', 'line', 'transportation', {
      filter: ['all', ['!=', ['get', 'brunnel'], 'tunnel'], ['in', ['get', 'class'], ['literal', MOTOR]]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': P.motor, 'line-width': expo(1.55, [4, 0.6, 18, 24]) }
    }));

    add(omt('rail', 'line', 'transportation', {
      minzoom: 9,
      filter: ['in', ['get', 'class'], ['literal', ['rail', 'transit']]],
      paint: {
        'line-color': P.rail, 'line-dasharray': [4, 2],
        'line-width': expo(1.5, [9, 0.5, 18, 3]), 'line-opacity': interp([9, 0, 11, 0.8])
      }
    }));

    add(omt('aeroway', 'line', 'aeroway', {
      minzoom: 10,
      paint: { 'line-color': P.roadLo, 'line-width': expo(1.6, [10, 1, 16, 18]), 'line-opacity': 0.7 }
    }));

    /* ---- labels ----
     * Ordered lowest-priority first so MapLibre's collision detection drops the
     * least important labels when space runs out.
     */
    add(omt('label-poi', 'symbol', 'poi', {
      minzoom: 15,
      filter: ['<=', ['get', 'rank'], 12],
      layout: {
        'text-field': NF, 'text-font': REG,
        'text-size': interp([15, 10, 18, 12]),
        'text-max-width': 8, 'text-anchor': 'top', 'text-offset': [0, 0.3],
        'text-padding': 4
      },
      paint: { 'text-color': P.poi, 'text-halo-color': P.halo, 'text-halo-width': 1.1 }
    }));

    add(omt('label-road', 'symbol', 'transportation_name', {
      minzoom: 13,
      layout: {
        'symbol-placement': 'line', 'text-field': NF, 'text-font': REG,
        'text-size': interp([13, 9, 18, 12]), 'text-letter-spacing': 0.04,
        'text-rotation-alignment': 'map', 'text-padding': 2
      },
      paint: { 'text-color': P.labelLo, 'text-halo-color': P.halo, 'text-halo-width': 1.4 }
    }));

    add(omt('label-water', 'symbol', 'water_name', {
      minzoom: 3,
      layout: {
        'text-field': NF, 'text-font': ['Noto Sans Italic'],
        'text-size': interp([3, 10, 8, 13, 14, 15]),
        'text-letter-spacing': 0.14, 'text-max-width': 7, 'symbol-placement': 'point'
      },
      paint: { 'text-color': P.hydroLb, 'text-halo-color': P.halo, 'text-halo-width': 1.2, 'text-opacity': 0.85 }
    }));

    add(omt('label-suburb', 'symbol', 'place', {
      minzoom: 11,
      filter: ['in', ['get', 'class'], ['literal', ['suburb', 'neighbourhood', 'quarter']]],
      layout: {
        'text-field': NF, 'text-font': REG, 'text-size': interp([11, 10, 15, 13]),
        'text-letter-spacing': 0.1, 'text-transform': 'uppercase', 'text-max-width': 8
      },
      paint: { 'text-color': P.labelLo, 'text-halo-color': P.halo, 'text-halo-width': 1.3 }
    }));

    add(omt('label-village', 'symbol', 'place', {
      minzoom: 9,
      filter: ['in', ['get', 'class'], ['literal', ['village', 'hamlet', 'isolated_dwelling']]],
      layout: { 'text-field': NF, 'text-font': REG, 'text-size': interp([9, 10, 14, 13]), 'text-max-width': 8 },
      paint: { 'text-color': P.labelLo, 'text-halo-color': P.halo, 'text-halo-width': 1.3 }
    }));

    add(omt('label-town', 'symbol', 'place', {
      minzoom: 7,
      filter: ['==', ['get', 'class'], 'town'],
      layout: { 'text-field': NF, 'text-font': REG, 'text-size': interp([7, 11, 13, 15]), 'text-max-width': 8 },
      paint: { 'text-color': P.label, 'text-halo-color': P.halo, 'text-halo-width': 1.4, 'text-opacity': 0.9 }
    }));

    add(omt('label-city', 'symbol', 'place', {
      minzoom: 4,
      filter: ['==', ['get', 'class'], 'city'],
      layout: {
        'text-field': NF, 'text-font': BOLD,
        'text-size': interp([4, 11, 8, 15, 13, 19]),
        'text-max-width': 8, 'text-padding': 6
      },
      paint: { 'text-color': P.label, 'text-halo-color': P.halo, 'text-halo-width': 1.6 }
    }));

    add(omt('label-state', 'symbol', 'place', {
      minzoom: 4, maxzoom: 8,
      filter: ['==', ['get', 'class'], 'state'],
      layout: {
        'text-field': NF, 'text-font': REG, 'text-size': interp([4, 10, 7, 13]),
        'text-transform': 'uppercase', 'text-letter-spacing': 0.16, 'text-max-width': 9
      },
      paint: { 'text-color': P.labelLo, 'text-halo-color': P.halo, 'text-halo-width': 1.2, 'text-opacity': 0.7 }
    }));

    // Country names are the one place the brand gold appears in the basemap.
    add(omt('label-country', 'symbol', 'place', {
      maxzoom: 9,
      filter: ['==', ['get', 'class'], 'country'],
      layout: {
        'text-field': NF, 'text-font': BOLD,
        'text-size': interp([1, 10, 4, 14, 8, 18]),
        'text-transform': 'uppercase', 'text-letter-spacing': 0.2, 'text-max-width': 7,
        'text-padding': 8
      },
      paint: {
        'text-color': P.gold, 'text-halo-color': P.halo, 'text-halo-width': 1.5,
        'text-opacity': interp([1, 0.75, 5, 0.95, 8, 0.4])
      }
    }));

    var s = {
      version: 8,
      name: 'Zoi ' + (opts.theme || 'dark'),
      glyphs: GLYPHS,
      sources: sources,
      // The empty space beyond the antimeridian / poles, and the globe's
      // backdrop, both read from here — leaving it default puts a light grey
      // band around a dark map.
      light: { anchor: 'viewport', color: '#ffffff', intensity: P.dark ? 0.2 : 0.4 },
      sky: {
        'sky-color': P.sky,
        'horizon-color': P.horizon,
        'fog-color': P.fog,
        'sky-horizon-blend': 0.6,
        'horizon-fog-blend': 0.6,
        'fog-ground-blend': 0.15,
        'atmosphere-blend': interp([0, 0.9, 5, 0.5, 7, 0])
      },
      layers: layers
    };
    // `projection` is a root style property — it is NOT a Map constructor
    // option, so it has to live here. Globe at world scale easing into Mercator
    // by the time you are looking at streets.
    s.projection = opts.globe === false
      ? { type: 'mercator' }
      : { type: ['interpolate', ['linear'], ['zoom'], 3, 'vertical-perspective', 6, 'mercator'] };
    if (opts.terrain) s.terrain = { source: 'dem', exaggeration: 1.1 };
    return s;
  }

  global.ZoiBasemap = {
    style: style, palette: palette, mix: mix, rgba: rgba, parse: parse, fmt: fmt,
    over: over, TOKENS: TOKENS, FONTS: { regular: REG, bold: BOLD, italic: ['Noto Sans Italic'] },
    ATTRIBUTION: ATTRIBUTION, VECTOR: VECTOR, GLYPHS: GLYPHS, DEM: DEM
  };
})(typeof window !== 'undefined' ? window : globalThis);
