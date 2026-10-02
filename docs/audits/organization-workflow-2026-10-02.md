# Organization contacts → work → documents — 2026-10-02

Candidate implemented locally; independent review and root release remain required. No production customer writes, schema changes, provider sends, or file uploads performed.

## Delivered journey

Existing Contacts & audience now offers Audience people and Work relationships, with explicit source distinctions. Audience retains its consent/tag CRUD and imports; work relationships reuse Operations records. No IDs or identities are copied between the stores. New linked-project action preserves contact/company; new follow-up task preserves project/contact, assignment and due date. Existing CAS/request recovery remains authoritative, including lost response recovery without duplicate task creation.

Project documents action opens exact validated project scope, preselects the project for upload, uses the existing private upload/version writer, and provides Back to project. Durable `#documents/project/<UUID>` and `#operations/project/<UUID>` routes preserve current workspace query through reload/history. Missing/malformed/archived project context fails closed; Documents offers an explicit authorized-project chooser instead of only retrying broken intent. Navigation service additions already present in TOOLS are preserved.

Source selector uses Zoi tokens, rounded geometry, 44px targets, focus and selected states. Audience tracks actual edit/import changes; tab switching can preserve an unsaved draft. Operations and Documents expose their real dirty/busy handles to shell navigation. Held Documents import captures actor/workspace/owned surface; detached private document DOM is cleared rather than revived.

## Evidence

- `node tests/browser/organization-workflow/verify.cjs`: actual Social shell, actual Audience/Operations/Documents modules, controlled persisted-contract backend at390/1440. Create work contact→linked project→assigned task→lost receipt recovery→upload v1/v2→reopen→reload→Back/Forward; invalid project→choose authorized project; refreshed viewer restrictions; old account surface cleared. Audience dirty-tab cancellation preserves form.
- `node tests/browser/organization-workflow/ownership.cjs`:8 cases at390/1440, actual Documents wrapper/module. Held import plus actor/ancestor change sends zero private reads; held upload result cannot render old private state or overwrite replacement.
- `EXPECT_FIXED=1 node tests/browser/operations-queued-scope/verify.cjs`: existing queued refresh/account/scope/identity regression passes.
- `node tests/browser/suite-documents-privacy/verify.cjs`: existing actual-shell document upload/download and permission/identity regression passes.
- `node --test tests/unit/organization-project-route.test.mjs tests/unit/workspace-navigation.test.mjs`:14 pass including malformed/doubleencoded route and unchanged general routing.
- Source syntax and diff whitespace checks pass.
- Rendered screenshots `/tmp/organization-contacts-{390,1440}.png`, `/tmp/organization-task-{390,1440}.png`, `/tmp/organization-recovery-{390,1440}.png`, `/tmp/organization-workflow-{390,1440}.png`. Phone contact selector/task form/document view inspected; long forms scroll without horizontal overflow.

## Boundaries and release

Tests model retained actual writer responses and readback, not live DB transactions. Existing Operations record/schema CAS/receipt and Documents storage security remain unchanged; production support requires root verification of deployed backend. Audience and Operations remain distinct sources intentionally; this is one useful surface, not identity deduplication or automatic synchronization. Existing host contact picker still consumes Operations contacts. No email/SMS provider is connected by this work. Native organization workflow uses existing web handoff; no native/device/distribution claim.

Root owns parent Social script cache updates (audience, operations, documents, workspace-navigation). Documents wrapper now imports operator with `v=20261002-project-context`; Audience imports new wrapper with `v=20261002-organization-workflow`. No Social edits in this packet. Preserve existing unreleased service TOOLS entries when staging navigation changes.

## Frozen files

- `assets/suite/contacts-workspace.mjs` `3b56c7307166e183567d7b0bab83f2b9754a4aa01dfdce74e1d6cb92ee86a951`
- `assets/suite/audience.js` `6d1414001d0504e3b71f31c83b60cc6401d231dcce6c59586019528b7405b79c`
- `assets/suite/operations.js` `9d299f4488400feda7cef6d9686e65f2cb98377387ee83380751a63cfb30d52d`
- `assets/documents/operator.mjs` `3c334f5b171c0bcec83e5b510f8875ecaebff90957e5ab6ba5c9139483b17a13`
- `assets/suite/documents.js` `db0500186ca5a8dc1875327f5741285619cad636800e4e3b791d052aa0470f4e`
- `assets/suite/workspace-navigation.mjs` `07e7f7e736c16f9135a8dbf033e86c5fe2c33a5f2aa14519278fa227271a186f`
- `tests/browser/organization-workflow/verify.cjs` `07e9be3fb858b506e0a84b7c1d4f958dbd742a6bb4616288f06856c377488ba5`
- `tests/browser/organization-workflow/ownership.cjs` `c6c44731031858db50d4595a896a6d5a3cbcf7be3e21fa59199146435cb31f5f`
- `tests/unit/organization-project-route.test.mjs` `5d9fb1482738f53638585ef0626695aba34c6584e2fcb6377e140e03f9bc0df9`

Internal Documents navigation correction: New, Refresh, document-row selection and Back all preserve an actual dirty title/file when confirmation is cancelled. Busy upload blocks navigation. Explicit confirmed discard clears the draft. Actual Social390/1440 cancellation and confirmed-discard journeys pass.

Confirmed Back with a dirty document prompts exactly once across module and shell; producer390/1440 rerun passes.
