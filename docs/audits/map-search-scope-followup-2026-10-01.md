# Map search scope follow-up — read-only

## Reproduced defect

Open `https://www.zoi.city/explore/map/?city=Limassol&country=Cyprus` on a 390×844 browser. The control initially says **Exploring Limassol, Cyprus**. Type `Amar` in the map search input. It immediately changes to **Exploring Your selected search** and its actual public `explore_search` request sends `p_city:null,p_country:null`, broadening the user's deliberately selected area.

Evidence: `/tmp/zoi-map-scope-audit.json`, `/tmp/zoi-map-scope-audit.png`, reproducer `/tmp/zoi-map-scope-audit.cjs`. No write RPC called.

Cause: `explore/map/index.html:331` `mapSearchIntent()` unconditionally deletes city/country/region/place, called by every input change at line1164. It should distinguish a saved home default from an explicitly selected temporary city/country; this report proposes preserving explicit geography while changing the search term. “Everywhere” remains the explicit clearing action. Ownership/review is required before editing the frozen map candidate.

## Autocomplete observation

The map input has `autocomplete=off` but no accessible combobox/listbox or `attachAutocomplete` wiring. Its current behavior is live list filtering and supplementary area search. `explore/index.html:454` does attach the shared `assets/discovery/autocomplete.mjs` controller. That controller includes a six-second timeout, one retry, stale-request cancellation and a manual Retry state. The shared attachment currently expects an Explore-specific `.sbar` parent; it cannot simply be called on the map input without adapting its mounting contract.

## Personalization inspection

`assets/personalization/locality.mjs` keeps home preference data memory-only, aborts superseded account reads, clears prior-account home, and lets explicit geography/global intent override home. All seven `tests/unit/locality-personalization.test.mjs` tests pass. These are model evidence; no real customer account was switched or modified. The reproduced defect is in the map's input-to-intent integration, outside those model tests.

No runtime, migration or production changes made for this follow-up.

## Implemented candidate

Explicit city/country/region now survives query changes and clearing. Private saved home remains an implicit default; unscoped explicit searches keep the existing global semantics. Back/Forward and account changes close stale suggestions.

The shared autocomplete supports an optional mount, unique list ID and selection callback, preserving Explore's canonical-page navigation. Map suggestions remain in the selected area and enabled categories, use touch or keyboard selection, and open the map preview. A selection made before the full directory finishes loading queues until the map is ready. Unsupported map positions still use the existing honest profile-only preview; no coordinates are invented. The dropdown is responsive with bounded scrolling and dismisses before focusing the selected pin.

Evidence:

- 51 scope/autocomplete/locality/directions/preview unit tests pass.
- `tests/browser/map-autocomplete/verify.cjs`: real public API data, candidate map/shared module only.390 touch,1440 keyboard, delayed-directory390 early selection passed; explicit area survived typing+clear, Everywhere cleared scope; shared Explore selected Amara's canonical business page. Artifacts `/tmp/map-autocomplete-candidate.json` and `/tmp/map-autocomplete-*-suggestions.png`, `*-selected.png`.
- Phone screenshots visually inspected: readable choices, selected street pin clear of controls and panel.
- `tests/browser/map-autocomplete/account-scope.cjs`: controlled fake account receipts only, no real sign-in/private reads or writes. A→B changes implicit home; explicit temporary Limassol survives typing/account change/sign-out; old suggestions close; home not serialized. `/tmp/map-autocomplete-account-scope-v3.log` passed. An earlier full-reload fixture failed to attach controls; retained `/tmp/map-autocomplete-account-scope-trace.log`. Final account fixture exercises actual popstate navigation within the loaded page; it does not claim full account reload coverage.

Remaining limits: shared suggestion API reads eight candidates and displays up to six. With several enabled categories, client filtering may yield fewer suggestions even if further server matches exist. Existing map intermittent initialization issue remains separate. No production deployment by specialist.

## Independent queued-selection correction
Frozen runtime map `207ab2924a4da270dbe9c070d93b16a4c99caa78a47766ee55d763fc0d80437b`, shared autocomplete `a100b8d4241468c116d7eb9d73ba212559a4f6b2be0c29c5b8fa081a3682aeff`. Account, area and category changes invalidate a queued suggestion while the directory loads. Independent reviewer accepted these negative cases plus unchanged positive queue preservation. Committed queue fixture now fulfils every search request, not just suggestions. This controlled acceptance does not establish current live backend success: actual strict Amar/Limassol/Cyprus request failed HTTP 500 SQLSTATE 57014 after 5362 ms; root owns backend repair.
