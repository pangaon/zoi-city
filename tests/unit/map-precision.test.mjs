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

/* ---------- geolocation accuracy ---------- */

const geo = new Function(
  lift('function zoomForAccuracy(', "$('tNear')") +
  'return { zoomForAccuracy, COARSE_FIX_M };'
)();

test('zoom follows the accuracy radius', () => {
  // A browser fix ranges from metres (GPS) to tens of kilometres (IP). Zooming
  // to street level on an IP fix frames a block the user is probably not on.
  const { zoomForAccuracy } = geo;
  const metres = [10, 100, 500, 2000, 10000, 50000, 200000];
  const zooms = metres.map(zoomForAccuracy);
  for (let i = 1; i < zooms.length; i++) {
    assert.ok(zooms[i] <= zooms[i - 1],
      `zoom must not increase as accuracy worsens: ${metres[i - 1]}m->${zooms[i - 1]}, ${metres[i]}m->${zooms[i]}`);
  }
  assert.ok(zoomForAccuracy(10) >= 15, 'a GPS fix should frame the street');
  assert.ok(zoomForAccuracy(200000) <= 7, 'a 200km fix must not frame a street');
});

test('a missing or zero accuracy does not pretend to be precise', () => {
  const { zoomForAccuracy } = geo;
  for (const v of [0, null, undefined, -1]) {
    const z = zoomForAccuracy(v);
    assert.ok(z <= 11, `unknown accuracy framed at zoom ${z}`);
  }
});

test('the coarse-fix threshold is a real-world city radius', () => {
  // Above this the fix locates a city, not a person, so "nearest to you" and an
  // exact distance both stop being supportable.
  const { COARSE_FIX_M } = geo;
  assert.ok(COARSE_FIX_M >= 5000 && COARSE_FIX_M <= 100000,
    `implausible coarse threshold: ${COARSE_FIX_M}`);
});

/* ---------- source invariants ----------
 * These assert against the file rather than the deployed page, so they gate the
 * commit instead of reporting on it after release. */

test('the map ships a directions affordance', () => {
  // A visible marker must be actionable. Without this the map answers "where is
  // it" but never "how do I get there", which was the reported gap.
  assert.ok(/maps\/dir\/\?api=1&destination=/.test(src),
    'no directions destination in explore/map');
});

test('the stale precision fallback copy is gone', () => {
  assert.ok(/Location not verified/.test(src),
    'unverified positions are not labelled');
  assert.ok(!/Location precision unavailable/.test(src),
    'stale fallback copy still present');
});

test('precision is never inferred from coordinate collisions', () => {
  // The old heuristic read accuracy off how many pins shared a coordinate.
  assert.ok(!/co\.length\s*>\s*2/.test(src),
    'precision is being guessed from coincident pins');
});

test('a selected place is addressable in the url', () => {
  // Without this a shared link restores the viewport but loses the listing.
  assert.ok(/p\.set\('place'/.test(src), 'selected place is not written to the url');
  assert.ok(/p\.get\('place'\)/.test(src), 'place param is not read back');
});

test('partial directory failures are counted, not swallowed', () => {
  // Rendering 80% of the directory as though it were all of it is silent loss.
  assert.ok(/failedPages\s*=/.test(src), 'failed pages are not tracked');
});

/* ---------- accent folding ---------- */

const { fold } = new Function(lift('function fold(s) {', 'function nice(') + 'return { fold };')();

test('latin diacritics fold so unaccented typing finds accented names', () => {
  // The reported listing is "Meláni". Typing "melani" found nothing.
  assert.equal(fold('Meláni'), fold('melani'));
  assert.ok(fold('Meláni – Modern Greek Dining').includes(fold('melani')));
  assert.equal(fold('Ãgean'), fold('agean'));
});

test('greek tonos folds so untoned typing finds toned names', () => {
  // Greek speakers routinely omit the tonos; requiring it hides the directory.
  assert.equal(fold('Μύκονος'), fold('μυκονος'));
  assert.equal(fold('Αθήνα'), fold('αθηνα'));
  assert.equal(fold('Θεσσαλονίκη'), fold('θεσσαλονικη'));
});

test('greek final sigma folds to sigma', () => {
  // ς and σ are the same letter; which one you get depends on word position.
  assert.equal(fold('Μύκονος'), fold('ΜΥΚΟΝΟΣ'));
  assert.equal(fold('πατερας'), fold('πατεραΣ'));
});

test('folding is idempotent and total', () => {
  for (const v of ['', null, undefined, 'plain', 'Μύκονος', 'Meláni', 123]) {
    const once = fold(v);
    assert.equal(fold(once), once, `not idempotent for ${JSON.stringify(v)}`);
    assert.equal(typeof once, 'string');
  }
});

test('folding does not collapse distinct words', () => {
  // Over-folding would make search useless in the other direction.
  assert.notEqual(fold('Meláni'), fold('Melissa'));
  assert.notEqual(fold('Αθήνα'), fold('Πάτρα'));
});
