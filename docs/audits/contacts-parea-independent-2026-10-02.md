# Independent Contacts → parea review · 2026-10-02

Accepted the narrow workspace-contact picker and host-form integration for local release integration. No runtime edits, database writes, messages or provider calls were performed.

## Source/authority contract

Picker calls only the retained authenticated `ops_records_list(p_workspace,p_kind=contact,p_include_archived=false)` reader on explicit open/reload. Retained migration20260930001738 requires auth.uid and non-null workspace ops_role, filters rows by workspace/kind/archive and grants execution only authenticated. The returned envelope has no top-level workspace ID; picker checks every row's exact workspace, contact kind, UUID/title and archive exclusion, plus allowed reader role. An empty authorized record array is allowed. Current production authority readback was not performed in this review.

Only CRM record ID/name are projected into picker memory, and only the chosen name enters the editable guest draft. Contact ID is never used as Auth/profile identity or sent in the guest writer; email/phone fields are not displayed or copied. Whole-ticket quantity, existing review and writer contract remain unchanged. The reader still fetches all authorized contacts and local filtering caps displayed matches at30; this is not server-paginated search.

Captured actor plus host event/workspace query, allocation, render epoch and owned-root checks run after refresh and response. Removal records permanently clear retained picker DOM, including immediate ancestor reattachment before a queued send. Host rendering/disposal destroys the prior picker. Account-scoped unknown writer receipts remain untouched.

## Independent journeys

- Original `tests/browser/workspace-contact-host/verify.cjs` passed390/1440: keyboard query→ArrowDown→Enter choice, quantity3 unchanged through review/back, zero writes from selection, wrong-scope denial/retry, empty filter, held refresh/account switch zero sends, held response/account switch and retained picker removal clear.
- Added `tests/browser/workspace-contact-host/scope-independent.cjs` preserves those journeys and adds held-refresh event-query change, workspace-query change and original host-root detach/reattach at both widths. All passed with zero contact sends after invalidation and empty retained picker DOM. Log `/tmp/contact-parea-scope-independent.log`.
- Existing `tests/browser/host-allocation-drafts/verify.cjs` passed390/1440 grant/guest review draft preservation, denial/account clearing and zero writes. Log `/tmp/contact-parea-drafts-independent.log`.
- Two `tests/unit/workspace-contacts.test.mjs` groups passed projection and malformed/wrong-scope/kind/archive/role rejection.

Inspected phone picker screenshot `/tmp/zoi-workspace-contact-390.png`: readable input/result/button and no clipping. Browser fixtures use actual mounted host and controlled RPCs; no production contacts persistence or server delivery acceptance is inferred.

## Reviewed hashes and limits

```text
7b26f00d40a133f36f9c676ed9cf0b85cfc95daffc919b40f27918ec07fe89f9  assets/contacts/workspace-picker.mjs
2bf7a59f44b3c6bd0c149636aa72e51e798bd8a2d02fe77813e927164a26f6f2  assets/tickets/host-allocations.mjs
```

This proves name reuse into an allocation draft, not admission, collected payment, authenticated-recipient matching, automatic invitation delivery or native phone contacts. Existing broader host transport/production backend capability remains outside this delta.
