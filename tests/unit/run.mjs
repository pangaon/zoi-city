#!/usr/bin/env node
// zoi.city Wave 1 — pure-logic unit tests (zero deps, no network).
// Run anywhere: node unit/run.mjs

import { esc, relTime } from './lib.mjs';

class AssertError extends Error {}
function assert(cond, msg) { if (!cond) throw new AssertError(msg); }
function eq(actual, expected, label) {
  assert(actual === expected, `${label || 'value'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const tests = [];
const t = (name, fn) => tests.push({ name, fn });

// ---------- esc() ----------
t('esc: passes plain text through unchanged', () => {
  eq(esc('Kalimera Zoi 2028'), 'Kalimera Zoi 2028');
});

t('esc: escapes all five special characters', () => {
  eq(esc(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
});

t('esc: neutralizes <script> XSS payload', () => {
  eq(esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert(!esc('<script>alert(1)</script>').includes('<'), 'raw < survived');
});

t('esc: neutralizes <img onerror> XSS payload', () => {
  const payload = '<img src=x onerror="alert(document.cookie)">';
  const out = esc(payload);
  eq(out, '&lt;img src=x onerror=&quot;alert(document.cookie)&quot;&gt;');
  assert(!/[<>"]/.test(out), 'raw <, > or " survived escaping');
});

t('esc: neutralizes attribute-breakout via quotes', () => {
  const payload = `" onmouseover="alert(1)" x='y'`;
  const out = esc(payload);
  assert(!out.includes('"') && !out.includes("'"), 'raw quote survived escaping');
  eq(out, '&quot; onmouseover=&quot;alert(1)&quot; x=&#39;y&#39;');
});

t('esc: escapes every occurrence, not just the first', () => {
  eq(esc('<<a>>&&'), '&lt;&lt;a&gt;&gt;&amp;&amp;');
});

t('esc: ampersand escaped first (no double-escaping of entities produced)', () => {
  eq(esc('&lt;'), '&amp;lt;'); // pre-escaped input is treated as literal text
});

t('esc: null and undefined become empty string', () => {
  eq(esc(null), '');
  eq(esc(undefined), '');
});

t('esc: coerces non-strings safely', () => {
  eq(esc(0), '0');
  eq(esc(false), 'false');
  eq(esc(12.5), '12.5');
});

// ---------- relTime() ----------
const NOW = new Date('2026-08-22T12:00:00Z').getTime();
const iso = ms => new Date(NOW - ms).toISOString();
const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN, DAY = 24 * HOUR;

t('relTime: empty/absent input returns empty string', () => {
  eq(relTime(''), '');
  eq(relTime(null), '');
  eq(relTime(undefined), '');
});

t('relTime: < 60s is "just now"', () => {
  eq(relTime(iso(0), NOW), 'just now');
  eq(relTime(iso(59 * SEC), NOW), 'just now');
});

t('relTime: minutes under an hour render as Xm', () => {
  eq(relTime(iso(60 * SEC), NOW), '1m');
  eq(relTime(iso(5 * MIN), NOW), '5m');
  eq(relTime(iso(59 * MIN + 59 * SEC), NOW), '59m');
});

t('relTime: hours under a day render as Xh', () => {
  eq(relTime(iso(HOUR), NOW), '1h');
  eq(relTime(iso(3 * HOUR + 30 * MIN), NOW), '3h');
  eq(relTime(iso(23 * HOUR + 59 * MIN), NOW), '23h');
});

t('relTime: days under a week render as Xd', () => {
  eq(relTime(iso(DAY), NOW), '1d');
  eq(relTime(iso(2 * DAY + 5 * HOUR), NOW), '2d');
  eq(relTime(iso(6 * DAY + 23 * HOUR), NOW), '6d');
});

t('relTime: >= 7 days falls back to a localized date', () => {
  const when = iso(10 * DAY);
  const out = relTime(when, NOW);
  const expected = new Date(when).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  eq(out, expected);
  assert(!/^\d+[mhd]$/.test(out) && out !== 'just now', `still relative: ${out}`);
});

t('relTime: exact 7-day boundary uses the date form', () => {
  const out = relTime(iso(7 * DAY), NOW);
  assert(!/^\d+d$/.test(out), `7d boundary should be a date, got ${out}`);
});

// ---------- runner ----------
console.log('# zoi.city unit tests (no network)');
console.log(`1..${tests.length}`);
let failed = 0;
for (let i = 0; i < tests.length; i++) {
  const { name, fn } = tests[i];
  try {
    fn();
    console.log(`ok ${i + 1} - ${name}`);
  } catch (e) {
    failed++;
    console.log(`not ok ${i + 1} - ${name}`);
    console.log(`# ${String(e && e.message ? e.message : e).replace(/\n/g, '\n# ')}`);
  }
}
console.log(`# ${tests.length - failed}/${tests.length} passed`);
process.exit(failed === 0 ? 0 : 1);
