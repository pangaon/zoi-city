# Coordinate evidence retention — independent review

1 October 2026. Reviewed the collector and existing extractor in the release worktree; no production calls, provider calls or coordinate writes were made.

Independent execution of `node --test tests/unit/source-coordinates.test.mjs tests/unit/coordinate-audit-retention.test.mjs` passed all 22 tests. Previous independent extractor and source-name-alias audits remain separate evidence; this review does not approve any specific listing identity or geographic position.

The collector retains the exact decoded source text passed to extraction, using a SHA256 filename and report reference. It does not claim to retain original compressed/network bytes. Reports, bounded listing snapshots and supplied identity reviews are separately hashed and linked through an evidence manifest. Exclusive creation reuses byte-identical artifacts and rejects an existing file with different contents. Persistence errors propagate rather than turning into a successful source capture. The snapshot allowlist excludes arbitrary/private row fields. The collector has no coordinate writer or database integration.

The tests cover retained text equality, artifact hashes, private-field exclusion, deterministic identical reruns, existing-artifact corruption refusal and pre-fetch owner rejection. Additional independent probes verified fetch failure retains report/snapshot with null source; an owner_workspace_id-only record is refused without fetching.

One evidence-quality gap was found and corrected: owner_workspace_id-only refusals now retain a derived ownership_gate boolean in evidence metadata without exposing the owner UUID. The database_snapshot hash is also preserved in the allowlist for downstream guarded request preparation. Independently reran the updated 22-test suite and inspected the correction. Accepted for bounded dry-run collection and evidence retention.

Reviewed hashes:

- source-coordinate-audit.mjs: `f27deead145bb4d8aa54521b3337285fa630f64bcbdfaf297db704cb6fa2e5ae`
- source-coordinates.mjs: `3907fe86659f43d3071d8319c5327c0105a0243b909b717578082266385c20a2`
- coordinate-audit-retention.test.mjs: `91cdd68326a6550376cc6875abc5fedb1b02f1d66328770ba400c19b735e9287`
- source-coordinates.test.mjs: `b65bf1dde9bfb5ca2e0cc54076555f7861ccc0d94565efa5294943d99128cb0b`

No renderer, actual production map journey, privileged writer, global coordinate coverage or native client acceptance follows from these local collector checks.
