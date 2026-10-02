# Shared canonical incoming transition repair

## Actual production finding

The successful Explore→Signature navigation emits an unhandled AbortError20, “Transition was skipped”, with empty JavaScript stack. Root reproduced using actual SIGNAT autocomplete at390/1440. An independent bounded390 ordinary-link reproduction isolates this from search: `/tmp/zoi-transition-probe.json` records outgoing Explore pageswap with a transition, incoming Signature pagereveal without one, then the destination rejection. Explore root/header/brand/progress transition names are unique. Signature's head has family CSS/core/canonical scripts but neither shared theme nor early transition opt-in.

The existing shared theme already handles expected ready cancellation locally, introduced for Toronto in6228502. Adding another catch or changing all motion would not repair incoming eligibility. This reproduces the prior Toronto early-head deficiency across canonical family responses. Chrome describes both-document opt-in and initial incoming eligibility in its [cross-document transition documentation](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document).

## Scoped correction

`api/_home-navigation.js` inserts a small early inline style before external assets on successful canonical responses. It opts in normally and opts out for reduced motion. Existing inline family transition policy is preserved; repeated application is idempotent. It does not add a stylesheet, script, global rejection handler, animation naming, or per-client design override.

`api/entity.js` applies this shared wrapper to designed and generic successful public responses only. Errors and redirects are untouched. No theme CSS/JS changes. This covers every family routed through that handler, rather than just Signature; other independent document handlers remain outside this packet.

## Verification

- 17 units: helper idempotence/early ordering/reduced motion/existing policy; real handler designed/fallback/error/redirect boundaries plus existing entity request regressions.
- 16 actual-handler browser journeys: Signature plus sparse venue/artist/generic business at390/1440, normal/reduced motion. Normal incoming transition exists, ready resolves and finished settles before screenshot; reduced has no transition. Query/fragment and back/forward preserved, zero page exceptions.
- Existing Toronto4-case browser regression passes legacy308, double navigation, back/forward, expected cancellation handling and continued visibility of deliberate unexpected transition TypeError/unrelated rejection.
- Evidence `/tmp/home-navigation-{units,browser,cancellation}.log`; screenshots `/tmp/home-navigation/{390,1440}-{0,1}.png`. Browser uses retained source-bound Signature identity and controlled sparse public rows, actual handler and assets. No live writes.

Root's earlier actual search500s and variable suggestion timing remain a separate backend reliability issue. This packet neither fixes nor hides them. Local acceptance is not a production deployment claim; production SIGNAT navigation must be checked after release.

Phone Signature screenshot inspected after transition completion. External image hosts are deliberately blocked in this navigation fixture, so missing source photographs are not evaluated as image-delivery evidence. The preserved #contact fragment also changes the visible scroll position.
