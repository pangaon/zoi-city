# Claim sign-in return — 2026-10-01

The actual Social shell had no generic return-after-auth mechanism. This candidate adds a restricted public claim destination instead of an arbitrary redirect: exact `/explore/`, one listing UUID, one ASCII slug and optional workspace UUID. Canonical serialization rejects unknown return parameters, duplicates, external origins, credentials, fragments and double encoding. No credentials enter the return URL or storage.

Guest “This is mine” carries this public intent into Social. After the existing OTP flow and a current authenticated `zoi_me` result, the user explicitly chooses Continue to listing, Create a workspace or Use another account. Neither sign-in nor browser history submits a claim. The current token and shell generation fence all continuation buttons. Confirmed workspace creation and existing-workspace recovery links preserve the listing while selecting the explicitly created/chosen workspace. A lost creation receipt remains locked by the existing creation controller.

Explore preserves intent through filter URL rewrites. An explicit Continue ownership request action loads the public `home_entity` and checks exact ID and slug before opening the normal claim picker. A changed account, URL intent or dismissed panel invalidates a late response. A separate Dismiss request action removes return intent. Claim submission still requires an explicit form action and the separately reviewed backend authority/scoped-receipt contract.

## Evidence

- Three unit groups cover canonical round trip, redirects/duplicates/encoding/credential/hash rejection and exact creation return.
- Actual Explore, Social and ZoiCore browser code exercised at 390 and 1440 pixels with all external requests intercepted: OTP sign-in, existing workspace, explicit continuation, wrong returned listing, changed intent during public read, changed account, sign-out, browser back, new organization creation and lost-create recovery. No claim request was submitted in these return-flow tests.
- Existing workspace-shell 390/1440 regression passed, including organization/community setup, unknown result guard and account clearing.
- Existing claim-workspace-handoff 390/1440 regression verifies actual claim-submit destinations and scoped receipts under controlled transport.
- Phone screenshot `/tmp/zoi-claim-return-390.png` inspected. Actions fit the viewport and explain that no claim has been submitted. Desktop screenshot `/tmp/zoi-claim-return-1440.png` recorded.

No real OTP was sent, no production identity created and no customer ownership changed. Release and actual live read-only verification remain root-owned. Pending-claim management is still separate from this navigation repair.
