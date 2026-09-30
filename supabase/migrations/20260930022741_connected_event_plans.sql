begin;
set local lock_timeout='5s';
-- A reservation exclusively occupies the resource for its slot, including equipment bundles.
alter table zoi.booking_resources drop constraint booking_resources_kind_check,drop constraint booking_resources_capacity_check,drop constraint booking_resources_check;
alter table zoi.booking_resources add constraint booking_resources_kind_check check(kind in('table','staff','venue','performer','equipment')),add constraint booking_resources_capacity_check check(capacity between 1 and 10000),add constraint booking_resources_capacity_semantics check((kind in('staff','performer') and capacity=1) or(kind='table' and capacity between 1 and 50) or kind in('venue','equipment'));
alter table zoi.bookings drop constraint bookings_party_size_check;
alter table zoi.bookings add constraint bookings_party_size_check check(party_size between 1 and 10000);
create or replace function public.booking_item_save(p_workspace uuid,p_kind text,p_id uuid,p_expected_version integer,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s zoi.booking_services;r zoi.booking_resources;item jsonb;
begin
 perform zoi.venue_require_member(p_workspace,true);
 if length(btrim(coalesce(p_data->>'name',''))) not between 1 and 120 or jsonb_typeof(p_data->'active') is distinct from 'boolean' then raise exception 'invalid_booking_item';end if;
 if p_kind='service' then
  if p_data->>'duration_minutes' is null or p_data->>'buffer_minutes' is null or p_data->>'price_cents' is null then raise exception 'invalid_booking_item';end if;
  if p_id is null then
   if p_expected_version is distinct from 0 then raise exception 'version_conflict';end if;
   insert into zoi.booking_services(workspace_id,name,duration_minutes,buffer_minutes,price_cents,active) values(p_workspace,btrim(p_data->>'name'),(p_data->>'duration_minutes')::integer,(p_data->>'buffer_minutes')::integer,(p_data->>'price_cents')::integer,(p_data->>'active')::boolean) returning * into s;
  else
   select * into s from zoi.booking_services where id=p_id and workspace_id=p_workspace for update;
   if s.id is null then raise exception 'booking_item_unavailable';end if;
   if s.version is distinct from p_expected_version then raise exception 'version_conflict';end if;
   update zoi.booking_services set name=btrim(p_data->>'name'),duration_minutes=(p_data->>'duration_minutes')::integer,buffer_minutes=(p_data->>'buffer_minutes')::integer,price_cents=(p_data->>'price_cents')::integer,active=(p_data->>'active')::boolean,version=version+1 where id=s.id returning * into s;
  end if;item:=to_jsonb(s);
 elsif p_kind='resource' then
  if p_data->>'kind' is null or p_data->>'capacity' is null then raise exception 'invalid_booking_item';end if;
  if p_id is null then
   if p_expected_version is distinct from 0 then raise exception 'version_conflict';end if;
   insert into zoi.booking_resources(workspace_id,name,kind,capacity,active) values(p_workspace,btrim(p_data->>'name'),p_data->>'kind',(p_data->>'capacity')::integer,(p_data->>'active')::boolean) returning * into r;
  else
   select * into r from zoi.booking_resources where id=p_id and workspace_id=p_workspace for update;
   if r.id is null then raise exception 'booking_item_unavailable';end if;
   if r.version is distinct from p_expected_version then raise exception 'version_conflict';end if;
   if r.kind is distinct from p_data->>'kind' and exists(select 1 from zoi.booking_slots where resource_id=r.id) then raise exception 'resource_kind_has_history';end if;
   update zoi.booking_resources set name=btrim(p_data->>'name'),kind=p_data->>'kind',capacity=(p_data->>'capacity')::integer,active=(p_data->>'active')::boolean,version=version+1 where id=r.id returning * into r;
  end if;item:=to_jsonb(r);
 else raise exception 'invalid_booking_kind';end if;
 return jsonb_build_object('ok',true,'item',item);
end $$;

create or replace function public.booking_catalog(p_listing uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg zoi.booking_settings;slots jsonb;title text;
begin
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '31 days' then raise exception 'invalid_date_range';end if;
 select b.*,l.name into cfg.workspace_id,cfg.listing_id,cfg.timezone,cfg.currency,cfg.enabled,cfg.version,title from zoi.booking_settings b join zoi.listings l on l.id=b.listing_id where b.listing_id=p_listing and l.owner_workspace_id=b.workspace_id and b.enabled and l.publish_status='published' and coalesce(l.marketplace_status,'')<>'hidden';
 if cfg.workspace_id is null then return jsonb_build_object('ok',true,'available',false,'slots','[]'::jsonb);end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.starts_at),'[]') into slots from (select s.id,s.version,s.service_name,s.resource_name,s.starts_at,s.ends_at,s.capacity,s.price_cents,s.currency,r.kind as resource_kind from zoi.booking_slots s join zoi.booking_services v on v.id=s.service_id join zoi.booking_resources r on r.id=s.resource_id where s.workspace_id=cfg.workspace_id and s.active and v.active and r.active and s.starts_at>=greatest(p_from,clock_timestamp()+interval '5 minutes') and s.starts_at<p_to and not exists(select 1 from zoi.bookings b where b.slot_id=s.id and b.status<>'cancelled') order by s.starts_at limit 500) q;
 return jsonb_build_object('ok',true,'available',true,'name',title,'timezone',cfg.timezone,'currency',cfg.currency,'slots',slots);
