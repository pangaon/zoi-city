# Workspace rename independent acceptance — 2026-10-01

Independent isolated PostgreSQL run passed all **9 checks** for migration `20261001014658_workspace_rename_owner_authority.sql`: current owner/admin permitted; ordinary member/editor, unrelated actor and anonymous caller refused; legacy creator and profile owner remain permitted; invalid names preserve existing identity. The RPC retains its boolean response and authenticated-only execution grant.

Final actual Settings module controlled-browser harness passed at **390px and 1440px**. Workspace identity is read independently of the AI business name. A committed rename with a lost response is confirmed by authoritative readback with one simulated write. Mismatch stays check-only without resend. Definitive refusal releases the form. Sparse AI settings remain editable; failed reads remain disabled. Account changes fence delayed responses, and permission denial clears private fields.

In a temporary extension of the mounted harness, the exact root-owned `onWorkspaceRenamed` function was extracted from `social/index.html` and exercised with shell DOM/state. Confirmed selected header, avatar/dropdown identity, workspace model and document title update; names render as text/escaped markup. Stale actor and generation callbacks cannot update the shell. This verifies the actual callback in an isolated shell fixture, not a fully authenticated production shell session.

Policy caveat: creator/owner authority is retained independently of membership. A historical creator remains authorized while `created_by_auth` still identifies them. The current `zoi_me` membership-only projection may not expose a membership-less legacy owner in the UI; the test does not claim that edge has a complete discoverable journey.

Unknown rename outcomes have an in-memory check-only fence, not a durable mutation ledger. Readback confirms the current name rather than a unique mutation receipt. No production rename, authentication or private-client writes were performed. Browser and isolated database fixtures closed.
