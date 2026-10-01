# Workspace creation identity and interruption — 2026-10-01

Candidate shared controller; shell integration is root-owned.

Live read-only inspection confirms `zoi_create_workspace(text,text)` creates a fresh workspace and owner membership on every call, returning `{ok,workspace_id,name,kind}`. It has no request nonce or status/cancellation API. The prior shell discarded this receipt and booted with the old saved/URL workspace, so creating another company could return the owner to the previous organization. Enter could also call create again while the button was disabled.

`assets/suite/workspace-creation.mjs` provides a single in-flight gate, actor/mount guard, exact receipt validation and fresh `zoi_me` membership confirmation before `onConfirmed({workspaceId,name,kind})`. A changed name/type or absent membership is not confirmed. Only opaque actor/request/workspace IDs persist; no business name or form content. Storage save/readback failures block dispatch/replacement. A definitive `{ok:false}` releases the attempt; missing or malformed results do not.

The critical limitation is explicit: if the create response loses its workspace ID, listing current same-name workspaces cannot prove which request created one. `check()` returns unconfirmed plus the current authorized list for explicit review. It never automatically sends create again or pretends to cancel it. Durable retry/cancellation requires a future server idempotency wrapper; no such provider/API was invented in this slice. Current native Account uses a browser handoff rather than a second native creation implementation.

Evidence: eleven controller tests and mounted controller/browser-storage fixture at 390/1440. Duplicate event dispatch sends once; remount retains the unresolved marker; same-name membership cannot generate successful navigation. Zero page errors, no outbound provider calls, browser/server closed. This fixture is not actual shell acceptance: root must verify the new workspace becomes selected and stale query/storage cannot override it.

Files: shared module, `tests/unit/workspace-creation.test.mjs`, `tests/browser/workspace-creation/`. No database mutation or deployment performed. Separate setup-indicator gap remains: overview currently does not load/pass authorized home ownership into its setupSteps model, so it cannot truthfully mark business-home setup complete. Keep that open instead of inventing a completion badge.

Independent review found a concurrent-load race before freeze; public load now shares the same busy fence as create/check. A regression holds an older null read and proves no competing load/create can erase a subsequent unknown request. Storage cleanup failure after authoritative membership confirmation preserves successful navigation and marks cleanupPending instead of reporting the creation as failed.
