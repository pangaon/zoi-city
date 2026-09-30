# Native enquiry mounted acceptance — 30 September 2026

Status: **not yet accepted as a mounted native journey**. Existing contract tests and the normal Expo web export do not replace mounted lifecycle evidence.

A temporary isolated Expo project is preserved at `mobile/.qa-inquiry/`. It imports the actual `mobile/src/Inquiries.tsx`, actual InquiryRecovery and PrivateRequestStore. Its fixture-only Metro resolver replaces that component's Auth import with controlled RPC responses and actor-scoped nonce storage. It introduces no production authentication seam, dependencies, real messages or database writes.

Intended checks: interrupted committed send → full page reload → receipt lookup → one recovered thread; subsequent revoked thread read → private conversation cleared. The fixture distinguishes its controlled RPC responses from production backend behavior.

Two bounded Expo web export attempts failed before rendering: Metro could not resolve `react` from the isolated project. The installed mobile node_modules is a symlink to `.recovery/native/mobile/node_modules`; adding its real path to watchFolders and explicit nodeModulesPaths did not resolve this isolated-project lookup. No mounted acceptance is claimed. The fixture was not included in a release.

Remaining: run a mounted fixture through a working isolated Metro entry, then actual iOS and Android lifecycle/SecureStore checks. A browser fixture would only establish React Native Web mounted behavior, not physical-device storage guarantees.

## Follow-up: isolated mounted React Native Web check passed

The final bounded tooling correction added explicit `extraNodeModules` package aliases to actual real paths. Expo then exported the fixture successfully: 205 modules, unchanged production Inquiries.tsx.

At 390×844, actual mounted controls passed: fill subject/message → interrupted send (one controlled RPC write) → nonce-only stored marker without message body → full page reload → Check saved enquiry receipt → existing conversation shown with zero resend → revoke fixture read permission → Refresh conversation → private message removed and access error shown. No page errors. Browser closed after test.

Evidence: `mobile/.qa-inquiry/results.json`, `recovered-390.png`, `revoked-390.png`; browser script `.qa-opa-room/native-inquiry-check.mjs`. The initial module-resolution blocker above is resolved. This is controlled-provider React Native Web mounted evidence, not production RPC, physical iOS/Android, or SecureStore device verification.
