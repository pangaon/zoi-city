-- Versioned venue drafts and stable named-seat inventory.
-- Seat publication is OFF until legacy reserve/checkout capacity paths have
-- been verified and made hold-aware. Draft persistence works independently.
begin;
set local lock_timeout = '5s';
create table zoi.venue_plans (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references zoi.workspaces(id) on delete cascade,
 revision integer not null default 1 check(revision>0),
 layout jsonb not null,
 updated_at timestamptz not null default now()
);
create index venue_plans_workspace on zoi.venue_plans(workspace_id,updated_at desc);
create table zoi.venue_plan_revisions (
 plan_id uuid not null references zoi.venue_plans(id) on delete cascade,
 revision integer not null, layout jsonb not null, created_at timestamptz not null default now(),
 primary key(plan_id,revision)
);
create table zoi.seating_runtime (
 id boolean primary key default true check(id),
 enabled boolean not null default false
);
insert into zoi.seating_runtime(id,enabled) values(true,false);
create table zoi.seating_sessions (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null unique references zoi.listings(id), ticket_type_id bigint not null unique references zoi.ticket_types(id),
 workspace_id uuid not null references zoi.workspaces(id),
 plan_id uuid not null references zoi.venue_plans(id),
 plan_revision integer not null, layout jsonb not null,
 created_at timestamptz not null default now(),
 foreign key(plan_id,plan_revision) references zoi.venue_plan_revisions(plan_id,revision)
);
create index seating_sessions_workspace on zoi.seating_sessions(workspace_id);
create table zoi.seat_holds (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references zoi.seating_sessions(id),
 profile_id uuid not null references zoi.user_profiles(id),
 request_id uuid not null,
 seat_ids text[] not null check(cardinality(seat_ids) between 1 and 10),
 expires_at timestamptz not null,
 status text not null default 'active' check(status in ('active','released','expired','reserved','cancelled')),
 receipt jsonb,
 created_at timestamptz not null default now(),
 unique(session_id,profile_id,request_id)
);
create index seat_holds_active on zoi.seat_holds(session_id,expires_at) where status='active';
create index seat_holds_actor on zoi.seat_holds(profile_id,session_id);
create table zoi.seat_inventory (
 session_id uuid not null references zoi.seating_sessions(id),
 seat_id text not null,label text not null,accessible boolean not null default false,
 hold_id uuid references zoi.seat_holds(id), reservation_code text,
 primary key(session_id,seat_id),unique(session_id,label)
);
create index seat_inventory_hold on zoi.seat_inventory(hold_id) where hold_id is not null;
alter table zoi.ticket_reservations add column seat_hold_id uuid unique references zoi.seat_holds(id);
alter table zoi.venue_plans enable row level security;
alter table zoi.venue_plan_revisions enable row level security;
alter table zoi.seating_runtime enable row level security;
alter table zoi.seating_sessions enable row level security;
alter table zoi.seat_holds enable row level security;
alter table zoi.seat_inventory enable row level security;
revoke all on zoi.venue_plans,zoi.venue_plan_revisions,zoi.seating_runtime,zoi.seating_sessions,zoi.seat_holds,zoi.seat_inventory from public,anon,authenticated;

