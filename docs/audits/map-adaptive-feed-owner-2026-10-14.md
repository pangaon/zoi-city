# Bounded complete map feed

Cold anonymous reads at offsets14000/15000 with two simultaneous requests:500 rows failed with SQL timeout57014 (~4.9seconds);250 rows succeeded in1.1–1.6seconds. The shared loader now assembles each existing1000-row logical page from250-row transport chunks; a statement timeout retries the same remaining offset with125 rows. Short responses are compared with their actual requested size, so only a genuine terminal response ends the catalogue. Failed chunks reject their logical page and retain explicit failed coverage. Web and native use two worker slots, and retries stay inside the chunk reader to avoid compounded page retry chains.

The actual anonymous public feed loaded15933 rows,15933 distinct IDs and slugs,65 transport reads, maximum concurrency2,14.6seconds, with `complete:true`, terminal detected, no failed offsets and no truncation. This verifies feed retrieval at that observation time, not geographic accuracy of every record. Native continues to expose retry on incomplete results. The selected receipt-backed anchor remains independent of global completion.

43 focused loader/marker/selection tests passed, native TypeScript passed, and actual MapLibre controlled browser runs at390/1440 retained exact reviewed markers and numeric directions before a held feed, rejected invalid receipts, and preserved manual camera position when the feed completed. The browser fixture uses a blank basemap for deterministic anchor checks; it does not establish production tile/provider health. Source and measurements are recorded under `docs/audits/evidence/map-adaptive-feed-owner-2026-10-14`.

No deployment was performed by this owner slice. Release and independent acceptance remain with the lead and QA.
