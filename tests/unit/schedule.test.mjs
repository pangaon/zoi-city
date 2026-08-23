// assets/suite/_schedule.js is the arithmetic behind the scheduler: character
// limits, queue slots, collisions, cadence. It has no DOM in it precisely so it
// can be tested, and every function that needs "now" takes it as an argument.
//
// The bug that prompted the file: the composer's "next queue slot" looked only
// at the slot table and never at the posts already sitting in those slots, so
// clicking it twice put two posts on the same channel at the same minute.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const g = { localStorage: null };
new Function('window', 'globalThis', readFileSync(new URL('../../assets/suite/_schedule.js', import.meta.url), 'utf8'))(g, g);
const S = g.ZoiSchedule;

/* A fake localStorage, so the draft tests do not need a browser. */
function fakeStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    size: () => m.size,
  };
}

test('the library loads as a classic script and exposes one global', () => {
  assert.ok(S);
  for (const fn of ['countFor', 'graphemes', 'nextSlotTimes', 'nextOpenSlotTimes', 'conflicts',
    'cadence', 'slotAdherence', 'contentAnatomy', 'utmUrl', 'parseCSV']) {
    assert.equal(typeof S[fn], 'function', `${fn} must be exported`);
  }
});

/* ---------------- counting ---------------- */

test('characters are counted the way a person counts them, not the way UTF-16 does', () => {
  assert.equal(S.graphemes('kalimera'), 8);
  assert.equal(S.graphemes(''), 0);
  assert.equal(S.graphemes(null), 0);
  assert.equal(S.graphemes('καλημέρα'), 8, 'Greek is one char per letter');
  assert.equal(S.graphemes('🇬🇷'), 2, 'a flag is two regional indicators — platforms count it that way too');
  assert.equal(S.graphemes('👍'), 1);
  assert.equal(S.graphemes('👍🏽'), 1, 'a skin-tone modifier is not a second character');
  assert.equal(S.graphemes('👨‍👩‍👧'), 1, 'a ZWJ family is one visible character');
  assert.equal(S.graphemes('☕️'), 1, 'variation selectors are invisible');
  // the naive version is what makes a counter look broken
  assert.notEqual('👨‍👩‍👧'.length, S.graphemes('👨‍👩‍👧'));
});

test('X counts a link as a t.co, every other network counts it as written', () => {
  const url = 'https://zoi.city/some/very/long/path/that/keeps/going/and/going?a=1&b=2';
  assert.ok(url.length > 40);
  const x = S.countFor('x', 'Read this: ' + url);
  assert.equal(x.chars, 'Read this: '.length + 23, 'the URL costs 23, not its real length');
  assert.equal(x.urls, 1);
  assert.equal(x.over, false);
  const fb = S.countFor('facebook', 'Read this: ' + url);
  assert.equal(fb.chars, ('Read this: ' + url).length);
});

test('twitter and x are the same network', () => {
  assert.equal(S.countFor('twitter', 'abc').platform, 'x');
  assert.equal(S.countFor('X', 'abc').limit, 280);
  assert.equal(S.normPlat('Twitter'), 'x');
});

test('over-limit and nearly-over-limit are distinguishable', () => {
  const long = 'a'.repeat(281);
  const x = S.countFor('x', long);
  assert.equal(x.over, true);
  assert.equal(x.remaining, -1);
  const near = S.countFor('x', 'a'.repeat(270));
  assert.equal(near.over, false);
  assert.equal(near.warn, true, '270/280 should warn');
  const fine = S.countFor('x', 'a'.repeat(100));
  assert.equal(fine.warn, false);
  // an unknown network must not pretend to have a limit
  const unknown = S.countFor('mastodon', 'hello');
  assert.equal(unknown.limit, null);
  assert.equal(unknown.over, false);
});

test('hashtags, mentions and links are extracted, Greek included', () => {
  const body = 'Καλημέρα #ζωή #Zoi @taverna_ousia see https://zoi.city and http://x.gr/a';
  assert.deepEqual(S.hashtagsIn(body), ['#ζωή', '#zoi']);
  assert.deepEqual(S.mentionsIn(body), ['@taverna_ousia']);
  assert.equal(S.urlsIn(body).length, 2);
  assert.deepEqual(S.hashtagsIn(''), []);
});

/* ---------------- queue slots ---------------- */

// Sun=0. 09:00 = 540 minutes.
const SLOTS = [
  { id: 's-mon', weekday: 1, minute: 540 },
  { id: 's-mon-pm', weekday: 1, minute: 1080 },   // 18:00
  { id: 's-thu', weekday: 4, minute: 600 },       // 10:00
  { id: 's-off', weekday: 2, minute: 540, active: false },
];

