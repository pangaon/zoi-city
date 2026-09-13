# Open TODOs and Go-Live Gates

Updated 2026-09-12 after the Event OS hardening audit. This is the operational checklist, not a marketing roadmap.

## P0: Before claiming Event OS live

- [ ] Add `SUPABASE_ACCESS_TOKEN` to GitHub Actions secrets.
- [ ] Confirm migrations 0034, 0035, and 0036 applied successfully in Supabase.
- [ ] Re-run `STRICT_EVENT_OS=1 node tests/contract/run.mjs` and require the Event OS REST lockdown checks to return 401/403, not 404.
- [ ] Sign in with a real workspace member and verify: event list, event switch, floor-plan save, reload, team list, team invite, publish, and archive.
- [ ] Confirm Vercel serves the pushed commit and cache-busting URLs return the new Event OS title and assets.
- [ ] Add an authenticated production smoke test for workspace isolation: member of workspace A cannot read or mutate workspace B.

## P1: Canonical Event OS journey

- [x] Add a real Event OS `event_create` form and connect it to `event_create()`.
- [x] Persist Event OS event edits through `event_update()`; settings now save name, time, mode, and capacity server-side.
- [ ] Link owned Event OS events to the canonical `/tickets` event and attendee ledger; do not duplicate reservations or sales. The repo does not contain the Tickets schema/RPC bodies needed for a safe foreign key, so this remains blocked on an explicit backend contract.
- [x] Replace demo dashboard sales, guest, check-in, sponsor, and revenue panels with durable ticketing RPC data or visibly label them as sample/unavailable. Real owned events now show unavailable states and link to Tickets.
- [x] Add event publishing controls that update `is_public`, `published_at`, and a canonical public `/e/:slug` route. Published pages expose metadata only and hand reservations/sales to Tickets.
- [ ] Add durable team invitation delivery and acceptance state; the current RPC records an invite row but does not send email.
- [x] Add archive semantics and compensating migration coverage. Archived events leave normal lists, unpublish, and reject further event mutations.

## P1: Ticketing hardening

- [ ] Apply migration 0034 and verify guest ordering cannot alter server-side price.
- [ ] Keep `payments_live` off until Stripe webhook signature verification, replay protection, and settlement reconciliation are proven.
- [x] Add Event OS audit records for event creation, edits, publication, floor-plan saves, team invitations, and archive actions. Tickets reservation/refund/check-in audit remains pending in its backend contract.
- [ ] Add ticket-tier edit/delete, cancellation/refund, waitlist expiry/promotion, and capacity alerts.
- [ ] Verify offline Door mode conflict handling after reconnect and make the final server result visible.

## P1: Shared production security

- [x] Review Event OS `SECURITY DEFINER` functions for empty `search_path`, membership checks, and least-privilege grants; regression coverage now protects migration 0036. Legacy migration audit remains separate follow-up work.
- [x] Add cross-workspace negative tests for every new workspace RPC.
- [x] Confirm no service-role key, provider secret, or private URL is shipped to browser code (verified by repository scan).
- [x] Add global browser security headers and report-only CSP with regression coverage. Tightening inline-script CSP and auditing every external link remain follow-up work.
- [x] Verify auth expiry, forced re-authentication, sign-out, and permission-denied states on operator routes.
- [x] Add rate limits and abuse monitoring helpers (`checkRateLimit` in `ZoiCore`) for invite, reservation, claim, and email workflows.

## P2: Credential-gated capabilities

- [ ] Configure and test Resend before enabling `feature_email`; include consent ledger and suppression handling.
- [ ] Configure and test Stripe before enabling `payments_live`.
- [ ] Complete provider OAuth credentials/review, token refresh, disconnect/revoke, media upload, retry, and dead-letter monitoring.
- [ ] Configure Anthropic only after AI output review, source attribution, and spend/rate limits are enforced.

## P2: Product consolidation & Design Audit

- [x] Streamline `index.html` main page: eliminate duplicate search bars, organize above-the-fold logic, group offerings into 4 canonical ecosystem pillars, and enforce Mediterranean Blue CTA button branding.
- [x] 20 New User-Journey & Logic Enhancements across Ecosystem:
  1. Floor Plan JSON Export & File Download (`apps/event-os`).
  2. Floor Plan JSON Import modal with File Upload and JSON text parsing (`apps/event-os`).
  3. 1-Click Table Assignment Reset with safety confirmation modal (`apps/event-os`).
  4. Guided Sponsor Logo Upload with requirements guidance, placement (center/top/full), and scale controls (`apps/event-os`).
  5. 2D & 3D Sponsor Logo & Party Name overlay rendering on tables (`apps/event-os`).
  6. Table Renaming, Party Assignment, and Sponsor Deck Builder (`apps/event-os`).
  7. Door Mode audio/sound feedback (synthesized Web Audio beeps for scan/duplicate/error) (`assets/tickets/door.js`).
  8. Ticket Tier Capacity alert indicators and warning badges (`tickets/index.html`).
  9. 1-Click Copy Public Event Link button with toast confirmation (`tickets/index.html`).
  10. Community Feed Live Keyword Filter & Search (`community/index.html`).
  11. Community Feed 1-Click Post Share & Permalink copy (`community/index.html`).
  12. Real-time Comment Counter & Sidebar Ranking sync upon reply submission (`community/index.html`).
  13. Nameday Quick-Wish Auto-Fill prompt button (`community/index.html`).
  14. Random Greek Spot "Surprise Spot" serendipity discovery button (`explore/index.html`).
  15. Active Filter Count badge & "Clear All Filters" button (`explore/index.html`).
  16. "Locate Near Me" Geolocation API integration with permission handling (`explore/map/index.html`).
  17. Vector Map Category Quick Toggles (`explore/map/index.html`).
  18. Social Composer Local Draft Auto-Save indicator & Draft Recovery (`social/index.html`).
  19. Public Event `.ics` Calendar Download generator (`e/index.html`).
  20. High-contrast `:focus-visible` focus rings across theme tokens for WCAG AA compliance (`assets/zoi-theme.css`).
- [x] Keep `/tickets` canonical for owned event operations; label retained Event OS preview areas truthfully until the journey above is complete.
- [x] Retire or quarantine demo-only `/apps/tickets-studio/`, `/apps/business-pro/`, and `/apps/intelligence/` surfaces according to `docs/CONSOLIDATION.md` (all carry top-level `zoi-preview` quarantine banners pointing to canonical live tools).
- [x] Preserve the useful Event OS floor-builder work while removing fabricated metrics and fake success actions.
- [x] Add Greek/English support to canonical Explore before retiring the legacy bilingual surface.
- [x] Wire Community into the Business Suite composer (`assets/suite/composer.js` publishes to `feed_post` with `auth: 'require'`).

## Verification commands

```bash
npm run verify
node tests/pages/run.mjs
node tests/contract/run.mjs
```

Truth status: code changes are pushed, but Event OS database production status remains **blocked until migrations 0034-0036 are confirmed live**.
