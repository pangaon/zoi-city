begin;
set local lock_timeout='5s';
create table zoi.booking_settings(workspace_id uuid primary key references zoi.workspaces(id),listing_id uuid not null unique references zoi.listings(id),timezone text not null,currency text not null default 'EUR',enabled boolean not null default false,version integer not null default 1);
create table zoi.booking_services(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references zoi.workspaces(id),name text not null,duration_minutes integer not null check(duration_minutes between 5 and 480),buffer_minutes integer not null default 0 check(buffer_minutes between 0 and 120),price_cents integer not null default 0 check(price_cents between 0 and 100000000),active boolean not null default true,version integer not null default 1);
create table zoi.booking_resources(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references zoi.workspaces(id),name text not null,kind text not null check(kind in ('table','staff')),capacity integer not null check(capacity between 1 and 50),active boolean not null default true,version integer not null default 1,check(kind<>'staff' or capacity=1));
create table zoi.booking_slots(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references zoi.workspaces(id),service_id uuid not null references zoi.booking_services(id),resource_id uuid not null references zoi.booking_resources(id),starts_at timestamptz not null,ends_at timestamptz not null,blocked_until timestamptz not null,service_name text not null,resource_name text not null,capacity integer not null,price_cents integer not null,currency text not null,active boolean not null default true,version integer not null default 1,check(ends_at>starts_at and blocked_until>=ends_at));
create index booking_slots_resource_time on zoi.booking_slots(resource_id,starts_at,blocked_until) where active;
create index booking_slots_workspace_time on zoi.booking_slots(workspace_id,starts_at);
create table zoi.bookings(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references zoi.workspaces(id),slot_id uuid not null references zoi.booking_slots(id),profile_id uuid not null references zoi.user_profiles(id),request_id uuid not null,customer_name text not null,customer_email text not null,party_size integer not null check(party_size between 1 and 50),status text not null default 'confirmed' check(status in ('confirmed','cancelled','completed','no_show')),version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(profile_id,request_id));
create table zoi.booking_audit(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references zoi.workspaces(id),booking_id uuid not null references zoi.bookings(id),actor_profile_id uuid not null references zoi.user_profiles(id),action text not null check(action in ('created','status_changed')),before_status text,after_status text not null,booking_version integer not null,created_at timestamptz not null default clock_timestamp());
create index booking_audit_workspace_time on zoi.booking_audit(workspace_id,created_at desc);
alter table zoi.booking_audit enable row level security;
revoke all on zoi.booking_audit from public,anon,authenticated;
create unique index bookings_one_active_slot on zoi.bookings(slot_id) where status<>'cancelled';
create index bookings_customer on zoi.bookings(profile_id,created_at desc);
alter table zoi.booking_settings enable row level security;
alter table zoi.booking_services enable row level security;
alter table zoi.booking_resources enable row level security;
alter table zoi.booking_slots enable row level security;
alter table zoi.bookings enable row level security;
revoke all on zoi.booking_settings,zoi.booking_services,zoi.booking_resources,zoi.booking_slots,zoi.bookings from public,anon,authenticated;

create function public.booking_settings_save(p_workspace uuid,p_expected_version integer,p_listing uuid,p_timezone text,p_currency text,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg zoi.booking_settings;
begin
 perform zoi.venue_require_member(p_workspace,true);
 perform 1 from zoi.workspaces where id=p_workspace for update;
 if not exists(select 1 from zoi.listings where id=p_listing and owner_workspace_id=p_workspace and publish_status='published' and coalesce(marketplace_status,'')<>'hidden') then raise exception 'published_owned_listing_required';end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) or p_currency !~ '^[A-Z]{3}$' or p_enabled is null then raise exception 'invalid_booking_settings';end if;
 select * into cfg from zoi.booking_settings where workspace_id=p_workspace for update;
 if cfg.workspace_id is not null and cfg.listing_id is distinct from p_listing and (exists(select 1 from zoi.booking_slots where workspace_id=p_workspace) or exists(select 1 from zoi.bookings where workspace_id=p_workspace)) then raise exception 'booking_listing_is_immutable';end if;
 if coalesce(cfg.version,0) is distinct from p_expected_version then raise exception 'version_conflict';end if;
 if cfg.workspace_id is null then
 insert into zoi.booking_settings(workspace_id,listing_id,timezone,currency,enabled) values(p_workspace,p_listing,p_timezone,p_currency,p_enabled) returning * into cfg;
 else
 update zoi.booking_settings set listing_id=p_listing,timezone=p_timezone,currency=p_currency,enabled=p_enabled,version=version+1 where workspace_id=p_workspace returning * into cfg;
 end if;
 return jsonb_build_object('ok',true,'settings',to_jsonb(cfg));
