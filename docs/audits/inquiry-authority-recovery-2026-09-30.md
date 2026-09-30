# Private enquiry authority and recovery — 2026-09-30

## Live-source findings

Production function definitions still matched the original enquiry migration: visibility checked publication/hidden state, but not moderation or resolved recipient authority. Production enabled settings count was zero. No Signature owner, recipient, claim or event binding was created.

Inspected all public/zoi function definitions containing INSERT INTO listings (qualified or unqualified). Only three were found: `tickets_event_create`, `zoi_ingest_entity`, `intake_create_draft`. The event creator establishes a workspace-owned `event` with `ingestion_source=organizer_created`; it requires workspace membership. It does not create a claim. Owner/admin-only enquiry opt-in is an additional mandatory gate. The importer supplies editorial provenance, not owner authority. Intake explicitly creates hidden/unverified/unclaimed private drafts. Only `tickets_event_create` among current public/zoi functions references the top-level ingestion_source column; profile edits do not constitute that provenance.

## Candidate

`20260930200419_inquiry_recipient_authority_and_receipts.sql` preserves the existing thread/message/audit system and signatures. New recipient eligibility requires published, clean/cleared, not hidden, and current owning workspace, plus either:

- Authoritatively organizer-created event, excluding disputed/rejected/transferred claim state; or
- Claimed/owner_verified listing with a matching current workspace claim marked claimed and verified_at set.

Eligibility applies to enabling, availability, new starts, new replies and thread can_reply. Staff inbox adds `eligible:boolean` to listing setup rows. Claim rows are locked during new messages/setup; current staff membership is checked under a shared row lock. Disabled settings still block new threads; this patch does not redefine existing conversation closure semantics.

Historical original-participant reads and exact nonce replays remain compatible. Ownership transfer never grants a new workspace old conversations. Existing full-thread replay returns current thread metadata, so it is idempotent message creation rather than a byte-for-byte immutable thread snapshot.

### Recovery contract

`inquiry_receipt(p_request uuid)` is authenticated, actor-scoped and read-only:

- Absent: `{ok:true,found:false,cancelled:false,request_id}`. This does not prove that an in-flight request will not arrive.
- Cancelled: `{ok:true,found:false,cancelled:true,request_id}`. This is durable proof that this actor's nonce cannot subsequently send.
- Committed: `{ok:true,found:true,receipt:{kind:'start'|'reply',request_id,thread_id,listing_id,message_id}}`.

No names, subjects, body, contacts or workspace payload are returned. Initial thread/first-message nonce resolves as start. Business-reply recovery additionally requires current operator membership in the original workspace; removed staff receive permission denied. Fetch conversation separately for current access/content.

`inquiry_cancel_pending(p_request uuid)` locks the same author profile row already used by start/reply:

- If committed first, returns the minimal found receipt plus `cancelled:false`.
- Otherwise stores an actor+nonce tombstone and returns `{ok:true,cancelled:true,request_id}`. Every later start/reply with this actor+nonce raises `inquiry_request_cancelled`.
- Existing tombstone retries are idempotent. New tombstones are capped at100/actor/rolling24h. They contain no message payload and do not expire, because expiring them would permit delayed old sends.
- A revoked business author cannot replace a committed reply with a cancellation.

Only validated matching server receipt/tombstone permits the frontend to resolve an uncertain send. No found:false shortcut, blind retry, email delivery, event binding or booking confirmation is introduced.

## Evidence and release boundaries

`node tests/database/inquiry-authority.integration.mjs`:22 isolated real PostgreSQL checks pass, including inherited participant privacy, role refusals, pagination, version CAS, exact send retries, concurrent send idempotence; moderation/null refusal; current verified claims; owner-created event compatibility; imported owner pointer refusal; claim/role revocation after concurrent row locks; actor-only receipts; send-first/cancel-first races; cancelled late start/reply refusal; revoked staff; rate limit; private table grants.

`ops/verify-inquiry-authority.sql` is a dedicated QA actor/workspace synthetic event/message fixture ending ROLLBACK. The same local harness runs it and verifies all listing/thread/message/audit/settings/cancellation counts unchanged. It does not alter real client ownership or messages.

An isolated loopback PostgreSQL browser fixture was supplied to independent QA for actual shared UI customer→operator→reply acceptance. That evidence is separate and pending at the time this document was written. No production mutation/deployment was performed by this specialist. Root owns controlled migration release, production rollback verification and current public journey verification.

Native uses the same server contract, but durable mobile nonce recovery remains separately tracked. No enabled production recipient or validated Signature event→organizer binding is inferred from these tests.
