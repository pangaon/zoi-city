// The suite's Orthodox calendar is a PORT: api/_orthocal.js is an ES module the
// browser cannot import, so assets/suite/_orthocal.js re-implements it as a
// classic script. Two copies of a calendar is exactly how a congregation ends up
// turning up on the wrong day, so this file does three things:
//
//   1. pins the browser copy to the published Paschalion (2020-2030, and every
//      Pascha 1900-2099 must be a Sunday);
//   2. cross-checks the browser copy against api/_orthocal.js day by day, so a
//      change to one and not the other fails the build;
//   3. records the two places where the browser copy DELIBERATELY differs, with
//      the reason, so the divergence can never be accidental.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as server from '../../api/_orthocal.js';

/* Load the classic script the way a browser would: no module system, one
 * global. Same technique as tests/unit/globe.test.mjs. */
const g = {};
new Function('window', 'globalThis', readFileSync(new URL('../../assets/suite/_orthocal.js', import.meta.url), 'utf8'))(g, g);
const O = g.ZoiOrthocal;

/* Published Orthodox Pascha dates (Gregorian). */
const PASCHA = {
  2020: '2020-04-19', 2021: '2021-05-02', 2022: '2022-04-24', 2023: '2023-04-16',
  2024: '2024-05-05', 2025: '2025-04-20', 2026: '2026-04-12', 2027: '2027-05-02',
  2028: '2028-04-16', 2029: '2029-04-08', 2030: '2030-04-28',
};

const days = (fromISO, n) => {
  const out = [];
  let ms = Date.parse(fromISO + 'T00:00:00Z');
  for (let i = 0; i < n; i++) { out.push(new Date(ms).toISOString().slice(0, 10)); ms += 86400000; }
  return out;
};

test('the browser port loads as a classic script and exposes one global', () => {
  assert.ok(O, 'window.ZoiOrthocal must exist');
  for (const fn of ['orthodoxPascha', 'feastsOn', 'nameDaysOn', 'seasonsFor', 'isFastDay',
    'fastInfo', 'fastConflict', 'upcomingFeasts', 'upcomingNameDays', 'dayInfo', 'opportunities']) {
    assert.equal(typeof O[fn], 'function', `${fn} must be exported`);
  }
});

test('Pascha matches the published Paschalion, 2020-2030', () => {
  for (const [y, expected] of Object.entries(PASCHA)) {
    assert.equal(O.iso(O.orthodoxPascha(+y)), expected, `Pascha ${y}`);
  }
});

test('Pascha 2026-2030 specifically — the years this scheduler will be used in', () => {
  assert.equal(O.iso(O.orthodoxPascha(2026)), '2026-04-12');
  assert.equal(O.iso(O.orthodoxPascha(2027)), '2027-05-02');
  assert.equal(O.iso(O.orthodoxPascha(2028)), '2028-04-16');
  assert.equal(O.iso(O.orthodoxPascha(2029)), '2029-04-08');
  assert.equal(O.iso(O.orthodoxPascha(2030)), '2030-04-28');
  // Western Easter 2026 is 5 April and 2027 is 28 March. A Western library here
  // would put Holy Week a week (and five weeks) early.
  assert.notEqual(O.iso(O.orthodoxPascha(2026)), '2026-04-05');
  assert.notEqual(O.iso(O.orthodoxPascha(2027)), '2027-03-28');
});

test('every Pascha 1900-2099 falls on a Sunday and agrees with the server module', () => {
  for (let y = 1900; y <= 2099; y++) {
    const ms = O.orthodoxPascha(y);
    assert.equal(new Date(ms).getUTCDay(), 0, `Pascha ${y} must be a Sunday`);
    assert.equal(O.iso(ms), server.iso(server.orthodoxPascha(y)), `Pascha ${y} port drift`);
  }
});

test('the feast tables are identical to the server module, key for key', () => {
  assert.deepEqual(O.MOVEABLE.map((f) => [f.key, f.off, f.name]),
    server.MOVEABLE.map((f) => [f.key, f.off, f.name]));
  assert.deepEqual(O.FIXED.map((f) => [f.key, f.md, f.name]),
    server.FIXED.map((f) => [f.key, f.md, f.name]));
  assert.deepEqual(O.NAMEDAYS, server.NAMEDAYS);
});

