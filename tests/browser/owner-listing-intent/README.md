# Exact listing owner-editor handoff

Run `CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node tests/browser/owner-listing-intent/verify.cjs` from the repository root with the existing Playwright dependency.

Actual shared bizpage module and owner projection, with two synthetic authorized businesses and controlled RPCs. At 390/1440 verifies exact second-listing load, read-error retry retaining the same ID, lost authorization never loading first business, explicit chooser recovery, and selected-listing URL persistence. No live account, database writes, provider requests or publication. Browser and local server close after success/failure; page errors fail assertions. Root separately verifies the suite-shell callback and query-before-hash navigation.
