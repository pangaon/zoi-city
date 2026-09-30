# Discovery query and current links

Candidate, not deployed by the author. No production rows or indexes were changed during investigation.

Files:
- `supabase/migrations/20260930075922_fast_discovery_query_plan.sql`
- `tests/database/fast-discovery.integration.mjs`
- `ops/qa-fast-discovery-rollback.sql`

Live definitions of seven-argument `explore_search`, `explore_fresh`, `geo_country_canon` and all listing indexes were inspected on 2026-09-30. The deployed search matches the earlier 52553 source. Existing GIN `lower(name)` index was unusable for `name ILIKE`; region/native btree indexes cannot provide substring lookup. Live opclass is `public.gin_trgm_ops`.

Read-only production EXPLAIN for the Thanos text predicate: 256.737 ms, 6,865 heap blocks, 28,893 filtered-out public rows, 9 matches. A union using existing name/full-text indexes still took 208.139 ms: the remaining region substring branch alone took 141.936 ms and visited 6,304 heap blocks. This is the measured reason for one new partial, multicolumn GIN index on lower(region)/lower(region_native). No speculative country index was added. Live name comparison found 9 matches for both old and normalized Thanos predicates, and zero Greek-case predicate mismatches in the checked query.

The candidate makes all text OR branches indexable, reuses existing name/full-text indexes, and uses PL/pgSQL with function-local force_custom_plan so actual optional filters can be simplified. The setting restores on function exit. Country normalization, deduplication, existing ranking, all eligibility rules, limits, offsets and JSON fields remain unchanged. Both paths derive from current entity_type/slug; old canonical_path cannot override them.

Local actual PostgreSQL 16, en_US.utf8, 32,000 synthetic wide listings: previous deployed search 95.704 ms versus candidate 5.812 ms for selective text; forced-generic caller 93.272 versus 5.944 ms. These are local measurements, not promised production latency. EXPLAIN verifies all three GIN indexes participate. Twelve checks pass: visibility before pagination, aliases/deduplication, Greek and accented mixed-case/wildcard equivalence, stable pages, previous JSON compatibility, current search/fresh paths, public RPC permissions, and exact production rollback fixture with zero retained fixtures. The separate broad unfiltered performance comparison uses the historical pre-52553 query and is not the selective before/after figure above.

The production rollback file uses random synthetic IDs, valid current verification/trust values, and rolls back every insert/update. It checks stale route replacement in both functions along with visibility and paging. Run only after the candidate migration. No private data is logged.

Deployment: atomic BEGIN/COMMIT, 5s lock timeout and 30s statement timeout; regular index creation briefly blocks listing writes while building. A timeout rolls back the entire change. Existing index-name collision fails rather than silently accepting an unknown index. There are no table grants or new data API tables. Very short/wildcard-heavy or unfiltered searches can still require broad scans; this is not a guarantee against every infrastructure timeout.

References: [PostgreSQL query planning](https://www.postgresql.org/docs/16/runtime-config-query.html), [pg_trgm index support](https://www.postgresql.org/docs/16/pgtrgm.html). Supabase's September 25 minor-release advisory was reviewed; this change does not introduce its affected custom operators, ltree, btree_gist, or legacy encryption.
