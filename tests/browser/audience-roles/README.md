# Audience role acceptance

Run `node tests/browser/audience-roles/verify.cjs`. Uses actual audience.js plus
suite CSS, controlled RPC responses and local Chromium at390/1440. Tests viewer
reads/export, hidden mutation controls, editor CRUD/import, role downgrade,
account private cleanup and delayed account/workspace reads. Screenshots are
`/tmp/audience-{viewer,editor}-{390,1440}.png`. No production writes.

Server SQL is checked separately with
`node tests/database/audience-assets-roles.integration.mjs` using disposable local
PostgreSQL16, synthetic actors and matching relevant foreign keys.
