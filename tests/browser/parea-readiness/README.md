# Parea readiness operating journey

Run `node tests/browser/parea-readiness/verify.cjs`. Optional `QA_OUTPUT_DIR` and `CHROMIUM_EXECUTABLE_PATH`.

Reuses the existing controlled Parea fixture and actual host/roster/contact/payment modules. No live RPC, customer delivery or payment. Both390/1440: current quota→three-recipient roster→lost second response/recovery→exact private-link contact composer→recipient claim→existing unpaid door preference→host remount/current quantities→expiry→authority denial. Retains account/route/surface/queued-refresh and lost-response reload regressions. The messaging action is inspected, never opened/sent. Payment module is an existing separately owned dependency, not changed here.
