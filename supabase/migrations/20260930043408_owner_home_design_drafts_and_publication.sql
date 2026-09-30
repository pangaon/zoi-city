begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table zoi.home_designs(
 listing_id uuid not null references zoi.listings(id),workspace_id uuid not null references zoi.workspaces(id),
 version integer not null default 0,draft jsonb not null,published jsonb,published_version integer,
 updated_at timestamptz not null default clock_timestamp(),primary key(listing_id,workspace_id)
);
create table zoi.home_design_history(
 listing_id uuid not null,workspace_id uuid not null,version integer not null,design jsonb not null,
 actor_id uuid not null references zoi.user_profiles(id),published_at timestamptz not null default clock_timestamp(),
 primary key(listing_id,workspace_id,version),foreign key(listing_id,workspace_id) references zoi.home_designs(listing_id,workspace_id)
);
create table zoi.home_design_requests(
 actor_id uuid not null references zoi.user_profiles(id),request_id uuid not null,payload jsonb not null,receipt jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,request_id)
);
alter table zoi.home_designs enable row level security;
alter table zoi.home_design_history enable row level security;
alter table zoi.home_design_requests enable row level security;
revoke all on zoi.home_designs,zoi.home_design_history,zoi.home_design_requests from public,anon,authenticated;

create function zoi.home_design_default() returns jsonb language sql immutable set search_path='' as $$
 select '{"schema_version":1,"template":"concierge","section_order":["intro","offerings","gallery","calendar","media","socials","contact"],"hidden_sections":[],"copy":{},"item_order":{"offerings":[]}}'::jsonb
$$;
create function zoi.home_design_actor(p_workspace uuid,p_listing uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid;begin
 select p.id into actor from zoi.user_profiles p join zoi.workspace_members m on m.profile_id=p.id
 where p.auth_user_id=auth.uid() and m.workspace_id=p_workspace and m.role in('owner','admin','editor');
 if actor is null then raise exception 'home_design_permission_denied' using errcode='42501';end if;
 perform 1 from zoi.listings where id=p_listing and owner_workspace_id=p_workspace for share;
 if not found then raise exception 'home_design_permission_denied' using errcode='42501';end if;
 return actor;
end $$;
create function zoi.home_design_items(p_workspace uuid,p_listing uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'title',title,'active',active) order by kind,title,id),'[]'::jsonb) from (
 select 'booking:'||s.id::text id,'booking' kind,s.name title,s.active from zoi.booking_services s join zoi.booking_settings b on b.workspace_id=s.workspace_id where b.workspace_id=p_workspace and b.listing_id=p_listing
 union all select 'festival:'||f.id::text,f.kind,f.name,f.active from zoi.festival_packages f where f.workspace_id=p_workspace and f.event_id=p_listing
 union all select 'property:'||p.id::text,'property',p.data->>'title',p.published and not p.source_conflict and p.status='available' from zoi.property_offers p where p.workspace_id=p_workspace and p.host_id=p_listing
 ) items
