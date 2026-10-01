import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../../assets/suite/email.js', import.meta.url), 'utf8');
const saveSource = source.slice(source.indexOf('    async function saveCore()'), source.indexOf('\n    function doSave()'));
const receiptSource = source.slice(source.indexOf('    function requireReceipt('), source.indexOf('    /* ---------- save'));
function saveHarness(response) {
  const state = { selectedId: 'previous-id', campaigns: [] };
  let reloads = 0;
  const save = vm.runInNewContext(receiptSource + '\n(' + saveSource.trim() + ')', {
    state, ws: 'workspace', collect: () => ({ subject: 'Latest subject', body: 'Latest body', audience: 'customers' }),
    validate: () => true, rpc: async () => response, reload: async () => { reloads++; }, toast: () => {}
  });
  return { state, save, reloads: () => reloads };
}
for (const response of [null, false, { ok: false }, { ok: true }]) {
  test('unconfirmed email save cannot reuse an old campaign identifier: ' + JSON.stringify(response), async () => {
    const h = saveHarness(response);
    await assert.rejects(h.save(), /not confirmed|no campaign identifier/);
    assert.equal(h.reloads(), 0);
    assert.equal(h.state.selectedId, 'previous-id');
  });
}
test('confirmed save retains the latest local snapshot before list refresh', async () => {
  const h = saveHarness({ id: 'saved-id' });
  assert.equal(await h.save(), 'saved-id');
  assert.equal(h.state.campaigns[0].body, 'Latest body');
  assert.equal(h.state.campaigns[0].id, 'saved-id');
});
test('email mutation guard prevents overlapping requests and locks editable controls', async () => {
  const start = source.indexOf('    async function withBusy(');
  const end = source.indexOf('\n    function requireReceipt(', start);
  const state = { busy: false };
  let current = true;
  const input = { disabled: false };
  const permanentlyDisabled = { disabled: true };
  const button = { textContent: 'Save' };
  const fn = vm.runInNewContext('(' + source.slice(start, end).trim() + ')', {
    state, active: () => current, wrap: { querySelectorAll: () => [input, permanentlyDisabled], setAttribute() {}, removeAttribute() {} }, toast() {}
  });
  let release;
  let calls = 0;
  const first = fn(button, () => { calls++; return new Promise(resolve => { release = resolve; }); });
  assert.equal(input.disabled, true);
  await fn(button, () => { calls++; });
  assert.equal(calls, 1);
  release();
  await first;
  assert.equal(input.disabled, false);
  assert.equal(permanentlyDisabled.disabled, true);
  assert.equal(button.textContent, 'Save');
  current = false;
  await fn(button, () => { calls++; });
  assert.equal(calls, 1, 'inactive account cannot start another mutation');
  assert.equal(input.disabled, false);
});
test('email scheduling is blocked when the actual provider is unavailable', () => {
  const start = source.indexOf('    function doSchedule()');
  const end = source.indexOf('\n    function doUnschedule()', start);
  let message = '';
  const schedule = vm.runInNewContext('(' + source.slice(start, end).trim() + ')', {
    ctx: { avail: { email: false } }, toast: text => { message = text; },
    withBusy: () => { throw new Error('Must not save or schedule'); }
  });
  schedule();
  assert.match(message, /unavailable/);
});

test('live email save UUID scalar is accepted as a confirmed identifier', async () => {
  const id = '00000000-0000-0000-0000-000000000001';
  const h = saveHarness(id);
  assert.equal(await h.save(), id);
});
