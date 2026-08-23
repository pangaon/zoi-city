// assets/tickets/lib.js holds the parts of /tickets where being wrong costs
// something real: capacity maths (a tier claiming seats it does not have), ICS
// generation (a calendar invite that silently fails to import), the offline
// check-in queue (a scan reported as confirmed when it never reached the
// server), and the door decision (the single function that decides what a
// volunteer is told). None of it touches the DOM, so all of it is testable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const g = {};
new Function('window', 'globalThis',
  readFileSync(new URL('../../assets/tickets/lib.js', import.meta.url), 'utf8'))(g, g);
const L = g.ZoiTicketsLib;

/* ───────────────────────── code normalisation ───────────────────────── */

test('a scanned ticket URL yields the code, not the URL', () => {
  assert.equal(L.normalizeCode('https://www.zoi.city/tickets?e=abc-123&c=zk7-4qx'), 'ZK7-4QX');
  assert.equal(L.normalizeCode('https://www.zoi.city/tickets?c=ZK74QX&e=x'), 'ZK74QX');
  assert.equal(L.normalizeCode('https://www.zoi.city/tickets?code=zk7-4qx'), 'ZK7-4QX');
  // percent-encoded values survive
  assert.equal(L.normalizeCode('https://zoi.city/t?c=ZK7%2D4QX'), 'ZK7-4QX');
  // no ?c= — fall back to the last path segment
  assert.equal(L.normalizeCode('https://zoi.city/ticket/ZK7-4QX'), 'ZK7-4QX');
  assert.equal(L.normalizeCode('https://zoi.city/ticket/ZK7-4QX/'), 'ZK7-4QX');
});

test('a code typed by a volunteer under pressure is still recognised', () => {
  assert.equal(L.normalizeCode('  zk7-4qx '), 'ZK7-4QX');
  assert.equal(L.normalizeCode('zk7 4qx'), 'ZK74QX');
  assert.equal(L.normalizeCode('ZK7–4QX'), 'ZK74QX', 'an en dash is not a hyphen and must not become one');
  assert.equal(L.normalizeCode('-ZK7-4QX-'), 'ZK7-4QX');
});

test('nothing usable normalises to the empty string, never to a lookup', () => {
  for (const bad of ['', '   ', null, undefined, '???', 'https://zoi.city/', '//']) {
    assert.equal(L.normalizeCode(bad), '', JSON.stringify(bad));
  }
});

/* ───────────────────────── capacity maths ───────────────────────── */

test('an uncapped tier is unlimited, not zero', () => {
  const m = L.tierMath({ capacity: null, reserved: 12, price_cents: 0 });
  assert.equal(m.unlimited, true);
  assert.equal(m.left, null, 'there is no honest number for "left" without a cap');
  assert.equal(m.pct, null);
  assert.equal(m.soldOut, false);
  assert.equal(m.reserved, 12);
});

test('a full tier is sold out and never reports negative availability', () => {
  assert.equal(L.tierMath({ capacity: 10, reserved: 10 }).left, 0);
  assert.equal(L.tierMath({ capacity: 10, reserved: 10 }).soldOut, true);
  // over-sold data (a race, or a manual DB edit) must clamp, not go negative
  const over = L.tierMath({ capacity: 10, reserved: 14 });
  assert.equal(over.left, 0);
  assert.equal(over.pct, 100);
  assert.equal(over.soldOut, true);
});

test("the server's sold_out flag wins over our own arithmetic", () => {
  const m = L.tierMath({ capacity: 100, reserved: 3, sold_out: true });
  assert.equal(m.soldOut, true, 'the organiser may have closed sales early');
  assert.equal(m.left, 97, 'but we still report the real remaining count');
});

test('capacity percentages and urgency levels line up', () => {
  assert.equal(L.tierMath({ capacity: 100, reserved: 0 }).pct, 0);
  assert.equal(L.tierMath({ capacity: 100, reserved: 64 }).level, 'high');
  assert.equal(L.tierMath({ capacity: 100, reserved: 65 }).level, 'med');
  assert.equal(L.tierMath({ capacity: 100, reserved: 89 }).level, 'med');
  assert.equal(L.tierMath({ capacity: 100, reserved: 90 }).level, 'low');
  assert.equal(L.tierMath({ capacity: 3, reserved: 1 }).pct, 33);
});