test('the next queue slots are the real next occurrences, in order', () => {
  // Monday 24 August 2026, 12:00 local
  const from = new Date(2026, 7, 24, 12, 0, 0, 0);
  assert.equal(from.getDay(), 1, 'fixture sanity: 24 Aug 2026 is a Monday');
  const next = S.nextSlotTimes(SLOTS, from, 4);
  assert.equal(next.length, 4);
  assert.equal(S.localInputValue(next[0].when), '2026-08-24T18:00', 'today 09:00 has passed; 18:00 has not');
  assert.equal(S.localInputValue(next[1].when), '2026-08-27T10:00', 'Thursday');
  assert.equal(S.localInputValue(next[2].when), '2026-08-31T09:00', 'next Monday morning');
  assert.equal(S.localInputValue(next[3].when), '2026-08-31T18:00');
  for (let i = 1; i < next.length; i++) {
    assert.ok(next[i].when.getTime() > next[i - 1].when.getTime(), 'strictly increasing');
  }
});

test('an inactive slot is never suggested, and no slots means no suggestions', () => {
  const from = new Date(2026, 7, 24, 0, 1, 0, 0);
  const next = S.nextSlotTimes(SLOTS, from, 10);
  assert.ok(!next.some((n) => n.slot.id === 's-off'), 'active:false must be skipped');
  assert.deepEqual(S.nextSlotTimes([], from, 3), []);
  assert.deepEqual(S.nextSlotTimes(null, from, 3), []);
  // a garbage row must not crash or produce an Invalid Date
  assert.deepEqual(S.nextSlotTimes([{ id: 'x', weekday: 'nope', minute: null }], from, 3), []);
});

test('"add to queue" skips slots that already have a post in them — the bug this file fixed', () => {
  const from = new Date(2026, 7, 24, 12, 0, 0, 0);
  const posts = [
    { id: 'p1', status: 'scheduled', scheduled_at: new Date(2026, 7, 24, 18, 2, 0, 0).toISOString() },
  ];
  const open = S.nextOpenSlotTimes(SLOTS, posts, from, 2);
  assert.equal(S.localInputValue(open[0].when), '2026-08-27T10:00',
    'Monday 18:00 is taken (a post two minutes past counts as filling it)');
  assert.equal(S.localInputValue(open[1].when), '2026-08-31T09:00');
  // with nothing scheduled it degrades to the plain next-slot answer
  assert.equal(S.localInputValue(S.nextOpenSlotTimes(SLOTS, [], from, 1)[0].when), '2026-08-24T18:00');
});

/* ---------------- collisions ---------------- */

const POSTS = [
  { id: 'a', status: 'scheduled', scheduled_at: new Date(2026, 7, 24, 9, 0).toISOString(), channels: ['ch-fb', 'ch-ig'] },
  { id: 'b', status: 'scheduled', scheduled_at: new Date(2026, 7, 24, 15, 0).toISOString(), channels: ['ch-x'] },
  { id: 'c', status: 'draft', scheduled_at: new Date(2026, 7, 24, 9, 5).toISOString(), channels: ['ch-fb'] },
  { id: 'd', status: 'failed', scheduled_at: new Date(2026, 7, 24, 9, 5).toISOString(), channels: ['ch-fb'] },
];

test('two posts to the same account minutes apart are reported as a conflict', () => {
  const hit = S.conflicts(POSTS, new Date(2026, 7, 24, 9, 20), ['ch-fb'], 30);
  assert.deepEqual(hit.map((p) => p.id), ['a']);
});

test('a different account at the same minute is not a conflict', () => {
  assert.deepEqual(S.conflicts(POSTS, new Date(2026, 7, 24, 9, 0), ['ch-li'], 30), []);
});

test('drafts and failures do not count as conflicts, and neither does the post itself', () => {
  assert.deepEqual(S.conflicts(POSTS, new Date(2026, 7, 24, 9, 3), ['ch-fb'], 10).map((p) => p.id), ['a'],
    'the draft and the failure at 09:05 are ignored');
  assert.deepEqual(S.conflicts(POSTS, new Date(2026, 7, 24, 9, 0), ['ch-fb'], 30, 'a'), [],
    'rescheduling a post must not conflict with itself');
});

test('outside the window there is no conflict, and bad input is quiet', () => {
  assert.deepEqual(S.conflicts(POSTS, new Date(2026, 7, 24, 12, 0), ['ch-fb'], 30), []);
  assert.deepEqual(S.conflicts(POSTS, null, ['ch-fb'], 30), []);
  assert.deepEqual(S.conflicts(null, new Date(), ['ch-fb'], 30), []);
  assert.deepEqual(S.conflicts([{ id: 'z', status: 'scheduled' }], new Date(), ['ch-fb'], 30), [],
    'a post with no date cannot collide');
});

