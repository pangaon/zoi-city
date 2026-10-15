# Finite enrichment controller — candidate, not activated

A single fresh request-only linear main push starts one serialized public-standard-Linux GitHub job. It runs at most12 calls, at least5minutes apart, with an absolute one-hour authorization window. There is no recurring trigger, automatic restart or IO retry. Reruns are refused. A cancelled/crashed job cannot silently resume uncertain work: root must reconcile its admitted/receipt log before any new authorization.

The request expires for first admission within10minutes. Exact reviewed script/workflow hashes, immediate parent and one-file commit are verified against the real GitHub API; the exact workflow/head must have only one run, matching the current run ID/attempt1. The repository must remain public, unarchived, main-default and enabled. Current main request content is rechecked before every call so root can remove/change it to stop subsequent admission. Deleting a request does not undo an already dispatched worker.

Before every call, fixed SELECT-only metadata requires the exact queue/sample function body/owner/ACL/security configuration, exact valid/ready prebuilt index, cron30 suppressed and job10 inactive. The Management API must report zoi-enrich ACTIVE version62. The existing dedicated Vault `enrich_token` is read only into memory, masked, and sent using x-enrich-token. No service key fallback, secret provisioning, net.http_request_queue entry, cron mutation or provider integration is introduced. Authentication and persistence remain the existing hosted worker and canonical lease/apply pipeline.

## Explicit initial budget admission

Root explicitly authorized only this initial finite trial on existing infrastructure. Request fields must exactly pin these ESTIMATES, not metered counters:

- budget_review: conservative_42_requests_63MB_per_run_not_metered_accepted
- budgets_metered: false
- estimated_max_http_requests_per_run:42
- estimated_max_response_bytes_per_run:63000000
- estimated_trial_http_requests:504
- estimated_trial_response_bytes:756000000
- max_invocations:12; worker_version:62

Additional exact fields: schema_version1, fresh UUIDv4 request_id, parent_sha, issued_at/start_before/end_at UTC ISO strings, script_sha256 and workflow_sha256. Root creates ONLY `ops/enrichment-finite-trial-request.json` after the reviewed code is on main, in a new single linear request-only push. No active request file is included in this candidate. start_before must be at most10minutes after issue; end_at at most1hour after issue. Queued late jobs fail closed. Root must not reuse an old request UUID; the immediate previous ID is checked, but this controller does not claim a global historical nonce ledger.

Actual worker request/byte metering and global host admission remain prerequisites before any expansion in volume or concurrency. Existing per-isolate host spacing, source policy/DNS/robots protections and cap3 remain. Wall time does not establish CPU usage. No provider purchase, new plan or compute expansion is authorized by this candidate.

## Results and stop behavior

Before each network dispatch a safe pending admission is logged; after response only bounded numeric canonical receipt/stat fields are logged. Applied results are separate from source-fetch-ok and failed-record results. For example queued3/applied3/stats ok2 and error:invocation_deadline1 is two successful source fetches plus one unresolved failure, never three finished homes. Raw dynamic errors, source URLs, HTML, credentials and private leases are not logged.

Any missing/changed authority, worker/artifact/schema discrepancy, malformed receipt, timeout, transport loss, rejected result, lease rejection, unused lease or stopped-time-budget halts the entire window. An empty current batch stops early without declaring catalogue completion. No exception causes a retry. Remote effects cannot be undone after a lost HTTP response. Canonical leases/receipts and safe logs must be inspected before a fresh authorization. Root must not infer that GitHub succeeded means every record was usefully enriched.

## Root operation and recovery

1. Independent gate/code-first merge. Verify actual Management API can read fixed PREFLIGHT_QUERY in read_only:false execution mode (fixed SELECT only; the actual privileged role is needed for cron/owner checks), and hosted version62 still matches its reviewed bundle. Direct connector metadata is not proof of Management role permissions.
2. Record cron30 exact prior active/schedule state, then suppress it. Keep job10 inactive and unrelated job7/social jobs unchanged. Verify no overlapping in-flight worker from the old cadence; the trial does not create a cross-worker execution lock. Geography source-capture remains a separate lane and shared host pressure must be assessed before admission.
3. Record numeric task/lease/platform baseline and approve the explicit estimated budget above. Root alone creates a fresh request-only main push. Inspect each safe admission/receipt, source outcomes and unused leases. Max36 reservations is not36 successful homes.
4. After completion/cancellation/expiry/failure, remove or invalidate the request. There is deliberately no automatic cron restore, especially after an unknown result. Reconcile admitted attempts and canonical effects first, then root restores only the exact prior cron30 state when safe. Verify absence of later finite dispatch. Do not clear receipts/leases or relabel failures to make totals green.

## Evidence and limitations

16 mocked guard/transport tests pass via `node --test tests/unit/enrichment-finite-trial.test.mjs`; node syntax and git diff whitespace checks pass. Tests prove twelve-call ceilings/spacing, expiry after awaited metadata, public/run/diff/code gates, explicit budget acknowledgement, overlap/schema/worker/cancellation fences, dedicated-token-only behavior, safe error logging, unknown-outcome no-retry and truthful failed-record counts. They do not prove live authentication, actual GitHub scheduling or worker resource use.

Read-only production metadata snapshot: queue/source exact=true, sample exact=true, index ready=true, overlap suppressed=false, dedicated enrich_token metadata rows=1. No secret value, queue payload, source page or private customer data was read; no worker/live mutation was invoked. This proves the present active cron would block admission, not that the controller is operational. Parent owns actual activation and outcome verification.

Official docs checked: [workflow timeout/concurrency](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [public standard runner billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions). Public standard GitHub-hosted runners are free; the real repository-public check guards this assumption. Existing Supabase infrastructure usage remains subject to actual limits and the root-approved finite budget.

Metadata execution follows the actual index-operation role finding: only the fixed PREFLIGHT_QUERY uses Management read_only:false, preserving exact privileged owner/ACL/index/cron checks. This flag does not introduce mutation SQL. The fixed dedicated Vault SELECT remains read_only:true, as used by the existing trusted source scheduler. Neither SQL nor destination URL can be supplied by the activation request.
