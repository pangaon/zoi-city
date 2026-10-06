# Public experience release candidate — 6 October 2026

The public arrival welcomes people, communities and businesses. Visitors can discover places, enter Community, browse events and explore business tools before choosing an account action. The shared signed-out action says Join Zoi; intentional private workspace access remains protected.

## Included runtime changes

- Home: verified 3000×1996 previous-event concert photography, intentional crop, glass parea card, four public entry paths, keyboard/touch discovery rail and progressive people/business sections. Live extras load on intent. Calendar references distinguish parish schedules and show bounded unavailable/retry states. Native pop-outs contain keyboard focus and restore it on close.
- Social workspace route: useful public choices render immediately without suite modules, authentication or database requests. Optional email entry accepts personal or work addresses, returns to browsing, and rejects obsolete responses after dismissal. Google remains hidden pending real provider verification.
- Business: public benefits and next steps, rounded controls, correct organizer destination.
- Tickets: public event discovery without organizer authentication/config requests; useful featured links during data failures, search/retry, sparse records and current canonical event slugs. Explicit manage=1 retains private organizer operations. Venue drafts are scoped to verified actor and workspace with late response/import fencing; legacy unscoped drafts are not automatically imported.

## Acceptance and limits

Independent public-entry and Tickets audits record exact reviewed code, exercised browser journeys and limits separately. The Home independent reviewer owns the final corrected calendar/dialog evidence. Phone390px and desktop1440px checks include both themes, loading/error/retry, keyboard, account changes and sparse data. Full staged local checks and credential scanning are release gates.

This packet does not complete the full platform recovery ledger in docs/recovery-scope.json. Ownr, four suites, global listing enrichment, maps, native parity, provider integrations and event room polishing remain explicit work. Community copy/UI/user-journey specialist continues the shared design work in a separate candidate. No new payment, live ticket availability, connected external publishing or operational Google OAuth is advertised. Database API PGRST002 recovery remains a separate active incident; a deployed visual shell is not proof of recovered listing data.

## Design basis

Guest-first public entry follows Nielsen Norman Group's Login Walls research: https://www.nngroup.com/articles/login-walls/ . User-controlled keyboard/touch discovery follows W3C's carousel guidance: https://www.w3.org/WAI/tutorials/carousels/ . Prioritizing the visible hero and removing unnecessary early work follows web.dev LCP guidance: https://web.dev/articles/optimize-lcp . These are design references, not measured Zoi conversion gains or a claimed2026 study.

Production commit, deployment state, artifact checks and exercised production evidence will be recorded separately after release. Until then, this is reviewed candidate work only.
