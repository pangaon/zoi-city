# Organizer draft and audience role production acceptance

1 October2026, commitfa844a8e4cc74a5611b078516622de861e977c18.
Vercel https://vercel.com/pangaons-projects/zoi-city/7ggDjiKV1nFo9L6hibw17zSQbHoQ. CI36810372110 and quality36810396566 succeeded.

## Exact release and independent checks

Staged tree d9748abe76806dae6e991306ef180e98fade9bfb; clean archive /tmp/zoi-organizer-roles-release-q8c9drso. Full verify:local passed255 node:test files plus2 standalone suites. Root separately reran12 isolated PostgreSQL checks, audience actual-module390/1440 and organizer actual-module390/1440 browser checks. Existing independent SaaS review and organizer reproduction are linked in their dedicated audits. Root inspected phone viewer and inventory screenshots.

Production audience.js SHA2566055bc1f4d4569638408d61a01f8460384f7524262797e42dd3bff91b74be995 and table-inventory-operator.mjs SHA256b1e3f38286b8eca23583c28fc56833a804fd7fef43820d044a9e93db19e0f833 match archive. Actual social and Tickets pages reference20261001-audience-roles and20261001-inventory-draft. Downloaded production modules were then exercised in the same controlled local browser fixtures at390/1440; both pass. This is deployed-code acceptance with controlled transport, not an authenticated customer mutation.

Organizer price/start edits survive setup panel open/close and child identity save; surviving table drafts retained, newly added table remains unpriced/unselected, invalid raw text retained, stale price review invalidated, explicit reload restores server data and actor change clears drafts. No real inventory configuration changed.

Audience viewer read/export remains; owner/admin/editor mutation allowed by database authority, explicit viewer cannot regain rights through legacy ownership. Client hides unauthorized actions, validates real receipt shapes and clears private drafts/replies after account/workspace change. Existing mobile table has contained horizontal scrolling; this is not a full CRM redesign.

## Database rollout

Local CLI migration20261001030747_audience_asset_writer_roles.sql maps to remote ledger20261001032400. SHA2560ce532bb606e7f839030fdd730b4f7a11c9b4d839d853f191d59431044500245. Preflight read actual five writer bodies: replacements preserve every body except assert_ws→assert_audience_asset_write guard substitution. Confirmed production membership foreign key to workspaces and existing consent/read helpers.

Applied once through authorized migration tool. Post-read confirms five writers call new guard; private role/write helpers deny anon and authenticated EXECUTE, have empty search_path; public audience_access denies anon and allows authenticated with empty search_path. Existing mutation wrapper grants unchanged, but each requires current authenticated authority inside its body. Shared read functions were not changed. No customer contacts/assets were read or mutated during acceptance. Both concurrency orderings were tested in disposable PostgreSQL, not by changing live roles.

## Remaining gates

No live organizer-owned event setup, guest invitation delivery, collected payment, audience marketing delivery or physical-device acceptance is established. Actual readiness audit is event-organizer-readiness-2026-10-01.md: ownership, event inventory and provider configuration remain missing. Host uncertain-request recovery and hotel owner catalogue editing are separate active batches.
