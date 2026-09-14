import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../business/index.html', import.meta.url), 'utf8');

test('For Business acquisition page has a clear conversion path', () => {
  assert.match(html, /For businesses, creators & organizations/);
  assert.match(html, /href="\/add"/);
  assert.match(html, /href="\/social"/);
  assert.match(html, /Add or claim your presence/);
});

test('For Business page does not expose internal roadmap language', () => {
  assert.doesNotMatch(html, />Platform maturity<|>Gap:|>Opportunity:|>Coming soon<|roadmap/i);
});

test('For Business page states live capability boundaries', () => {
  assert.match(html, /Directory presence/);
  assert.match(html, /Business Workspace/);
  assert.match(html, /Tickets/);
  assert.match(html, /payment availability is stated before action/i);
});
