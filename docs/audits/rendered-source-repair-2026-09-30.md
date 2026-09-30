# Rendered official-source repair — 30 September 2026

## Observed failure and shared correction

Yamas' official homepage serves a 1,276-byte React shell. The old worker accepted its generic metadata as successful enrichment although the real photographs, contact details and menus arrive after JavaScript. This failure is not specific to restaurants. The worker now distinguishes empty JavaScript shells from substantive server-rendered sources; the existing quality collector returns `javascript_render_required` with an enrichment repair action. Video source URLs cannot become image heroes; menu scans and decorative quotation artwork are separated from venue photography across families.

The new operator source renderer uses the same extraction functions as the worker. It captures a fresh public browser context and stores individually hashed evidence. It is not a customer-supplied browser automation endpoint. Transport checks public DNS, pins resolved addresses, checks robots at every redirect, serializes host requests, and limits requests, time and streamed bytes including failed downloads. HTTP/WebSocket interception, Chromium sandbox, minimal child environment and disabled non-proxied WebRTC reduce exposure; this is not a claim of network-namespace isolation. Source API bodies are not persisted. DOM artifacts strip scripts, comments, form values and inline handlers; arbitrary public DOM is not guaranteed free of accidentally published sensitive information.

## Measured scope

Read-only aggregate of published `zoi.listings` with HTTP websites, before this repair; no moderation eligibility filter. Counts below measure machine fields only, not owner-provided images. A missing image does not prove a JavaScript failure.

| Family | Website rows | No machine photo | Status OK without photo, phone or email |
| --- | ---: | ---: | ---: |
| business | 4311 | 2940 | 20 |
| organization | 2141 | 1413 | 74 |
| professional | 2042 | 1363 | 9 |
| school | 1154 | 620 | 14 |
| church | 1127 | 556 | 5 |
| vendor | 1103 | 490 | 6 |
| event | 789 | 399 | 3 |
| creator | 646 | 449 | 28 |
| artist | 398 | 209 | 5 |
| travel_place | 370 | 175 | 2 |
| venue | 219 | 126 | 0 |
| sports | 125 | 73 | 1 |
| Total | 14425 | 8813 | 167 |

Actual source capture was exercised for four families: Yamas captured successfully; Millennium Greek Band returned HTTP 404; Manchester Annunciation church and Greek School Wales could not be fetched. Each failure has its own immutable repair report. This is four source attempts, not 14,425 completed audits, and not four successful customer journeys.

## Yamas applied source evidence

Listing `84bdafb9-966b-489a-a4d3-0dc3dc92acf9`, website `https://www.yamas.co.ke/`, source fingerprint `b047d23043d3c7b0dc15759690f15c7d`.

The real existing `enrich_sample_lease` / `enrich_apply` pathway returned `applied:true` at 2026-09-30 15:38:08 UTC. The base-row hash remained `f077ede7e2be83032cb34e8576e8e001`; the owner-profile hash remained `d1ea18025007a82bf4674853daaa23b5`. Owner fields and explicit clears were preserved. Applied source fields include visually inspected logo and food imagery, phone, official email, menu URL, two observed high-resolution menu scans, official booking URL, public street address, source-derived accessible blue/white palette, and source-backed description. The website's exact blue is #2e8bc0; the darker accessible action colour is an adaptation, not a claim that its exact CSS was copied.

Canonical reviewed artifact SHA256: `ab4f7ba354255db814dd74b2495b3119aa64984101c1c2deb96374e12d6c0cca`. Capture made 17 guarded requests and received 8,375,410 body bytes. The evidence and expired lease payload remain private recovery artifacts; do not replay the expired SQL.

Database enrichment state is `fetched`, identity_verified false. Source repair alone does not sign off classification, design or exercised journeys. Independent public-surface verification belongs in the discovery/journey audit.

## Operation and remaining gaps

- `render-capture.mjs` is a bounded, resumable source-only batch CLI; hash mismatch prevents evidence reuse.
- `render-queue.mjs` uses the existing capped lease and guarded apply writer. Automatic import requires matching title and host, useful source fields, and a successful rendered source. Owner-managed records are refused for automatic repair. Other cases become explicit repair reports. Existing nonempty machine fields survive missing source fields.
- The new `source-render.yml` is a **push-triggered canary**, maximum three listings, with an expiring request manifest. It has not run in CI at this audit point. Workflow dispatch currently returns 403 in this session. Activation requires the release owner to push and inspect confirmed receipts. No recurring schedule has been enabled or verified.
- Queue writes save a pending artifact first, never retry ambiguous writes, and retain confirmed receipts. Ambiguous receipts require operator reconciliation; this queue is not yet an unattended full-inventory repair daemon.
- Node 24 and pinned playwright-core 1.63.0 are required for the rendering tools. Normal site runtime requirements are unchanged.
- Worker JavaScript-shell detection must be deployed separately by the release owner. Repository edits alone do not change the deployed worker.
- Yamas coordinates remain null. Enrichment apply has no geocode side effect and no geocode queue/RPC was found. Existing `tools/geocode.py` and `tools/emit-geocode-sql.py` emit manually reviewed backfill SQL, including city-centroid fallbacks. Do not use those fallbacks as an exact restaurant pin. A source-validated street geocode and guarded coordinate writer remain needed.
- No all-profile completion, zero-defect, or source-based ownership-verification claim is justified.

## Validation

41 focused tests passed: document quality, rendered capture and source binding, robots/redirect/DNS/queued budgets, failed streamed downloads, source identity, and shared image extraction. Independent reviewer reproduced the redirect and budget failures before their fixes and checked the transport regressions afterward. The new unattended queue policy has unit coverage but still needs independent release review and a real bounded CI receipt before recurring activation.