end $$;

create function public.booking_item_save(p_workspace uuid,p_kind text,p_id uuid,p_expected_version integer,p_data jsonb)
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
   update zoi.booking_resources set name=btrim(p_data->>'name'),kind=p_data->>'kind',capacity=(p_data->>'capacity')::integer,active=(p_data->>'active')::boolean,version=version+1 where id=r.id returning * into r;
  end if;item:=to_jsonb(r);
 else raise exception 'invalid_booking_kind';end if;
 return jsonb_build_object('ok',true,'item',item);
end $$;

create function public.booking_slot_save(p_workspace uuid,p_id uuid,p_expected_version integer,p_service uuid,p_resource uuid,p_starts_at timestamptz,p_active boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s zoi.booking_services;r zoi.booking_resources;cfg zoi.booking_settings;slot zoi.booking_slots;finish timestamptz;blocked timestamptz;
begin
 perform zoi.venue_require_member(p_workspace,true);
 -- Resource lock serializes all overlap checks, including concurrent availability edits.
 select * into r from zoi.booking_resources where id=p_resource and workspace_id=p_workspace for update;
 select * into s from zoi.booking_services where id=p_service and workspace_id=p_workspace for share;
 select * into cfg from zoi.booking_settings where workspace_id=p_workspace for share;
 if r.id is null or s.id is null or not r.active or not s.active or cfg.workspace_id is null then raise exception 'booking_setup_incomplete';end if;
 if p_starts_at is null or p_starts_at<=clock_timestamp() or p_starts_at>clock_timestamp()+interval '366 days' or p_active is null then raise exception 'invalid_booking_time';end if;
 finish:=p_starts_at+make_interval(mins=>s.duration_minutes);blocked:=finish+make_interval(mins=>s.buffer_minutes);
 if p_id is not null then
  select * into slot from zoi.booking_slots where id=p_id and workspace_id=p_workspace for update;
  if slot.id is null then raise exception 'slot_unavailable';end if;
  if slot.resource_id<>p_resource then raise exception 'slot_resource_immutable';end if;
  if slot.version is distinct from p_expected_version then raise exception 'version_conflict';end if;
  if exists(select 1 from zoi.bookings where slot_id=p_id and status<>'cancelled') then raise exception 'slot_has_reservation';end if;
 elsif p_expected_version is distinct from 0 then raise exception 'version_conflict';end if;
 if p_active and exists(select 1 from zoi.booking_slots where resource_id=r.id and active and id is distinct from p_id and starts_at<blocked and blocked_until>p_starts_at) then raise exception 'availability_overlap';end if;
 if p_id is null then
  insert into zoi.booking_slots(workspace_id,service_id,resource_id,starts_at,ends_at,blocked_until,service_name,resource_name,capacity,price_cents,currency,active) values(p_workspace,s.id,r.id,p_starts_at,finish,blocked,s.name,r.name,r.capacity,s.price_cents,cfg.currency,p_active) returning * into slot;
 else
  update zoi.booking_slots set service_id=s.id,starts_at=p_starts_at,ends_at=finish,blocked_until=blocked,service_name=s.name,resource_name=r.name,capacity=r.capacity,price_cents=s.price_cents,currency=cfg.currency,active=p_active,version=version+1 where id=p_id returning * into slot;
 end if;
 return jsonb_build_object('ok',true,'slot',to_jsonb(slot));
end $$;

create function public.booking_catalog(p_listing uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg zoi.booking_settings;slots jsonb;title text;
begin
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '31 days' then raise exception 'invalid_date_range';end if;
 select b.*,l.name into cfg.workspace_id,cfg.listing_id,cfg.timezone,cfg.currency,cfg.enabled,cfg.version,title from zoi.booking_settings b join zoi.listings l on l.id=b.listing_id where b.listing_id=p_listing and l.owner_workspace_id=b.workspace_id and b.enabled and l.publish_status='published' and coalesce(l.marketplace_status,'')<>'hidden';
 if cfg.workspace_id is null then return jsonb_build_object('ok',true,'available',false,'slots','[]'::jsonb);end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.starts_at),'[]') into slots from (select s.id,s.version,s.service_name,s.resource_name,s.starts_at,s.ends_at,s.capacity,s.price_cents,s.currency from zoi.booking_slots s join zoi.booking_services v on v.id=s.service_id join zoi.booking_resources r on r.id=s.resource_id where s.workspace_id=cfg.workspace_id and s.active and v.active and r.active and s.starts_at>=greatest(p_from,clock_timestamp()+interval '5 minutes') and s.starts_at<p_to and not exists(select 1 from zoi.bookings b where b.slot_id=s.id and b.status<>'cancelled') order by s.starts_at limit 500) q;
 return jsonb_build_object('ok',true,'available',true,'name',title,'timezone',cfg.timezone,'currency',cfg.currency,'slots',slots);
