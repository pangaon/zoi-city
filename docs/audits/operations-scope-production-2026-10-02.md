# Operations scope release — 2026-10-02

Commit `9e3d6adb610cc6b48aa8ac74908bfeb6a978935f` is deployed. GitHub CI 37017468675 and Vercel deployment 9aoxq4BHzXSYmSKw25Sw7ANBcE6U report success. At 14:06 UTC the served Operations module and Social HTML exactly matched the committed bytes. Cache policy is max-age=0, must-revalidate; Social imports the new Operations cache version.

Exact staged tree `456ade253aacb7e14dadcad7c928f04ded1d1b0e` passed JS/HTML verification, 273 node:test files and two standalone suites. Its actual-Core browser harness passed 24 controlled phone/desktop cases, including identity refusal, refresh failure, workspace/surface changes and a matching save receipt. Root additionally reran mounted lost-response recovery and draft/access-denial cases.

Retained machine results: `docs/audits/evidence/operations-scope-2026-10-02/`. These establish deployed source plus controlled exercised behavior. They do not prove production database persistence or all Ownr/SaaS workflows. Yamas remains intermittently unavailable; event service lifecycle, staff ledger settlement, pending migrations and connected payment/provider work remain open.
