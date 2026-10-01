# Cross-document transition repair

## Reproduction and root cause

Actual production Explore search → Toronto emitted window unhandledrejection AbortError “Transition was skipped”. A minimal browser reproduction used ordinary link click, not a verifier evaluate callback. CDP reported Uncaught (in promise), DOMException code20, empty JavaScript stack at the destination. Outgoing pageswap had a transition; incoming pagereveal did not. The functional guest journey completed despite this console defect.

Toronto's custom document lacked the early opt-in used by the shared theme. Adding opt-in through an external CSS override was insufficient for initial incoming eligibility; the same rule in the early head produced a transition in both directions. Actual local legacy308 routing proves the redirect does not require replacing safe slug-derived links. Existing historical invalid name-derived catalogue paths therefore remain untouched.

## Candidate

- Toronto document: early head @view-transition navigation:auto plus prefers-reduced-motion opt-out. Existing art direction, canonical and noindex retained.
- Shared assets/zoi-theme.js: observe only ready promises belonging to pageswap/pagereveal transition events. Expected AbortError on rapid/history cancellation is handled locally. Unexpected transition errors are reported via reportError (or throw fallback); unrelated page errors/rejections are not intercepted. No global error or unhandledrejection listener is installed by runtime.

Chrome's primary documentation describes the outgoing ready promise rejecting when its snapshot is skipped: https://developer.chrome.com/docs/web-platform/view-transitions/cross-document . The combined fix preserves transitions and actual browser navigation rather than disabling shared motion.

## Verification

node tests/browser/navigation-transitions/verify.cjs passes 390/1440 with normal and reduced motion. Uses real Toronto HTML/assets and shared theme runtime, local exact308 source route, and blocks external requests. Verifies single and double navigation, query/fragment retention, room canvas, back/forward. No normal-journey page exceptions. Deliberately injected unexpected transition TypeError and unrelated rejected Promise both still reach pageerror and are explicitly asserted. No test init-script suppresses rejections.

No production runtime deployed by this lane. Actual production catalogue verifier must rerun after root deployment. Browser fixture only establishes navigation/rendering, not ticket reservations, payments or message delivery.

Frozen hashes:

- assets/zoi-theme.js: c5a31a9fbe25aab450b1e1df23d7e4006d6ccf72a50c935c793e0c4849c9eeff
- events/giannis-ploutarchos-andromache-toronto-2027/index.html: 8beec7f01abae9fa910f843caec13f2b302c21612e9d53dd099cba2517f2240c

Independent review requested positive animation eligibility evidence. Fixture now records the first destination pagereveal without a rejection handler: normal-motion viewTransition must exist and its ready promise must resolve; reduced-motion viewTransition must be absent. All four cases pass. This verifies the configuration repair independently of expected cancellation handling.
