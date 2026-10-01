# Public sponsor configuration reader — proposal

No schema change performed. Existing public placements RPC requires a current configuration version; ordinary guests need a narrow way to discover it without private operator access.

Propose `public.festival_placement_configuration(p_event uuid,p_configuration text) RETURNS jsonb`, SQL STABLE SECURITY DEFINER with empty search_path, revoke PUBLIC then grant EXECUTE to anon/authenticated. Return `{ok:true,event_id,configuration,configuration_version,server_time}`. Version is integer or null; no workspace ID, applicants, allocation data, contacts, review notes, audit history or owner actor is exposed.

Select from placement scopes joined to listings by event ID and current owner workspace equality. Require event type, published status, nonhidden marketplace, clean/cleared moderation, and front/side configuration. Missing, private, transferred or unconfigured events return the same null revision shape. Arguments may be echoed but do not add facts. Use statement_timestamp for server_time. No mutation, lease or new entitlement.

Client reads this version, then uses the existing `festival_placements_public` with the exact revision. A revision change between reads returns no placements safely; subsequent polling resolves the new version. Use bounded polling/expiry and clear prior creatives on failed eligibility/current scope, with focus preserved. Do not use this reader to infer availability or sponsor approval; the public placement projection retains those checks.

Required real PG checks: anonymous execution works; exact fields only; valid published event returns revision; no configuration gives null; hidden/moderated/unpublished/wrong-workspace transfer all null; changed revision excludes old projection; editor/private roles do not matter to public read. Browser should prove anonymous discovery→approved current artwork→revocation/scope change removes it. Root owns implementation/application.

## Implemented candidate

CLI-created migration `20261001044543_festival_public_placement_configuration.sql` implements the exact individual-configuration contract above. Frozen original placement migration was not changed. `tests/database/festival-public-placement-configuration.integration.mjs` uses isolated real PostgreSQL and the actual prerequisite migrations; seven groups pass covering anonymous/authenticated public read, exact key whitelist, no scope/missing event/invalid config, visibility/moderation/type, ownership transfer, revision read and private table grants. Existing placement backend15groups separately prove nonempty approved projection invalidates after scope revision. No production application performed.
