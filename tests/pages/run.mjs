#!/usr/bin/env node
// zoi.city Wave 1 — page invariant tests (zero deps, node >= 18, built-in fetch).
// Needs network. Run: node pages/run.mjs   (override host with SITE env var)

const SITE = (process.env.SITE || 'https://www.zoi.city').replace(/\/$/, '');

function count(html, re) {
  const m = html.match(re);
  return m ? m.length : 0;
}

class AssertError extends Error {}
function assert(cond, msg) { if (!cond) throw new AssertError(msg); }

// Invariants applied to every page.
function commonChecks(page, status, html) {
  assert(status === 200, `${page}: status ${status}`);
  const heads = count(html, /<head[\s>]/gi);
  assert(heads === 1, `${page}: expected exactly one <head>, found ${heads}`);
  const titles = count(html, /<title[\s>]/gi);
  assert(titles === 1, `${page}: expected exactly one <title>, found ${titles}`);
  assert(/<meta[^>]+name=["']viewport["']/i.test(html), `${page}: missing meta viewport`);
}

const PAGES = [
  {
    path: '/',
    extra: () => {},
  },
  {
    path: '/explore',
    extra: () => {},
  },
  {
    path: '/community',
    extra: () => {},
  },
  {
    path: '/tickets',
    extra: (html) => {
      assert(html.includes('online payment is being enabled'),
        '/tickets: missing "online payment is being enabled"');
      assert(!html.includes('payment comes later.'),
        '/tickets: stale copy "payment comes later." still present');
    },
  },
  {
    path: '/social',
    extra: (html) => {
      const fnStart = html.indexOf('function switchWorkspace');
      assert(fnStart !== -1, '/social: switchWorkspace function not found');
      const slice = html.slice(fnStart, fnStart + 2000);
      assert(slice.includes('location.reload(); }'),
        '/social: "location.reload(); }" not found inside switchWorkspace');
    },
  },
  {
    path: '/explore/app/',
    extra: (html) => {
      assert(/noindex/i.test(html), '/explore/app/: missing noindex');
      assert(html.includes('Classic prototype'), '/explore/app/: missing "Classic prototype" label');
    },
  },
];

async function fetchPage(path) {
  const res = await fetch(SITE + path, {
    redirect: 'follow',
    headers: { 'User-Agent': 'zoi-wave1-page-tests/1.0 (+node)' },
  });
  const html = await res.text();
  return { status: res.status, html };
}

(async () => {
  console.log(`# zoi.city page invariants — SITE=${SITE}`);
  const tests = [];
  for (const p of PAGES) {
    tests.push({ name: `${p.path} common invariants (200, one head/title, viewport)`, page: p, kind: 'common' });
    if (p.extra.length > 0) tests.push({ name: `${p.path} page-specific invariants`, page: p, kind: 'extra' });
  }
  console.log(`1..${tests.length}`);

  // fetch each page once, share across its tests
  const cache = new Map();
  let failed = 0;
  for (let i = 0; i < tests.length; i++) {
    const { name, page, kind } = tests[i];
    try {
      if (!cache.has(page.path)) cache.set(page.path, await fetchPage(page.path));
      const { status, html } = cache.get(page.path);
      if (kind === 'common') commonChecks(page.path, status, html);
      else page.extra(html);
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