test('nonsense capacity values are treated as no cap rather than believed', () => {
  for (const bad of ['', 'lots', NaN, Infinity, -5]) {
    const m = L.tierMath({ capacity: bad, reserved: 2 });
    assert.equal(m.unlimited, true, JSON.stringify(String(bad)));
    assert.equal(m.left, null);
  }
});

test('a rollup refuses to invent an event capacity when any tier is uncapped', () => {
  const r = L.rollup([
    { capacity: 50, reserved: 10, price_cents: 0 },
    { capacity: null, reserved: 5, price_cents: 2500 },
  ]);
  assert.equal(r.reserved, 15, 'reserved is still a real sum');
  assert.equal(r.capacity, null, 'a partial capacity total would read as the event capacity');
  assert.equal(r.left, null);
  assert.equal(r.pct, null);
  assert.equal(r.hasUnlimited, true);
  assert.equal(r.freeTiers, 1);
  assert.equal(r.paidTiers, 1);
});

test('a rollup adds up capped tiers and only says sold out when all of them are', () => {
  const partly = L.rollup([{ capacity: 10, reserved: 10 }, { capacity: 10, reserved: 4 }]);
  assert.equal(partly.capacity, 20);
  assert.equal(partly.reserved, 14);
  assert.equal(partly.left, 6);
  assert.equal(partly.pct, 70);
  assert.equal(partly.soldOut, false);
  const all = L.rollup([{ capacity: 10, reserved: 10 }, { capacity: 4, reserved: 4 }]);
  assert.equal(all.soldOut, true);
  // and an event with no tiers is not "sold out", it is unpublished
  assert.equal(L.rollup([]).soldOut, false);
  assert.equal(L.rollup([]).tiers, 0);
});

test('capacity warnings only fire on real thresholds and quote real numbers', () => {
  assert.equal(L.capacityWarning(L.rollup([])), null, 'no tiers, nothing to warn about');
  assert.equal(L.capacityWarning(L.rollup([{ capacity: null, reserved: 900 }])), null,
    'an uncapped tier can never be a capacity warning');
  assert.equal(L.capacityWarning(L.rollup([{ capacity: 100, reserved: 79 }])), null);
  const warn = L.capacityWarning(L.rollup([{ capacity: 100, reserved: 80 }]));
  assert.equal(warn.level, 'warn');
  assert.match(warn.text, /80% of capacity reserved — 20 left/);
  const crit = L.capacityWarning(L.rollup([{ capacity: 100, reserved: 96 }]));
  assert.equal(crit.level, 'critical');
  assert.match(crit.text, /4 tickets left of 100/);
  assert.match(L.capacityWarning(L.rollup([{ capacity: 100, reserved: 99 }])).text, /1 ticket left/,
    'singular, because "1 tickets" reads like a bug');
  assert.equal(L.capacityWarning(L.rollup([{ capacity: 10, reserved: 10 }])).level, 'full');
});

/* ───────────────────────── door counts ───────────────────────── */

test('door counts sum seats, not rows, and split by tier', () => {
  const c = L.doorCounts([
    { type: 'General', qty: 2, checked_in: true },
    { type: 'General', qty: 3 },
    { type: 'VIP', qty: 1, checked_in: true },
    { type: 'VIP', qty: 1 },
  ]);
  assert.equal(c.sold, 7);
  assert.equal(c.checkedIn, 3);
  assert.equal(c.remaining, 4);
  assert.equal(c.reservations, 4);
  assert.equal(c.reservationsIn, 2);
  assert.equal(c.pct, 43);
  assert.deepEqual(c.tiers.map((t) => [t.name, t.checkedIn, t.sold]),
    [['General', 2, 5], ['VIP', 1, 2]]);
});

test('door counts survive missing and malformed rows without inventing numbers', () => {
  const c = L.doorCounts([{ qty: 0 }, { qty: null, type: '' }, {}]);
  assert.equal(c.sold, 3, 'a reservation is at least one seat');
  assert.equal(c.checkedIn, 0);
  assert.equal(c.tiers.length, 1);
  assert.equal(c.tiers[0].name, 'Unspecified tier');
  const empty = L.doorCounts([]);
  assert.equal(empty.sold, 0);
  assert.equal(empty.pct, 0, 'zero of zero is 0%, not NaN');
  assert.deepEqual(L.doorCounts(null).tiers, []);
});

