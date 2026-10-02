# Native organization workflow independent review — 2026-10-02

Review in progress pending producer's final Expo journey freeze. No native runtime edits, production calls or device distribution.

Initial source review: contextual drafts derive from a saved active same-workspace contact/project and retain relationship IDs; they use existing Operations recovery and mutation writer. The new transport captures actor/current workspace before and after token refresh, dispatches with that captured token, and checks the response scope again. Project document handoff freshly reads current records and role, requires exactly one active requested project in that workspace, and constructs an HTTPS browser URL containing only workspace/project UUIDs. Browser authentication remains separate.

Fresh targeted `organizationWorkflow.test.mjs` plus `operations.test.mjs` pass 21 tests (`/tmp/native-org-initial-review.log`), including actual SessionClient held refresh, denied current role, missing/archived/duplicate/foreign project and contextual writer payloads. This does not establish the rendered Expo journey or physical iOS/Android behavior.

Producer asked to retain actual Expo held-read account/workspace/unmount and current401 private-clear coverage. Direct captured-token `SessionClient.request` differs from `SessionClient.rpc`'s automatic401 session/vault clearing; the Operations component's own denial handling must be tested rather than claiming unchanged global logout behavior.

## Final frozen acceptance

Producer's final packet independently exercised against actual Expo web at `http://localhost:8197`: both 390/1440 completed saved contact → linked project → assigned follow-up task through existing mutation receipts, exact project/workspace browser handoff, fresh viewer rejection, current401 clearing of private fields/actions, and held project read followed by tool unmount/workspace switch with no opened destination. All API transports are controlled fixtures. Log `/tmp/native-org-expo-independent.log`. TypeScript check also passed (`/tmp/native-org-typecheck-independent.log`).

Final frozen sources: `Operations.tsx` `ae7f0d9b49478f9cc0d9ca1e0301cecfb50252dea6d783b406ca2b91e9e9e07d`; `operations.ts` `5fff2050ba75ebeca9f7f9e8434d815765f4034af0e3b726364ab6c504db6772`; `organizationWorkflow.ts` `812368502cd7b0839f8843e03fc9531015fd8ccdd6332d2101379408d366de40`. Browser fixture `1d33f34d03740d52c3fad86bf6f9132042c32d27ee694948aad8f32ac197e797`.

Phone screenshot `/tmp/native-organization-390.png` inspected: selected company/contact, contextual task action, linked saved task and explicit web sign-in explanation are readable and remain within the viewport. Relationship IDs are not treated as authentication identities.

No blocker found in this bounded native implementation.401 handling clears Operations state; it intentionally does not mutate the shared credential vault, as documented by producer. Accepted for parent's export/release checks. This is Expo-web acceptance, not a signed iOS/Android binary, physical device test, authenticated browser session transfer or provider capability.
