# Private workspace access corrections — 1 October 2026

## Defects and implementation

Current deployed creator studio retained private campaign content after account changes. Its RPC wrapper did not fence late results by actor or mounted root. The operator/customer enquiry view already fenced account changes but retained private conversation content after same-account access revocation.

The shared creator view now binds every RPC to the original actor and mounted wrapper; both late success and late failure are rejected after disposal/remount. Sign-out/account events clear private state and DOM. Authoritative creator denial (permission error,42501,HTTP401/403) clears campaign forms, list and detail; Refresh checks restored access. Customer entry-page generations prevent obsolete OTP completions repainting a newer account. Suite mounts return their disposal handle. Customer and suite entry imports are versioned.

Enquiry denial clears protected settings, conversation list/detail and in-memory pending message text while retaining the existing durable nonce-only recovery record. Receipt checking and cancellation remain explicit. Transient failures preserve unsent drafts. Read-only business changes are not treated as blanket read revocation.

Native Creator Studio uses a shared denied-access RPC wrapper for reads and mutations. It clears campaign detail, editor, proof fields, notes and parent caches; refresh remains available. Existing account/workspace-keyed mounts remain intact. Native enquiry reads already cleared denied detail and parent inbox state, so no duplicate implementation was added there.

## Independent evidence

- Actual web modules in `tests/browser/creator-access/verify.cjs`:390/1440 transient draft preservation, denial/recovery, sign-out, delayed success/error after new-account/new-workspace same-root remount, stale OTP send and verify completion. Synthetic auth/RPC only; outside requests refused.
- Actual enquiry module in `tests/browser/inquiry-revocation/verify.cjs`:390/1440 same-account denial cleanup, durable uncertain-send marker retained, replacement send blocked, restored access, transient drafts and delayed account-switch responses. No messages sent.
- Native actual TSX Expo-web fixture, independently rerun at390/1440: transient loaded detail retained; uncertain save followed by denial clears private editor/detail/retry; parent cache empty on Back; restored access Refresh works. Four focused helper tests,189 native tests and TypeScript passed in specialist run.

## Limits retained

These are mounted frontend acceptance checks with synthetic responses. They do not assert a real production customer changed membership or sent a message. Production asset parity and release checks are recorded by the lead after deployment. Physical native devices are not exercised. Creator mutation request recovery is still memory-only; durable uncertain-write receipts and its discard/reload paths remain a separate unfinished workflow. This release does not claim those guarantees or any new payment/notification integration.
