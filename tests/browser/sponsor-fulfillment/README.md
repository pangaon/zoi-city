# Sponsor fulfillment workflow

Run `node tests/browser/sponsor-fulfillment/verify.cjs`. Optional `CHROMIUM_EXECUTABLE_PATH` and `QA_OUTPUT_DIR`; default evidence `/tmp/sponsor-fulfillment`.

Actual Festival operator, embedded Creator Studio, customer Studio and placement reader run at 390/1440 against controlled contracts. The approved application snapshot differs deliberately from the current package. Exercises explicit conversion, original benefit preparation, two persisted deliverables, committed lost-response remount/receipt recovery, shared brief/customer acceptance, proof/customer acceptance with linked task completion, current public-placement inclusion/removal, cancelled application denial, role downgrade and held-refresh actor/workspace/surface replacement. No provider calls, actual customer data, payment collection or production mutations.

The database migration/tests separately establish atomic cancellation behavior; browser mocks alone cannot establish it. Campaign discovery retains the existing Creator list limits. Prepared benefit/task matching is by exact title, not a new immutable task identifier.

Server acceptance: `node tests/database/sponsor-fulfillment.integration.mjs` uses an isolated PostgreSQL16 cluster, existing Festival/Creator writers and the new binding migration. No live database connection. It checks direct legacy RPC paths, receipt history, task rollback and concurrent cancellation/linkage ordering.
