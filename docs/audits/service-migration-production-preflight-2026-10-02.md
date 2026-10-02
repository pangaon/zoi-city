# Service migration production preflight — 2026-10-02

Bounded read-only management queries at 14:37–14:39 UTC succeeded. Latest migration remains 20261001101810 explore_search_selected_types. Service menu receipts, service configurations, service sessions and cash ledger are absent. No migration was applied, service activated, private guest data read, or business data written.

The production function MD5 definitions match the frozen migration guards:

| Function | MD5 |
| --- | --- |
| menu_item_save(uuid,uuid,text,text,integer,text,boolean) | f7e09eb506daaa82420906a154f2d711 |
| kds_ticket_advance(uuid,uuid,text) | 46b60f5be58a8d60b2bcad7da9297e68 |
| kds_tickets_list(uuid,text) | 0a25f6cd62c2cdcf64a3fa660aa44a63 |

menu_items has RLS enabled, zero policies, and no effective anon/authenticated SELECT/INSERT/UPDATE/DELETE table grants or SELECT/INSERT/UPDATE column grants. These observations support guard compatibility; they do not prove long-term backend health or a live service journey. Final UI privacy review, complete ordered packaging, migration readback and production owner/guest capability verification remain gates. Existing organizer ownership/inventory/provider gaps remain documented in event-organizer-readiness-2026-10-01.md.
