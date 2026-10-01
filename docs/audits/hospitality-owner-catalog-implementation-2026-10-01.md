# Hospitality owner catalogue editor — bounded candidate

Status: implemented locally; no production migration, deployment, or owner-data writes. Root owns integration and release.

## Ownership

- assets/suite/_vertical-forms.js
- assets/suite/_vertical-ui.js
- supabase/migrations/20261001031621_hospitality_owner_catalogue.sql
- tests/unit/hospitality-owner-catalog.test.mjs
- tests/database/hospitality-owner-catalog.integration.mjs
- tests/browser/hospitality-owner-catalog/verify.mjs
- this audit

Frozen hospitality extraction and public rendering files were not changed.

## Result

All five categories handled by the hotel public renderer now receive rooms, dining, occasion spaces, amenities and booking-link fields in the existing owner editor. Source suggestions remain separate until accepted or edited. Entries retain stable IDs when reordered and saved. Removing every accepted source entry writes an explicit empty array; existing null clears remain supported. Clear controls suppress imported content without deleting source evidence. Owners can inspect a text/link catalogue preview before saving. No rates, capacity, availability or booking inventory is inferred.

The migration extends the existing versioned writer and public owner projection. The underlying profile writer also validates the catalogue so callers cannot bypass the validation using its older route. Existing authorization, request receipts, version checks, reserved-import restrictions and media/publicity contracts remain in the original functions. Migration replacement anchors fail closed if the current function contract drifts. Helpers are internal, not anonymous/authenticated RPCs. Migration created with Supabase CLI; applied only to an ephemeral local PostgreSQL test database.

## Source evidence

The prior source catalogue batch and its separate AMARA source evidence remain the source integration path. This editor test uses clearly synthetic hotel.test records to exercise source suggestion acceptance; it is not evidence that a real owner has edited or published AMARA.

## Exercised evidence

Commands from the release worktree:

```
node --test tests/unit/hospitality-owner-catalog.test.mjs tests/unit/vertical-forms.test.mjs tests/unit/vertical-profile-contract.test.mjs tests/unit/vertical-hours-mapping.test.mjs
node tests/database/hospitality-owner-catalog.integration.mjs
node tests/browser/hospitality-owner-catalog/verify.mjs
```

- 19 unit assertions passed, including existing category, source partition and hours regressions.
- Six actual PostgreSQL journey checks passed: versioned save and exact replay, stale version and changed replay rejection, []/null private/public projection, invalid catalogue rollback through both writers, revoked/transferred authority and reserved imports, internal validator privileges. Machine enrichment remained intact.
- Actual classic-script editor mounted at 390 and 1440 pixels in light and dark palettes. Each exercised unread suggestions, explicit acceptance, reorder IDs, catalogue preview, clearing sourced rooms/amenities, sparse addition, owner snapshot reload and removing the last row. No page errors or horizontal overflow.
- Screenshots: /tmp/hotel-owner-{dark,light}-{390,1440}.png. Mobile inspection confirmed separate bordered row cards, labelled fields and controls; source links use the theme accent.

## Remaining release evidence

Root review and independent specialist acceptance; exact archive checks; migration approval/application and cache/reference integration where needed; then authenticated production owner save/reload on an approved canary. No live owner save is claimed. Existing native editor handoff continues to the authorized web editor; no native catalogue controls or physical-device validation added. Four public hotel design variants were covered by the separate source-catalogue batch, not by this single owner-editor layout harness. Full category population remains open.

## Independent review corrections

Fixed two reproduced compatibility defects: inherited prototype names no longer count as existing IDs/amenities, and mixed explicit/legacy row IDs cannot collide. Existing source-derived index IDs are retained when available; conflicting missing IDs receive a UUID reserved for the mounted row and survive reorder. Dedicated prototype-name unit coverage and actual mixed-row browser checks pass at both widths in both palettes. Migration bytes unchanged.
