begin;
set local lock_timeout='5s';
-- Server-owned preview token: immutable slot snapshot, actor/workspace, versions and expiry.
create table zoi.booking_availability_plans (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references zoi.workspaces(id),
 actor_profile_id uuid not null references zoi.user_profiles(id),service_id uuid not null references zoi.booking_services(id),resource_id uuid not null references zoi.booking_resources(id),
 settings_version integer not null,service_version integer not null,resource_version integer not null,
 pattern jsonb not null,slots jsonb not null,created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null default clock_timestamp()+interval '15 minutes',
 saved_at timestamptz,request_id uuid,receipt jsonb,
 unique(workspace_id,request_id)
);
create index booking_availability_plans_workspace_time on zoi.booking_availability_plans(workspace_id,created_at desc);
alter table zoi.booking_availability_plans enable row level security;
revoke all on zoi.booking_availability_plans from public,anon,authenticated;

-- Enumerate UTC candidates independently of PostgreSQL's implicit choice for DST folds.
create function zoi.booking_wall_instant(p_wall timestamp,p_timezone text)
returns timestamptz language plpgsql set search_path='' as $$
declare result timestamptz;n integer;
begin
 select count(*),min(candidate) into n,result from (
  select distinct (p_wall at time zone 'UTC')-((sample at time zone p_timezone)-(sample at time zone 'UTC')) candidate
  from generate_series((p_wall at time zone 'UTC')-interval '24 hours',(p_wall at time zone 'UTC')+interval '24 hours',interval '24 hours') sample
 ) q where candidate at time zone p_timezone=p_wall;
 if n<>1 then raise exception 'booking_dst_wall_time' using detail=to_char(p_wall,'YYYY-MM-DD"T"HH24:MI');end if;
 return result;
end $$;
revoke all on function zoi.booking_wall_instant(timestamp,text) from public,anon,authenticated;

