# Independent map directory probe review — 2026-10-01

Accepted narrow local mitigation: `assets/map-data/loader.mjs` SHA256 `aa285f363db2a496377bfda9b5af6defb1f08423adb5b6d7ab8432df0eb64f53`.

Source review confirms offset zero completes its bounded retry chain before parallel continuation starts. A service outage at the beginning therefore generates three attempts at offset zero with the existing retry policy, rather than twelve requests across four simultaneous failing pages. Healthy continuation still uses at most four workers. Known empty data remains a successful empty result; first-page failure remains unavailable, never empty success. Subsequent holes, end detection, sorting and cap reporting preserve their existing semantics.

Independent `node --test tests/unit/map-data.test.mjs` passed all20 tests, `/tmp/map-data-independent.log`, including explicit503 request offsets and350/700ms retry waits. No live provider/API probes were performed. This reduces initial failure fan-out; it does not fix or explain the production database/provider outage. Actual deployed behavior remains a separate root-owned check.

## Responsive outage journey follow-up

Reviewed root's additional map catch-path change: opening the existing results sheet exposes the error/retry action when an initial scoped mobile view had collapsed it. The loader import is versioned for the new probe.

Independent `/tmp/zoi-map-outage-independent.cjs` ran the actual map page at390/1440 with candidate HTML/loader and every RPC intercepted (explore_geo returns503; other RPCs return an empty fixture). Both cases made exactly three directory calls, showed the unavailable title and visible Try again button, and produced no page JavaScript errors. `/tmp/zoi-map-outage-independent-results.json`. No live database probes or outage-resolution claim. Static page assets/maps may load normally; the failing directory is explicitly controlled.
