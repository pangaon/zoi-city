# Operations recovery and reviewed enrichment release — 2026-10-01

## Operations

An interrupted new-record save previously allowed a second null-ID save to create a duplicate. The new actor/workspace request receipt commits with the original write. Retry reuses the same request and immutable in-memory arguments; reload checks the saved receipt without persisting private record content. Cancellation serializes with the original write and cannot undo a completed save. Existing legacy writer signatures remain for older clients and internal Creator dependencies; older clients do not gain this retry guarantee.

Independent evidence: `operations-independent-2026-10-01.md` records 11 isolated PostgreSQL checks and actual mounted web modules at 390/1440 using controlled RPC responses. This is distinct from real authenticated production acceptance.

Migration `20261001010515_operations_mutation_receipts.sql` applied once through Supabase migration API. Production readback: RLS enabled, no direct anon/authenticated ledger reads, no anonymous RPC execution, authenticated RPC execution enabled, and zero receipts before client release. A rolled-back authenticated-role probe with no actor rejected execute and cancellation. Existing rows were not mutated.

Security advisors reviewed before and after. New findings are intentional private-ledger RLS without a direct-access policy and two authenticated SECURITY DEFINER entry points. Both entry points check current actor/workspace rights, use an empty search path, and return minimal receipts; helper access is revoked. These bounded checks do not certify all existing project advisories as resolved. See [RLS advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Creator storage exception correction

A successful storage write followed by failed readback now fails closed in web and native recovery controllers. No replacement mutation can dispatch until the original marker is loaded. Independent narrow review: 5 web and 8 native tests passed. Creator entry points and pending-module import are versioned `20261001-creator-storage`.

## Reviewed source enrichment

Source HTML is an explicit reviewed-only capture mode. It reuses existing extraction and identity/transport guards, decodes JPEG/PNG bytes offline in sandboxed Chromium, and records source-only evidence rather than claiming a browser-render proof. Approval binds the artifact, listing/source fingerprint, current prior-machine snapshot and individual image hashes. The adapter preserves useful prior fields and owner data remains outside its writer. Automatic rendered promotion refuses source-only reports.

Independent capture/adapter suite: 50 checks passed. One fresh Melanthi capture produced two room photographs, one promotional banner and a rejected placeholder. Lead visually approved the room photographs and rejected the banner as listing photography. See the separate canary audit for apply and public journey evidence.

## Release status

Specialist native actual Expo-web mounted acceptance passed at 390/1440 for interrupted create, nonce-only remount/recovery, transient draft retention and authoritative access revocation, with zero captured page errors. Native 197 tests and TypeScript passed. Final web rerun also passed the delayed-import account-change regression. Client release and exact archived-tree validation pending at this checkpoint. Full source coverage, real authenticated production lifecycle testing, physical iOS/Android acceptance, connected event inventory/payment/invitation capabilities and the broader requested platform scope remain open.