$$;
create function zoi.home_design_validate(p_design jsonb,p_items jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare allowed text[]:=array['intro','offerings','gallery','calendar','media','socials','contact'];k text;v jsonb;ids text[];item text;begin
 if p_design is null or jsonb_typeof(p_design)<>'object' or octet_length(p_design::text)>30000 then raise exception 'invalid_home_design';end if;
 if exists(select 1 from jsonb_object_keys(p_design) x where x not in('schema_version','template','section_order','hidden_sections','copy','item_order')) then raise exception 'invalid_home_design_field';end if;
 if p_design->'schema_version' is distinct from '1'::jsonb or coalesce(p_design->>'template','') not in('atelier','concierge','table','parea') then raise exception 'invalid_home_template';end if;
 foreach k in array array['section_order','hidden_sections'] loop
  v:=p_design->k;if v is null or jsonb_typeof(v)<>'array' or jsonb_array_length(v)>7 then raise exception 'invalid_home_sections';end if;
  if exists(select 1 from jsonb_array_elements(v) x where jsonb_typeof(x)<>'string') then raise exception 'invalid_home_sections';end if;
  select array_agg(x) into ids from jsonb_array_elements_text(v) x;
  if exists(select 1 from unnest(ids) x where not(x=any(allowed))) or (select count(*)<>count(distinct x) from unnest(ids) x) then raise exception 'invalid_home_sections';end if;
 end loop;
 v:=p_design->'copy';if v is null or jsonb_typeof(v)<>'object' then raise exception 'invalid_home_copy';end if;
 for k,v in select * from jsonb_each(v) loop
  if k not in('headline','intro','offerings_title','gallery_title','calendar_title','media_title','contact_title') or jsonb_typeof(v)<>'string' or length(v#>>'{}')>(case when k='intro' then 2000 else 160 end) then raise exception 'invalid_home_copy';end if;
 end loop;
 v:=p_design->'item_order';if v is null or jsonb_typeof(v)<>'object' or exists(select 1 from jsonb_object_keys(v) x where x<>'offerings') then raise exception 'invalid_home_item_order';end if;
 v:=v->'offerings';if v is null or jsonb_typeof(v)<>'array' or jsonb_array_length(v)>200 then raise exception 'invalid_home_item_order';end if;
 if exists(select 1 from jsonb_array_elements(v) x where jsonb_typeof(x)<>'string') then raise exception 'invalid_home_item_order';end if;
 select array_agg(x) into ids from jsonb_array_elements_text(v) x;
 if (select count(*)<>count(distinct x) from unnest(ids) x) then raise exception 'invalid_home_item_order';end if;
 foreach item in array coalesce(ids,array[]::text[]) loop
  if not exists(select 1 from jsonb_array_elements(p_items) x where x->>'id'=item) then raise exception 'home_offering_no_longer_available';end if;
 end loop;
 return p_design;
end $$;
create function public.home_design_editor(p_workspace uuid,p_listing uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;listing uuid;d zoi.home_designs;homes jsonb;begin
 select p.id into actor from zoi.user_profiles p join zoi.workspace_members m on m.profile_id=p.id where p.auth_user_id=auth.uid() and m.workspace_id=p_workspace and m.role in('owner','admin','editor');
 if actor is null then raise exception 'home_design_permission_denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'slug',l.slug,'entity_type',l.entity_type) order by l.name,l.id),'[]') into homes from zoi.listings l where l.owner_workspace_id=p_workspace;
 listing:=coalesce(p_listing,(homes->0->>'id')::uuid);
 if listing is null then return jsonb_build_object('ok',true,'workspace',p_workspace,'homes',homes,'listing',null);end if;
 perform zoi.home_design_actor(p_workspace,listing);
 select * into d from zoi.home_designs where listing_id=listing and workspace_id=p_workspace;
 return jsonb_build_object('ok',true,'workspace',p_workspace,'homes',homes,'listing',listing,'version',coalesce(d.version,0),'draft',coalesce(d.draft,zoi.home_design_default()),'published',d.published,'published_version',d.published_version,'items',zoi.home_design_items(p_workspace,listing),'history',(select coalesce(jsonb_agg(x order by x.version desc),'[]') from (select version,published_at from zoi.home_design_history where listing_id=listing and workspace_id=p_workspace order by version desc limit 30)x));
end $$;
create function public.home_design_change(p_workspace uuid,p_listing uuid,p_request uuid,p_expected_version integer,p_action text,p_design jsonb default null,p_restore_version integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;payload jsonb;prior zoi.home_design_requests;d zoi.home_designs;value jsonb;receipt jsonb;begin
 actor:=zoi.home_design_actor(p_workspace,p_listing);
 if p_request is null or p_expected_version is null or p_expected_version<0 or p_action is null or p_action not in('save','publish','restore') then raise exception 'invalid_home_request';end if;
 payload:=jsonb_build_object('workspace',p_workspace,'listing',p_listing,'expected_version',p_expected_version,'action',p_action,'design',p_design,'restore_version',p_restore_version);
 -- Serialize all requests by actor so concurrent edits of different homes share one strict budget.
 perform pg_advisory_xact_lock(hashtextextended('home_design_actor:'||actor::text,0));
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_request::text,0));
 select * into prior from zoi.home_design_requests where actor_id=actor and request_id=p_request;
 if found then if prior.payload<>payload then raise exception 'home_request_payload_changed';end if;return prior.receipt;end if;
 if (select count(*) from zoi.home_design_requests where actor_id=actor and created_at>clock_timestamp()-interval '1 minute')>=60 then raise exception 'home_design_rate_limited';end if;
 insert into zoi.home_designs(listing_id,workspace_id,draft) values(p_listing,p_workspace,zoi.home_design_default()) on conflict do nothing;
 select * into d from zoi.home_designs where listing_id=p_listing and workspace_id=p_workspace for update;
 if d.version<>p_expected_version then raise exception 'home_design_version_conflict';end if;
 if p_action='save' then value:=zoi.home_design_validate(p_design,zoi.home_design_items(p_workspace,p_listing));
 elsif p_action='restore' then
  if p_design is not null then raise exception 'invalid_home_request';end if;
  select design into value from zoi.home_design_history where listing_id=p_listing and workspace_id=p_workspace and version=p_restore_version;
  if value is null then raise exception 'home_design_history_unavailable';end if;
  -- Removed operational offers cannot be resurrected by restoring a visual layout.
  value:=jsonb_set(value,'{item_order,offerings}',coalesce((select jsonb_agg(x) from jsonb_array_elements(value#>'{item_order,offerings}') x where exists(select 1 from jsonb_array_elements(zoi.home_design_items(p_workspace,p_listing)) i where i->>'id'=x#>>'{}')),'[]'));
 else if p_design is not null or p_restore_version is not null then raise exception 'invalid_home_request';end if;value:=zoi.home_design_validate(d.draft,zoi.home_design_items(p_workspace,p_listing));end if;
 update zoi.home_designs set draft=value,version=d.version+1,updated_at=clock_timestamp(),published=case when p_action='publish' then value else published end,published_version=case when p_action='publish' then d.version+1 else published_version end where listing_id=p_listing and workspace_id=p_workspace returning * into d;
 if p_action='publish' then insert into zoi.home_design_history(listing_id,workspace_id,version,design,actor_id) values(p_listing,p_workspace,d.version,value,actor);end if;
 receipt:=jsonb_build_object('ok',true,'listing',p_listing,'workspace',p_workspace,'request',p_request,'action',p_action,'version',d.version,'published_version',d.published_version);
 insert into zoi.home_design_requests(actor_id,request_id,payload,receipt) values(actor,p_request,payload,receipt);
 return receipt;
end $$;
create function public.home_design_preview_data(p_workspace uuid,p_listing uuid,p_design jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare entity jsonb;design jsonb;begin
 perform zoi.home_design_actor(p_workspace,p_listing);
 design:=zoi.home_design_validate(p_design,zoi.home_design_items(p_workspace,p_listing));
 select jsonb_build_object('id',l.id,'name',l.name,'slug',l.slug,'canonical_slug',l.slug,'entity_type',l.entity_type,'category_slug',c.slug,'website',l.website,'address',l.address,'city',l.city,'country',l.country,'profile',coalesce(l.profile,'{}'),'publish_status','published','marketplace_status','') into entity from zoi.listings l left join zoi.categories c on c.id=l.primary_category_id where l.id=p_listing and l.owner_workspace_id=p_workspace;
 return jsonb_build_object('ok',true,'listing',p_listing,'workspace',p_workspace,'entity',entity,'design',design);
end $$;
create function public.home_design_public(p_listing uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('ok',true,'listing',p_listing,'version',d.published_version,'design',d.published)
 from zoi.home_designs d join zoi.listings l on l.id=d.listing_id and l.owner_workspace_id=d.workspace_id
 where l.id=p_listing and l.publish_status='published' and l.moderation_status in ('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden' and d.published is not null
$$;
revoke all on function zoi.home_design_default(),zoi.home_design_actor(uuid,uuid),zoi.home_design_items(uuid,uuid),zoi.home_design_validate(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.home_design_editor(uuid,uuid),public.home_design_change(uuid,uuid,uuid,integer,text,jsonb,integer),public.home_design_preview_data(uuid,uuid,jsonb),public.home_design_public(uuid) from public,anon,authenticated;
grant execute on function public.home_design_editor(uuid,uuid),public.home_design_change(uuid,uuid,uuid,integer,text,jsonb,integer),public.home_design_preview_data(uuid,uuid,jsonb) to authenticated;
grant execute on function public.home_design_public(uuid) to anon,authenticated;

-- Canonical public content and its current owner's published design travel in one response.
-- Private drafts/history/workspace identifiers are never included.
create function public.home_entity(p_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare entity jsonb; published jsonb;
begin
 entity:=public.seo_entity(p_slug);
 if entity is null or entity->>'id' is null then return entity;end if;
 if not exists(select 1 from zoi.listings where id=(entity->>'id')::uuid and publish_status='published' and moderation_status in ('clean','cleared') and coalesce(marketplace_status,'')<>'hidden') then return null;end if;
 published:=public.home_design_public((entity->>'id')::uuid);
 return entity||jsonb_build_object('published_design',published);
end $$;
revoke all on function public.home_entity(text) from public,anon,authenticated;
grant execute on function public.home_entity(text) to anon,authenticated;

commit;