test('feastsOn and nameDaysOn agree with the server module every day for three years', () => {
  for (const d of days('2026-01-01', 365 * 3)) {
    assert.deepEqual(O.feastsOn(d).map((f) => f.key).sort(), server.feastsOn(d).map((f) => f.key).sort(), d);
    assert.deepEqual(O.nameDaysOn(d), server.nameDaysOn(d), d);
  }
});

test('Holy Week, Clean Monday and Pentecost land on the right 2026 dates', () => {
  const on = (d) => O.feastsOn(d).map((f) => f.key);
  assert.ok(on('2026-02-23').includes('clean_monday'), 'Clean Monday 2026');
  assert.ok(on('2026-04-05').includes('palm_sunday'), 'Palm Sunday 2026');
  assert.ok(on('2026-04-10').includes('holy_friday'), 'Great Friday 2026');
  assert.ok(on('2026-04-12').includes('pascha'), 'Pascha 2026');
  assert.ok(on('2026-05-21').includes('ascension'), 'Ascension 2026');
  assert.ok(on('2026-05-31').includes('pentecost'), 'Pentecost 2026');
});

test('the Twelve Great Feasts are flagged so the UI can weight them', () => {
  assert.ok(O.feastsOn('2026-08-15').some((f) => f.key === 'dormition' && f.great));
  assert.ok(O.feastsOn('2026-04-12').some((f) => f.key === 'pascha' && f.great));
  // a commemoration that is not one of the Twelve
  assert.ok(O.feastsOn('2026-01-17').every((f) => !f.great));
});

test('isFastDay agrees with the server module except at the two documented divergences', () => {
  // Divergence 1: 25-31 December. api/_orthocal.js tags those days
  // 'nativity_fast' (the season really ends on the 24th) and then has to
  // special-case them back out of isFastDay. Both agree they are fast-free, so
  // only the SEASON NAME differs — assert that below, not here.
  // Divergence 2: the first week of the Triodion is fast-free (that is the
  // point of it). The server copy still fasts its Wednesday and Friday.
  const pascha2026 = Date.parse('2026-04-12T00:00:00Z');
  const triodionWeek = new Set();
  for (let off = -70; off <= -64; off++) {
    triodionWeek.add(new Date(pascha2026 + off * 86400000).toISOString().slice(0, 10));
  }
  let divergences = 0;
  for (const d of days('2026-01-01', 365)) {
    const mine = O.isFastDay(d);
    const theirs = server.isFastDay(d);
    if (mine === theirs) continue;
    divergences++;
    assert.ok(triodionWeek.has(d), `undocumented isFastDay divergence on ${d} (browser=${mine}, server=${theirs})`);
    assert.equal(mine, false, `${d} is in the fast-free Triodion week`);
    assert.equal(theirs, true);
  }
  assert.equal(divergences, 2, 'exactly the Wednesday and Friday of the fast-free week');
});

test('the Nativity fast season stops on 24 December in the browser copy', () => {
  assert.ok(O.seasonsFor('2026-12-20').includes('nativity_fast'));
  assert.ok(!O.seasonsFor('2026-12-27').includes('nativity_fast'),
    'printing "Nativity fast" over Christmas week would be simply wrong');
  assert.ok(O.seasonsFor('2026-12-27').includes('twelve_days'));
  // the server module is the one being corrected here — record it so the fix
  // does not silently disappear
  assert.ok(server.seasonsFor('2026-12-27').includes('nativity_fast'),
    'if api/_orthocal.js is fixed, delete this assertion');
});