/* ───────────────────────── attendee list ───────────────────────── */

const ROWS = [
  { name: 'Maria Papadopoulos', email: 'maria@example.com', type: 'VIP', code: 'ZK7-4QX', qty: 2, paid: true, checked_in: true, created_at: '2026-08-01T10:00:00Z' },
  { name: 'Nikos Ioannou', email: 'nikos@example.com', type: 'General', code: 'AB1-2CD', qty: 1, paid: false, checked_in: false, created_at: '2026-08-03T10:00:00Z' },
  { name: 'Eleni Georgiou', email: 'eleni@example.com', type: 'General', code: 'XY9-8ZW', qty: 4, paid: false, checked_in: false, created_at: '2026-08-02T10:00:00Z' },
];

test('attendee search covers name, email, tier and code', () => {
  const f = (q) => L.filterSortAttendees(ROWS, { q }).map((r) => r.name);
  assert.deepEqual(f('maria'), ['Maria Papadopoulos']);
  assert.deepEqual(f('EXAMPLE.COM').length, 3);
  assert.deepEqual(f('general').sort(), ['Eleni Georgiou', 'Nikos Ioannou']);
  assert.deepEqual(f('zk7-4qx'), ['Maria Papadopoulos'], 'a code typed at the door must find its row');
  assert.deepEqual(f('zk74qx'), ['Maria Papadopoulos'], 'even without the hyphen');
  assert.deepEqual(f('nobody'), []);
});

test('attendee filters and sorts do what their labels say', () => {
  const names = (o) => L.filterSortAttendees(ROWS, o).map((r) => r.name);
  assert.deepEqual(names({ status: 'in' }), ['Maria Papadopoulos']);
  assert.deepEqual(names({ status: 'out' }).length, 2);
  assert.deepEqual(names({ status: 'paid' }), ['Maria Papadopoulos']);
  assert.deepEqual(names({ status: 'unpaid' }).length, 2);
  assert.deepEqual(names({ tier: 'VIP' }), ['Maria Papadopoulos']);
  assert.deepEqual(names({ sort: 'qty' })[0], 'Eleni Georgiou', 'largest party first');
  assert.deepEqual(names({ sort: 'newest' })[0], 'Nikos Ioannou');
  assert.deepEqual(names({ sort: 'oldest' })[0], 'Maria Papadopoulos');
  assert.deepEqual(names({ sort: 'status' })[0] !== 'Maria Papadopoulos', true, 'not-yet-in first');
  assert.deepEqual(names({ sort: 'name', dir: 'desc' })[0], 'Nikos Ioannou');
  assert.deepEqual(L.filterSortAttendees(ROWS, {}).length, 3, 'no options means no filtering');
  assert.deepEqual(L.filterSortAttendees(null, {}), []);
});

test('filtering never mutates the list it was given', () => {
  const before = JSON.stringify(ROWS);
  L.filterSortAttendees(ROWS, { sort: 'qty', dir: 'desc' });
  assert.equal(JSON.stringify(ROWS), before);
});

test('tier options come from the data, deduplicated and sorted', () => {
  assert.deepEqual(L.tiersIn(ROWS), ['General', 'VIP']);
  assert.deepEqual(L.tiersIn([{ type: '' }, {}, null]), []);
});

/* ───────────────────────── CSV ───────────────────────── */

test('CSV export quotes, escapes and neutralises formula injection', () => {
  const csv = L.toCsv([
    { name: 'O"Brien, Sean', email: 'a@b.c', type: 'VIP', code: 'X1', qty: 2, paid: true, checked_in: false, created_at: '' },
    { name: '=cmd|calc', email: '+1555', type: '', code: '', qty: 1, paid: false, checked_in: true, created_at: '' },
  ], L.ATTENDEE_COLUMNS);
  assert.ok(csv.startsWith('﻿'), 'a BOM so Excel reads Greek names as UTF-8');
  assert.ok(csv.includes('"O""Brien, Sean"'), 'quotes doubled, comma kept inside the field');
  assert.ok(csv.includes('"\'=cmd|calc"'), 'a leading = must not become a spreadsheet formula');
  assert.ok(csv.includes('"\'+1555"'));
  assert.ok(csv.includes('"paid"') && csv.includes('"reserved (unpaid)"'));
  assert.ok(csv.includes('"yes"') && csv.includes('"no"'));
  assert.ok(csv.includes('\r\n'), 'RFC 4180 line endings');
  assert.equal(csv.trim().split('\r\n').length, 3, 'header plus two rows');
});

