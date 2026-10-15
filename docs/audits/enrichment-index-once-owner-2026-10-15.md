# Trusted-main one-time concurrent index request

Candidate only. No child network requests to GitHub/Supabase, workflow activation, DB writes, credential reads, deployment or provider calls. No active ops/enrichment-index-once-request.json was created.

The hosted direct-DB operator failed before DB connection because its runtime URL did not match the strict direct-project configuration. It is not weakened or reused here. Root must disable that temporary deployment before this alternative is activated.

## Reviewed workflow, then request-only push

NEW .github/workflows/enrichment-index-once.yml triggers only main push changing the exact ops/enrichment-index-once-request.json path. No schedule, pull request, workflow_dispatch or manual-rerun reliance. Root first merges reviewed workflow/script/tests. Only after that root creates a fresh request as the sole changed file in a single linear main commit. The script verifies real GitHub public-repo metadata and actual compare API before/after/parents/files, not only local input claims. Existing GITHUB_TOKEN and SUPABASE_ACCESS_TOKEN are masked and kept in process memory. Checkout credentials are disabled; standard ubuntu-latest, four-minute timeout, fixed concurrency group, no artifacts/cache.

The request contains exactly these eight fields. Values below must be filled by root after reviewed code is on main; this document is not an activation request:

```json
{
  "schema_version": 1,
  "request_id": "<fresh lowercase UUIDv4>",
  "parent_sha": "<exact current main commit before request-only commit>",
  "issued_at": "<current UTC ISO timestamp ending Z>",
  "expires_at": "<later UTC ISO timestamp, no more than 600 seconds after issue>",
  "script_sha256": "31b781acb789eddf95168ae125eaef6d79c03b0234838697327aa30699cffec2",
  "workflow_sha256": "0b7b80feccc53ef6ed3c0d3a47da7073e6ebb44ad37a8170c037893274cfc07d",
  "sql_sha256": "157a3b9981619a1f488746eb42b9f3f75d093ff2e90e91b352810aa3e0e7a0d7"
}
```

An unchanged/manual rerun is refused. A queue delay beyond request expiry is refused without DDL. Immediate previous request UUID reuse is refused when updating the request file. This is not a global historical nonce ledger: root generates a fresh UUID, GitHub single-run/commit fences and exact-index replay no-op protect ordinary duplicates. If a previous build result is uncertain, inspect actual metadata before any new authorization.

## Fixed API execution, explicit uncertainty

The script sends read_only:true metadata to the existing Management API database/query endpoint. It validates postgres/table authority, exact original function body/owner/ACL/security-definer/search-path, and index existence/validity/readiness/owner/type/definition. Existing exact index returns a no-write success; any invalid/counterfeit index is held for review.

Immediately before write dispatch it rechecks expiry. It then sends exactly one request to /v1/projects/csebihpaychdkanjjsmz/database/query with read_only:false and the fixed single CREATE INDEX CONCURRENTLY statement. No BEGIN, SET, arbitrary parameters, migration endpoint, Vault query, direct DB credential or key extraction. After successful command response it requires matching read-only index verification. Output contains only fixed safe labels, request UUID, booleans and allowlisted SQLSTATE/HTTP status; never response rows or raw messages/tokens. No request retry, alternate DDL, drop or fallback.

[Official Management query contract](https://supabase.com/docs/reference/api/v1-run-a-query) supports query/parameters/read_only. It does not promise top-level concurrent-DDL semantics. Actual execution may still return25001; that must be recorded as an unsuccessful approach, not retried through a weaker path. The API controls its DB session timeout; this script does not widen it or pretend that SET and CREATE could share a top-level single-statement API call. HTTP dispatch is bounded to100s; metadata calls15s. Timeout/disconnect or any unverified result is reconciliation_required. CREATE CONCURRENTLY may leave an invalid artifact on failure; root must inspect separately.

## Acceptance

`node --test tests/unit/enrichment-index-once.test.mjs`:13 mocked guards pass: trusted event/scope/rerun; UUID/parent/expiry/hashes; public repo; actual one-file linear diff; previous UUID refusal; valid-index no-op; metadata drift; exactly one fixed top-level false query; expiry crossed while metadata awaited; unknown outcome/no retry/redaction; safe25001; failed verification; exact trigger/free standard runner configuration. No API top-level behavior has been exercised by this specialist.

Public repo runner billing was verified in existing scheduled-capture evidence: [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions). No new paid provider, larger runner or storage artifact is introduced. No recurring source-capture success or enrichment completion follows from this one-time index operation. Root owns code merge, fresh authorization push, actual outcome/readback and later guarded lease migration.
