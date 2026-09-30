# Confirmed event artists

Candidate migration `20260930134827_public_event_artists.sql`; not deployed.

`event_artists(p_event UUID)` is a public, read-only RPC:

```json
{"ok":true,"event_id":"event UUID","artists":[],"confirmation":"event_and_artist_workspace"}
```

Each artist row is an **appearance**, not a deduplicated roster:
`id` (appearance UUID), `artist_id`, `event_id`, `artist_name`, `entity_type`
(artist or creator), `slug`, `city`, `country`, `starts_at`, `ends_at`, `timezone`,
`source_url`, `updated_at`. Routes use current entity_type and slug; location is
artist identity context, not a claim about performance location. No portrait,
provider media, private proposal payload, contact, workspace or confirming actor
IDs are projected. Reviewed player/media catalogues may match exact artist IDs;
missing media remains absent.

Only confirmed appearances with both confirmation actors recorded are returned.
Both listings must remain published, nonhidden, clean/cleared and owned by the
workspaces that confirmed them. Event/artist types must remain compatible.
Ongoing appearances are included until their end; ended, withdrawn and pending
appearances are excluded. At most 100 rows sorted by starts_at then ID. Hidden,
unknown, null and empty event inputs return no rows without distinguishing why.
No ticket availability, inventory, payment or exclusive representation is implied.

The same migration tightens existing `artist_shows` moderation, dual confirmation
and type checks while retaining its original response fields and grants. It does
not change `appearance_current` or any private writer. Public callers need no
sign-in; raw appearance/audit tables remain private. Clients should refresh after
foreground return and avoid treating cached appearances as current availability.

Verification: `node tests/database/event-artists.integration.mjs` uses an isolated
PostgreSQL instance, the actual original appearance schema/writers and this
migration. Seven groups check public projection, both-side visibility/transfer,
withdrawal/confirmation/expiry, canonical identity, privileges and bounded order.
The exact `ops/verify-event-artists.sql` rollback fixture is also exercised locally with zero retained generated listing rows. Both public directions are tested for the same security exclusions. No production
mutation or customer data is used. Native event artist UI remains separate work.
