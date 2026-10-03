import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import handler from '../../api/audit-evidence.js';

test('audit source artifacts return uncached 404 without exposing content', () => {
  const headers = {};
  const res = { setHeader: (key, value) => { headers[key] = value; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  handler({ url: '/docs/audits/evidence/source.html' }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(headers['Cache-Control'], 'no-store');
  assert.deepEqual(res.body, { error: 'Not found' });
  const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url)));
  assert.deepEqual(config.rewrites[0], { source: '/docs/audits/:path*', destination: '/api/audit-evidence' });
  assert.ok(config.rewrites.some(rule => rule.source === '/business/:slug' && rule.destination === '/api/entity?slug=:slug'));
});
