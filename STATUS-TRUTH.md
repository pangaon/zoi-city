# zoi.city — current state, truthfully (one page)

Snapshot 2026-08-22, post-Wave-0 ("freeze and contain" after the forensic audit:
253 findings, 8 P0 — all 8 P0s closed or materially answered same day).
Sources: docs/BUILD-LOG.md (Aug 21–22 entries), db/SECURITY-MANIFEST.md.

## Live and real (on production, backed by real data)

- **zoi.city front door** — live platform stats from `home_stats`
  (6,367 listings · 1,404 cities · 19 countries), nameday chip, FAQ +
  FAQPage/Organization schema.org, waitlist funnel (`zoi.product_waitlist`).
- **/explore** — rebuilt directory (~19KB, replaced 207KB legacy): live search
  (`explore_search`, verified-first), type/city filters with real `dir_counts`,
  in-page claim flow (`zoi_claim_entity`).
- **/p/:slug** — server-rendered entity pages (api/entity.js) + dynamic
  /sitemap.xml; robots.txt allows all crawlers incl. AI answer engines.
- **/community** — social feed: OTP email sign-in, posts with place-tagging over
  the directory, likes, threaded comments. RLS deny-all tables, guarded RPCs.
- **/tickets** — free ticketing end-to-end: organizer dashboard with real paid
  stats, attendee CSV, code check-in, QR share, .ics confirmations.
- **/social — Zoi Business Suite**: Publish, Audience CRM (contacts/tags/
  namedays/import — live), Email composer + drafts, AI voice profile, Business
  Page editor publishing to `zoi.listings` → live at /p/slug.
- **Backend:** 120 versioned migrations; 95 `zoi` tables, 100% RLS; zero
  anon/authenticated table grants; access only via SECURITY DEFINER RPCs.
  Directory QA error rate ~0.7%.

## Credential-gated (built and deployed; inert until an owner-held key lands)

- **Email sending** — needs RESEND_API_KEY + EMAIL_FROM (no key = de facto kill
  switch; `feature_email` flag must be enforced in `email-send` before any key).
- **AI generation** — needs ANTHROPIC_API_KEY.
- **Social publishing** — OAuth pipeline + minute cron deployed for
  FB/IG/LinkedIn/TikTok/X/YouTube; needs platform dev-app credentials + review.
  UI shows honest "Not yet available" until then.
- **Paid tickets (Stripe)** — checkout/confirm edge fns + idempotent finalize
  live; gated on STRIPE_SECRET_KEY and `payments_live` (default **off**).
  Fail-open path closed server-side: `tickets_reserve` rejects priced types.

Kill switches (`zoi.app_config`): `feature_tickets`, `feature_email`,
`feature_social_publish`, `feature_claims`, `payments_live` — server-enforced.

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
