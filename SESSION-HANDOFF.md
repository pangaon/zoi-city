# Session Handoff

**Date:** 2026-09-16
**Workspace:** `/workspaces/zoi-city`

## Completed

- Repaired `supabase/migrations/0039_canonical_geography_contract.sql`.
- Added `supabase/migrations/0040_enrichment_control_plane.sql` with leased
  enrichment work, provenance-preserving refreshes, and the public
  `listing_completeness(slug)` RPC.
- Updated `supabase/functions/zoi-enrich/index.ts` to use leased queue rows and
  release them only when the batch applies.
- Updated `.github/workflows/supabase-deploy.yml` so migration pushes also
  deploy the enrichment worker.
- `public.explore_search()` now projects only its documented response fields.
- Ranking metadata (`trust_score`, `dedupe_rank`) remains internal.
- Added `l.id` as the final ranking tie-breaker for deterministic deduplication and ordering.
- Added a unit regression test covering the public JSON projection and ranking metadata.

## Validation

- Focused tests passed:
  `node --test tests/unit/geography-contract.test.mjs tests/unit/search-hardening.test.mjs`
- Aggregate `npm test` passed: 273 node tests, 53 contract checks, 17 page
  checks, and 16 unit checks. Event OS checks were reported as expected skips
  because that migration is not deployed.
- `npm run check`, `npm run lint:html`, and `git diff --check` passed.
- The migration has not been executed against Supabase in this environment.
- This change is being published through the production deployment workflow;
  verify the workflow run and live cron/Vault state before calling enrichment
  fully operational.

## Next Agent

1. Run `npm run check`.
2. Run `npm run lint:html`.
3. Run `node tests/unit/run.mjs`.
4. If migration `0039` is applied, run `node tests/contract/run.mjs` and verify
   `explore_search` returns no `dedupe_rank` or `trust_score` keys.
5. Review `git diff` and commit only the intended migration, test, and handoff changes.

## Known Boundary

This handoff does not claim that migration `0039` is live. Live SQL behavior,
permissions, and production data still require Supabase-side verification.