end $$;

create function public.booking_create(p_slot uuid,p_request_id uuid,p_name text,p_email text,p_party_size integer,p_expected_slot_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;b zoi.bookings;slot zoi.booking_slots;rid uuid;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;actor:=zoi.ensure_profile();
 if p_request_id is null or length(btrim(coalesce(p_name,''))) not between 1 and 120 or length(coalesce(p_email,''))>160 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_email is null or p_party_size is null then raise exception 'invalid_booking_details';end if;
 -- Profile lock also serializes idempotency keys across different slot requests.
 perform 1 from zoi.user_profiles where id=actor for update;
 select * into b from zoi.bookings where profile_id=actor and request_id=p_request_id;
 if b.id is not null then
  if b.slot_id<>p_slot or b.party_size<>p_party_size then raise exception 'request_id_conflict';end if;
  return jsonb_build_object('ok',true,'booking',to_jsonb(b));
 end if;
 select resource_id into rid from zoi.booking_slots where id=p_slot;
 perform 1 from zoi.booking_resources where id=rid for update;
 select * into slot from zoi.booking_slots where id=p_slot for update;
 if slot.id is null or not slot.active or slot.starts_at<=clock_timestamp()+interval '5 minutes' then raise exception 'slot_unavailable';end if;
 if slot.version is distinct from p_expected_slot_version then raise exception 'slot_version_conflict';end if;
 if not exists(select 1 from zoi.booking_settings c join zoi.listings l on l.id=c.listing_id where c.workspace_id=slot.workspace_id and l.owner_workspace_id=c.workspace_id and c.enabled and l.publish_status='published' and coalesce(l.marketplace_status,'')<>'hidden') or not exists(select 1 from zoi.booking_resources where id=slot.resource_id and active) or not exists(select 1 from zoi.booking_services where id=slot.service_id and active) then raise exception 'booking_unavailable';end if;
 if p_party_size<1 or p_party_size>slot.capacity then raise exception 'party_exceeds_capacity';end if;
 if exists(select 1 from zoi.bookings where slot_id=slot.id and status<>'cancelled') then raise exception 'slot_unavailable';end if;
 insert into zoi.bookings(workspace_id,slot_id,profile_id,request_id,customer_name,customer_email,party_size) values(slot.workspace_id,slot.id,actor,p_request_id,btrim(p_name),btrim(p_email),p_party_size) returning * into b;
 insert into zoi.booking_audit(workspace_id,booking_id,actor_profile_id,action,before_status,after_status,booking_version) values(b.workspace_id,b.id,actor,'created',null,b.status,b.version);
 return jsonb_build_object('ok',true,'booking',to_jsonb(b));
end $$;

create function public.booking_status_set(p_booking uuid,p_expected_version integer,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;b zoi.bookings;slot zoi.booking_slots;operator boolean;rid uuid;previous_status text;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;actor:=zoi.ensure_profile();
 select * into b from zoi.bookings where id=p_booking;
 if b.id is null then raise exception 'booking_unavailable';end if;
 operator:=exists(select 1 from zoi.workspace_members where workspace_id=b.workspace_id and profile_id=actor and role in ('owner','admin'));
 if not operator and b.profile_id<>actor then raise exception 'booking_not_owned' using errcode='42501';end if;
 select resource_id into rid from zoi.booking_slots where id=b.slot_id;
 perform 1 from zoi.booking_resources where id=rid for update;
 select * into slot from zoi.booking_slots where id=b.slot_id for update;
 select * into b from zoi.bookings where id=p_booking for update;
 if p_status not in ('cancelled','completed','no_show') or p_status is null or (not operator and p_status<>'cancelled') then raise exception 'booking_status_not_allowed';end if;
 if b.status=p_status then return jsonb_build_object('ok',true,'booking',to_jsonb(b));end if;
 if b.version is distinct from p_expected_version then raise exception 'version_conflict';end if;
 if b.status<>'confirmed' then raise exception 'booking_status_final';end if;
 if not operator and slot.starts_at<=clock_timestamp() then raise exception 'booking_already_started';end if;
 if p_status in ('completed','no_show') and slot.starts_at>clock_timestamp() then raise exception 'booking_not_started';end if;
 previous_status:=b.status;
 update zoi.bookings set status=p_status,version=version+1,updated_at=clock_timestamp() where id=b.id returning * into b;
 insert into zoi.booking_audit(workspace_id,booking_id,actor_profile_id,action,before_status,after_status,booking_version) values(b.workspace_id,b.id,actor,'status_changed',previous_status,b.status,b.version);
 return jsonb_build_object('ok',true,'booking',to_jsonb(b));
end $$;

create function public.booking_my_list(p_listing uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;rows jsonb;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;actor:=zoi.ensure_profile();
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]') into rows from(select b.*,s.starts_at,s.ends_at,s.service_name,s.resource_name,s.price_cents,s.currency,c.timezone from zoi.bookings b join zoi.booking_slots s on s.id=b.slot_id join zoi.booking_settings c on c.workspace_id=b.workspace_id where b.profile_id=actor and c.listing_id=p_listing order by b.created_at desc limit 100)q;
 return jsonb_build_object('ok',true,'bookings',rows);
end $$;

create function public.booking_operator_list(p_workspace uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;role text;result jsonb;
begin
 actor:=zoi.venue_require_member(p_workspace,false);
 select m.role into role from zoi.workspace_members m where workspace_id=p_workspace and profile_id=actor;
 if role not in ('owner','admin') then raise exception 'workspace_permission_denied' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '31 days' then raise exception 'invalid_date_range';end if;
 select jsonb_build_object('ok',true,'role',role,'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]') from (select * from zoi.booking_audit where workspace_id=p_workspace order by created_at desc limit 100) a),'settings',(select to_jsonb(c) from zoi.booking_settings c where workspace_id=p_workspace),'listings',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]') from zoi.listings where owner_workspace_id=p_workspace and publish_status='published' and coalesce(marketplace_status,'')<>'hidden'),'services',(select coalesce(jsonb_agg(to_jsonb(s) order by s.name),'[]') from zoi.booking_services s where workspace_id=p_workspace),'resources',(select coalesce(jsonb_agg(to_jsonb(r) order by r.name),'[]') from zoi.booking_resources r where workspace_id=p_workspace),'slots',(select coalesce(jsonb_agg(to_jsonb(s) order by s.starts_at),'[]') from zoi.booking_slots s where workspace_id=p_workspace and starts_at>=p_from and starts_at<p_to),'bookings',(select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at desc),'[]') from zoi.bookings b join zoi.booking_slots s on s.id=b.slot_id where b.workspace_id=p_workspace and s.starts_at>=p_from and s.starts_at<p_to)) into result;
 return result;
end $$;

revoke all on function public.booking_settings_save(uuid,integer,uuid,text,text,boolean),public.booking_item_save(uuid,text,uuid,integer,jsonb),public.booking_slot_save(uuid,uuid,integer,uuid,uuid,timestamptz,boolean),public.booking_catalog(uuid,timestamptz,timestamptz),public.booking_create(uuid,uuid,text,text,integer,integer),public.booking_status_set(uuid,integer,text),public.booking_my_list(uuid),public.booking_operator_list(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.booking_catalog(uuid,timestamptz,timestamptz) to anon,authenticated;
grant execute on function public.booking_settings_save(uuid,integer,uuid,text,text,boolean),public.booking_item_save(uuid,text,uuid,integer,jsonb),public.booking_slot_save(uuid,uuid,integer,uuid,uuid,timestamptz,boolean),public.booking_create(uuid,uuid,text,text,integer,integer),public.booking_status_set(uuid,integer,text),public.booking_my_list(uuid),public.booking_operator_list(uuid,timestamptz,timestamptz) to authenticated;

-- Preserve the deployed menu return shape while fixing the missing sort column.
create or replace function public.menu_items_list(p_workspace uuid)
returns json language plpgsql security definer set search_path='' as $$
declare rows json;
begin
 select coalesce(json_agg(json_build_object('id',m.id,'name',m.name,'description',m.description,'price_cents',m.price_cents,'currency',m.currency,'station',m.station) order by m.sort_order,m.name),'[]'::json) into rows from public.menu_items m where m.workspace_id=p_workspace and m.is_available=true;
 return json_build_object('ok',true,'items',rows);
end $$;
commit;
