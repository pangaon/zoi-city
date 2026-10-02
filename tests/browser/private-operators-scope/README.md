# Private operator lifecycle

From repository root:

```sh
EXPECT_FIXED=1 node tests/browser/private-operators-scope/verify.cjs
node tests/browser/private-operators-scope/journeys.cjs
```

`QA_REPORT` overrides either JSON report. `CHROMIUM_EXECUTABLE_PATH` overrides Chromium. All network requests are controlled; actual Core, suite wrappers, operators and model code run locally. No customer writes.

The first script retains 12 original queued-read baseline cases; without EXPECT_FIXED it expects the old defect. The second exercises 52 corrected read/write/cleanup/identity/import cases across Properties and Timekeeping at390/1440. Workspace transition changes the actual mounted context; it is not a full workspace-picker test. Positive writes assert server-confirmation display with fixture receipts. See independent audit for hashes and production limitations.
