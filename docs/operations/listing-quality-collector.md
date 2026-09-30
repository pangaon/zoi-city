# Listing quality evidence collector

Candidate implementation; no production task leases or receipts have been executed by its author. It uses the existing `listing_quality_task_lease` and `listing_quality_task_finish` RPCs from production migration20260930060330 (source candidate53625). It creates no queue, table, listing, contact message or paid model call.

## Execution boundary

`node scripts/quality-collector.mjs` is a plan-only invocation: zero network requests and zero queue mutations. Production execution requires explicit `--execute` plus `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` from the existing authorized CI credential context. Never print or put a credential in CLI arguments. RPC endpoint is fixed to the existing project. Public browser subprocesses receive a minimal environment without service credentials and use a dedicated public-only session.

After review, a canary command is:

```
node scripts/quality-collector.mjs --execute --task classification --limit 3
```

Supported tasks are `classification` and `verification`. Default limit is3, hard maximum20, and collection stops after an eight-minute run budget. Leases are processed sequentially. The SQL owns stale-source/visibility/ownership checks, attempts and retry backoff. No lease acquisition is retried after an ambiguous response. This lease RPC selects eligible IDs itself; the CLI does not pretend to target arbitrary chosen IDs.

Design remains pending source-section review. The browser gathers actual DOM evidence, but that alone does not prove a design’s source facts; the CLI therefore refuses a design task rather than routinely marking it verified.

## Evidence standard

Classification requires an identity-matched CHMS member body, a reviewed legal-association component, or one exact-name, typed source JSON-LD identity. Person/organization conflicts, unknown member structures, challenges, missing identity and HTTP failures remain retries. A reachable HTTP200 page is insufficient. Classification is a source-role finding, not professional licence, ethnicity, employment or account-ownership verification.

Public source requests use HTTPS, DNS-resolved public IPv4 addresses pinned at connection time, TLS host validation, bounded responses, absolute timeouts, at most three same-site redirects, and robots.txt rules. Unsafe/IPv6-only/unavailable sources remain unresolved. No authentication challenges are bypassed. Source HTML is hashed rather than copied into the durable report; selected identity facts are bounded.

Verification checks the canonical public route’s actual HTTP response, then real rendered DOM at390/1440: displayed identity (published parenthesized nicknames supported), overflow, image loading, safe links, anchor targets, labelled controls, and supported primary actions. It actually opens/closes the profile checklist or source-gallery dialog (or details control). Health contact cards are downloaded and their vCard identity checked, then removed locally. Unrecognized primary controls keep the result pending. This is bounded public-home verification; it does not attest customer payments, bookings, licensing or all workspace workflows.

## Immutable receipts and recovery

Before finishing a lease, the collector writes a canonical JSON report under `.recovery/quality-evidence/<sha256>.json` (mode0600). A separate immutable pending file binds exact listing ID, lease, task, decision and evidence reference. The database receives `evidence_ref:sha256:<hash>`. A confirmed server receipt is written separately; logs contain only IDs, task/status and evidence hash.

If a finish response is lost, preserve these files and run:

```
node scripts/quality-collector.mjs --execute --resume --limit 3
```

Resume validates the report hash and exact pending payload, then repeats the identical finish request. It never obtains another lease or regenerates evidence. Changed immutable content fails closed. A stale lease remains an explicit error, not a fabricated pass. Reports need durable CI artifact retention before scheduling this globally; a local hash proves byte identity, not an independent signature of source truth.

## Checks completed

Eight unit/integration tests cover source/network restrictions, robots rules, blocked/mismatched sources, evidence requirements, no-op default mode, maximum limits, immutable-file conflicts and lost-finish replay without another lease. Tests use mocked RPCs; no production queue status was modified.

Read-only live observations30 September2026:
- Angie’s canonical professional page passed390/1440 DOM checks, opened and closed the real contact checklist and generated a real identity-matching vCard. Evidence `.recovery/logs/quality-readonly-angie-browser.json`.
- Pinned-DNS/robots-respecting HTTP against the official HCLA `/about/` source matched Agapi Mavridis’s own executive component. Evidence `.recovery/logs/quality-readonly-hcla-source.json`.

These isolated observations do not mean the31,168-listing inventory has been checked. No scheduling, production execution, backlog completion or mass data repair is claimed.

### Manual CI (candidate; do not schedule)

`.github/workflows/listing-quality.yml` runs only by dispatch on main. Default execute=false makes no network calls or queue mutations. Execution defaults to three records and rejects more than twenty. Classification uses a sequential request session, at least one second between requests to the same host, at most 100 source requests, and at most 80 cached successful exact URLs per run. Source and robots cache entries are discarded after the run; identities are still checked individually. Reports include cumulative source request/cache/byte counters. Browser subresources are not included in those source counters.

The CI wrapper prefers the existing service key. Otherwise it uses the existing management token only against the fixed project's documented `GET /v1/projects/{ref}/api-keys?reveal=true`, selects an elevated secret/service-role key, masks it immediately, and retains it in process memory. It never prints the management response or headers and never writes credentials to artifacts. Reference: https://supabase.com/docs/reference/api/v1-get-project-api-keys . A missing scope or denied response fails before leases are requested.

Each run uploads `quality-evidence-<run_id>-<attempt>` using immutable v4 artifacts, even on collection failure, with 90-day retention. For a lost finish response, dispatch with the previous run ID and attempt; the downloaded content hash and exact saved payload must match before replay. A resume never leases new work. Expired/changed leases remain explicit failures; do not silently manufacture replacement evidence. Artifacts must be retained longer externally if durable audit retention beyond 90 days is required. No production execution has been performed during development.

Canonical routes are derived from `vercel.json` entity rewrites (excluding aliases), including church, school, vendor and sports. Unknown taxonomy values stay pending rather than linking to invented routes. Generic structured metadata for individual professionals/artists/creators requires `Person`; matching names on Physician/Dentist/Attorney practice metadata are insufficient. Reviewed, identity-scoped association cards remain supported.
