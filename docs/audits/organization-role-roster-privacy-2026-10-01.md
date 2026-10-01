# Organization role revocation leaves private roster visible

Actual Social shell390/1440 loads existing Programs & volunteers module. Controlled owner list/shift response and private roster return a volunteer name. Refresh then receives403/not_authorized representing revoked access. The module reports permission denial but retains the private roster and prior owner write controls. Both widths reproduce this; evidence /tmp/suite-organizations-privacy/findings.json and denied screenshots.

Harness tests/browser/suite-organizations-privacy/verify.cjs serves real social/index.html, organizations wrapper/core and synthetic RPC contracts. No actual volunteer/member records, writes or server access. This is UI private-state cleanup failure after a current authoritative denial, not evidence the backend grants revoked users reads/writes.

Proposed narrow ownership: assets/organizations/core.mjs admin lifecycle/RPC scope and denial handling plus assets/suite/organizations.js cleanup propagation. Preserve program/shift version receipts, capacity/overlap behavior, and public signup semantics. Add current actor/workspace validity, response checks after waits, private state/controls removal on denial, and same-account positive management proof. Documents/Core transport currently under review remain untouched.

Original Ownr-style gap remains distinct: volunteer programs are nonprofit operations, not legal formation, shareholder registers or filing-provider integration. Existing Operations company/project/task records and Documents should be connected coherently without presenting unsupported legal capabilities.

## Local implementation and acceptance
Admin-only scope now validates actor through existing organizationActor token/stored-identity resolver, validates workspace UUID, checks owned connected surface/current actor after asynchronous RPCs, and clears private arrays/DOM/write controls on authority denial. Detachment/auth events dispose lifecycle; suite wrapper returns cleanup. Public volunteer mount section is unchanged.

10existing organization UI/private-scope unit tests pass.10actual-shell cases pass at390/1440: current403 clears roster and write controls; sameaccount newprogram receives scoped/versioned receipt and refreshed program title; held roster reply cannot return after account switch; unresolved/token-only and opaque stored identity make zero private list requests. No provider/DB calls; persistence is controlled contract evidence, not liveDBacceptance. Program/shift receipts and public signup logic were preserved. /tmp/suite-organizations-privacy/findings.json holds current results, baseline-findings.json preserves failure.

## Queued refresh correction

Independent review identified that Core's internal required-auth refresh could outlive the originating workspace or surface. The admin transport now explicitly refreshes, rechecks its captured scope, rejects a false refresh with401, then uses prefer-auth transport without a second refresh. Four new phone/desktop cases hold refresh before a save, change the captured workspace or detach its surface, then release refresh and assert zero program-save calls. Workspace mutation is a controlled mounted-context test; it does not claim a real workspace-picker journey. All14 browser cases and10 relevant units pass. No public signup changes.

Frozen core SHA256: ebb728ea867265d50bde57daa956a3fdd6124d345a963977791a8e754bf00892.
Harness SHA256: 9b3248690057a7306741a112afd497102d1316744de96abd5bacfa5c1fed4da4.
Evidence: /tmp/organizations-privacy-fixed-v2.log and /tmp/suite-organizations-privacy/findings.json.

Final negative acceptance also covers false refresh at both widths: no save RPC and no retained private editor. All16 browser cases pass in /tmp/organizations-privacy-fixed-v3.log. Runtime hash unchanged; final harness SHA256 e58c82de0497d51bca0c3a0c1f95853337fc4c7399e16e2058f2c5d8c5a22ff0 supersedes previous harness hash. Ten unit tests pass.
