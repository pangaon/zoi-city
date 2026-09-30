# Intelligence receipt and Today candidate

Not staged or deployed by the implementation specialist.

## Exact release files

- supabase/migrations/20260930072110_intelligence_private_report_receipts.sql
- supabase/functions/seo-site-scan/index.ts
- supabase/functions/seo-site-scan/receipt.ts
- assets/intelligence/CONTRACT.md
- assets/intelligence/handoff.mjs
- assets/intelligence/workspace.mjs
- assets/intelligence/recommendations.mjs
- assets/intelligence/today.mjs
- assets/priorities/view.mjs
- assets/suite/priorities.js
- apps/intelligence/index.html
- social/index.html
- tests/unit/intelligence-handoff.test.mjs
- tests/unit/intelligence-recommendations.test.mjs
- tests/database/intelligence-receipts.integration.mjs
- ops/qa-intelligence-receipts-rollback.sql
- docs/audits/intelligence-receipt-release-manifest-2026-09-30.md

The two existing HTML files contain scoped Intelligence changes alongside parent changes; review their full current diff, not a replacement copied from ROOT. The separate SEO evidence/sitemap candidate has its own review scope. Do not include generated node_modules or browser fixture files.

## Verification

13 real isolated PostgreSQL checks pass, including executing the production rollback script with only dedicated QA IDs remapped to the isolated fixture. No test listing/report remains. Four bridge unit tests, three recommendation tests, and seven existing priority tests pass. Deno check passes with --node-modules-dir=auto (the default local dependency mode initially lacked OpenAI declaration dependencies; no runtime OpenAI use was added).

Browser fixture uses the actual Today module and simulated API data, not production measurements. At 390 and 1440 pixels it has no horizontal overflow. Empty reports show a check invitation; detail failure shows unavailable plus Retry saved checks. Destroying the old workspace with a pending response prevents its data replacing the new workspace. Screenshots are private artifacts .recovery/logs/today-390.png and today-1440.png. The failure check caught and corrected misleading empty-report wording.

## Boundaries and rollout

Apply migration, deploy seo-site-scan, run reviewed rollback acceptance, then verify a real anonymous scan → authenticated private save → history flow before claiming production completion. Never print tokens, full private reports or keys in logs.

Persistent 20/client/hour and 2000/hour caps bound receipt storage, after upstream fetch. The scan rate map is instance-local, so it is not a cross-instance/cold-start scan budget. Public scan success can return with saving unavailable when storage is capped. Existing redirect/DNS/public-address vetting remains; raw network error details are now replaced with fixed actionable error classes. No paid entitlement, background monitoring or ranking guarantees are enabled.

Today makes at most three private report-detail requests and renders at most twelve suggestions. It uses currently owned business IDs, exact workspace receipts, only explicit failing known checks, newest checked report per business, and dated evidence. Checks older than seven days require rechecking. Suggestions target the website that was checked, without pretending Zoi changes an unrelated external site.

## Source imagery audit (separate follow-up; no image code changes)

supabase/functions/zoi-enrich/_images.js currently treats any logo substring in filename or alt/class/id as logo evidence, and takes JSON-LD logo at face value. Metadata is a publisher claim, not visual verification. An illustration labelled Logo therefore becomes a definitive logo. A future change should preserve claimed role/source, distinguish decorative artwork and identity marks, allow explicit reviewed/owner classification, and keep uncertain artwork contained rather than promote it to a photographic hero. It must preserve reviewed owner branding and person/association identity guards. No paid per-row vision calls are justified merely to classify an alt string.
