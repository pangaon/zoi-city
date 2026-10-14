# Independent unified owner revision review

Reviewer: enrichment specialist, who did not author the migration, preview API, controller or native editor. Review is scoped to the local release worktree. No production mutation, provider call, deployment, message or device test was performed.

## Exercised evidence

`node tests/database/home-revision.integration.mjs` passed **20 isolated PostgreSQL checks**. The runner creates and destroys a temporary cluster, with socket-only PostgreSQL and reduced fixture tables plus the real migration and existing writer functions. It establishes private activation, identical legacy lost-response replay after activation, changed-payload rejection, staged legacy-writer refusal, private content/menu/media storage, saved-revision preview confirmation, atomic publication/history, explicit clears, private restore, baseline conflict/rebase, editor/viewer refusal, transfer privacy, removal of historical-absent fields after restore/save, rollback on an injected media failure exactly one concurrent CAS winner, one simultaneous-publication winner, actual private-preview API rendering backed by isolated SQL, identity/family baseline invalidation, and pre-activation rollback with original definitions/effective ACLs restored. Activated private revisions correctly prevent that rollback. It does not establish production public API projection or a rendered customer journey; the fixture's `seo_entity` is a stub.

`node --test tests/unit/home-preview.test.mjs tests/unit/home-revision.test.mjs mobile/tests/ownerEditorHandoff.test.mjs mobile/tests/businessOwner.test.mjs mobile/tests/businessOwnerAuthority.test.mjs` passed **38 checks**. These exercise sanitized restore/save payloads, exact receipts/scope, the actual preview API with controlled HTTP responses, unsupported-renderer refusal, native writer authority codes, changed-field preservation, account/token fences and the fixed token-free browser handoff. They do not establish physical iOS/Android behavior or production authenticated publication.

Restore removal flags now remain server-owned: the client sends base/profile/optional media, while SQL retains historical `profile_remove` and `media_remove` metadata and removes flags only for explicitly edited fields. The database run exercised restore → save → preview → publish with the historical-absent `about` field remaining removed.

## Source review

The current authorization helper locks the actor, current editing membership and listing before replay or reading private data. New unified writes require exact revisions, exact nonce payloads, current ownership and validated fields; publish additionally requires current owner/admin membership. Revocation and owner transfer are checked before successful-receipt replay. Private tables and old writer entrypoints remain inaccessible directly to authenticated clients.

Preview uses the caller's JWT with a publishable key; no new service secret enters the API or browser handoff. The preview response is private (`no-store`, `Vary: Authorization`), scope/revision is checked before rendering and confirmation, and the editor uses a sandboxed inert iframe. The token binds actor, saved revision, content baseline, renderer and expiry. It is a workflow receipt, not independent visual acceptance: an authenticated authorized owner can call the preview-confirm RPC directly.

The preview reuses hospitality, Avli, church, creator, event, music, health, professional, bakery and restaurant renderers. Society and general public renderers are absent from both preview dispatchers. Activation preflight refuses unsupported homes before changing their editing mode. This remains an explicit family-coverage limitation.

## Rechecked corrections and remaining acceptance

1. **Render identity baseline corrected and independently exercised.** The frozen migration adds `zoi.home_revision_baseline`, binding the existing content version to name, entity type, primary category, slug/canonical path, geography and public visibility. Staged save/preview/confirm/publish use this baseline; legacy content CAS remains compatible. The independent 20-check database run changed name/category after preview, observed confirmation/publication refusal, then explicitly rebased and inspected the changed exact identity/family.
2. **Native music context fencing corrected in source.** `MusicEditor` now keys `MusicForm` by account/workspace/listing/slug, supplies an explicit scope fence and saves through the shared token-wait-fenced `ownerRPC`. The earlier actor-only fence is gone. Shared authority/handoff tests pass; this review does not claim an actual physical-device overlapping music-edit journey.
3. **Production prerequisites confirmed read-only.** All ten checked existing writer/authorization/validator signatures are present in `csebihpaychdkanjjsmz`. The staged column and other new revision schema columns were absent at this check, so this remains pre-release evidence rather than a claim that unified revisions are live.

## Web, iOS and Android shared-pipeline status

| Capability | Web | iOS and Android |
| --- | --- | --- |
| Canonical owner content authority | Existing shared database writers; isolated authorization/CAS exercised | Same shared writers; helper authority tests exercised |
| Unified content + media + design private revision | Implemented; isolated DB and controlled HTTP exercised | Deliberate browser handoff; no native unified editor |
| Save → preview → publish | Shared SQL contract and actual preview API tested in isolation | Staged writer refusal routes to browser; native local text is retained, not transferred/published |
| Source/enrichment precedence and explicit clears | Existing projection/renderer contracts reused; new publication not production-verified here | Shared source policy/helper tests; full staged native public refresh unverified |
| Token/session handling | Caller JWT, no new service secret | Fresh authorization before fixed browser URL; separate browser sign-in, no JWT in URL |
| Family fidelity | Ten existing renderer paths; society/general preview unsupported | Full home composition is a web handoff; individual family native rendering parity not proved |
| Device/live acceptance | No live publication or independent browser journey in this review | Physical iPhone/iPad/Android and distributed-build acceptance remain unverified |

Reviewed local SHA-256 snapshots: migration `3a13fc19a85e8cc873cfa7601f5075f31a7c80afd02f14ee1b4dbaa3e2faebfb`; preview API `7fc4d4011dbc6747070e89d2b75911e2c1edb462f340d88b80e49be308847442`; controller `adea80a555c2953e4d59eb1a7ab353f2d2e12f60d752baef3681346c3dcee7cd`. Changes to these files require rechecking the affected evidence. This artifact is separate from the implementer's delivery note and the QA specialist's browser evidence.
