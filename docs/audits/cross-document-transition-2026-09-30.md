# Cross-document motion investigation — 2026-09-30

Independent production browser tracing reproduced an unhandled native AbortError (“Transition was skipped”) on an actual Explore → Community preferences click, with and without reduced motion. The destination opens its real sign-in dialog and remains usable. Both documents returned 200 without redirects; the error had no application-script stack. Removing the modal did not remove the error. Attaching an outgoing ready-promise handler did not remove it, so that experimental handler was removed. Disabling native cross-document opt-in eliminated it; the reason Chromium rejects the incoming transition remains unproven.

Candidate change respects reduced-motion explicitly with navigation:none under prefers-reduced-motion:reduce. Normal-motion transitions remain enabled. This is an accessibility correction, not a claim to fix the default-motion browser exception. Existing reduced-motion rules already disable named shell transitions and animations.

Evidence scripts: /tmp/transition-normal.mjs, /tmp/transition-disabled.mjs, /tmp/transition-ready-catch.mjs, /tmp/transition-no-toplayer.mjs, /tmp/transition-redirect.mjs. Chrome primary documentation: https://developer.chrome.com/docs/web-platform/view-transitions/cross-document . The documented outgoing ready rejection alone does not prove the cause of the observed incoming error.

Candidate reduced-motion browser check used only the new stylesheet intercepted over production: actual Explore → Personalize in Community click opened the sign-in dialog, transition=false at pagereveal, no pageerror. Script /tmp/transition-reduced-candidate.mjs exited0. Default-motion exception remains open.
