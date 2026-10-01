# Independent suite session/privacy runtime review — 2026-10-01

Accepted local runtime candidate. No provider messages, production publishing or customer mutations performed.

Frozen runtime hashes:
- audience.js `0528d04869ae795fc5e4c042a28aa239056959fc273eaa6dce2a13b48e31268f`
- email.js `0c58e8b185b0a731dcd339929bd4e9ed8a59ef380e2de474c584246bc0b781c4`
- bio.js `915d21ea6a50238be0b3b3c0ed07dce436c7311e3f822f1d16e6749ffd529fff`

Source review confirms Email/Bio retain mounted actor and workspace, check before/after RPC, dispose private DOM on account/scope change or authoritative denial, suppress stale success notices and return lifecycle cleanup controllers. Audience's existing denial cleanup additionally recognizes HTTP401/403, SQL42501 and suite_session_unavailable. Disposal removes listeners and does not replace a newer module's root when the old wrapper is already detached. Detached post-error rendering does not restore private DOM.

Independent `tests/browser/suite-authority/verify.cjs` passed at390/1440 with OUTPUT_DIR=/tmp/suite-authority-independent, log `/tmp/suite-authority-independent.log`. Controlled actual modules exercise contact creation/expired-session denial, draft campaign save/schedule/unschedule, Bio draft/publish and Settings save; account clearing, role denial, delayed writes after account changes, delayed reads after workspace replacement and no new scope-stale writes all pass. Eight email persistence unit tests independently pass, `/tmp/email-persistence-independent.log`.

Reviewer inspected Email owner390 and Bio owner1440 screenshots: actionable controls and preview remain readable. The Bio QR image is unavailable because the external provider is blocked; QR availability was not verified. Scheduling/publishing success shown here comes from synthetic RPC receipts and is not evidence of delivered email or a public provider integration. The separately reviewed SQL authority candidate establishes server permission behavior; these browser checks establish local UI privacy handling. Production deployment/readback remains root-owned.
