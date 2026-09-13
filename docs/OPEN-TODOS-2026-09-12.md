# Open TODOs and Go-Live Gates

Updated 2026-09-12 after the Event OS hardening audit. This is the operational checklist, not a marketing roadmap.

## P0: Before claiming Event OS live

- [ ] Add `SUPABASE_ACCESS_TOKEN` to GitHub Actions secrets.
- [ ] Confirm migrations 0034, 0035, and 0036 applied successfully in Supabase.
- [ ] Re-run `STRICT_EVENT_OS=1 node tests/contract/run.mjs` and require the Event OS REST lockdown checks to return 401/403, not 404.
- [ ] Sign in with a real workspace member and verify: event list, event switch, floor-plan save, reload, team list, and team invite.
- [ ] Confirm Vercel serves the pushed commit and cache-busting URLs return the new Event OS title and assets.
- [ ] Add an authenticated production smoke test for workspace isolation: member of workspace A cannot read or mutate workspace B.

## P1: Canonical Event OS journey

- [x] Add a real Event OS `event_create` form and connect it to `event_create()`.
- [x] Persist Event OS event edits through `event_update()`; settings now save name, time, mode, and capacity server-side.
- [ ] Link owned Event OS events to the canonical `/tickets` event and attendee ledger; do not duplicate reservations or sales. The repo does not contain the Tickets schema/RPC bodies needed for a safe foreign key, so this remains blocked on an explicit backend contract.
- [x] Replace demo dashboard sales, guest, check-in, sponsor, and revenue panels with durable ticketing RPC data or visibly label them as sample/unavailable. Real owned events now show unavailable states and link to Tickets.
- [x] Add event publishing controls that update `is_public`, `published_at`, and a canonical public `/e/:slug` route. Published pages expose metadata only and hand reservations/sales to Tickets.
- [ ] Add durable team invitation delivery and acceptance state; the current RPC records an invite row but does not send email.
- [ ] Add event deletion/archive semantics and compensating migration coverage.

## P1: Ticketing hardening

- [ ] Apply migration 0034 and verify guest ordering cannot alter server-side price.
- [ ] Keep `payments_live` off until Stripe webhook signature verification, replay protection, and settlement reconciliation are proven.
- [ ] Add audit records for reservations, refunds, check-ins, event edits, and team changes.
- [ ] Add ticket-tier edit/delete, cancellation/refund, waitlist expiry/promotion, and capacity alerts.
- [ ] Verify offline Door mode conflict handling after reconnect and make the final server result visible.

## P1: Shared production security

- [ ] Review every `SECURITY DEFINER` function for `SET search_path TO ''`, explicit membership checks, and least-privilege grants.
- [ ] Add cross-workspace negative tests for every new workspace RPC.
- [ ] Confirm no service-role key, provider secret, or private URL is shipped to browser code.
- [ ] Add CSP/security headers and verify external links use appropriate `rel` attributes.
- [ ] Verify auth expiry, forced re-authentication, sign-out, and permission-denied states on operator routes.
- [ ] Add rate limits and abuse monitoring for invite, reservation, claim, and email workflows.

## P2: Credential-gated capabilities

- [ ] Configure and test Resend before enabling `feature_email`; include consent ledger and suppression handling.
- [ ] Configure and test Stripe before enabling `payments_live`.
- [ ] Complete provider OAuth credentials/review, token refresh, disconnect/revoke, media upload, retry, and dead-letter monitoring.
- [ ] Configure Anthropic only after AI output review, source attribution, and spend/rate limits are enforced.

## P2: Product consolidation

- [ ] Keep `/tickets` canonical for owned event operations; label retained Event OS preview areas truthfully until the journey above is complete.
- [ ] Retire or quarantine demo-only `/apps/tickets-studio/`, `/apps/business-pro/`, and `/apps/intelligence/` surfaces according to `docs/CONSOLIDATION.md`.
- [ ] Preserve the useful Event OS floor-builder work while removing fabricated metrics and fake success actions.
- [ ] Add Greek/English support to canonical Explore before retiring the legacy bilingual surface.
- [ ] Wire Community into the Business Suite composer only after approval, moderation, and durable feed contracts exist.

## Verification commands

```bash
npm run verify
node tests/pages/run.mjs
node tests/contract/run.mjs
```

Truth status: code changes are pushed, but Event OS database production status remains **blocked until migrations 0034-0036 are confirmed live**.
