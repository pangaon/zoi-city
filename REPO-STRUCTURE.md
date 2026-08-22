# zoi-city — repository structure (current, target, migration plan)

Wave 1 · 2026-08-22 · repo `pangaon/zoi-city`, deployed by Vercel from `main`.

## Current layout (flat, served from repo root)

```
/
├── index.html                    # front door ("The Greek world runs on Zoi")
├── explore/index.html            # rebuilt directory (canonical)
├── explore/app/                  # QUARANTINED legacy flagship (noindex + demo banner)
├── social/index.html             # Zoi Business Suite
├── tickets/index.html            # Tickets (free live; paid Stripe-gated)
├── community/index.html          # Zoi Community feed (recent; may postdate a given clone)
├── api/entity.js                 # serverless: server-rendered /p/:slug entity pages
├── api/sitemap.js                # serverless: /sitemap.xml
├── vercel.json                   # rewrites: /p/:slug → api/entity, /sitemap.xml → api/sitemap
├── robots.txt
├── googlec15e317567d09e35.html   # Search Console verification stub
└── README.md
```

Vercel serves the **repo root** directly: no framework, no build step, no Output
Directory override. `api/` is picked up by Vercel's serverless-functions convention.
Audit findings this plan answers: no package manifest, no CI, no tests, no
repo-tracked DB source.

## Target layout

```
/
├── site/                    # all static pages (index.html, explore/, social/, tickets/, community/, robots.txt, verification stubs)
├── api/                     # Vercel serverless functions (STAYS at root — Vercel convention)
├── supabase/
│   ├── functions/           # committed sources of deployed Edge Functions
│   │   ├── social-config/ social-connect/ social-oauth-callback/ social-publish/
│   │   ├── email-send/ ai-generate/
│   │   └── tickets-checkout/ tickets-confirm/
│   └── migrations/          # pulled from supabase_migrations.schema_migrations (120+ versioned)
├── db/                      # SECURITY-MANIFEST.md, migrations-list.txt, schema-only dump
├── scripts/                 # zero-dependency verification tooling (this Wave 1 scaffold)
├── tests/unit/              # node:test suites
├── docs/                    # BUILD-LOG.md, DEPLOY.md, STATUS-TRUTH.md, audit/
├── .github/workflows/ci.yml
├── package.json             # name zoi-city, private, no runtime deps
└── vercel.json
```

## Migration plan (never breaks Vercel routing)

The routing contract that must survive every phase: `/`, `/explore`, `/explore/app`,
`/social`, `/tickets`, `/community`, `/p/:slug`, `/sitemap.xml`, `/robots.txt`,
`/googlec15e317567d09e35.html` all keep returning 200 with identical content.

**Phase 0 — additive only (zero routing risk).** Merge this scaffold:
`package.json`, `scripts/`, `tests/`, `.github/workflows/ci.yml`, docs. Vercel
ignores all of it (static hosting serves extra files but nothing links to them;
optionally add `"cleanUrls": false` untouched semantics — no vercel.json change
needed). CI goes green before anything moves.

**Phase 1 — additive backend source (zero routing risk).** Commit `supabase/functions/`
(copies of the deployed Edge Functions) and `supabase/migrations/` (via
`supabase db pull` / migration list export) plus the schema-only dump under `db/`.
These directories are not routable content anyone links to; still, add them to
`.vercelignore` so they are excluded from the static output.

**Phase 2 — move pages into `/site` (the only routing-affecting step).** One atomic
commit that (a) `git mv`s every page/static asset into `site/` and (b) sets in
`vercel.json`: `"outputDirectory": "site"` alongside the existing rewrites.
Decision required, stated explicitly per the two viable modes:
- **Option A (recommended default until a build step exists): keep-root.** Skip
  Phase 2 entirely; repo root remains the served directory. Zero risk, and the
  Phase 0/1 gains (CI, tests, tracked DB source) do not depend on moving files.
- **Option B: `outputDirectory: "site"`.** Do it only via a Preview Deployment
  first: push the branch, click the Vercel preview, verify the full routing
  contract above (including `/p/:slug` and `/sitemap.xml`, which are rewrites to
  `api/` and are unaffected by outputDirectory since `api/` stays at root), then
  merge. Instant rollback = revert the single commit (Vercel redeploys previous
  state) or use Vercel's "Instant Rollback" on the deployment.

**Phase 3 — retire quarantine.** When the canonical `/explore` fully supersedes it,
delete `site/explore/app/` and add a permanent redirect `/explore/app → /explore`
in `vercel.json` so old links never 404.

Rule for every phase: one concern per commit, CI green, preview-deploy verification
before merge for anything that touches `vercel.json` or file locations.
