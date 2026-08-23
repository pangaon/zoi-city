// The hero globe draws the bundled coastline as GeoJSON rather than loading
// tiles. That makes one transformation load-bearing: zoi-land.js stores
// UNWRAPPED longitudes (some run past 180) and they have to be folded back into
// range without destroying the polygons. A first version folded by each ring's
// maximum instead of its midpoint, which moved all of Afro-Eurasia a full turn
// out of range where clamping collapsed it onto the antimeridian — the globe
// rendered as an empty blue ball and nothing threw. Hence point-in-polygon
// tests against real places.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const spec = require('../vendor/maplibre-style-spec.cjs');

const g = {
  document: { documentElement: { getAttribute: () => 'dark' } },
  matchMedia: () => ({ matches: false }),
};
const load = (f) => new Function('window', 'globalThis',
  readFileSync(new URL(f, import.meta.url), 'utf8'))(g, g);
load('../../assets/zoi-land.js');
load('../../assets/zoi-basemap.js');
load('../../assets/zoi-globe.js');
load('../../assets/zoi-cities.js');
const G = g.ZoiGlobe;

const polys = G.landGeoJSON().features[0].geometry.coordinates;

function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}
const onLand = (pt) => polys.some((p) => inRing(pt, p[0]));

test('the coastline actually covers the continents', () => {
  assert.ok(polys.length > 50, `expected many polygons, got ${polys.length}`);
  // every coordinate must be inside the legal GeoJSON range
  for (const p of polys) {
    for (const c of p[0]) {
      assert.ok(c[0] >= -180 && c[0] <= 180, `longitude out of range: ${c[0]}`);
      assert.ok(c[1] >= -90 && c[1] <= 90, `latitude out of range: ${c[1]}`);
    }
    assert.ok(p[0].length >= 4, 'a ring needs at least four points');
    assert.deepEqual(p[0][0], p[0][p[0].length - 1], 'rings must be closed');
  }
  // Afro-Eurasia must still be one huge landmass, not a sliver at the edge
  const spans = polys.map((p) => {
    const xs = p[0].map((c) => c[0]), ys = p[0].map((c) => c[1]);
    return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  });
  const biggest = spans.reduce((a, b) => (a.w * a.h > b.w * b.h ? a : b));
  assert.ok(biggest.w > 150, `the largest landmass spans only ${biggest.w.toFixed(1)} deg of longitude`);
  assert.ok(biggest.h > 100, `the largest landmass spans only ${biggest.h.toFixed(1)} deg of latitude`);
});

test('real places land on land, and open ocean stays sea', () => {
  const cases = [
    ['Athens', 23.7275, 37.9838, true],
    ['Thessaloniki', 22.9444, 40.6401, true],
    ['Cairo', 31.2357, 30.0444, true],
    ['Beijing', 116.4074, 39.9042, true],
    ['Toronto', -79.3832, 43.6532, true],
    ['Chicago', -87.6298, 41.8781, true],
    ['Melbourne', 144.9631, -37.8136, true],
    ['Johannesburg', 28.0473, -26.2041, true],
    ['SaoPaulo', -46.6333, -23.5505, true],
    ['mid-Atlantic', -30, 0, false],
    ['mid-Pacific', -150, 0, false],
    ['Indian Ocean', 75, -30, false],
    ['Southern Ocean', 0, -60, false],
  ];
  for (const [name, lng, lat, want] of cases) {
    assert.equal(onLand([lng, lat]), want, `${name} should be ${want ? 'land' : 'sea'}`);
  }
});

