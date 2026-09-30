# Private owner content QA — proposed execution, not yet run

Prepared 2026-09-30. Existing authenticated read-only workflow remains unchanged.

## Exact scope

- Actor `2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd`; profile `21a04e78-e3b1-448e-8517-47aad25dd5da`; workspace `053a5656-b19b-48a4-8721-65c4674f647c`.
- Only fixture `48c711ee-e83b-4ce2-a7cc-4126d713048a`, slug `zoi-internal-private-owner-qa-48c711ee`, name **ZOI INTERNAL QA — NOT PUBLIC**.
- Only content write request `678a541a-c3dc-4cb0-96f5-6d67a1539b54`: synthetic description and one menu entry with no price, contact, website, image, provider action or real offering.
- No design save/publish, claims, intake, uploads, reservation, message or email actions.

## Metadata evidence and constraints

Read-only production inspection found zero owned QA listings, no owner creation/deletion RPC and no authenticated direct listing insert/delete grants. `intake_submit` creates unclaimed drafts, so does not supply legitimate ownership. We do not forge claim approval.

The three listing statuses are plain text columns without listing CHECK constraints; archived is an existing application convention. The live insert publication trigger explicitly preserves `draft`. Provisioning verifies draft+hidden after triggers and aborts the whole transaction on mismatch.

`home_content_requests.listing_id` has a restrictive foreign key. Hard deletion would erase the durable save receipt. Cleanup instead keeps an archived+hidden exact fingerprint tombstone and its immutable receipts; it never deletes audit/history. `bizpage_status` includes all owned records without a status filter, so the clearly labelled tombstone will remain in **this QA workspace's** business selector. It must not be counted as public inventory or normal onboarding proof. No product query is changed just to hide test evidence.

## Reviewed execution order (not automated yet)

1. Review and hash-pin `provision.sql`, `cleanup.sql`, the flow library and a separate new CI/browser runner. Do not reuse or widen the current read-only request allowlist.
2. Provision once with the existing CI management credential. A prior exact ID/slug is a hard stop, not permission to reset it. After an uncertain response, inspect only exact fixture status; do not replay provisioning blindly.
3. Obtain a temporary session for the exact existing QA account using the existing `withQaSession` helper (no email sent, local-only logout in finally). Confirm the selected owned listing is exactly this fixture, not merely the first owned row.
4. In a separate browser request fence, allow only read RPCs scoped to this fixture, the **exact** `home_content_save` payload from `ownerSavePayload`, and `/api/home-preview` with this fixture and the fixed Concierge design. Block all other writes and external requests, especially `home_design_change`.
5. Exercise the real owner content form: change description and menu, save once, require exact receipt, independently read the returned version/content, then open private preview. Assert preview content and containment at 390/1440; this still does not publish anything. `privateOwnerFlow` currently provides the deterministic RPC/preview assertions, not browser interaction proof.
6. Local-only logout. In a separate finally path, run exact cleanup even if the browser or receipt fails; unknown ownership/status/marker changes must stop cleanup and escalate rather than overwrite them. CI cancellation still needs an explicit cleanup follow-up; no guarantee from a process finally block alone.
7. Emit only booleans/status/counts; never session credentials, private response bodies, HTML or tokens. State `public_publish=false`, `normal_creation=false`; distinguish actual browser interaction from RPC-only assertions.

## Current local verification

- `node --test tests/unit/private-owner-qa.test.mjs`: 5 focused tests passed (scope/receipt/preview/transport).
- `node tests/database/private-owner-qa.integration.mjs`: 5 actual local PostgreSQL checks passed (private status, duplicate provisioning, unexpected publication rejection, idempotent audit-preserving cleanup, transfer rejection).
- The SQL test uses a minimal schema fixture; live trigger definitions and foreign keys were independently inspected. Production execution, authenticated mutation, rendered browser preview and public anonymity checks have **not** run.

Existing frozen release-helper diagnostics remain separate. No paid build or production mutation was performed for this preparation.

## Runner implementation freeze

The separate `.github/workflows/private-owner-qa.yml` and `scripts/auth-qa/private-owner-{ci,browser,policy}.mjs` now implement this flow. No trigger request JSON has been created and nothing has executed in production.

**Release ordering is mandatory:** first commit the product fix, runner, workflow, SQL and tests **without a request manifest**, wait for the product fix's Vercel deployment, then make a **request-only commit** adding `ops/private-owner-qa-request.json`. The runner checks the entire parent/head diff and rejects batching any other file with that request. The request must pin every path in `OWNER_CODE_FILES` with SHA-256 and include: purpose `private-owner-edit-read-preview`, exact `fixture_id`, `request_id`, `user_id`, `profile_id`, `workspace_id`, exact parent `base_sha`, ISO `issued_at` and `expires_at` (maximum 30 minutes). Only a non-force push to this repository's main, attempt 1, is accepted. No workflow-dispatch shortcut or automatic retry exists. Cleanup alone has an additional bounded one-hour grace window.

The isolated browser fixes `crypto.randomUUID()` to the reviewed request UUID **inside its private QA document only**. Production JS is unmodified by this test control. All session storage is in-memory; no session travels in process arguments, files, screenshots or artifacts. The request fence allows exactly one complete UI save payload, including the actual form's empty contact fields and harmless default `hero_position=center`, `logo_fit=contain`. It rejects additional profile fields, other IDs, another save or any publication endpoint. The ordinary description/menu controls and form submit handler produce that payload. Read-back and preview content must match. Private preview is opened through the actual Design & layout UI; its controls remain sandboxed and no provider actions execute.

The authenticated browser job is followed by a separate `always()` cleanup step using a non-secret provision-attempt marker written **before** the setup request. An ambiguous setup response therefore still schedules cleanup. Missing/changed fixture guards fail closed; manual exact-state review is required. Cancellation/runner destruction can still prevent cleanup; do not claim a cleanup guarantee. Artifacts contain only booleans, IDs already fixed in source, commit/run IDs, and cleanup receipts; never private HTML. A successful browser result without a successful cleanup receipt is an incomplete run.

### Product correction discovered during preparation

`assets/suite/bizpage.js` now derives its vertical schema from the authorized `home_content_get` snapshot through `assets/suite/owner-entity.mjs`; hidden restaurant/professional drafts no longer require a public `seo_entity` result to expose their menu/practice fields. Scope checks remain intact. `social/index.html` bumps the existing bizpage script version only.

Local browser fixture (explicit synthetic responses, zero production writes): restaurant menu section/item entry → normal Save page handler → saved feedback → private preview passed. No public SEO read occurred. Professional fixture showed practice fields and no restaurant menu. No horizontal overflow at 390/1440. The preview response in this local fixture is mocked, so it proves UI plumbing, not production rendering. Actual live preview is still pending the separately reviewed request.

Focused tests now total 21 passing across private runner, owner context and existing read-only tests; local SQL checks remain 5 passing. No real publication/claim/onboarding acceptance is implied.
