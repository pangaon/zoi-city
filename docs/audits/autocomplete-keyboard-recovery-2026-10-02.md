# Shared autocomplete keyboard recovery — 2026-10-02

## Actual remaining defect and scope

Existing scoped search, multi-category filtering and obsolete-request fixes remain present. No backend polling or repeat deployment was performed. The reusable `attachAutocomplete` used by Explore and Map renders Retry after bounded suggestion failures, but its input Tab handler immediately hides that button. Actual Explore reproduced the inaccessible retry path with two controlled HTTP 503 responses; `/tmp/autocomplete-keyboard-baseline.log` retains the assertion failure.

Parent authorized this module and focused tests only. Input Tab now transfers focus to visible Retry; Escape closes and returns focus to the input. Retry returns focus to the input while suppressing the extra focus-generated search, then sends the user's current query/filter request once. Focus leaving the input/retry container closes it. Existing arrow selection, outside dismissal and cancellation remain.

## Exercised evidence

`tests/browser/autocomplete-keyboard-recovery/verify.cjs` serves actual Explore and Map HTML and assets, with controlled anonymous RPCs and map style resources. All four consumer/width combinations (Explore/Map at 390/1440) pass: failure→Tab→Retry; Escape focus return; Tab leaving Retry; single retry request→current result→ArrowDown; ordinary Tab/outside dismissal; and delayed old response released after a replacement query without replacing the current result. Final log `/tmp/autocomplete-keyboard-final.log`.

All 12 existing discovery-autocomplete unit tests pass, including filter/source projection, empty/invalid type handling, cancellation, bounded timeout/retry and no scope expansion (`/tmp/autocomplete-keyboard-units.log`). No backend, provider, account or customer writes occurred.

Frozen module SHA256: `9ad953b8cdb9300e721c7fa5e33e4388d0c9b7a7c4eb3f30ee7dec18312e756b`.
Frozen browser fixture SHA256: `f7ff7b21f3229594671e95ccbe60f614b5bbcdc74cf876a7f18760494f560599`.

## Boundaries

These are local source and exercised UI results. They do not establish production deployment or backend recovery. Parent owns consumer cache-query integration and independent correction review. The global command palette (`assets/zoi-search.js`) is separate, and creation/provider pickers are not automatically covered by this module; no category-wide creation autocomplete completion is claimed. No Social, navigation, audience, operations, documents, host allocation or service files changed in this packet.
