# Independent Company administration acceptance — 2026-10-02

Accepted local existing-Operations extension after two review corrections. No new SQL, production reads/writes or customer sends were used.

The company view follows exact persisted company_id → project_id links and current scoped Operations records. Assignment labels use internal member profile IDs distinct from Auth IDs. Viewer rendering exposes neither document-read nor project-create controls; Documents reads are explicit authorized actions, with returned role, record workspace/project/UUID/version validation. The existing reader's 300 recent-record limit is disclosed; this is not an exhaustive compliance/file inventory. Native company dashboard parity remains open.

Review found the new child document read originally relied only on the parent Operations refresh fence. The final optional child-current callback is checked before refresh, after refresh before transport, and after response. Child/ancestor removal permanently retires it, including reattachment, while replacement contents survive. Review also required explicit pending/busy protection for Back to company; final handler and recovery disable set enforce it. Dirty cancellation preserves edits. Existing mutation CAS and receipt semantics remain reused.

Independent checks on final hashes:
- 13 model/navigation units passed (`/tmp/company-units-independent.log`).
- Actual Social 390/1440 full company legal-details save → linked project → assigned task/lost response → exact recovery → private document upload/version2 → company return/readback → task completion/lost-response recovery. Dirty Back cancellation and pending Back disabled; viewer/invalid routes/current-account clearing passed (`/tmp/company-journey-independent.log`).
- 16 actual Operations held refresh/read cases across actor/workspace/company child/ancestor retirement passed. Retired refresh dispatches zero Documents reads; delayed results cannot restore private titles or retained DOM (`/tmp/company-ownership-independent.log`).
- Phone `/tmp/company-workspace-390.png` visually inspected: company dashboard is before collapsed identity settings, with visible project/task/file actions and honest recent-document wording.

Runtime hashes: Operations `e6af0094b85a8198d8ffe0b009b8f63972d8f25d342fba5726f700783198a39b`; company module `eadaff66086bce049e593f4a9f4e618c6f7eed134165c2b8c012e1edad1e3354`. Navigation whole worktree hash `56e6fec4de5991b371f195a75ea0522e5b8a8bcbe7074d1e7c73a635f1bfa87a` includes unrelated retained service TOOLS work; acceptance applies only to the two company route functions. Root must construct the release without activating unrelated service entries.

Controlled API and upload persistence demonstrate local journeys, not actual production authorization availability, legal filing, customer delivery or live document storage. Root owns exact-index integration, cache parents and deployment checks.
