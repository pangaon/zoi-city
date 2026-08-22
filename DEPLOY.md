# zoi.city — deployment pipeline (as it actually is)

Wave 1 · 2026-08-22. This documents the real pipeline, not an aspirational one.

## Frontend (static pages + serverless api/)

- **Source of truth:** GitHub `pangaon/zoi-city`, branch `main`.
- **Hosting:** Vercel, connected to the GitHub repo. **Every push to `main`
  auto-deploys to production** (www.zoi.city). There is no build step — Vercel
  serves the repo root as static files and runs `api/*.js` as serverless functions.
- **Routing:** `vercel.json` rewrites `/p/:slug → /api/entity?slug=:slug` and
  `/sitemap.xml → /api/sitemap`. Everything else is file-path routing.
- **How changes land:** reviewed commits to `main`. Recent history includes an
  agent-driven pipeline (payloads base64-encoded, full-file u16-djb2 hash match
  against a `node --check`-verified local build before shipping — adopted after
  incident c6a82f9 shipped a parse-broken script). With this scaffold merged, the
  gate becomes: CI (`npm run check` + `npm run lint:html` + `npm test`) green on
  the commit before it reaches `main`; prefer PRs for anything touching
  `vercel.json` or file locations.
- **Rollback:** every Vercel deployment is a rollback candidate — use Vercel
  "Instant Rollback" or `git revert` + push (auto-redeploys).

## Database (Supabase, project `csebihpaychdkanjjsmz`)

- **All schema changes go through versioned migrations** (`apply_migration`);
  120+ named migrations recorded in `supabase_migrations.schema_migrations`
  since 2026-06-13 (list: `db/migrations-list.txt`). Migrations are additive;
  rollback is a compensating migration, not a down-script.
- **Authorization model:** `zoi` schema is not PostgREST-exposed; zero table
  grants to `anon`/`authenticated`; 100% RLS on all 95 `zoi` tables; all access
  via SECURITY DEFINER RPCs in `public` guarded by `zoi.assert_ws` /
  `zoi.current_profile`. See `db/SECURITY-MANIFEST.md`.
- **Gap (Wave 1 open item):** migration SQL bodies and a schema-only dump are
  not yet committed to this repo — pull via Supabase CLI from a
  network-capable environment into `supabase/migrations/` + `db/`.

## Edge Functions (Supabase)

Deployed with `supabase functions deploy <name>` (or the management API):
`social-config`, `social-connect`, `social-oauth-callback`, `social-publish`
(minute cron via pg_cron), `email-send`, `ai-generate`, `tickets-checkout`,
`tickets-confirm`. Secrets (RESEND_API_KEY, ANTHROPIC_API_KEY,
STRIPE_SECRET_KEY, platform OAuth creds) are Supabase edge secrets — absence of
a key is a de facto kill switch for that module. **Gap:** sources should be
committed under `supabase/functions/` (see REPO-STRUCTURE.md Phase 1).

## Kill switches (server-side, `zoi.app_config` via `zoi.flag(key)`)

| Flag | Guards | Default |
|---|---|---|
| `feature_tickets` | `tickets_reserve` refuses all reservations when off | off |
| `feature_email` | email sends (to be enforced inside `email-send` before any key lands) | off |
| `feature_social_publish` | social publisher cron | off |
| `feature_claims` | listing claims | off |
| `payments_live` | Stripe checkout; priced tickets additionally hard-reject outside Stripe (`priced_tickets_require_checkout`) | off |

Flipping a flag is a DB update — no deploy needed. `payments_live` stays off
until Stripe webhook signature verification + idempotency are proven.

## Deploy checklist (any change)

1. Run locally: `npm run verify` (check + lint:html + test) — zero-dep, Node ≥ 18.
2. `node --check api/*.js` if serverless functions changed.
3. Commit to a branch, let CI pass; preview-deploy for routing/vercel.json changes.
4. Merge to `main` → Vercel auto-deploys. Verify the live routing contract
   (`/`, `/explore`, `/social`, `/tickets`, `/community`, `/p/:slug`, `/sitemap.xml`).
5. DB changes: versioned migration first, additive, logged in BUILD-LOG.
