// The Daily Ritual is the reason to come back tomorrow. It previously shipped
// as static markup: "Commemoration of Saints / Χρόνια Πολλά!", a fixed
// Φιλοξενία, and four hardcoded temperatures under a "LIVE" heading.
//
// On 13 September 2026 the Orthodox calendar has no feast and no namedays, so
// that markup congratulated an empty set — while missing that the Exaltation of
// the Holy Cross, one of the Twelve Great Feasts, falls the next day. The fix is
// not better copy; it is reading the calendar the repo already computes and
// tests against the published Paschalion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../community/index.html', import.meta.url), 'utf8');

const g = {};
new Function('window', 'globalThis',
  readFileSync(new URL('../../assets/suite/_orthocal.js', import.meta.url), 'utf8'))(g, g);
const O = g.ZoiOrthocal;

function lift(startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  assert.ok(a !== -1, `missing ${startMarker}`);
  const b = src.indexOf(endMarker, a);
  assert.ok(b !== -1, `missing ${endMarker}`);
  return src.slice(a, b);
}

const helpers = new Function(
  lift('const WOTD = [', 'let WORD =') + 'return { WOTD, todayISO, dayIndex };'
)();
const { WOTD, dayIndex } = helpers;

/* ---------- the page is wired to the real calendar ---------- */

test('the community page loads the orthodox calendar engine', () => {
  // Without this script tag every value in the ritual card is decoration.
  assert.ok(/<script src="\/assets\/suite\/_orthocal\.js"><\/script>/.test(src),
    'the calendar engine is not loaded');
});

test('no hardcoded feast, nameday or temperature survives in the markup', () => {
  assert.ok(!/>Commemoration of Saints</.test(src), 'static feast title still present');
  assert.ok(!/id="comm-nameday-names">Χρόνια Πολλά!</.test(src), 'static nameday still present');
  assert.ok(!/🏛 28°C|🏰 26°C|🏖 27°C|⛵ 25°C/.test(src), 'hardcoded temperatures still present');
  // The heading may only claim "live" once a reading has landed.
  assert.ok(!/>Live Greece Weather</.test(src), 'markup asserts live weather before any fetch');
});

