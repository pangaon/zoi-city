import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as nodeModule from 'node:module';
import vm from 'node:vm';
const source = readFileSync(new URL('../../supabase/functions/social-publish/index.ts', import.meta.url), 'utf8');
const script = nodeModule.stripTypeScriptTypes ? nodeModule.stripTypeScriptTypes(source.replace(/^import .*;$/m, '')) : null;
async function run(post, { providerOk = true, communityOk = true, connected = true, channelId = 'fb' } = {}) {
  let handler;
  const calls = [];
  vm.runInNewContext(script, {
    Deno: { env: { get: key => ({ SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'test-service' })[key] }, serve: fn => { handler = fn; } },
    Response, AbortSignal, console,
    fetch: async (url, options) => {
      const args = JSON.parse(options.body);
      calls.push({ url, args });
      const name = url.split('/').pop();
      if (name === 'social_due_posts') return Response.json([post]);
      if (name === 'feed_publish_scheduled_post') return Response.json(communityOk ? { ok: true, id: 'feed-id' } : { ok: false });
      if (name === 'social_channels_for_publish') return Response.json(connected ? [{ id: channelId, platform: 'facebook', external_id: 'page-id', access_token: 'test-token' }] : []);
      if (name === 'social_post_finalize' || name === 'social_target_record') return Response.json(true);
      if (url.startsWith('https://graph.facebook.com/')) return Response.json(providerOk ? { id: 'provider-id' } : { error: { message: 'provider_rejected' } });
      throw new Error('Unexpected request: ' + url);
    }
  });
  const response = await handler(new Request('https://worker.test', { headers: { Authorization: 'Bearer test-service' } }));
  return { result: await response.json(), calls };
}
const post = channels => ({ id: 'post-id', workspace_id: 'ws', channels, body: 'Actual caption', media: [] });
test('social worker does not fail community-only posts for lack of external channels', { skip: !script }, async () => {
  const { result, calls } = await run(post(['zoi']));
  assert.equal(result.published, 1);
  assert.ok(calls.some(call => call.url.endsWith('/feed_publish_scheduled_post')));
  assert.ok(!calls.some(call => call.url.endsWith('/social_post_finalize')));
});
test('a mixed post is published only after every requested destination succeeds', { skip: !script }, async () => {
  const { result, calls } = await run(post(['zoi','facebook']));
  assert.equal(result.published, 1);
  assert.equal(result.partial, 0);
  assert.equal(calls.find(call => call.url.endsWith('/social_post_finalize')).args.p_status, 'published');
});
test('provider failure preserves community success as a partial outcome', { skip: !script }, async () => {
  const { result, calls } = await run(post(['zoi','facebook']), { providerOk: false });
  assert.equal(result.published, 0);
  assert.equal(result.partial, 1);
  assert.equal(calls.find(call => call.url.endsWith('/social_post_finalize')).args.p_status, 'failed');
  assert.equal(calls.find(call => call.url.endsWith('/social_target_record')).args.p_error, 'provider_rejected');
});
test('missing provider connection never counts as a published external post', { skip: !script }, async () => {
  const { result } = await run(post(['facebook']), { connected: false });
  assert.equal(result.published, 0);
  assert.equal(result.failed, 1);
});
test('community errors are not hidden by successful external delivery', { skip: !script }, async () => {
  const { result } = await run(post(['zoi','facebook']), { communityOk: false });
  assert.equal(result.published, 0);
  assert.equal(result.partial, 1);
});

test('composer channel UUIDs resolve to only the selected workspace account', { skip: !script }, async () => {
  const channelId = '00000000-0000-0000-0000-000000000123';
  const { result, calls } = await run(post([channelId]), { channelId });
  assert.equal(result.published, 1);
  assert.equal(calls.find(call => call.url.endsWith('/social_target_record')).args.p_channel, channelId);
});
test('unrecognised channel ids never publish to another account', { skip: !script }, async () => {
  const { result, calls } = await run(post(['unknown-channel']));
  assert.equal(result.failed, 1);
  assert.ok(!calls.some(call => call.url.startsWith('https://graph.facebook.com/')));
});

test('attached images cannot be silently discarded by a text-only publisher', { skip: !script }, async () => {
  const campaign = post(['facebook']);
  campaign.media = [{ type: 'image', url: 'https://example.test/image.jpg' }];
  const { result, calls } = await run(campaign);
  assert.equal(result.failed, 1);
  assert.equal(calls.find(call => call.url.endsWith('/social_target_record')).args.p_error, 'image_publishing_not_supported');
  assert.ok(!calls.some(call => call.url.startsWith('https://graph.facebook.com/')));
});
test('thread metadata is rejected instead of claiming to publish a full thread', { skip: !script }, async () => {
  const campaign = post(['facebook']);
  campaign.meta = { thread: ['First', 'Second'] };
  const { result, calls } = await run(campaign);
  assert.equal(result.failed, 1);
  assert.equal(calls.find(call => call.url.endsWith('/social_target_record')).args.p_error, 'first_comment_or_thread_delivery_not_supported');
});
