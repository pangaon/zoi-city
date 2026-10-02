# Company administration inside Operations — 2026-10-02

Local candidate only. Existing company records previously exposed identity fields but no company→project start action or unified view of linked work/files. The company editor now puts its administration view first, with existing identity fields inside Company details & settings. It uses persisted company_id and project_id relationships to show active projects, assigned tasks including no deadline, work contacts, and explicitly checked recent private file records. Starting a project preselects the exact company in the existing Operations form. No records are created until that form is saved through the existing CAS/receipt writer.

The durable `/social?workspace=<UUID>#operations/company/<UUID>` route validates an active company in the authorized record response. Project/task records have Back to company workspace; project files retain their existing exact Documents route, writer, upload/version and return behavior. Malformed/missing/archived company intent fails closed with the existing Choose a workspace record recovery action. Route edits are only resolveWorkspaceRoute/moduleRoute; retained service TOOLS work is preserved and must not be accidentally staged with this packet.

Viewer accounts get the operational read view, no document reader or project-create controls. Owner/admin can edit company identity; editor project/task permissions remain those of the existing writer. Assignment uses distinct internal member profile IDs, not Auth UUIDs. Document responses require authorized role, UUID/project/workspace/version validation. The retained documents_list reader returns at most300 recent workspace records; the view deliberately calls them returned recent records and never claims an exhaustive file inventory, compliance readiness or missing-document proof.

Private company child ownership is permanent: actor/workspace/parent or child/ancestor retirement clears captured contents even on reattachment. The parent RPC now accepts an optional child fence checked before refresh, after refresh and after response; this prevents a retired company panel from dispatching Documents reads while its Operations parent remains mounted. Existing Operations calls are unchanged. Dirty company/task forms require confirmation before context navigation; pending/busy recovery explicitly disables new company actions and Back to company. Unresolved mutation references keep existing exact recovery semantics.

## Verification

- `node --test tests/unit/company-workspace.test.mjs tests/unit/workspace-navigation.test.mjs`:13 tests pass; persisted linkage, missing/archived/duplicate/foreign company, private document scope, durable/malformed route and existing navigation.
- `node tests/browser/company-workspace/verify.cjs`: actual Social shell and real registered Operations/Documents modules at390/1440 with controlled API persistence. Save company legal fields→start exact linked project→assign task to distinct internal member profile→lost create response/recover one task→upload document and second version→return/reload/Back/Forward→company file/task readback→complete task with another lost response→pending Back blocked→recover→company completed readback. Dirty Back cancellation retains draft. Viewer has no create/doc controls; invalid company route recovers to authorized records. Existing document draft cancellation tests also run.
- `node tests/browser/company-workspace/ownership.cjs`:16 actual Operations cases at390/1440: held refresh/read followed by actor, workspace, company child or ancestor retirement. Refresh retirement dispatches zero Documents RPC; read retirement renders no private result; retained nodes stay empty and replacement content survives.
- `node tests/browser/organization-workflow/verify.cjs`: prior contact→project→task→Documents full journey still passes390/1440.
- `/tmp/company-workspace-390.png` visually inspected after moving the overview above collapsed settings;1440 screenshot captured. Shared rounded controls and typography retained.

No new SQL, incorporation/filing/legal verification, automatic compliance deadlines, e-signatures, customer messaging, provider payments or live writes. Native retains its existing Operations/project Documents handoff; this new company aggregation/start view is web-only pending native parity. Root owns cache parents, integration and release; independent review pending. Volunteer and native member packets remain frozen and untouched.

## Frozen manifest

- `assets/suite/operations.js` `e6af0094b85a8198d8ffe0b009b8f63972d8f25d342fba5726f700783198a39b`
- `assets/operations/company-workspace.mjs` `eadaff66086bce049e593f4a9f4e618c6f7eed134165c2b8c012e1edad1e3354`
- `assets/suite/workspace-navigation.mjs` `56e6fec4de5991b371f195a75ea0522e5b8a8bcbe7074d1e7c73a635f1bfa87a`
- `tests/unit/company-workspace.test.mjs` `98fec712f9a5628238ab5d80ffdc4af128e1eaa481ecbe4261ca7fce00d32247`
- `tests/browser/company-workspace/verify.cjs` `4e9debaaab1b8b620fb1ebeaeee5826edb201299588c5ee4d144e27a1294254e`
- `tests/browser/company-workspace/ownership.cjs` `2db78e479903c2474890372df267ccbb7bb008b9af20b4257d16a0b3d13764ac`
