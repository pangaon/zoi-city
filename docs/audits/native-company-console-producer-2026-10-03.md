# Native Company administration and reviewed handover

This candidate adds a usable cross-company work queue and selected-company work
filters to the existing native Operations suite. It directly reuses the accepted
web console model, not a second queue implementation. The user can search task,
project or company names, filter all/attention/overdue/upcoming/blocked/unassigned/
completed work, select a current member, open the existing task editor, and
continue to the existing project documents panel. Full local date/time deadlines
replace the selected company's date-only display. An unavailable assigned member
is distinguished from an unassigned task.

Saved-record handover is selected-company only. First the user explicitly reviews
a fresh read of their company, projects, tasks and contacts. Optional private
document metadata requires a fresh editor/admin/owner read, validates workspace
and project scope, and excludes contents. The existing document-list source returns at most 300 recent workspace rows; the selected-company subset is described as recent records and is not a complete document inventory. Confirmation re-reads the same scope
and compares every selected record, owner clear, version and current role. A
changed review is refused. A caller-mutated preview is never emitted: output is
rebuilt from the newly verified response. Browser export is an actual JSON
download. Native sharing uses the installed Expo share and temporary-file APIs,
with cleanup on return, failure, role/dirty-state change and unmount. Contact
payloads never enter durable application caches or recovery markers.

Source evidence: the candidate consumes unchanged company-console-model.mjs,
company-journey.mjs, Operations recovery, the existing SessionClient token and
response fences, documentRpc and DocumentsPanel. No new server writer or schema
change is introduced. The separately frozen Company/document current-session
proposal 2e825 remains a next-release gate; this UI does not imply that proposal
is deployed. Existing database session expiry/lock authority limitations remain
inherited until independently accepted and installed.

Rendered and exercised evidence is retained separately under
`docs/audits/evidence/native-company-console-producer-2026-10-03/`. Actual Expo
phone/desktop screenshots were inspected for layout and readability. The actual
compiled App fixture tests only synthetic records, with all Supabase traffic
intercepted; there are no live writes or private customer record reads.

Final checks: 50 focused units, 421 full native units, strict TypeScript, 18 new
actual browser journeys and 26 retained existing company/document journeys
passed. The existing flow still exercises company → project → assigned task →
lost save/remount receipt → documents/version retry/download → task and project
completion, explicit assignment clears, editor/viewer and account/workspace
switching. All three actual platform exports are retained with bundle/source-map
hashes separately. The native OS adapter's controlled IO tests exercise success,
unavailable share, failed share, scope invalidation at waits/copy/share, changed
source and cleanup. Physical device file lifecycle, OS receiving applications
and app distribution are not accepted by these fixtures.

The initial real Expo bundle failed because the unchanged shared browser model
imports a CDN `?v` suffix. The narrow Metro correction recognizes only that exact
reviewed source edge; negative resolver tests preserve packages, unknown queries,
node_modules and parent traversal. The original failed browser/build evidence is
retained. Initial test fixture date indexing and refresh-identity simulation were
corrected before final tests; current actual SessionClient wait cases are covered.

The React review covers stable component definitions, cleaned interval/AppState
listeners, no render-time private fetches, explicit async current-scope fences,
accessible button labels separate from short visible member names, disabled
draft/recovery transitions and the existing app's spacing/color tokens. No
provider filing, formation, legal advice or document-byte export is claimed.

Release remains with the lead after independent review. No staging, commit,
schema application or deployment was performed by this lane.