create function zoi.venue_require_member(p_workspace uuid,p_manage boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; member_role text;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501'; end if;
 actor:=zoi.ensure_profile();
 select role into member_role from zoi.workspace_members where workspace_id=p_workspace and profile_id=actor;
 if member_role is null or (p_manage and member_role not in ('owner','admin')) then
  raise exception 'workspace_permission_denied' using errcode='42501';
 end if;
 return actor;
end $$;
revoke all on function zoi.venue_require_member(uuid,boolean) from public,anon,authenticated;

create function zoi.venue_validate_layout(p_layout jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare w numeric;d numeric;o jsonb;clean jsonb:='[]';x numeric;y numeric;ow numeric;od numeric;h numeric;
begin
 if octet_length(p_layout::text)>250000 or p_layout->'version' is distinct from '1'::jsonb or jsonb_typeof(p_layout->'name') is distinct from 'string' or jsonb_typeof(p_layout->'width') is distinct from 'number' or jsonb_typeof(p_layout->'depth') is distinct from 'number' or jsonb_typeof(p_layout->'objects') is distinct from 'array' then raise exception 'invalid_layout'; end if;
 w:=(p_layout->>'width')::numeric;d:=(p_layout->>'depth')::numeric;
 if w is null or d is null or w not between 4 and 100 or d not between 4 and 100 then raise exception 'invalid_room_dimensions'; end if;
 if nullif(btrim(p_layout->>'name'),'') is null or length(p_layout->>'name')>100 or jsonb_array_length(p_layout->'objects')>600 then raise exception 'invalid_layout_size'; end if;
 for o in select value from jsonb_array_elements(p_layout->'objects') loop
  if jsonb_typeof(o->'id') is distinct from 'string' or jsonb_typeof(o->'label') is distinct from 'string' or exists(select 1 from unnest(array['x','y','width','depth','height']) k where jsonb_typeof(o->k) is distinct from 'number') or (o?'accessible' and jsonb_typeof(o->'accessible')<>'boolean') or (o?'excluded' and jsonb_typeof(o->'excluded')<>'boolean') then raise exception 'invalid_object_types'; end if;
  if coalesce(o->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' or coalesce(o->>'kind','') not in ('seat','stage','table') or nullif(btrim(o->>'label'),'') is null or length(o->>'label')>50 then raise exception 'invalid_object'; end if;
  x:=(o->>'x')::numeric;y:=(o->>'y')::numeric;ow:=(o->>'width')::numeric;od:=(o->>'depth')::numeric;h:=(o->>'height')::numeric;
  if x is null or y is null or ow is null or od is null or h is null or x<0 or y<0 or ow<=0 or od<=0 or h<=0 or h>10 or x+ow>w or y+od>d then raise exception 'object_outside_room'; end if;
  clean:=clean||jsonb_build_array(jsonb_build_object('id',o->>'id','kind',o->>'kind','label',btrim(o->>'label'),'x',x,'y',y,'width',ow,'depth',od,'height',h,'accessible',coalesce(o->'accessible'='true'::jsonb,false),'excluded',coalesce(o->'excluded'='true'::jsonb,false)));
 end loop;
 if exists(select 1 from jsonb_array_elements(clean) a group by a->>'id' having count(*)>1) then raise exception 'duplicate_object_id'; end if;
 if exists(select 1 from jsonb_array_elements(clean) a where a->>'kind'='seat' group by lower(a->>'label') having count(*)>1) then raise exception 'duplicate_seat_label'; end if;
 if exists(select 1 from jsonb_array_elements(clean) with ordinality a(o,n) join jsonb_array_elements(clean) with ordinality b(o,n) on a.n<b.n where
  (a.o->>'x')::numeric<(b.o->>'x')::numeric+(b.o->>'width')::numeric-0.01 and
  (a.o->>'x')::numeric+(a.o->>'width')::numeric>(b.o->>'x')::numeric+0.01 and
  (a.o->>'y')::numeric<(b.o->>'y')::numeric+(b.o->>'depth')::numeric-0.01 and
  (a.o->>'y')::numeric+(a.o->>'depth')::numeric>(b.o->>'y')::numeric+0.01) then raise exception 'objects_overlap'; end if;
 return jsonb_build_object('version',1,'name',btrim(p_layout->>'name'),'width',w,'depth',d,'objects',clean);
end $$;
revoke all on function zoi.venue_validate_layout(jsonb) from public,anon,authenticated;

create function public.venue_plan_save(p_workspace uuid,p_plan_id uuid,p_expected_revision integer,p_layout jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare plan zoi.venue_plans;clean jsonb;
begin
 perform zoi.venue_require_member(p_workspace,true);
 clean:=zoi.venue_validate_layout(p_layout);
 if p_plan_id is null then
  if p_expected_revision is not null and p_expected_revision<>0 then raise exception 'revision_conflict' using errcode='40001'; end if;
  insert into zoi.venue_plans(workspace_id,layout) values(p_workspace,clean) returning * into plan;
 else
  select * into plan from zoi.venue_plans where id=p_plan_id and workspace_id=p_workspace for update;
  if plan.id is null then raise exception 'plan_not_found' using errcode='42501'; end if;
  if plan.revision is distinct from p_expected_revision then raise exception 'revision_conflict' using errcode='40001'; end if;
  update zoi.venue_plans set layout=clean,revision=revision+1,updated_at=now() where id=plan.id returning * into plan;
 end if;
 insert into zoi.venue_plan_revisions(plan_id,revision,layout) values(plan.id,plan.revision,clean);
 return jsonb_build_object('ok',true,'plan_id',plan.id,'revision',plan.revision,'layout',plan.layout);
end $$;
create function public.venue_plan_list(p_workspace uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform zoi.venue_require_member(p_workspace,false);
 return coalesce((select jsonb_agg(jsonb_build_object('plan_id',id,'revision',revision,'name',layout->>'name','updated_at',updated_at) order by updated_at desc) from zoi.venue_plans where workspace_id=p_workspace),'[]');
end $$;
create function public.venue_plan_get(p_workspace uuid,p_plan_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare plan zoi.venue_plans;
begin
 perform zoi.venue_require_member(p_workspace,false);
 select * into plan from zoi.venue_plans where id=p_plan_id and workspace_id=p_workspace;
 if plan.id is null then raise exception 'plan_not_found' using errcode='42501'; end if;
 return jsonb_build_object('ok',true,'plan_id',plan.id,'revision',plan.revision,'layout',plan.layout);
end $$;
create function zoi.seating_require_enabled()
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from zoi.seating_runtime where id and enabled) then raise exception 'seat_inventory_not_enabled' using errcode='55000'; end if;
end $$;
revoke all on function zoi.seating_require_enabled() from public,anon,authenticated;

create function public.venue_plan_publish(p_workspace uuid,p_plan_id uuid,p_revision integer,p_event uuid,p_type bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare plan zoi.venue_plans;session zoi.seating_sessions;dashboard jsonb;tier jsonb;seat_count integer;
begin
 perform zoi.venue_require_member(p_workspace,true);perform zoi.seating_require_enabled();
 select * into plan from zoi.venue_plans where id=p_plan_id and workspace_id=p_workspace for update;
 if plan.id is null then raise exception 'plan_not_found'; end if;
 if plan.revision is distinct from p_revision then raise exception 'revision_conflict' using errcode='40001'; end if;
 if not exists(select 1 from zoi.listings where id=p_event and entity_type='event' and owner_workspace_id=p_workspace and publish_status='published' and coalesce(marketplace_status,'')<>'hidden') then raise exception 'event_not_owned' using errcode='42501'; end if;
 select to_jsonb(t) into tier from zoi.ticket_types t where t.id=p_type and t.event_id=p_event and t.active for update;
 if tier is null or coalesce((tier->>'price_cents')::integer,-1)<>0 then raise exception 'free_tier_required'; end if;
 select * into session from zoi.seating_sessions where event_id=p_event;
 if session.id is not null then
  if session.plan_id=p_plan_id and session.plan_revision=p_revision and session.ticket_type_id=p_type then return jsonb_build_object('ok',true,'session_id',session.id); end if;
  raise exception 'published_layout_is_immutable';
 end if;
 if coalesce((tier->>'reserved')::integer,0)<>0 then raise exception 'tier_already_has_reservations'; end if;
 select count(*) into seat_count from jsonb_array_elements(plan.layout->'objects') o where o->>'kind'='seat' and o->'excluded'='false'::jsonb;
 if seat_count<1 or (tier->>'capacity' is not null and seat_count>(tier->>'capacity')::integer) then raise exception 'invalid_seat_capacity'; end if;
 insert into zoi.seating_sessions(event_id,ticket_type_id,workspace_id,plan_id,plan_revision,layout) values(p_event,p_type,p_workspace,p_plan_id,p_revision,plan.layout) returning * into session;
 insert into zoi.seat_inventory(session_id,seat_id,label,accessible) select session.id,o->>'id',o->>'label',(o->>'accessible')::boolean from jsonb_array_elements(plan.layout->'objects') o where o->>'kind'='seat' and o->'excluded'='false'::jsonb;
 return jsonb_build_object('ok',true,'session_id',session.id);
end $$;

create function public.tickets_seat_map(p_event uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare session zoi.seating_sessions;
begin
 perform zoi.seating_require_enabled();
 select * into session from zoi.seating_sessions where event_id=p_event;
 if session.id is null then return jsonb_build_object('available',false); end if;
 if not exists(select 1 from zoi.listings where id=p_event and entity_type='event' and publish_status='published' and coalesce(marketplace_status,'')<>'hidden') then return jsonb_build_object('available',false); end if;
 return jsonb_build_object('available',true,'session_id',session.id,'ticket_type_id',session.ticket_type_id,'layout',session.layout,'seats',coalesce((select jsonb_agg(jsonb_build_object('id',i.seat_id,'label',i.label,'accessible',i.accessible,'state',case when i.reservation_code is not null then 'reserved' when h.status='active' and h.expires_at>clock_timestamp() then 'held' else 'available' end)) from zoi.seat_inventory i left join zoi.seat_holds h on h.id=i.hold_id where i.session_id=session.id),'[]'));
end $$;

create function public.tickets_seat_hold(p_event uuid,p_seat_ids text[],p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare session zoi.seating_sessions;actor uuid;hold zoi.seat_holds;existing zoi.seat_holds;tier jsonb;held_count integer;
begin
 perform zoi.seating_require_enabled();
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501'; end if;
 actor:=zoi.ensure_profile();
 if p_request_id is null or coalesce(cardinality(p_seat_ids),0) not between 1 and 10 or cardinality(p_seat_ids)<>(select count(distinct x) from unnest(p_seat_ids) x) then raise exception 'invalid_seat_selection'; end if;
 select * into session from zoi.seating_sessions where event_id=p_event for update;
 if session.id is null then raise exception 'seat_map_not_found'; end if;
 if not exists(select 1 from zoi.listings where id=p_event and entity_type='event' and publish_status='published' and coalesce(marketplace_status,'')<>'hidden') then raise exception 'event_unavailable'; end if;
 select * into existing from zoi.seat_holds where session_id=session.id and profile_id=actor and request_id=p_request_id;
 if existing.id is not null then
  if not(existing.seat_ids@>p_seat_ids and existing.seat_ids<@p_seat_ids) then raise exception 'idempotency_conflict'; end if;
  if existing.status='active' and existing.expires_at>clock_timestamp() then return jsonb_build_object('ok',true,'hold_id',existing.id,'expires_at',existing.expires_at,'seat_ids',existing.seat_ids); end if;
  raise exception 'hold_no_longer_active';
 end if;
 update zoi.seat_holds set status='expired' where session_id=session.id and status='active' and expires_at<=clock_timestamp();
 update zoi.seat_inventory i set hold_id=null where i.session_id=session.id and i.reservation_code is null and exists(select 1 from zoi.seat_holds h where h.id=i.hold_id and h.status in ('expired','released'));
 if exists(select 1 from zoi.seat_holds where session_id=session.id and profile_id=actor and status='active') then raise exception 'release_existing_hold_first'; end if;
 if (select count(*) from zoi.seat_inventory where session_id=session.id and seat_id=any(p_seat_ids) and hold_id is null and reservation_code is null)<>cardinality(p_seat_ids) then raise exception 'seats_unavailable'; end if;
 select to_jsonb(t) into tier from zoi.ticket_types t where t.id=session.ticket_type_id and t.event_id=p_event and t.active for update;
 if tier is null or coalesce((tier->>'price_cents')::integer,-1)<>0 then raise exception 'free_tier_required'; end if;
 select coalesce(sum(cardinality(seat_ids)),0) into held_count from zoi.seat_holds where session_id=session.id and status='active';
 if tier->>'capacity' is not null and coalesce((tier->>'reserved')::integer,0)+held_count+cardinality(p_seat_ids)>(tier->>'capacity')::integer then raise exception 'tier_capacity_exhausted'; end if;
 insert into zoi.seat_holds(session_id,profile_id,request_id,seat_ids,expires_at) values(session.id,actor,p_request_id,p_seat_ids,clock_timestamp()+interval '5 minutes') returning * into hold;
 update zoi.seat_inventory set hold_id=hold.id where session_id=session.id and seat_id=any(p_seat_ids);
 return jsonb_build_object('ok',true,'hold_id',hold.id,'expires_at',hold.expires_at,'seat_ids',hold.seat_ids);
end $$;
create function public.tickets_seat_release(p_hold_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hold zoi.seat_holds;actor uuid;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501'; end if;actor:=zoi.ensure_profile();
 select * into hold from zoi.seat_holds where id=p_hold_id and profile_id=actor;
 if hold.id is null then raise exception 'hold_not_owned' using errcode='42501'; end if;
 perform 1 from zoi.seating_sessions where id=hold.session_id for update;
 select * into hold from zoi.seat_holds where id=p_hold_id;
 if hold.status='reserved' then raise exception 'reservation_cannot_be_released'; end if;
 if hold.status='cancelled' then return jsonb_build_object('ok',true); end if;
 update zoi.seat_holds set status='released' where id=hold.id;
 update zoi.seat_inventory set hold_id=null where hold_id=hold.id and reservation_code is null;
 return jsonb_build_object('ok',true);
end $$;
create function public.tickets_seat_reserve(p_hold_id uuid,p_name text,p_email text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hold zoi.seat_holds;session zoi.seating_sessions;actor uuid;v_receipt jsonb;tier jsonb;reservation zoi.ticket_reservations;
begin
 perform zoi.seating_require_enabled();
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501'; end if;actor:=zoi.ensure_profile();
 if nullif(btrim(p_name),'') is null or length(p_name)>120 or coalesce(p_email,'') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_email)>160 then raise exception 'invalid_guest_details'; end if;
 select * into hold from zoi.seat_holds where id=p_hold_id and profile_id=actor;
 if hold.id is null then raise exception 'hold_not_owned' using errcode='42501'; end if;
 select * into session from zoi.seating_sessions where id=hold.session_id for update;
 select * into hold from zoi.seat_holds where id=p_hold_id;
 if hold.status='reserved' then return hold.receipt; end if;
 if hold.status<>'active' or hold.expires_at<=clock_timestamp() then raise exception 'hold_expired'; end if;
 if (select count(*) from zoi.seat_inventory where hold_id=hold.id and reservation_code is null)<>cardinality(hold.seat_ids) then raise exception 'hold_inventory_mismatch'; end if;
 select to_jsonb(t) into tier from zoi.ticket_types t where t.id=session.ticket_type_id and t.event_id=session.event_id and t.active for update;
 if tier is null or coalesce((tier->>'price_cents')::integer,-1)<>0 then raise exception 'free_tier_required'; end if;
 if not zoi.flag('feature_tickets') then raise exception 'ticketing_paused'; end if;
 if not exists(select 1 from zoi.listings where id=session.event_id and entity_type='event' and publish_status='published' and coalesce(marketplace_status,'')<>'hidden') then raise exception 'event_unavailable'; end if;
 if tier->>'capacity' is not null and (tier->>'reserved')::integer+cardinality(hold.seat_ids)>(tier->>'capacity')::integer then raise exception 'tier_capacity_exhausted'; end if;
 update zoi.ticket_types set reserved=reserved+cardinality(hold.seat_ids) where id=session.ticket_type_id;
 insert into zoi.ticket_reservations(event_id,ticket_type_id,buyer_name,buyer_email,qty,amount_cents,status,seat_hold_id)
 values(session.event_id,session.ticket_type_id,btrim(p_name),btrim(p_email),cardinality(hold.seat_ids),0,'reserved',hold.id) returning * into reservation;
 v_receipt:=jsonb_build_object('ok',true,'code',reservation.code,'qty',reservation.qty,'amount_cents',reservation.amount_cents,'currency',tier->>'currency','paid',false);
 if v_receipt is null or v_receipt?'error' or v_receipt->>'ok'='false' or nullif(v_receipt->>'code','') is null or coalesce((v_receipt->>'qty')::integer,0)<>cardinality(hold.seat_ids) or coalesce((v_receipt->>'amount_cents')::integer,-1)<>0 then raise exception 'reservation_not_confirmed'; end if;
 v_receipt:=v_receipt||jsonb_build_object('seat_ids',hold.seat_ids,'hold_id',hold.id);
 update zoi.seat_inventory set reservation_code=v_receipt->>'code' where hold_id=hold.id;
 update zoi.seat_holds set status='reserved',receipt=v_receipt where id=hold.id;
 return v_receipt;
end $$;
revoke all on function public.venue_plan_save(uuid,uuid,integer,jsonb),public.venue_plan_list(uuid),public.venue_plan_get(uuid,uuid),public.venue_plan_publish(uuid,uuid,integer,uuid,bigint),public.tickets_seat_map(uuid),public.tickets_seat_hold(uuid,text[],uuid),public.tickets_seat_release(uuid),public.tickets_seat_reserve(uuid,text,text) from public,anon,authenticated;
grant execute on function public.venue_plan_save(uuid,uuid,integer,jsonb),public.venue_plan_list(uuid),public.venue_plan_get(uuid,uuid),public.venue_plan_publish(uuid,uuid,integer,uuid,bigint),public.tickets_seat_hold(uuid,text[],uuid),public.tickets_seat_release(uuid),public.tickets_seat_reserve(uuid,text,text) to authenticated;
grant execute on function public.tickets_seat_map(uuid) to anon,authenticated;
-- Enforce the same inventory boundary for legacy reserve/checkout writes.
create function zoi.seating_reservation_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare session zoi.seating_sessions;hold zoi.seat_holds;
begin
 if tg_op='UPDATE' and old.seat_hold_id is not null and (new.ticket_type_id is distinct from old.ticket_type_id or new.event_id is distinct from old.event_id or new.qty is distinct from old.qty or new.seat_hold_id is distinct from old.seat_hold_id or new.amount_cents<>0) then raise exception 'seat_reservation_is_immutable'; end if;
 select * into session from zoi.seating_sessions where ticket_type_id=new.ticket_type_id;
 if session.id is null then
  if new.seat_hold_id is not null then raise exception 'unexpected_seat_hold'; end if;
  return new;
 end if;
 if tg_op='UPDATE' then
  if old.status='cancelled' and (new.status is distinct from old.status or new.checked_in_at is distinct from old.checked_in_at) then raise exception 'cancelled_seat_reservation_is_final'; end if;
  if new.ticket_type_id is distinct from old.ticket_type_id or new.event_id is distinct from old.event_id or new.qty is distinct from old.qty or new.seat_hold_id is distinct from old.seat_hold_id then raise exception 'seat_reservation_is_immutable'; end if;
  if new.status='cancelled' and old.status<>'cancelled' and not exists(select 1 from zoi.seat_holds where id=new.seat_hold_id and status='cancelled') then raise exception 'seated_cancellation_requires_seat_workflow'; end if;
  return new;
 end if;
 if new.seat_hold_id is null then raise exception 'choose_seats_for_this_event'; end if;
 select * into hold from zoi.seat_holds where id=new.seat_hold_id and session_id=session.id;
 if hold.id is null or hold.status<>'active' or hold.expires_at<=clock_timestamp() or new.event_id<>session.event_id or new.qty<>cardinality(hold.seat_ids) or new.amount_cents<>0 then raise exception 'invalid_seat_hold'; end if;
 return new;
end $$;
revoke all on function zoi.seating_reservation_guard() from public,anon,authenticated;
create trigger seating_reservation_guard before insert or update on zoi.ticket_reservations for each row execute function zoi.seating_reservation_guard();
create function zoi.seating_tier_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare session zoi.seating_sessions;
begin
 select * into session from zoi.seating_sessions where ticket_type_id=old.id;
 if session.id is not null and (new.event_id<>old.event_id or new.price_cents<>0 or (new.capacity is not null and new.capacity<(select count(*) from zoi.seat_inventory where session_id=session.id))) then raise exception 'published_seating_tier_is_immutable'; end if;
 return new;
end $$;
revoke all on function zoi.seating_tier_guard() from public,anon,authenticated;
create trigger seating_tier_guard before update on zoi.ticket_types for each row execute function zoi.seating_tier_guard();
create function public.tickets_seat_status(p_event uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;session zoi.seating_sessions;active_hold jsonb;reservations jsonb;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501'; end if;actor:=zoi.ensure_profile();
 select * into session from zoi.seating_sessions where event_id=p_event;
 select jsonb_build_object('hold_id',id,'seat_ids',seat_ids,'expires_at',expires_at) into active_hold from zoi.seat_holds where session_id=session.id and profile_id=actor and status='active' and expires_at>clock_timestamp() order by created_at desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('hold_id',id,'seat_ids',seat_ids,'status',status,'receipt',receipt) order by created_at desc),'[]') into reservations from (select * from zoi.seat_holds where session_id=session.id and profile_id=actor and status in ('reserved','cancelled') order by created_at desc limit 20) h;
 return jsonb_build_object('active_hold',active_hold,'reservations',reservations,'server_time',clock_timestamp());
end $$;
create function public.tickets_seat_cancel(p_hold_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;hold zoi.seat_holds;session zoi.seating_sessions;reservation zoi.ticket_reservations;tier zoi.ticket_types;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501'; end if;actor:=zoi.ensure_profile();
 select * into hold from zoi.seat_holds where id=p_hold_id;
 if hold.id is null then raise exception 'hold_not_owned' using errcode='42501'; end if;
 select * into session from zoi.seating_sessions where id=hold.session_id for update;
 if hold.profile_id<>actor and not exists(select 1 from zoi.workspace_members where workspace_id=session.workspace_id and profile_id=actor and role in ('owner','admin')) then raise exception 'hold_not_owned' using errcode='42501'; end if;
 select * into hold from zoi.seat_holds where id=p_hold_id;
 if hold.status='cancelled' then return hold.receipt; end if;
 if hold.status<>'reserved' then raise exception 'confirmed_reservation_required'; end if;
 select * into tier from zoi.ticket_types where id=session.ticket_type_id for update;
 select * into reservation from zoi.ticket_reservations where seat_hold_id=hold.id for update;
 if reservation.id is null or reservation.amount_cents<>0 or reservation.checked_in_at is not null then raise exception 'reservation_cannot_be_cancelled'; end if;
 if tier.reserved<reservation.qty then raise exception 'inventory_counter_mismatch'; end if;
 update zoi.seat_holds set status='cancelled',receipt=receipt||jsonb_build_object('cancelled',true) where id=hold.id returning * into hold;
 update zoi.ticket_reservations set status='cancelled' where id=reservation.id;
 update zoi.ticket_types set reserved=reserved-reservation.qty where id=tier.id;
 update zoi.seat_inventory set hold_id=null,reservation_code=null where hold_id=hold.id;
 return hold.receipt;
end $$;
revoke all on function public.tickets_seat_status(uuid),public.tickets_seat_cancel(uuid) from public,anon,authenticated;
grant execute on function public.tickets_seat_status(uuid),public.tickets_seat_cancel(uuid) to authenticated;


-- Check-in serializes with seat cancellation and preserves the legacy response shape.
create or replace function public.tickets_checkin(p_workspace uuid,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r zoi.ticket_reservations;t zoi.ticket_types;session_id uuid;reservation_id uuid;tier_id bigint;
begin
 perform zoi.venue_require_member(p_workspace,true);
 select tr.id,tr.ticket_type_id into reservation_id,tier_id from zoi.ticket_reservations tr join zoi.ticket_types tt on tt.id=tr.ticket_type_id where upper(tr.code)=upper(btrim(p_code)) and tt.workspace_id=p_workspace limit 1;
 if reservation_id is null then return jsonb_build_object('ok',false,'error','code_not_found'); end if;
 select id into session_id from zoi.seating_sessions where ticket_type_id=tier_id;
 if session_id is not null then perform 1 from zoi.seating_sessions where id=session_id for update; end if;
 select * into t from zoi.ticket_types where id=tier_id and workspace_id=p_workspace for update;
 select * into r from zoi.ticket_reservations where id=reservation_id and ticket_type_id=t.id for update;
 if r.id is null then return jsonb_build_object('ok',false,'error','code_not_found'); end if;
 if r.status='cancelled' then return jsonb_build_object('ok',false,'error','reservation_cancelled'); end if;
 if r.amount_cents>0 and r.payment_status is distinct from 'paid' then return jsonb_build_object('ok',false,'error','payment_required'); end if;
 if r.checked_in_at is not null then return jsonb_build_object('ok',true,'already',true,'name',r.buyer_name,'qty',r.qty,'type',t.name,'checked_in_at',r.checked_in_at); end if;
 update zoi.ticket_reservations set checked_in_at=clock_timestamp() where id=r.id;
 return jsonb_build_object('ok',true,'already',false,'name',r.buyer_name,'qty',r.qty,'type',t.name,'paid',(r.payment_status='paid'));
end $$;
revoke all on function public.tickets_checkin(uuid,text) from public,anon,authenticated;
grant execute on function public.tickets_checkin(uuid,text) to authenticated;

commit;
