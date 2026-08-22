#!/usr/bin/env node
// zoi.city Wave 1 — API contract tests (zero deps, node >= 18, built-in fetch).
// Needs network. Run: node contract/run.mjs   (or set BASE / ANON env vars)

const BASE = process.env.BASE || 'https://csebihpaychdkanjjsmz.supabase.co';
const ANON = process.env.ANON || 'sb_publishable_BM4ZQtOCUhjg7VqyFGJGRw_eFyTgI4j';

const HDRS = {
  'Content-Type': 'application/json',
  apikey: ANON,
  Authorization: 'Bearer ' + ANON,
};

async function rpc(fn, body = {}) {
  const res = await fetch(`${BASE}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: HDRS,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text === '' ? null : JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

// ---------- tiny assertion kit ----------
class AssertError extends Error {}
function assert(cond, msg) { if (!cond) throw new AssertError(msg); }
function isArr(v) { return Array.isArray(v); }
function isObj(v) { return v !== null && typeof v === 'object' && !isArr(v); }
function hasFields(obj, fields) {
  for (const f of fields) assert(f in obj, `missing field "${f}" in ${JSON.stringify(obj).slice(0, 200)}`);
}
const RANDOM_UUID = '00000000-0000-4000-8000-000000000000';

// A negative RPC call is "cleanly rejected" if it is a 4xx, or a 200 whose body
// is an error envelope ({error:...} / {message:...}) — never a success payload.
function assertRejected(r, label) {
  if (r.status >= 400 && r.status < 500) return;
  assert(r.status < 500, `${label}: server 5xx (status ${r.status})`);
  const j = r.json;
  const errish = isObj(j) && ('error' in j || 'message' in j || 'code' in j || j.ok === false);
  assert(errish, `${label}: expected rejection but got status ${r.status} body ${JSON.stringify(j).slice(0, 200)}`);
}

// ---------- tests ----------
const tests = [];
const t = (name, fn) => tests.push({ name, fn });

// --- explore_search ---
t('explore_search returns a jsonb array', async () => {
  const r = await rpc('explore_search', { p_q: '', p_limit: 5 });
  assert(r.status === 200, `status ${r.status}`);
  assert(isArr(r.json), 'body is not an array');
  assert(r.json.length > 0, 'expected at least one result');
});

t('explore_search rows have the documented shape', async () => {
  const r = await rpc('explore_search', { p_q: '', p_limit: 3 });
  assert(r.status === 200 && isArr(r.json) && r.json.length > 0, 'no rows');
  for (const row of r.json) {
    hasFields(row, ['id', 'slug', 'name', 'entity_type', 'path']);
    assert(typeof row.name === 'string' && row.name.length > 0, 'name not a non-empty string');
    assert(typeof row.path === 'string', 'path not a string');
    assert(typeof row.entity_type === 'string', 'entity_type not a string');
    // documented optional-ish fields must at least exist as keys
    hasFields(row, ['description', 'category', 'city', 'country', 'verification_status', 'rating', 'photo_url', 'claimable']);
  }
});

t('explore_search honors p_limit', async () => {
  const r = await rpc('explore_search', { p_q: '', p_limit: 2 });
  assert(r.status === 200 && isArr(r.json), 'bad response');
  assert(r.json.length <= 2, `p_limit=2 but got ${r.json.length} rows`);
});

t('explore_search p_type filter returns only that type', async () => {
  const r = await rpc('explore_search', { p_q: '', p_type: 'business', p_limit: 10 });
  assert(r.status === 200 && isArr(r.json) && r.json.length > 0, 'no rows');
  for (const row of r.json) assert(row.entity_type === 'business', `got entity_type ${row.entity_type}`);
});

// --- explore_cities / explore_fresh / explore_geo ---
t('explore_cities returns [{city,country,n}] with numeric counts', async () => {
  const r = await rpc('explore_cities', { p_limit: 10 });
  assert(r.status === 200 && isArr(r.json) && r.json.length > 0, 'no rows');
  for (const row of r.json) {
    hasFields(row, ['city', 'country', 'n']);
    assert(Number(row.n) > 0, `n not > 0: ${row.n}`);
  }
});

t('explore_fresh returns an array of listings', async () => {
  const r = await rpc('explore_fresh', { p_limit: 5 });
  assert(r.status === 200, `status ${r.status}`);
  assert(isArr(r.json), 'body is not an array');
});

t('explore_geo rows have numeric lat/lng and shape', async () => {
  const r = await rpc('explore_geo', { p_q: '', p_limit: 10 });
  assert(r.status === 200 && isArr(r.json), 'bad response');
  for (const row of r.json) {
    hasFields(row, ['id', 'name', 'path', 'lat', 'lng', 'entity_type', 'city', 'verified']);
    assert(typeof row.lat === 'number' && typeof row.lng === 'number', 'lat/lng not numbers');
    assert(row.lat >= -90 && row.lat <= 90 && row.lng >= -180 && row.lng <= 180, 'lat/lng out of range');
  }
});

// --- dir_counts / home_stats ---
t('dir_counts returns 12 entity types', async () => {
  const r = await rpc('dir_counts', {});
  assert(r.status === 200 && isArr(r.json), 'bad response');
  assert(r.json.length === 12, `expected 12 types, got ${r.json.length}`);
  for (const row of r.json) hasFields(row, ['entity_type', 'n']);
});

t('dir_counts: business count > 1000 and types are unique', async () => {
  const r = await rpc('dir_counts', {});
  assert(r.status === 200 && isArr(r.json), 'bad response');
  const biz = r.json.find(x => x.entity_type === 'business');
  assert(biz, 'no "business" entity_type');
  assert(Number(biz.n) > 1000, `business count ${biz && biz.n} not > 1000`);
  const types = r.json.map(x => x.entity_type);
  assert(new Set(types).size === types.length, 'duplicate entity_type rows');
});

t('home_stats has numeric listings/cities/countries, listings > 1000', async () => {
  const r = await rpc('home_stats', {});
  assert(r.status === 200 && isObj(r.json), 'bad response');
  hasFields(r.json, ['listings', 'cities', 'countries']);
  for (const k of ['listings', 'cities', 'countries']) assert(Number(r.json[k]) > 0, `${k} not > 0`);
  assert(Number(r.json.listings) > 1000, `listings ${r.json.listings} not > 1000`);
});

// --- feed / community ---
t('feed_list returns an array of posts with ids, honors p_limit', async () => {
  const r = await rpc('feed_list', { p_limit: 5, p_offset: 0 });
  assert(r.status === 200 && isArr(r.json), 'bad response');
  assert(r.json.length <= 5, `p_limit=5 but got ${r.json.length}`);
  for (const p of r.json) assert(p && p.id, 'post missing id');
});

t('feed_get round-trips a post id from feed_list', async () => {
  const list = await rpc('feed_list', { p_limit: 1, p_offset: 0 });
  assert(list.status === 200 && isArr(list.json), 'feed_list failed');
  if (list.json.length === 0) return; // empty feed: nothing to round-trip, still a valid state
  const id = list.json[0].id;
  const r = await rpc('feed_get', { p_id: id });
  assert(r.status === 200, `status ${r.status}`);
  assert(r.json !== null, 'feed_get returned null for a known id');
  const got = isArr(r.json) ? r.json[0] : r.json;
  assert(got && String(got.id) === String(id), 'feed_get id mismatch');
});

t('feed_comments_list with random uuid returns cleanly (no 5xx)', async () => {
  const r = await rpc('feed_comments_list', { p_post: RANDOM_UUID });
  assert(r.status < 500, `server 5xx: ${r.status}`);
  if (r.status === 200) assert(isArr(r.json) ? r.json.length === 0 : true, 'unexpected comments for random uuid');
});

t('community_stats returns a stats object', async () => {
  const r = await rpc('community_stats', {});
  assert(r.status === 200, `status ${r.status}`);
  assert(isObj(r.json) || isArr(r.json), 'body is not object/array');
});

t('community_trending returns an array', async () => {
  const r = await rpc('community_trending', { p_limit: 5 });
  assert(r.status === 200 && isArr(r.json), 'bad response');
  assert(r.json.length <= 5, `p_limit=5 but got ${r.json.length}`);
});

// --- tickets / bio / namedays ---
t('tickets_event_public with random uuid returns null/empty (no 5xx)', async () => {
  const r = await rpc('tickets_event_public', { p_event: RANDOM_UUID });
  assert(r.status < 500, `server 5xx: ${r.status}`);
  if (r.status === 200) {
    const j = r.json;
    const empty = j === null || (isArr(j) && j.length === 0) || (isObj(j) && ('error' in j || Object.keys(j).length === 0));
    assert(empty, `random event uuid returned data: ${JSON.stringify(j).slice(0, 200)}`);
  }
});

t('tickets_types_list with random uuid returns empty (no 5xx)', async () => {
  const r = await rpc('tickets_types_list', { p_event: RANDOM_UUID });
  assert(r.status < 500, `server 5xx: ${r.status}`);
  if (r.status === 200 && isArr(r.json)) assert(r.json.length === 0, 'ticket types for random event');
});

t('bio_get returns null for nonexistent slug', async () => {
  const r = await rpc('bio_get', { p_slug: '__wave1_definitely_not_a_real_slug__' });
  assert(r.status === 200, `status ${r.status}`);
  const j = r.json;
  const empty = j === null || (isArr(j) && j.length === 0) || (isObj(j) && Object.keys(j).length === 0);
  assert(empty, `expected null, got ${JSON.stringify(j).slice(0, 200)}`);
});

t('zoi_namedays_today responds 200 with data', async () => {
  const r = await rpc('zoi_namedays_today', {});
  assert(r.status === 200, `status ${r.status}`);
  assert(r.json !== undefined, 'no body');
});

// --- SECURITY-CRITICAL negative tests ---
t('SECURITY: tickets_reserve with random uuids is cleanly rejected', async () => {
  const r = await rpc('tickets_reserve', { p_event: RANDOM_UUID, p_type: RANDOM_UUID, p_qty: 1, p_name: 'contract-test', p_email: 'test@example.com' });
  assertRejected(r, 'tickets_reserve');
  const body = JSON.stringify(r.json || '').toLowerCase();
  // preferred message per contract; any clean 4xx/error envelope is acceptable, success is not
  if (r.status === 200) assert(body.includes('not found') || body.includes('error'), `unexpected body: ${body.slice(0, 200)}`);
});

t('SECURITY: feed_post without auth is rejected (sign_in_first / 401-ish)', async () => {
  const r = await rpc('feed_post', { p_text: 'contract-test should never be posted', p_body: 'contract-test', p_title: 'contract-test' });
  assertRejected(r, 'feed_post anon');
  const body = JSON.stringify(r.json || '').toLowerCase();
  assert(!body.includes('"created_at"') || body.includes('error'), 'feed_post appears to have created a post anonymously');
});

t('SECURITY: profile_update without auth is rejected', async () => {
  const r = await rpc('profile_update', { p_name: 'contract-test', p_bio: 'contract-test' });
  assertRejected(r, 'profile_update anon');
});

t('SECURITY: zoi tables are NOT exposed via anon REST (GET /rest/v1/listings)', async () => {
  const res = await fetch(`${BASE}/rest/v1/listings?select=*&limit=1`, { headers: HDRS });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { json = text; }
  // Must not return zoi listing rows: acceptable outcomes are 4xx, or an error envelope.
  const returnedRows = res.status === 200 && Array.isArray(json) && json.length > 0;
  assert(!returnedRows, `anon REST returned listing rows! status ${res.status} body ${text.slice(0, 200)}`);
  assert(res.status >= 400 || (json && typeof json === 'object' && !Array.isArray(json) && ('code' in json || 'message' in json)) || (Array.isArray(json) && json.length === 0),
    `unexpected exposure: status ${res.status} body ${text.slice(0, 200)}`);
});

t('SECURITY: REST root schema exposes no zoi tables', async () => {
  const res = await fetch(`${BASE}/rest/v1/`, { headers: HDRS });
  assert(res.status < 500, `server 5xx: ${res.status}`);
  const text = await res.text();
  let paths = [];
  try {
    const spec = JSON.parse(text);
    paths = Object.keys(spec.paths || spec.definitions || {});
  } catch { /* non-JSON root is fine — nothing exposed */ }
  const zoiish = paths.filter(p => /listings|feed_posts|tickets|profiles|bio_pages/.test(p));
  assert(zoiish.length === 0, `zoi-ish tables exposed at REST root: ${zoiish.join(', ')}`);
});

// ---------- runner ----------
(async () => {
  console.log(`# zoi.city contract tests — BASE=${BASE}`);
  console.log(`1..${tests.length}`);
  let failed = 0;
  for (let i = 0; i < tests.length; i++) {
    const { name, fn } = tests[i];
    try {
      await fn();
      console.log(`ok ${i + 1} - ${name}`);
    } catch (e) {
      failed++;
      console.log(`not ok ${i + 1} - ${name}`);
      console.log(`# ${String(e && e.message ? e.message : e).replace(/\n/g, '\n# ')}`);
    }
  }
  console.log(`# ${tests.length - failed}/${tests.length} passed`);
  process.exit(failed === 0 ? 0 : 1);
})();
