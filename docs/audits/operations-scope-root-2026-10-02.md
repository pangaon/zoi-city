# Operations private scope — root review, 2026-10-02

Current candidate, not deployed. Runtime SHA-256: `251654a0b030a97af16b10f269a4722117a876b59f6e8c311f02f15bb306a6c1`.

The wrapper explicitly refreshes authentication, rechecks the mounted account and workspace before transport, rejects a false refresh result, and uses the already-refreshed transport. It rechecks scope on return. Mounting requires UUID actor/workspace and agreement with the shared session identity resolver before recovery storage or private RPC access.

Root reran nine Operations/recovery unit cases successfully. Root also reran the actual mounted Operations recovery fixture at 390 and 1440 pixels: lost create response, remount and matching receipt without a duplicate write; transient error preserving the draft; access denial clearing private content; late logout response rejected; held module import unable to replace a subsequent surface. All four browser groups passed with no page errors.

These are controlled local journeys, not live database transactions. The previous ephemeral process and /tmp results were unavailable after environment transition; they were not treated as fresh evidence. Independent actual-Core queued read/write and malformed identity review remains pending. No production deployment or broad SaaS acceptance is claimed.