end $$;

create or replace function public.booking_reschedule_options(p_booking uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;b zoi.bookings;original zoi.booking_slots;cfg zoi.booking_settings;rows jsonb;more boolean;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;actor:=zoi.ensure_profile();if actor is null then raise exception 'sign_in_required' using errcode='42501';end if;
 select * into b from zoi.bookings where id=p_booking;
 if b.id is null or (b.profile_id<>actor and not exists(select 1 from zoi.workspace_members where workspace_id=b.workspace_id and profile_id=actor and role in ('owner','admin'))) then raise exception 'booking_not_owned' using errcode='42501';end if;
 if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_to<=p_from or p_to-p_from>interval '31 days' then raise exception 'invalid_date_range';end if;
 select * into original from zoi.booking_slots where id=b.slot_id;
 if b.status<>'confirmed' or original.starts_at<=clock_timestamp() then raise exception 'booking_not_reschedulable';end if;
 select * into cfg from zoi.booking_settings where workspace_id=b.workspace_id;
 if not exists(select 1 from zoi.listings where id=cfg.listing_id and owner_workspace_id=b.workspace_id and publish_status='published' and coalesce(marketplace_status,'')<>'hidden') or not cfg.enabled or cfg.workspace_id is null then raise exception 'booking_unavailable';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.starts_at,q.id),'[]') into rows from(
 select s.* from zoi.booking_slots s join zoi.booking_services v on v.id=s.service_id join zoi.booking_resources r on r.id=s.resource_id
 where s.workspace_id=b.workspace_id and s.service_id=original.service_id and s.id<>original.id and s.active and v.active and r.active and s.capacity>=b.party_size and r.kind=(select kind from zoi.booking_resources where id=original.resource_id)
 and s.starts_at>=greatest(p_from,clock_timestamp()+interval '5 minutes') and s.starts_at<p_to
 and not exists(select 1 from zoi.bookings taken where taken.slot_id=s.id and taken.status<>'cancelled')
 order by s.starts_at,s.id limit 201)q;
 more:=jsonb_array_length(rows)>200;if more then rows:=rows-200;end if;
 return jsonb_build_object('ok',true,'booking_id',b.id,'booking_version',b.version,'party_size',b.party_size,'workspace_id',b.workspace_id,'timezone',cfg.timezone,'original',to_jsonb(original),'slots',rows,'truncated',more);
end $$;

