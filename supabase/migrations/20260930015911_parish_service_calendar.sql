begin;
set local lock_timeout='5s';
-- Coordinator-authored dates for parishes, dance groups and community organizations.
create table zoi.org_calendar_events(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references zoi.workspaces(id),listing_id uuid not null references zoi.listings(id),
 kind text not null check(kind in('service','rehearsal','class','meeting','festival')),title text not null check(length(title) between 1 and 200),description text not null default '' check(length(description)<=10000),location text not null default '' check(length(location)<=500),
 starts_at timestamptz not null,ends_at timestamptz not null,timezone text not null,status text not null default 'draft' check(status in('draft','published','cancelled')),version integer not null default 1,
 program_id uuid,volunteer_title text not null default '' check(length(volunteer_title)<=200),capacity integer not null default 1 check(capacity between 1 and 500),shift_id uuid,
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),published_at timestamptz,
 foreign key(workspace_id,program_id) references zoi.org_programs(workspace_id,id),foreign key(workspace_id,shift_id) references zoi.org_shifts(workspace_id,id),check(ends_at>starts_at)
);
create index org_calendar_events_listing_date on zoi.org_calendar_events(listing_id,starts_at);
create index org_calendar_events_workspace_date on zoi.org_calendar_events(workspace_id,starts_at);
create unique index org_calendar_events_deduplicate on zoi.org_calendar_events(listing_id,starts_at,title) where status<>'cancelled';
create table zoi.org_calendar_batches(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references zoi.workspaces(id),request_id uuid not null,actor_profile_id uuid not null references zoi.user_profiles(id),payload jsonb not null,receipt jsonb not null,created_at timestamptz not null default clock_timestamp(),unique(workspace_id,request_id));
alter table zoi.org_calendar_events enable row level security;
alter table zoi.org_calendar_batches enable row level security;
revoke all on zoi.org_calendar_events,zoi.org_calendar_batches from public,anon,authenticated;

