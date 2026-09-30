# Recipe suite: evidence and bounded design challenge

2026-09-30. Audit/proposal only; no recipe implementation or production mutation.

## Existing capability, precisely

Current `assets`, `api`, Community and native source search found no culinary
recipe editor, recipe catalogue, serving scaler, cooking timers or shopping-list
component. Live schema inspection found `public.recipes` with8rows, but fields
`what_it_does`, `needs`, `connects`, `cost`, `effort` identify operational playbooks,
not food recipes. It must not be relabeled or reused as culinary storage. No
recipe/cooking/shopping RPC names were found in public/zoi schemas.

Reusable working foundations exist: `assets/community/media-catalog-sources.mjs`
contains a reviewed official Argiro video; shared `music-player.mjs` and provider
validation support deliberate floating playback; owner Media & channels has an
authorized versioned writer; chef/creator homes and Community provide identity and
publication context. A video is not a structured recipe, and owner-channel links
are not connected feeds. Existing profile JSON storage can hold bounded authored
recipe drafts through a reviewed field validator, but it currently has no recipe
revision/publication contract. Do not imply arbitrary profile writes solve that.

## Primary-source product patterns

- [Paprika official iOS guide](https://www.paprikaapp.com/help/ios/): serving scaling,
  editable timers, ingredient checking and carrying scaled ingredients into a
  grocery list. Useful pattern: preparation state stays separate from the saved
  original recipe; scaling must not silently rewrite the chef's instructions.
- [Samsung Food shopping-list help](https://support.samsungfood.com/hc/en-us/articles/18369342052372-Getting-Started-with-Samsung-Food-Create-and-Manage-Shopping-Lists):
  whole-recipe ingredient transfer, separate lists and collaboration. Useful pattern:
  ingredient-list management is a complete journey independent of a purchase.
- [Kitchen Stories official app](https://pages.kitchenstories.com/en/app): a focused
  cooking mode with step photographs/instructions, servings conversion and personal
  cookbooks. Its [commerce announcement](https://www.kitchenstories.com/en/stories/from-screen-to-saucepan-shop-your-favorite-recipes-in-one-tap)
  explicitly restricts grocery purchasing to supported German partners. Zoi must
  likewise distinguish a list from a real stock/price/fulfilment integration.

These are interface research, not Zoi integrations or permission to copy third-party
recipe writing, photos, videos or catalogues.

## First complete component: Cook with the chef

Use one owner-authored or explicitly permitted recipe with reviewed chef identity.
Keep the shared player and existing account/workspace authorization. Introduce a
small separately namespaced recipe contract; reuse existing storage infrastructure,
not the unrelated playbook table. Proposed immutable published revisions include:
recipeUUID, ownerworkspace/listing, title, chef credit, optional source URL/permission,
base servings, ordered ingredient IDs with quantity/unit/plain-text note, ordered
step IDs with text/optional authored timer seconds, reviewed image/video references,
and optional regional note plus exact citation. Draft/version/publication are explicit.
Owners edit ingredients, amounts, steps and media; preview the same customer component
and publish only after a matching server receipt. Conflicts retain the unsaved form.

Customer opens recipe → chooses servings → checks ingredients → starts cooking →
navigates steps and optional timers → copies/exports checked shopping list. Floating
video remains attached to the same recipe/chef. Native reuses pure quantity/timer
models and explicitly hands off to web until its screen is tested.

Quantity rules: scale only valid numeric authored quantities from a nonzero base;
leave ranges/free text/“to taste” visibly unchanged, never guess unit conversion.
Use unit-aware grouping only for compatible ingredient IDs/units, not fuzzy text.
Timings and oven temperatures do not automatically scale with servings. Timers use
absolute deadlines with pause/reset and restore elapsed state; do not promise an
alarm after the browser/app is closed without actual notification support.

Optional read-aloud uses user-initiated device speech when available, with stop,
repeat and visible current step. No microphone permission or always-listening claim.
Voice commands/transcription are later scope, separately permission-gated.

## Two competing visual approaches, same real capability

**A — Chef's table.** Cinematic dish/chef image, source identity and large serving
control. Ingredient rail beside one large current step. Video can detach into the
existing compact player; timers sit beside their step. Best for watching and cooking.
On390px the step remains primary and ingredients open a reachable bottom sheet.

**B — Kitchen counter.** Split workspace: checked ingredients, recipe progress and
multiple explicit timers. A compact video dock, expandable chef/regional story and
persistent list action. Best for preparation and shopping. On390px use three clear
tabs (Prepare/Cook/List), preserving state; no cramped desktop grid or giant modal.

Compare both with the SAME approved recipe, not different pictures or fictional
content. Each must complete serving change → list → timer → provider open/close →
resume on390/1440, light/dark, keyboard and reduced motion. Judge tap count, legibility,
state retention and actual task completion, not screenshots alone.

## Bounds, evidence and next implementation decision

First release: one component/model, two layouts, owner draft/edit/publish, one approved
recipe, local clearly labeled cooking progress/shopping list, real provider playback.
Cross-device shopping lists require additive private persistence with account fencing
and version/idempotency checks; do not advertise sync before those exist. Product
links require actual public product IDs; missing matches stay ordinary ingredients.
No fabricated cart, availability, price, nutritional analysis or allergen guarantee.
Regional food-history copy requires a named source; recipe ingredients never prove
universal regional origin, medical suitability or allergy safety.

Required tests: fractional scaling/free-text preservation; immutable original;
multi-timer reload; player recipe identity; owner/admin/editor versus viewer/outsider;
version conflict/lost-save recovery; draft privacy; explicit media clears; account
switch; malicious URLs/text; unknown product links; empty and failed provider states.

Open scope remains: permitted source import, broader chef catalogue, shared household
lists, verified commerce, speech commands, regional-food editorial review and native
parity. None is silently marked delivered by this proposal.