test('an empty CSV still has its header row', () => {
  const csv = L.toCsv([], L.ATTENDEE_COLUMNS);
  assert.equal(csv.replace('﻿', '').trim(), L.ATTENDEE_COLUMNS.map((c) => '"' + c.label + '"').join(','));
});

/* ───────────────────────── ICS ───────────────────────── */

function icsLines(text) { return text.split('\r\n'); }

test('an ICS file has the required structure and CRLF line endings', () => {
  const ics = L.buildIcs({
    uid: 'zoi-1@zoi.city', name: 'Panigiri', start: '2026-09-01T18:00:00Z',
    now: new Date('2026-08-01T00:00:00Z'),
  });
  const lines = icsLines(ics);
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(lines.includes('VERSION:2.0'));
  assert.ok(lines.includes('BEGIN:VEVENT'));
  assert.ok(lines.includes('END:VEVENT'));
  assert.ok(lines.includes('UID:zoi-1@zoi.city'));
  assert.ok(lines.includes('DTSTAMP:20260801T000000Z'));
  assert.ok(lines.includes('DTSTART:20260901T180000Z'));
  assert.ok(lines.includes('DTEND:20260901T210000Z'), 'a default three-hour event');
  // every line that is not a continuation must be PROPERTY:value
  for (const line of lines.filter(Boolean)) {
    if (line.startsWith(' ')) continue;
    assert.match(line, /^[A-Z-]+(;[^:]*)?:/, 'malformed line: ' + line);
  }
});

test('ICS text escaping follows RFC 5545, so commas do not split fields', () => {
  const ics = L.buildIcs({
    name: 'Feast, Dance; and Back\\slash',
    description: 'Line one\nLine two',
    location: 'Toronto, ON',
    start: '2026-09-01T18:00:00Z',
    now: new Date(0),
  });
  assert.ok(ics.includes('SUMMARY:Feast\\, Dance\\; and Back\\\\slash'));
  assert.ok(ics.includes('DESCRIPTION:Line one\\nLine two'));
  assert.ok(ics.includes('LOCATION:Toronto\\, ON'));
  assert.equal(L.icsEscape('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
});

test('long lines are folded at 75 octets, counting UTF-8 bytes not characters', () => {
  const greek = 'Π'.repeat(60); // 120 bytes, 60 characters
  const folded = L.icsFold('SUMMARY:' + greek);
  const parts = folded.split('\r\n');
  assert.ok(parts.length > 1, 'must fold');
  for (const p of parts) {
    assert.ok(Buffer.byteLength(p, 'utf8') <= 75, 'a line was ' + Buffer.byteLength(p, 'utf8') + ' bytes');
  }
  for (const p of parts.slice(1)) assert.ok(p.startsWith(' '), 'continuations begin with one space');
  // unfolding reproduces the original
  assert.equal(parts.map((p, i) => (i ? p.slice(1) : p)).join(''), 'SUMMARY:' + greek);
  // and a short line is left alone
  assert.equal(L.icsFold('SUMMARY:short'), 'SUMMARY:short');
});

test('a real event survives folding and is still parseable line by line', () => {
  const ics = L.buildIcs({
    name: 'Πανηγύρι της Παναγίας — Greek Summer Festival, Toronto Edition 2026',
    description: 'Δείτε μας εκεί. '.repeat(12),
    location: 'Hellenic Community Centre, 30 Thorncliffe Park Drive, Toronto, ON, Canada',
    url: 'https://www.zoi.city/tickets?e=8f3c1a2b-4d5e-6f70-8912-abcdef012345&c=ZK7-4QX',
    start: '2026-09-01T18:00:00Z', end: '2026-09-01T23:30:00Z', now: new Date(0),
  });
  for (const line of icsLines(ics).filter(Boolean)) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, 'unfolded line: ' + line);
  }
  assert.ok(ics.includes('DTEND:20260901T233000Z'), 'an explicit end time is respected');
  // unfold, then check the values are intact
  const unfolded = ics.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('URL:https://www.zoi.city/tickets?e=8f3c1a2b-4d5e-6f70-8912-abcdef012345&c=ZK7-4QX'));
  assert.ok(unfolded.includes('SUMMARY:Πανηγύρι της Παναγίας — Greek Summer Festival\\, Toronto Edition 2026'));
});

