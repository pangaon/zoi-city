-- PROPOSAL: new source-capture adapter over the existing enrichment queue.
-- Does not alter legacy RPC result shapes or create another queue.
create or replace function public.enrich_source_queue_lease(p_limit integer default 3)
returns table(slug text,website text,lease_id text,listing_id uuid,name text,entity_type text,existing_enrich jsonb,owner_managed boolean,owner_workspace_id uuid,source_fingerprint text)
language plpgsql security definer set search_path='' as $fn$
declare r record;l zoi.listings;fingerprint text;
begin
 if p_limit is null or p_limit not between 1 and 3 then raise exception 'invalid_source_capture_limit';end if;
 for r in select * from zoi.enrich_queue_lease(p_limit,30,15) loop
  select * into l from zoi.listings where id=r.listing_id for update;
  fingerprint:=l.profile#>>'{_enrich,lease,fingerprint}';
  if l.id is null or l.profile#>>'{_enrich,lease,id}' is distinct from r.lease_id or l.profile#>>'{_enrich,lease,task}' is distinct from 'enrichment' or l.profile#>>'{_enrich,lease,source_website}' is distinct from r.website or fingerprint is null or fingerprint is distinct from zoi.listing_quality_fingerprint(l) then raise exception 'source_capture_lease_binding_failed';end if;
  return query select r.slug::text,r.website::text,r.lease_id::text,r.listing_id::uuid,r.name::text,r.entity_type::text,r.existing_enrich::jsonb,r.owner_managed::boolean,r.owner_workspace_id::uuid,fingerprint;
 end loop;
end $fn$;
revoke all on function public.enrich_source_queue_lease(integer) from public,anon,authenticated;
grant execute on function public.enrich_source_queue_lease(integer) to service_role;
comment on function public.enrich_source_queue_lease(integer) is 'Capped adapter over the existing enrichment lease; binds source capture to the original stored lease fingerprint. No public access.';
