begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create table zoi.home_media_requests(actor_id uuid not null references zoi.user_profiles(id),request_id uuid not null,listing_id uuid not null references zoi.listings(id),workspace_id uuid not null references zoi.workspaces(id),payload jsonb not null,receipt jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(actor_id,request_id));
create index home_media_requests_listing on zoi.home_media_requests(listing_id,created_at);
alter table zoi.home_media_requests enable row level security;revoke all on zoi.home_media_requests from public,anon,authenticated;
create function zoi.home_media_valid(p_items jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare x jsonb;u text;k text;
begin
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>24 or length(p_items::text)>20000 then return false;end if;
 for x in select value from jsonb_array_elements(p_items) loop
 if jsonb_typeof(x) is distinct from 'object' or (select count(*) from jsonb_object_keys(x))<>4 or not(x?'id' and x?'kind' and x?'url' and x?'label') or coalesce(x->>'id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(x->'label') is distinct from 'string' or length(x->>'label')>100 or btrim(x->>'label')<>x->>'label' then return false;end if;
 u:=x->>'url';k:=x->>'kind';
 if not coalesce((k='video' and (u~'^https://www[.]youtube[.]com/watch[?]v=[A-Za-z0-9_-]{11}$' or u~'^https://www[.]youtube[.]com/playlist[?]list=[A-Za-z0-9_-]{10,80}$')) or (k='audio' and u~'^https://open[.]spotify[.]com/(artist|album|track|playlist|episode|show)/[A-Za-z0-9]{22}$') or (k='link' and (u~'^https://vimeo[.]com/([0-9]{1,20}|[A-Za-z][A-Za-z0-9_-]{1,100})(/[A-Za-z0-9_-]{1,100})?$' or u~'^https://soundcloud[.]com/[A-Za-z0-9_-]{1,100}(/[A-Za-z0-9_-]{1,150})?$' or u~'^https://podcasts[.]apple[.]com/[a-z]{2}/podcast/[A-Za-z0-9%_.-]{1,200}/id[0-9]{1,20}$' or u~'^https://www[.]instagram[.]com/(p|reel)/[A-Za-z0-9_-]{1,100}$' or u~'^https://www[.]tiktok[.]com/@[A-Za-z0-9_.]{1,100}/video/[0-9]{1,30}$')) or (k='channel' and (u~'^https://www[.]youtube[.]com/(@[A-Za-z0-9_.-]{1,100}|channel/[A-Za-z0-9_-]{10,100}|(c|user)/[A-Za-z0-9_.-]{1,100})$' or u~'^https://www[.]instagram[.]com/[A-Za-z0-9_.]{1,50}$' or u~'^https://www[.]facebook[.]com/[A-Za-z0-9.-]{1,100}$' or u~'^https://www[.]tiktok[.]com/@[A-Za-z0-9_.]{1,100}$' or u~'^https://www[.]linkedin[.]com/(in|company)/[A-Za-z0-9_-]{1,100}$' or u~'^https://x[.]com/[A-Za-z0-9_]{1,30}$' or u~'^https://www[.]threads[.]net/@[A-Za-z0-9_.]{1,100}$')),false) then return false;end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_items) as entries(value) group by entries.value->>'id' having count(*)>1) or exists(select 1 from jsonb_array_elements(p_items) as entries(value) group by entries.value->>'url' having count(*)>1) then return false;end if;
 return true;
