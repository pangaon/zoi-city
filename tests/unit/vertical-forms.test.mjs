// The editor and the public page must agree about which vertical a listing is.
// If they disagree, an owner fills in a form whose fields nothing renders — the
// worst possible outcome, because it looks like it worked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const g = {};
new Function('window', 'globalThis',
  readFileSync(new URL('../../assets/suite/_vertical-forms.js', import.meta.url), 'utf8'))(g, g);
const F = g.ZoiVerticalForms;

test('category slugs route to the right vertical, plurals included', () => {
  const cases = [
    ['church', 'greek-orthodox-churches', 'church'],
    ['church', 'monasteries', 'church'],
    ['business', 'restaurants', 'restaurant'],
    ['business', 'tavernas', 'restaurant'],
    // 'bakery' does not match 'bakeries'; this silently sent every bakery in the
    // directory to the generic form.
    ['business', 'bakeries', 'restaurant'],
    ['business', 'cafes', 'restaurant'],
    ['business', 'groceries-importers', 'restaurant'],
    ['professional', 'lawyers', 'professional'],
    ['professional', 'dentists', 'professional'],
    ['professional', 'accountants', 'professional'],
    ['school', 'greek-language-schools', 'school'],
    ['organization', 'hellenic-associations', 'organization'],
    ['creator', 'influencers', 'creator'],
    ['venue', 'cultural-centres', 'venue'],
    ['event', 'festivals', 'event'],
    ['business', 'something-nobody-anticipated', 'generic'],
  ];
  for (const [type, cat, want] of cases) {
    assert.equal(F.fieldsFor(type, cat).key, want, `${type}/${cat}`);
  }
});

test('every schema is renderable: known types, unique keys, no banned fields', () => {
  const types = new Set(Object.values(F.T));
  for (const [name, v] of Object.entries(F.VERTICALS)) {
    assert.ok(v.title, `${name} needs a title`);
    const seen = new Set();
    for (const f of v.fields.concat(F.SHARED)) {
      assert.ok(f.k && f.label, `${name}: every field needs a key and a label`);
      assert.ok(types.has(f.type), `${name}.${f.k}: unknown type ${f.type}`);
      assert.ok(!seen.has(f.k), `${name}.${f.k}: duplicate key`);
      seen.add(f.k);
      if (f.type === F.T.REPEAT) {
        assert.ok(Array.isArray(f.of) && f.of.length, `${name}.${f.k}: a repeater needs sub-fields`);
        for (const sf of f.of) assert.ok(types.has(sf.type), `${name}.${f.k}.${sf.k}: unknown type`);
      }
      if (f.type === F.T.SELECT) {
        assert.ok(Array.isArray(f.opts) && f.opts.length, `${name}.${f.k}: a select needs options`);
      }
      // A field the public page cannot render is a trap for the owner.
      assert.ok(!/^(rating|review|score|stars)/i.test(f.k), `${name}.${f.k} must not exist`);
    }
  }
});

test('enrichment pre-fills the form, and is kept separate from the owner', () => {
  const fields = F.fieldsFor('business', 'tavernas').fields;
  const profile = {
    about: 'What the owner wrote.',                       // owner's own
    _enrich: {
      description: 'What the website says.',
      menu_url: 'https://x/menu', booking_url: 'https://x/book',
      hours: [{ day: 'tue', open: '17:00', close: '23:00' }],
      source_url: 'https://x/', checked_at: '2026-08-23',
    },
  };
  const p = F.partition(profile, fields);
  assert.equal(p.own.about, 'What the owner wrote.', 'the owner wins');
  assert.ok(!p.fromWebsite.includes('about'), 'a field the owner filled is not asked about again');
  assert.ok(p.fromWebsite.includes('menu_url'), 'a gap the website can fill is offered');
  assert.ok(p.fromWebsite.includes('reserve_url'), 'aliases are resolved (booking_url -> reserve_url)');
  assert.equal(p.source, 'https://x/');
  assert.equal(p.checked, '2026-08-23');
  // nothing to offer when there is no enrichment
  assert.deepEqual(F.partition({ about: 'x' }, fields).fromWebsite, []);
  assert.deepEqual(F.partition(null, fields).fromWebsite, []);
});

test('clean() cannot store a rating, a reserved namespace, or an empty', () => {
  const out = F.clean({
    rating: 5, rating_count: 9, reviews: [1], aggregateRating: 4.9, score: 10, stars: 5,
    _enrich: { x: 1 }, _geo: { y: 2 }, _meta: { z: 3 },
    about: '  spaced  ', empty: '', blank: [], nul: null,
    services: [{ name: 'Liturgy', time: '' }, { name: '', time: '' }],
  });
  for (const k of ['rating', 'rating_count', 'reviews', 'aggregateRating', 'score', 'stars',
                   '_enrich', '_geo', '_meta', 'empty', 'blank', 'nul']) {
    assert.ok(!(k in out), `${k} must never be stored`);
  }
  assert.equal(out.about, 'spaced', 'strings are trimmed');
  assert.deepEqual(out.services, [{ name: 'Liturgy' }], 'empty rows and empty keys are dropped');
  assert.deepEqual(F.clean({}), {});
  assert.deepEqual(F.clean(null), {});
});

test('the shared fields every vertical gets are actually shared', () => {
  for (const name of Object.keys(F.VERTICALS)) {
    const keys = F.fieldsFor(name, '').fields.map((f) => f.k);
    for (const s of ['tagline', 'about', 'languages', 'hours']) {
      assert.ok(keys.includes(s), `${name} is missing the shared field ${s}`);
    }
  }
});
