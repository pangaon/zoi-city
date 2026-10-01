Run `node tests/browser/workspace-invitations/verify.cjs` from the release worktree.

Uses installed Playwright Chromium (override CHROMIUM_EXECUTABLE_PATH) and a temporary localhost server. Exercises actual Settings, team, invitation modules, shared ZoiCore transport and recipient page at390/1440. Supabase HTTP is intercepted; no real invitations, login messages or mutations are sent. Database authority is tested separately by `node tests/database/workspace-invitations.integration.mjs` against temporary PostgreSQL16.