end $$;
revoke all on function zoi.home_media_valid(jsonb) from public,anon,authenticated;
-- The legacy profile writer must not let a viewer bypass the media editor's role boundary.
create or replace function zoi.bizpage_save_profile(p_workspace uuid,p_listing uuid,p_profile jsonb) returns boolean
language plpgsql security definer set search_path=zoi,public as $$
declare v_clean jsonb;
begin
 perform zoi.assert_ws(p_workspace);
 if not zoi.bizpage_can_edit(p_workspace,p_listing) then raise exception 'not permitted to edit this listing';end if;
 if p_profile is null or jsonb_typeof(p_profile)<>'object' then raise exception 'profile must be a JSON object';end if;
 if pg_column_size(p_profile)>262144 then raise exception 'profile too large (limit 256KB)';end if;
 if p_profile?'owner_media' then
  if coalesce(zoi.org_role(p_workspace),'') not in('owner','admin','editor') then raise exception 'not_authorized' using errcode='42501';end if;
  perform 1 from zoi.listings where id=p_listing and owner_workspace_id=p_workspace for update;if not found then raise exception 'owned_listing_required' using errcode='42501';end if;
  if jsonb_typeof(p_profile->'owner_media') is distinct from 'object' or jsonb_typeof(p_profile#>'{owner_media,version}') is distinct from 'number' or coalesce(p_profile#>>'{owner_media,version}','')!~'^[1-9][0-9]{0,7}$' or not zoi.home_media_valid(p_profile#>'{owner_media,items}') then raise exception 'invalid_media_links';end if;
 end if;
 v_clean:=zoi.profile_strip(p_profile);
 update zoi.listings l set profile=coalesce(l.profile,'{}'::jsonb)||v_clean||jsonb_strip_nulls(jsonb_build_object('_enrich',l.profile->'_enrich','_geo',l.profile->'_geo'))||jsonb_build_object('_meta',jsonb_build_object('updated_at',to_char(now(),'YYYY-MM-DD"T"HH24:MI:SSOF'),'updated_by','owner')),updated_at=now() where l.id=p_listing;
 return found;
end $$;

create function public.home_media_get(p_workspace uuid,p_listing uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare l zoi.listings;m jsonb;
begin
 if coalesce(zoi.org_role(p_workspace),'') not in('owner','admin','editor') then raise exception 'not_authorized' using errcode='42501';end if;
 select * into l from zoi.listings where id=p_listing and owner_workspace_id=p_workspace;if l.id is null then raise exception 'owned_listing_required' using errcode='42501';end if;
 m:=l.profile->'owner_media';
 return jsonb_build_object('ok',true,'workspace_id',p_workspace,'listing_id',l.id,'name',l.name,'media',coalesce(m,'{"version":0,"items":[]}'::jsonb));
end $$;
create function public.home_media_save(p_workspace uuid,p_listing uuid,p_expected_version integer,p_request uuid,p_items jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=zoi.org_actor();l zoi.listings;prior zoi.home_media_requests;payload jsonb:=jsonb_build_object('workspace',p_workspace,'listing',p_listing,'version',p_expected_version,'items',p_items);m jsonb;v int;result jsonb;
begin
 if actor is null or coalesce(zoi.org_role(p_workspace),'') not in('owner','admin','editor') then raise exception 'not_authorized' using errcode='42501';end if;
 if p_request is null then raise exception 'request_id_required';end if;
 perform 1 from zoi.user_profiles where id=actor for update;
 select * into l from zoi.listings where id=p_listing and owner_workspace_id=p_workspace for update;if l.id is null then raise exception 'owned_listing_required' using errcode='42501';end if;
 select * into prior from zoi.home_media_requests where actor_id=actor and request_id=p_request;
 if prior.request_id is not null then if prior.payload is distinct from payload then raise exception 'request_payload_conflict';end if;return prior.receipt;end if;
 if not zoi.home_media_valid(p_items) then raise exception 'invalid_media_links';end if;
 if (select count(*) from zoi.home_media_requests where actor_id=actor and created_at>clock_timestamp()-interval '1 hour')>=60 then raise exception 'media_save_rate_limit';end if;
 if l.profile?'owner_media' then
 if jsonb_typeof(l.profile#>'{owner_media,version}') is distinct from 'number' or coalesce(l.profile#>>'{owner_media,version}','')!~'^[0-9]{1,8}$' then raise exception 'invalid_existing_media_version';end if;v:=(l.profile#>>'{owner_media,version}')::int;
 else v:=0;end if;
 if v is distinct from p_expected_version then raise exception 'version_conflict';end if;
 m:=jsonb_build_object('version',v+1,'items',p_items);
 if zoi.bizpage_save_profile(p_workspace,p_listing,jsonb_build_object('owner_media',m)) is distinct from true then raise exception 'media_save_not_confirmed';end if;
 if (select profile->'owner_media' from zoi.listings where id=p_listing) is distinct from m then raise exception 'media_save_not_confirmed';end if;
 result:=jsonb_build_object('ok',true,'workspace_id',p_workspace,'listing_id',p_listing,'media',m);
 insert into zoi.home_media_requests(actor_id,request_id,listing_id,workspace_id,payload,receipt)values(actor,p_request,p_listing,p_workspace,payload,result);
 return result;
end $$;
revoke all on function public.home_media_get(uuid,uuid),public.home_media_save(uuid,uuid,int,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.home_media_get(uuid,uuid),public.home_media_save(uuid,uuid,int,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