create or replace function public.booking_reschedule(p_booking uuid,p_expected_version integer,p_slot uuid,p_expected_slot_version integer,p_request_id uuid,p_expected_price_cents integer,p_expected_currency text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;b zoi.bookings;original zoi.booking_slots;target zoi.booking_slots;prior zoi.booking_reschedules;payload jsonb;v_receipt jsonb;change_id uuid:=gen_random_uuid();before_version integer;source_id uuid;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;actor:=zoi.ensure_profile();if actor is null then raise exception 'sign_in_required' using errcode='42501';end if;
 if p_request_id is null then raise exception 'request_id_required';end if;
 select * into b from zoi.bookings where id=p_booking;
 if b.id is null or (b.profile_id<>actor and not exists(select 1 from zoi.workspace_members where workspace_id=b.workspace_id and profile_id=actor and role in ('owner','admin'))) then raise exception 'booking_not_owned' using errcode='42501';end if;
 payload:=jsonb_build_object('booking',p_booking,'booking_version',p_expected_version,'slot',p_slot,'slot_version',p_expected_slot_version,'price_cents',p_expected_price_cents,'currency',p_expected_currency);
 -- Serialize identical request keys across bookings without changing the existing profile/resource lock order.
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_request_id::text,791));
 select * into prior from zoi.booking_reschedules where actor_profile_id=actor and request_id=p_request_id;
 if prior.id is not null then
  if prior.request_payload is distinct from payload then raise exception 'request_id_conflict';end if;
  return prior.receipt;
 end if;
 source_id:=b.slot_id;
 select * into original from zoi.booking_slots where id=source_id;
 select * into target from zoi.booking_slots where id=p_slot;
 if original.id is null or target.id is null or target.workspace_id<>b.workspace_id or target.service_id<>original.service_id or target.id=original.id then raise exception 'invalid_reschedule_target';end if;
 -- Every writer already takes a resource before its slots/booking. Stable order also protects opposing moves.
 perform 1 from zoi.booking_resources where id in(original.resource_id,target.resource_id) order by id for update;
 perform 1 from zoi.booking_slots where id in(original.id,target.id) order by id for update;
 select * into b from zoi.bookings where id=p_booking for update;
 if b.slot_id is distinct from source_id or b.version is distinct from p_expected_version then raise exception 'version_conflict';end if;
 select * into original from zoi.booking_slots where id=source_id;
 select * into target from zoi.booking_slots where id=p_slot;
 if b.status<>'confirmed' or original.starts_at<=clock_timestamp() then raise exception 'booking_not_reschedulable';end if;
 if target.workspace_id<>b.workspace_id or target.service_id<>original.service_id or not target.active or target.starts_at<=clock_timestamp()+interval '5 minutes' then raise exception 'slot_unavailable';end if;
 if target.version is distinct from p_expected_slot_version then raise exception 'slot_version_conflict';end if;
 if (select kind from zoi.booking_resources where id=target.resource_id) is distinct from (select kind from zoi.booking_resources where id=original.resource_id) then raise exception 'invalid_reschedule_target';end if;
 if target.price_cents is distinct from p_expected_price_cents or target.currency is distinct from p_expected_currency then raise exception 'booking_price_changed';end if;
 if b.party_size>target.capacity then raise exception 'party_exceeds_capacity';end if;
 if not exists(select 1 from zoi.booking_settings c join zoi.listings l on l.id=c.listing_id where c.workspace_id=b.workspace_id and c.enabled and l.owner_workspace_id=c.workspace_id and l.publish_status='published' and coalesce(l.marketplace_status,'')<>'hidden') or not exists(select 1 from zoi.booking_services where id=target.service_id and active) or not exists(select 1 from zoi.booking_resources where id=target.resource_id and active) then raise exception 'booking_unavailable';end if;
 if exists(select 1 from zoi.bookings where slot_id=target.id and status<>'cancelled') then raise exception 'slot_unavailable';end if;
 before_version:=b.version;
 update zoi.bookings set slot_id=target.id,version=version+1,updated_at=clock_timestamp() where id=b.id returning * into b;
 v_receipt:=jsonb_build_object('ok',true,'booking',to_jsonb(b),'reschedule_id',change_id,'from_slot_id',original.id,'to_slot_id',target.id,'old_slot',to_jsonb(original),'new_slot',to_jsonb(target),'payment_collected',false);
 insert into zoi.booking_reschedules(id,workspace_id,booking_id,actor_profile_id,request_id,request_payload,from_slot_id,to_slot_id,before_version,after_version,old_slot,new_slot,receipt)
 values(change_id,b.workspace_id,b.id,actor,p_request_id,payload,original.id,target.id,before_version,b.version,to_jsonb(original),to_jsonb(target),v_receipt);
 return v_receipt;
