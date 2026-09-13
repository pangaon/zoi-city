# zoi.city — current state, truthfully (one page)

Snapshot 2026-09-13 (Post-Wave 1 & Wave 2 Event OS Sprints & Design System Audit).
Sources: docs/BUILD-LOG.md, docs/OPEN-TODOS-2026-09-12.md, WAVE-2-EVENT-OS-COMPLETION.md.

## Live and real (on production, backed by real data)

- **zoi.city front door** — Streamlined single-search hero above the fold, live platform stats from `home_stats`
  (6,367 listings · 1,404 cities · 19 countries), nameday chip, FAQ + FAQPage/Organization schema.org, waitlist funnel (`zoi.product_waitlist`), 4 canonical ecosystem pillar cards, and Mediterranean Blue CTA system.
- **/explore** — rebuilt directory (~19KB): live search (`explore_search`, verified-first), single focal search bar in hero, type/city/country/sort filters with real `dir_counts`, in-page claim flow (`zoi_claim_entity`).
- **/p/:slug** — server-rendered entity pages (api/entity.js) + dynamic /sitemap.xml; robots.txt allows all crawlers incl. AI answer engines.
- **/e/:slug** — public event pages (e/index.html) for published Event OS events, showing name, date, mode, capacity, description, and direct action handoffs to Zoi Tickets.
- **/community** — social feed: OTP email sign-in, posts with place-tagging over the directory, likes, threaded comments with real-time comment counter and sidebar ranking sync. RLS deny-all tables, guarded RPCs.
- **/tickets** — canonical free ticketing end-to-end: organizer dashboard with real paid stats, attendee CSV, code check-in, QR share, .ics confirmations.
- **/social — Zoi Business Suite**: Publish, Audience CRM (contacts/tags/namedays/import — live), Email composer + drafts, AI voice profile, Business Page editor publishing to `zoi.listings` → live at /p/slug.
- **/apps/event-os** — Workspace Beta operator cockpit: real event creation, event update, floor plan 2D/3D saving/loading, team member invitations, publishing/unpublishing controls, audit log history, and archiving. Fake/demo metrics suppressed for real workspace events.
- **Security & Headers**: COOP, CORP, and report-only CSP headers deployed in `vercel.json` with regression test coverage. All 36 inline script blocks syntax-checked.
- **Backend:** 123 versioned migrations (including 0034 menu catalog, 0035 Event OS schema, and 0036 Event OS hardening & audit log); 100% RLS; zero anon/authenticated table grants; access only via SECURITY DEFINER RPCs with empty `search_path`.

## Credential-gated (built and deployed; inert until an owner-held key lands)

- **Database Deployment** — Migrations 0034–0036 are committed and tested, awaiting `SUPABASE_ACCESS_TOKEN` in GitHub Secrets to execute `supabase db push`.
- **Email sending** — needs RESEND_API_KEY + EMAIL_FROM (no key = de facto kill switch; `feature_email` flag enforced in `email-send`).
- **AI generation** — needs ANTHROPIC_API_KEY.
- **Social publishing** — OAuth pipeline + minute cron deployed for FB/IG/LinkedIn/TikTok/X/YouTube; needs platform dev-app credentials + review.
- **Paid tickets (Stripe)** — checkout/confirm edge fns + idempotent finalize live; gated on STRIPE_SECRET_KEY and `payments_live` (default **off**).

Kill switches (`zoi.app_config`): `feature_tickets`, `feature_email`, `feature_social_publish`, `feature_claims`, `payments_live` — server-enforced.

## Quarantined

- **/explore/app** (legacy 207KB flagship): `noindex,nofollow` + fixed banner
  declaring demo/simulated behaviour, pointing to the real /explore.
  Disposition: rebuild-then-retire (audit P0-2/3 containment).

## Paused, not dropped

- Prototype **Labs** deploys halted mid-stream by the audit freeze: seat-map
  ticketing v14 (/tickets/studio, 8/17 chunks staged), Event OS, Command Center,
  Intelligence, Business/Social Pro. Resume only as clearly-labelled Labs
  surfaces or as input to the canonical rebuild — owner's call.
  (v3 backend — profiles/saves/trending/permalinks/bio pages/media — is live
  and unaffected.)

## Known open gaps (Wave 1–2)

Repo had no manifest/CI/tests/DB source until this scaffold; edge-function
sources and migration SQL not yet repo-committed; email consent ledger +
suppression list (CASL) before any send; Stripe webhook verification proof
before `payments_live` flips.
