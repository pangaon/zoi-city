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

## Release 6228502f180063ea1855fa5d7f91e5a16b689ab0 — production acceptance

Actual production theme SHA c5a31a9fbe25aab450b1e1df23d7e4006d6ccf72a50c935c793e0c4849c9eeff and Toronto HTML SHA8beec7f01abae9fa910f843caec13f2b302c21612e9d53dd099cba2517f2240c both matched the reviewed candidate before the run. No response overrides or init-script error handlers were used.

`TORONTO_EVENT_ID=4546481e-8995-482a-a0af-f0017613f187 QA_REPORT=/tmp/toronto-catalogue-production-6228502.json node tests/browser/toronto-catalogue-journey/verify.cjs` exited0. At both390/1440: both singular slash variants retain query/#signature-room; canonical/noindex match; real room table10→group works; actual public search returns the exact event UUID; clicking its rendered result reaches the same room and continues table10→group. Zero page exceptions, including no prior Transition was skipped exception. No write requests attempted.

This accepts the anonymous catalogue-to-planning journey and bounded navigation fix. It does not configure ownership, sellable inventory, holds, automated invitations, payment or admission issuance; those remain separately tracked.
