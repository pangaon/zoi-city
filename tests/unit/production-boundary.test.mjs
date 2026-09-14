import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
const redirects = vercel.redirects || [];

function destination(source) {
  const row = redirects.find((item) => item.source === source);
  return row && row.destination;
}

test('demo-only Business Pro route cannot be entered as production', () => {
  assert.equal(destination('/apps/business-pro'), '/social');
  assert.equal(destination('/apps/business-pro/:path*'), '/social');
});

test('demo-only Event OS route cannot be entered as production', () => {
  assert.equal(destination('/apps/event-os'), '/tickets');
  assert.equal(destination('/apps/event-os/:path*'), '/tickets');
});

test('demo-only Tickets Studio route cannot be entered as production', () => {
  assert.equal(destination('/apps/tickets-studio'), '/tickets');
  assert.equal(destination('/apps/tickets-studio/:path*'), '/tickets');
});

test('legacy classic directory route cannot compete with canonical Discover', () => {
  assert.equal(destination('/explore/app'), '/explore');
  assert.equal(destination('/explore/app/:path*'), '/explore');
});

test('live operator products remain distinct from retired previews', () => {
  assert.equal(destination('/apps/command-center'), undefined);
  assert.equal(destination('/apps/intelligence'), undefined);
});
