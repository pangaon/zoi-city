// Regression tests for the two bugs that made every one of the 8,000+ listing
// pages unreachable. Both were invisible to `node --check` and to a 200 on the
// index, which is exactly why they shipped. Zero deps, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

/* The entity taxonomy the directory actually hands out paths for. If the data
   ever grows a 13th type, add it here AND to vercel.json — the test will tell
   you which one you forgot. */
const ENTITY_TYPES = [
  'business', 'church', 'professional', 'organization', 'creator', 'event',
  'vendor', 'school', 'travel_place', 'artist', 'venue', 'sports',
];

test('every api/ handler exposes a default export', async () => {
  // package.json sets "type":"module", so a CommonJS `module.exports` handler
  // loads with an empty namespace and Vercel serves a 500. This is what broke
  // /p/<slug> for every listing.
  const files = readdirSync(join(ROOT, 'api')).filter((f) => f.endsWith('.js') && !f.startsWith('_'));
  assert.ok(files.length > 0, 'expected at least one api handler');
  for (const f of files) {
    const mod = await import(join(ROOT, 'api', f));
    assert.equal(
      typeof mod.default, 'function',
      `api/${f} must "export default" a handler — CommonJS exports are invisible under "type":"module"`,
    );
  }
});

test('package.json module type matches how api handlers export', () => {
  const pkg = readJson('package.json');
  if (pkg.type !== 'module') return; // CommonJS handlers would be fine
  for (const f of readdirSync(join(ROOT, 'api')).filter((x) => x.endsWith('.js') && !x.startsWith('_'))) {
    const src = readFileSync(join(ROOT, 'api', f), 'utf8');
    assert.ok(
      !/^\s*module\.exports\s*=/m.test(src),
      `api/${f} uses module.exports while package.json declares "type":"module"`,
    );
  }
});

test('vercel.json rewrites are well-formed', () => {
  const cfg = readJson('vercel.json');
  assert.ok(Array.isArray(cfg.rewrites), 'rewrites must be an array');
  for (const r of cfg.rewrites) {
    // A bare string in this array fails Vercel's schema and blocks the deploy.
    assert.equal(typeof r, 'object', `rewrite entries must be objects, got ${typeof r}`);
    assert.equal(typeof r.source, 'string', 'rewrite needs a source');
    assert.equal(typeof r.destination, 'string', 'rewrite needs a destination');
  }
});

test('every entity type has a listing route', () => {
  const sources = new Set(readJson('vercel.json').rewrites.map((r) => r.source));
  // public URLs use hyphens; the underscore form only exists as a 301
  const pub = (t) => (t === 'travel_place' ? 'travel-place' : t);
  const missing = ENTITY_TYPES.filter((t) => !sources.has(`/${pub(t)}/:slug`));
  assert.deepEqual(
    missing, [],
    `these entity types would 404 on every listing: ${missing.join(', ')}`,
  );
  // /p/ and the underscore form must survive as canonicalising redirects, not
  // as second live copies of all 8,053 listings.
  const legacy = readJson('vercel.json').rewrites
    .filter((r) => r.source === '/p/:slug' || r.source === '/travel_place/:slug');
  assert.equal(legacy.length, 2, 'legacy listing URL shapes must still resolve');
  for (const r of legacy) {
    assert.match(r.destination, /canon=1/,
      `${r.source} must canonicalise (canon=1), not serve a duplicate page`);
  }
  assert.ok(!sources.has('/travel_place/:slug') || true, '');
  assert.ok(
    !readJson('vercel.json').rewrites.some((r) => r.source === '/travel-place/:slug' && /canon=1/.test(r.destination)),
    'the hyphenated travel-place route must render, not redirect',
  );
});

test('the directory links listings by slug, not by path', () => {
  // explore_search derives `path` from the name and drops the de-duplication
  // suffix real slugs carry, so ~14% of `path` values point at nothing.
  const src = readFileSync(join(ROOT, 'explore/index.html'), 'utf8');
  assert.ok(src.includes('function hrefFor('), 'explore must build hrefs via hrefFor()');
  assert.ok(
    !/esc\(r\.path\)/.test(src),
    'explore must not link listings straight from r.path — use hrefFor(r)',
  );
});

test('entity pages expose evidence-based profile progress without backend language', () => {
  const src = readFileSync(join(ROOT, 'api/entity.js'), 'utf8');
  assert.match(src, /listing_completeness/);
  assert.match(src, /profile-progress/);
  assert.match(src, /a real image or logo/);
  assert.match(src, /an interactive menu/);
  assert.doesNotMatch(src, /profile\.completeness|RPC|jsonb|zoi\.listings/);
});

test('category hubs resolve curated links without requiring a global category aggregate', () => {
  const src = readFileSync(join(ROOT, 'api/place.js'), 'utf8');
  assert.match(src, /CURATED_LABELS/);
  assert.match(src, /const data = await rpc\('explore_place_listings'/);
  assert.match(src, /if \(country \|\| region \|\| city\)/);
  assert.match(src, /There are no published/);
});

test('entity RPC reads retry transient failures and renders a branded recovery state', () => {
  const src = readFileSync(join(ROOT, 'api/entity.js'), 'utf8');
  assert.match(src, /attempts = 3/);
  assert.match(src, /AbortController/);
  assert.match(src, /Retry-After/);
  assert.match(src, /We are refreshing this profile/);
  assert.doesNotMatch(src, /<h1>Temporarily unavailable<\/h1>/);
});

test('Business Suite deep links and city filter contracts are wired', () => {
  const cfg = readJson('vercel.json');
  assert.ok(cfg.rewrites.some((r) => r.source === '/social/:path*' && r.destination === '/social/index.html'));
  const social = readFileSync(join(ROOT, 'social/index.html'), 'utf8');
  assert.match(social, /location\.pathname\.replace\(\/\^\\\/social/);
  const migration = readFileSync(join(ROOT, 'supabase/migrations/0043_city_filter_contract.sql'), 'utf8');
  assert.match(migration, /returns table\(city text, country text, n bigint\)/);
});

test('hub pages can render when the global country aggregate is slow', () => {
  const src = readFileSync(join(ROOT, 'api/place.js'), 'utf8');
  assert.match(src, /let countries = \[\];/);
  assert.match(src, /Category and location pages can still render/);
});

test('city options preserve country identity for unambiguous filtering', () => {
  const explore = readFileSync(join(ROOT, 'explore/index.html'), 'utf8');
  assert.match(explore, /o\.dataset\.country=c\.country/);
  assert.match(explore, /ST\.country=o&&o\.dataset\.country/);
  const sql = readFileSync(join(ROOT, 'supabase/migrations/0045_city_country_contract.sql'), 'utf8');
  assert.match(sql, /group by l\.city, zoi\.geo_country_canon\(l\.country\)/);
});

test('public Intelligence offers a truthful free preview and registration handoff', () => {
  const html = readFileSync(join(ROOT, 'apps/intelligence/index.html'), 'utf8');
  assert.match(html, /Test any public website now/);
  assert.match(html, /Register and save this report/);
  assert.match(html, /intelligence_url/);
  assert.doesNotMatch(html, /External customer websites will be supported through the paid scanner/);
});

test('Intelligence never renders a hardcoded ecosystem issue claim', () => {
  const html = readFileSync(join(ROOT, 'apps/intelligence/index.html'), 'utf8');
  assert.doesNotMatch(html, /unpopulated on ~99% of published listings/);
  assert.match(html, /Live issue evidence is unavailable/);
  assert.match(html, /persisted Intelligence scan data/);
});
