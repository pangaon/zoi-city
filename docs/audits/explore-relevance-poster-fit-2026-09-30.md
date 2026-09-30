# Shared discovery relevance and announcement artwork

The deployed Explore RPC ordered results by trust and name before pagination, without query relevance. New migration `20260930191446_explore_name_relevance.sql` preserves public eligibility, filters, deduplication and stable ID ties, while placing exact names, name prefixes, word matches and substrings ahead of unrelated full-text matches. Escaped LIKE retains existing trigram indexes and treats literal percent/underscore as text. No listing-specific boost exists.

Read-only execution of the candidate SELECT against production measured 83.427 ms using existing full-text/trigram indexes. An earlier strpos filter was rejected after a 4.6-second scan. The final migration has NOT been deployed by this specialist. Actual OPA prefix search has 46 legitimate prefix identities, so the promoter can still require refinement or pagination; exact “OPA Productions” remains the reliable precise query.

The bounded search projection adds image_kind only when explicit event_poster metadata matches the projected current hero URL. Explore cards and hydrated Quick look use contain for that role; ordinary photos retain their crop. Owner replacement or clear removes the role. Quick-look helper import is versioned to prevent stale helper code. Existing locality-personalization changes were preserved.

Validation: 13 actual PostgreSQL checks pass, including literal %/_, Greek παρέα, visibility before limit, explicit filters, stable pagination, photo replacement and the production rollback script. Five public preview unit checks pass. Existing 32,000-row fixture measured 78.449 ms unfiltered and 7.659 ms filtered. Local code over actual public data was inspected at 390/1440; Quick look shows full official poster with computed object-fit contain, no page errors. Browser interception used serviceWorkers:block; these screenshots are candidate evidence, not a deployed claim. Browser closed.

Release fixture: `ops/qa-explore-relevance-rollback.sql`, validated in the PostgreSQL harness with zero retained rows.