test('channels survive whatever shape the backend hands back', () => {
  assert.deepEqual(S.postChannels({ channels: ['a', 'b'] }), ['a', 'b']);
  assert.deepEqual(S.postChannels({ channels: '["a","b"]' }), ['a', 'b']);
  assert.deepEqual(S.postChannels({ channels: 'ch-1' }), ['ch-1']);
  assert.deepEqual(S.postChannels({}), []);
  assert.deepEqual(S.postChannels(null), []);
});

/* ---------------- cadence, adherence, anatomy ---------------- */

test('cadence measures the silence, which is the number that matters', () => {
  const from = new Date(2026, 6, 1).getTime();
  const to = new Date(2026, 6, 29).getTime();      // a 28-day window = 4 weeks
  const posts = [
    { scheduled_at: new Date(2026, 6, 1, 9, 0).toISOString() },
    { scheduled_at: new Date(2026, 6, 2, 9, 0).toISOString() },
    { scheduled_at: new Date(2026, 6, 20, 9, 0).toISOString() },  // 18 days of silence
    { scheduled_at: new Date(2026, 6, 21, 9, 0).toISOString() },
  ];
  const c = S.cadence(posts, from, to);
  assert.equal(c.total, 4);
  assert.equal(c.perWeek, 1);
  assert.equal(Math.round(c.longestGapDays), 18);
  assert.equal(c.byDow.reduce((a, b) => a + b, 0), 4);
  // no posts at all: honest nulls, not zeros pretending to be measurements
  const empty = S.cadence([], from, to);
  assert.equal(empty.total, 0);
  assert.equal(empty.longestGapDays, null);
});

test('cadence counts the trailing silence up to now', () => {
  const from = new Date(2026, 6, 1).getTime();
  const to = new Date(2026, 6, 31).getTime();
  const c = S.cadence([{ scheduled_at: new Date(2026, 6, 2).toISOString() }], from, to);
  assert.equal(Math.round(c.longestGapDays), 29, 'a month of nothing since the last post is the headline');
});

test('slot adherence reports how much of the queue is actually being used', () => {
  const posts = [
    { scheduled_at: new Date(2026, 7, 24, 9, 0).toISOString() },   // Monday 09:00 — on slot
    { scheduled_at: new Date(2026, 7, 24, 9, 8).toISOString() },   // within tolerance
    { scheduled_at: new Date(2026, 7, 25, 13, 0).toISOString() },  // Tuesday 13:00 — off slot
  ];
  const a = S.slotAdherence(posts, SLOTS, 10);
  assert.equal(a.slots, 3, 'the inactive slot does not count');
  assert.equal(a.onSlot, 2);
  assert.equal(a.offSlot, 1);
  assert.equal(Math.round(a.pct), 67);
  assert.equal(S.slotAdherence([], SLOTS).pct, null, 'no posts means no percentage, not 0%');
});

test('content anatomy counts what is really in the posts', () => {
  const posts = [
    { body: 'Kalimera #zoi #greece https://zoi.city', channels: ['facebook', 'instagram'], media: [{ url: 'x' }] },
    { body: 'Short one', channels: ['facebook'], media: [] },
    { body: 'Another #zoi', channels: ['x'] },
  ];
  const a = S.contentAnatomy(posts);
  assert.equal(a.totals.posts, 3);
  assert.equal(a.totals.withMedia, 1);
  assert.equal(a.totals.withLink, 1);
  assert.equal(a.totals.withHashtag, 2);
  assert.equal(a.topTags[0].tag, '#zoi');
  assert.equal(a.topTags[0].count, 2);
  const fb = a.nets.find((n) => n.key === 'facebook');
  assert.equal(fb.posts, 2);
  assert.equal(fb.name, 'Facebook');
  assert.ok(fb.avgChars > 0);
  const empty = S.contentAnatomy([]);
  assert.equal(empty.totals.posts, 0);
  assert.equal(empty.avgChars, null, 'an average of nothing is not zero');
});

test('channel ids are resolved to platforms, or every chart is labelled "Ch-7f3"', () => {
  // Posts store channel IDs, not platform names. Without the resolver the
  // network breakdown was labelled with database ids — which is what shipped.
  const posts = [{ body: 'hello', channels: ['ch-7f3', 'ch-9aa'] }];
  const bare = S.contentAnatomy(posts);
  assert.deepEqual(bare.nets.map((n) => n.name), ['ch-7f3', 'ch-9aa'], 'unresolved, the id leaks into the label');
  const resolve = (id) => ({ 'ch-7f3': 'facebook', 'ch-9aa': 'twitter' })[id];
  const named = S.contentAnatomy(posts, resolve);
  assert.deepEqual(named.nets.map((n) => n.name).sort(), ['Facebook', 'X'], 'twitter folds into X');
  // a platform name that needs no resolving must not be sent through it
  const direct = S.contentAnatomy([{ body: 'x', channels: ['instagram'] }], () => { throw new Error('should not be called'); });
  assert.equal(direct.nets[0].name, 'Instagram');
});

