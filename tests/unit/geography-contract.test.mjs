import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../supabase/migrations/0039_canonical_geography_contract.sql', import.meta.url), 'utf8');

test('geography contract canonicalizes safe country aliases', () => {
  for (const alias of ['us', 'usa', 'u.s.', 'united states of america', 'uk', 'gb', 'gr', 'el']) {
    assert.match(sql, new RegExp("when ['\\\"]" + alias.replace('.', '\\.') + "['\\\"]", 'i'));
  }
  assert.match(sql, /when 'us' then 'United States'/);
  assert.match(sql, /when 'uk' then 'United Kingdom'/);
});

test('geography aggregates exclude records that cannot produce a valid public path', () => {
  assert.match(sql, /geo_country_canon\(l\.country\) is not null/);
  assert.match(sql, /l\.region is not null/);
  assert.match(sql, /l\.city is not null/);
});

test('search and map return canonical country labels', () => {
  assert.match(sql, /geo_country_canon\(l\.country\) as country/);
  assert.match(sql, /geo_country_canon\(e\.country\)::text/);
});

test('geography migration does not mutate or delete listings', () => {
  assert.doesNotMatch(sql, /\b(update|delete|insert)\s+zoi\.listings\b/i);
});

test('search keeps ranking metadata out of the public JSON shape', () => {
  assert.match(sql, /select id, slug, name, description, category, entity_type, city, country,/);
  assert.match(sql, /l\.trust_score,\s*\n\s*row_number\(\)/);
  assert.match(sql, /order by \(verification_status='verified'\) desc, trust_score desc nulls last, name, id/);
  assert.doesNotMatch(sql, /select \*\s*\n\s*from \(/);
});

test('enrichment control plane leases work and exposes completeness without inventing data', () => {
  const control = readFileSync(new URL('../../supabase/migrations/0040_enrichment_control_plane.sql', import.meta.url), 'utf8');
  assert.match(control, /FOR UPDATE SKIP LOCKED/i);
  assert.match(control, /enrich_queue_lease/);
  assert.match(control, /profile_completeness/);
  assert.match(control, /listing_completeness/);
  assert.match(control, /status.*coalesce\(r -> 'profile' ->> 'crawl_status', 'ok'\)/s);
  assert.match(control, /provenance.*l\.profile -> '_enrich' -> 'provenance'/s);
});
