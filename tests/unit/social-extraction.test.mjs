import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSocialLinks, socialProfile } from '../../supabase/functions/zoi-enrich/_social.js';
import handler from '../../api/entity.js';

test('structured business profiles take precedence; anchors fill other networks', () => {
  const result = extractSocialLinks('<a href="https://instagram.com/other">IG</a><a href="https://facebook.com/business">FB</a>', ['https://instagram.com/business']);
  assert.deepEqual(result, { social: { instagram: 'https://instagram.com/business', facebook: 'https://facebook.com/business' }, source: 'jsonld+links' });
  assert.equal(extractSocialLinks('', 'https://x.com/business').social.x, 'https://x.com/business');
});

test('protocol-relative, spaced, unquoted and entity-encoded anchors are read', () => {
  const { social } = extractSocialLinks('<a HREF = "//instagram.com/business?utm_source=site">IG</a><a href=https://x.com/business>X</a><a href="https://facebook.com/profile.php?id=123&#38;ref=site">FB</a>');
  assert.deepEqual(social, { instagram: 'https://instagram.com/business', x: 'https://x.com/business', facebook: 'https://facebook.com/profile.php?id=123' });
});

test('share buttons, posts, assets and script strings cannot become profiles', () => {
  const { social } = extractSocialLinks(`<a href="https://facebook.com/sharer.php?u=https://example.org">Share</a>
    <a href="https://instagram.com/p/123/">Post</a><a href="https://x.com/business/status/123">Post</a>
    <a href="https://youtube.com/watch?v=123">Video</a><a href="https://open.spotify.com/track/123">Track</a>
    <img src="https://instagram.com/image"><script>const a='<a href="https://instagram.com/fake">';</script>
    <!-- <a href="https://facebook.com/old"> -->`);
  assert.deepEqual(social, {});
});

test('unsafe and lookalike URLs are rejected without fetching', () => {
  for (const value of ['javascript:alert(1)', 'https://instagram.com.evil.org/business', 'https://evilinstagram.com/business', 'https://user:pass@instagram.com/business', 'https://instagram.com:8443/business', 'https://facebook.com/profile.php', {}, null]) {
    assert.equal(socialProfile(value), null);
  }
});

test('localized hosts and channel profile links retain identity', () => {
  for (const value of ['https://de-de.facebook.com/business', 'https://youtube.com/@business', 'https://youtube.com/channel/UC123', 'https://open.spotify.com/artist/123', 'https://linkedin.com/company/business', 'https://wa.me/302101234567']) {
    assert.equal(socialProfile(value)?.url, value);
  }
});

test('public page exposes enriched socials in buttons and structured data with owner precedence', async (t) => {
  const listing = { slug: 'test-business', name: 'Test business', entity_type: 'business', social_links: { instagram: 'https://instagram.com/owner' }, profile: { _enrich: { social: { instagram: 'https://instagram.com/scraped', x: 'https://x.com/business' } } } };
  t.mock.method(globalThis, 'fetch', async (url) => ({ ok: true, json: async () => String(url).endsWith('/home_entity') ? listing : [] }));
  let html = '';
  const res = { setHeader() {}, end(value) { html = value; } };
  await handler({ query: { slug: listing.slug } }, res);
  assert.equal(res.statusCode, 200);
  assert.match(html, /href="https:\/\/x.com\/business"/);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  const entity = blocks.find(b => b.name === listing.name);
  assert.deepEqual(entity.sameAs, ['https://instagram.com/owner', 'https://x.com/business']);
  assert.doesNotMatch(html, /instagram.com\/scraped/);
});
