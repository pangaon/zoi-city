# Private AI profile reader — independent bounded review

Reviewed `20261001025711_restrict_private_ai_profile_reader.sql` before application.
Only function metadata was queried in production; no customer profile records or
private field values were fetched.

## Confirmed finding

Live catalog reports public.ai_profile_read_srv(uuid) is SECURITY DEFINER with
search_path=zoi,public. Its SQL returns the full `to_jsonb(a)` from
`zoi.ai_profiles a WHERE workspace_id=p_workspace` without authentication or
workspace membership checks. Effective EXECUTE is true for anon and authenticated.
The observed ACL explicitly grants both roles (as well as service_role and owner);
it is not necessary to rely on a PUBLIC default grant to demonstrate exposure.
No invocation using a customer's workspace ID was performed.

A repository search of assets, API, mobile and Supabase code found no runtime
caller of this helper. This establishes repository compatibility only; untracked
external consumers cannot be excluded.

## Candidate review

The migration atomically revokes privileges from PUBLIC, anon and authenticated,
retains EXECUTE for service_role, and sets search_path to the empty string. The
function's data relation is already schema qualified. PostgreSQL built-in
functions remain resolved through pg_catalog. This is the appropriate narrow
server-only containment for an unauthenticated private-data helper; no function
body or customer data is changed. No blocker identified.

Root owns application and post-application readback. Verify effective anon and
authenticated EXECUTE are false, service_role EXECUTE remains true, and proconfig
shows an empty search_path. This review does not establish that every other
SECURITY DEFINER helper is safe; wider function exposure remains separate work.
