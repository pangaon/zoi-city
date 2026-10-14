import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as nodeModule from 'node:module';
import vm from 'node:vm';
const source = readFileSync(new URL('../../supabase/functions/social-publish/index.ts', import.meta.url), 'utf8');
const script = nodeModule.stripTypeScriptTypes ? nodeModule.stripTypeScriptTypes(source.replace(/^import .*;$/m, '')) : null;
async function run(post, { providerOk = true, communityOk = true, connected = true, channelId = 'fb', snapshotFailAt = 0, networkUnknown = false, freshToken = 'test-token', freshExternal = 'page-id', channelUnavailable = false } = {}) {
  let handler;
  const calls = []; let snapshots=0;
  vm.runInNewContext(script, {
    Deno: { env: { get: key => ({ SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'test-service' })[key] }, serve: fn => { handler = fn; } },
    Response, AbortSignal, console,
    fetch: async (url, options) => {
      const args = JSON.parse(options.body);
      calls.push({ url, args });
      const name = url.split('/').pop();
      if (name === 'social_due_posts_current') return Response.json([post]);
      if(name==='social_delivery_snapshot'){snapshots++;return snapshotFailAt===snapshots||(channelUnavailable&&args.p_channel!==undefined)?Response.json({message:'social_author_or_channel_no_current_authority'},{status:403}):Response.json({ok:true,post,payload_hash:'canonical-hash',channel:args.p_channel===undefined?null:{id:channelId,platform:'facebook',external_id:freshExternal,access_token:freshToken,meta:{}}});}
      if (name === 'feed_publish_scheduled_post') return Response.json(communityOk ? { ok: true, id: 'feed-id' } : { ok: false });
      if (name === 'social_channels_for_publish') return Response.json(connected ? [{ id: channelId, platform: 'facebook', external_id: 'page-id', access_token: 'test-token' }] : []);
      if (name === 'social_post_finalize' || name === 'social_target_record') return Response.json(true);
      if(networkUnknown&&url.startsWith('https://graph.facebook.com/'))throw Error('response unavailable after provider request');
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

test('current authority refusal before any delivery never calls Community or a provider',{skip:!script},async()=>{const{result,calls}=await run(post(['zoi','facebook']),{snapshotFailAt:1});assert.equal(result.failed,1);assert(!calls.some(c=>c.url.endsWith('/feed_publish_scheduled_post')||c.url.startsWith('https://graph.facebook.com/')));});
test('final pre-dispatch client or payload refusal never sends a provider request',{skip:!script},async()=>{const{result,calls}=await run(post(['facebook']),{snapshotFailAt:2});assert.equal(result.failed,1);assert(!calls.some(c=>c.url.startsWith('https://graph.facebook.com/')));assert.equal(calls.filter(c=>c.url.endsWith('/social_delivery_snapshot')).at(-1).args.p_expected_hash,'canonical-hash');});
test('uncertain provider response is recorded as unknown requiring reconciliation',{skip:!script},async()=>{const{result,calls}=await run(post(['facebook']),{networkUnknown:true});assert.equal(result.failed,1);const target=calls.find(c=>c.url.endsWith('/social_target_record'));assert.equal(target.args.p_status,'unknown');assert.match(target.args.p_error,/provider_result_unknown_requires_reconciliation/);assert.equal(calls.find(c=>c.url.endsWith('/social_post_finalize')).args.p_status,'failed');});
test('exact saved network override is dispatched only after the last authority gate',{skip:!script},async()=>{const saved=post(['facebook']);saved.meta={per_network_overrides:{facebook:{body:'Actual selected network copy'}}};const{calls}=await run(saved);const provider=calls.find(c=>c.url.startsWith('https://graph.facebook.com/'));assert.equal(provider.args.message,'Actual selected network copy');const index=calls.indexOf(provider);assert(calls[index-1].url.endsWith('/social_delivery_snapshot'));});

test('channel disconnect after initial candidate lookup prevents provider dispatch',{skip:!script},async()=>{const{result,calls}=await run(post(['facebook']),{channelUnavailable:true});assert.equal(result.failed,1);assert(calls.some(c=>c.url.endsWith('/social_channels_for_publish')));assert(!calls.some(c=>c.url.startsWith('https://graph.facebook.com/')));});
test('pre-dispatch receipt replaces cached channel destination and credential',{skip:!script},async()=>{const{calls}=await run(post(['facebook']),{freshToken:'rotated-fixture-token',freshExternal:'current-page'});const provider=calls.find(c=>c.url.startsWith('https://graph.facebook.com/'));assert.equal(provider.url,'https://graph.facebook.com/v19.0/current-page/feed');assert.equal(provider.args.access_token,'rotated-fixture-token');});
test('real bigint channel IDs match saved string selections without substituting another account',{skip:!script},async()=>{const{result,calls}=await run(post(['123']),{channelId:123});assert.equal(result.published,1);assert.equal(calls.find(c=>c.url.endsWith('/social_target_record')).args.p_channel,123);assert.equal(calls.filter(c=>c.url.endsWith('/social_delivery_snapshot')).at(-1).args.p_channel,123);});
