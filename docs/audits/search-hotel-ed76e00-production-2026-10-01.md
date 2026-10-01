# Search and hotel production acceptance — ed76e00

Independent read-only browser checks on 2026-10-01. Deployed hospitality client/style (`20261001-image-recovery`) and `assets/zoi-search.js` match `/tmp/zoi-search-image-release-txeqysuh` byte for byte.

## Hotel

Actual `/business/melanthi-hotel-makrinitsa` checked at390/1440 with original photographs allowed, then separately with external photo requests deliberately blocked. In normal mode the source hero decodes. In blocked mode the hero hides the broken original and renders the unavailable notice; hotel name, approved Zoi logo and “Plan your stay” remain usable. Opening a failed gallery photograph shows the modal fallback; Escape closes it and returns focus. No form submission or booking occurred.

Screenshots `/tmp/hotel-ed76e00-{normal|blocked}-{390|1440}.png`; visually inspected blocked390. This is controlled failure recovery on an actual deployed page, not a claim its real source photographs failed.

## Search

Actual homepage and `/explore/` global palettes opened with Ctrl-K, accepted “Signature”, and returned visible live matching results. Both closed with Escape. Screenshots `/tmp/search-ed76e00-{home|explore}.png`; visually inspected homepage results. No listing mutation or account action occurred. This is a live success-path smoke; controlled error/retry acceptance is recorded separately by integration.

Reproduce both sections with `node tests/browser/hospitality-image-fallback/verify-production.mjs`. Six cases passed. Scope remains these pages and journeys; this does not establish whole-catalogue enrichment or universal provider availability.
