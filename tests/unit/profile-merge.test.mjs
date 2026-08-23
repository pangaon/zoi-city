// The contract between owner-supplied and machine-derived listing data.
//
// This is the seam where honesty is either enforced or lost. Enrichment must
// fill empty fields, never overwrite a person's own words, never be mistaken for
// verified fact, and never smuggle a rating into JSON-LD.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeProfile, profileOf, provenanceNote } from '../../api/_verticals.js';

const enriched = (extra = {}) => ({
  profile: {
    _enrich: {
      description: 'From their website.',
      phone: '+30 210 000 0000',
      photo_url: 'https://example.gr/logo.png',
      social: { instagram: 'https://instagram.com/x' },
      menu_url: 'https://example.gr/menu',
      provenance: { description: 'jsonld', phone: 'tel-link', photo_url: 'og' },
      checked_at: '2026-08-23',
      source_url: 'https://www.example.gr/',
      ...extra,
    },
  },
});

test('enrichment fills a gap but never overwrites the owner', () => {
  const p = safeProfile({
    profile: { description: 'What the owner wrote.', ...enriched().profile },
  });
  assert.equal(p.description, 'What the owner wrote.', 'the owner always wins');
  assert.equal(p.phone, '+30 210 000 0000', 'an empty field is filled');
  // and the owner's key is not reported as machine-derived
  assert.ok(!('description' in p._from), 'an owner key must not be labelled as scraped');
  assert.equal(p._from.phone, 'tel-link', 'a filled gap records where it came from');
});

test('the reserved namespaces never render as profile fields', () => {
  const p = safeProfile({
    profile: {
      _enrich: { description: 'x' },
      _geo: { precision: 'city' },
      _meta: { updated_by: 'owner' },
    },
  });
  for (const k of ['_enrich', '_geo', '_meta']) {
    assert.ok(!(k in p), `${k} is metadata, not a field`);
  }
  // nor the enrichment writer's own bookkeeping
  const q = safeProfile(enriched({ blocked: 'true', last_error: 'http403' }));
  for (const k of ['provenance', 'checked_at', 'source_url', 'blocked', 'last_error']) {
    assert.ok(!(k in q), `${k} must not surface as a field`);
  }
});

test('ratings are blocked from BOTH sides, not just from owners', () => {
  // An owner cannot award themselves stars, and neither can a scraped page —
  // this is what stops an unverifiable rating reaching JSON-LD and then Google.
  const p = safeProfile({
    profile: {
      rating: 5, reviews: 120,
      _enrich: { rating: 5, aggregateRating: 4.9, reviewCount: 99, score: 10 },
    },
  });
  for (const k of ['rating', 'reviews', 'aggregateRating', 'reviewCount', 'score']) {
    assert.ok(!(k in p), `${k} must never be readable from a profile`);
  }
  assert.ok(!JSON.stringify(p).toLowerCase().includes('rating'));
});

test('provenance metadata cannot leak into serialised output', () => {
  const p = safeProfile(enriched());
  // JSON-LD and any API response are built by serialising this object.
  const json = JSON.stringify(p);
  for (const k of ['_from', '_checked', '_source']) {
    assert.ok(!json.includes(k), `${k} must be non-enumerable`);
    assert.ok(!Object.keys(p).includes(k));
  }
  assert.ok(p._from && p._checked && p._source, 'but still readable by the renderer');
});

test('profileOf and safeProfile are the same door', () => {
  // profileOf used to return the raw column, which meant a caller could render
  // _enrich as a field and bypass the rating filter entirely.
  const e = { profile: { rating: 5, _geo: { precision: 'city' }, name_note: 'ok' } };
  const a = profileOf(e), b = safeProfile(e);
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort());
  assert.ok(!('rating' in a) && !('_geo' in a));
});

test('the note is honest, specific, and absent when nothing was scraped', () => {
  const p = safeProfile(enriched());
  const note = provenanceNote(p);
  assert.match(note, /read from example\.gr/, 'it names the source host');
  assert.match(note, /23 Aug 2026/, 'it gives the date it was read');
  assert.match(note, /not confirmed by them/, 'it must not imply verification');
  assert.match(note, /Claim this listing/, 'it offers the correction path');
  assert.ok(!/verified|confirmed by|official/i.test(note.replace('not confirmed by them', '')),
    'it must not claim verification anywhere');
  // nothing machine-derived -> no note at all
  assert.equal(provenanceNote(safeProfile({ profile: { description: 'owner' } })), '');
  assert.equal(provenanceNote(safeProfile({})), '');
  assert.equal(provenanceNote({}), '');
});

test('a listing with no profile at all still yields a usable empty object', () => {
  for (const e of [{}, { profile: null }, { profile: [] }, { profile: 'nope' }, null]) {
    const p = safeProfile(e);
    assert.equal(typeof p, 'object');
    assert.deepEqual(Object.keys(p), []);
    assert.equal(provenanceNote(p), '');
  }
});
