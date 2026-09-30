begin;
set local lock_timeout='5s';
create table zoi.time_timers(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references zoi.workspaces(id),profile_id uuid not null references zoi.user_profiles(id),request_id uuid not null,initial_data jsonb not null,data jsonb not null,started_at timestamptz not null default clock_timestamp(),status text not null default 'running' check(status in('running','stopped','discarded')),version integer not null default 1,stop_request uuid,entry_id uuid,finished_at timestamptz,unique(profile_id,request_id));
create unique index time_one_running_actor on zoi.time_timers(profile_id) where status='running';
create table zoi.time_entries(id uuid primary key,workspace_id uuid not null references zoi.workspaces(id),profile_id uuid not null references zoi.user_profiles(id),project_id uuid not null references zoi.ops_records(id),task_id uuid references zoi.ops_records(id),started_at timestamptz not null check(isfinite(started_at)),seconds integer not null check(seconds between 1 and 86400),description text not null check(length(description) between 1 and 2000),rate_cents integer not null check(rate_cents between 0 and 1000000),currency text not null check(currency ~ '^[A-Z]{3}$'),billable boolean not null,estimated_cents bigint not null,source text not null check(source in('manual','timer')),timer_id uuid unique references zoi.time_timers(id),initial_data jsonb not null,status text not null default 'draft' check(status in('draft','submitted','approved','returned','voided')),version integer not null default 1,approved_by uuid references zoi.user_profiles(id),approved_at timestamptz,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp());
alter table zoi.time_timers add constraint time_timer_entry_fk foreign key(entry_id) references zoi.time_entries(id);
create table zoi.time_audit(id bigint generated always as identity primary key,workspace_id uuid not null references zoi.workspaces(id),entry_id uuid references zoi.time_entries(id),timer_id uuid references zoi.time_timers(id),actor_id uuid not null references zoi.user_profiles(id),action text not null,reason text not null default '',before_state jsonb,after_state jsonb not null,created_at timestamptz not null default clock_timestamp());
create index time_entries_actor_start on zoi.time_entries(profile_id,started_at);
create index time_entries_workspace_start on zoi.time_entries(workspace_id,started_at);
create index time_timers_actor_created on zoi.time_timers(profile_id,started_at);
create index time_audit_workspace on zoi.time_audit(workspace_id,id desc);
create index time_audit_entry on zoi.time_audit(entry_id,id desc);
alter table zoi.time_timers enable row level security;alter table zoi.time_entries enable row level security;alter table zoi.time_audit enable row level security;
revoke all on zoi.time_timers,zoi.time_entries,zoi.time_audit from public,anon,authenticated;
create function zoi.time_actor(p_workspace uuid,p_manage boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid;role text;
begin
 if auth.uid() is null then raise exception 'time_permission_denied' using errcode='42501';end if;role:=zoi.ops_role(p_workspace);
 if coalesce(role,'') not in('owner','admin','editor') or (p_manage and role not in('owner','admin')) then raise exception 'time_permission_denied' using errcode='42501';end if;
 select id into actor from zoi.user_profiles where auth_user_id=auth.uid();if actor is null then raise exception 'time_permission_denied' using errcode='42501';end if;return actor;
end $$;
create function zoi.time_data(p_workspace uuid,p_data jsonb,p_allow_archived boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare project uuid;task uuid;rate integer;billable boolean;
begin
 if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>12000 or length(btrim(coalesce(p_data->>'description',''))) not between 1 and 2000 or coalesce(p_data->>'currency','') !~ '^[A-Z]{3}$' or jsonb_typeof(p_data->'billable') is distinct from 'boolean' then raise exception 'invalid_time_entry';end if;
 begin project:=(p_data->>'project_id')::uuid;task:=nullif(p_data->>'task_id','')::uuid;rate:=(p_data->>'rate_cents')::integer;billable:=(p_data->>'billable')::boolean;exception when others then raise exception 'invalid_time_entry';end;
 if project is null or rate is null or rate not between 0 and 1000000 then raise exception 'invalid_time_entry';end if;
 perform 1 from zoi.ops_records where id=project and workspace_id=p_workspace and kind='project' and (p_allow_archived or archived_at is null) for share;if not found then raise exception 'time_project_unavailable';end if;
 if task is not null then perform 1 from zoi.ops_records where id=task and workspace_id=p_workspace and project_id=project and kind='task' and (p_allow_archived or archived_at is null) for share;if not found then raise exception 'time_task_unavailable';end if;end if;
 return jsonb_build_object('project_id',project,'task_id',task,'description',btrim(p_data->>'description'),'rate_cents',rate,'currency',p_data->>'currency','billable',billable);
end $$;
create function zoi.time_no_overlap(p_actor uuid,p_entry uuid,p_start timestamptz,p_seconds integer,p_ignore_timer uuid default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from zoi.time_entries where profile_id=p_actor and id is distinct from p_entry and status<>'voided' and started_at<p_start+make_interval(secs=>p_seconds) and started_at+make_interval(secs=>seconds)>p_start) or exists(select 1 from zoi.time_timers where profile_id=p_actor and status='running' and id is distinct from p_ignore_timer and started_at<p_start+make_interval(secs=>p_seconds)) then raise exception 'time_overlap';end if;
end $$;
revoke all on function zoi.time_actor(uuid,boolean),zoi.time_data(uuid,jsonb,boolean),zoi.time_no_overlap(uuid,uuid,timestamptz,integer,uuid) from public,anon,authenticated;
create function public.time_entry_save(p_workspace uuid,p_id uuid,p_expected_version integer,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;e zoi.time_entries;prior zoi.time_entries;data jsonb;starts timestamptz;duration integer;
begin
 actor:=zoi.time_actor(p_workspace);perform 1 from zoi.user_profiles where id=actor for update;if p_id is null then raise exception 'time_entry_id_required';end if;
 select * into prior from zoi.time_entries where id=p_id for update;
 if p_expected_version=0 and prior.id is not null then if prior.workspace_id is distinct from p_workspace or prior.profile_id is distinct from actor or prior.initial_data is distinct from p_data or prior.source<>'manual' then raise exception 'time_request_conflict';end if;return jsonb_build_object('ok',true,'entry',to_jsonb(prior));end if;
 if prior.id is null then if p_expected_version is distinct from 0 then raise exception 'time_version_conflict';end if;else if prior.workspace_id is distinct from p_workspace or prior.profile_id is distinct from actor then raise exception 'time_permission_denied' using errcode='42501';end if;if prior.version is distinct from p_expected_version then raise exception 'time_version_conflict';end if;if prior.status not in('draft','returned') then raise exception 'time_entry_locked';end if;end if;
 data:=zoi.time_data(p_workspace,p_data);
 if coalesce(p_data->>'started_at','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'time_timezone_required';end if;
 begin starts:=(p_data->>'started_at')::timestamptz;duration:=(p_data->>'seconds')::integer;exception when others then raise exception 'invalid_time_entry';end;
 if starts is null or not isfinite(starts) or duration is null or duration not between 1 and 86400 or starts<timestamptz '1900-01-01Z' or starts+make_interval(secs=>duration)>clock_timestamp()+interval '60 seconds' then raise exception 'invalid_time_interval';end if;
 perform zoi.time_no_overlap(actor,p_id,starts,duration);
 if prior.id is null then
  insert into zoi.time_entries(id,workspace_id,profile_id,project_id,task_id,started_at,seconds,description,rate_cents,currency,billable,estimated_cents,source,initial_data) values(p_id,p_workspace,actor,(data->>'project_id')::uuid,(data->>'task_id')::uuid,starts,duration,data->>'description',(data->>'rate_cents')::integer,data->>'currency',(data->>'billable')::boolean,case when (data->>'billable')::boolean then round(duration::numeric*(data->>'rate_cents')::integer/3600)::bigint else 0 end,'manual',p_data) returning * into e;
 else
  update zoi.time_entries set project_id=(data->>'project_id')::uuid,task_id=(data->>'task_id')::uuid,started_at=starts,seconds=duration,description=data->>'description',rate_cents=(data->>'rate_cents')::integer,currency=data->>'currency',billable=(data->>'billable')::boolean,estimated_cents=case when (data->>'billable')::boolean then round(duration::numeric*(data->>'rate_cents')::integer/3600)::bigint else 0 end,source='manual',status='draft',version=version+1,updated_at=clock_timestamp() where id=p_id returning * into e;
 end if;
 insert into zoi.time_audit(workspace_id,entry_id,actor_id,action,before_state,after_state) values(p_workspace,e.id,actor,case when prior.id is null then 'manual_created' else 'entry_edited' end,case when prior.id is null then null else to_jsonb(prior) end,to_jsonb(e));
 return jsonb_build_object('ok',true,'entry',to_jsonb(e));
end $$;
create function public.time_timer_start(p_workspace uuid,p_request uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;t zoi.time_timers;data jsonb;starts timestamptz;
begin
 actor:=zoi.time_actor(p_workspace);perform 1 from zoi.user_profiles where id=actor for update;if p_request is null then raise exception 'invalid_time_request';end if;
 select * into t from zoi.time_timers where profile_id=actor and request_id=p_request;
 if t.id is not null then if t.workspace_id is distinct from p_workspace or t.initial_data is distinct from p_data then raise exception 'time_request_conflict';end if;return jsonb_build_object('ok',true,'timer',to_jsonb(t));end if;
 if exists(select 1 from zoi.time_timers where profile_id=actor and status='running') then raise exception 'time_timer_already_running';end if;
 data:=zoi.time_data(p_workspace,p_data);starts:=clock_timestamp();perform zoi.time_no_overlap(actor,null,starts,1);
 insert into zoi.time_timers(workspace_id,profile_id,request_id,initial_data,data,started_at) values(p_workspace,actor,p_request,p_data,data,starts) returning * into t;
 insert into zoi.time_audit(workspace_id,timer_id,actor_id,action,after_state) values(p_workspace,t.id,actor,'timer_started',to_jsonb(t));
 return jsonb_build_object('ok',true,'timer',to_jsonb(t));
end $$;
create function public.time_timer_stop(p_workspace uuid,p_timer uuid,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;t zoi.time_timers;prior zoi.time_timers;e zoi.time_entries;data jsonb;duration integer;
begin
 actor:=zoi.time_actor(p_workspace);perform 1 from zoi.user_profiles where id=actor for update;if p_request is null then raise exception 'invalid_time_request';end if;
 select * into prior from zoi.time_timers where id=p_timer and workspace_id=p_workspace and profile_id=actor for update;if prior.id is null then raise exception 'time_timer_unavailable';end if;
 if prior.status='stopped' then if prior.stop_request is distinct from p_request then raise exception 'time_request_conflict';end if;select * into e from zoi.time_entries where id=prior.entry_id;return jsonb_build_object('ok',true,'timer',to_jsonb(prior),'entry',to_jsonb(e));end if;
 if prior.status<>'running' then raise exception 'time_timer_not_running';end if;
 duration:=greatest(1,floor(extract(epoch from clock_timestamp()-prior.started_at))::integer);if duration>86400 then raise exception 'time_timer_requires_correction';end if;
 data:=zoi.time_data(p_workspace,prior.data,true);perform zoi.time_no_overlap(actor,null,prior.started_at,duration,prior.id);
 insert into zoi.time_entries(id,workspace_id,profile_id,project_id,task_id,started_at,seconds,description,rate_cents,currency,billable,estimated_cents,source,timer_id,initial_data) values(gen_random_uuid(),p_workspace,actor,(data->>'project_id')::uuid,(data->>'task_id')::uuid,prior.started_at,duration,data->>'description',(data->>'rate_cents')::integer,data->>'currency',(data->>'billable')::boolean,case when (data->>'billable')::boolean then round(duration::numeric*(data->>'rate_cents')::integer/3600)::bigint else 0 end,'timer',prior.id,data) returning * into e;
 update zoi.time_timers set status='stopped',version=version+1,stop_request=p_request,entry_id=e.id,finished_at=clock_timestamp() where id=prior.id returning * into t;
 insert into zoi.time_audit(workspace_id,entry_id,timer_id,actor_id,action,before_state,after_state) values(p_workspace,e.id,t.id,actor,'timer_stopped',to_jsonb(prior),jsonb_build_object('timer',to_jsonb(t),'entry',to_jsonb(e)));
 return jsonb_build_object('ok',true,'timer',to_jsonb(t),'entry',to_jsonb(e));
end $$;
create function public.time_timer_discard(p_workspace uuid,p_timer uuid,p_expected_version integer,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;t zoi.time_timers;prior zoi.time_timers;
begin
 actor:=zoi.time_actor(p_workspace);perform 1 from zoi.user_profiles where id=actor for update;
 select * into prior from zoi.time_timers where id=p_timer and workspace_id=p_workspace and profile_id=actor for update;if prior.id is null then raise exception 'time_timer_unavailable';end if;
 if prior.version is distinct from p_expected_version then raise exception 'time_version_conflict';end if;if prior.status<>'running' then raise exception 'time_timer_not_running';end if;
 if length(btrim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'time_reason_required';end if;
 update zoi.time_timers set status='discarded',version=version+1,finished_at=clock_timestamp() where id=prior.id returning * into t;
 insert into zoi.time_audit(workspace_id,timer_id,actor_id,action,reason,before_state,after_state) values(p_workspace,t.id,actor,'timer_discarded',btrim(p_reason),to_jsonb(prior),to_jsonb(t));
 return jsonb_build_object('ok',true,'timer',to_jsonb(t));
end $$;
create function public.time_entry_transition(p_workspace uuid,p_entry uuid,p_expected_version integer,p_action text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;admin boolean;prior zoi.time_entries;e zoi.time_entries;new_status text;
begin
 actor:=zoi.time_actor(p_workspace);admin:=zoi.ops_role(p_workspace) in('owner','admin');
 select * into prior from zoi.time_entries where id=p_entry and workspace_id=p_workspace for update;
 if prior.id is null or (prior.profile_id<>actor and not admin) then raise exception 'time_permission_denied' using errcode='42501';end if;
 if prior.version is distinct from p_expected_version then raise exception 'time_version_conflict';end if;
 if p_action='submit' and prior.profile_id=actor and prior.status in('draft','returned') then new_status:='submitted';
 elsif p_action='withdraw' and prior.profile_id=actor and prior.status='submitted' then new_status:='draft';
 elsif p_action='approve' and admin and prior.status='submitted' then new_status:='approved';
 elsif p_action='return' and admin and prior.status='submitted' then new_status:='returned';
 elsif p_action='void' and ((admin and prior.status='approved') or (prior.profile_id=actor and prior.status in('draft','returned'))) then new_status:='voided';
 else raise exception 'time_transition_not_allowed';end if;
 if length(coalesce(p_reason,''))>1000 or (p_action in('return','void') and btrim(coalesce(p_reason,''))='') then raise exception 'time_reason_required';end if;
 update zoi.time_entries set status=new_status,version=version+1,approved_by=case when new_status='approved' then actor else approved_by end,approved_at=case when new_status='approved' then clock_timestamp() else approved_at end,updated_at=clock_timestamp() where id=prior.id returning * into e;
 insert into zoi.time_audit(workspace_id,entry_id,actor_id,action,reason,before_state,after_state) values(p_workspace,e.id,actor,p_action,coalesce(p_reason,''),to_jsonb(prior),to_jsonb(e));
 return jsonb_build_object('ok',true,'entry',to_jsonb(e));
end $$;
create function zoi.time_range(p_from timestamptz,p_to timestamptz) returns void language plpgsql immutable set search_path='' as $$
begin if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_to<=p_from or p_to-p_from>interval '93 days' then raise exception 'invalid_time_range';end if;end $$;
revoke all on function zoi.time_range(timestamptz,timestamptz) from public,anon,authenticated;
create function public.timekeeping_dashboard(p_workspace uuid,p_from timestamptz,p_to timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;role text;admin boolean;entries jsonb;projects jsonb;tasks jsonb;members jsonb;active jsonb;totals jsonb;other_workspace boolean;timer_audit jsonb;
begin
 actor:=zoi.time_actor(p_workspace);role:=zoi.ops_role(p_workspace);admin:=role in('owner','admin');perform zoi.time_range(p_from,p_to);
 if (select count(*) from zoi.time_entries where workspace_id=p_workspace and started_at>=p_from and started_at<p_to and (admin or profile_id=actor))>1000 then raise exception 'time_narrow_range';end if;
 select coalesce(jsonb_agg(to_jsonb(e) order by started_at desc,id),'[]') into entries from(select e.*,p.title as project_title,t.title as task_title,coalesce(u.display_name,'Team member') as display_name,(select a.reason from zoi.time_audit a where a.entry_id=e.id and a.action in('return','void') order by a.id desc limit 1) as review_reason from zoi.time_entries e join zoi.ops_records p on p.id=e.project_id left join zoi.ops_records t on t.id=e.task_id join zoi.user_profiles u on u.id=e.profile_id where e.workspace_id=p_workspace and e.started_at>=p_from and e.started_at<p_to and (admin or e.profile_id=actor))e;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title) order by title),'[]') into projects from zoi.ops_records where workspace_id=p_workspace and kind='project' and archived_at is null;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'project_id',project_id) order by title),'[]') into tasks from zoi.ops_records where workspace_id=p_workspace and kind='task' and archived_at is null;
 if admin then select coalesce(jsonb_agg(jsonb_build_object('profile_id',m.profile_id,'display_name',coalesce(p.display_name,'Team member'),'role',m.role)),'[]') into members from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id=p_workspace and m.role in('owner','admin','editor');else members:='[]';end if;
 select to_jsonb(t) into active from zoi.time_timers t where profile_id=actor and workspace_id=p_workspace and status='running';
 other_workspace:=exists(select 1 from zoi.time_timers where profile_id=actor and workspace_id<>p_workspace and status='running');
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into totals from(select currency,sum(seconds) as seconds,sum(case when billable then seconds else 0 end) as billable_seconds,sum(estimated_cents) as estimated_cents from zoi.time_entries where workspace_id=p_workspace and started_at>=p_from and started_at<p_to and status='approved' and (admin or profile_id=actor) group by currency order by currency)t;
 select coalesce(jsonb_agg(to_jsonb(a) order by id desc),'[]') into timer_audit from(select id,timer_id,actor_id,action,reason,created_at from zoi.time_audit where workspace_id=p_workspace and timer_id is not null and (admin or actor_id=actor) order by id desc limit 30)a;
 return jsonb_build_object('ok',true,'timer_audit',timer_audit,'role',role,'actor_id',actor,'entries',entries,'projects',projects,'tasks',tasks,'members',members,'active_timer',active,'active_other_workspace',other_workspace,'totals',totals,'server_now',clock_timestamp());
end $$;
create function public.time_entry_history(p_workspace uuid,p_entry uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;e zoi.time_entries;audit jsonb;
begin
 actor:=zoi.time_actor(p_workspace);select * into e from zoi.time_entries where id=p_entry and workspace_id=p_workspace;if e.id is null or (e.profile_id<>actor and zoi.ops_role(p_workspace) not in('owner','admin')) then raise exception 'time_permission_denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(a) order by id desc),'[]') into audit from(select * from zoi.time_audit where entry_id=e.id order by id desc limit 100)a;
 return jsonb_build_object('ok',true,'entry',to_jsonb(e),'audit',audit);
end $$;
create function public.timekeeping_export(p_workspace uuid,p_from timestamptz,p_to timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;admin boolean;entries jsonb;totals jsonb;
begin
 actor:=zoi.time_actor(p_workspace);admin:=zoi.ops_role(p_workspace) in('owner','admin');perform zoi.time_range(p_from,p_to);
 if (select count(*) from zoi.time_entries where workspace_id=p_workspace and started_at>=p_from and started_at<p_to and status='approved' and (admin or profile_id=actor))>5000 then raise exception 'time_narrow_range';end if;
 select coalesce(jsonb_agg(to_jsonb(e) order by started_at,id),'[]') into entries from(select e.id,e.profile_id,p.title as project_title,t.title as task_title,coalesce(u.display_name,'Team member') as display_name,e.started_at,e.seconds,e.description,e.rate_cents,e.currency,e.billable,e.estimated_cents,e.source,e.approved_by,e.approved_at,e.version from zoi.time_entries e join zoi.ops_records p on p.id=e.project_id left join zoi.ops_records t on t.id=e.task_id join zoi.user_profiles u on u.id=e.profile_id where e.workspace_id=p_workspace and e.started_at>=p_from and e.started_at<p_to and e.status='approved' and (admin or e.profile_id=actor))e;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into totals from(select currency,sum(seconds) as seconds,sum(case when billable then seconds else 0 end) as billable_seconds,sum(estimated_cents) as estimated_cents from zoi.time_entries where workspace_id=p_workspace and started_at>=p_from and started_at<p_to and status='approved' and (admin or profile_id=actor) group by currency order by currency)t;
 return jsonb_build_object('ok',true,'entries',entries,'totals',totals,'generated_at',clock_timestamp());
end $$;
revoke all on function public.time_entry_save(uuid,uuid,integer,jsonb),public.time_timer_start(uuid,uuid,jsonb),public.time_timer_stop(uuid,uuid,uuid),public.time_timer_discard(uuid,uuid,integer,text),public.time_entry_transition(uuid,uuid,integer,text,text),public.timekeeping_dashboard(uuid,timestamptz,timestamptz),public.time_entry_history(uuid,uuid),public.timekeeping_export(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.time_entry_save(uuid,uuid,integer,jsonb),public.time_timer_start(uuid,uuid,jsonb),public.time_timer_stop(uuid,uuid,uuid),public.time_timer_discard(uuid,uuid,integer,text),public.time_entry_transition(uuid,uuid,integer,text,text),public.timekeeping_dashboard(uuid,timestamptz,timestamptz),public.time_entry_history(uuid,uuid),public.timekeeping_export(uuid,timestamptz,timestamptz) to authenticated;
commit;
