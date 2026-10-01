# Composer and Calendar account-bound journeys — 2026-10-01

## Reproduced source and UI defects

The actual Social shell correctly replaces old module surfaces, but Composer and Calendar appended dialogs directly to document.body without returning lifecycle cleanup. A saved-template dialog and Calendar CSV import text survived account changes. A Composer save held across account change continued into feed_publish_social_post under the next actor. Draft storage used workspace-only keys and Calendar handoff used one global key, so a different signed-in actor could recover another actor's local payload.

Baseline captured in /tmp/suite-shell-privacy/baseline-findings.json. An initial draft probe ran before dependency initialization and gave a false negative; the corrected probe waits for actual scoped storage persistence. Runtime correctness is assessed with the corrected test.

## Correction

Composer and Calendar now own their mounted surface, body dialogs, listeners and outstanding continuation scope. RPC entry and response paths verify actor, workspace and mount identity. An expired/denied current session clears private content; stale responses cannot render or start another write. Composer token access is similarly fenced for direct fetch paths. AI and storage HTTP errors retain status; even non-JSON403 responses take the same private-clear path. Same-account ordinary navigation preserves meaningful draft recovery.

Scheduling remains through existing scoped RPC calls; _schedule.js is a pure helper, not a separate network transport. Local draft/handoff keys now require both actor and workspace. Legacy unscoped payloads are not migrated to a newly signed-in actor. This is logical application isolation, not encryption or protection against another person inspecting the same browser storage manually. Calendar handoffs remain consumed once. Both modules load _schedule.js with dependency version20261001-actor-drafts.

## Exercised evidence

`node --test tests/unit/schedule.test.mjs tests/unit/composer-ai.test.mjs`:38 tests passed, including scoped storage, cross-actor clear isolation, absent scope and legacy payload rejection.

`node tests/browser/suite-shell-privacy/verify.cjs`:38 controlled actual-shell case results at390/1440px, all asserted, no page errors. Includes account-change modal removal, held save preventing downstream publication, persisted draft isolation, held template read rejection, actual workspace selector, normal save→publish, explicit draft Restore, Calendar day→Composer date handoff, RPC403/private clear, non-JSON AI403/private clear, upload403/private clear. The actual workspace selector performs a full document navigation; its test establishes old document destruction rather than pretending to exercise an in-place ctx mutation.

Artifacts: /tmp/suite-shell-privacy/findings.json and screenshots composer-modal-390/1440.png, calendar-modal-390/1440.png, draft-recovered-390/1440.png. Missing and opaque actor mounts additionally assert no module-private RPC, draft storage or private surface; actor and workspace UUIDs are required before mounting. Runtime/syntax and focused diff checks passed. Independent reviewer gets distinct output path.

## Boundaries

All backend/auth/provider data in this harness is synthetic, all external requests blocked. No live sends, publications, claims, payments or database writes occurred. Production deployment is the lead's separate responsibility. Already-issued server operations cannot be canceled retroactively; the repair prevents subsequent writes under another identity and rejects obsolete responses.

Initial AI/Analytics/Connect private surfaces are removed by the existing shell on account change; their deeper queued provider workflows remain outside this acceptance. No claim that those entire modules are repaired or that publication reached an external provider. Current session invalidation must be returned by the backend or observed by the auth shell; this browser work does not replace server authorization.
