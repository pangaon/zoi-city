# Independent claim authentication return review — 2026-10-01

Accepted for integration with the reviewed scoped claim handoff/backend. No customer claims or real authentication messages were sent.

## Scope and source

- `assets/workspace/claim-return.mjs`: `097e6b7bec847b714408d6b9e2fd8d673752761e34f17edeea94be22e6f8b2c9`
- `explore/index.html`: `c3be14985d363a62564d22cf86e7c584354e05d0abcdf2da6c2bf8beb7f2d9ed`
- Social reviewed journey version: `dc84074583b59a08dd7ac7dcf25cada91913364d10dc80b49ea57df8c82a60e2`; parent cache integration points to `bizpage.js?v=20261001-claim-handoff` in current Social `e2339c08860488a496817ee3f6da8ac298327d8a4ec5d19d4859e34a449614cd`.

The return destination is a strict canonical, same-origin Explore path with one exact listing UUID/ASCII slug and optional workspace UUID. Exact serialization rejects duplicate, foreign, hash, credential and double-encoding variants. Authentication does not submit a claim. The signed-in visitor explicitly continues, creates a workspace or changes account. Confirmed and recovered workspace creation preserve the listing intent with the selected workspace. Explore rereads the public entity and verifies exact ID/slug before opening the normal authorized claim picker. Account/generation/current-intent fences surround asynchronous reads.

## Independent rendered and journey evidence

Three parser/unit cases passed. `tests/browser/claim-auth-return/verify.cjs` independently passed at 390/1440, `/tmp/claim-auth-return-independent.log`: actual OTP shell, explicit continuation, exact target, signout/account/back fences, workspace creation and lost-response receipt recovery. Public/auth/RPC responses are controlled fixtures, not real provider delivery or customer mutation.

The reviewer inspected `/tmp/zoi-claim-return-390.png`: branded header, readable continuation form and distinct actions without visible mobile overflow. These checks establish the return journey and safeguards, not category-wide listing quality or completed ownership adjudication.

Full pending-request tracking remains separate scope; the claim backend is still the authority for current eligibility and ownership.