test('great-circle arcs follow the sphere, not a straight line on a flat map', () => {
  const [a, b] = [G.ATHENS, [-79.3832, 43.6532]];   // Athens -> Toronto
  const arc = G.greatCircle(a, b, 40);
  assert.equal(arc.length, 41, 'steps+1 points');
  assert.deepEqual(arc[0].map((v) => +v.toFixed(4)), a.map((v) => +v.toFixed(4)));
  assert.deepEqual(arc[arc.length - 1].map((v) => +v.toFixed(3)), b.map((v) => +v.toFixed(3)));
  // A great circle between two northern cities bows toward the pole. A naive
  // linear interpolation would sit on the average latitude.
  const mid = arc[20][1], naive = (a[1] + b[1]) / 2;
  assert.ok(mid > naive + 8, `arc should bow north: ${mid.toFixed(1)} vs ${naive.toFixed(1)}`);
  // and never leave the sphere
  for (const p of arc) {
    assert.ok(p[0] >= -180.001 && p[0] <= 180.001, `arc longitude ${p[0]}`);
    assert.ok(p[1] >= -90 && p[1] <= 90, `arc latitude ${p[1]}`);
  }
  // degenerate case: same point in and out
  const same = G.greatCircle(a, a.slice(), 10);
  assert.ok(same.length >= 2, 'identical endpoints still yield a usable line');
});

test('the graticule is a closed set of meridians and parallels', () => {
  const gr = G.graticule(30);
  assert.equal(gr.type, 'FeatureCollection');
  assert.equal(gr.features.length, 12 + 5, '12 meridians at 30deg, 5 parallels from -60 to 60');
  for (const f of gr.features) {
    assert.equal(f.geometry.type, 'LineString');
    for (const c of f.geometry.coordinates) {
      assert.ok(c[0] >= -180 && c[0] <= 180);
      assert.ok(c[1] >= -90 && c[1] <= 90);
    }
  }
});

test('the globe style is valid and needs no external source at all', () => {
  for (const theme of ['dark', 'light', 'gold']) {
    g.document.documentElement.getAttribute = () => theme;
    const s = G.style(G.palette());
    const errs = spec.validateStyleMin(s);
    assert.equal(errs.length, 0, `${theme}: ${errs.map((e) => e.message).join('; ')}`);
    // the whole point of this hero: no tiles, no glyphs, no sprite
    for (const [id, src] of Object.entries(s.sources)) {
      assert.equal(src.type, 'geojson', `source ${id} must be inline geojson, got ${src.type}`);
    }
    assert.equal(s.glyphs, undefined, 'no glyph server: the globe carries no labels');
    assert.equal(s.sprite, undefined, 'no sprite server');
    assert.deepEqual(s.projection, { type: 'globe' });
  }
  g.document.documentElement.getAttribute = () => 'dark';
});

test('the gazetteer carries coordinates and weights but never counts', () => {
  const C = g.ZOI_CITIES;
  assert.ok(Array.isArray(C) && C.length > 100, `expected a real gazetteer, got ${C && C.length}`);
  for (const row of C) {
    assert.equal(row.length, 5, 'exactly [city, country, lat, lng, weight] — no count field');
    const [city, country, lat, lng, w] = row;
    assert.ok(city && typeof city === 'string');
    assert.ok(typeof country === 'string');
    assert.ok(lat >= -90 && lat <= 90, `${city} latitude ${lat}`);
    assert.ok(lng >= -180 && lng <= 180, `${city} longitude ${lng}`);
    assert.ok(w > 0 && w <= 1, `${city} weight ${w} must be a 0..1 ratio, not a count`);
  }
  // weights are ordered, so the arcs read as a hierarchy
  assert.equal(C[0][4], 1, 'the largest community is the reference weight');
  assert.ok(C[0][4] >= C[C.length - 1][4], 'weights descend');
  // no duplicated cities, which would double-draw an arc
  const keys = C.map((r) => (r[0] + '|' + r[1]).toLowerCase());
  assert.equal(new Set(keys).size, keys.length, 'no duplicate city/country pairs');
  // and the cities really are on land
  const off = C.slice(0, 60).filter((r) => !onLand([r[3], r[2]]));
  assert.ok(off.length <= 6,
    `too many of the largest communities fall in the sea: ${off.map((r) => r[0]).join(', ')}`);
});

test('cityData() shapes the gazetteer for the renderer without inventing numbers', () => {
  const d = G.cityData(10);
  assert.equal(d.length, 10);
  for (const c of d) {
    assert.ok(typeof c.name === 'string' && c.name);
    assert.ok(isFinite(c.lat) && isFinite(c.lng));
    assert.ok(c.n > 0 && c.n <= 1, 'n is a normalised weight, never a listing count');
  }
  assert.ok(G.cityData(0).length > 10, 'no limit means the whole gazetteer');
});
