# Company Action Plans — producer candidate, 3 October 2026

A company operator can now turn an agreed outcome into a reviewed, assigned project and its tasks from the existing Company administration workspace. This is a coherent operating journey, using existing Operations records and request receipts. It is ready for independent review; it is not deployed or accepted on a live customer account.

## Scope and source contracts

Six runtime files are owned: four new company-action-plan modules/styles, company-dashboard.mjs, and the small Operations integration. Existing company console, company journey, receipt recovery, account identity, document permissions and database writers remain unchanged. The separate Today dashboard is outside this packet.

Four editable starting points cover company record review, welcoming a team member, starting a contractor engagement, and a custom plan. Every title, task, contact, assignee, note and deadline can be reviewed before saving. There are no inferred statutory dates, filings, signatures, externally completed services or provider integrations.

The fresh current workspace read must return a verified company, records, team members and owner/admin/editor role. Contacts must belong to that company; assignees must remain current workspace members. A project and up to twelve linked tasks save sequentially through ops_mutation_execute. Each saved receipt is followed by a fresh authorized row read before the next step. Confirmed records persist even if a later step pauses. There is no invented atomic bulk-save ledger.

The existing recovery mechanism retains actor, workspace, action and request nonce only. Titles, contacts and draft payloads stay in memory. An unknown result blocks replacement writes; the existing Check, Retry exact and Cancel controls reconcile it. Remounting discards the private plan draft but can check the saved project/task receipt. Remaining unsaved draft actions are deliberately not recovered after a reload. Users can open and finish the ordinary saved records.

The new plan renderer loads only when requested. If it fails, ordinary company tools remain available. An explicit retry uses a new browser module request identity because browsers cache failed dynamic imports; successful modules remain reused. Account, workspace and selected-company checks run after that await. No automatic retry loop was added.

## Rendered evidence

Actual Operations and company modules were rendered at 390 and 1440 pixels in light and dark modes. The builder uses the existing Zoi tokens, rounded panels, one-column phone controls and desktop assignment/deadline columns. Primary contrast was visually corrected for dark mode. Keyboard focus moves to the new stage heading after selecting a template and after review; long phone forms return to the start of the review. Reduced motion disables the small card hover animation.

Retained screenshots show template choice, edited fields, reviewed actions, an interrupted save and confirmed records. Visually inspected examples include 390-light-choose, 390-light-edit, 390-dark-review, 1440-dark-review and 1440-dark-saved. These are controlled local fixtures, not photographs of a production customer account.

## Exercised journeys

- 55 combined Company/Operations unit cases pass, including nine new model/controller cases. Review makes zero writes; role changes, awaited account changes, invalid contacts/assignees and unverifiable saved-row links prevent further mutation.
- 14 actual browser cases pass. Four complete light/dark phone/desktop flows save a real fixture project and four tasks, lose the response after the middle committed task, check its receipt, resume without duplicate rows, open the saved project and its document action, and complete a task through the ordinary editor. Both widths also exercise sparse company role downgrade, account change during a held read, private-draft remount plus receipt check, missing receipt plus cancellation, and optional module failure plus explicit retry. External network requests are blocked. No browser page errors or horizontal overflow were found.
- Four existing company-console journeys pass unchanged: filtering, scoped document-record export, contacts, assigned task recovery, explicit legal-name clear, viewer state and logout.
- Nine isolated PostgreSQL groups pass. The fixture reconstructs nineteen retained installed function definitions and ACLs exactly, then applies the already reviewed current-session hardening locally. The JavaScript builder and unchanged recovery controller call the actual retained Operations SQL writers: project/four task fields, committed middle receipt recovery, durable cancellation tombstone blocking a delayed original request, new nonce, task completion and explicit null clears, stale-version refusal, current role downgrade, expired session and removed assignee. This is actual PostgreSQL execution, not an RPC stub. No production database was mutated.

## Native assessment and remaining gates

Guided plan creation is currently web-only. The existing native Operations surface already lists and edits the same company/project/task records, assigns members, changes status and opens scoped project DocumentsPanel; its source paths/hashes are retained as dependencies for review. This packet does not add a native guide or claim a newly exercised native saved-plan journey, physical device acceptance or store distribution. Native guided creation remains open.

A live authorized account, actual project document upload/download from the new saved plan, and production session/provider transport are not exercised by this candidate. Browser evidence reaches the real project document action; document binary handling remains the existing suite, not a new attachment implementation. Root separately owns the current API incident, independent review, final cache/version integration, exact staged checks and release acceptance. No passing local test is presented as proof that current production RPCs are healthy.

## Reproduction

Use the immutable snapshot and verify every manifest hash before running:

```sh
node --test tests/unit/operations*.test.mjs tests/unit/company*.test.mjs
COMPANY_PLAN_EVIDENCE=/absolute/reviewer/output node tests/browser/company-action-plan/verify.cjs
node tests/browser/company-action-plan/previous-console.cjs
COMPANY_PLAN_PGPORT=15694 node tests/database/company-action-plan.integration.mjs
```

The browser runners need playwright-core 1.63.0 and Chromium; override CHROMIUM_EXECUTABLE_PATH if necessary. The PostgreSQL runner needs PostgreSQL 16 binaries and an unprivileged OS user capable of initdb; override PG_BIN. It creates and destroys only its isolated temporary cluster. The previous-console runner writes beneath this snapshot's own evidence directory; copy the frozen snapshot to a reviewer-owned directory first to keep producer evidence immutable.

The PostgreSQL baseline is retained historical installed source plus the exact reviewed migration body. Production installed ledger version differs from the historical CLI proposal filename; no migration is proposed or applied by this feature. Broader production database/session race acceptance remains the prior independent authority packet, distinct from this new generated-payload proof.

All initial failed checks are retained: malformed UUID validator, database setup helper, accessible select lookup, review focus replacement and cached failed module retry. Final evidence supersedes these negatives only for the cases explicitly rerun.
