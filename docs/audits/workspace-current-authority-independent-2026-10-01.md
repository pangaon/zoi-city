# Independent shared workspace authority review — 2026-10-01

Accepted final local candidate for parent-controlled release. Production migration/readback is still a separate gate; no production calls or customer mutations were made by this reviewer.

## Frozen candidate

- `supabase/migrations/20261001170000_workspace_current_authority.sql`: SHA256 `67bfcd07af32c9d8da78ace87ed67c2aeffd209d751e8ffad2417f8114e3a07a`
- `tests/database/workspace-current-authority.integration.mjs`: `288c5a81d3866a1c77b60374cabcd8dcd6bd7a7a435f4a195bdb9d12c53f8fc7`
- Retained before fixture: `fd16cb18374cc5203723ddbeacb7db18e04414751303c94c000e9629affa5541`

The migration guards all 21 replaced definitions by exact retained production MD5, preserves existing public signatures/ACLs through CREATE OR REPLACE and leaves private new helpers uncallable by ordinary clients. It changes authorization, not ownership, memberships, receipt schemas or customer content. Transactional DDL uses bounded lock and statement timeouts.

Current membership wins over historical creation. Explicit viewer, NULL or unknown membership cannot regain owner privileges through fallback. A current recorded owner without a membership retains existing team-compatible legacy access; a stale owner membership after ownership transfer becomes viewer. Read authorization stays compatible with existing STABLE readers. Mutation gates serialize workspace then membership; settings retain the initial nonlocking check and actor advisory order, then lock/recheck authority before accessing immutable receipts.

The first role-only candidate passed 13 independent groups but retained disabled/revoked-token eligibility. Parent explicitly expanded this scope, without imposing verified-email requirements on all suite accounts. The final STABLE read helper checks current enabled/nonanonymous Auth user and matching unexpired session without locks. The writer checks and locks Auth user/session after workspace/member waits. Email-null phone-auth sessions remain valid. Read snapshots have ordinary transaction visibility; the mutation path supplies the stronger serialization guarantee.

## Independent execution

`node tests/database/workspace-current-authority.integration.mjs` independently passed all 17 groups, `/tmp/workspace-authority-session-independent.log`.

Coverage includes 21 mutation paths and six representative readers from retained actual bodies, preserved campaign/social transitions and notes, role/fallback/transfer denials, STABLE compatibility, settings CAS/immutable replay, demotion during advisory waits, ownership/member changes before writes and write-first serialization. Auth cases include phone-only success, deleted/banned/anonymous users; expired/mismatched/missing/malformed/revoked sessions; ban/revocation completed while waiting on workspace; and later revocation blocked by an authorized writer's session share lock.

Captured ACLs are modeled where retained and preservation compared. Uncaptured fixture ACL defaults are not claimed as independent production privilege evidence. Remaining actual deployment/readback belongs to root while database management is unavailable.

## Product and integration limits

No browser family journeys, customer email delivery, social publication or production mutation are proved by these SQL tests. Campaign scheduling assertions concern database state only. The candidate preserves the separately reviewed claim/status code and existing stronger home-content authorization. Representative full suite browser journeys should remain a separate release evidence item.
