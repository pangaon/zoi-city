// Self-serve intake accepts a URL typed by a member of the public and causes a
// server to fetch it. That is the exact shape that got intake-audit stubbed, so
// these tests exist to hold the line that makes it safe: the URL is written to
// the database first, and the crawler still reads its targets from the database.
//
// If someone later "simplifies" this by passing the URL to the worker directly,
// these fail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../supabase/migrations/0038_self_serve_intake.sql', import.meta.url), 'utf8');
const page = readFileSync(new URL('../../add/index.html', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../../supabase/functions/zoi-enrich/index.ts', import.meta.url), 'utf8');
const queue = readFileSync(new URL('../../supabase/migrations/0005_enrich_queue_and_noop_guard.sql', import.meta.url), 'utf8');

/* ---------- the invariant ---------- */

test('the crawler still takes its targets from the database, not from a caller', () => {
  // The whole safety argument rests on this sentence staying true.
  assert.ok(/NO URL IS EVER ACCEPTED FROM A CALLER/.test(worker),
    'the worker no longer declares the no-caller-URL invariant');
  assert.ok(/enrich_queue/.test(worker), 'the worker no longer reads the queue');
});

test('the queue still returns each listing own registered website', () => {
  assert.ok(/SELECT l\.slug, l\.website/.test(queue), 'queue shape changed');
  assert.ok(/FROM zoi\.listings/.test(queue), 'queue no longer sourced from listings');
});

test('intake writes the url to the database rather than handing it to a fetcher', () => {
  assert.ok(/INSERT INTO zoi\.listings/.test(sql), 'intake does not persist the listing');
  // No HTTP from inside the database.
  assert.ok(!/\bhttp_get\b|\bpg_net\b|\bnet\.http/.test(sql),
    'the migration performs its own fetch — the URL must reach the vetted worker instead');
});

/* ---------- abuse controls ---------- */

test('anonymous callers cannot aim the crawler', () => {
  assert.ok(/auth\.uid\(\)/.test(sql), 'no caller identity check');
  assert.ok(/'auth_required'/.test(sql), 'missing auth refusal');
  assert.ok(/REVOKE ALL ON FUNCTION public\.intake_submit[\s\S]{0,80}FROM public, anon/.test(sql),
    'intake_submit is not revoked from anon');
  assert.ok(/GRANT EXECUTE ON FUNCTION public\.intake_submit[\s\S]{0,60}TO authenticated/.test(sql),
    'intake_submit is not granted to authenticated');
});

test('submissions are rate limited per account', () => {
  assert.ok(/rate_limited/.test(sql), 'no rate limit refusal');
  assert.ok(/v_recent >= 5/.test(sql), 'the five-a-day cap is gone');
});

test('one listing per domain, so intake cannot shadow an existing business', () => {
  assert.ok(/already_listed/.test(sql), 'duplicate domains are not detected');
  assert.ok(/registrable_host\(l\.website\) = v_reg/.test(sql), 'no domain comparison');
});

/* ---------- url refusals, mirrored in sql and in the page ---------- */

test('the migration refuses the addresses the crawler would refuse', () => {
  for (const refusal of ['credentials_in_url', 'ip_literal', 'reserved_host', 'invalid_host']) {
    assert.ok(sql.includes(`'${refusal}'`), `missing refusal: ${refusal}`);
  }
});

test('the reserved-host pattern covers the names that resolve inward', () => {
  const m = sql.match(/v_host ~\* '([^']+)'/);
  assert.ok(m, 'no reserved-host pattern');
  const re = new RegExp(m[1], 'i');
  for (const host of ['localhost', 'foo.internal', 'box.lan', 'a.local', 'x.corp', 'y.test']) {
    assert.ok(re.test(host), `${host} should be refused`);
  }
  for (const host of ['mythos.gr', 'taverna.com.au', 'example-taverna.co.uk']) {
    assert.ok(!re.test(host), `${host} should be allowed`);
  }
});

test('the page refuses the same shapes before spending a round trip', () => {
  const body = page.slice(page.indexOf('function localRefusal'), page.indexOf('function panel'));
  assert.ok(/\\d\{1,3\}/.test(body) || /IP address/.test(body), 'no IP literal check client-side');
  assert.ok(/localhost/.test(body), 'no reserved host check client-side');
});

/* ---------- nothing is published or verified by a successful crawl ---------- */

test('an intake row is a draft and is unverified', () => {
  assert.ok(/'draft'/.test(sql), 'intake rows are not drafts');
  assert.ok(/'unverified'/.test(sql), 'intake rows are not unverified');
  assert.ok(!/'published'/.test(sql), 'the migration publishes something');
  assert.ok(!/owner_verified|source_verified|admin_verified/.test(sql),
    'intake grants a verification state it has not earned');
});

test('the page does not promise verification for a fetch', () => {
  assert.ok(/does not prove you own the business|not that it is yours/i.test(page),
    'the page fails to separate a successful fetch from ownership');
  assert.ok(/Draft · unverified|Draft &middot; unverified/.test(page),
    'the result is not labelled as an unverified draft');
});

/* ---------- provenance ---------- */

test('intake records who submitted what, and when', () => {
  for (const key of ['submitted_by', 'submitted_at', 'submitted_website', 'source']) {
    assert.ok(sql.includes(key), `provenance field missing: ${key}`);
  }
  assert.ok(/_intake/.test(sql), 'intake provenance is not namespaced');
});

test('machine-read values stay in their own namespace', () => {
  // _enrich is the crawler's namespace; owner-typed values must never be there.
  assert.ok(/_enrich/.test(sql), 'intake_status does not read the enrich namespace');
  assert.ok(/profile -> '_enrich'/.test(sql), 'enrich data read from the wrong place');
});

test('the confirmation screen shows where each value came from', () => {
  assert.ok(/from ' \+ esc\(via\)|class="prov"/.test(page),
    'fields render without provenance');
});

test('a crawl failure is shown, not swallowed', () => {
  assert.ok(/could not read that page/i.test(page), 'no failure state for the user');
  assert.ok(/en\.status/.test(page), 'crawl status is never inspected');
});

/* ---------- scoping ---------- */

test('a submitter can only read their own draft', () => {
  const fn = sql.slice(sql.indexOf('FUNCTION public.intake_status'));
  assert.ok(/submitted_by' = auth\.uid\(\)::text/.test(fn),
    'intake_status is not scoped to the submitter');
  assert.ok(/REVOKE ALL ON FUNCTION public\.intake_status[\s\S]{0,80}FROM public, anon/.test(sql),
    'intake_status is readable by anon');
});

/* ---------- the rebinding blast radius ----------
 * Intake lets a stranger choose which host the crawler resolves, which is
 * exactly the input DNS rebinding needs. These hold the containment. */

test('intake_status returns a fixed projection, never the raw enrich blob', () => {
  const fn = sql.slice(sql.indexOf('FUNCTION public.intake_status'));
  // Returning profile->'_enrich' wholesale would make the product the read-back
  // channel for whatever a rebound fetch landed on.
  assert.ok(!/'enrich', coalesce\(l\.profile -> '_enrich'/.test(fn),
    'intake_status hands back the whole enrich namespace');
  assert.ok(/unnest\(ARRAY\[/.test(fn), 'no field allowlist');
  for (const f of ['name', 'phone', 'street', 'hours']) {
    assert.ok(fn.includes(`'${f}'`), `allowlist missing an expected field: ${f}`);
  }
});

test('returned values are length capped', () => {
  const fn = sql.slice(sql.indexOf('FUNCTION public.intake_status'));
  assert.ok(/left\(/.test(fn), 'values are returned uncapped');
});

test('the crawl outcome is reported without the page body', () => {
  const fn = sql.slice(sql.indexOf('FUNCTION public.intake_status'));
  for (const k of ['checked_at', 'status', 'source_url']) {
    assert.ok(fn.includes(k), `crawl outcome missing: ${k}`);
  }
  assert.ok(!/'body'|'html'|'raw'/.test(fn), 'the response body is exposed');
});

test('the worker no longer claims the queue holds only owner-supplied domains', () => {
  // That sentence was the justification for tolerating rebinding. Intake made it
  // false, and a safety comment that is quietly wrong is worse than none. The
  // phrase may still appear, but only as a quotation marked historical.
  const claim = /queue only ever contains domains an authenticated owner/;
  if (claim.test(worker)) {
    assert.ok(/used to end "and the queue only ever contains/.test(worker),
      'the worker still states the pre-intake assumption as current');
  }
  assert.ok(/intake_submit now lets any signed-in/.test(worker),
    'the worker does not record that intake widened the risk');
  assert.ok(/network egress[\s/]*control/i.test(worker),
    'the worker does not name the actual fix');
  assert.ok(/does NOT rule out an internal service that serves HTML/.test(worker),
    'the worker overstates what the content-type gate buys');
});
