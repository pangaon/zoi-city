import test from 'node:test';
import assert from 'node:assert/strict';

import { ZOI_LISTING_TYPES } from '../../assets/zoi-listing-types.js';

const REQUIRED_KEYS = [
  'church',
  'organization',
  'school',
  'event',
  'venue',
  'vendor',
  'travel_place',
  'sports',
  'artist',
  'creator',
  'professional',
  'business',
  'hotel',
];

test('directory listing registry includes every canonical live listing type', () => {
  assert.ok(Array.isArray(ZOI_LISTING_TYPES));
  const keys = ZOI_LISTING_TYPES.map((type) => type.key);
  for (const key of REQUIRED_KEYS) {
    assert.ok(keys.includes(key), `missing canonical listing type: ${key}`);
  }
});

test('listing types expose a summary, live capabilities, and a route', () => {
  for (const type of ZOI_LISTING_TYPES) {
    assert.ok(type.label && type.label.length > 0);
    assert.ok(type.summary && type.summary.length > 0);
    assert.ok(Array.isArray(type.capabilities) && type.capabilities.length > 0);
    assert.ok(type.route && typeof type.route === 'string');
  }
});
