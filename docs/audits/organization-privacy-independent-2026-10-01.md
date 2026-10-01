# Organization privacy independent acceptance — 2026-10-01

Accepted locally for the volunteer admin lifecycle and shared youth/group transport correction. No real volunteer, guardian or child records were accessed or modified.

## Reviewed final source

- Programs/volunteers core: `cbc3bb45b6b5a1fc8d498816cd6185940fd97f0a6222e7427eb80a75d22463e2`
- Shared private scope: `d9405a6382796eb23331e694cab7f023217373f775ed6d118cf0ec9d3970d9f2`
- Groups: `a48a762dc892c92cccf8462aca8e212cd1c0a7b0d08d5af26321da843bebceeb`
- Youth: `e6e99b93c869d505f38e109e5b8103f440035dc0d5f44a3f7e1444916518d987`
- Organizations wrapper: `db57e245f5c82b8ab44a009ad0813bfdd9acd4b51889266e16684e44195801cd`

Review initially found mountAdmin's scope checks surrounded a Core require call but did not fence same-actor workspace changes during its internal refresh. The corrected path explicitly awaits refresh, rechecks scope, rejects false refresh, then uses the existing token and checks the response scope. Current denial clears roster arrays and private DOM/controls. UUID/token identity consistency, mounted-surface identity and disposal are checked; the suite wrapper returns cleanup.

Root independently repaired the equivalent shared privateScope RPC used by youth and adult groups. Its required private requests now refresh and recheck before send; failed refresh/current 401/403 invalidates private UI. Public/preferred reads retain their existing semantics. Versioned imports in core/groups/youth and wrappers were inspected; the new browser runs use those final files. No database writer, receipt or consent contract was replaced here.

## Independent exercised evidence

- Organization UI, existing private scope and new queued-scope units: 16 passed.
- Actual Social shell `tests/browser/suite-organizations-privacy/verify.cjs`: final 16 controlled cases passed at 390/1440. `/tmp/organization-independent-final-cache/findings.json` and `/tmp/organization-browser-independent-final-cache.log` retain evidence. Tests include current denial clearing private roster/write controls, legitimate scoped/versioned program save with refreshed title, held roster response after actor switch, failed refresh, held refresh plus workspace/surface transition, and unresolved/opaque identity zero private reads.
- Independently added `tests/browser/suite-organizations-privacy/shared-guard.cjs`: 18 actual mounted youth/group module cases passed at 390/1440. Positive youth organizer rendering and adult membership-settings receipt/refresh remain usable. Held initial refresh with workspace change, surface removal, or persistent failed refresh yields no private transport. Actual group-settings submit held during refresh then switched workspace sends zero settings writes. `/tmp/organization-shared-guard-independent.json` and matching log retain evidence.

The last tests mount actual modules directly, not the full Social shell; workspace transitions mutate the controlled mounted context. They do not claim full workspace-picker navigation or legal organization formation capability. An initial harness incorrectly returned true on the next refresh after a simulated false refresh; this legitimately allowed the separate sibling youth module to read. The final persistent-failure fixture tests the intended failed-session condition and passes; no production defect was inferred from that harness mismatch.

All RPC responses, records and saves are controlled fixtures; no email/provider calls or live persistence. Production asset verification and real backend authority remain separate release evidence. Prior consent, capacity and historical-record controls were preserved rather than re-certified by this UI review.