/* ---------------- time and links ---------------- */

test('local input values round-trip without drifting a day', () => {
  const d = new Date(2026, 0, 1, 0, 5, 0, 0);
  const v = S.localInputValue(d);
  assert.equal(v, '2026-01-01T00:05');
  assert.equal(S.fromLocalInput(v).getTime(), d.getTime());
  assert.equal(S.fromDateTimeInputs('2026-01-01', '00:05').getTime(), d.getTime());
  assert.equal(S.fromLocalInput('nonsense'), null);
  assert.equal(S.fromDateTimeInputs('', '09:00'), null);
  assert.equal(S.fromDateTimeInputs('2026-01-01', 'bad'), null);
});

test('the timezone is stated, not assumed', () => {
  assert.ok(S.tzName().length > 0);
  assert.match(S.tzOffsetLabel(new Date(2026, 0, 1)), /^UTC[+-]\d{2}:\d{2}$/);
});

test('UTM parameters survive an existing query string and a fragment', () => {
  assert.equal(S.utmUrl('https://zoi.city/shop', { source: 'ig', medium: 'social' }),
    'https://zoi.city/shop?utm_source=ig&utm_medium=social');
  assert.equal(S.utmUrl('https://zoi.city/shop?ref=a', { source: 'ig' }),
    'https://zoi.city/shop?ref=a&utm_source=ig');
  assert.equal(S.utmUrl('https://zoi.city/shop#menu', { source: 'ig' }),
    'https://zoi.city/shop?utm_source=ig#menu', 'the fragment must stay last or the link breaks');
  assert.equal(S.utmUrl('https://zoi.city/shop', {}), 'https://zoi.city/shop', 'no params, no question mark');
  assert.equal(S.utmUrl('https://zoi.city/shop', { campaign: 'spring sale' }),
    'https://zoi.city/shop?utm_campaign=spring%20sale', 'values are encoded');
  assert.equal(S.utmUrl('', { source: 'x' }), '');
});

test('the CSV parser handles quotes, commas and blank lines', () => {
  const rows = S.parseCSV('date,time,body\n2026-08-25,09:30,"Hello, world"\n\n2026-08-26,10:00,"He said ""yes"""\n');
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[1], ['2026-08-25', '09:30', 'Hello, world']);
  assert.deepEqual(rows[2], ['2026-08-26', '10:00', 'He said "yes"']);
  assert.deepEqual(S.parseCSV(''), []);
});

/* ---------------- drafts and handoff ---------------- */

test('a draft survives a reload but is never restored silently', () => {
  const store = fakeStore();
  assert.equal(S.loadDraft('ws1', store), null);
  S.saveDraft('ws1', { body: 'half-written post' }, store);
  const back = S.loadDraft('ws1', store);
  assert.equal(back.draft.body, 'half-written post');
  assert.ok(back.at > 0, 'the age is stored so the UI can say how old it is');
  assert.equal(S.loadDraft('ws2', store), null, 'drafts are per workspace');
  S.clearDraft('ws1', store);
  assert.equal(S.loadDraft('ws1', store), null);
});

test('an empty draft is not worth offering back', () => {
  assert.equal(S.draftIsMeaningful({ body: '' }), false);
  assert.equal(S.draftIsMeaningful({ body: '  ' }), false);
  assert.equal(S.draftIsMeaningful({ body: 'ok!' }), true);
  assert.equal(S.draftIsMeaningful({ body: '', media: ['http://x/y.jpg'] }), true);
  assert.equal(S.draftIsMeaningful(null), false);
});

test('storage being unavailable is survivable, not fatal', () => {
  const hostile = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceeded'); },
    removeItem() { throw new Error('nope'); },
  };
  assert.equal(S.saveDraft('ws', { body: 'x' }, hostile), false);
  assert.equal(S.loadDraft('ws', hostile), null);
  assert.equal(S.clearDraft('ws', hostile), false);
  assert.equal(S.setHandoff({ body: 'x' }, hostile), false);
  assert.equal(S.takeHandoff(hostile), null);
});

test('a calendar-to-composer handoff is consumed exactly once', () => {
  const store = fakeStore();
  S.setHandoff({ body: 'Χρόνια πολλά', scheduledAt: '2026-08-15T09:00' }, store);
  const got = S.takeHandoff(store);
  assert.equal(got.body, 'Χρόνια πολλά');
  assert.equal(S.takeHandoff(store), null, 'a second mount must not re-apply it');
});