test('an event with no usable start throws rather than downloading a broken file', () => {
  for (const bad of [undefined, null, '', 'not a date', 'TBD']) {
    assert.throws(() => L.buildIcs({ name: 'x', start: bad }), /valid start time/,
      'start = ' + JSON.stringify(bad));
  }
});

test('a nonsense duration falls back to three hours instead of an inverted event', () => {
  const ics = L.buildIcs({ name: 'x', start: '2026-09-01T18:00:00Z', durationMinutes: -60, now: new Date(0) });
  assert.ok(ics.includes('DTEND:20260901T210000Z'));
  const ics2 = L.buildIcs({ name: 'x', start: '2026-09-01T18:00:00Z', end: 'garbage', now: new Date(0) });
  assert.ok(ics2.includes('DTEND:20260901T210000Z'));
  const ics3 = L.buildIcs({ name: 'x', start: '2026-09-01T18:00:00Z', durationMinutes: 45, now: new Date(0) });
  assert.ok(ics3.includes('DTEND:20260901T184500Z'));
});

test('optional ICS properties are omitted, not emitted empty', () => {
  const ics = L.buildIcs({ name: 'x', start: '2026-09-01T18:00:00Z', now: new Date(0) });
  for (const prop of ['DESCRIPTION', 'LOCATION', 'URL', 'ORGANIZER']) {
    assert.ok(!ics.includes(prop + ':'), prop + ' should be absent when we have no value');
  }
});

/* ───────────────────────── offline check-in queue ───────────────────────── */

const Q = () => L.Queue;

test('a queued scan is recorded once, however many times it is scanned', () => {
  let s = Q().create();
  const a = Q().enqueue(s, 'zk7-4qx', 1000);
  s = a.state;
  assert.equal(a.duplicate, false);
  assert.equal(a.item.code, 'ZK7-4QX', 'stored normalised, so retries hit the same code');
  const b = Q().enqueue(s, 'ZK7-4QX', 1200);
  s = b.state;
  assert.equal(b.duplicate, true, 'double-scanning offline must not queue two check-ins');
  assert.equal(Q().counts(s).total, 1);
  // a genuinely different code is a separate item
  s = Q().enqueue(s, 'AB1-2CD', 1300).state;
  assert.equal(Q().counts(s).total, 2);
});

test('an unusable scan is never queued', () => {
  const r = Q().enqueue(Q().create(), '   ', 1000);
  assert.equal(r.empty, true);
  assert.equal(r.item, null);
  assert.equal(Q().counts(r.state).total, 0);
});

test('retries back off, and a hopeless item becomes visibly stuck rather than vanishing', () => {
  let s = Q().enqueue(Q().create(), 'ZK7', 0).state;
  const id = s.items[0].id;
  assert.equal(Q().due(s, 0).id, id, 'the first attempt is immediate');

  s = Q().fail(s, id, 'no connection', 1000);
  assert.equal(s.items[0].attempts, 1);
  assert.equal(s.items[0].status, 'pending');
  assert.equal(s.items[0].nextAt, 1000 + Q().backoff(0),
    'the FIRST retry must use the first backoff step, not skip it');
  assert.equal(Q().backoff(0), 1500, 'and that step is a second and a half, not four seconds');
  assert.equal(Q().due(s, 1000), null, 'not due yet');
  assert.equal(Q().due(s, 1000 + Q().backoff(0)).id, id, 'due once the backoff has elapsed');
  s = Q().fail(s, id, 'no connection', 5000);
  assert.equal(s.items[0].nextAt, 5000 + Q().backoff(1), 'the second retry uses the second step');

  // the delay grows, then plateaus rather than growing forever
  let prev = 0;
  for (let a = 0; a <= 6; a++) {
    const d = Q().backoff(a);
    assert.ok(d >= prev, 'backoff must not shrink');
    prev = d;
  }
  assert.equal(Q().backoff(6), Q().backoff(99), 'the delay is capped');

  let t = 6000;
  // two failures already recorded above
  for (let i = 2; i < Q().MAX_ATTEMPTS; i++) { s = Q().fail(s, id, 'no connection', t); t += 100000; }
  assert.equal(s.items[0].attempts, Q().MAX_ATTEMPTS);
  assert.equal(s.items[0].status, 'stuck');
  assert.equal(Q().counts(s).stuck, 1);
  assert.equal(Q().counts(s).pending, 0);
  assert.equal(Q().counts(s).total, 1, 'still on the list, still visible to the volunteer');
  assert.equal(Q().due(s, t), null, 'a stuck item is not retried automatically');

  // and a human can put it back
  s = Q().revive(s, id, t);
  assert.equal(s.items[0].status, 'pending');
  assert.equal(s.items[0].attempts, 0);
  assert.equal(Q().due(s, t).id, id);
});

