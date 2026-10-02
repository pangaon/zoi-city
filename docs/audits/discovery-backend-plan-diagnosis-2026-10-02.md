# Discovery query diagnosis · bounded read-only pass

The lead's production logs identify explore_search cancellations at21:36:27 and21:39:40 with SQLSTATE57014 and exact message `canceling statement due to statement timeout`. Countries, regions and home statistics also timed out. This is server statement cancellation, not evidence of a user abort. A successful read later does not negate that incident.

## Current definitions and plans

Retained complete installed definitions for explore_search, explore_countries, explore_regions and home_stats in `evidence/discovery-current-definitions-2026-10-02.json`. All reads completed; no SQL mutation or configuration change. Other retained evidence files use discoveryIndexes, discoverySearchPlan, discoveryCountriesPlan and discoveryActivity prefixes.

The current search function is the locality/custom-plan implementation. An EXPLAIN-only plan of its exact SIGNAT candidate predicate uses BitmapOr over existing full-text/name/region trigram indexes, with estimated59 qualifying rows. This is not a full execution plan/timing of the PL/pgSQL function, and does not prove it cannot time out under load. It does not justify adding another overlapping search index.

The current countries query scans published rows through idx_zoi_listings_publish then fetches/filter heap rows and groups raw country/region/city before country alias normalization. Estimated43,652 qualifying rows,20,583 scan cost. The current table has47,797 estimated rows,165,855,232 heap bytes,20,246pages and20,246all-visible pages. No existing index covers its geography projection and public visibility predicates. This is a concrete avoidable heap-access path, not proof of the entire outage's cause.

Statistics showed441 dead tuples, automatic analyze19:37:13 and autovacuum21:47:27. One aggregated activity snapshot showed only the diagnostic read active,11idle client sessions and background extension waits. There was no observed current lock blocker or maintenance operation. This cannot reconstruct contention at the earlier timeout timestamps.

## Additional correctness finding

Installed explore_regions and home_stats check publish_status but omit the clean/cleared and nonhidden public gates used by countries/search. Region/count output can therefore include listings deliberately excluded from directory search. Fixing that gate changes old incorrect counts; result equivalence should be asserted for eligible rows and intentional exclusion for hidden/moderated rows, not by requiring preservation of their inclusion.

## Proposed bounded next implementation

Requested ownership: one new guarded migration and a dedicated isolated PostgreSQL suite/audit only. No existing search function/runtime modifications needed initially.

1. Add one narrow partial geography index on country,region,city (include region_code if retained region projection benefits), with exactly published+clean/cleared+nonhidden predicate. Preserve country aggregation query/results. Validate index-only plan and result equivalence on representative wide-row data before deciding final index shape.
2. Narrow regions and statistics readers to the same visibility contract. Keep signatures, language/security/ACLs and country alias/null/pattern semantics; consolidate stats into one public scan where result semantics permit. Guard both function replacements against retained fresh definitions, including authoritative ACL preflight before eventual apply.
3. Isolated tests cover aliases, null/empty countries/regions/cities, Unicode, literal/wildcard region filters, duplicates, hidden/moderated/published rows, counts, signature/ACL preservation and bounded plan comparisons. Preserve generic search ordering, projection and dedupe behavior unchanged.

Any production index build requires lead-owned lock/load review and explicit migration strategy; a large transactional index build must not be slipped into an outage response. No restart, cancellation, timeout increase, ANALYZE/VACUUM, live index or function change was attempted. Global coordinate proposals remain frozen and separate.
