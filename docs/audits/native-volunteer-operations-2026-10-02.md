# Native volunteer operations companion — 2026-10-02

Local source candidate. No production writes, messages, migration application or signed distribution. Root owns integration and release.

The existing native program/shift forms are preserved and now call the same receipt-bound `org_operation_save` and recovery RPC as web. Program and shift creates retain server-allocated identities across response loss and remount. Recovery markers use the existing PrivateRequestStore primitive, a separate actor/workspace namespace, secure storage on native and sessionStorage on Expo-web. No token is stored in a marker or URL. Pending saves block new edits; exact confirmed result is cleared before optional list reload; request cancellation preserves an existing draft.

The existing private roster now supports arrival, completion, no-show and correction with a reason, using the same registration version and operation receipts. Staff marks do not change signup/payment. Public signup/cancel and operator RPCs use actual SessionClient token refresh followed by captured actor/workspace/unmount check before dispatch and again after response. Same-session refresh is allowed. Native role comes from the current scoped schedule response, and denied requests clear private form/list/roster state. The scoped helper uses SessionClient.request directly:401 clears this surface but does not claim to revoke/clear the shared session vault automatically.

## Evidence

- `node --test mobile/tests/volunteerOperations.test.mjs`:15 tests including actual SessionClient refresh races for save/signup/cancel/roster; changed actor/workspace dispatch zero calls, unchanged refreshed session uses the refreshed token. Lost create survives controller remount; mismatched recovery scope retains pending marker; exact cancellation clears it.
- Shared receipt predicates plus native tests:22 tests pass with `tests/unit/volunteer-operations.test.mjs`.
- `node mobile/node_modules/typescript/bin/tsc --noEmit -p mobile/tsconfig.json`: passes.
- `node tests/browser/native-volunteer-operations/verify.cjs`: actual Expo app at localhost8197, controlled API at390/1440. Open selected workspace Volunteer programs→create program with lost response→leave/reopen→recover one program→create shift→current roster arrival/completion/correction→held schedule read followed by workspace switch→denied request clears private controls. No calls use the legacy save RPCs.
- `/tmp/native-volunteer-390.png` visually inspected;1440 screenshot also captured. This is Expo-web rendering, not an iOS/Android device or signed binary test.

The public native transport is exercised with the real SessionClient in unit tests; the existing public native signup screen is preserved, but no physical-device or separate rendered native public-signup test is claimed here. Web public signup and staff journey are separately exercised in the web packet.

## Release boundary

Depends on the reviewed volunteer migration and shared pure operation model. The revised SQL retains compatible legacy save endpoints with current authority/session/CAS checks for older installed apps. This new native client exclusively uses receipt writers and has no legacy fallback. Older clients retain their existing nonrecoverable create behavior; new source does not update installed binaries. Production definition readback, independent acceptance and any device/export checks remain release gates. No push, email or SMS delivery integration is added.

## Frozen hashes

- `mobile/src/Volunteer.tsx` `872f9160849a34ec7f8a8df47b991fc7b8461ecd7402f0f663b1b65dbb5b7e95`
- `mobile/src/volunteerOperations.ts` `9d375b136322af9f72cd565bce9962d0d0fa5c417d520b4f0a7dc8faee5ef452`
- `mobile/tests/volunteerOperations.test.mjs` `6801560591b4d21b63a8687c292a144c87aa6df8d4bb2ddc07076b61eb983669`
- `tests/browser/native-volunteer-operations/verify.cjs` `ff2d5700632cee4b3e8517752cc2983e66f1616ab17096d8d4683dfb64117fc8`
- `assets/organizations/volunteer-operation-model.mjs` `92217d892457db3530c5d0bc2c4e8cb906438b95bca7901434bcab7d21b4cea2`

## Installed capability boundary — superseding freeze

The same transactional migration installs `org_programs_list` metadata `actor_profile_id` and `capabilities: {volunteer_operations: 1}` after current workspace/member/session authorization. The client requires an exact numeric version, scoped workspace, valid internal profile ID and recognized role. Existing installations without the new scoped envelope show an explicit unavailable state; scoped schedules without the exact capability remain read-only. No uncertain save is ever retried through a legacy writer. New clients do not call modern save, roster or receipt APIs until this capability is verified.

Web and native local pending markers load without a server request. Missing capability disables Check/Cancel without deleting the marker; availability refresh remains usable even with pending recovery. Once exact capability is observed, the original request can be checked. Refresh resets capability and private forms; actor/workspace/lifecycle retirement still clears the surface. Public signup/cancel contracts are unchanged.

Verification:23 isolated PG groups plus authenticated/anonymous execute-grant assertions;24 combined model/native tests;14 web capability cases at390/1440 (legacy, absent, string, unknown version, invalid profile, role and workspace), each retains a pending marker with zero modern API calls before capability, then recovers after enabling. Actual Expo390/1440 includes absent capability both before first create and after lost-response remount, then successful recovery/attendance. Existing web operator/public, Social,12 private scope,6 import and16 public scope cases still pass. TypeScript passes. New fixture: `tests/browser/volunteer-shift-operations/capability.cjs`.

This supersedes earlier frozen hashes/acceptance only for changed capability files. Independent review and authoritative production preflight remain required. No application or deployment occurred.

- `tests/browser/volunteer-shift-operations/capability.cjs` `6780861e1365800dcfbce830e0c8e6b9599c8dc86a3e0d80b42c94ccf0d14e28`
