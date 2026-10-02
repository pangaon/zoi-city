# Native Company administration — implementation packet

## Scope and source

Extends the existing React Native Operations workspace; no new records, server writer, SQL migration or provider. Reuses `ops_records_list`, `ops_mutation_execute`, `ops_request_status`, existing durable Operations recovery, `organizationRpc` and the existing project Documents handoff. The Company dashboard reuses the same pure relationship model as the accepted web Company workspace.

A saved company opens a summary of active linked projects, their assigned tasks and work-contact counts. Company identity fields remain in the existing editor behind Company details & settings. Start company project preselects the exact company ID for the existing persisted project writer. Follow-up tasks retain the exact project and use internal member profile IDs, not Auth UUIDs. Back to company rereads server records and derives the summary from that result. A removed company closes the old detail surface instead of rendering stale identity or throwing from the aggregate.

Company edits remain owner/admin-only; editor may create projects/tasks, viewer can read linked work. Every new navigation is disabled for dirty/saving/unknown-result state. Existing receipt recovery remains mandatory; no fallback writer or blind duplicate creation. The parent captured actor/workspace ref adds a fence before keyed child cleanup. Existing explicit token refresh/pre-dispatch/post-response checks remain in `organizationRpc`.

Documents are an explicit browser handoff, not a new native document store. Current role and exact active project are reread before opening `https://www.zoi.city/social?workspace=<UUID>#documents/project/<UUID>`. No tokens travel in the URL. The browser requires its own authorized sign-in. Project documents continue using the existing web upload/version writers.

## Exercised evidence

- `node --test mobile/tests/companyWorkspace.test.mjs mobile/tests/organizationWorkflow.test.mjs`: 24 passes. Includes exact relationships, archived/foreign/duplicate/missing company rejection, saved project draft payload, role distinctions, actual SessionClient held token refresh and held response actor/workspace/unmount checks.
- `node tests/browser/native-company-workspace/verify.cjs`: actual Expo app, controlled API contract, 390/1440. Owner updates company legal identity → creates company project → assigns task to distinct internal Maria profile with no deadline → saves despite deliberately lost response → unmount/remount → recovers exact receipt without duplicate task → completion with another lost response → pending Back remains disabled → receipt recovery → fresh company summary shows completed assignment → exact Documents browser URL → reload retains linkage. Editor company fields are read-only but project creation available; viewer gets no save or Documents action. Held Documents response after workspace change opens no URL. Generic401 clears company controls.
- `node tests/browser/native-company-workspace/scope.cjs`: six actual Expo cases, both widths: held Documents read then sign-out; held read then unmount; selected company removed before reload. No stale URL, identity or action survives.
- `node tests/browser/native-member-start/verify.cjs`: both widths pass existing member assignment/completion/recovery/readback/viewer/held scope regression with changed Operations component.
- `node mobile/node_modules/typescript/bin/tsc --noEmit -p mobile/tsconfig.json`: pass.
- `git diff --check` on runtime changes: pass.

Rendered phone dashboard, expanded identity form and recovery state inspected: `/tmp/native-company-390.png`, `/tmp/native-company-form-390.png`, `/tmp/native-company-pending-390.png`; matching1440 artifacts captured. Rounded existing Zoi controls retain44px targets and wrap long project/task actions. Browser logs: `/tmp/native-company-browser.log`, `/tmp/native-company-scope.log`, `/tmp/native-company-member-regression.log`, `/tmp/native-company-units.log`, `/tmp/native-company-types.log`.

## Frozen manifest

| File | SHA256 |
|---|---|
| mobile/src/Operations.tsx | f3e651a5459deacbef5b80d867002cbfaae2845c81dbed3beb07c2142d067d6e |
| mobile/src/operations.ts | 037365591b32e1434ae232f459e46bc442ad9215d3285f867bfc82c073847d9b |
| mobile/src/companyWorkspace.ts | 157f45ad4cc3e5733ca9bbb09427419e5140e9703c9535b83a053d99b5e542fa |
| mobile/tests/companyWorkspace.test.mjs | 0dd96a2f59dc1fdf117e3e44700b5ca0d4dd916c9e8f5bf27f54bbf17b0200de |
| tests/browser/native-company-workspace/verify.cjs | 252031907721fffb5d1c2cf175126886c8ce299287139c8793b717a20426dd98 |
| tests/browser/native-company-workspace/scope.cjs | d135bef502d07b1b5d89e475e7ccaf6b5eff1c918417960df020126e626616c3 |

## Capability and release limits

Source and actual React Native components rendered through Expo-web are verified against controlled server-shaped responses. No production Company writes, real documents uploaded, live emails, SQL changes or browser credential transfers occurred. No signed iOS/Android build, physical-device execution, store distribution or online-payment capability is claimed. Root owns exact release/export validation. Independent acceptance is separate. The frozen web Company, Volunteer and native member-start files were not edited.

Company summary covers records returned by the existing reader; this change does not add server pagination or claim government registration/filing/compliance. Existing generic Operations top-level section/close controls retain their prior draft behavior; new Company/project return and linked actions are guarded. The existing screen wrapper and repeated Operations introduction remain outside this packet's product changes.
