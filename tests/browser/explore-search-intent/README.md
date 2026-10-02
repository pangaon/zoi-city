# Explore typing versus submitted search

`node tests/browser/explore-search-intent/verify.cjs`

Runs actual Explore HTML, shared autocomplete and assets at390/1440 with controlled public RPC responses. Checks typing makes one suggestion request and preserves cards; Enter submits exactly one full search; delayed old results cannot replace a newer draft; Back restores submitted intent; an injected saved-home state does not narrow a typed query; held suggestions cannot reappear after an account event; changing category submits the current draft; full-search500 keeps a retry path; clear restores Everywhere; ArrowDown/Enter opens the selected canonical route.

The fixture destination is a simple document to isolate selection. This is not a live account-preferences or canonical-renderer acceptance test. Existing autocomplete-keyboard-recovery covers shared Explore/map keyboard Retry and stale suggestion responses. Optional CHROMIUM_EXECUTABLE_PATH overrides Chromium. No writes or customer sends.

Run `node tests/browser/explore-search-intent/initial.cjs` for the held initial response case. The main fixture checks held submitted response restores last settled cards/context; initial fixture checks useful empty state, zero skeletons and busy=false. Account events retire the retained snapshot as well as requests.
