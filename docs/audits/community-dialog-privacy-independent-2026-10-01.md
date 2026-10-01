# Community account-change private dialog audit

Confirmed 2026-10-01 using actual assets/community/experience.mjs and controlled browser RPC transport; no runtime edit or live account/provider action.

18 cases: widths390/1440 × preferences/profile/composer × same-tab zoi:auth-change/cross-tab storage/focus. Each starts with a valid UUID actor and distinct internal profile UUID, opens the actual dialog, and enters a unique private value. The actor then changes to another valid UUID. Replacement community_me, when called, remains deliberately held.

- Six same-tab auth-change cases: dialog remains open and visibly contains the former actor's private preference/draft. No replacement read begins because the module has no zoi:auth-change listener.
- Twelve storage/focus cases: checkAccount closes the dialog but prior private input/textarea values remain in hidden DOM while new account load is held. close() pauses videos and closes the dialog but does not clear its body.

Evidence: tests/browser/community-dialog-privacy/verify.cjs; /tmp/community-dialog-privacy-independent/report.json; /tmp/community-dialog-privacy-independent.log; screenshot /tmp/community-dialog-privacy-independent/auth-private-dialog.png. All browser external requests are blocked. This is functional DOM/privacy evidence without product CSS, not a visual design review. The storage/focus issue is retained hidden fields, not claimed continued visibility. No cross-account write is claimed; recently corrected identity guards still fence mutation scope.

Proposed narrow correction: register same-tab auth-change with the same account transition handler; on confirmed actor change clear private dialog content/title and associated private view state immediately before asynchronous reload. Preserve normal same-account close/reopen draft behavior and exact receipt recovery. Avoid globally deleting actor-scoped durable recovery records. Re-run fixture with EXPECT_FIXED=1, then add same-account reopen and held response positive/negative tests to protect intended drafting behavior.

## Correction accepted

Root candidate experience.mjs SHA256 d6979bc94d85f4359eb97c6ed3886e053dff3e346e920a1a40f5cb2383868258 adds same-tab listener and transition-only dialog body clear. Independently reran all18 cases with EXPECT_FIXED=1: every dialog closes and contains no prior private field while replacement read is held. Extended fixture closes/reopens same-account profile/composer before the switch; all12 such paths preserve their entered drafts. Evidence /tmp/community-dialog-privacy-fixed-independent/report.json and corresponding .log. Ordinary same-account draft behavior and durable recovery storage are not globally deleted. Accepted for this bounded lifecycle correction.
