// Geocoder precision is a truth claim. The map renders it as prose next to a
// business name, and a user reads that prose as a statement about whether the
// pin will take them to the door.
//
// Production carries ten distinct raw precision values. The renderer previously
// understood eight tokens and collapsed everything else — 69.7% of mapped rows,
// including the 5,292-row 'none' bucket — into "Approximate location". That is
// an overstatement: 'none' is an absence of evidence, and that bucket contains
// pins on the wrong continent. These tests pin the vocabulary to the values
// production actually emits, and assert that an unrecorded precision is never
// described as though it were a measurement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../explore/map/index.html', import.meta.url), 'utf8');

// Lift the precision + directions helpers out of the inline script.
function lift(startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  assert.ok(a !== -1, `could not find ${startMarker} in explore/map/index.html`);
  const b = src.indexOf(endMarker, a);
  assert.ok(b !== -1, `could not find ${endMarker} in explore/map/index.html`);
  return src.slice(a, b);
}

const block = lift('var PRECISION = {', '/* ---------- state ---------- */');
const sandbox = new Function(block + `
  return { PRECISION, UNKNOWN_PRECISION, precisionOf, precisionLabel, directionsUrl, directionsBasis };
`)();
const { PRECISION, precisionOf, precisionLabel, directionsUrl, directionsBasis } = sandbox;

// Every raw value observed in production on 2026-09-13, with its row count.
const PRODUCTION_VALUES = [
  ['none', 5292], ['city', 2133], ['approx', 922], ['street', 535],
  ['address', 35], ['approximate', 13], ['neighborhood', 2],
  ['neighbourhood', 1], ['suburb', 1], ['rooftop', 1],
];

test('every production precision value resolves to a defined label', () => {
  for (const [raw] of PRODUCTION_VALUES) {
    const label = precisionLabel({ precision: raw });
    assert.equal(typeof label, 'string', `${raw} produced a non-string label`);
    assert.ok(label.length > 0, `${raw} produced an empty label`);
  }
});

test('an unrecorded precision is never called "approximate"', () => {
  // The reported bug. 'none' means we did not record where the coordinate came
  // from; calling that "Approximate location" claims an accuracy tier we have
  // no basis for, and it read identically to a genuine city-centroid pin.
  for (const raw of ['none', 'unknown', '', null, undefined, 'garbage', 'NULL']) {
    const p = { precision: raw };
    assert.equal(precisionOf(p).unknown, true, `${JSON.stringify(raw)} should be unknown`);
    assert.ok(!/approximate/i.test(precisionLabel(p)),
      `${JSON.stringify(raw)} was labelled "${precisionLabel(p)}"`);
  }
});

test('only rooftop, address and street count as exact', () => {
  for (const raw of ['rooftop', 'address', 'street']) {
    assert.equal(precisionOf({ precision: raw }).exact, true, `${raw} should be exact`);
  }
  for (const raw of ['city', 'town', 'locality', 'region', 'country',
                     'approx', 'approximate', 'neighborhood', 'suburb', 'none']) {
    assert.notEqual(precisionOf({ precision: raw }).exact, true, `${raw} must not be exact`);
  }
});

test('spelling variants collapse to one tier', () => {
  // approx/approximate and neighborhood/neighbourhood are the same claim spelled
  // two ways; they must not read as two different confidence levels.
  assert.equal(precisionLabel({ precision: 'approx' }), precisionLabel({ precision: 'approximate' }));
  assert.equal(precisionLabel({ precision: 'neighborhood' }), precisionLabel({ precision: 'neighbourhood' }));
  assert.equal(precisionLabel({ precision: 'neighbourhood' }), precisionLabel({ precision: 'suburb' }));
  assert.equal(precisionLabel({ precision: 'city' }), precisionLabel({ precision: 'town' }));
  assert.equal(precisionLabel({ precision: 'region' }), precisionLabel({ precision: 'country' }));
});

test('precision lookup is case-insensitive', () => {
  assert.equal(precisionLabel({ precision: 'STREET' }), precisionLabel({ precision: 'street' }));
  assert.equal(precisionLabel({ precision: 'City' }), precisionLabel({ precision: 'city' }));
});

test('rank orders the tiers monotonically', () => {
  const rank = (r) => precisionOf({ precision: r }).rank;
  assert.ok(rank('street') > rank('neighbourhood'), 'street should outrank neighbourhood');
  assert.ok(rank('neighbourhood') > rank('city'), 'neighbourhood should outrank city');
  assert.ok(rank('city') > rank('region'), 'city should outrank region');
  assert.ok(rank('region') > rank('none'), 'any recorded tier should outrank unknown');
  assert.equal(rank('none'), -1, 'unknown must be the floor');
});

/* ---------- directions ---------- */

// The two records from the report: same business, same coordinate, precision
// never recorded, but a real street address on file.
const MELANI = {
  n: 'Meláni – Modern Greek Dining', addr: '2537 Yonge St',
  city: 'Toronto', country: 'Canada',
  lat: 43.712972, lng: -79.399514, precision: 'none',
};

test('directions route by address when one exists, even at unknown precision', () => {
  // The address is exact even though the coordinate it produced is unverified.
  // Routing by address is the whole fix for the reported bug.
  const url = directionsUrl(MELANI);
  assert.ok(url, 'no directions url produced');
  assert.equal(directionsBasis(MELANI), 'address');
  assert.ok(url.includes(encodeURIComponent('2537 Yonge St, Toronto, Canada')),
    `address missing from ${url}`);
  assert.ok(!url.includes('43.712972'), 'must not route to the unverified pin');
});

test('an unverified coordinate is never a routing destination', () => {
  // A city centroid or an unrecorded pin can be on the wrong continent. Sending
  // a user there is worse than not offering to route them.
  const noAddr = { n: 'Messinian Spa', city: 'Kalamata', country: 'Greece',
                   lat: -7.770503, lng: 28.235353, precision: 'none' };
  const url = directionsUrl(noAddr);
  assert.equal(directionsBasis(noAddr), 'name');
  assert.ok(!url.includes('-7.770503'), 'routed to an unverified coordinate');
  assert.ok(url.includes(encodeURIComponent('Messinian Spa, Kalamata, Greece')),
    `expected a name search, got ${url}`);
});

test('an exact pin with no address routes by coordinate', () => {
  const p = { n: 'St Anthony', city: 'Reno', country: 'United States',
              lat: 39.469934, lng: -119.807927, precision: 'street' };
  assert.equal(directionsBasis(p), 'pin');
  assert.ok(directionsUrl(p).includes(encodeURIComponent('39.469934,-119.807927')));
});

test('a record with neither address nor city yields no directions link', () => {
  const p = { n: 'Nowhere', lat: 0, lng: 0, precision: 'none' };
  assert.equal(directionsUrl(p), null);
  assert.equal(directionsBasis(p), '');
});

test('directions destinations are url-encoded', () => {
  // Greek names and comma-separated addresses both break a raw query string.
  const p = { n: 'Ταβέρνα', addr: 'Λεωφ. Συγγρού 12', city: 'Αθήνα',
              country: 'Greece', lat: 37.97, lng: 23.72, precision: 'none' };
  const url = directionsUrl(p);
  assert.ok(!/[ ]/.test(url), `unencoded space in ${url}`);
  assert.ok(url.startsWith('https://www.google.com/maps/dir/?api=1&destination='));
});
