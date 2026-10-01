# Map selected-category autocomplete

The map previously retrieved the first eight results across every category and then discarded disabled categories in the browser. An event or venue below those eight could never appear, even when it matched the user's selected categories and city.

The candidate adds `explore_search_types` and sends the selected category array in one request. Eligibility and category filtering precede duplicate selection, ranking and pagination. NULL means all categories; an empty array means no results (the client makes no request). Malformed, multidimensional, NULL-element and oversized arrays fail explicitly. The scalar RPC remains untouched. The new function preserves its safe public projection, moderation checks, country/city semantics, ranking and bounded pagination. Migration provenance identifies the exact locality-search source; future shared search corrections must update both functions.

Source evidence: `assets/discovery/autocomplete.mjs` and the map's existing `filters.types` integration. No map layout or navigation changes. The migration only creates a function and grants its public execution; it does not grant table access or build indexes.

Local database evidence: isolated PostgreSQL16, en_US.UTF-8,32,000 noise rows.144 exact JSON comparisons against a baseline with the same category predicate, plus one-category scalar parity, category noise ahead of matching results, malformed array rejection, direct-table privacy and locality-index plan checks. Representative measured baseline14.5ms versus candidate5.9ms; these are local fixture measurements, not production latency guarantees.

Rendered and exercised evidence: actual shared autocomplete component at390px and1440px against controlled HTTP responses. Keyboard selection, pointer selection, exact event/venue destination, city/country preservation, one RPC, empty selection without a fetch, and category restoration pass. Screenshots `/tmp/zoi-map-types-390.png` and `/tmp/zoi-map-types-1440.png`; phone image inspected.12 unit tests cover stale response/cancellation, bounded timeout/retry, strict locality and new array transport. This fixture is not the complete live map and does not establish production RPC availability.

A browser-fixture issue initially prevented clicking the category-restoration control: the document outside-pointer handler closed the suggestion box between pointerdown and pointerup, moving controls placed below it. The fixture controls now sit above the suggestions so that this test exercises category refresh without a moving target. No unrelated production layout change was made.

Release dependency: apply the reviewed RPC migration before deploying the new client. Root owns migration/deployment/cache invalidation and the real map smoke test. No production requests or mutations were made during the database incident.