test('fasting strictness names the days a food business must not get wrong', () => {
  const clean = O.fastInfo('2026-02-23');       // Clean Monday 2026
  assert.equal(clean.level, 'strict');
  assert.match(clean.label, /Clean Monday/);
  assert.match(clean.why, /lagana|halva/i, 'the warning has to say what people DO eat');

  assert.equal(O.fastInfo('2026-04-10').level, 'strict', 'Great Friday');
  assert.equal(O.fastInfo('2026-04-08').level, 'strict', 'Holy Wednesday');
  assert.equal(O.fastInfo('2026-04-15').level, 'none', 'Bright Wednesday is fast-free');
  assert.equal(O.fastInfo('2026-12-27').level, 'none', 'the twelve days of Christmas');
  assert.equal(O.fastInfo('2026-07-01').level, 'fast', 'an ordinary Wednesday');
  assert.equal(O.fastInfo('2026-06-30').level, 'none', 'an ordinary Tuesday');
  assert.equal(O.fastInfo('2026-08-10').level, 'fast', 'Dormition fast');
  assert.equal(O.fastInfo('2026-09-14').level, 'strict', 'Exaltation of the Cross');
  assert.equal(O.fastInfo('2026-12-24').level, 'strict', 'Christmas Eve');
  // Cheesefare week: meat has gone, dairy has not.
  const cheese = O.fastInfo('2026-02-19'); // Thursday of Cheesefare week 2026
  assert.equal(cheese.level, 'dairy');
  assert.match(cheese.why, /dairy/i);
  // Great Lent weekends are milder than its weekdays
  assert.equal(O.fastInfo('2026-03-11').level, 'strict', 'a Lenten Wednesday');
  assert.equal(O.fastInfo('2026-03-14').level, 'fast', 'a Lenten Saturday');
  // every level carries a human reason
  for (const d of ['2026-02-23', '2026-03-11', '2026-04-15', '2026-07-01']) {
    assert.ok(O.fastInfo(d).label, `${d} needs a label`);
  }
});

test('a bakery promoting cheese pies on Clean Monday gets warned', () => {
  const c = O.fastConflict('Fresh tyropita and cheese pies all morning!', '2026-02-23');
  assert.ok(c, 'this is the mistake the whole feature exists to catch');
  assert.equal(c.level, 'strict');
  assert.ok(c.words.length >= 1);
  assert.ok(c.words.some((w) => /tyropita|cheese/i.test(w)));
  assert.match(c.suggest, /lagana|halva|taramosalata/i, 'offer the alternative, do not just scold');
});

test('the food detector reads Greek, accents and all', () => {
  assert.ok(O.fastConflict('Ζεστή τυρόπιτα κάθε πρωί', '2026-02-23'), 'accented Greek must match');
  assert.ok(O.fastConflict('σουβλάκι όλη μέρα', '2026-03-11'), 'meat during Great Lent');
  assert.ok(O.fastConflict('παγωτό', '2026-04-08'), 'dairy in Holy Week');
});

test('the food detector stays quiet when there is nothing to say', () => {
  assert.equal(O.fastConflict('Fresh tyropita and cheese pies!', '2026-04-15'), null,
    'Bright Week is fast-free — a warning here would train people to ignore warnings');
  assert.equal(O.fastConflict('New olive oil in stock', '2026-02-23'), null, 'oil is not a food word we flag');
  assert.equal(O.fastConflict('Our creamy new hand lotion', '2026-02-23'), null,
    '"creamy" is not "cream" — whole words only');
  assert.equal(O.fastConflict('', '2026-02-23'), null);
  // Cheesefare week is the one week dairy is fine but meat is not
  assert.equal(O.fastConflict('Galaktoboureko fresh today', '2026-02-19'), null, 'dairy is allowed in Cheesefare week');
  assert.ok(O.fastConflict('Souvlaki special', '2026-02-19'), 'meat is not');
  // fish and wine only matter on the strict days
  assert.equal(O.fastConflict('Grilled octopus and ouzo', '2026-07-01'), null, 'an ordinary Wednesday allows fish, oil and wine');
  assert.ok(O.fastConflict('Grilled octopus and ouzo', '2026-04-10'), 'Great Friday does not');
});

test('upcoming feasts and name days come back dated and in order', () => {
  const up = O.upcomingFeasts('2026-04-01', 30);
  assert.ok(up.length >= 5);
  assert.deepEqual(up.map((f) => f.date), [...up.map((f) => f.date)].sort(), 'must be in date order');
  assert.ok(up.some((f) => f.key === 'pascha'));

  const nd = O.upcomingNameDays('2026-08-01', 31);
  assert.ok(nd.some((x) => x.date === '2026-08-15' && x.names.includes('Maria')));
  assert.deepEqual(nd.map((x) => x.date), [...nd.map((x) => x.date)].sort());
});