create function public.org_calendar_meta(p_workspace uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare role text:=zoi.org_role(p_workspace);
begin
 if role is null then raise exception 'not_authorized' using errcode='42501';end if;
 if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_to<=p_from or p_to-p_from>interval '93 days' then raise exception 'invalid_date_range';end if;
 return jsonb_build_object('ok',true,'role',role,
 'listings',(select coalesce(jsonb_agg(to_jsonb(q)),'[]') from(select id,name,publish_status,marketplace_status from zoi.listings where owner_workspace_id=p_workspace order by name,id limit 100)q),
 'programs',(select coalesce(jsonb_agg(to_jsonb(q)),'[]') from(select id,title,status,version from zoi.org_programs where workspace_id=p_workspace and status<>'archived' order by title,id)q),
 'events',(select coalesce(jsonb_agg(to_jsonb(q) order by q.starts_at,q.id),'[]') from(select * from zoi.org_calendar_events where workspace_id=p_workspace and starts_at>=p_from and starts_at<p_to order by starts_at,id limit 501)q));
end $$;

create function zoi.org_calendar_plan(p_workspace uuid,p_data jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare listing zoi.listings;program zoi.org_programs;pattern jsonb;timezone text;day date;last_day date;opening time;closing time;starts timestamptz;ends timestamptz;rows jsonb:='[]';conflicts jsonb;total integer:=0;
begin
 if jsonb_typeof(p_data) is distinct from 'object' or length(p_data::text)>20000 or length(btrim(coalesce(p_data->>'title',''))) not between 1 and 200 or length(coalesce(p_data->>'description',''))>10000 or length(coalesce(p_data->>'location',''))>500 or coalesce(p_data->>'kind','') not in('service','rehearsal','class','meeting','festival') or coalesce(p_data->>'status','') not in('draft','published') then raise exception 'invalid_calendar_details';end if;
 select * into listing from zoi.listings where id=(p_data->>'listing_id')::uuid and owner_workspace_id=p_workspace for share;
 if listing.id is null then raise exception 'owned_listing_required';end if;
 if p_data->>'status'='published' and (listing.publish_status is distinct from 'published' or coalesce(listing.marketplace_status,'')='hidden') then raise exception 'public_owned_listing_required';end if;
 if nullif(p_data->>'program_id','') is not null then
  select * into program from zoi.org_programs where id=(p_data->>'program_id')::uuid and workspace_id=p_workspace for share;
  if program.id is null or program.status='archived' then raise exception 'program_not_found';end if;
  if program.version is distinct from (p_data->>'program_version')::integer then raise exception 'version_conflict';end if;
  if length(btrim(coalesce(p_data->>'volunteer_title',''))) not between 1 and 200 or coalesce((p_data->>'capacity')::integer,0) not between 1 and 500 then raise exception 'invalid_volunteer_details';end if;
  if p_data->>'status'='published' and program.status<>'published' then raise exception 'publish_volunteer_program_first';end if;
 end if;
 timezone:=p_data->>'timezone';if not exists(select 1 from pg_catalog.pg_timezone_names where name=timezone) then raise exception 'invalid_timezone';end if;
 pattern:=p_data->'pattern';
 if jsonb_typeof(pattern) is distinct from 'object' or coalesce(pattern->>'dateFrom','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(pattern->>'dateTo','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(pattern->>'opens','') !~ '^([01]\d|2[0-3]):[0-5]\d$' or coalesce(pattern->>'closes','') !~ '^([01]\d|2[0-3]):[0-5]\d$' or jsonb_typeof(pattern->'weekdays') is distinct from 'array' then raise exception 'invalid_calendar_pattern';end if;
 if jsonb_array_length(pattern->'weekdays') not between 1 and 7 or exists(select 1 from jsonb_array_elements(pattern->'weekdays') d where jsonb_typeof(d)<>'number' or d::text !~ '^[0-6]$') or (select count(distinct d) from jsonb_array_elements(pattern->'weekdays') d)<>jsonb_array_length(pattern->'weekdays') then raise exception 'invalid_calendar_pattern';end if;
 day:=(pattern->>'dateFrom')::date;last_day:=(pattern->>'dateTo')::date;opening:=(pattern->>'opens')::time;closing:=(pattern->>'closes')::time;
 if not isfinite(day) or not isfinite(last_day) or last_day<day or last_day-day>=90 or closing-opening<interval '5 minutes' or closing-opening>interval '8 hours' then raise exception 'invalid_calendar_pattern';end if;
 while day<=last_day loop
  if pattern->'weekdays' @> jsonb_build_array(extract(dow from day)::integer) then
   starts:=zoi.booking_wall_instant(day+opening,timezone);ends:=zoi.booking_wall_instant(day+closing,timezone);
   if ends-starts<>closing-opening then raise exception 'booking_dst_crossing';end if;
   if starts<=clock_timestamp() or starts>clock_timestamp()+interval '8760 hours' then raise exception 'calendar_start_must_be_future';end if;
   total:=total+1;if total>60 then raise exception 'calendar_plan_too_large';end if;
   select coalesce(jsonb_agg(id order by id),'[]') into conflicts from zoi.org_calendar_events where listing_id=listing.id and status<>'cancelled' and title=btrim(p_data->>'title') and starts_at=starts;
   rows:=rows||jsonb_build_array(jsonb_build_object('starts_at',starts,'ends_at',ends,'conflicts',conflicts));
  end if;
  day:=day+1;
 end loop;
 if total=0 then raise exception 'calendar_plan_empty';end if;
 return jsonb_build_object('ok',true,'workspace_id',p_workspace,'listing_id',listing.id,'timezone',timezone,'occurrences',rows);
end $$;
revoke all on function zoi.org_calendar_plan(uuid,jsonb) from public,anon,authenticated;

create function public.org_calendar_preview(p_workspace uuid,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if coalesce(zoi.org_role(p_workspace),'') not in('owner','admin','editor') then raise exception 'not_authorized' using errcode='42501';end if;
 return zoi.org_calendar_plan(p_workspace,p_data);
end $$;

create function public.org_calendar_event_set(p_workspace uuid,p_event uuid,p_expected_version integer,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=zoi.org_actor();e zoi.org_calendar_events;program zoi.org_programs;shift zoi.org_shifts;row jsonb;listing zoi.listings;
begin
 if actor is null or coalesce(zoi.org_role(p_workspace),'') not in('owner','admin','editor') then raise exception 'not_authorized' using errcode='42501';end if;
 if p_status is null or p_status not in('published','cancelled') then raise exception 'invalid_calendar_status';end if;
 perform pg_advisory_xact_lock(hashtextextended('org_calendar:'||p_workspace::text,0));
 select * into e from zoi.org_calendar_events where id=p_event and workspace_id=p_workspace;
 if e.id is null then raise exception 'calendar_event_unavailable';end if;
 select * into listing from zoi.listings where id=e.listing_id and owner_workspace_id=p_workspace for share;
 if listing.id is null and p_status='published' then raise exception 'owned_listing_required';end if;
 if e.program_id is not null then select * into program from zoi.org_programs where id=e.program_id and workspace_id=p_workspace for share;end if;
 select * into e from zoi.org_calendar_events where id=p_event and workspace_id=p_workspace for update;
 -- Repeating the exact version transition is safe; stale retries after another change are rejected.
 if e.status=p_status and e.version=p_expected_version+1 then return jsonb_build_object('ok',true,'event',to_jsonb(e));end if;
 if e.version is distinct from p_expected_version then raise exception 'version_conflict';end if;
 if e.status='cancelled' then raise exception 'cancelled_event_cannot_reopen';end if;
 if p_status='published' then
  if e.status<>'draft' or e.starts_at<=clock_timestamp() then raise exception 'calendar_event_not_publishable';end if;
  if listing.publish_status is distinct from 'published' or coalesce(listing.marketplace_status,'')='hidden' then raise exception 'public_owned_listing_required';end if;
  if e.program_id is not null then
   if program.status is distinct from 'published' then raise exception 'publish_volunteer_program_first';end if;
   row:=public.org_shift_save(p_workspace,e.program_id,e.volunteer_title,e.location,e.starts_at,e.ends_at,e.timezone,e.capacity,'scheduled',null,0)->'shift';
   e.shift_id:=(row->>'id')::uuid;
  end if;
 elsif e.shift_id is not null then
  select * into shift from zoi.org_shifts where id=e.shift_id and workspace_id=p_workspace;
  if shift.id is null then raise exception 'linked_shift_missing';end if;
  if shift.status<>'cancelled' then
   perform public.org_shift_save(p_workspace,shift.program_id,shift.title,shift.location,shift.starts_at,shift.ends_at,shift.timezone,shift.capacity,'cancelled',shift.id,shift.version);
  end if;
 end if;
 update zoi.org_calendar_events set status=p_status,shift_id=e.shift_id,version=version+1,published_at=case when p_status='published' then clock_timestamp() else published_at end,updated_at=clock_timestamp() where id=e.id returning * into e;
 insert into zoi.org_audit(workspace_id,entity_id,action,actor_profile_id) values(p_workspace,e.id,'calendar_'||p_status,actor);
 return jsonb_build_object('ok',true,'event',to_jsonb(e));
end $$;

create function public.org_calendar_batch_save(p_workspace uuid,p_request_id uuid,p_data jsonb,p_expected_occurrences jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=zoi.org_actor();prior zoi.org_calendar_batches;plan jsonb;x jsonb;expected jsonb;rows jsonb:='[]';payload jsonb;event zoi.org_calendar_events;v_receipt jsonb;batch_id uuid:=gen_random_uuid();i integer:=0;
begin
 if actor is null or coalesce(zoi.org_role(p_workspace),'') not in('owner','admin','editor') then raise exception 'not_authorized' using errcode='42501';end if;
 if p_request_id is null then raise exception 'request_id_required';end if;
 payload:=jsonb_build_object('data',p_data,'occurrences',p_expected_occurrences);
 perform pg_advisory_xact_lock(hashtextextended('org_calendar:'||p_workspace::text,0));
 select * into prior from zoi.org_calendar_batches where workspace_id=p_workspace and request_id=p_request_id;
 if prior.id is not null then
  if prior.actor_profile_id<>actor or prior.payload is distinct from payload then raise exception 'request_id_conflict';end if;
  return prior.receipt;
 end if;
 plan:=zoi.org_calendar_plan(p_workspace,p_data);
 if jsonb_typeof(p_expected_occurrences) is distinct from 'array' or jsonb_array_length(p_expected_occurrences)<>jsonb_array_length(plan->'occurrences') then raise exception 'calendar_preview_changed';end if;
 for x in select value from jsonb_array_elements(plan->'occurrences') loop
  expected:=p_expected_occurrences->i;i:=i+1;
  if (expected->>'starts_at')::timestamptz is distinct from (x->>'starts_at')::timestamptz or (expected->>'ends_at')::timestamptz is distinct from (x->>'ends_at')::timestamptz then raise exception 'calendar_preview_changed';end if;
  if jsonb_array_length(x->'conflicts')>0 then raise exception 'calendar_occurrence_exists';end if;
  insert into zoi.org_calendar_events(workspace_id,listing_id,kind,title,description,location,starts_at,ends_at,timezone,program_id,volunteer_title,capacity)
  values(p_workspace,(p_data->>'listing_id')::uuid,p_data->>'kind',btrim(p_data->>'title'),coalesce(p_data->>'description',''),coalesce(p_data->>'location',''),(x->>'starts_at')::timestamptz,(x->>'ends_at')::timestamptz,p_data->>'timezone',nullif(p_data->>'program_id','')::uuid,coalesce(p_data->>'volunteer_title',''),case when nullif(p_data->>'program_id','') is null then 1 else (p_data->>'capacity')::integer end) returning * into event;
  insert into zoi.org_audit(workspace_id,entity_id,action,actor_profile_id) values(p_workspace,event.id,'calendar_created',actor);
  if p_data->>'status'='published' then
   rows:=rows||jsonb_build_array(public.org_calendar_event_set(p_workspace,event.id,1,'published')->'event');
  else rows:=rows||jsonb_build_array(to_jsonb(event));end if;
 end loop;
 v_receipt:=jsonb_build_object('ok',true,'batch_id',batch_id,'workspace_id',p_workspace,'events',rows);
 insert into zoi.org_calendar_batches(id,workspace_id,request_id,actor_profile_id,payload,receipt) values(batch_id,p_workspace,p_request_id,actor,payload,v_receipt);
 return v_receipt;
end $$;

create function public.org_calendar_public(p_listing uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare listing zoi.listings;rows jsonb;
begin
 if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_to<=p_from or p_to-p_from>interval '93 days' then raise exception 'invalid_date_range';end if;
 select * into listing from zoi.listings where id=p_listing and publish_status='published' and coalesce(marketplace_status,'')<>'hidden';
 if listing.id is null then return jsonb_build_object('ok',true,'available',false,'events','[]'::jsonb);end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'listing_id',e.listing_id,'workspace_id',e.workspace_id,'kind',e.kind,'title',e.title,'description',e.description,'location',e.location,'starts_at',e.starts_at,'ends_at',e.ends_at,'timezone',e.timezone,'status',e.status,'version',e.version,'updated_at',e.updated_at,
 'volunteer_shift_id',case when e.status='published' and p.status='published' and s.status='scheduled' then e.shift_id else null end) order by e.starts_at,e.id),'[]') into rows
 from (select * from zoi.org_calendar_events where listing_id=p_listing and workspace_id=listing.owner_workspace_id and published_at is not null and status in('published','cancelled') and starts_at>=p_from and starts_at<p_to order by starts_at,id limit 501)e
 left join zoi.org_shifts s on s.id=e.shift_id and s.workspace_id=e.workspace_id left join zoi.org_programs p on p.id=s.program_id and p.workspace_id=e.workspace_id;
 return jsonb_build_object('ok',true,'available',true,'listing_id',listing.id,'name',listing.name,'events',rows);
end $$;

create function public.org_calendar_audit(p_workspace uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if coalesce(zoi.org_role(p_workspace),'') not in('owner','admin','editor') then raise exception 'not_authorized' using errcode='42501';end if;
 return jsonb_build_object('ok',true,'changes',(select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]') from(select * from zoi.org_audit where workspace_id=p_workspace and action in('calendar_created','calendar_published','calendar_cancelled') order by created_at desc,id desc limit 100)q));
end $$;
revoke all on function public.org_calendar_meta(uuid,timestamptz,timestamptz),public.org_calendar_preview(uuid,jsonb),public.org_calendar_batch_save(uuid,uuid,jsonb,jsonb),public.org_calendar_event_set(uuid,uuid,integer,text),public.org_calendar_public(uuid,timestamptz,timestamptz),public.org_calendar_audit(uuid) from public,anon,authenticated;
grant execute on function public.org_calendar_meta(uuid,timestamptz,timestamptz),public.org_calendar_preview(uuid,jsonb),public.org_calendar_batch_save(uuid,uuid,jsonb,jsonb),public.org_calendar_event_set(uuid,uuid,integer,text),public.org_calendar_audit(uuid) to authenticated;
grant execute on function public.org_calendar_public(uuid,timestamptz,timestamptz) to anon,authenticated;
commit;