test('a scan is only removed by success or by an explicit human decision', () => {
  let s = Q().enqueue(Q().create(), 'ZK7', 0).state;
  s = Q().enqueue(s, 'AB1', 0).state;
  const first = s.items[0].id;
  s = Q().done(s, first);
  assert.equal(Q().counts(s).total, 1);
  assert.equal(s.items[0].code, 'AB1');
  // drop is the honest undo: same operation, applied to something never sent
  s = Q().drop(s, s.items[0].id);
  assert.equal(Q().counts(s).total, 0);
  assert.equal(Q().drop === Q().done, true, 'undo cannot be anything more than "never sent it"');
  // removing an id that is not there is a no-op, not a crash
  assert.equal(Q().counts(Q().done(s, 999)).total, 0);
});

test('the queue survives a reload, and corrupt storage does not lose the good rows', () => {
  const mem = {
    data: {},
    getItem(k) { return k in this.data ? this.data[k] : null; },
    setItem(k, v) { this.data[k] = String(v); },
  };
  let s = Q().enqueue(Q().create(), 'ZK7-4QX', 500).state;
  s = Q().enqueue(s, 'AB1-2CD', 600).state;
  assert.equal(Q().save(mem, 'k', s), true);
  const back = Q().load(mem, 'k');
  assert.deepEqual(back.items.map((i) => i.code), ['ZK7-4QX', 'AB1-2CD']);
  assert.equal(back.items[0].queuedAt, 500, 'when it was scanned matters at the door');
  assert.equal(Q().counts(back).total, 2);
  // ids stay unique after a reload
  const after = Q().enqueue(back, 'NEW-1', 700);
  assert.equal(new Set(after.state.items.map((i) => i.id)).size, 3);

  // unparseable storage is an empty queue, not a thrown page
  mem.data.k = '{not json';
  assert.deepEqual(Q().load(mem, 'k').items, []);
  // partially corrupt state keeps what is usable
  mem.data.k = JSON.stringify({ seq: 2, items: [{ code: 'GOOD' }, { code: '' }, null, { nope: 1 }] });
  const salvaged = Q().load(mem, 'k');
  assert.deepEqual(salvaged.items.map((i) => i.code), ['GOOD']);
  assert.equal(salvaged.items[0].status, 'pending');
  assert.ok(salvaged.items[0].id > 0);
  // storage that throws (Safari private mode) is survivable
  const hostile = { getItem() { throw new Error('nope'); }, setItem() { throw new Error('nope'); } };
  assert.deepEqual(Q().load(hostile, 'k').items, []);
  assert.equal(Q().save(hostile, 'k', s), false);
});

test('due() picks pending work in scan order and ignores what is not ready', () => {
  let s = Q().enqueue(Q().create(), 'FIRST', 0).state;
  s = Q().enqueue(s, 'SECOND', 10).state;
  assert.equal(Q().due(s, 100).code, 'FIRST');
  s = Q().fail(s, s.items[0].id, 'x', 100);
  assert.equal(Q().due(s, 100).code, 'SECOND', 'the backed-off item steps aside');
  assert.equal(Q().pending(s).length, 2);
  assert.equal(Q().due(Q().create(), 0), null);
});

/* ───────────────────────── door decision ───────────────────────── */

test('a first check-in is an accept, with the details the door needs', () => {
  const d = L.decide({ response: { ok: true, name: 'Maria', qty: 2, type: 'VIP', paid: true } });
  assert.equal(d.kind, 'accepted');
  assert.equal(d.who, 'Maria');
  assert.equal(d.qty, 2);
  assert.match(d.detail, /VIP/);
  assert.match(d.detail, /2 tickets/);
  assert.match(d.detail, /paid/);
  assert.match(L.decide({ response: { ok: true, qty: 1, paid: false } }).detail, /1 ticket · reserved \(unpaid\)/);
});

