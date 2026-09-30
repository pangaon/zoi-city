# Event publicity owner contract

Candidate implementation, not a claim of production deployment or completed live owner QA.

## Data and publishing

`profile.event_publicity` contains an explicit event URL, an optional manually reported ticket-sales milestone, up to 12 highlight links and up to 12 curated social posts. No sales figure is seeded. A milestone has a whole count, organiser source link, UTC reporting time and expiry within 31 days. Future, disabled and expired reports disappear publicly. This is not live ticket inventory, capacity, reservation availability or a scarcity signal. A renderer showing a particular event must match the report’s event URL; a business home can contain archive links with their own context.

The editor extends the existing business-home **Save page** flow. It uses `home_content_get`’s current private snapshot and the existing `home_content_save` request UUID, expected content version, workspace/listing authorization, atomic writer and exact retry receipt. It creates no new store or parallel write endpoint. Untouched publicity is omitted from the patch; explicit removal persists JSON null. The editor has a structured preview and undoable removal. Existing user/workspace disposal, pending-request lock and ambiguous-response retry logic remain in force.

Migration `20260930184500_event_publicity_owner_content.sql` adds the key to the existing content whitelist and public owner projection. Nested validation is enforced both in the versioned wrapper and underlying legacy profile writer. Public renderer normalization independently validates and strips malformed data. No embed HTML is accepted. Supported curated destinations are exact YouTube video URLs, Vimeo numeric videos, Instagram posts/reels, Facebook page posts/videos/reels, TikTok videos and X statuses. They are provider handoffs; sign-in, deletion, geographic restrictions or provider availability may affect playback. Images are owner-provided HTTPS URLs; no uploads or server-side URL fetching are introduced.

## Verification

- 15 isolated PostgreSQL checks passed against the migration: atomic owner publication/public projection, explicit clear, exact retry, payload conflict, stale versions, two concurrent saves, viewer denial, transfer denial before receipt replay, source namespace protection, anonymous denial, unsafe URLs, count/date validation, rollback fixture without retained rows.
- 13 related event/projection/module tests passed; 10 publicity and existing owner precedence tests also passed (overlapping suites).
- Local browser editor mounted, added a named YouTube highlight, normalized the link, removed announcements and confirmed Add controls disabled and `read()` returned null. Mobile width 390 had scroll width 390. Screenshot: `.recovery/logs/publicity-owner-mobile.png` outside the release worktree. The fixture used illustrative CSS and is not evidence of the final authenticated owner screen’s appearance.
- The authenticated production owner edit → preview → save → public read journey has **not** been performed in this candidate. No real owner data was written. Root owns deployment and final browser integration review.

Keep source fingerprint migration `20260930173000_source_capture_lease_fingerprint.sql` out of this publicity release; it is a separate proposal.

## Follow-up integration

The owner editor is offered for actual `event`/`venue` records and the existing Signature entertainment home. Generic event and venue renderers consume curated highlight/post cards in their hideable `media` section across all four designs. Only an actual event shows a milestone matching its canonical event URL (or explicitly supplied event URL); a venue never shows an event ticket counter. Signature uses the shared renderer with its own known event scope. Other business, artist, restaurant and organization families are not wired to this publicity editor yet; their existing media tools remain separate. This is not universal family coverage.

`ops/qa-event-publicity-rollback.sql` uses the established dedicated QA owner/workspace identity and a synthetic event. It exercises save, exact retry, public owner projection, invalid link/count denial, cross-workspace denial, explicit clear and source preservation, then rolls back. The exact fixture passed locally, bringing the PostgreSQL suite to **16 checks**; the harness confirms no synthetic row or request receipt remains. It is prepared for root’s controlled production verification, not already run against production.

## Independent hardening review

The independent reviewer reran the actual PostgreSQL suite, then added nested sales/highlight/post key allowlists and strict string types, including rejection through the authenticated writer. The final suite passes **17 checks**. The public milestone renderer separately rejects future-dated sales reports. The shared public cards now explicitly pair light text with their dark surfaces across light and dark family designs; browser recheck is tracked separately from database evidence.
