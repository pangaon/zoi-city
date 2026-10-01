# Shared session identity consumer audit — 1 October 2026

## Confirmed defect

`assets/community/session-state.mjs` returns a validated user UUID when available, otherwise a decoded token subject UUID, otherwise `email:<email>` or `session:<raw token>`. Email is not a reliable current actor identity. Two partially restored sessions with different opaque tokens and the same stale email metadata collapse to one identity.

This was reproduced in the actual `createLocalityReader` and actual `mountLocalityControl`, not inferred from missing listeners. Start a private-home read under synthetic session A without a resolved UUID, switch to synthetic token B while stale email remains, dispatch the real auth-change event, then finish A's held response. The reader sees no identity change and accepts A's home as B's current home. Actual DOM at 390/1440 shows `Exploring Account A private home, Canada · Your saved home`.

Reproduction scripts `/tmp/session-identity-locality-repro.mjs` and `/tmp/session-identity-locality-browser.cjs`; results `/tmp/session-identity-locality-repro.json` and `/tmp/session-identity-locality-browser.json`; screenshots `/tmp/session-identity-locality-390.png` and 1440. All identities, tokens, receipts and traffic are synthetic/controlled. This establishes failure under unresolved/partial auth state, not that ordinary atomic UUID-bearing sessions currently cross accounts in production.

## Actual consumers

| Consumer | Current boundary | Required compatibility consideration |
| --- | --- | --- |
| `assets/personalization/locality.mjs` | Nonempty fallback starts private read; equality accepts held response | UUID-only identity makes unresolved session guest; verify no private read or old-home retention, then recovery after UUID resolves |
| `assets/community/experience.mjs` | Shared `assertScope` checks equality only; private and public RPCs share wrapper; pending storage is profile UUID scoped | Empty identity must be rejected for private RPC/accountReady/write continuations; preserve anonymous public feed/comment reads using auth prefer |
| `assets/suite/bizpage.js` | Dynamic helper import; mounted account equality only | Explicit validated actor gate at mount/scope before private home/status reads or save; empty-to-empty equality is not authority |
| `assets/homes/editor.mjs` | Explicit UUID actor/workspace/listing gate before reads and pending store | Preserve normal UUID and JWT-sub UUID resolution; already refuses email/token fallback |
| `assets/events/service-menu.mjs` | Explicit UUID actor before key construction/access | Preserve accepted opaque-session storage-denial behavior and current-session recovery |
| `assets/homes/media-editor.mjs` | Separate local helper returns UUID or empty, not this shared import | Not a consumer of the unsafe fallback; do not patch solely by name resemblance |

Current Community `scopedStore` and home-editor pending storage validate UUIDs; Menu already validates actor before key construction. No current raw bearer-token storage reproduction was found in these consumers. Returning a raw token from a generic identity helper remains an unnecessary exposure risk, but this audit does not label an unobserved storage leak as proven.

## Proposed shared contract

Return only a validated current actor UUID or empty. Keep support for existing valid `auth.load().user_id` and valid token subject resolution; never use email or raw token as an actor. UUID extraction is a client scope fence, not authentication or token signature verification.

Changing the helper alone is insufficient: Community and Bizpage must reject unresolved identity before private reads/queued writes instead of accepting empty equality. Anonymous public browsing must remain available. Gate changes need representative actual consumers, not just helper tests: unresolved→resolved lifecycle, held private response after account change, valid UUID/token refresh, anonymous public feed, Bizpage private load/save, Home editor and Menu recovery. Root owns runtime correction; independent lane owns reproduction/acceptance only.

No runtime files, customer data, sessions or production settings were changed.

## Correction review and independent regressions

Parent implemented UUID-or-empty resolution, stored/JWT conflict rejection, nonempty private scope assertion, Community anonymous fallback for unresolved public reads, and Bizpage early actor/workspace gating. Independent review identified remaining internal-refresh write races in direct Community delete and Bizpage wrappers; parent corrected explicit refresh, scope recheck, then prefer transport, preserving boolean delete semantics.

Independent evidence:
- /tmp/shared-identity-regression.cjs and .json: actual locality DOM at 390/1440, unresolved opaque-token/stale-email states perform zero private reads; resolved UUID with distinct internal profile UUID loads home; unresolved transition clears home; held old response is discarded.
- /tmp/shared-identity-consumers.cjs and .json: actual Community and Bizpage runtime at both widths. Unresolved Community feed uses anonymous transport, private community_me absent even on compose attempt. Bizpage unresolved mount performs zero RPCs and requests sign-in/workspace selection.
- /tmp/shared-identity-queued.mjs: extracted actual Community/Bizpage RPC helpers, controlled paused refresh then account switch. No queued request sent under changed actor. Valid actor succeeds using prefer; boolean feed_delete receipt remains true. This is a helper exercise, not a full rendered mutation journey.
- 14 units passed: community-session-state and locality-personalization.

No live account/provider/customer writes. Residual review note sent parent: locality default read implementation must recheck captured owner after ensureFresh and before private fetch, including account changes without an auth event; existing post-response check already prevents display. Acceptance remains pending this narrow read fence. Editor and service-menu already reject invalid actor UUID before private storage and continue to use the compatible shared contract.

### Final narrow acceptance

Parent corrected the locality default fetch fence by passing the captured owner into perform and comparing it after refresh before reading the token/sending. Independent default-path regression changed from one unintended private fetch to zero. Re-ran all six browser cases and extracted helper tests successfully. Reproducible tests now retained in tests/browser/session-identity/{locality.cjs,consumers.cjs,queued.mjs,refresh.mjs}; README records exact evidence boundaries. No runtime blocker remains in this bounded identity correction. Public anonymous browsing remains available, and internal profile IDs need not equal Auth actor IDs.
