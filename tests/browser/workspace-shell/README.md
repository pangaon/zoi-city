# Actual workspace shell acceptance

Run `CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node tests/browser/workspace-shell/verify.cjs`.
Requires the repository's `playwright-core` dependency.

Serves the real social HTML inline shell, real business editor, creation controller
and navigation modules using a controlled RPC/core adapter. It strips unrelated
external suite scripts and prevents external network access. Checks creation,
recovery, account change, listing intent, query/hash routing and workspace switching
at 390px and 1440px. No live service mutations. See the independent audit for limits.

For deployed-source verification, set `WORKSPACE_SOURCE_ORIGIN=https://zoi.city`.
This downloads the actual deployed HTML and modules, then runs them locally with
the same controlled adapter. It does not invoke production authenticated RPCs.
