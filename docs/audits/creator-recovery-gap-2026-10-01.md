# Creator uncertain-write recovery gap — 1 October 2026

Read-only review of the release worktree, chiefly `supabase/migrations/20260930021401_creator_briefs_and_deliverables.sql`, `assets/creator/{studio,model}.mjs`, `assets/inquiries/model.mjs` and `mobile/src/CreatorStudio.tsx`. No production calls, writes or schema changes were performed. Scenarios below follow the current function and client contracts; they are not claims of observed duplicate production records.

## Existing database guarantees

| Mutation | Existing serialization / replay guarantee | Lost-response consequence |
| --- | --- | --- |
| Convert enquiry | Actor/request uniqueness, exact argument comparison, locked enquiry and unique inquiry-to-campaign; project creation shares the transaction | Same request recovers campaign. New request cannot create a second campaign for the same enquiry, but gets already-converted rather than the original receipt. |
| Save private draft | Locked campaign through `creator_write`, expected campaign version; no request nonce | Committed retry with old version conflicts. Refreshed identical save can create another version/audit entry. Current state alone is not proof of a particular request. |
| Create deliverable | Caller-supplied `p_id`; existing ID replays only for same campaign and exact `initial_data`; linked task created in same transaction | Losing the ID and generating a new one permits a duplicate deliverable and another Operations task. No content uniqueness prevents this. |
| Update deliverable | Locked campaign/deliverable and expected deliverable version; linked task updated transactionally | Committed retry with old version conflicts; there is no exact mutation receipt. |
| Share brief | Actor/request uniqueness, matching campaign/source version; expected campaign version and no-unchanged-share guard | Same nonce recovers existing brief. New nonce after lost success generally hits version conflict/no-changes, not a success receipt. Later legitimate source changes allow another share, so matching current content is not sufficient request identity. |
| Submit proof | Actor/request uniqueness, exact campaign/deliverable/URL/note; unique active submission per brief+deliverable | Same nonce replays. New nonce generally gets already-submitted while the old submission is submitted/accepted. After changes-requested or a later brief, a replacement submission is allowed, so losing request identity remains material. |
| Decide brief / submission | Locked target; terminal-state replay requires same decision nonce, decision and note | New nonce returns already-recorded. Replaying the original accepted submission decision does not repeat the linked task completion update. |

Most replay functions first require current write authority/business availability via `creator_write`. Authority loss or an archived project can therefore deny even a previously committed request replay. A safe identifier-only receipt endpoint would allow reconciliation without exposing private content or authorizing a new write.

## Current clients

Web `requestTracker()` stores only an in-memory fingerprint and UUID. Changed form content generates a new UUID. Trackers are discarded on remount/account changes/denial, and New deliverable explicitly drops that tracker. There is no durable unresolved-request fence; draft and deliverable updates do not have a request nonce at all. The shared web `receipt()` checks `{ok:true}`, object ID and optionally an expected ID, rather than every mutation argument/nonce.

Native keeps one in-memory pending specification for campaign actions and another for conversion. An unchanged retry while that component survives is safer, but pending data disappears on unmount/denial; explicit “Discard pending … after review” clears it without server proof. New deliverable IDs originate in component editing state. Neither platform stores a durable actor-scoped nonce marker for creator writes.

The recently released privacy correction correctly clears private payloads and rendered data. It must not be described as uncertain-write recovery: losing private payloads should coexist with retaining a minimal unresolved nonce, not erase evidence that a write may have committed.

## Concrete priority cases

1. Create deliverable A commits, response is lost, user leaves/reloads or discards, recreates the same deliverable with ID B. Both rows and both linked tasks are valid under the current schema. This is the clearest duplicate side-effect risk.
2. Draft/update commits, response is lost, exact retry reports version conflict. The UI cannot distinguish its successful operation from another editor's intervening operation without a receipt; refreshing and blindly replaying can create an extra revision or overwrite newly reviewed work.
3. A proof submission response is lost; its request reference disappears; the customer requests changes meanwhile. Resubmitting the same payload under a fresh nonce now creates a permitted new submission even though the user intended recovery of the first attempt.
4. Role revocation after an unknown result correctly hides content but currently erases client request state. Restored access no longer has the original identifier needed for exact replay.

## Reuse and minimal robust direction

Existing `creator_get` provides authorized campaign/brief/submission history and operator deliverables/audit; list endpoints are capped at 100 and cannot establish that a request never happened. Embedded request IDs in records can support confirmed-match reconciliation, not authoritative absence/cancellation.

No dedicated creator receipt/cancellation API exists in the reviewed migrations. `inquiry_receipt` and `inquiry_cancel_pending` are scoped to inquiry mutations and cannot resolve creator writes directly. Reuse their *pattern*: same-actor nonce lock, minimal identifier-only receipt, cancelled tombstone and transactionally serialized mutation. Do not route creator references into inquiry RPCs or infer cancellation from an empty current list.

A bounded generic creator mutation ledger/wrapper could supply nonce identity to draft/update as well as existing replayable actions, record the exact operation/target/payload binding and receipt in the same transaction, and expose actor-only receipt/cancel methods. Cancellation must acquire the same lock as the writer; a timed-out cancellation does not justify clearing a marker. Keep current authorization checks for new writes, private rendering and replayed private records. Preserve a durable actor-scoped marker before send and after unknown/revoked outcomes; retain full payload only in memory; block replacement writes until receipt or authoritative cancellation resolves it. Validate returned operation, nonce, target, resulting version and exact request semantics before announcing success.

Required independent cases: commit-then-lost-response, genuinely uncommitted timeout, retry/cancel race, later authority loss, account switch, reload without payload, storage denial, two concurrent attempts, malformed/mismatched receipt, and restoration of original IDs without duplicate linked Operations tasks. Native and web must use the same mutation contract. No implementation acceptance is claimed by this audit.
