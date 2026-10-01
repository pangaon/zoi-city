# Toronto catalogue production journey verifier

Prepared tests/browser/toronto-catalogue-journey/verify.cjs using real Playwright against live public production pages. Fresh anonymous contexts at390/1440; non-read requests are blocked, with an explicit allowlist for read-only PostgREST RPCs. No customer writes, messages, reservation/payment attempts or login.

The script checks both singular URL slash variants, retained query and valid #signature-room fragment, destination canonical/noindex, existing rendered canvas, table10 selection and transfer into the group form. It separately requires the actual explore_search response to contain the exact Toronto slug (and optional TORONTO_EVENT_ID), clicks the rendered catalogue result and requires the same interactive room. Missing publication fails rather than skips. JSON report records individual pass/failure and browser exceptions; no HTTP200-only acceptance.

Pre-release baseline and release readback will be appended after execution. Production mutation remains root-owned. Capability beyond anonymous planning remains outside this verifier.

## Prepublication baseline — 2026-10-01 03:40:53Z

Actual production run exited1, correctly failing both widths for the still-singular URL and absent exact rendered catalogue result. Both widths passed the existing plural interactive canvas/table10→group journey. No page exceptions or write attempts were observed. Report retained at /tmp/toronto-catalogue-prepublication.json. Phone group screenshot visually inspected: booth10, per-guest subtotal and explicit draft/no-hold text are readable; this does not prove reservations or payment.

A subsequent script-only diagnostic improvement makes missing search output explicitly say the exact Toronto catalogue result is absent and include the observed matching RPC-row count instead of a generic timeout. Release rerun remains pending root notification and actual UUID.

## Published readback — 2026-10-01 03:46–03:48Z

After root publication, TORONTO_EVENT_ID=4546481e-8995-482a-a0af-f0017613f187 matched the actual explore_search record at both390/1440. Both singular slash variants preserved query and #signature-room; canonical/noindex matched. Direct room selection and complete rendered search → existing room → booth10 → group input journey passed both widths. No writes attempted. Complete report /tmp/toronto-catalogue-published-complete.json; screenshots /tmp/toronto-catalogue-search-group-{390,1440}.png.

The run remains exit1 because Chromium emitted the uncaught page exception “Transition was skipped” on both widths. This is retained as a real residual finding, not filtered out to force a clean report. Source inspection finds automatic cross-document view transitions in assets/zoi-theme.css:335; no startViewTransition JavaScript caller in the inspected runtime. The next verifier revision captures exception stack and page URL to narrow attribution. Functional navigation still completed, but zero-console-error acceptance is not met.
