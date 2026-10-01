# Shared hospitality source catalogue — candidate evidence

2026-10-01. Local candidate only; no worker deployment, enrichment apply, database write or production completeness claim.

## Source evidence

The category inventory in `hospitality-category-source-gap-2026-10-01.md` found 388 published hotel listings, 187 with websites and 158 with machine enrichment, but zero machine rooms/amenities arrays. These counts are not 388 source audits.

Actual AMARA source HTML, fetched read-only before implementation:

- `https://www.amarahotel.com/`: SHA-256 `ceefbe28344becb009bf10294067c83b533e46aa014170c6af0db4c6fa161604`. It declares catalogue navigation but no accepted named room rows on this page. Bounded discovery selects existing contact-us first, then the actual `/rooms` link.
- `https://www.amarahotel.com/rooms/`: SHA-256 `07f839e6171ec591f539b6d81258e001ebf1b2847b4ebe0bfe6a5e4bf6608b4d`. Extracts Deluxe Sea View Room and Deluxe Grand Sea View Room with their exact official detail links. Empty duplicate image links do not become extra rooms. No price, capacity, stock, amenities or card photo is inferred.

Full temporary captures are `/tmp/hotel-audit-amara.html` and `/tmp/hotel-audit-amara-rooms.html`. The committed-size fixture is a minimal source-derived link/nav excerpt, not a full source capture and not a production enrichment receipt.

## Shared contract

The worker and both review capture modes reuse the same pure hospitality extractor. Named room/dining/venue links require hotel context and actual specific same-origin detail URLs. Structured amenities require `LocationFeatureSpecification` with boolean true. Conflicting duplicates, multiple Hotel roots, another property's schema URL, unsafe links and generic navigation do not become facts. Catalogue rows contain only name, detail and source. Photos keep the separate image-review contract.

Supplementary discovery retains the existing two-page maximum and current guarded request path: DNS/URL vetting, robots, redirect, byte/deadline guards. Contact/menu retain priority over catalogue, which precedes gallery. No guessed URL. Source and accepted supplemental catalogue provenance include the exact fetched HTML SHA-256. Initial and supplementary redirects are both fenced against the original lease website: same-domain sibling-property redirects cannot donate catalogue fields. Existing supplementary contact/media behavior is otherwise unchanged.

**Single-page capture limitation:** `captureSourceHTML` still captures one HTML source and separately validates its image candidates. It does not follow the rooms link. Therefore a homepage-only review cannot claim it captured the AMARA room catalogue. A later operational canary must capture/review the actual page with appropriate identity/evidence, or use the reviewed worker path; this candidate does not run either live.

Canonical public projection now honors `owner_content.profile` catalogue arrays, including null/empty clears, before direct owner profile and machine values. Machine catalogue values require current source identity and property path; source quarantine or changed/cleared website suppresses them. Imported detail links receive a second property boundary check. Partial owner clears leave unrelated categories intact. Curated Olympia amenities no longer reappear after an explicit clear.

## Rendered and exercised evidence

- 56 focused unit/integration tests pass across hospitality catalogue, actual worker body extraction, extractor fingerprint, source-HTML capture/review, and existing hospitality model/designs.
- Source-derived excerpt -> isolated source capture (one request; exact HTML hash) -> reviewer/lease-bound payload -> canonical API model -> all four renderers passes. No live write.
- Eight browser combinations pass: Atelier, Concierge, Table, Parea at 390 and 1440 pixels. Each opens the actual room details modal, verifies exact official detail URL and absence of invented availability, closes with Escape and restores focus, shortlists into the stay plan and focuses arrival. Explicit cleared/sparse version removes cards and room selector. No page errors or horizontal overflow.
- `/tmp/hotel-catalog-<template>-<width>.png`; Concierge 390 inspected visually. Actual website handoff is asserted by URL, not a claim of booking or provider availability.

Commands:

```
node --test tests/unit/hospitality-source-catalog.test.mjs tests/unit/enrichment-profile-extraction.test.mjs tests/unit/extractor-fingerprint.test.mjs tests/unit/reviewed-source-html.test.mjs tests/unit/hospitality-home.test.mjs tests/unit/source-html.test.mjs
node tests/browser/hospitality-source-catalog/verify.mjs
```

## Remaining scope

Independent review, exact release checks, worker deployment decision, one source-reviewed canary and production readback remain lead-owned. Full hotel coverage, live booking inventory, catalogue photographs and owner catalogue-editor journeys are not proven by this patch. The extractor deliberately omits unrecognized layouts and uncertain source facts.