end $$;

create table zoi.event_plans(id uuid primary key default gen_random_uuid(),profile_id uuid not null references zoi.user_profiles(id),data jsonb not null,status text not null default 'draft' check(status in('draft','confirmed')),version integer not null default 1,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp());
create index event_plans_customer on zoi.event_plans(profile_id,created_at desc,id);
create table zoi.event_plan_requests(id uuid primary key default gen_random_uuid(),profile_id uuid not null references zoi.user_profiles(id),request_id uuid not null,operation text not null,payload jsonb not null,receipt jsonb not null,created_at timestamptz not null default clock_timestamp(),unique(profile_id,request_id));
create table zoi.event_plan_bookings(plan_id uuid not null references zoi.event_plans(id),booking_id uuid not null unique references zoi.bookings(id),role text not null check(length(role)<=80),shared_context text not null default '' check(length(shared_context)<=2000),reviewed_slot jsonb not null,primary key(plan_id,booking_id));
alter table zoi.event_plans enable row level security;
alter table zoi.event_plan_requests enable row level security;
alter table zoi.event_plan_bookings enable row level security;
revoke all on zoi.event_plans,zoi.event_plan_requests,zoi.event_plan_bookings from public,anon,authenticated;

create function public.event_plan_capabilities() returns jsonb language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;return jsonb_build_object('ok',true,'version',1,'resource_kinds',jsonb_build_array('staff','table','venue','performer','equipment'));end $$;

create function public.event_plan_catalog(p_listing uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg zoi.booking_settings;title text;rows jsonb;truncated boolean;
begin
 if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_to<=p_from or p_to-p_from>interval '31 days' or p_from>clock_timestamp()+interval '8760 hours' then raise exception 'invalid_date_range';end if;
 select c.* into cfg from zoi.booking_settings c join zoi.listings l on l.id=c.listing_id where c.listing_id=p_listing and c.enabled and l.owner_workspace_id=c.workspace_id and l.publish_status='published' and coalesce(l.marketplace_status,'')<>'hidden';
 if cfg.workspace_id is null then return jsonb_build_object('ok',true,'available',false,'listing_id',p_listing,'slots','[]'::jsonb,'truncated',false);end if;
 select name into title from zoi.listings where id=p_listing;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.starts_at,q.id),'[]') into rows from(select s.id,s.workspace_id,s.service_id,s.resource_id,s.version,s.service_name,s.resource_name,s.starts_at,s.ends_at,s.blocked_until,s.capacity,s.price_cents,s.currency,r.kind as resource_kind from zoi.booking_slots s join zoi.booking_services v on v.id=s.service_id and v.workspace_id=s.workspace_id join zoi.booking_resources r on r.id=s.resource_id and r.workspace_id=s.workspace_id where s.workspace_id=cfg.workspace_id and s.active and v.active and r.active and s.starts_at>=greatest(p_from,clock_timestamp()+interval '5 minutes') and s.starts_at<p_to and s.starts_at<=clock_timestamp()+interval '8760 hours' and not exists(select 1 from zoi.bookings b where b.slot_id=s.id and b.status<>'cancelled') order by s.starts_at,s.id limit 201)q;
 truncated:=jsonb_array_length(rows)>200;if truncated then rows:=rows-200;end if;
 return jsonb_build_object('ok',true,'available',true,'listing_id',p_listing,'workspace_id',cfg.workspace_id,'name',title,'timezone',cfg.timezone,'settings_version',cfg.version,'slots',rows,'truncated',truncated);
end $$;

