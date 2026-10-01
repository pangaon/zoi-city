# Independent autocomplete recovery acceptance

Candidate reviewed: `assets/discovery/autocomplete.mjs`, versioned Explore import. No implementation edits by reviewer.

Seven controller/projection tests pass. Independent browser runs at 390×900 and 1440×900 use the actual local Explore page and real anonymous production `explore_search` RPC for normal/recovered requests. Only specified failure/stale responses are injected; no private data or writes.

- Typing `SIGNAT`: one limit-8 request; Signature Productions appears first, followed by relevant professional listings.
- Inject first 503: exactly two attempts; real second request recovers Signature suggestions without user retry.
- Persistent 503: exactly two attempts, then honest “Suggestions could not load. Retry”; no empty-success or fabricated result.
- Delay SIGNAT then type OPA: only the newer OPA result renders; late older response cannot replace it.
- Escape closes every state; no reopened panel, horizontal page overflow or uncaught page errors in either viewport.
- Unit coverage additionally verifies hung transport timeout/retry bounds and cancellation of a scheduled retry.

Evidence: `.qa-autocomplete/results.json` plus `live`, `first-fail`, `persistent`, `stale` screenshots at both widths. One browser was used and closed. No blocker found in this requested slice. Local candidate acceptance is not a production deployment receipt.

## Fresh live diagnosis after renewed SIGNAT failure report

30 September 2026: anonymous direct RPC probes returned HTTP200 in361ms (unfiltered),287ms (travel_place empty),268ms (cross-category) and61ms (business). Actual production browser at390 and1440 with `q=SIGNAT&type=travel_place` showed Signature Productions first, explicitly labelled outside selected filters. Suggestion request pairs took116/160ms mobile and104/65ms desktop; full-results requests283/135ms. No browser/network failures. Current deployed suggestion timeout is6000ms.

Evidence `.qa-autocomplete/live-diagnostic.json` and `current-live-{390,1440}.png`. This successful fresh sample does not invalidate the user's observed earlier error or establish its cause. Root identified a concrete additional load defect: full results requests start alongside suggestions and formerly lacked cancellation when typing changes. Root owns that repair; this lane did not add more automatic retries or alter backend behavior. Suggestion controller already aborts replaced requests and fences stale responses. Browser closed.

## Full-results cancellation candidate — independent mounted acceptance

At390 and1440, actual candidate Explore HTML was served by a page-only production-origin override; all Zoi assets and SIGNAT public suggestion/canonical reads remained live. A controlled delayed full-results request observed its actual fetch AbortSignal being aborted when OPA replaced it. OPA became the visible full results; obsolete failure did not show Retry. A separate current503 produced Try again. Actual SIGNAT suggestion click navigated to its returned canonical URL `https://www.zoi.city/business/signatureproductions-6aa61d` and rendered Signature Productions, not the refreshing fallback. Both widths produced zero page errors.

Evidence: `.qa-autocomplete/cancel-candidate.mjs`, `cancel-candidate-results.json`, `cancel-signature-{390,1440}.png`. Browser closed. Controlled transport failures prove the candidate cancellation/error behavior; they do not identify the exact cause of the earlier user-observed production failure.

## Production d16d69e
Exact staged tree04f6abdffdf4ad90ea55f1a77b0be5e5bd461ba4 verify:local exit0 (243 test files +2 standalone); CI36779945800 success and Vercel95xCUaA4vdJxiUdbL9vwgMAcH58c success. Root independently reran actual deployed HTML390/1440: injected delayed obsolete full-results fetch cancelled, actual newer OPA wins, injected current503 retains retry, actual SIGNAT suggestion navigates canonical Signature and renders. Zero pageerrors. Evidence .qa-autocomplete/cancel-production-results.json. The earlier intermittent SQL timeout cause remains unproven.
