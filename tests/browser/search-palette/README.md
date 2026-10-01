# Shared search palette recovery

Run `node tests/browser/search-palette/verify.cjs` from the repository root. The fixture loads the actual shared palette and theme stylesheet. Only the public search transport is controlled; no authentication or private data is used.

At 390 and 1440 pixels it exercises delayed completion after clearing, delayed completion during a new query's debounce, close/reopen fencing, stale Enter prevention, HTTP503 retry, successful empty search, malformed non-array response, sparse and populated records, arrow navigation, and final touch/keyboard navigation to the exact listing. The 12-second timeout is accelerated to40ms in the fixture; it still uses the request's real AbortSignal. Older controlled responses deliberately ignore abort to prove generation guards independently.

The destination fixture includes the shared theme as a real Zoi page does. Its initial minimal destination omitted the stylesheet and triggered Chromium's `Transition was skipped` with source-only cross-document view transitions. Including the same stylesheet fixed that fixture mismatch; page errors remain asserted empty without filtering.

Screenshots: `/tmp/search-palette-recovery-{390,1440}.png`. No source/provider writes or real messages occur.
