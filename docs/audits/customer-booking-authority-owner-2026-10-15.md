# Customer booking current-session authority — owner candidate

Source candidate only; no production writes, provider calls, customer bookings, deployment or UI changes performed by this specialist.

## Defect and correction

Actual read-only production capture confirms six customer booking RPCs authorize through auth.uid/profile but omit the existing current-session guard. Four dual customer/operator paths also use raw owner/admin membership labels. A sole database caller, event_plan_confirm, can replay its own successful booking receipt before it reaches booking_create and takes profile/resource locks first.

New CLI migration20261015012143 guards exact body/owner/ACL/security-definer/search-path metadata for all seven RPCs and three existing authority dependencies (suite_lock_session, venue_require_member, workspace_locked_role). It adds one private actor helper, then replaces the seven guarded definitions. Canonical nonce, immutable reschedule receipt, capacity, price, status, resource-lock order and version logic remain intact. Successful old receipts still require current session/current actor authority before retrieval.

Ordinary customers take current account/session locks and a stable auth-profile mapping without workspace membership. Creation and event-plan confirmation take profile UPDATE mode from the outset, preserving original creation serialization and avoiding a SHARE-to-UPDATE upgrade. Other customer paths take profile SHARE. Potential operator paths enter existing workspace-first foundation authority before profile locks; one captured authority result is reused throughout the RPC. Actual owner fallback is preserved, forged owner labels are downgraded by the existing foundation, and only current owner/admin has operator access. New helper is postgres-owned/private; no new public function grants or foundation edits.

## Executed evidence

`node tests/database/customer-booking-authority.integration.mjs`:20 grouped checks pass in socket-only PostgreSQL16, port15679. Real captured production bodies/ACLs are loaded without adapting migration guards. Existing canonical booking/reschedule/event-plan stores and writers are exercised, with real authority helpers. Auth JWT facade and minimal auth/workspace/profile table scaffolding are controlled local test infrastructure; this is not an actual production account journey.

Checks cover ordinary non-member create/list/options/history; another customer denied private access; create/reschedule/cancellation lost-response replay; stale versions; all six RPCs refusing expired/deleted sessions and banned accounts; old account losing reassigned profile access; current owner/admin and actual owner fallback; forged owner/editor/viewer refusal; concurrent same-nonce create yielding one booking; actual concurrent session deletion, profile reassignment and operator demotion; and multi-slot event-plan confirmation/replay under the preserved lock order with expired-session replay refused. No provider or payment call occurs.

Source review of assets/bookings/customer.mjs finds existing account fences and uncertain-request retention; this candidate did not alter or newly exercise the browser/native UI. Web/native user-facing session-expiry recovery, actual production rollout and no-persistence rollback acceptance remain separate release gates.

## Scope left open

Other event planner save/get/list/provider-context RPCs still require their own current-session and operator-authority review; guarding the confirm dependency does not establish that whole planner suite is safe. This candidate does not add new cancellation nonce receipts or alter canonical final-state retry behavior. It does not claim a booking collects payment, that an appointment represents hotel inventory, or that every family operation is complete.

Parent owns independent review, actual rollback-only production proof, schema application and release. Rollback restores captured seven definitions in customer-booking-live.json, preserving their original ACLs, then removes the newly private helper after dependency restoration. Rolling back restores the prior session weakness; prefer a forward fix when possible.
