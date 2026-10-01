# Workspace team journey

Run `node tests/browser/workspace-team/verify.cjs` from the repository root. Requires installed Playwright Core and Chromium (override `CHROMIUM_EXECUTABLE_PATH`). The local fixture mounts the actual Settings script and dynamically imported team module at 390/1440 px. RPC outcomes are controlled, not production mutations. Screenshots are written to `/tmp/workspace-team-{width}.png`.

For actual SQL execution and concurrency/authorization evidence run `node tests/database/workspace-team.integration.mjs`. It creates and removes an isolated local PostgreSQL 16 cluster; no remote database calls.
