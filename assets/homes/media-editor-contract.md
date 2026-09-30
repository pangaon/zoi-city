# Media & channels integration

Owner UI: `import {mountMediaEditor} from '/assets/homes/media-editor.mjs'` then `await mountMediaEditor(container,{C:ctx.C,workspace:ctx.ws,listing:listingId})`. Call returned `dispose()` before changing workspace/listing or unmounting; remounting the same container disposes its previous instance. Self-loads media-editor.css. Does not alter bizpage.js.

Suggested small Business home mount, after selected owned listing is known:

```js
const slot = document.createElement('div');
editorContainer.append(slot);
const {mountMediaEditor} = await import('/assets/homes/media-editor.mjs');
const mediaEditor = await mountMediaEditor(slot, {
  C: ctx.C, workspace: ctx.ws, listing: selectedListing.id
});
// Existing workspace/listing teardown: mediaEditor.dispose();
```

Public rendering: import `ownerMedia` and `esc` from `shared-media-model.mjs`. `ownerMedia(entity.profile)` returns `{present,version,items}`. Each item has `{id,kind,url,label,provider,embed}`. Only YouTube / Spotify items have a generated allowlisted embed. Others are explicit provider links. Never accept raw embedded HTML. Render label with escaping; construct iframe only after a click. `present:true,items:[]` is an authoritative owner clear (or invalid owner data) and must not restore crawler media. This module does not imply OAuth connections, social feeds, analytics, current broadcasting or ownership of third-party provider accounts.

Supported links: YouTube watch/short/live/playlist/channel; Spotify artist/album/track/playlist/episode/show; Instagram/Facebook/TikTok/LinkedIn/X/Threads profiles; Instagram posts/reels and TikTok videos; Vimeo, SoundCloud, Apple Podcasts. Only YouTube and Spotify player preview implemented. Provider failures/restrictions remain possible; direct source link remains visible.

New authenticated APIs, all entity types, current listing owner workspace + owner/admin/editor only:

- `home_media_get(p_workspace,p_listing)` → `{ok:true,workspace_id,listing_id,name,media:{version,items}}`.
- `home_media_save(p_workspace,p_listing,p_expected_version,p_request,p_items)` → `{ok:true,workspace_id,listing_id,media:{version:old+1,items}}`.
- Items submitted contain exactly `{id:UUID,kind:'video'|'audio'|'channel'|'link',url:canonicalHTTPS,label:string<=100}`. Maximum24, distinctIDs/URLs, provider-specific URL validation server and client.
- Save locks actor and listing; optimistic version; exact request ledger; returns original receipt on identical retry. Changed request payload rejected. Role/ownership checked before receipt replay. Profile writer preserves unrelated fields and reserved enrichment. Legacy owner_media writes have the same current-owner role and schema guard.
- No blind retries of legacy boolean writer. UI retains identical request after uncertain response while mounted, locks draft editing and exposes explicit retry. Private state clears on account change or disposal. No browser disk persistence of draft.

Deployment: apply reviewed65121 migration first, then mount editor/public renderer. Missing RPC shows retryable unavailable state, no fake success. No production changes were made by this implementation. `ops/qa-home-media-rollback.sql` is exact QA-workspace transaction-only verification, no published fixture and no provider call.
