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
