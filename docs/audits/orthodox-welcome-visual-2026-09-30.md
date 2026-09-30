# Orthodox welcome presentation — 2026-09-30

Candidate only; production release remains the parent's responsibility.

The Orthodox category and St Nicholas Toronto home now foreground the existing, correctly attributed parish photographs. The category adds three real on-page journeys: parish search, reference dates, and monastery discovery. The Concierge parish layout uses a readable glass welcome card over the actual exterior, with tighter service cards and working dark styling. Existing four-layout selection, owner copy, source isolation, calendar writers and programme controls remain in place.

## Evidence

Live before captures: `.recovery/logs/faith-before-390.png`, `faith-before-1440.png`, `nicholas-before-390.png`, `nicholas-before-1440.png`.

Candidate uses current production HTML/data with local changed modules/styles, served on port4297; no fixture service times or substituted imagery. After captures: `faith-after-390.png`, `faith-after-1440.png`, `faith-after-dark-390.png`, `faith-after-dark-1440.png`, and corresponding `nicholas-after-*` files. Additional mobile states: `faith-search-dark-390.png`, `faith-feasts-dark-390.png`, `nicholas-panel-dark-390.png`.

At390px both pages have390px document width, without horizontal overflow. St Nicholas hero loaded its1920px official photograph. Gallery next updates photograph2/3 and its Saint Sophia attribution. All three new journey links resolve to existing sections. Actual anonymous parish search for Nicholas/Toronto returned4 matches; selecting St Nicholas focused the selection panel and returned its exact canonical route and listing-scoped calendar link. No writes were made.

The worship dialog fits within390×844, focuses its close control, closes with Escape, and states that no upcoming dates are listed rather than inventing services. Real parish-calendar access remains an explicit action. Dark hero, search, feast and dialog screenshots were visually inspected.36 focused unit tests passed across parish search, source isolation, four-layout rendering, panel actions and hub links.

## Limits

This is shared web presentation work, not proof every church's source data or owner journey is complete. Calendar reference dates remain distinct from parish service dates. Native uses its existing canonical-web handoff; no new binary or native screen is claimed. No third-party content, autonomous photograph rotation, payment, registration or backend change was added.
