# Hotel Business home save/reload journey

Run `node tests/browser/hospitality-owner-journey/verify.cjs`.

Actual Business home module, owner receipt projection and vertical editor; controlled RPC contract with in-memory versioned snapshots. At390/1440: unrelated save preserves source suggestions, accept/reorder retains IDs/source links, clear saves[] and reload stays empty, sparse room and external booking link survive save/reload. No live customer writes, real provider integration or database acceptance is claimed. The separate PostgreSQL catalogue suite covers server behavior.

Harness verifies corrected top-level booking label association and click focus, keyboard Tab, composite group/tag names and unique IDs across populated/sparse generic mounts. Screenshots `/tmp/hospitality-owner-journey-{390,1440}.png`.
