# Parea current-session gap and shared correction proposal

This is a release blocker found by executing retained real PostgreSQL writers, separate from the passing controlled Expo UI journeys. No production write was attempted.

`tests/database/native-parea-journey.integration.mjs` first exercises native clients against the real retained host writer: quota 10, separate 3/1/5 recipients, one ticket unassigned, immutable lost-response replay and three distinct capability hashes. It then expires the host's actual `auth.sessions.not_after` and expects rotation to be rejected. The current retained writer instead succeeds. The strict default assertion fails; `/tmp/native-parea-sql-new.log` is retained under the producer evidence directory. This failure is not waived by native token refresh or an HTTP success.

Fresh read-only installed definitions confirm the same gap:

- `zoi.table_inventory_actor()` definition MD5 `f6a94934d4233ae00ad8233a7b11d2fc`: maps `auth.uid()` through `ensure_profile()`; no current session, anonymous-user, deleted-user or banned-user check.
- `event_host_guest_save(...)` MD5 `7dc0e37c687c7ca3c421b44adacbe5d2` and `event_host_claim(...)` MD5 `93224e3071b4b0303e21649b473f6508` use that helper. Host cancellation checks the helper again after request/actor locks but inherits its missing current-session check.
- `zoi.suite_current_session()` MD5 `8ceef7877aeb972d09d8694f6c85dff7` already enforces an actual matching session ID, undeleted nonanonymous unbanned auth user and current session expiry, using `clock_timestamp()`.

The installed consumer inventory records exact definition/source hashes, postgres owner, empty search path and execute ACLs. All exposed consumers have authenticated/service execute and no anon execute; private helpers have neither anon nor authenticated execute. `direct_session_check=false` is a textual direct-call observation, not proof that a function lacks an indirect guard. Deadline payment functions delegate through their current helper; their separate reviewed checks must be preserved.

The smallest shared correction starts with `table_inventory_actor()` invoking the retained `suite_current_session()` before resolving the internal actor. That secures its private read and write consumers and the existing post-advisory-lock cancellation checks. Entry-time validation alone is insufficient: host guest-save can subsequently wait on settings, listing, allocation and guest locks; claim can wait on settings/guest/listing locks; release can wait on allocation/settings/listing locks. Recheck current session and unchanged internal actor after the final blocking lock and immediately before the mutation or historical receipt return. Apply the same rule to hold create/release/status and operator helper consumers where their final wait currently lacks an authority check. Preserve exact payload, nonce, scope, budget, quota, token hashing, first-holder binding, owner/pricing checks and ACLs. Do not broaden anonymous access or change existing receipts.

Lead owns the schema correction. Candidate acceptance must include expired/revoked/deleted/anonymous/banned sessions, actual observed lock waits followed by session revocation, actor switches, original-owner change and cancellation-versus-late-claim races. Native UI account/workspace/event fences are a separate gate; they do not replace database authority.
