# Explore duplicate request repair

## Observed production and source evidence

Root's retained real autocomplete report records SIGNAT selection succeeding at390/1440, but first phone run had two HTTP500s followed by200 and9.842s to suggestions. A repeat captured two successful calls for the same query: limit8 suggestions and limit24 results. Error response bodies were not retained, so those500s cannot be attributed conclusively to a specific server query failure.

Source confirms two independent input timers: autocomplete180ms and Explore full results350ms. Controlled actual-page baseline reproduces both requests at both widths (`/tmp/explore-request-trace-before.json`); the measured timing includes browser setup and is not a server performance benchmark. The saved-home suggestion filter also consulted committed ST.q before the350ms update, then changed intent when full search began.

One bounded anonymous production read on2026-10-02T21:59:27Z returned200,4rows,793ms for SIGNAT limit8. Evidence `/tmp/explore-signat-single-read.json`. No retry or database mutation. Intermittent server500/reliability remains open; removing redundant client traffic does not prove its underlying cause resolved.

## Shared Explore behavior

Typing requests suggestions only. Search button, Enter without selected suggestion, category/city/country changes, history, explicit clear and existing initial/locality refresh continue to request full results. Filter actions consume the current draft. Existing cards remain while typing; obsolete in-flight result responses are invalidated immediately and their transport aborted. Full-result actions close suggestions, preventing stale selection and a second suggestion refresh from that action. Suggestion locality derives from current input immediately, preserving explicit city/country and bypassing implicit saved home for a typed search.

Account/storage identity events retire pending suggestion and full-result requests; existing locality reader remains responsible for loading current home preferences. No shared autocomplete, map, backend or error-swallowing changes. Pending draft is intentionally not written into history until submitted.

## Exercised evidence

- 27 existing autocomplete/locality/search units pass.
- Actual Explore390/1440: one request while typing, cards preserved, explicit submission, delayed result invalidation, Back, controlled saved-home intent, held suggestion/account change, category/current draft, HTTP500/retry, clear, keyboard selection and canonical URL navigation.
- Existing shared keyboard regression passes Explore/map390/1440 including keyboard Retry, focus continuity, Escape, outside dismissal and stale suggestion responses.
- Logs `/tmp/explore-search-intent.log`, `/tmp/explore-keyboard-regression.log`, `/tmp/explore-search-units.log`; screenshots `/tmp/explore-search-intent/{390,1440}.png`.

Controlled RPC fixtures are not live database/account writer evidence. Production SIGNAT journey and request count must be rerun after lead release. No deployment from this lane.

## Lead-review correction: aborting pending results

Lead identified an actual gap in the first freeze: cancelling a pending initial/submitted search left its six skeletons visible indefinitely. The previous fixture only checked that the stale card was absent and missed this loading state.

The corrected candidate retains the last settled card/view/count/context snapshot and restores it with an explicit “Previous results” label when a new draft retires a pending full search. The context includes the old query/category/locality rather than suggesting the new draft already produced those cards. Without a settled response it shows a useful Search/suggestion prompt, no skeletons and busy=false. Account identity events clear the retained snapshot and old result view, so prior saved-home context cannot be restored after switching accounts.

`node tests/browser/explore-search-intent/initial.cjs` verifies held initial request→draft→late response at390/1440. The main fixture now explicitly verifies held submitted request→draft restores prior cards and context with zero skeletons. Initial assertion used transformed innerText and was corrected to textContent for the CSS-uppercase context label; runtime behavior was not changed to satisfy casing.

## Successor specialist verification

The successor search specialist reran the frozen actual-page fixtures at390/1440 and independently inspected their assertions. Both pending initial and slow submitted search cases explicitly require zero skeletons, reject late old cards and preserve the correct empty/previous-results context. The submitted fixture now also explicitly asserts busy=false, matching the existing initial case; runtime HTML is unchanged (`a40911b5…`). The new fixture hash is recorded in the candidate manifest. The shared keyboard fixture passed Explore/map at both widths after selecting the already-installed Chromium path; an initial invocation lacked that environment variable and failed to locate the default Playwright binary, before opening any page.

Retained rerun logs are under `evidence/discovery-search-candidate/`: explore-intent, explore-initial, shared-keyboard, existing-units (27 passed), inline and geography-database (13 groups passed). Local suggestion screenshots at `/tmp/explore-search-intent/{390,1440}.png` were inspected for readable controls and phone layout. The controlled responses and blocked external fonts are not a production content or live preferences acceptance claim.
