# Private Recipe Studio release evidence — September 30, 2026

This is a reviewed candidate handoff, not evidence of deployment. The lead owns the release manifest, staging and production acceptance. No paid generation, real publication or customer recipe mutation was performed for this report.

## Backend and shared model

Candidate migration: `supabase/migrations/20260930112800_private_culinary_recipe_studio.sql`. Separate private culinary tables preserve existing automation recipes and business-profile writers. Owner/admin/editor role and current author-listing ownership are required. Save uses version compare-and-swap, actor-bound stable request receipts and same-payload replay; list/get/recovery recheck authorization. All records remain drafts. No public/publish function exists.

`node tests/database/culinary-recipes.integration.mjs` passed nine PostgreSQL groups: unauthenticated/cross-workspace denial; simultaneous nonce retry with one row/receipt; save/get/list and private receipt recovery; stale-version rejection and historical replay; bounded JSON/attribution validation; role revocation; listing transfer; direct grants/publication denial; exact production rollback fixture leaving no added recipe row.

`node --test tests/unit/recipe-model.test.mjs` passed five tests covering immutable scaling and unknown quantities, exact shopping-list selection, invalid recipe/provider data, elapsed timer/pause/resume and device speech capability/no invented commerce fields. Recipe video IDs are syntactically validated, not independently proven playable or owned. No timers or narration run without UI actions.

Production rollback file `ops/verify-private-culinary-recipes.sql` is bounded to existing QA auth user `2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd`, workspace `053a5656-b19b-48a4-8721-65c4674f647c` and listing `48c711ee-e83b-4ce2-a7cc-4126d713048a`. It refuses unless the listing is currently owned by that workspace, hidden and not published. It creates only a private recipe inside BEGIN/ROLLBACK, tests save/retry/recovery/get and privilege boundaries, then rolls everything back. Expected receipts use NULL-safe comparisons. The exact file ran successfully against local QA-shaped rows; production execution remains the lead's responsibility.

## Shared floating preview limits

`assets/studio/floating-panel.mjs` moves the existing preview DOM, preserving its local interaction state instead of cloning it. It supports pointer/keyboard positioning, viewport bounds and returning the view to its original page position. It is an in-page floating panel, not an operating-system window or cross-tab player. State does not survive reload merely because it floats.

The current Recipe Studio intentionally reports that video playback is not connected in its private preview. Floating-panel minimization hides its content; this must not be repurposed for a provider video player without checking visibility requirements and appropriate pause/close behavior. Cooking timers are local elapsed-time helpers, not reliable background alarms. Native floating windows and device acceptance are not claimed. UI/browser acceptance belongs to the independent Studio reviewer; this document does not relabel model/SQL tests as device or production browser proof.

## AI output acceptance fix

Files: `supabase/functions/ai-generate/index.ts` and `tests/unit/ai-generation.test.mjs`. Previously the worker silently filtered unsupported provider blocks and could accept the remaining valid-looking JSON text. The text-only request now requires a nonempty array containing only string text blocks; unsupported/malformed blocks fail before JSON draft acceptance. The existing ledger stores failure and reported usage; retry does not make another paid provider request.

`node --test tests/unit/ai-generation.test.mjs` passed seven tests, including mixed unsupported blocks, empty content, truncated/refused output, valid multi-block text, malformed JSON, disabled/unconfigured provider, exact saved retry and uncertain transport. Local Deno `check supabase/functions/ai-generate/index.ts` passed. Mocked provider responses only: no paid calls or runtime activation.

This gate checks structure and completion, not the truth of claims, brand suitability or factual perfection. User review remains necessary. Primary API behavior reference: [Claude stop reasons](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons).
