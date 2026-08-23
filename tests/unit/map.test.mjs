// The map's geometry is load-bearing — a projection error puts 3,575 real
// places in the wrong country. All of it is pure, so all of it is tested.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../assets/zoi-map.js', import.meta.url), 'utf8');
const g = { getComputedStyle: () => ({ getPropertyValue: () => '' }), document: { documentElement: {} } };
new Function('window', 'globalThis', src)(g, g);
const M = g.ZoiMap;

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} vs ${b}`);

test('Mercator normalisation hits the known anchors', () => {
  near(M.lngToNx(-180), 0, 1e-12, 'lng -180');
  near(M.lngToNx(0), 0.5, 1e-12, 'lng 0');
  near(M.lngToNx(180), 1, 1e-12, 'lng 180');
  near(M.latToNy(0), 0.5, 1e-12, 'equator');
  assert.ok(M.latToNy(85) < 0.01, 'north pole tends to 0');
  assert.ok(M.latToNy(-85) > 0.99, 'south pole tends to 1');
});

test('projection round-trips for real Greek-world coordinates', () => {
  const view = { cx: 0.5, cy: 0.4, z: 5, w: 1200, h: 800 };
  const places = [
    ['Athens', 37.9838, 23.7275],
    ['Thessaloniki', 40.6401, 22.9444],
    ['Melbourne', -37.8136, 144.9631],
    ['Toronto', 43.6532, -79.3832],
    ['New York', 40.7128, -74.006],
    ['Johannesburg', -26.2041, 28.0473],
  ];
  for (const [name, lat, lng] of places) {
    const p = M.project(lng, lat, view);
    const back = M.unproject(p.x, p.y, view);
    near(back.lng, lng, 1e-6, `${name} lng round-trip`);
    near(back.lat, lat, 1e-6, `${name} lat round-trip`);
  }
});

test('relative placement is geographically correct', () => {
  const view = { cx: 0.5, cy: 0.4, z: 3, w: 1000, h: 700 };
  const athens = M.project(23.7275, 37.9838, view);
  const thess = M.project(22.9444, 40.6401, view);
  const melb = M.project(144.9631, -37.8136, view);
  const toronto = M.project(-79.3832, 43.6532, view);
  assert.ok(thess.y < athens.y, 'Thessaloniki is north of Athens');
  assert.ok(thess.x < athens.x, 'Thessaloniki is west of Athens');
  assert.ok(melb.x > athens.x, 'Melbourne is east of Athens');
  assert.ok(melb.y > athens.y, 'Melbourne is south of Athens');
  assert.ok(toronto.x < athens.x, 'Toronto is west of Athens');
});

test('zooming in doubles the pixel distance between two places', () => {
  const base = { cx: 0.5, cy: 0.4, z: 4, w: 800, h: 600 };
  const zoomed = Object.assign({}, base, { z: 5 });
  const d = (v) => {
    const a = M.project(23.7275, 37.9838, v), b = M.project(22.9444, 40.6401, v);
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  near(d(zoomed) / d(base), 2, 1e-9, 'one zoom level = 2x');
});

test('haversine matches known great-circle distances', () => {
  // published distances, ±1.5%
  near(M.haversine(37.9838, 23.7275, 40.6401, 22.9444), 302, 6, 'Athens–Thessaloniki');
  // 14,949.5 km great-circle — cross-checked against the spherical law of
  // cosines. (Published *flight* distances are longer; they include routing.)
  near(M.haversine(37.9838, 23.7275, -37.8136, 144.9631), 14949.5, 5, 'Athens–Melbourne');
  near(M.haversine(37.9838, 23.7275, 43.6532, -79.3832), 8096.5, 5, 'Athens–Toronto');
  near(M.haversine(40.7128, -74.006, 43.6532, -79.3832), 550, 12, 'New York–Toronto');
  assert.equal(M.haversine(10, 10, 10, 10), 0, 'zero distance');
});

test('clustering merges by cell, keeps counts exact, and splits as you zoom', () => {
  // 40 points in a tight cluster + 1 far away
  const pts = [];
  for (let i = 0; i < 40; i++) pts.push({ lng: 23.72 + i * 0.0004, lat: 37.98 + i * 0.0004, entity_type: 'business' });
  pts.push({ lng: -79.38, lat: 43.65, entity_type: 'church' });

  const wide = { cx: 0.5, cy: 0.4, z: 2, w: 900, h: 600 };
  const cw = M.cluster(pts, wide, 46);
  const total = cw.reduce((s, c) => s + c.n, 0);
  assert.equal(total, 41, 'every visible point is counted exactly once');
  assert.ok(cw.some((c) => c.n >= 30), 'the tight group forms one cluster when zoomed out');

  const close = M.fit(pts.slice(0, 40), 900, 600);
  close.z = 17;
  const cc = M.cluster(pts, close, 46);
  assert.ok(cc.length > 5, `zooming in breaks the cluster apart (got ${cc.length})`);
  assert.ok(cc.every((c) => c.items.length <= 12), 'per-cluster sample is capped');
});

test('cluster radius grows with count but stays bounded', () => {
  assert.ok(M.radiusFor(1) < M.radiusFor(10));
  assert.ok(M.radiusFor(10) < M.radiusFor(1000));
  assert.ok(M.radiusFor(100000) <= 15, 'never grows without limit');
  assert.ok(M.radiusFor(900) < M.radiusFor(9) * 3, 'a huge cluster never swamps a small one');
});

test('hit-testing finds the pin under the cursor and misses empty space', () => {
  const pts = [{ lng: 23.7275, lat: 37.9838, entity_type: 'church', name: 'A' }];
  // centre the view on the point — an off-screen point is culled by design
  const view = { cx: M.lngToNx(23.7275), cy: M.latToNy(37.9838), z: 6, w: 800, h: 600 };
  const cs = M.cluster(pts, view, 46);
  assert.equal(cs.length, 1, 'the point is on screen');
  const p = M.project(23.7275, 37.9838, view);
  assert.ok(M.hit(p.x, p.y, cs), 'dead centre hits');
  assert.ok(M.hit(p.x + 4, p.y - 3, cs), 'a few px off still hits');
  assert.equal(M.hit(p.x + 400, p.y + 300, cs), null, 'far away misses');
});

test('fit() frames a set of points inside the viewport', () => {
  const pts = [
    { lng: 23.7275, lat: 37.9838 }, { lng: 22.9444, lat: 40.6401 },
    { lng: 25.1442, lat: 35.3387 },
  ];
  const v = M.fit(pts, 1000, 700);
  for (const p of pts) {
    const q = M.project(p.lng, p.lat, v);
    assert.ok(q.x >= 0 && q.x <= 1000, `x in frame: ${q.x}`);
    assert.ok(q.y >= 0 && q.y <= 700, `y in frame: ${q.y}`);
  }
  const world = M.fit([], 1000, 700);
  assert.ok(world.z > 0, 'an empty set still yields a usable world view');
});

test('the colour wheel only ever mixes adjacent brand anchors', () => {
  const tok = {
    '--gold': [217, 178, 106], '--red': [224, 122, 106],
    '--acc': [110, 168, 255], '--green': [97, 196, 151],
    tx: [243, 246, 250], mut: [139, 149, 163], line: [255, 255, 255],
    card: [20, 26, 34], bg: [8, 10, 14],
  };
  // pure anchors land exactly on the token
  assert.deepEqual(M.colourFor('business', tok), tok['--gold']);
  assert.deepEqual(M.colourFor('artist', tok), tok['--red']);
  assert.deepEqual(M.colourFor('church', tok), tok['--acc']);
  assert.deepEqual(M.colourFor('travel_place', tok), tok['--green']);
  // the six biggest categories must be visually distinct
  const seen = new Set(['business', 'church', 'professional', 'organization', 'creator', 'event']
    .map((t) => M.colourFor(t, tok).join(',')));
  assert.equal(seen.size, 6, 'the six biggest categories get six different colours');
  // an unknown type must not throw
  assert.ok(Array.isArray(M.colourFor('nonsense', tok)));
});

test('colour parsing handles the formats the tokens actually use', () => {
  assert.deepEqual(M.parseColor('#d9b26a'), [217, 178, 106]);
  assert.deepEqual(M.parseColor('#fff'), [255, 255, 255]);
  assert.deepEqual(M.parseColor('rgba(13, 27, 42, 0.2)'), [13, 27, 42]);
  assert.equal(M.parseColor('nonsense'), null);
  assert.equal(M.parseColor(''), null);
});

test('the bundled coastline is well-formed', () => {
  const land = readFileSync(new URL('../../assets/zoi-land.js', import.meta.url), 'utf8');
  const w = {};
  new Function('window', land)(w);
  const rings = w.ZOI_LAND;
  assert.ok(Array.isArray(rings) && rings.length > 50, `expected many rings, got ${rings.length}`);
  let pts = 0;
  for (const r of rings) {
    assert.equal(r.length % 2, 0, 'flat [lng,lat,...] pairs');
    for (let i = 0; i < r.length; i += 2) {
      // longitudes are unwrapped, so a date-line-crossing ring runs past 180
      assert.ok(r[i] >= -540 && r[i] <= 540, `lng plausible: ${r[i]}`);
      assert.ok(Math.abs(r[i] - (i >= 2 ? r[i - 2] : r[i])) <= 180,
        'no date-line jump inside a ring');
      assert.ok(r[i + 1] >= -90.01 && r[i + 1] <= 90.01, `lat in range: ${r[i + 1]}`);
    }
    pts += r.length / 2;
  }
  assert.ok(pts > 3000, `enough detail to read as a world map: ${pts} points`);
});
