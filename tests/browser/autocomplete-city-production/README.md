# Actual production directory acceptance

Run only after the lead identifies the exact pushed commit and READY deployment/aliases:

```
RELEASE_COMMIT=<40-character git SHA> DEPLOYMENT_ID=<exact Vercel deployment ID> EVIDENCE_DIR=/tmp/reviewer-directory-production node tests/browser/autocomplete-city-production/verify.cjs
```

This test requires the local git object for that exact commit. It first compares the deployed Explore HTML and two directory modules byte-for-byte with that commit, requires both versioned imports, then runs sixteen actual anonymous phone/desktop journeys. It observes the actual browser module requests to confirm the released import URLs. It serves no local pages, intercepts no read responses and injects no listing/catalog fixtures. It blocks attempted mutation RPCs and does not use a signed-in session or write saved-home/customer data.

Cases cover OPA reachability from its short prefix and actual canonical destination, Signature/Yamas, live country/city selection, initially scoped Nairobi/North York URLs, empty results, touch and keyboard. Failures and timing observations remain in the distinct requested evidence folder. This is a bounded deployed guest acceptance test; it does not establish whole-catalog completeness, all languages, all authenticated settings or physical native behavior.
