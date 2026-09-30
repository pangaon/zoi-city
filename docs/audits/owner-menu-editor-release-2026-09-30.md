# Structured owner content release candidate

Candidate only; not staged/deployed by specialist. Uses existing Business home, vertical schemas and existing base/profile writers. No second publishing system.

## Actual capability

Restaurant editor supports named sections and items, authored descriptions, optional decimal price plus explicitly chosen ISO currency, promotions with validity text/price/terms, add/remove/edit and keyboard-operable move up/down. It is a reusable nested collection control; existing repeat fields also gain reorder and proper dirty-state events. Existing display prices are preserved untouched, never guessed into a currency. New prices validate supported currency precision without floating-point price conversion. Menu content preview is explicitly unsaved. Saving publishes content immediately via the existing writers; private template/layout drafts still use the separate existing Publish flow.

Promo name, when, price and terms now render in both generic vertical and four restaurant layouts. Explicit owner menu/promo clears suppress source fallback. Existing restaurant brand fixtures, photo review and planner are untouched.

Current supported vertical fields for all families use the same versioned snapshot/save bridge. New structured menu/promo form is restaurant-family only. Native menu editing has not been implemented or device tested; it remains open, not parity-complete.

## Atomic authorization and retry

New `home_content_get(workspace,listing)` returns `{ok,workspace_id,listing_id,version,base,profile,entity_type,category_slug}`. Version is a server content fingerprint, not a client counter. Private worker lease/coverage removed from editor snapshot.

`home_content_save(workspace,listing,expected_version,request,base,profile)` locks actual actor/current membership/current listing, allows owner/admin/editor, fences a former approved claimant from a newly owned listing, validates whitelisted supported fields and nested collections, then invokes the existing base and profile writers in one transaction. Missing keys preserve existing fields; JSON null is explicit clear. Separate owner_media namespace uses its existing media writer and cannot be changed through this wrapper. Response `{ok,workspace_id,listing_id,request_id,version}` is stored privately per actor/request; exact retry returns same receipt, changed retry rejected. Role and ownership checks precede replay. Current media changes and owner/source content changes invalidate stale snapshots.

UI locks the save snapshot during uncertain network results, retries identical request, refuses another edit until confirmed, and offers reload after a definite version conflict. Late account/workspace results do not hydrate the old editor. Existing cached-entity mounting bug (details stayed on Loading because slot was not attached yet) is fixed by yielding until form attachment.

## Evidence

- 11 real PostgreSQL checks using actual current production writer definitions captured read-only: atomic content, retry, stale/changed payload, explicit clears, namespace preservation, malformed-item whole-transaction failure, role revocation, transfer fence, private grants, two simultaneous saves with one winner, exact production rollback script with no retained synthetic rows.
- 42 relevant local unit tests pass across vertical schema/normalization, music, restaurant, media and new money/menu/public four-layout tests. Syntax checks pass.
- Actual browser module, simulated API fixture: 390/1440 no overflow; dish/price edit + reorder; lost response after simulated commit → exact same request retry; explicit menu clear; conflict preserves text and offers reload; delayed response after account change is ignored; negative price produces zero writes and focuses price amount; reorder retains enabled keyboard focus. Empty menu preview is explicit. This is not production HTTP save evidence.
- Screenshots .recovery/logs/owner-menu-390.png and owner-menu-1440.png. Mobile layout revised after visual inspection to stack item fields with compact amount/currency pair, rather than misaligned tall columns. No paid builds or API writes.

## Exact manifest

- supabase/migrations/20260930075049_owner_content_versioned_save.sql
- assets/suite/_vertical-forms.js
- assets/suite/_vertical-ui.js
- assets/suite/bizpage.js
- assets/homes/templates/restaurant/model.mjs (promo text composition only)
- api/_verticals.js (promo text composition only)
- tests/unit/owner-menu-editor.test.mjs
- tests/database/owner-content.integration.mjs
- tests/database/owner-content-writers.fixture.sql
- ops/qa-owner-content-rollback.sql
- docs/audits/owner-menu-editor-release-2026-09-30.md

Parent: deploy SQL before new editor, run rollback acceptance, verify production authenticated HTTP/browser on the isolated QA business, then clear only authorized fixtures. Bump the three script cache versions in social/index.html for _vertical-forms/_vertical-ui/bizpage (currently20260930b). Do not include private browser fixture, screenshots, node_modules or generated deno.lock. Full listing checklist stays pending until independently reviewed actual production journeys, not automatically passed from these tests.
