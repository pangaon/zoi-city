# Canonical incoming navigation

Run `node tests/browser/home-navigation/verify.cjs` from the repository root. Optional `CHROMIUM_EXECUTABLE_PATH` overrides Chromium.

Builds four full responses through the actual `api/entity.js` handler with controlled anonymous public rows: source-bound Signature, sparse venue, sparse artist and generic business fallback. Real family assets run locally; external network is blocked. Checks390/1440, normal/reduced motion, incoming transition presence and successful ready resolution, query/fragment retention, back/forward and zero page exceptions. No rejection suppression. This fixture tests rendering/navigation, not live database freshness, autocomplete reliability or ticket transactions.

Run `node tests/browser/navigation-transitions/verify.cjs` separately for existing Toronto legacy308, rapid navigation, and explicit unexpected-transition/unrelated-error visibility regression.
