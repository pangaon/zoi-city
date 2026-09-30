import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../assets/suite/composer.js', import.meta.url), 'utf8');
function harness(fetch) {
  const sandbox = { fetch, AbortController, setTimeout, clearTimeout };
  vm.runInNewContext(source.replace('  /* ---------- register ---------- */',
    '  global.testCaption = requestCaption;\n  /* ---------- register ---------- */'), sandbox);
  return sandbox.testCaption;
}
function core(token = 'session') {
  return { BASE: 'https://example.test', KEY: 'public-key', auth: { token: () => token, ensureFresh: async () => {} } };
}

test('composer calls authenticated caption generation and returns only provider text', async () => {
  let received;
  const generate = harness(async (url, options) => {
    received = { url, options };
    return { ok: true, json: async () => ({ available: true, result: { text: '  Actual provider caption  ' } }) };
  });
  assert.equal(await generate(core(), 'workspace-id', 'Our actual offer', 'reverent'), 'Actual provider caption');
  assert.equal(received.url, 'https://example.test/functions/v1/ai-generate');
  assert.equal(received.options.headers.Authorization, 'Bearer session');
  const body = JSON.parse(received.options.body);
  assert.equal(body.workspace, 'workspace-id');
  assert.equal(body.action, 'caption');
  assert.match(body.input, /reverent/);
  assert.match(body.input, /Our actual offer/);
});

test('missing authentication never sends an AI request', async () => {
  const generate = harness(() => { throw new Error('must not fetch'); });
  await assert.rejects(generate(core(null), 'ws', 'Draft', 'warm'), /Sign in again/);
});

for (const [name, response, expected] of [
  ['unavailable provider', { ok: true, json: async () => ({ available: false }) }, /unavailable/],
  ['unauthorised workspace', { ok: false, status: 403, json: async () => ({ error: 'no_access' }) }, /do not have access/],
  ['provider error', { ok: false, status: 502, json: async () => ({ error: 'provider failure' }) }, /request failed/],
  ['malformed response', { ok: true, json: async () => { throw new Error('invalid JSON'); } }, /unreadable/],
  ['empty caption', { ok: true, json: async () => ({ available: true, result: { text: ' ' } }) }, /no caption/]
]) {
  test(`composer preserves drafts on ${name}`, async () => {
    await assert.rejects(harness(async () => response)(core(), 'ws', 'My draft', 'warm'), expected);
  });
}

test('composer uses refreshed authentication', async () => {
  const C = core();
  C.auth.ensureFresh = async () => { C.auth.token = () => 'refreshed'; };
  const generate = harness(async (_, options) => {
    assert.equal(options.headers.Authorization, 'Bearer refreshed');
    return { ok: true, json: async () => ({ available: true, result: { text: 'Caption' } }) };
  });
  await generate(C, 'ws', 'Draft', 'warm');
});

test('AI suggestions require explicit application and reject stale editor state', async () => {
  // Execute the actual apply callback with a draft changed during generation.
  const start = source.indexOf("          apply.addEventListener('click', function () {");
  const end = source.indexOf('\n          });', start);
  const callback = source.slice(start, end).replace("          apply.addEventListener('click', ", '') + '\n}';
  const run = vm.runInNewContext('(' + callback + ')', {
    ta: { value: 'New user edits' }, original: 'Original', suggestion: 'AI response',
    aiStatus: {}, onBodyChange: () => { throw new Error('must not overwrite'); },
    panel: { remove: () => { throw new Error('must retain suggestion'); } }
  });
  run();
});

test('community publishing sends only the saved post id, never mutable editor content', async () => {
  const start = source.indexOf('    async function savePost(');
  const end = source.indexOf('    /* ---------- honest publish gating', start);
  const ta = { value: 'Original draft' };
  let feedArgs, feedName, savedBody;
  const save = vm.runInNewContext('(' + source.slice(start, end).trim() + ')', {
    ta, state: { editId: null }, ctx: { ws: 'ws' }, currentChannelIds: () => ['zoi'],
    mediaJson: () => [], buildMeta: () => ({}),
    C: { api: { rpc: async (name, args) => {
      if (name === 'social_save_post') {
        savedBody = args.p_body;
        ta.value = 'Edits made while save was in flight';
        return { id: 'saved-id' };
      }
      feedName = name;
      feedArgs = args;
      return { ok: true, id: 'feed-id' };
    } } }
  });
  const result = await save('scheduled', '2026-10-01T12:00:00Z', { publishNow: true });
  assert.equal(savedBody, 'Original draft');
  assert.equal(feedName, 'feed_publish_social_post');
  assert.equal(JSON.stringify(feedArgs), '{"p_id":"saved-id"}');
  assert.equal(result.community, 'posted');
});
