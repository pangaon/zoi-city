# Bounded directory autocomplete and country/city picker

Use the frozen snapshot specified in docs/audits/evidence/autocomplete-city-candidate-2026-10-03/frozen-manifest.json. Keep candidate sources unchanged. Link the repository's node_modules into that snapshot, or install its exact package lock.

From the snapshot:

```
node --test tests/unit/discovery-autocomplete.test.mjs tests/unit/discovery-autocomplete-candidates.test.mjs tests/unit/discovery-city-picker.test.mjs
CHROMIUM_EXECUTABLE_PATH=/path/to/chrome node tests/browser/autocomplete-keyboard-recovery/verify.cjs
node tests/browser/explore-search-intent/verify.cjs
node tests/browser/explore-search-intent/initial.cjs
EVIDENCE_DIR=/tmp/reviewer-city-controls node tests/browser/discovery-city-picker/verify.cjs
EVIDENCE_DIR=/tmp/reviewer-city-live-data node tests/browser/autocomplete-city-candidate/verify.cjs
```

The final script serves candidate HTML/modules locally, reads actual anonymous production RPCs without response fixtures, and exercises sixteen phone/desktop selections, empty results and URL-scoped city display. Local business links redirect to actual ordinary production canonical pages. It blocks any attempted private/mutation RPC; no member home, inventory, booking, payment or send is written. Live data, external assets and timing can change. A candidate page is not a deployed artifact.

The city-controls script mounts the actual module and actual Explore/shared theme CSS. Controlled read promises exercise country/city errors and Retry, empty catalog/query, keyboard choice, Escape/focus, close while pending, stale country replies, explicit country/worldwide choice, and clearing an unsubmitted country draft. Its screenshots cover light/dark and both widths. These are UI failure proofs, not production backend outage recovery.

Existing keyboard and intent fixtures control backend responses and intentionally isolate destination rendering; their assertions remain intact apart from distinguishing autocomplete's public candidate limit 32 from directory results limit 24. The production audit before this change is retained separately under autocomplete-production-independent-2026-10-03. OPA Productions was already a valid candidate beyond the former eight-row request. No client-specific ID, invented geography or altered database ranking is introduced.
