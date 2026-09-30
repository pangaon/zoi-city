# Private website report receipt bridge

Candidate, not yet deployed. No paid plan, entitlement, continuous monitoring, ranking guarantee or provider analytics is enabled.

## Actual free scan and save

`seo-site-scan` retains `{ok,mode:'free_test',url,checked_at,checks}` and adds `requested_url`, `save_available` and `save_receipt:{token,expires_at}|null`. The server creates a cryptographically random32-byte token and stores SHA256 only. No raw token, IP or service secret is logged. IP is hashed with a server-key salt only for a private bounded rate budget. Response is private/no-store. Free page results remain available if receipt storage fails; UI offers saving only when the actual receipt exists.

Original public-only URL vetting, redirect vetting,9-second upstream timeout and1.5MB page cap remain. New request input cap4KB,URL cap2048characters, in-memory rate map cap4096clients. Persistent receipt budgets20/client/hour and2000total/hour, report24KB max, two-hour expiry, bounded200 expired receipt cleanup per store. These persistent limits govern receipt storage AFTER fetching, not scans across cold starts. The 20/hour scan limit is per Edge instance; this is not a durable global scan budget. Free measured results can still return with saving unavailable when receipt capacity is reached. This does not claim universal abuse prevention; edge/perimeter limits may be needed at larger scale. Saved owner reports are separate durable private rows; expired transient rows can be deleted without deleting saved reports.

New service-only RPC `intelligence_receipt_store(p_token_hash,p_client_hash,p_report)` accepts server scan evidence. Browser roles cannot call it or write either private table. Existing anonymous `seo_dashboard_fast` is unchanged and never reads these reports.

Authenticated owner/admin APIs:

- `intelligence_report_claim(p_workspace,p_listing,p_token_hash)` -> `{ok,report,already_saved}`. Current membership and actual listing owner_workspace_id checked. Normalized exact website hostname must match scan requested_url (www alias permitted, unrelated subdomains not). Same actor/workspace/listing retry returns the same saved report. Different claims, expired receipts and ownership mismatches fail.
- `intelligence_reports_list(p_workspace,p_listing=null,p_offset=0)` -> `{ok,reports,offset}`; returns up to51 for bounded pagination. UI currently displays latest50 with an explicit label.
- `intelligence_report_get(p_workspace,p_report)` -> `{ok,report}`; actual authenticated workspace read, no direct table grants.

Saved report row `{id,workspace_id,listing_id,saved_by,receipt_id,report,saved_at}`. `report` is the immutable server-produced snapshot. No zero/score is invented from pass counts. Claimed customer data never goes into public `seo_scans`.

## Authentication handoff

`handoff.mjs` stores the short-lived bearer token in same-tab sessionStorage, not URL, localStorage, logs or analytics. On arriving at `/social?intelligence=save`, the report binds to the current auth user. User explicitly chooses a current owned business and clicks Save; no automatic claim into an arbitrary workspace. Wrong account refuses the pending report. Account/workspace changes while awaiting RPC do not hydrate stale results. Save errors retain the token for retry; only an exact successful receipt clears it. Existing login/registration remains the real suite flow.

`/social?intelligence=reports` loads private history in a dismissible panel above the current tool. Workspace selection reloads scope; unrelated tools are preserved. A business must have an actual owned listing with a matching website before saving; a new workspace alone is insufficient. UI explains this and links Business home. Registration is not represented as automatic business verification.

Same-origin free checks in the old Intelligence UI currently remain browser-only previews without save receipts. External website checks use this receipt bridge. No hidden conversion of client-authored evidence into a server audit.

## Verification and rollout

CLI migration `20260930072110_intelligence_private_report_receipts.sql`; SQL source exists in ROOT and RELEASE identically. Thirteen real isolated PostgreSQL checks cover service-only storage, anonymous denial, exact report persistence and retry, cross-workspace privacy, expiry, role revocation, URL-business match, storage caps and malformed reports. Four unit tests cover handoff/account binding/hash transport/failure. Combined SEO+sitemap+bridge suite13passes. Deno checks Edge imports.

Local browser fixture `.recovery/logs/intelligence-save-fixture.html` explicitly uses simulated API receipts: first save loses its response, retry restores same report and clears pending token;390px and1440px have no overflow. Screenshot `/home/codespace/.agent-browser/tmp/screenshots/screenshot-1790753264855.png`. This is not production HTTP acceptance.

Parent must apply SQL, deploy Edge, verify a real private scan→sign-in→claim→history flow and cleanup isolated fixtures, then ship frontend. Do not deploy frontend claiming availability before receipt-enabled Edge is live. Existing frontend remains truthful if backend returns no receipt. Actual billing/entitlement and monitored-site change comparisons remain separate work.

Today uses the latest checked report for each currently owned listing, at most three detail requests and twelve suggestions. Older than seven days asks for a recheck. Unknown checks are not failures. Local browser fixtures at390/1440 verified empty/error cases and stale response after workspace switch; these are not production API evidence. Rollback script ops/qa-intelligence-receipts-rollback.sql passed against the isolated constrained fixture and is ready for parent production review. Public scan errors use fixed actionable classes, never raw network exception text.
