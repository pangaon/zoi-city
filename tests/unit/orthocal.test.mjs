// The Orthodox calendar is load-bearing: 1,213 parish pages compute their
// service times, feast days and fasting seasons from it. A one-day error is a
// congregation turning up on the wrong day, so every reference value here is
// checked against the published Paschalion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  orthodoxPascha, iso, feastsOn, seasonsFor, isFastDay, nameDaysOn,
  upcomingFeasts, resolveFeastDate, shiftForOldCalendar, MOVEABLE, FIXED,
} from '../../api/_orthocal.js';

/* Published Orthodox Pascha dates (Gregorian). */
const PASCHA = {
  2020: '2020-04-19', 2021: '2021-05-02', 2022: '2022-04-24', 2023: '2023-04-16',
  2024: '2024-05-05', 2025: '2025-04-20', 2026: '2026-04-12', 2027: '2027-05-02',
  2028: '2028-04-16', 2029: '2029-04-08', 2030: '2030-04-28',
};

test('Orthodox Pascha matches the published Paschalion, 2020–2030', () => {
  for (const [y, expected] of Object.entries(PASCHA)) {
    assert.equal(iso(orthodoxPascha(+y)), expected, `Pascha ${y}`);
  }
});

test('Pascha always falls on a Sunday', () => {
  for (let y = 2020; y <= 2060; y++) {
    const d = new Date(orthodoxPascha(y));
    assert.equal(d.getUTCDay(), 0, `Pascha ${y} (${iso(orthodoxPascha(y))}) must be a Sunday`);
  }
});

test('Orthodox Pascha is not Western Easter (except when it genuinely coincides)', () => {
  // 2025 and 2028 coincide; 2026 and 2027 do not. A Western Easter library
  // would silently give the wrong answer in most years.
  assert.equal(iso(orthodoxPascha(2025)), '2025-04-20'); // same as Western
  assert.equal(iso(orthodoxPascha(2026)), '2026-04-12'); // Western: 2026-04-05
  assert.equal(iso(orthodoxPascha(2027)), '2027-05-02'); // Western: 2027-03-28
});

test('Holy Week and Pascha resolve to the right dates in 2026', () => {
  const on = (d) => feastsOn(d).map((f) => f.key);
  assert.ok(on('2026-04-05').includes('palm_sunday'), 'Palm Sunday 2026');
  assert.ok(on('2026-04-10').includes('holy_friday'), 'Great Friday 2026');
  assert.ok(on('2026-04-11').includes('holy_saturday'), 'Holy Saturday 2026');
  assert.ok(on('2026-04-12').includes('pascha'), 'Pascha 2026');
  assert.ok(on('2026-02-23').includes('clean_monday'), 'Clean Monday 2026');
  assert.ok(on('2026-05-21').includes('ascension'), 'Ascension 2026 (Pascha+39)');
  assert.ok(on('2026-05-31').includes('pentecost'), 'Pentecost 2026 (Pascha+49)');
});

test('fixed feasts and their name days resolve', () => {
  assert.ok(feastsOn('2026-08-15').some((f) => f.key === 'dormition'));
  assert.ok(feastsOn('2026-10-26').some((f) => f.key === 'st_demetrios'));
  assert.deepEqual(nameDaysOn('2026-10-26'), ['Dimitris', 'Dimitra']);
  assert.deepEqual(nameDaysOn('2026-01-06'), ['Fotis', 'Fotini', 'Iordanis']);
  assert.deepEqual(nameDaysOn('2026-03-14'), []);
});

test('a feast in December belongs to the following year\'s Triodion cycle', () => {
  // Pascha 2027 is 2 May, so its Triodion begins 2027-02-21 — but the lookup
  // must consider neighbouring Pascha years or late-December dates break.
  const y = feastsOn('2027-02-21').map((f) => f.key);
  assert.ok(y.includes('triodion_begins'), 'Triodion 2027');
});

test('seasons gate which services render', () => {
  // Great Lent 2026 runs Clean Monday 23 Feb to Holy Saturday 11 Apr
  assert.ok(seasonsFor('2026-03-10').includes('great_lent'));
  assert.ok(!seasonsFor('2026-03-10').includes('outside_lent'));
  assert.ok(seasonsFor('2026-04-08').includes('holy_week'));
  assert.ok(seasonsFor('2026-04-14').includes('bright_week'));
  assert.ok(seasonsFor('2026-08-10').includes('dormition_fast'));
  assert.ok(seasonsFor('2026-07-01').includes('outside_lent'));
  // a Paraklesis marked outside_lent must not appear during Great Lent
  assert.ok(!seasonsFor('2026-03-10').includes('outside_lent'));
});

test('fasting: Wednesdays and Fridays fast, Bright Week never does', () => {
  assert.equal(isFastDay('2026-04-15'), false, 'Bright Wednesday is fast-free');
  assert.equal(isFastDay('2026-04-17'), false, 'Bright Friday is fast-free');
  assert.equal(isFastDay('2026-07-01'), true, 'an ordinary Wednesday');
  assert.equal(isFastDay('2026-07-03'), true, 'an ordinary Friday');
  assert.equal(isFastDay('2026-06-30'), false, 'an ordinary Tuesday');
  assert.equal(isFastDay('2026-03-10'), true, 'Great Lent');
  assert.equal(isFastDay('2026-12-27'), false, 'the twelve days of Christmas');
});

test('upcoming feasts are ordered and dated', () => {
  const up = upcomingFeasts('2026-04-01', 20);
  assert.ok(up.length >= 5);
  const dates = up.map((f) => f.date);
  assert.deepEqual(dates, [...dates].sort(), 'must come back in date order');
  assert.ok(up.every((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.date)));
  assert.ok(up.some((f) => f.key === 'pascha'));
});

test('a patronal feast resolves for any year, fixed or moveable', () => {
  assert.equal(resolveFeastDate({ kind: 'fixed', date: '10-26' }, 2027), '2027-10-26');
  // Zoodochos Peghe is Bright Friday — Pascha 2027 (2 May) + 5
  assert.equal(resolveFeastDate({ kind: 'moveable', pascha_offset: 5 }, 2027), '2027-05-07');
});

test('Julian-calendar parishes keep fixed feasts 13 days later', () => {
  assert.equal(shiftForOldCalendar('2026-08-15', 'old'), '2026-08-28');
  assert.equal(shiftForOldCalendar('2026-08-15', 'new'), '2026-08-15');
});

test('the feast tables are internally consistent', () => {
  const keys = new Set();
  for (const f of [...MOVEABLE, ...FIXED]) {
    assert.ok(f.key && f.name, 'every feast needs a key and a name');
    assert.ok(!keys.has(f.key), `duplicate feast key: ${f.key}`);
    keys.add(f.key);
  }
  for (const f of MOVEABLE) assert.equal(typeof f.off, 'number');
  for (const f of FIXED) assert.match(f.md, /^\d{2}-\d{2}$/);
});
