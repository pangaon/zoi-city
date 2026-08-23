// The one decision in door.js that must never be wrong: was that a dead
// connection, or an answer from the server? Only the first may be queued.
// Queueing a server rejection would tell a volunteer "held offline, we'll
// retry" about a code the server has already refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const g = { addEventListener() {}, removeEventListener() {} };
new Function('window', 'globalThis',
  readFileSync(new URL('../../assets/tickets/lib.js', import.meta.url), 'utf8'))(g, g);
new Function('window', 'globalThis',
  readFileSync(new URL('../../assets/tickets/door.js', import.meta.url), 'utf8'))(g, g);
const Door = g.ZoiDoor;

test('door.js loads as a classic script and exposes its API without a DOM', () => {
  assert.equal(typeof Door.open, 'function');
  assert.equal(typeof Door.close, 'function');
  assert.equal(typeof Door.isTransportError, 'function');
  assert.equal(Door.isOpen(), false);
});

test('a failed fetch is a transport failure, so the scan may be queued', () => {
  const cases = [
    new TypeError('Failed to fetch'),
    new Error('Failed to fetch'),
    new Error('NetworkError when attempting to fetch resource.'),
    new Error('Network request failed'),
    new Error('Load failed'),
    new Error('net::ERR_INTERNET_DISCONNECTED'),
    new Error('request timeout'),
  ];
  for (const e of cases) assert.equal(Door.isTransportError(e), true, e.message);
  // our own rpc() wrapper flags it explicitly
  const flagged = new Error('Could not reach the ticket server');
  flagged.transport = true;
  assert.equal(Door.isTransportError(flagged), true);
});

test('an answer from the server is never mistaken for a dead connection', () => {
  const cases = [
    'permission denied for function tickets_checkin',
    'Request failed (403)',
    'new row violates row-level security policy',
    'Code not found',
    'invalid input syntax for type uuid',
  ];
  for (const m of cases) {
    assert.equal(Door.isTransportError(new Error(m)), false, m);
  }
  assert.equal(Door.isTransportError(null), false);
  assert.equal(Door.isTransportError(undefined), false);
});

test('close() on a door that was never opened is a no-op, not a crash', () => {
  Door.close();
  assert.equal(Door.isOpen(), false);
  assert.equal(Door._state(), null);
});

test('door.js ships no inline event handlers or eval', () => {
  const src = readFileSync(new URL('../../assets/tickets/door.js', import.meta.url), 'utf8');
  assert.ok(!/\bonclick\s*=/.test(src), 'handlers must be attached, not written into markup');
  assert.ok(!/\beval\s*\(/.test(src));
  assert.ok(!/\bimport\s|\bexport\s/.test(src), 'must stay a classic script');
  // Every class it defines is namespaced, so it cannot inherit design-system rules.
  const classes = [...src.matchAll(/'\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]);
  assert.ok(classes.length > 10, 'expected to find the stylesheet');
  for (const c of new Set(classes)) {
    assert.ok(c.startsWith('tkxd-'), 'un-namespaced class in door.js: .' + c);
  }
});

test('the amber "queued" wording never claims a check-in happened', () => {
  const d = g.ZoiTicketsLib.decide({ error: new Error('Failed to fetch') });
  assert.equal(d.kind, 'queued');
  assert.ok(!/checked in/i.test(d.title), 'title: ' + d.title);
  assert.match(d.detail, /not yet confirmed/i);
  const src = readFileSync(new URL('../../assets/tickets/door.js', import.meta.url), 'utf8');
  // the queued branch must say it out loud on screen
  assert.match(src, /not confirmed/);
  assert.match(src, /held on this device/);
});
