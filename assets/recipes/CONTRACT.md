# Recipe competition shared model

`model.mjs` is pure: no network, storage, speech, playback, notifications or commerce side effects. Both designs import it. Test recipes are authored QA fixtures, not public chef recipes.

Recipe fields: `id` stable ASCII identifier; `title`; integer `servings` 1–100; `chef:{name,listing_id:UUID|null}`; `source_url` HTTPS or null; `ingredients:[{id,name,quantity:number|null,unit,note?}]`; `steps:[{id,text,timer_seconds?:1..86400}]`; optional `video:{provider:'youtube'|'vimeo',id}`. Quantities are numeric and units remain authored text; unknown quantity is null, not zero. No automatic unit conversions or inferred cooking times. Arrays are bounded at 100, IDs unique within each array. Renderer must escape all text. Attribution requires an actual source/listing before publication; syntactically valid UUID is not proof of attribution.

Exports:
- `validateRecipe(value)` → normalized recipe, throws invalid data.
- `scaleIngredients(recipe,servings)` → new ingredient rows, preserves null quantities and source input.
- `formatQuantity(number|null)` → display string (empty for null).
- `shoppingList(recipe,servings,selectedIds?)` → newline text. Omit selection for all; empty array means none. This is a list, not a cart, inventory match or order.
- `videoEmbed(video)` → fixed provider HTTPS iframe URL or null. Identifier validation does not verify existence, attribution, permission or playback availability. Load only following explicit user choice, retain provider controls and show a failure/link fallback.
- `createTimer(seconds,now=Date.now())` → `{status:'running',remaining_ms,deadline_ms}`. `timerRemaining(timer,now)` → milliseconds; `pauseTimer`/`resumeTimer` return new states. Renderers own interval cleanup. Background sleep recomputes elapsed wall time; no alarm delivery promise or persistence is provided.
- `speechSupported(globalThis)` → capability boolean only. UI must explicitly start device TTS, provide Stop, cancel its utterance on disposal, and offer readable steps when unsupported. This is narration, not conversational voice assistance.

Both mounts: `mountChefTable({root,recipe,onVideo,onShoppingList})` / `mountKitchenCounter(...)` return cleanup. Optional video callback receives `{recipe,embed,trigger}`; shopping callback receives authored list text (coordinate additional args before use). Selection, checks and timers stay component/device-local; no account persistence claim.

## Persistence decision

`assets/suite/_vertical-forms.js` and `home_content_save` remain unchanged. Their profile allowlist has no `recipes` key. The selected implementation uses the separate private culinary tables and RPCs below, rather than extending business-profile JSON or repurposing automation recipes. Do not bypass either authorization boundary through a legacy writer.

Public recipe publication, moderation, imported-source precedence and public chef discovery remain follow-up work. BuyGreek matching requires actual verified inventory via the existing commerce adapter; no product purchase claims are accepted here. Native can reuse the pure model, but no native recipe screen or device TTS/timer acceptance is claimed.

## Private Studio candidate APIs (not deployed until release verification)

Separate `zoi.culinary_recipes` / `zoi.culinary_recipe_requests` stores; existing automation recipes are untouched. Migration `20260930112800_private_culinary_recipe_studio.sql` does not alter the existing owner writer. Current workspace owner/admin/editor and exact current listing owner workspace are required; viewer/anonymous denied. No publication state or RPC exists.

- `culinary_recipe_list(p_workspace)` → `{ok,workspace_id,recipes:[{id,listing_id,title,version,status:'draft',updated_at}],truncated,listings:[{id,name}]}`. Latest 100 recipes, up to 200 owned listing choices; no guessed chef identity.
- `culinary_recipe_get(p_workspace,p_recipe)` → `{ok,recipe:{id,workspace_id,listing_id,recipe_json,version,status:'draft',created_at,updated_at}}`.
- `culinary_recipe_save(p_workspace,p_recipe,p_listing,p_expected_version,p_request,p_recipe_json)` → `{ok,request_id,recipe}`. Recipe UUID generated once on client; new expected0, each edit requires current version and increments once. JSON id equals recipe UUID, chef listing_id equals selected listing and chef name equals its current exact name. Full validated recipe snapshot; no unknown product/checkout fields.
- `culinary_recipe_receipt(p_workspace,p_request)` → `{ok,found:false}` or `{ok,found:true,receipt}`. Receipt belongs to the authenticated profile, and current role/listing ownership is rechecked. Store only request and scope for reload recovery; do not regenerate a nonce while outcome is uncertain. Identical same-actor request replays original receipt; changed payload rejects request_conflict. Historical replay is not the current recipe version: use get to refresh after recovery.

Limits: 100KB recipe payload, model array/text limits, 200 new request receipts per actor/day, 1,000 recipes/workspace. Errors include not_authorized, listing_unavailable, recipe_unavailable, request_conflict, version_conflict, invalid_* and rate_limited. Membership and author-listing transfer fence writes, reads and receipt recovery. No public discovery, AI generation, source scrape, payment, grocery inventory or notifications is enabled.
