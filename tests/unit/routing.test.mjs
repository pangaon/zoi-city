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
  const files = readdirSync(join(ROOT, 'api')).filter((f) => f.endsWith('.js'));
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
  for (const f of readdirSync(join(ROOT, 'api')).filter((x) => x.endsWith('.js'))) {
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
  const missing = ENTITY_TYPES.filter((t) => !sources.has(`/${t}/:slug`));
  assert.deepEqual(
    missing, [],
    `these entity types would 404 on every listing: ${missing.join(', ')}`,
  );
  assert.ok(sources.has('/p/:slug'), 'the canonical /p/:slug route must stay');
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
