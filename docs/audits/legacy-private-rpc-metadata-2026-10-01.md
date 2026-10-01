# Legacy private RPC metadata review

Scope: public SECURITY DEFINER functions named `*_srv` or containing asset,
audience or contact; follow-up metadata search across profile/workspace/social/
channel/credential/token names. Production inspection queried only function
bodies, effective grants and authorization helper definitions. No customer rows
were read and no business RPC was invoked.

## Confirmed unauthenticated listing writer

`public.zoi_update_contact(text,text,text,text,text,text,text,text)` currently grants
EXECUTE to anon and authenticated. Its SECURITY DEFINER body resolves a listing
by slug, then fills missing address, phone, website, hours, price_range and email;
it also changes geo_precision/last_seen_at. It checks `verification_status <> 
'owner_verified'` but has no actor identity or ownership authorization. The
owner-verified exclusion is not permission checking. This finding is derived from
catalog source; no write was attempted to demonstrate exploitation.

Repository inventory searched assets, api, supabase/functions, mobile, scripts,
tools and then the repository excluding dependencies/recovery/artifacts. No
runtime invocation of zoi_update_contact was found. External trusted enrichment
consumers may exist; the proposed migration retains service_role execution.

Proposed CLI-created migration:
`20261001030054_restrict_unguarded_listing_contact_writer.sql`.
It revokes PUBLIC/anon/authenticated privileges and grants service_role EXECUTE
for exactly this eight-text signature. Body remains unchanged. Existing live
search_path is already empty and zoi.listings is qualified, so no additional
search-path change is needed. Root owns application. Independent review requested.

Post-apply checks: effective anon=false, authenticated=false, service_role=true;
function body unchanged. No blanket grant policy change is proposed.

## Separate findings not bundled

- ai_profile_read_srv(uuid) effective anon/authenticated execution is now false
  and search_path empty, independently confirmed in metadata after root applied
  its dedicated restriction.
- asset_list/save/delete and audience_list/upsert/import/delete call zoi.assert_ws.
  That helper first rejects auth.uid() null, then requires recorded workspace
  creator/owner or any membership. Therefore these are not analogous unguarded
  anonymous readers merely because anon has EXECUTE on their wrappers.
- assert_ws does not distinguish member roles. Asset and audience mutations can
  therefore be performed by any accepted membership, including a viewer. Existing
  audience UI has no role gate in the inspected module. This is a distinct role
  policy issue requiring agreed capability rules and caller coverage, not a reason
  to disable all member RPCs in the narrow emergency migration.
- Pattern search candidates community_profile_get and profile_update delegate to
  community viewer/profile helpers and ensure_profile respectively. Their names
  alone do not establish a bypass. Full helper review remains outside this bounded
  confirmed finding; this audit does not claim every legacy RPC is safe.

Local migration acceptance: a disposable PostgreSQL16 cluster on port15542 was
created with synthetic anon/authenticated/service_role roles and a dummy helper
using the exact eight-text signature. Applying the proposed migration produced
effective EXECUTE false/false/true respectively. Cluster was stopped and deleted.
This validates SQL syntax and ACL behavior without invoking production mutation.

## Production containment verified

Root applied the independently accepted exact migration through the authorized
Supabase migration tool. Local timestamp 20261001030054 maps to remote ledger
20261001030640, name restrict_unguarded_listing_contact_writer. SQL SHA256:
eee3ed83b96de8a6ad222ea65a90fd430007e2e596468667ec1c99d1da8369f6.

Separate post-apply catalog read confirms effective EXECUTE anon=false,
authenticated=false, service_role=true. Function definition MD5 before and after
is bff06b8fa2aee4066e6dcb177caf0e43: body unchanged. No listing rows were mutated
and the function was not invoked. Asset/audience role policy remains a separate
implementation lane, not resolved by this containment.