create function zoi.event_plan_validate(p_data jsonb) returns void language plpgsql set search_path='' as $$
declare x jsonb;
begin
 if jsonb_typeof(p_data) is distinct from 'object' or length(p_data::text)>50000 or length(btrim(coalesce(p_data->>'title',''))) not between 1 and 200 or coalesce(p_data->>'kind','') not in('wedding','funeral','festival','other') or length(coalesce(p_data->>'private_notes',''))>10000 or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_data->>'timezone') or jsonb_typeof(p_data->'selections') is distinct from 'array' then raise exception 'invalid_event_plan';end if;
 if jsonb_array_length(p_data->'selections')>8 or length(btrim(coalesce(p_data->>'customer_name',''))) not between 1 and 120 or length(coalesce(p_data->>'customer_email',''))>160 or coalesce(p_data->>'customer_email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_event_plan';end if;
 if (select count(distinct entry->>'slot_id') from jsonb_array_elements(p_data->'selections')entry)<>jsonb_array_length(p_data->'selections') then raise exception 'duplicate_event_slot';end if;
 for x in select value from jsonb_array_elements(p_data->'selections') loop
  if jsonb_typeof(x) is distinct from 'object' or (x->>'slot_id')::uuid is null or (x->>'listing_id')::uuid is null or (x->>'workspace_id')::uuid is null or coalesce((x->>'slot_version')::integer,0)<1 or coalesce((x->>'settings_version')::integer,0)<1 or coalesce((x->>'party_size')::integer,0) not between 1 and 10000 or coalesce((x->>'price_cents')::integer,-1) not between 0 and 100000000 or coalesce(x->>'currency','') !~ '^[A-Z]{3}$' or coalesce(x->>'resource_kind','') not in('staff','table','venue','performer','equipment') or length(btrim(coalesce(x->>'role',''))) not between 1 and 80 or length(coalesce(x->>'shared_context',''))>2000 then raise exception 'invalid_event_selection';end if;
 end loop;
end $$;
revoke all on function zoi.event_plan_validate(jsonb) from public,anon,authenticated;

create function public.event_plan_save(p_plan uuid,p_expected_version integer,p_request_id uuid,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;plan zoi.event_plans;prior zoi.event_plan_requests;payload jsonb;receipt jsonb;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;actor:=zoi.ensure_profile();if actor is null then raise exception 'sign_in_required' using errcode='42501';end if;
 if p_request_id is null then raise exception 'request_id_required';end if;
 perform 1 from zoi.user_profiles where id=actor for update;
 payload:=jsonb_build_object('plan',p_plan,'version',p_expected_version,'data',p_data);
 select * into prior from zoi.event_plan_requests where profile_id=actor and request_id=p_request_id;
 if prior.id is not null then if prior.operation<>'save' or prior.payload is distinct from payload then raise exception 'request_id_conflict';end if;return prior.receipt;end if;
 perform zoi.event_plan_validate(p_data);
 if p_plan is null then
  if p_expected_version is distinct from 0 then raise exception 'version_conflict';end if;
  insert into zoi.event_plans(profile_id,data) values(actor,p_data) returning * into plan;
 else
  select * into plan from zoi.event_plans where id=p_plan and profile_id=actor for update;
  if plan.id is null then raise exception 'event_plan_not_owned' using errcode='42501';end if;
  if plan.version is distinct from p_expected_version then raise exception 'version_conflict';end if;
  if plan.status<>'draft' then raise exception 'event_plan_already_confirmed';end if;
  update zoi.event_plans set data=p_data,version=version+1,updated_at=clock_timestamp() where id=p_plan returning * into plan;
 end if;
 receipt:=jsonb_build_object('ok',true,'plan',to_jsonb(plan));
 insert into zoi.event_plan_requests(profile_id,request_id,operation,payload,receipt) values(actor,p_request_id,'save',payload,receipt);
 return receipt;
end $$;

create function public.event_plan_confirm(p_plan uuid,p_expected_version integer,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;plan zoi.event_plans;prior zoi.event_plan_requests;payload jsonb;receipt jsonb;selection jsonb;slot zoi.booking_slots;cfg zoi.booking_settings;resource zoi.booking_resources;b jsonb;rows jsonb:='[]';slot_ids uuid[];
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;actor:=zoi.ensure_profile();if actor is null then raise exception 'sign_in_required' using errcode='42501';end if;
 if p_request_id is null then raise exception 'request_id_required';end if;
 -- Same profile -> ordered resources -> ordered slots order as booking_create/rescheduling.
 perform 1 from zoi.user_profiles where id=actor for update;
 payload:=jsonb_build_object('plan',p_plan,'version',p_expected_version);
 select * into prior from zoi.event_plan_requests where profile_id=actor and request_id=p_request_id;
 if prior.id is not null then if prior.operation<>'confirm' or prior.payload is distinct from payload then raise exception 'request_id_conflict';end if;return prior.receipt;end if;
 select * into plan from zoi.event_plans where id=p_plan and profile_id=actor for update;
 if plan.id is null then raise exception 'event_plan_not_owned' using errcode='42501';end if;
 if plan.version is distinct from p_expected_version then raise exception 'version_conflict';end if;
 if plan.status<>'draft' then raise exception 'event_plan_already_confirmed';end if;
 perform zoi.event_plan_validate(plan.data);
 if jsonb_array_length(plan.data->'selections') not between 1 and 8 then raise exception 'event_plan_selection_required';end if;
 select array_agg((x->>'slot_id')::uuid) into slot_ids from jsonb_array_elements(plan.data->'selections')x;
 perform 1 from zoi.booking_resources where id in(select resource_id from zoi.booking_slots where id=any(slot_ids)) order by id for update;
 perform 1 from zoi.booking_slots where id=any(slot_ids) order by id for update;
 -- Lock availability configuration and published ownership until all bookings are committed.
 perform 1 from zoi.booking_services where id in(select service_id from zoi.booking_slots where id=any(slot_ids)) order by id for share;
 perform 1 from zoi.booking_settings where workspace_id in(select workspace_id from zoi.booking_slots where id=any(slot_ids)) order by workspace_id for share;
 perform 1 from zoi.listings where id in(select (x->>'listing_id')::uuid from jsonb_array_elements(plan.data->'selections')x) order by id for share;
 for selection in select value from jsonb_array_elements(plan.data->'selections') loop
  select * into slot from zoi.booking_slots where id=(selection->>'slot_id')::uuid;
  if slot.id is null or slot.workspace_id is distinct from (selection->>'workspace_id')::uuid or not slot.active or slot.starts_at<=clock_timestamp()+interval '5 minutes' or slot.starts_at>clock_timestamp()+interval '8760 hours' then raise exception 'slot_unavailable';end if;
  select * into cfg from zoi.booking_settings where workspace_id=slot.workspace_id;
  select * into resource from zoi.booking_resources where id=slot.resource_id and workspace_id=slot.workspace_id;
  if cfg.listing_id is distinct from (selection->>'listing_id')::uuid or cfg.version is distinct from (selection->>'settings_version')::integer or not cfg.enabled or not exists(select 1 from zoi.listings where id=cfg.listing_id and owner_workspace_id=slot.workspace_id and publish_status='published' and coalesce(marketplace_status,'')<>'hidden') or resource.id is null or not resource.active or not exists(select 1 from zoi.booking_services where id=slot.service_id and workspace_id=slot.workspace_id and active) then raise exception 'booking_unavailable';end if;
  if slot.version is distinct from (selection->>'slot_version')::integer then raise exception 'slot_version_conflict';end if;
  if slot.price_cents is distinct from (selection->>'price_cents')::integer or slot.currency is distinct from selection->>'currency' or resource.kind is distinct from selection->>'resource_kind' then raise exception 'booking_price_changed';end if;
  if (selection->>'party_size')::integer>slot.capacity then raise exception 'party_exceeds_capacity';end if;
  if exists(select 1 from zoi.bookings where slot_id=slot.id and status<>'cancelled') then raise exception 'slot_unavailable';end if;
 end loop;
 for selection in select value from jsonb_array_elements(plan.data->'selections') loop
  select * into slot from zoi.booking_slots where id=(selection->>'slot_id')::uuid;
  b:=public.booking_create(slot.id,gen_random_uuid(),plan.data->>'customer_name',plan.data->>'customer_email',(selection->>'party_size')::integer,slot.version)->'booking';
  insert into zoi.event_plan_bookings(plan_id,booking_id,role,shared_context,reviewed_slot) values(plan.id,(b->>'id')::uuid,btrim(selection->>'role'),coalesce(selection->>'shared_context',''),to_jsonb(slot));
  rows:=rows||jsonb_build_array(jsonb_build_object('booking',b,'slot',to_jsonb(slot),'role',selection->>'role','listing_id',selection->>'listing_id'));
 end loop;
 update zoi.event_plans set status='confirmed',version=version+1,updated_at=clock_timestamp() where id=plan.id returning * into plan;
 receipt:=jsonb_build_object('ok',true,'plan_id',plan.id,'version',plan.version,'bookings',rows,'payment_collected',false);
 insert into zoi.event_plan_requests(profile_id,request_id,operation,payload,receipt) values(actor,p_request_id,'confirm',payload,receipt);
 return receipt;
end $$;

create function public.event_plan_get(p_plan uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;plan zoi.event_plans;rows jsonb;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;actor:=zoi.ensure_profile();
 select * into plan from zoi.event_plans where id=p_plan and profile_id=actor;
 if plan.id is null then raise exception 'event_plan_not_owned' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('booking',to_jsonb(b),'slot',to_jsonb(s),'role',p.role,'shared_context',p.shared_context,'listing_id',c.listing_id,'timezone',c.timezone,'reviewed_slot',p.reviewed_slot) order by s.starts_at,b.id),'[]') into rows from zoi.event_plan_bookings p join zoi.bookings b on b.id=p.booking_id join zoi.booking_slots s on s.id=b.slot_id join zoi.booking_settings c on c.workspace_id=b.workspace_id where p.plan_id=plan.id;
 return jsonb_build_object('ok',true,'plan',to_jsonb(plan),'bookings',rows);
end $$;

create function public.event_plan_list(p_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;actor:=zoi.ensure_profile();if actor is null then raise exception 'sign_in_required' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'invalid_offset';end if;
 return jsonb_build_object('ok',true,'offset',p_offset,'plans',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',data->>'title','kind',data->>'kind','status',status,'version',version,'updated_at',updated_at) order by created_at desc,id desc),'[]') from(select * from zoi.event_plans where profile_id=actor order by created_at desc,id desc limit 51 offset p_offset)p));
end $$;

create function public.event_plan_provider_context(p_booking uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;b zoi.bookings;context zoi.event_plan_bookings;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;actor:=zoi.ensure_profile();
 select * into b from zoi.bookings where id=p_booking;
 if b.id is null or not exists(select 1 from zoi.workspace_members where workspace_id=b.workspace_id and profile_id=actor and role in('owner','admin')) then raise exception 'workspace_permission_denied' using errcode='42501';end if;
 select * into context from zoi.event_plan_bookings where booking_id=b.id;
 return jsonb_build_object('ok',true,'booking_id',b.id,'context',case when context.booking_id is not null then jsonb_build_object('role',context.role,'shared_context',context.shared_context) else null end);
end $$;
revoke all on function public.event_plan_capabilities(),public.event_plan_catalog(uuid,timestamptz,timestamptz),public.event_plan_save(uuid,integer,uuid,jsonb),public.event_plan_confirm(uuid,integer,uuid),public.event_plan_get(uuid),public.event_plan_list(integer),public.event_plan_provider_context(uuid) from public,anon,authenticated;
grant execute on function public.event_plan_capabilities(),public.event_plan_save(uuid,integer,uuid,jsonb),public.event_plan_confirm(uuid,integer,uuid),public.event_plan_get(uuid),public.event_plan_list(integer),public.event_plan_provider_context(uuid) to authenticated;
grant execute on function public.event_plan_catalog(uuid,timestamptz,timestamptz) to anon,authenticated;
commit;
