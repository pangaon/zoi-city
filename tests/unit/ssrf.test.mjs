// Guards on the enrichment worker's security properties, asserted from the Node
// suite so CI catches a regression without needing a Deno toolchain. The
// behavioural tests live in supabase/functions/zoi-enrich/_ssrf_test.ts and are
// run with `deno test`; these are the invariants that must never be edited away.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dir = new URL('../../supabase/functions/zoi-enrich/', import.meta.url);
const guard = readFileSync(new URL('_ssrf.ts', dir), 'utf8');
const worker = readFileSync(new URL('index.ts', dir), 'utf8');
const tests = readFileSync(new URL('_ssrf_test.ts', dir), 'utf8');

test('every dangerous IPv4 range is still in the block list', () => {
  // intake-audit was stubbed over exactly this. Deleting a line here reopens it.
  for (const cidr of [
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
    ['169.254.0.0', 16],   // cloud instance metadata lives here
    ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16],
    ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
  ]) {
    const re = new RegExp(`\\["${cidr[0].replace(/\./g, '\\.')}",\\s*${cidr[1]}\\]`);
    assert.match(guard, re, `${cidr[0]}/${cidr[1]} must stay blocked`);
  }
});

test('IPv6 loopback, ULA, link-local, multicast and NAT64 are still handled', () => {
  for (const marker of ['::1', 'f[cd]', 'fe[89ab]', '^ff', '2001:db8', '64:ff9b', 'fd00:ec2']) {
    assert.ok(guard.includes(marker), `IPv6 rule for ${marker} is missing`);
  }
  // The IPv4-mapped case is the one people forget: ::ffff:127.0.0.1
  assert.match(guard, /ffff:/, 'IPv4-mapped IPv6 must be normalised before checking');
  assert.match(guard, /return blockedV4\(mapped\[1\]\)/,
    'a mapped address must be judged by the IPv4 rules');
});

test('reserved and internal hostnames are still refused', () => {
  for (const n of ['localhost', 'metadata.google.internal', '169.254.169.254']) {
    assert.ok(guard.includes(`"${n}"`), `${n} must stay in RESERVED_NAMES`);
  }
  for (const s of ['.local', '.internal', '.lan', '.home.arpa', '.onion']) {
    assert.ok(guard.includes(`"${s}"`), `${s} must stay in RESERVED_SUFFIX`);
  }
});

test('URL vetting still rejects the whole class of bad inputs', () => {
  for (const [check, why] of [
    ['credentials-in-url', 'user:pass@ must be refused'],
    ['ip-literal-v4', 'IP literals must be refused'],
    ['ip-literal-v6', 'bracketed IPv6 must be refused'],
    ['no-dot-in-host', 'single-label hosts must be refused'],
    ['reserved-name', 'reserved names must be refused'],
    ['reserved-tld', 'reserved suffixes must be refused'],
  ]) {
    assert.ok(guard.includes(check), why);
  }
  assert.match(guard, /protocol !== "https:" && u\.protocol !== "http:"/,
    'only http and https may be fetched');
  assert.match(guard, /u\.port !== "80" && u\.port !== "443"/,
    'only the standard web ports may be fetched');
});

test('redirects are followed by hand and every hop is re-vetted', () => {
  // Following redirects automatically is how a guarded fetcher still ends up at
  // the metadata service.
  assert.match(worker, /redirect: "manual"/, 'fetch must not auto-follow redirects');
  assert.match(worker, /const v = await vet\(next\.toString\(\)\)/,
    'each redirect hop must be re-vetted');
  assert.match(worker, /MAX_HOPS/, 'redirect depth must be bounded');
});

test('the worker can never be handed a URL by a caller', () => {
  // This single property is what makes the replacement safe where intake-audit
  // was not. URLs come from zoi.enrich_queue, which returns each listing's own
  // registered website.
  assert.match(worker, /enrich_queue/, 'the queue must be the source of URLs');
  const body = worker.slice(worker.indexOf('await req.json()'), worker.indexOf('const started'));
  assert.ok(/b\.limit/.test(body), 'the body should be read for a limit');
  for (const forbidden of ['url', 'website', 'href', 'target', 'host']) {
    assert.ok(!new RegExp(`b\\.${forbidden}\\b`).test(body),
      `the request body must never supply "${forbidden}"`);
  }
});

test('the fetch is bounded in time and size, and HTML only', () => {
  assert.match(worker, /TIMEOUT_MS\s*=\s*\d+/, 'a hard timeout is required');
  assert.match(worker, /MAX_BYTES\s*=\s*[\d_]+/, 'a byte cap is required');
  assert.match(worker, /total > MAX_BYTES/, 'the cap must be enforced while streaming');
  assert.match(worker, /AbortController/, 'the timeout must actually abort the request');
  assert.match(worker, /html\|xml/, 'only HTML responses may be parsed');
});

test('it fails closed and stays polite', () => {
  assert.match(worker, /if \(!ENABLED\)/, 'no kill switch means no run');
  assert.match(worker, /status: 503/, 'a disabled worker must say so, not run anyway');
  assert.match(worker, /robotsAllows/, 'robots.txt must be honoured');
  assert.match(worker, /perHost/, 'requests to one host must be serialised');
  assert.match(worker, /globalGap/, 'there must be a global rate limit');
  assert.match(worker, /ZoiDirectoryBot/, 'the crawler must identify itself');
  assert.match(worker, /contact/i, 'the User-Agent must carry a contact');
});

test('machine data is written only into its own namespace', () => {
  // Enrichment must never be able to overwrite what an owner typed.
  assert.match(worker, /enrich_apply/, 'writes must go through the audited RPC');
  assert.ok(!/bizpage_save\b/.test(worker),
    'the worker must not touch the owner-facing writer');
  const mig = readFileSync(
    new URL('../../supabase/migrations/0003_profile_writable.sql', import.meta.url), 'utf8');
  assert.match(mig, /'_enrich',/, 'enrichment lands under _enrich');
  assert.match(mig, /REVOKE ALL ON FUNCTION zoi\.enrich_apply/,
    'enrich_apply must not be callable by anon or authenticated');
});

test('the behavioural test file still covers the attacks that matter', () => {
  for (const attack of ['169.254.169.254', '::ffff:127.0.0.1', 'localtest.me',
                        'file:///etc/passwd', 'user:pass@']) {
    assert.ok(tests.includes(attack), `the Deno tests must still cover ${attack}`);
  }
});

test('the worker authenticates its caller rather than trusting a deploy flag', () => {
  // Deployed with --no-verify-jwt this would otherwise be an open crawl trigger:
  // anyone could make us fetch other people's sites from our address, under our
  // User-Agent, as often as they liked.
  assert.match(worker, /function authorised\(req: Request\)/, 'there must be a caller check');
  assert.match(worker, /if \(!authorised\(req\)\)/, 'and it must run before anything else');
  assert.match(worker, /status: 401/, 'an unauthorised caller gets 401');
  assert.match(worker, /timingSafeEqual/, 'the token compare must not short-circuit');
  // The check must come before the queue is ever read. Compare against the
  // actual call site, not the mention of enrich_queue in the header comment.
  const call = worker.indexOf('sbRpc("enrich_queue"');
  const check = worker.indexOf('if (!authorised(req))');
  assert.ok(call > 0 && check > 0, 'both the check and the call must exist');
  assert.ok(check < call, 'authentication must precede any work');
});
