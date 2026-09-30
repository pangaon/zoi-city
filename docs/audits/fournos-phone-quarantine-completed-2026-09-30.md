# Fournos branch contact containment — completed 2026-09-30

Scope: exact15 existing Fournos website-root records. Official source inspection by the source specialist found fifteen separate popup contact sections; the first phone+27100277363 belongs to Fourways The View. It was imported into every branch. The exact14-record repair deliberately excludes The View.

Parent deployed worker version41 through CI36702435069 successfully, then executed ops/fournos-phone-quarantine-proposal.sql once. This is a completed one-use operation, not a migration or repeatable cleanup. Snapshot hashes and explicit postconditions enforce unchanged protected base/owner fields and retained source evidence. Do not replay it or relax guards.

Independent read-only verification at10:28UTC:

- 15 records in exact-host cohort.
- 14 no longer have machine fallback phone; all14 retain original phone inside quarantined_contact_evidence.
- The View retains its matching machine and base phone.
- All15 protected base hashes match the pre-repair snapshot; authoritative owner_content remains empty across this cohort.
- Generic Fournos Dunkeld home /business/fournos-bakery-johannesburg returned200, cacheMISS age0. Before10:26:13UTC it rendered three tel:+27100277363 links. After10:28:47UTC it rendered none; wrong number also absent from response text.

Evidence: .recovery/logs/fournos-canonical-before.json, fournos-canonical-after.json, and exact source snapshot fournos-source-scope-audit.json. No new mutation was performed by the independent reviewer.

The worker containment quarantines ambiguous named-branch root crawls; it does not extract corrected branch contacts or establish completeness. Shared brand menus/assets remain available, source evidence remains stored, and existing branch base phones are preserved. Removing the wrong machine fallback also protects existing native clients on subsequent API reads; no new binary build is implied. Full-blast cron remains disabled; next hourly schedule was10:45UTC when reviewed.
