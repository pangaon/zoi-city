# Isolated owner lifecycle acceptance — 1 October 2026

## Candidate and execution

New files only: `tests/browser/home-editor-lifecycle/{verify-lifecycle.mjs,fixture.html,schema.sql,README.md}` and this audit. Run `node tests/browser/home-editor-lifecycle/verify-lifecycle.mjs`; PostgreSQL/Chromium prerequisites and optional executable paths are documented beside it.

Both mounted journeys passed: synthetic restaurant at 1440px and synthetic creator at 390px. A temporary PostgreSQL 16 cluster executes the production design migration's functions under actual isolated authenticated/anonymous roles. The shared browser editor calls a loopback bridge; private preview uses the real `api/home-preview.js` handler with a SQL-backed fetch adapter, and public HTML uses the production restaurant/creator renderers.

## Verified behavior

1. Initial anonymous public design is null.
2. Actual UI saves authored headline as private revision 1; it does not appear in anonymous public projection.
3. UI private preview contains that headline in the real inert renderer output and still does not publish it.
4. Explicit UI publication confirms revision 2; anonymous public design exposes that exact revision and headline.
5. Generated public HTML is opened at the corresponding browser width; the headline is visible without horizontal overflow.
6. A subsequent private save confirms private revision 3 without replacing published revision 2 or exposing its new headline.
7. An unrelated actor is refused private editor read, private preview and publication by the SQL authorization functions.
8. No editor page errors. Browser, loopback server and temporary database are closed; database directory is removed afterward.

No production auth sessions, data mutations, client-content edits, external provider actions or public fixture exposure occurred. Browser external requests and server external fetches are refused.

## Evidence limits

This closes the isolated mounted SQL lifecycle gap, not the live customer publication gap. Base listing schema and `seo_entity` are declared test fixtures, reused in shape from existing isolated design tests. Production `home_entity`, authorization, design mutation, private preview data and public design functions are loaded verbatim from their migration. Current production canonical duplicate SQL, live Supabase JWT/PostgREST, CDN refresh and provider integrations are not covered. The public browser check is server-rendered HTML with JavaScript disabled, not a separate customer-interaction signoff.

Independent specialist review and a separate execution passed for both families, including the private revision 3 assertion and independent cleanup stages. Targeted HTML lint and inline-script parsing passed for this fixture. A whole-worktree HTML lint run also encountered unrelated ignored QA/recovery fixtures; those files were not changed. The evidence limits above remain unchanged. No implementation edits, staging or deployment were performed.