create function public.booking_plan_preview(p_workspace uuid,p_service uuid,p_resource uuid,p_pattern jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;cfg zoi.booking_settings;s zoi.booking_services;r zoi.booking_resources;p zoi.booking_availability_plans;
 date_from date;date_to date;day date;opening time;closing time;wall timestamp;stop_wall timestamp;starts timestamptz;finish timestamptz;blocked timestamptz;step integer;rows jsonb:='[]';conflicts jsonb;count_slots integer:=0;
begin
 actor:=zoi.venue_require_member(p_workspace,true);
 select * into r from zoi.booking_resources where id=p_resource and workspace_id=p_workspace for share;
 select * into s from zoi.booking_services where id=p_service and workspace_id=p_workspace for share;
 select * into cfg from zoi.booking_settings where workspace_id=p_workspace for share;
 if r.id is null or s.id is null or not r.active or not s.active or cfg.workspace_id is null then raise exception 'booking_setup_incomplete';end if;
 if length(p_pattern::text)>2000 or jsonb_typeof(p_pattern) is distinct from 'object' or coalesce(p_pattern->>'dateFrom','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(p_pattern->>'dateTo','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(p_pattern->>'opens','') !~ '^([01]\d|2[0-3]):[0-5]\d$' or coalesce(p_pattern->>'closes','') !~ '^([01]\d|2[0-3]):[0-5]\d$' or jsonb_typeof(p_pattern->'weekdays') is distinct from 'array' then raise exception 'invalid_booking_pattern';end if;
 if jsonb_array_length(p_pattern->'weekdays') not between 1 and 7 or exists(select 1 from jsonb_array_elements(p_pattern->'weekdays') d where jsonb_typeof(d)<>'number' or d::text !~ '^[0-6]$') or (select count(distinct d) from jsonb_array_elements(p_pattern->'weekdays') d)<>jsonb_array_length(p_pattern->'weekdays') then raise exception 'invalid_booking_pattern';end if;
 date_from:=(p_pattern->>'dateFrom')::date;date_to:=(p_pattern->>'dateTo')::date;opening:=(p_pattern->>'opens')::time;closing:=(p_pattern->>'closes')::time;
 if not isfinite(date_from) or not isfinite(date_to) or date_to<date_from or date_to-date_from>=90 or closing<=opening then raise exception 'invalid_booking_pattern';end if;
 step:=s.duration_minutes+s.buffer_minutes;day:=date_from;
 while day<=date_to loop
  if p_pattern->'weekdays' @> jsonb_build_array(extract(dow from day)::integer) then
   wall:=day+opening;
   while wall+make_interval(mins=>step)<=day+closing loop
    starts:=zoi.booking_wall_instant(wall,cfg.timezone);stop_wall:=wall+make_interval(mins=>step);blocked:=zoi.booking_wall_instant(stop_wall,cfg.timezone);finish:=starts+make_interval(mins=>s.duration_minutes);
    if blocked-starts<>make_interval(mins=>step) then raise exception 'booking_dst_crossing';end if;
    if starts<=clock_timestamp() or starts>clock_timestamp()+interval '8760 hours' then raise exception 'invalid_booking_time';end if;
    count_slots:=count_slots+1;if count_slots>200 then raise exception 'booking_plan_too_large';end if;
    select coalesce(jsonb_agg(id order by id),'[]') into conflicts from zoi.booking_slots where resource_id=r.id and active and starts_at<blocked and blocked_until>starts;
    rows:=rows||jsonb_build_array(jsonb_build_object('local_start',to_char(wall,'YYYY-MM-DD"T"HH24:MI'),'starts_at',starts,'ends_at',finish,'blocked_until',blocked,'conflicts',conflicts));
    wall:=stop_wall;
   end loop;
  end if;
  day:=day+1;
 end loop;
 if count_slots=0 then raise exception 'booking_plan_empty';end if;
 insert into zoi.booking_availability_plans(workspace_id,actor_profile_id,service_id,resource_id,settings_version,service_version,resource_version,pattern,slots) values(p_workspace,actor,s.id,r.id,cfg.version,s.version,r.version,p_pattern,rows) returning * into p;
 return jsonb_build_object('ok',true,'plan_id',p.id,'workspace_id',p_workspace,'service_id',s.id,'resource_id',r.id,'timezone',cfg.timezone,'expires_at',p.expires_at,'slots',rows,'settings_version',cfg.version,'service_version',s.version,'resource_version',r.version);
end $$;

create function public.booking_plan_save(p_workspace uuid,p_plan uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;p zoi.booking_availability_plans;r zoi.booking_resources;s zoi.booking_services;cfg zoi.booking_settings;x jsonb;row jsonb;rows jsonb:='[]';v_receipt jsonb;
begin
 actor:=zoi.venue_require_member(p_workspace,true);
 if p_request_id is null then raise exception 'request_id_required';end if;
 select * into p from zoi.booking_availability_plans where id=p_plan and workspace_id=p_workspace and actor_profile_id=actor for update;
 if p.id is null then raise exception 'booking_plan_unavailable' using errcode='42501';end if;
 if p.request_id is not null then
  if p.request_id is distinct from p_request_id then raise exception 'request_id_conflict';end if;
  return p.receipt;
 end if;
 if exists(select 1 from zoi.booking_availability_plans where workspace_id=p_workspace and request_id=p_request_id) then raise exception 'request_id_conflict';end if;
 if p.expires_at<=clock_timestamp() then raise exception 'booking_plan_expired';end if;
 select * into r from zoi.booking_resources where id=p.resource_id and workspace_id=p_workspace for update;
 select * into s from zoi.booking_services where id=p.service_id and workspace_id=p_workspace for share;
 select * into cfg from zoi.booking_settings where workspace_id=p_workspace for share;
 if r.version is distinct from p.resource_version or s.version is distinct from p.service_version or cfg.version is distinct from p.settings_version then raise exception 'version_conflict';end if;
 if not r.active or not s.active then raise exception 'booking_setup_incomplete';end if;
 if p.expires_at<=clock_timestamp() then raise exception 'booking_plan_expired';end if;
 -- Atomic transaction: any newly conflicting slot aborts all rows, including earlier inserts.
 for x in select value from jsonb_array_elements(p.slots) loop
  row:=public.booking_slot_save(p_workspace,null,0,p.service_id,p.resource_id,(x->>'starts_at')::timestamptz,true)->'slot';
  rows:=rows||jsonb_build_array(row);
 end loop;
 v_receipt:=jsonb_build_object('ok',true,'plan_id',p.id,'workspace_id',p_workspace,'slots',rows,'actor_profile_id',actor,'saved_at',clock_timestamp());
 update zoi.booking_availability_plans set request_id=p_request_id,saved_at=clock_timestamp(),receipt=v_receipt where id=p.id;
 return v_receipt;
end $$;

create function public.booking_plan_history(p_workspace uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform zoi.venue_require_member(p_workspace,true);
 return jsonb_build_object('ok',true,'batches',(select coalesce(jsonb_agg(to_jsonb(q) order by q.saved_at desc),'[]') from (select id,actor_profile_id,service_id,resource_id,pattern,saved_at,jsonb_array_length(slots) slot_count from zoi.booking_availability_plans where workspace_id=p_workspace and saved_at is not null order by saved_at desc limit 50)q));
end $$;
revoke all on function public.booking_plan_preview(uuid,uuid,uuid,jsonb),public.booking_plan_save(uuid,uuid,uuid),public.booking_plan_history(uuid) from public,anon,authenticated;
grant execute on function public.booking_plan_preview(uuid,uuid,uuid,jsonb),public.booking_plan_save(uuid,uuid,uuid),public.booking_plan_history(uuid) to authenticated;
commit;
