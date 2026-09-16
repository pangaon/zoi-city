#!/usr/bin/env node

const targets = [
  {
    name: 'home',
    url: 'https://www.zoi.city/',
    mustContain: ['Zoi', 'Greek world'],
  },
  {
    name: 'app-hub',
    url: 'https://www.zoi.city/apps/',
    mustContain: ['App hub', 'Directory listing types', 'Built as real enterprise listing families'],
  },
  {
    name: 'explore',
    url: 'https://www.zoi.city/explore',
    mustContain: ['Directory · Zoi', 'Find anything'],
  },
  {
    name: 'tickets',
    url: 'https://www.zoi.city/tickets',
    mustContain: ['Tickets', 'Zoi'],
  },
  {
    name: 'community',
    url: 'https://www.zoi.city/community',
    mustContain: ['Community', 'Zoi'],
  },
];

async function fetchPage(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'zoi-smoke-check/1.0' },
    signal: AbortSignal.timeout(20000),
  });

  const text = await res.text();
  return { res, text };
}

const results = [];

for (const target of targets) {
  try {
    const { res, text } = await fetchPage(target.url);
    const ok = res.ok && target.mustContain.every((needle) => text.includes(needle));
    results.push({ ...target, ok, status: res.status });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${target.name}: ${res.status} ${target.url}`);
    if (!ok) {
      const missing = target.mustContain.filter((needle) => !text.includes(needle));
      console.log(`  missing markers: ${missing.join(', ')}`);
    }
  } catch (error) {
    results.push({ ...target, ok: false, status: 'error', error: String(error) });
    console.log(`FAIL ${target.name}: ${String(error)}`);
  }
}

const failed = results.filter((item) => !item.ok);
if (failed.length > 0) {
  console.error(`\nSmoke check failed for ${failed.length} route(s).`);
  process.exit(1);
}

console.log(`\nSmoke check passed for ${results.length} route(s).`);
