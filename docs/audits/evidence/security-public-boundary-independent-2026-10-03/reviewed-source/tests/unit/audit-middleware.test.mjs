import { test } from 'node:test';
import assert from 'node:assert/strict';
import middleware, { config } from '../../middleware.js';

test('matched internal artifacts return an uncached 404 before filesystem serving', async () => {
  const response = middleware(new Request('https://www.zoi.city/docs/audits/evidence/source.html'));
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.equal(await response.text(), 'Not found');
  assert.equal(config.runtime, 'nodejs');
  assert.equal(config.matcher[0], '/docs/:path*');
});

test('encoded-root matcher covers character encoding without matching product families', () => {
  const pattern = new RegExp('^' + config.matcher[1] + '$');
  for (const path of ['/docs/audits/file.json', '/%64ocs/audits/file.json', '/d%6Fcs/audits/file.json', '/%64%6f%63%73/audits/file.json']) assert.ok(pattern.test(path), path);
  for (const path of ['/business/name', '/event/name', '/social/', '/assets/icons/logo.png', '/documents/']) assert.equal(pattern.test(path), false, path);
});
