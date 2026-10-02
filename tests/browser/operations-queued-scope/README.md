# Operations queued scope

Run `EXPECT_FIXED=1 node tests/browser/operations-queued-scope/verify.cjs` from the repository root. Optional `QA_REPORT` sets the JSON output; `CHROMIUM_EXECUTABLE_PATH` overrides Chromium.

Twenty-four controlled-network cases use actual Core and the actual Operations module at 390/1440. Covers queued read/write workspace change, detached surface, successful same-session refresh and scoped saved receipt, failed refresh, and invalid actor rejection before recovery storage/private reads. No live requests or customer writes. Workspace change directly changes mounted context. Without EXPECT_FIXED, the historical queued-send baseline expectation remains available; current code should be tested with EXPECT_FIXED=1.
