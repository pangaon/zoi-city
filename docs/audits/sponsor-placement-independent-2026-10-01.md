# Sponsor placement backend — independent review

Unapplied candidate, 1 October 2026. Read-only review and disposable PostgreSQL execution; no production approvals, uploads, purchases or public sponsor changes.

Reviewed migration `20261001041345_festival_sponsor_placements.sql`, legacy festival allocation/package writers and the dedicated database fixture. Independently ran `node tests/database/festival-sponsor-placements.integration.mjs`: all 15 groups passed.

Frozen migration SHA256 `f2483d8e0202edd84213d4b382e0f82e04a8877fa37be2f8426f0a82c72c8fea`.
Fixture SHA256 `93b230be85c43b7c20c88d4249b036f950630767d5b17ea2cdea288c8ec5d87f`.

## Accepted server mechanisms

Current exact event ownership and explicit workspace membership gate private reads and writes. Owner/admin manage, editor reads, viewer denied; no legacy owner fallback overrides membership. Listing then workspace locks precede allocation/package locks, consistent with the legacy package writer; legacy allocation cancellation and placement approval were exercised concurrently. Membership is read under lock after workspace waiting, and role downgrade during that wait prevents approval.

Actor request serialization and immutable payload identity precede receipt replay. Placement UUID serialization plus expected version protects create/edit races, including cross-workspace identity reuse. The workspace lock serializes slot-capacity and scope-version checks. Editing returns artwork to draft and clears its approval; approved allocation alone never publishes a creative. Scope revision, cancelled allocation, ownership transfer, moderation, hidden publication, time window and explicit revoke all remove the public projection. Revoke remains possible after allocation cancellation.

Public projection is deliberately narrow: title/copy/artwork and destination references, interval, configuration and Sponsored disclosure. It excludes application/contact/reviewer/owner/audit data. Private tables use RLS and have no ordinary direct client grants; anonymous access is only to the public projection. Historical request receipts require current manage permission and exact actor/workspace/event scope.

No new blocker found in this bounded backend candidate. Preserve the documented integration rule: replay/receipt recovery is historical and must refresh authoritative operator state before presenting current approval.

## Limits and remaining guest/owner work

This evidence covers source code and actual isolated database behavior only. The operator editor, preview, scheduling, approval/revoke browser flow, unknown-request recovery and public room polling/removal are not verified here. The feature is not yet live.

HTTPS artwork is an approved external reference, not inspected immutable bytes. Renderer must constrain/fail safely for broken or changed images and must never infer artwork approval from allocation alone. At most three overlapping placements per configuration is conservative server capacity, not purchased table inventory. No payment collection, table assignment, media moderation provider or Toronto/Montréal ownership is established by this migration.

The 300-request daily mutation budget also applies to revoke; if the product needs emergency withdrawal beyond the ordinary budget, that requires an explicit follow-up policy and test. This review does not claim unlimited operator throughput.
