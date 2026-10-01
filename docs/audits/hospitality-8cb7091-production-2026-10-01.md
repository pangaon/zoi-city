# Hotel catalogue release and real-source canary

Release 8cb70911092ec7886c00cb52be406d439243e33d, 1 October 2026.
Vercel deployment: https://vercel.com/pangaons-projects/zoi-city/3eFpN3yrRkqJFQj1CywYdi6k8KFd. CI36809694180 and bounded quality36809729459 succeeded.

## Release evidence

Final staged tree8b77c738def9582b0cdba727a7f1fac5e47ff8a1 archived at /tmp/zoi-hospitality-final-yeqtc_de. All manifest runtime/test bytes match the separately checked clean archive /tmp/zoi-hotel-fullverify-3mgzfxv2. Full verify:local passed255 node:test files plus2 standalone suites. Earlier release checks caught a source-fragment HTML lint mismatch and missing handler-harness helper dependencies; fixed without relaxing assertions.69 focused tests and8 browser template/width cases pass. Actual production model bytes match the archive.

Worker zoi-enrich version49 ACTIVE, deployment hash7504a2517798de87ebfb244aa490f0b7bfca43285fd1d9d5c23ef3ad6433c640. Retrieved all14 local source files and matched every byte to the final archive. Existing custom authentication retained; unauthenticated POST returns401. No broad crawler run was triggered.

## Source and database evidence

AMARA ID361c983b-29aa-4b4a-8bfa-ca4a17993e40. Independent original-source/report review: amara-catalog-canary-independent-2026-10-01.md. Both official detail pages resolve200 at their exact URLs. Source HTML hash07f839e6171ec591f539b6d81258e001ebf1b2847b4ebe0bfe6a5e4bf6608b4d; canonical report hashfd4e6ff05e31972ac6638eb17abcdde6d08b061f390c1e63147bc4d5c1430539.

Immediately before promotion, exact profile, source fingerprint, website and absence of owner/owner clears matched the reviewed snapshot. Obtained real single-record enrich_sample_lease; separately read its stored fingerprint (same-statement MVCC read did not expose new lease metadata). Bound report and previous machine hash through reviewedEnrichmentBatch. Existing enrich_apply returned applied:true and consumed the lease. No direct listing UPDATE or invented lease.

Post-read deep comparisons preserved prior business fields, description, photo, socials, provider, tagline, language and provenance. Only rooms/source evidence and ordinary writer metadata/coverage changed. The stored source URL was normalized by the existing writer to the unchanged website string; no website change. Public owner content remains empty.

## Rendered and exercised production evidence

Actual canonical /business/amara-hotel-limassol at390/1440 shows exactly Deluxe Sea View Room and Deluxe Grand Sea View Room with their corresponding official detail links. Both dialogs open, Escape restores focus, each shortlist selects the matching room and focuses arrival. No overflow or page errors. Existing hero, three social links and provider URL preserved. Read-only script tests/browser/hospitality-source-catalog/verify-production.mjs passes; no plan submit, booking, email or account mutation. Screenshots /tmp/amara-production-room-{0,1}-{390,1440}.png; lead visually inspected phone dialog.

## Boundaries

This proves two source room names/links and the shared extraction/review/render path, not full388-hotel coverage, room photography, dates/rates/inventory, a completed booking or authorized hotel owner editing. The existing database coverage ledger still records source fetched and verification pending; this bounded artifact does not silently mark whole-listing criteria complete. Owner catalogue editor is a separate active specialist batch.
