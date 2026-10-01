# Independent source HTML review — 2026-10-01

Reviewed `source-html.mjs`, `render-capture.mjs`, `source-errors.mjs`, and `reviewed-batch.mjs` in the integration worktree. No production calls, leases or writes were performed in this review.

Independent combined test run: **50 passed, zero failed** (`source-html`, `reviewed-source-html`, `rendered-source`, `quality-collector`).

The capture uses the existing guarded DNS/robots transport and source identity gates; document fetches are limited to 1.5MB and image fetches to 8MB. JPEG/PNG headers are bounded to 20MP before actual sandboxed, offline browser decoding. Only bytes enter the decoder. Source navigation is not executed in that browser. Teardown has a separate bounded grace. Artifacts explicitly identify source HTML with `render:null`; automatic rendered enrichment refuses them.

The reviewed adapter requires official-site scope, immutable report hash, listing/source fingerprint and current prior-machine snapshot binding, plus explicit identity and image approval. Only approved image hashes enter new photo fields; existing useful machine fields and photographs are preserved. Existing database leased-writer owner/source fences remain necessary at application time; the adapter is not a replacement for them.

Disposition: suitable for **one fresh Melanthi capture** against fingerprint `d162ff8739a05071a5e4e7cf5181bb26`. No lease/application approval until the actual immutable image bytes and source facts are reviewed. This is code/local-test acceptance, not evidence that Melanthi has already been enriched or that every source will capture successfully.

## Operations receipt review performed separately

Independent `tests/database/operations-recovery.integration.mjs` run exited zero with **11 PostgreSQL checks passed**. Reviewed migration `20261001010515_operations_mutation_receipts.sql` and `assets/operations/recovery.mjs`: actor/workspace-scoped receipts, current-role checks, serialized nonce execution/cancellation, payload conflict detection, transactionally recorded minimal receipts, nonce-only client persistence, and pre/post asynchronous scope checks. No production migration or write occurred. Mounted Operations UI acceptance remains separate.
