// The composer's only working delivery channel.
//
// Every external network reports available:false — no developer app is registered
// with Meta, X or TikTok — while /community is a working feed. These assertions
// guard the wiring that makes the publishing tool useful today, and specifically
// the three bugs found while building it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const composer = readFileSync(new URL('../../assets/suite/composer.js', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../../supabase/functions/zoi-feed-publish/index.ts', import.meta.url), 'utf8');
const mig = readFileSync(new URL('../../supabase/migrations/0013_community_publishing.sql', import.meta.url), 'utf8');

test('the community feed is a first-class channel in the composer', () => {
  assert.match(composer, /zoi:\s*\{\s*key:'zoi'/, 'NET must define the zoi channel');
  assert.match(composer, /function withCommunity/, 'the synthetic channel must be injected');
  assert.match(composer, /id: 'zoi', platform: 'zoi', connected: true/,
    'it needs no OAuth, so it is always connected');
  // and it must survive the failure path: no network at all still offers the feed
  assert.match(composer, /state\.channels = withCommunity\(\[\]\)/,
    'a failed channel fetch must still leave the community channel available');
});

test('the publish button and the publish handler agree', () => {
  // The bug: applyGating() enabled the button for the community channel while the
  // click handler still returned early on ctx.avail.publish. The result was a
  // live-looking button that did nothing — the same failure the Connect buttons
  // had, and invisible to anything but a real click.
  const handler = composer.slice(composer.indexOf("q('publish').addEventListener"),
                                 composer.indexOf("q('schedule').addEventListener"));
  assert.ok(handler.length > 100, 'found the publish handler');
  assert.match(handler, /wantsCommunity/, 'the handler must consider the community channel');
  assert.ok(!/^\s*if \(!ctx\.avail \|\| !ctx\.avail\.publish\) return;/m.test(handler),
    'the handler must not gate on the external-network flag alone');
  assert.match(composer, /if \(!wantsCommunity && \(!ctx\.avail \|\| !ctx\.avail\.publish\)\) return;/,
    'external-only posts are still gated');
});

test('publishing now is explicit, not inferred from the status', () => {
  // "Publish now" saves with status 'scheduled' and a current timestamp, because
  // the external publisher looks for scheduled rows. So a community post could
  // never be detected by checking status === 'published' — it had to be a flag.
  assert.match(composer, /savePost\('scheduled', new Date\(\)\.toISOString\(\), \{ publishNow: true \}\)/,
    'the publish handler passes publishNow explicitly');
  assert.match(composer, /if \(wantsCommunity && opts\.publishNow\)/,
    'savePost acts on the flag, not on the status');
  assert.match(composer, /rpc\('feed_post'/, 'it posts through feed_post, as the signed-in person');
});

test('a post can never reach the feed twice', () => {
  // A mixed post is saved as scheduled for the external networks, which would
  // leave it visible to the community worker as well.
  assert.match(mig, /NOT \(COALESCE\(p\.meta,'\{\}'::jsonb\) \? 'community'\)/,
    'the queue must skip anything already carrying a community result');
  assert.match(worker, /feed_mark_published/, 'the worker records the outcome either way');
});

test('the author-explicit insert is unreachable from a browser', () => {
  // feed_post_as posts as an arbitrary user. That must only ever be callable by
  // the scheduler; feed_post remains the only path for a person, and it can only
  // post as themselves.
  for (const fn of ['zoi.feed_post_as', 'public.feed_post_as',
                    'public.feed_due_community_posts', 'public.feed_mark_published']) {
    const esc = fn.replace(/[.()]/g, (m) => '\\' + m);
    assert.ok(new RegExp('REVOKE ALL ON FUNCTION ' + esc + '[^;]*FROM PUBLIC').test(mig),
      `${fn} must be revoked from PUBLIC`);
    assert.ok(new RegExp('REVOKE ALL ON FUNCTION ' + esc + '[^;]*FROM anon, authenticated').test(mig),
      `${fn} must be revoked from anon and authenticated`);
  }
  assert.ok(!/GRANT EXECUTE ON FUNCTION public\.feed_post_as[^;]*TO (anon|authenticated)/.test(mig),
    'feed_post_as must never be granted to a browser role');
  assert.match(mig, /unknown_author/, 'it must reject an author that does not exist');
});

test('the worker authenticates, fails closed, and is time-boxed', () => {
  assert.match(worker, /if \(!authorised\(req\)\)/, 'the caller is checked first');
  assert.match(worker, /timingSafeEqual/, 'the token compare does not short-circuit');
  assert.match(worker, /FEED_PUBLISH_ENABLED/, 'there is a kill switch');
  // it returns through a json(body, status) helper, not a literal status field
  assert.match(worker, /if \(!ENABLED\) return json\([^)]*503\)/,
    'a disabled worker answers 503 rather than running');
  assert.match(worker, /stopped-time-budget/, 'a long queue cannot run past the request limit');
});