test('dayInfo answers everything one calendar cell needs', () => {
  const i = O.dayInfo('2026-08-15');
  assert.equal(i.date, '2026-08-15');
  assert.ok(i.feasts.some((f) => f.key === 'dormition'));
  assert.ok(i.great);
  assert.deepEqual(i.namedays, ['Maria', 'Panagiotis', 'Despina']);
  assert.equal(i.isFast, false, 'the Dormition itself is a feast, not a fast');
  const plain = O.dayInfo('2026-08-19');
  assert.equal(plain.feasts.length, 0);
  assert.equal(plain.namedays.length, 0);
});

test('opportunities produce an editable draft and never invent a fact', () => {
  const ops = O.opportunities('2026-08-10', 10, { business: 'Taverna Ousia' });
  const dorm = ops.find((o) => o.date === '2026-08-15');
  assert.ok(dorm, 'the Dormition is the biggest August opportunity in Greece');
  assert.equal(dorm.kind, 'great_feast');
  assert.match(dorm.draft, /Χρόνια πολλά/, 'a name-day draft greets the celebrants');
  assert.match(dorm.draft, /Taverna Ousia/, 'the business name is signed off');
  assert.ok(dorm.daysAway === 5);
  // no numbers, no claims, no "verified"
  for (const o of ops) {
    assert.ok(!/\d+ (likes|followers|views|reach|impressions)/i.test(o.draft), 'drafts must not fabricate metrics');
    assert.ok(!/verified/i.test(o.draft));
  }
  // a strict fast gets a quiet draft, not a promotion
  const lent = O.opportunities('2026-04-10', 1, {});
  assert.ok(lent.length === 1 && /blessed/i.test(lent[0].draft));
  assert.ok(!/Come by/.test(lent[0].draft), 'Great Friday is not a sales day');
});

test('bad input never throws', () => {
  for (const bad of [null, undefined, '', 'not-a-date', '2026-13-45', 42, {}]) {
    assert.deepEqual(O.feastsOn(bad), []);
    assert.deepEqual(O.nameDaysOn(bad), []);
    assert.equal(O.isFastDay(bad), false);
    assert.equal(O.fastInfo(bad).level, 'none');
    assert.equal(O.fastConflict('cheese', bad), null);
    assert.deepEqual(O.upcomingFeasts(bad, 5), []);
    assert.deepEqual(O.opportunities(bad, 5), []);
  }
});

// A Date or a timestamp must not silently answer "not a fast day". The string-only
// version did exactly that, so fastInfo(new Date(greatFriday)) reported an
// ordinary day — the kind of wrong answer a scheduler would act on.
test('the liturgical API accepts a Date and a timestamp, not just an ISO string', () => {
  const D = 86400000;
  const pascha = O.orthodoxPascha(2026);
  const cases = [
    ['Clean Monday', pascha - 48 * D, 'strict'],
    ['Great Friday', pascha - 2 * D, 'strict'],
  ];
  for (const [name, ms, expect] of cases) {
    const iso = O.iso(ms);
    const viaString = O.fastInfo(iso).level;
    const viaDate = O.fastInfo(new Date(ms)).level;
    assert.equal(viaString, expect, `${name} via ISO string`);
    assert.equal(viaDate, viaString, `${name}: a Date must agree with the string`);
    // A bare number stays rejected: ms or seconds is a guess, and guessing wrong
    // gives a confidently wrong liturgical answer.
    assert.equal(O.fastInfo(ms).level, 'none', `${name}: a bare number must not be guessed at`);
  }
  // and a Great Feast must be found whichever form you pass
  const aug15 = Date.UTC(2026, 7, 15);
  assert.ok(O.feastsOn('2026-08-15').some((f) => f.key === 'dormition'));
  assert.ok(O.feastsOn(new Date(aug15)).some((f) => f.key === 'dormition'),
    'Dormition must be found when a Date is passed');
  // junk still yields nothing rather than a wrong answer
  assert.equal(O.fastInfo(undefined).level, 'none');
  assert.equal(O.fastInfo('not a date').level, 'none');
  assert.deepEqual(O.feastsOn(NaN), []);
  assert.deepEqual(O.feastsOn(new Date('nonsense')), [], 'an invalid Date is junk too');
});
