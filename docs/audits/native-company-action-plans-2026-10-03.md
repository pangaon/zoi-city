# Native Company Action Plans acceptance

The existing Company workspace now opens a native guided flow for company record
review, onboarding, contractor engagements and a custom plan. It uses the same
plan model/controller and existing Operations receipt writer as the web journey.
There is no duplicate suite, bulk-write ledger or new provider integration.

Users choose a template, edit up to twelve actions, link a current company contact,
assign verified workspace members and enter device-timezone deadlines. Review
makes no writes. Saving creates an ordinary project, then linked task records,
with current authority and readback verification at each step. Lost responses
require checking/retrying/cancelling the original request. Leaving partial work
requires confirmation; confirmed records remain. Restart preserves only the
nonce recovery reference, not the unsaved private draft.

## Source, rendered and exercised evidence

- Source: CompanyActionPlans.tsx and CompanyWorkspace/Operations entry; exact
  source hashes and platform bundle hashes in evidence/source-and-build.json.
- Rendered: the actual full Expo web application at 390px and 1440px, including
  template, edit, error, partial-save confirmation and saved-record views. No
  horizontal overflow or browser page errors in the exercised cases.
- Journey: 24 controlled-HTTP cases cover ordinary saves, lost project/task
  responses, cancelling a missing request, draft discard/cancel, opening partial
  work, role removal, invalid deadlines, setup retry, failed saved-project read
  and retry, removed assignee, and recovering an existing marker after reload.
- Data: the retained shared controller/writer passes nine isolated PostgreSQL
  groups using reconstructed installed definitions/ACLs and current-session
  hardening; no customer production writes.
- Checks: all 457 native tests pass, TypeScript passes and web/iOS/Android exports
  compile. Thirteen new native tests cover local dates, malformed dates, DST gaps,
  draft immutability and exact scoped Metro resolution.

The lead performed implementation and acceptance because the three specialists
terminated with usage-limit errors. This packet is not independent acceptance.
The native browser CLI was unavailable; compiled-application interaction checks
used the installed Playwright runner.

## Remaining gates

Authenticated production saves, physical-device keyboard/accessibility/lifecycle
checks and distribution remain open. Earlier downloadable preview binaries do
not contain this source. No paid cloud build or store submission was requested.
This change does not complete company formation, legal signature, payroll,
external publishing, all listing families or the full recovery scope.

At 12:06 UTC the three bounded production API reads (search, Signature identity,
Montréal event identity) all timed out after twelve seconds without HTTP status.
These observations are transport timeouts, not fresh schema-cache error receipts.
A PostgreSQL activity snapshot at12:05 had one idle authenticator connection and
no long-running authenticator query; this does not prove public API recovery.
The earlier read-only resource job37120380893 failed: service health400, metrics500,
disk utilization/config200 (~15.2% used, gp3/3000IOPS/8GB/125MiBps). Disk capacity
is not evidence that CPU or the public REST service is healthy. No restart,
resize, permission widening or repeat paid application deployment was performed.
