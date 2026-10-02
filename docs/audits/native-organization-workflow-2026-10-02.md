# Native organization workflow — 2026-10-02

Implemented native linked project and follow-up task creation using existing Operations recovery/CAS writers. A saved contact preselects its company/contact in a new project; a saved project preselects project/contact in a new task. Saved child records can be opened from their parent. Contextual actions disable when current form differs from saved record or recovery is unresolved, preventing local edits from being silently replaced by these new actions.

Project documents deliberately opens the web workflow with exact selected workspace and project. Fresh ops_records_list must verify all rows belong to that workspace, a unique active project exists, and role is owner/admin/editor. URL carries no credential. Browser reauthentication is explicitly explained; existing standalone native Documents upload/download implementation is unchanged.

All local Operations private requests now refresh token, recheck captured actor/workspace before dispatch through actual SessionClient.request with the captured token, then check again after response. The new transport retains current Operations private clearing on401/403/42501. Unlike SessionClient.rpc, it does not clear the shared credential vault on401: the rendered Operations records/form/actions are cleared and the app can reauthenticate independently. No session-wide credential mutation was added under this file scope.

## Verification

- `node --test mobile/tests/organizationWorkflow.test.mjs mobile/tests/operations.test.mjs`:21 pass. Actual SessionClient refresh actor/workspace changes prevent private dispatch; exact current project/role/archived/duplicate/foreign checks; existing writer payload/receipt/deadline tests remain passing.
- `node tests/browser/native-organization-workflow/verify.cjs` against Expo web at http://localhost:8197:390/1440 pass. Actual app Grow→selectedorganization→Operations→savedcontact→newlinkedproject→newassignedtask→exactDocumentswebURL. Fresh viewer rejection opens nothing;401clears fields/action; held project read followed by tool unmount/workspace switch opens no old destination. Controlled API persistence/readback, not livecustomertransactions.
- `node mobile/node_modules/typescript/bin/tsc --noEmit -p mobile/tsconfig.json`:pass.
- Screenshot `/tmp/native-organization-390.png` visually inspected: full-width rounded action panel, legible contextual links, persistent brand/navigation. Desktop `/tmp/native-organization-1440.png` retained.

Root owns native export and release verification; no signed iOS/Android build, simulator/device acceptance, app-store distribution, online-payment or provider-delivery claim. No App/Auth/SessionClient/ticket/web frozen files changed in this packet.

## Frozen files

- `mobile/src/Operations.tsx` `ae7f0d9b49478f9cc0d9ca1e0301cecfb50252dea6d783b406ca2b91e9e9e07d`
- `mobile/src/operations.ts` `5fff2050ba75ebeca9f7f9e8434d815765f4034af0e3b726364ab6c504db6772`
- `mobile/src/organizationWorkflow.ts` `812368502cd7b0839f8843e03fc9531015fd8ccdd6332d2101379408d366de40`
- `mobile/tests/organizationWorkflow.test.mjs` `013a760d27ec49dfa05bcf89c902bde1165ea3b012431eaa5b9f5f692a5961c0`
- `tests/browser/native-organization-workflow/verify.cjs` `1d33f34d03740d52c3fad86bf6f9132042c32d27ee694948aad8f32ac197e797`
