# Payment arrangement transport release — 2026-10-01

Commit74afbe34b7f971d2753199e16ead4fcc87bc84ea deployed; CI36859520810 and VercelCddnF3ZNheyt6zX8BDnR93uKKeZ6 succeeded. Production module matches committed release bytes (/tmp/payment-scope-production-bytes.json).

Only the current-scope transport adapter was staged onto the existing released payment module. Deadline/settings/cancellation WIP and its client remain preserved locally and unshipped pending schema readiness. No host mounting or database change occurred.

Root inspected adapter checks and independently passed30 current candidate actual-Core cases. Exact staged release9183df6bb632ea0f836a5ea6db1a102ccf8173ba then passed12 payment-only actual-Core cases at390/1440 (destroy/detach and valid sameactor refresh for reads/writes) plus273 node:test files, two standalone suites and JS/HTML checks. Evidence /tmp/payment-scope-staged-browser.json, /tmp/payment-scope-staged-check.log. The initial browser invocation without EXPECT_FIXED intentionally expected old baseline behavior and failed; corrected fixed-mode invocation passed, not suppressed.

These are controlled browser contracts. No real payment, customer mutation, provider or live database persistence was exercised. Event-service configuration, stock/order lifecycle and staff settlement/closure remain separate incomplete scope.
