# Independent private enquiry journey review

30 September 2026. Scope: customer enquiry and business inbox auth/lifecycle/recovery boundaries. No real customer messages, email or notifications sent.

## Baseline evidence

Reviewed deployed-HEAD modules `assets/inquiries/customer.mjs`, `workspace.mjs` and `model.mjs`. Shared mount lacks an account-generation check around private asynchronous reads and mutations. Its MutationObserver aborts event handlers when markup is replaced but does not reject already pending RPC responses. Request UUID tracking is memory-only; opening a thread clears the reply tracker. These are distinct from server ownership checks.

Reproduced one privacy defect in a browser using an isolated copy of HEAD's actual shared module: begin `inquiry_mine` for account A; clear the active account and dispatch `zoi:auth-change`; resolve A's pending read. A's private conversation title paints after logout. Fixture `.qa-image/inquiry-baseline.html`; script `/tmp/inquiry-baseline.mjs`; screenshot `/tmp/inquiry-baseline-logout-leak.png`. This is a controlled mocked RPC reproduction, not an assertion that another person's production data was accessed.

Frontend specialist owns lifecycle and retry changes. Backend specialist reports no enabled production inquiry settings at audit time; therefore no production customer→business message flow is claimed. Final acceptance needs the isolated PostgreSQL-backed flow and explicit existing QA scope before any production fixture operation.

## Pending acceptance

- Confirm late reads and mutation responses cannot repaint after logout, account switch, workspace switch or unmount.
- Confirm uncertain send retains exact payload and nonce across navigation/reload, with explicit receipt lookup or same-request retry, never automatic duplicate sends.
- Confirm customer start→business inbox→business reply→customer read against isolated actual database functions.
- Confirm owner/admin/editor versus viewer boundaries, transferred ownership handling, and no false email/notification claims.

## Candidate frontend acceptance (mocked RPC)

The replacement shared module was exercised in a real browser at 390px with controlled RPC outcomes. A lost initial-send response fenced new/edited sends. Remount restored the nonce-only marker, receipt lookup opened the saved thread without a second send, and a delayed private refresh after logout did not repaint the prior account. No page errors observed.

Further checks passed: a first definitive daily-limit refusal unlocks the form; the same refusal after an uncertain retry preserves the original nonce; a lost cancellation response preserves recovery; cancellation returning an already-saved receipt opens that existing conversation without a duplicate send. These tests do not assert real server cancellation behavior.

Fixture `.qa-image/inquiry-candidate.html`, scripts `/tmp/inquiry-candidate.mjs` and `/tmp/inquiry-refusal-candidate.mjs`. Screenshot `/tmp/inquiry-candidate-recovered390.png`.

Initial authority SQL candidate passed 21 independently rerun isolated PostgreSQL checks. Subsequent server cancellation additions require separate final acceptance; do not reuse this count as proof of those later changes.

## Final actual PostgreSQL-backed browser acceptance

Used a loopback-only isolated PostgreSQL bridge at 8785, with the test suite's owner/customer UUIDs and synthetic listing/workspace. The actual current mounted shared module ran at 390px and 1440px. No production credentials or real client messages were used.

A customer start was genuinely committed to PostgreSQL while its HTTP response was deliberately dropped. The UI retained recovery, and real `inquiry_receipt` opened the saved thread with exactly one `inquiry_start` call. The operator then sent a real reply through the UI; the customer reopened the thread and saw both messages from the database. Exact semantic receipt checks were active.

A second start was dropped before reaching the server. The UI's Cancel if not saved called the real cancellation RPC and removed recovery only after confirmation. Delayed real customer-list responses were released after logout and after removal of the parent root: neither restored private DOM. No page errors were observed.

Independent final runs: **22 enquiry PostgreSQL checks passed**, including cancellation serialization/race orders, current staff and claim revocation, historical privacy, and exact rollback fixture; **10 frontend unit tests passed**, including full semantic receipts. `inquiry_cancel_pending` locks the same actor profile row as start/reply, checks historical receipt before creating an actor-scoped tombstone, and bounds new cancellation records. Candidate review found no server authorization blocker.

Evidence `/tmp/inquiry-real-independent.mjs`; `/tmp/inquiry-real-customer1440.png` shows both actual messages. `/tmp/inquiry-real-operator390.png` was captured during post-reply refresh and is not used as proof that the final operator message list had rendered. No email/attachment/realtime delivery capability is claimed.

Final operator semantic-receipt browser check also passed against a fresh isolated database: actual start; status/assignment update to resolved; disable enquiries; re-enable enquiries; actual operator reply rendered. The stricter settings workspace/listing/enabled/version+1 and update thread/workspace/status/assignee/version+1 checks accepted the genuine SQL responses. No page errors or horizontal overflow. Settings details collapse when the list rerenders; the test reopened that disclosure before the next action rather than treating a hidden control as a failed save. Final operator evidence `/tmp/inquiry-real-final-operator390.png` was visually inspected and shows the real reply. No remaining blocker found within this bounded web inquiry scope; native parity, external notifications and attachments remain outside this acceptance.
