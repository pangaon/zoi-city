# Independent navigation transition review

1 October 2026. No runtime edits, customer mutations or deployment by reviewer.

## Reproduced actual production failure

Independently ran `/tmp/zoi-transition-diagnose.cjs`, which loads actual Explore search and clicks the actual Toronto event result. No page.evaluate calls initiate navigation. Outgoing `pageswap.viewTransition` is present; destination `pagereveal.viewTransition` is absent. Browser emits unhandled `AbortError: Transition was skipped`; CDP attributes it to the Toronto event destination with no JavaScript stack. The destination room canvas still loads, so a successful rendered room alone misses this failure.

The shared theme opts into cross-document navigation transitions; Toronto's custom family does not load that theme. Lead requested matching destination-family participation and reduced-motion policy before considering shared opt-out. Acceptance pending specialist prototype and independently exercised candidate. No error swallowing or console suppression is accepted as repair evidence.

## Corrected candidate independently accepted for integration

Toronto now declares cross-document participation early in its head and disables it under reduced motion. The shared theme script observes only the browser-owned transition.ready promise on pageswap/pagereveal: expected AbortError cancellation is consumed; other errors are explicitly reported. There is no global error/rejection filter, route replacement or blanket transition disable.

Independently reran `tests/browser/navigation-transitions/verify.cjs` after strengthening positive participation checks: four 390/1440 × normal/reduced scenarios pass actual destination canvas through legacy 308, query/fragment preservation, double navigation, back/forward and no unexpected browser exceptions. Normal single-click arrival positively has a transition whose ready promise resolves; reduced motion has none. A separate deliberate unexpected transition TypeError and unrelated rejected promise both remain visible as page errors. Thus acceptance does not rely solely on absence of swallowed abort messages.

Accepted shared script SHA256 `c5a31a9fbe25aab450b1e1df23d7e4006d6ccf72a50c935c793e0c4849c9eeff`; Toronto HTML `8beec7f01abae9fa910f843caec13f2b302c21612e9d53dd099cba2517f2240c`. Fixture source page is a minimal local shared-theme page and destination is actual candidate runtime, not a complete deployed Explore test. Lead still needs deployed search→room rerun after exact-byte release. No production repair claimed yet.