test('the ritual renderer reads dayInfo rather than asserting a feast', () => {
  assert.ok(/ZoiOrthocal/.test(src), 'renderer does not reference the engine');
  assert.ok(/dayInfo\(/.test(src), 'renderer does not call dayInfo');
  assert.ok(/upcomingFeasts\(/.test(src), 'renderer never offers the next feast');
});

/* ---------- the calendar facts the card must not get wrong ---------- */

test('13 September 2026 has no feast and no namedays', () => {
  // The exact day in the report. If this ever changes the card must follow.
  const info = O.dayInfo('2026-09-13');
  assert.equal(info.feasts.length, 0, 'expected no feast');
  assert.equal(info.namedays.length, 0, 'expected no namedays');
});

test('the next feast after 13 September 2026 is the Exaltation, the following day', () => {
  const next = O.upcomingFeasts('2026-09-13', 60)[0];
  assert.equal(next.date, '2026-09-14');
  assert.match(next.name, /Exaltation/);
  assert.equal(next.great, true, 'the Exaltation is one of the Great Feasts');
  assert.equal(dayIndex('2026-09-14') - dayIndex('2026-09-13'), 1, 'should read as "tomorrow"');
});

test('a day with namedays still resolves them', () => {
  // 8 September, Nativity of the Theotokos — the card must greet these people.
  const info = O.dayInfo('2026-09-08');
  assert.ok(info.namedays.includes('Maria'), 'Maria missing from 09-08');
  assert.ok(info.feasts.some((f) => /Nativity of the Theotokos/.test(f.name)));
});

/* ---------- word of the day actually changes ---------- */

test('the word of the day is a real rotation, not a constant', () => {
  assert.ok(WOTD.length >= 7, `only ${WOTD.length} words — a week would repeat`);
  const words = WOTD.map((w) => w[0]);
  assert.equal(new Set(words).size, words.length, 'duplicate words in the rotation');
  for (const [word, phon, gloss] of WOTD) {
    assert.ok(word && phon && gloss, `incomplete entry: ${word}`);
    assert.ok(/[\u0370-\u03ff\u1f00-\u1fff]/.test(word), `${word} is not Greek script`);
  }
});

test('consecutive days select different words', () => {
  const pick = (iso) => WOTD[((dayIndex(iso) % WOTD.length) + WOTD.length) % WOTD.length][0];
  assert.notEqual(pick('2026-09-13'), pick('2026-09-14'));
  assert.notEqual(pick('2026-09-14'), pick('2026-09-15'));
});

test('the rotation is deterministic and wraps cleanly', () => {
  const pick = (iso) => WOTD[((dayIndex(iso) % WOTD.length) + WOTD.length) % WOTD.length][0];
  assert.equal(pick('2026-09-13'), pick('2026-09-13'), 'not deterministic');
  // A full cycle later must land on the same word.
  const d0 = new Date(Date.UTC(2026, 8, 13));
  const d1 = new Date(d0.getTime() + WOTD.length * 86400000).toISOString().slice(0, 10);
  assert.equal(pick('2026-09-13'), pick(d1), 'rotation does not wrap');
});

/* ---------- the highlight circles do something ---------- */

test('story highlights no longer announce an action they do not perform', () => {
  // The old handler toasted "Opening …" and opened nothing.
  assert.ok(!/toast\('Opening ' \+/.test(src), 'the fake "Opening…" toast is still there');
});

test('every highlight resolves to a real destination', () => {
  const body = lift('function openStoryModal(kind)', 'function showRitualDetail');
  assert.ok(/showRitualDetail\(\)/.test(body), 'ritual highlight opens nothing');
  assert.ok(/FEED_FILTER = 'reels'/.test(body), 'reels highlight does not filter the feed');
  for (const dest of ['/explore?c=events', '/explore?c=restaurants', '/explore?c=creators']) {
    assert.ok(body.includes(dest), `no destination for ${dest}`);
  }
});

test('highlights are keyboard operable', () => {
  // They were bare divs with onclick: unreachable by tab, invisible to a reader.
  const items = src.match(/class="story-item"[^>]*/g) || [];
  assert.equal(items.length, 5, `expected 5 highlights, found ${items.length}`);
  for (const item of items) {
    assert.ok(/role="button"/.test(item), `highlight lacks role: ${item.slice(0, 60)}`);
    assert.ok(/tabindex="0"/.test(item), `highlight not focusable: ${item.slice(0, 60)}`);
    assert.ok(/onkeydown=/.test(item), `highlight has no key handler: ${item.slice(0, 60)}`);
    assert.ok(/aria-label=/.test(item), `highlight unlabelled: ${item.slice(0, 60)}`);
  }
});

/* ---------- the greeting shortcut tells the truth ---------- */

test('the nameday shortcut is conditional, not permanent', () => {
  // Offering "Wish Χρόνια Πολλά" on a day with no namedays invites the user to
  // congratulate nobody.
  assert.ok(/id="qa-nameday"[^>]*hidden/.test(src), 'greeting shortcut is not hidden by default');
  assert.ok(!/>🎉 Wish Χρόνια Πολλά</.test(src), 'unconditional greeting button still present');
  const body = lift('const qa = document.getElementById', 'Open-Meteo');
  assert.ok(/info\.namedays && info\.namedays\.length/.test(body),
    'shortcut visibility is not driven by real namedays');
});

/* ---------- weather honesty ---------- */

test('weather failure clears the reading instead of leaving a stale number', () => {
  const body = lift('async function loadWeather()', 'function playWordAudio');
  assert.ok(/Weather unavailable/.test(body), 'no failure state');
  assert.ok(/open-meteo\.com/.test(body), 'not fetching a real source');
  // On failure the heading must drop the "Live" claim.
  assert.ok(/head\.textContent = 'Greece Weather'/.test(body),
    'heading keeps claiming live data after a failure');
});
