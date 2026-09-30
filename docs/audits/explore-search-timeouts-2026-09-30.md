# Explore autocomplete: production timeout diagnosis

Read-only independent investigation; no backend mutation, configuration change or load test. User's screenshot cannot be tied to a particular logged request: request bodies/query parameter values were not available in these records.

## Confirmed production failure

Supabase unified logs show `/rest/v1/rpc/explore_search` HTTP 500 at 20:40:38.984, 20:41:25.576 and 20:41:26.197 UTC, with origin times 4679, 5532 and 4912 ms. PostgreSQL logged SQLSTATE 57014 in `explore_search` at 20:40:42.643 and 20:41:29.665/29.729/31.641. Exact message: `canceling statement due to statement timeout`. These were actual database timeouts, not evidence that the user mistyped a name.

The anonymous role has statement_timeout=3s; authenticated and authenticator roles have 8s. Last-24-hour endpoint summary at inspection: 423 HTTP200, 21 HTTP500, one HTTP504, two HTTP404. Successful statement statistics alone omit the failed execution evidence: the common six-argument search shape had 271 calls, mean426ms and maximum2881ms.

## Not isolated to autocomplete

During 20:40–20:42 UTC, other RPCs also returned HTTP500: home_stats (2, max9620ms), dir_browse (2, max5864ms), feed_list (1,5859ms), explore_countries (4,4310ms). This supports a shared service slowdown during the incident. It does not identify CPU, pool saturation, lock contention or a specific background job as the cause.

Current pg_stat_activity snapshot: ten idle client sessions, one active diagnostic query, zero blocked sessions, zero active queries older than five seconds. Database cumulative deadlocks=0. Cumulative temp_bytes≈4.75GB has no incident-specific time window and is not proof of current spill pressure. Read/write timing counters were zero and cannot establish fast I/O.

Listings metadata: estimated32150 live/5793 dead tuples, last autovacuum16:48UTC, last autoanalyze18:48UTC. Incident-window logs contained one checkpoint completion (998buffers;105s pacedwrite,0.019ssync), no retrieved deadlock/out-of-memory/too-many-connections or autovacuum messages. This checkpoint is not established as causal. Cron history20:39–20:43 showed social worker launches and one feed launch, all succeeded; SQL launch durations0.04–1.42s, not the asynchronous worker completion time. No overlapping maintenance job appears in that bounded cron history.

Cumulative statement cost points to useful follow-up targets, not incident attribution: seo_entity31,790calls/8296s; explore_countries15,124/5960s; enrich_queue_lease1762/4619s (mean2622ms); explore_regions19,832/2590s; enrich_apply1759/1029s. No CPU/memory historical metric capability was exposed in the available tool catalog.

## Current query evidence

Twelve sequential public probes of SI/SIG/SIGN/SIGNAT across unrestricted, Toronto+Canada and Athens+Greece scopes all succeeded in55–571ms. Unrestricted SIGNAT includes Signature Productions.

Live SIGNAT search predicate EXPLAIN used BitmapOr over existing search_tsv GIN, lower(name) trigram and public region trigram indexes: three rows,4.17ms execution,55ms planning, no disk reads. Full SI RPC with limit8 executed360ms with11317sharedhits and no reads. No missing-index diagnosis was established. Lowering projection limit48→8 reduces response/projection work but does not remove candidate filtering/ranking/deduplication.

A distinct relevance issue: Signature Productions is stored in North York, Canada. Strict Toronto filtering returns a realtor containing Signature, so existing fallback (worldwide only when zero scoped results) does not show the stronger North York name match. This explains omission under that filter, not the error screenshot. Do not silently replace North York with Toronto.

## Recommended bounded response

Use one bounded retry for eligible transient failures, preserve request-version cancellation, and give each attempt enough time to receive the server's three-second timeout plus gateway delay (six seconds suggested versus3.5). Do not automatically increase database timeouts or create speculative indexes. A client retry is resilience, not a fix for the demonstrated shared-service slowdown. Next infrastructure diagnosis needs incident-correlated resource/pool metrics; next query optimization should measure the high-cost shared functions above in isolation and preserve public visibility/owner data rules.
