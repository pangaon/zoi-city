// The basemap is 34 hand-authored layers of MapLibre spec. A typo in an
// expression does not throw — it silently drops the layer, so a road network or
// every label can vanish with no error anywhere. These tests validate the real
// spec and assert the things a validator cannot know: that the sea is visible
// against the land, that no layer references a font or sprite we do not ship,
// and that the paint order still reads as a map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const spec = require('../vendor/maplibre-style-spec.cjs');

const g = {};
new Function('window', 'globalThis',
  readFileSync(new URL('../../assets/zoi-basemap.js', import.meta.url), 'utf8'))(g, g);
const BM = g.ZoiBasemap;


/* --- colour science, so "can you actually see it" is measured, not eyeballed --- */
const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
function labOf(hex) {
  const [r, g2, b] = BM.parse(hex).map(lin);
  const X = r * 0.4124 + g2 * 0.3576 + b * 0.1805;
  const Y = r * 0.2126 + g2 * 0.7152 + b * 0.0722;
  const Z = r * 0.0193 + g2 * 0.1192 + b * 0.9505;
  const q = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = q(X / 0.95047), fy = q(Y), fz = q(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const dE = (a, b) => { const x = labOf(a), y = labOf(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const lstar = (h) => labOf(h)[0];
const bstar = (h) => labOf(h)[2];   // negative = cooler / bluer
function wcag(a, b) {
  const L = (h) => { const [r, g2, bb] = BM.parse(h).map(lin); return 0.2126 * r + 0.7152 * g2 + 0.0722 * bb; };
  const x = L(a), y = L(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const THEMES = ['dark', 'light', 'gold'];
const COMBOS = [];
for (const theme of THEMES)
  for (const terrain of [false, true])
    for (const greek of [false, true])
      for (const globe of [false, true])
        COMBOS.push({ theme, terrain, greek, globe });

// The layers OpenFreeMap's tilejson actually publishes. Naming one that is not
// here yields an empty layer with no warning.
const SOURCE_LAYERS = new Set(['aerodrome_label', 'aeroway', 'boundary', 'building',
  'housenumber', 'landcover', 'landuse', 'mountain_peak', 'park', 'place', 'poi',
  'transportation', 'transportation_name', 'water', 'water_name', 'waterway']);

// The glyph server carries exactly these three stacks.
const FONTS = new Set(['Noto Sans Regular', 'Noto Sans Bold', 'Noto Sans Italic']);

test('every theme/terrain/language/projection combination is valid MapLibre style spec', () => {
  for (const c of COMBOS) {
    const errs = spec.validateStyleMin(BM.style(c));
    assert.equal(errs.length, 0,
      `${JSON.stringify(c)} -> ${errs.map((e) => e.message).join('; ')}`);
  }
  assert.equal(COMBOS.length, 24);
});

test('layer ids are unique and every layer points at a declared source', () => {
  for (const c of COMBOS) {
    const s = BM.style(c);
    const ids = new Set();
    for (const l of s.layers) {
      assert.ok(!ids.has(l.id), `duplicate layer id ${l.id} in ${JSON.stringify(c)}`);
      ids.add(l.id);
      if (l.type === 'background') continue;
      assert.ok(s.sources[l.source], `layer ${l.id} wants missing source ${l.source}`);
    }
  }
});

test('no layer reads a source-layer the tile schema does not publish', () => {
  for (const l of BM.style({ theme: 'dark' }).layers) {
    const sl = l['source-layer'];
    if (!sl) continue;
    assert.ok(SOURCE_LAYERS.has(sl), `layer ${l.id} reads unknown source-layer "${sl}"`);
  }
});

test('every font is one the glyph server actually serves', () => {
  for (const c of COMBOS) {
    for (const l of BM.style(c).layers) {
      const f = l.layout && l.layout['text-font'];
      if (!f) continue;
      assert.ok(Array.isArray(f), `${l.id} text-font must be an array`);
      for (const name of f) assert.ok(FONTS.has(name), `${l.id} wants unavailable font "${name}"`);
    }
  }
});

test('nothing references a sprite, because we ship no sprite', () => {
  for (const c of COMBOS) {
    const s = BM.style(c);
    assert.equal(s.sprite, undefined, 'style must not declare a sprite');
    for (const l of s.layers) {
      const ii = l.layout && l.layout['icon-image'];
      assert.equal(ii, undefined, `${l.id} references icon-image with no sprite loaded`);
    }
  }
});

test('paint order still reads as a map: ground, then water, then roads, then labels', () => {
  const ids = BM.style({ theme: 'dark' }).layers.map((l) => l.id);
  const at = (id) => {
    const i = ids.indexOf(id);
    assert.notEqual(i, -1, `expected a layer called ${id}`);
    return i;
  };
  assert.ok(at('bg') === 0, 'background is first');
  assert.ok(at('landcover-wood') < at('water'), 'landcover under water');
  assert.ok(at('water') < at('road-motorway'), 'water under roads');
  assert.ok(at('road-minor') < at('road-motorway'), 'minor roads under motorways');
  assert.ok(at('road-minor-casing') < at('road-minor'), 'casing under its own fill');
  assert.ok(at('building') < at('label-city'), 'buildings under labels');
  assert.ok(at('road-motorway') < at('label-road'), 'roads under their labels');
  // Collision priority: the least important labels are added first so MapLibre
  // drops them, not the city names, when space runs out.
  assert.ok(at('label-poi') < at('label-city'), 'POI labels yield to city labels');
  assert.ok(at('label-city') < at('label-country'), 'city labels yield to country labels');
});

test('in every theme the sea is perceptibly different from the land', () => {
  // WCAG contrast is the wrong instrument here: between two near-blacks the
  // +0.05 term dominates and everything scores about 1.0 — which is exactly how
  // a dark map with an invisible sea passes a contrast check. CIELAB dE measures
  // what the eye does. dE 2.3 (the gold theme's first draft) is imperceptible;
  // dE >= 8 gives a real coastline.
  for (const theme of THEMES) {
    const P = BM.palette(theme);
    const d = dE(P.land, P.water);
    assert.ok(d >= 8, `${theme}: land vs water only dE ${d.toFixed(2)} — the sea disappears`);
    // A road is legible either because its own fill differs from the ground, or
    // because its casing outlines it. Light basemaps deliberately use white
    // roads on near-white paper (dE ~4.6) and let the casing do the work — so
    // requiring fill contrast alone would be demanding the wrong thing.
    const roadFill = dE(P.roadHi, P.land);
    const roadEdge = dE(BM.over(P.casing, P.land), P.land);
    assert.ok(roadFill >= 5 || roadEdge >= 5,
      `${theme}: roads are invisible — fill dE ${roadFill.toFixed(2)}, casing dE ${roadEdge.toFixed(2)}`);
    assert.ok(dE(P.park, P.land) >= 2.5, `${theme}: parks are indistinguishable from bare land`);
    // Labels are near-white on near-black or the reverse, where WCAG does apply.
    assert.ok(wcag(P.label, P.land) >= 3.5,
      `${theme}: label on land contrast ${wcag(P.label, P.land).toFixed(2)} is too low to read`);
    // Halos are translucent, so the honest comparison is against the composite
    // of halo-over-land, not against the halo colour in the abstract.
    const haloOnLand = BM.over(P.halo, P.land);
    assert.ok(wcag(P.label, haloOnLand) >= 3,
      `${theme}: label on its halo is only ${wcag(P.label, haloOnLand).toFixed(2)} — unreadable`);
    assert.ok(Number.isFinite(wcag(P.label, haloOnLand)), `${theme}: halo contrast computed as NaN`);
  }
});

test('each theme separates land from sea the way that theme intends', () => {
  // dark — a cool blue sea, marginally lighter than the land, as modern dark maps do
  const d = BM.palette('dark');
  assert.ok(bstar(d.water) < bstar(d.land) - 6, 'dark: the sea is decidedly cooler than the land');
  // light — paper land, the sea both darker and cooler
  const l = BM.palette('light');
  assert.ok(lstar(l.water) < lstar(l.land) - 8, 'light: the sea is darker than the paper');
  assert.ok(bstar(l.water) < bstar(l.land) - 6, 'light: the sea is cooler than the paper');
  // gold — warm parchment over an ink sea; it separates by lightness, not hue,
  // because this theme has no cool token to reach for
  const gd = BM.palette('gold');
  assert.ok(lstar(gd.land) > lstar(gd.water) + 6, 'gold: parchment land sits above an ink sea');
  // and the three really are three different maps
  assert.equal(new Set([d.land, l.land, gd.land]).size, 3, 'every theme has its own land colour');
  assert.ok(lstar(d.land) < 30, 'dark land is dark');
  assert.ok(lstar(l.land) > 90, 'light land is light');
});

test('terrain and globe options change the style in the ways they claim to', () => {
  const flat = BM.style({ theme: 'dark', terrain: false, globe: false });
  assert.equal(flat.terrain, undefined, 'no terrain block when terrain is off');
  assert.equal(flat.sources.dem, undefined, 'no DEM source when terrain is off');
  assert.deepEqual(flat.projection, { type: 'mercator' });

  const full = BM.style({ theme: 'dark', terrain: true, globe: true });
  assert.equal(full.terrain.source, 'dem');
  assert.equal(full.sources.dem.type, 'raster-dem');
  assert.equal(full.sources.dem.encoding, 'terrarium', 'terrarium tiles need terrarium encoding');
  assert.ok(Array.isArray(full.projection.type), 'globe interpolates to mercator by zoom');
  assert.ok(full.projection.type.includes('vertical-perspective'));

  const noB = BM.style({ theme: 'dark', buildings3d: false });
  assert.ok(!noB.layers.some((l) => l.type === 'fill-extrusion'), 'buildings3d:false drops extrusions');
  assert.ok(BM.style({ theme: 'dark' }).layers.some((l) => l.type === 'fill-extrusion'),
    '3D buildings are on by default');
});

test('the Greek toggle changes label fields and always has a fallback', () => {
  const en = BM.style({ theme: 'dark', greek: false });
  const el = BM.style({ theme: 'dark', greek: true });
  const field = (s, id) => JSON.stringify(s.layers.find((l) => l.id === id).layout['text-field']);
  assert.notEqual(field(en, 'label-city'), field(el, 'label-city'));
  assert.ok(field(el, 'label-city').includes('name:el'), 'Greek mode asks for name:el');
  // Greek mode must still fall back, or every unnamed place renders blank.
  assert.ok(field(el, 'label-city').includes('coalesce'), 'Greek mode falls back to the local name');
  assert.ok(field(el, 'label-city').includes('"name"'), 'the plain name is the last resort');
  assert.ok(field(en, 'label-city').includes('coalesce'));
});

test('attribution is present on every tile source, because the licences require it', () => {
  const s = BM.style({ theme: 'dark', terrain: true });
  assert.match(s.sources.openmaptiles.attribution, /OpenStreetMap/);
  assert.match(s.sources.openmaptiles.attribution, /OpenMapTiles/);
  assert.match(s.sources.openmaptiles.attribution, /OpenFreeMap/);
  assert.ok(s.sources.dem.attribution, 'the DEM carries its own attribution');
  assert.match(BM.ATTRIBUTION, /openstreetmap\.org\/copyright/);
});

test('colour mixing is the arithmetic the palettes rely on', () => {
  assert.equal(BM.mix('#000000', '#ffffff', 0), '#000000');
  assert.equal(BM.mix('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(BM.mix('#000000', '#ffffff', 0.5), '#808080');
  assert.deepEqual(BM.parse('#d9b26a'), [217, 178, 106]);
  assert.deepEqual(BM.parse('fff'), [255, 255, 255]);
  assert.equal(BM.fmt([8, 10, 14]), '#080a0e');
  assert.equal(BM.rgba('#080a0e', 0.5), 'rgba(8,10,14,0.5)');
  // clamping, so an out-of-range mix can never emit a malformed colour
  assert.equal(BM.fmt([-20, 300, 128]), '#00ff80');
  // Several tokens and most halos/casings are rgba(). parse() used to read only
  // hex, so anything translucent came back NaN and quietly poisoned the result.
  assert.deepEqual(BM.parse('rgba(13, 27, 42, 0.2)'), [13, 27, 42, 0.2]);
  assert.deepEqual(BM.parse('rgb(1,2,3)'), [1, 2, 3, 1]);
  assert.equal(BM.parse('nonsense'), null, 'junk yields null, never NaN');
  assert.equal(BM.parse(''), null);
  assert.equal(BM.parse(undefined), null);
  assert.equal(BM.over('rgba(255,255,255,0.5)', '#000000'), '#808080', 'alpha compositing');
  assert.equal(BM.over('#ffffff', '#000000'), '#ffffff', 'opaque fg wins');
  assert.match(BM.rgba('nonsense', 0.5), /^rgba\(0,0,0,0\.5\)$/, 'rgba() never emits NaN');
  for (const theme of THEMES) {
    const P = BM.palette(theme);
    for (const k of ['halo', 'casing', 'border', 'borderS', 'path', 'rail']) {
      assert.notEqual(BM.parse(P[k]), null, `${theme}.${k} (${P[k]}) must be parseable`);
    }
  }
});

test('the palettes start from the real zoi-theme.css tokens', () => {
  // If a token is edited in the stylesheet and not here, the map drifts away
  // from the rest of the site. This is the tripwire for that.
  const css = readFileSync(new URL('../../assets/zoi-theme.css', import.meta.url), 'utf8');
  const tokenIn = (block, name) => {
    const b = css.slice(css.indexOf(block));
    const m = new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{3,6})').exec(b.slice(0, 600));
    return m && m[1].toLowerCase();
  };
  const checks = [
    [':root{', 'dark'], ['[data-theme="light"]{', 'light'], ['[data-theme="gold"]{', 'gold'],
  ];
  for (const [block, theme] of checks) {
    for (const key of ['bg', 'tx', 'gold', 'acc']) {
      const inCss = tokenIn(block, key);
      if (!inCss) continue;
      assert.equal(BM.TOKENS[theme][key].toLowerCase(), inCss,
        `${theme} --${key}: basemap has ${BM.TOKENS[theme][key]} but zoi-theme.css has ${inCss}`);
    }
  }
});
