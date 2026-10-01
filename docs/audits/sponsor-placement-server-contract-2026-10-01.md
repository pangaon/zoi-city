# Sponsor placement server contract — 2026-10-01

Candidate only. No migration applied, production sponsor approved, customer artwork fetched, or public UI connected by this lane.

## Ownership and evidence

Owned migration `supabase/migrations/20261001041345_festival_sponsor_placements.sql`, actual PostgreSQL fixture `tests/database/festival-sponsor-placements.integration.mjs`, and this audit. Root owns existing festival operator and public room integration.

Existing business forms accept external image references. Community finalized media is private post/avatar content and is not authority to publish sponsor artwork. This implementation therefore accepts constrained external HTTPS artwork references with explicit owner/admin approval. It does not claim uploaded-byte inspection, image dimensions, ownership, malware inspection, or an operational media moderation provider. Approval applies to the reference; externally hosted bytes may change. Public rendering must use existing safe image handling and provide failure fallback.

## Contracts

All authenticated methods authorize the current actor against the exact current event workspace. Owner/admin can mutate; editor can read; viewer cannot enter this private operator. No legacy owner fallback overrides membership. Hidden/moderated events remain manageable for revocation but cannot be newly approved or publicly projected. Helpers and tables have no direct anonymous/authenticated grants; RLS enabled.

- `festival_placement_operator(p_workspace uuid,p_event uuid)` returns `{ok,scopes,placements,can_manage,artwork_source:'external_image'}`. Private placement rows include version, application ID, approval actor/time and timestamps.
- `festival_placement_scope_save(p_workspace uuid,p_event uuid,p_configuration text,p_expected_version integer,p_request uuid)` returns `{ok,scope,request_id}`. Configuration is `front` or `side`; missing revision is 0. Explicit scope change increments revision and immediately excludes old artwork. Transferred scope ownership fails closed pending a deliberate migration.
- `festival_placement_save(p_workspace uuid,p_event uuid,p_id uuid,p_expected_version integer,p_request uuid,p_action text,p_data jsonb)` returns `{ok,placement,request_id,artwork_source:'external_image'}`. Caller generates stable placement/request UUIDs. Draft data requires exactly `application_id`, `configuration`, `configuration_version`, `title`, `description`, `image_url`, `destination_url`, `starts_at`, `ends_at`. Approve/revoke data is `{}`. Every mutation uses expected placement version (new is 0). Editing resets artwork approval; approval and revoke increment version. Approved sponsor allocation is necessary but does not approve artwork. At most three overlapping approved placements per current configuration revision. End must be future, interval finite and at most 366 days; dates include timezone.
- `festival_placement_receipt(p_workspace uuid,p_event uuid,p_request uuid)` returns `{ok,found,receipt,historical:true}`. Receipt is actor/workspace/event scoped and current authorization is checked after waiting. Exact retry returns accepted result; changed payload under same request is rejected. Historical receipt must be followed by current operator refresh. Unknown receipt does not authorize clearing an uncertain request or fabricating success; retain exact request for explicit retry.
- `festival_placements_public(p_event uuid,p_configuration text,p_configuration_version integer)` returns `{ok,server_time,placements}`. Each public row contains only `id,event_id,configuration,configuration_version,approval,title,description,image_url,destination_url,starts_at,ends_at,disclosure,artwork_source`. Disclosure is `Sponsored`. This excludes contacts, applications, owner identity and audit data. Anonymous read is permitted. Exact event, current ownership, clean/cleared publication, allocation approval, artwork approval, configuration revision and active window are all required.

Safe URL validation rejects non-HTTPS, credentials, literal IP hosts, local/internal hosts, control characters and malformed references. SQL never fetches artwork. The finite 300 requests/actor/day budget is serialized; private rows are capped at 500/workspace. Receipts remain durable for idempotency; no automatic retention cleanup has been introduced.

## Existing suite extension

`assets/festival/operator.mjs` already owns sponsorship packages and private applications. Add an owner/admin artwork action on an approved sponsor application's card, using its exact event/application identity; mount its editor within that operator. Use the event filter and package kind, not a new standalone admin application. Offer draft preview, explicit artwork approval, scheduling and revoke, with conflicts requiring authoritative refresh. Public room reader should poll the narrow projection, expire promptly and remove withdrawn artwork while preserving focus. Root owns those changes.

This is configuration-level front/side placement only. It does not assign a table UUID, sell placement inventory, collect payment, guarantee an external image's contents, or establish ownership for Toronto/Montréal. Those capabilities remain separate work.

## Database verification

Run `node tests/database/festival-sponsor-placements.integration.mjs`. Disposable real PostgreSQL covers approved allocation versus artwork approval, permission matrix, editor private read, viewer denial, public field privacy, CAS and request identity, edit clears approval, scope invalidation, moderation/visibility/ownership changes, unsafe URLs, active windows, allocation cancellation, revoke, current-authority receipts, grants, concurrent creation, role downgrade while waiting, actual legacy allocation cancellation versus approval, overlapping slot capacity, and cross-workspace placement identity reuse. No production customer records are involved. Browser lifecycle and production evidence remain pending root integration.