test('a second scan of the same code is a duplicate, and the time is never invented', () => {
  const withTime = L.decide({ response: { ok: true, already: true, name: 'Maria', qty: 1, checked_in_at: '2026-09-01T18:42:00Z' } });
  assert.equal(withTime.kind, 'duplicate');
  assert.equal(withTime.who, 'Maria');
  assert.equal(withTime.whenUnknown, false);
  assert.ok(withTime.whenText, 'a reported time is shown');

  const withoutTime = L.decide({ response: { ok: true, already: true, name: 'Maria', qty: 1 } });
  assert.equal(withoutTime.kind, 'duplicate');
  assert.equal(withoutTime.whenUnknown, true);
  assert.equal(withoutTime.whenText, null, 'no timestamp means no timestamp, not "just now"');
});

test('an unknown code is reported as unknown, and a dead connection as queued', () => {
  assert.equal(L.decide({ response: { ok: false } }).kind, 'unknown');
  assert.equal(L.decide({ response: { found: false } }).kind, 'unknown');
  const q = L.decide({ error: new Error('Failed to fetch') });
  assert.equal(q.kind, 'queued');
  assert.match(q.detail, /NOT yet confirmed/, 'the wording must not imply a check-in happened');
  assert.equal(L.decide({ empty: true }).kind, 'invalid');
  assert.equal(L.decide({}).kind, 'queued', 'no response and no error is still not a confirmation');
});

/* ───────────────────────── printable manifest ───────────────────────── */

test('the manifest is a self-contained page with real counts and escaped content', () => {
  const html = L.manifestHtml(ROWS, { eventName: 'Panigiri <2026>', whenText: 'Sat 1 Sep', place: 'Toronto', now: 0 });
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('<title>Panigiri &lt;2026&gt; — door manifest</title>'), 'title escaped');
  assert.ok(!html.includes('<2026>'), 'no unescaped angle brackets from event data');
  assert.ok(!/https?:\/\//.test(html.replace(/[^\s]*schema[^\s]*/g, '')), 'nothing external to load at a printer');
  assert.ok(html.includes('<b>3</b> reservations'));
  assert.ok(html.includes('<b>7</b> seats reserved'));
  assert.ok(html.includes('<b>2</b> already checked in'));
  assert.ok(html.includes('ZK7-4QX'));
  assert.ok(html.includes('&#9632;'), 'a filled box for someone already in');
  assert.ok(html.includes('&#9633;'), 'an empty box to tick');
  assert.match(html, /ticks on paper are not recorded in Zoi/, 'the snapshot caveat must be on the sheet');
});

test('a manifest for an event with nobody on it says so', () => {
  const html = L.manifestHtml([], { eventName: 'Quiet night' });
  assert.ok(html.includes('No reservations for this event yet.'));
  assert.ok(html.includes('<b>0</b> reservations'));
});

/* ───────────────────────── schema.org ───────────────────────── */

test('event JSON-LD only claims what the event data actually says', () => {
  const ld = L.eventJsonLd(
    { name: 'Panigiri', event_at: '2026-09-01T18:00:00Z', city: 'Toronto', country: 'Canada', description: 'A feast' },
    [{ name: 'General', price_cents: 0, currency: 'USD', capacity: 10, reserved: 2 },
      { name: 'VIP', price_cents: 4500, currency: 'CAD', capacity: 5, reserved: 5 }],
    'https://www.zoi.city/tickets?e=1');
  assert.equal(ld['@type'], 'Event');
  assert.equal(ld.startDate, '2026-09-01T18:00:00.000Z');
  assert.equal(ld.location.address.addressLocality, 'Toronto');
  assert.equal(ld.offers.length, 2);
  assert.equal(ld.offers[0].price, '0.00');
  assert.equal(ld.offers[0].availability, 'https://schema.org/InStock');
  assert.equal(ld.offers[1].price, '45.00');
  assert.equal(ld.offers[1].priceCurrency, 'CAD');
  assert.equal(ld.offers[1].availability, 'https://schema.org/SoldOut');
  assert.ok(JSON.stringify(ld).length > 0);
});

