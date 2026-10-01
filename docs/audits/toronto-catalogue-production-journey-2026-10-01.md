# Toronto catalogue production journey verifier

Prepared tests/browser/toronto-catalogue-journey/verify.cjs using real Playwright against live public production pages. Fresh anonymous contexts at390/1440; non-read requests are blocked, with an explicit allowlist for read-only PostgREST RPCs. No customer writes, messages, reservation/payment attempts or login.

The script checks both singular URL slash variants, retained query and valid #signature-room fragment, destination canonical/noindex, existing rendered canvas, table10 selection and transfer into the group form. It separately requires the actual explore_search response to contain the exact Toronto slug (and optional TORONTO_EVENT_ID), clicks the rendered catalogue result and requires the same interactive room. Missing publication fails rather than skips. JSON report records individual pass/failure and browser exceptions; no HTTP200-only acceptance.

Pre-release baseline and release readback will be appended after execution. Production mutation remains root-owned. Capability beyond anonymous planning remains outside this verifier.

## Prepublication baseline — 2026-10-01 03:40:53Z

Actual production run exited1, correctly failing both widths for the still-singular URL and absent exact rendered catalogue result. Both widths passed the existing plural interactive canvas/table10→group journey. No page exceptions or write attempts were observed. Report retained at /tmp/toronto-catalogue-prepublication.json. Phone group screenshot visually inspected: booth10, per-guest subtotal and explicit draft/no-hold text are readable; this does not prove reservations or payment.

A subsequent script-only diagnostic improvement makes missing search output explicitly say the exact Toronto catalogue result is absent and include the observed matching RPC-row count instead of a generic timeout. Release rerun remains pending root notification and actual UUID.