test('event JSON-LD omits what it does not know instead of guessing', () => {
  const ld = L.eventJsonLd({ name: 'Mystery' }, [], 'https://x/y');
  assert.equal(ld.startDate, undefined, 'no date means no startDate claim');
  assert.equal(ld.location, undefined);
  assert.equal(ld.offers, undefined, 'no tiers means no offers, not a free offer');
  assert.equal(ld.description, undefined);
  const bad = L.eventJsonLd({ name: 'x', event_at: 'not a date' }, [], 'u');
  assert.equal(bad.startDate, undefined);
});

/* ───────────────────────── formatting ───────────────────────── */

test('money, dates and plurals do not produce nonsense', () => {
  assert.equal(L.fmtMoney(0), 'Free');
  assert.equal(L.fmtMoney(null), 'Free');
  assert.match(L.fmtMoney(4500, 'USD'), /45/);
  assert.match(L.fmtMoney(4500, 'NOTACURRENCY'), /45\.00/, 'a bad currency code must not throw');
  assert.equal(L.fmtWhen(null), null);
  assert.equal(L.fmtWhen('not a date'), null);
  assert.ok(L.fmtWhen('2026-09-01T18:00:00Z'));
  assert.equal(L.fmtClock('nope'), '');
  assert.equal(L.plural(1, 'ticket'), 'ticket');
  assert.equal(L.plural(0, 'ticket'), 'tickets');
  assert.equal(L.plural(2, 'reservation'), 'reservations');
  assert.equal(L.plural(2, 'person', 'people'), 'people');
});

test('escaping covers every character that could break out of an attribute', () => {
  assert.equal(L.esc('<img src=x onerror="y">'), '&lt;img src=x onerror=&quot;y&quot;&gt;');
  assert.equal(L.esc("it's & that"), 'it&#39;s &amp; that');
  assert.equal(L.esc(null), '');
  assert.equal(L.esc(0), '0');
});

test('re-scanning a code that the queue gave up on retries it instead of queueing it twice', () => {
  let s = Q().enqueue(Q().create(), 'ZK7-4QX', 0).state;
  const id = s.items[0].id;
  let t = 1000;
  for (let i = 0; i < Q().MAX_ATTEMPTS; i++) { s = Q().fail(s, id, 'no connection', t); t += 100000; }
  assert.equal(s.items[0].status, 'stuck');
  const again = Q().enqueue(s, 'zk7-4qx', t);
  s = again.state;
  assert.equal(again.duplicate, true, 'still one code');
  assert.equal(again.revived, true, 'and it has been put back in the queue');
  assert.equal(Q().counts(s).total, 1, 'never two entries for one code');
  assert.equal(Q().counts(s).pending, 1);
  assert.equal(Q().counts(s).stuck, 0);
  assert.equal(Q().due(s, t).id, id, 'and it is due immediately');
});

test('a malformed percent escape in a scanned URL does not throw', () => {
  // decodeURIComponent throws URIError on these. From the camera loop the throw
  // was swallowed, so the scanner appeared to do nothing at all.
  for (const bad of ['https://z.city/t?c=100%', 'https://z.city/t?%zz=1&c=ABC-1',
    'https://z.city/t/%E0%A4%A', 'https://z.city/t?c=%']) {
    assert.doesNotThrow(() => L.normalizeCode(bad), 'input: ' + bad);
  }
  assert.equal(L.normalizeCode('https://z.city/t?%zz=1&c=ABC-1'), 'ABC-1',
    'and a good parameter beside a bad one is still read');
});

test('a tier with no price at all is left out of the JSON-LD rather than priced at zero', () => {
  const ld = L.eventJsonLd({ name: 'E' }, [
    { name: 'Known free', price_cents: 0, currency: 'USD' },
    { name: 'Price not returned' },
    { name: 'Price is nonsense', price_cents: 'lots' },
    { name: 'Known paid', price_cents: 2500, currency: 'EUR' },
  ], 'https://x');
  assert.deepEqual(ld.offers.map((o) => o.name), ['Known free', 'Known paid'],
    'claiming price 0.00 / InStock for an unknown price is a lie to every search engine');
  assert.equal(ld.offers[1].price, '25.00');
});

test('compactCode is punctuation- and case-blind, and never throws', () => {
  assert.equal(L.compactCode('zk7-4qx'), 'ZK74QX');
  assert.equal(L.compactCode('ZK7 4QX'), 'ZK74QX');
  assert.equal(L.compactCode(null), '');
  assert.equal(L.compactCode(12), '12');
});
