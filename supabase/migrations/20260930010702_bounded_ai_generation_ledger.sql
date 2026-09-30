begin;
set local lock_timeout='5s';
-- Pricing snapshot: https://platform.claude.com/docs/en/about-claude/pricing, verified 2026-09-30.
-- USD estimates from provider-reported tokens are not invoice charges.
create table zoi.ai_runtime(singleton boolean primary key default true check(singleton),enabled boolean not null default false,model text not null default 'claude-haiku-4-5-20251001' check(model='claude-haiku-4-5-20251001'),pricing_date date not null default '2026-09-30',input_micro_usd_per_token integer not null default 1 check(input_micro_usd_per_token=1),output_micro_usd_per_token integer not null default 5 check(output_micro_usd_per_token=5),reserved_input_tokens integer not null default 20000 check(reserved_input_tokens=20000),max_output_tokens integer not null default 2048 check(max_output_tokens=2048),global_daily_micro_usd bigint not null default 1000000 check(global_daily_micro_usd between 0 and 10000000),workspace_daily_micro_usd bigint not null default 100000 check(workspace_daily_micro_usd between 0 and 1000000),user_daily_micro_usd bigint not null default 100000 check(user_daily_micro_usd between 0 and 1000000),user_daily_requests integer not null default 5 check(user_daily_requests between 1 and 20),user_minute_requests integer not null default 2 check(user_minute_requests between 1 and 5));
insert into zoi.ai_runtime(singleton) values(true);
create table zoi.ai_generations(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references zoi.workspaces(id),profile_id uuid not null references zoi.user_profiles(id),request_id uuid not null,input_hash text not null check(input_hash ~ '^[a-f0-9]{64}$'),action text not null check(action in ('week','caption','reply')),input text not null check(octet_length(input)<=6000),requested_count integer not null check(requested_count between 1 and 14),profile_snapshot jsonb not null,model text not null,pricing_date date not null,input_rate integer not null,output_rate integer not null,max_output_tokens integer not null,reserved_input_tokens integer not null,status text not null default 'pending' check(status in ('pending','succeeded','failed','unknown')),result jsonb,raw_output text,error_code text,provider_input_tokens integer,provider_output_tokens integer,estimated_micro_usd bigint,budget_debit_micro_usd bigint not null,created_at timestamptz not null default clock_timestamp(),completed_at timestamptz,unique(profile_id,request_id));
create index ai_generations_created on zoi.ai_generations(created_at);
create index ai_generations_workspace_created on zoi.ai_generations(workspace_id,created_at desc);
create index ai_generations_actor_created on zoi.ai_generations(profile_id,created_at desc);
alter table zoi.ai_runtime enable row level security;
alter table zoi.ai_generations enable row level security;
revoke all on zoi.ai_runtime,zoi.ai_generations from public,anon,authenticated;

create or replace function public.ai_profile_get(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or zoi.ops_role(p_workspace) is null then raise exception 'not_authorized' using errcode='42501';end if;
 return coalesce((select to_jsonb(a) from zoi.ai_profiles a where workspace_id=p_workspace),'{}');
end $$;
create or replace function public.ai_profile_save(p_workspace uuid,p_business text,p_about text,p_tone text,p_languages text,p_sample text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(zoi.ops_role(p_workspace),'') not in ('owner','admin','editor') then raise exception 'insufficient_permission' using errcode='42501';end if;
 if length(coalesce(p_business,''))>120 or length(coalesce(p_about,''))>1500 or length(coalesce(p_tone,''))>80 or length(coalesce(p_languages,''))>160 or length(coalesce(p_sample,''))>2000 then raise exception 'ai_profile_too_large';end if;
 insert into zoi.ai_profiles(workspace_id,business_name,about,tone,languages,sample,updated_at) values(p_workspace,p_business,p_about,p_tone,coalesce(p_languages,'Greek and English'),p_sample,now()) on conflict(workspace_id) do update set business_name=excluded.business_name,about=excluded.about,tone=excluded.tone,languages=excluded.languages,sample=excluded.sample,updated_at=now();
end $$;
revoke all on function public.ai_profile_get(uuid),public.ai_profile_save(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.ai_profile_get(uuid),public.ai_profile_save(uuid,text,text,text,text,text) to authenticated;

-- Only the authenticated Edge worker may reserve/settle provider calls.
create function public.ai_generation_begin(p_actor_auth uuid,p_workspace uuid,p_request uuid,p_hash text,p_action text,p_input text,p_count integer,p_profile jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;role text;cfg zoi.ai_runtime;g zoi.ai_generations;reserve bigint;day_start timestamptz;
begin
 select p.id,m.role into actor,role from zoi.user_profiles p join zoi.workspace_members m on m.profile_id=p.id where p.auth_user_id=p_actor_auth and m.workspace_id=p_workspace;
 if actor is null or role not in ('owner','admin','editor') then raise exception 'ai_generation_not_allowed' using errcode='42501';end if;
 if p_request is null or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_action is null or p_action not in ('week','caption','reply') or p_input is null or octet_length(p_input)>6000 or p_count is null or p_count not between 1 and 14 or jsonb_typeof(p_profile) is distinct from 'object' or octet_length(p_profile::text)>12000 then raise exception 'invalid_generation_request';end if;
 select * into cfg from zoi.ai_runtime where singleton for update;
 select * into g from zoi.ai_generations where profile_id=actor and request_id=p_request;
 if g.id is not null then
  if g.workspace_id is distinct from p_workspace or g.input_hash is distinct from p_hash or g.action is distinct from p_action or g.input is distinct from p_input or g.requested_count is distinct from p_count then raise exception 'generation_request_conflict';end if;
  return jsonb_build_object('ok',true,'dispatch',false,'generation',to_jsonb(g));
 end if;
 if not cfg.enabled then return jsonb_build_object('ok',true,'available',false,'reason','budget_disabled');end if;
 reserve:=cfg.reserved_input_tokens*cfg.input_micro_usd_per_token+cfg.max_output_tokens*cfg.output_micro_usd_per_token;
 day_start:=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC';
 if (select count(*) from zoi.ai_generations where profile_id=actor and created_at>=clock_timestamp()-interval '1 minute')>=cfg.user_minute_requests then raise exception 'generation_rate_limit';end if;
 if (select count(*) from zoi.ai_generations where profile_id=actor and created_at>=day_start)>=cfg.user_daily_requests then raise exception 'generation_daily_limit';end if;
 if (select coalesce(sum(budget_debit_micro_usd),0) from zoi.ai_generations where created_at>=day_start)+reserve>cfg.global_daily_micro_usd then raise exception 'generation_global_budget_limit';end if;
 if (select coalesce(sum(budget_debit_micro_usd),0) from zoi.ai_generations where workspace_id=p_workspace and created_at>=day_start)+reserve>cfg.workspace_daily_micro_usd then raise exception 'generation_workspace_budget_limit';end if;
 if (select coalesce(sum(budget_debit_micro_usd),0) from zoi.ai_generations where profile_id=actor and created_at>=day_start)+reserve>cfg.user_daily_micro_usd then raise exception 'generation_user_budget_limit';end if;
 insert into zoi.ai_generations(workspace_id,profile_id,request_id,input_hash,action,input,requested_count,profile_snapshot,model,pricing_date,input_rate,output_rate,max_output_tokens,reserved_input_tokens,budget_debit_micro_usd)
 values(p_workspace,actor,p_request,p_hash,p_action,p_input,p_count,p_profile,cfg.model,cfg.pricing_date,cfg.input_micro_usd_per_token,cfg.output_micro_usd_per_token,cfg.max_output_tokens,cfg.reserved_input_tokens,reserve) returning * into g;
 return jsonb_build_object('ok',true,'dispatch',true,'generation',to_jsonb(g));
end $$;
create function public.ai_generation_finish(p_generation uuid,p_status text,p_result jsonb,p_raw text,p_error text,p_input_tokens integer,p_output_tokens integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g zoi.ai_generations;estimate bigint;
begin
 perform 1 from zoi.ai_runtime where singleton for update;
 select * into g from zoi.ai_generations where id=p_generation for update;
 if g.id is null then raise exception 'generation_unavailable';end if;
 if g.status<>'pending' then return jsonb_build_object('ok',true,'generation',to_jsonb(g));end if;
 if p_status is null or p_status not in ('succeeded','failed','unknown') or octet_length(coalesce(p_raw,''))>16000 or octet_length(coalesce(p_result::text,''))>16000 or coalesce(length(p_error),0)>80 then raise exception 'invalid_generation_result';end if;
 if p_status='succeeded' and p_result is null then raise exception 'missing_generation_result';end if;
 if p_input_tokens is not null and p_output_tokens is not null and p_input_tokens between 0 and g.reserved_input_tokens and p_output_tokens between 0 and g.max_output_tokens then estimate:=p_input_tokens*g.input_rate+p_output_tokens*g.output_rate;end if;
 update zoi.ai_generations set status=p_status,result=p_result,raw_output=p_raw,error_code=p_error,provider_input_tokens=p_input_tokens,provider_output_tokens=p_output_tokens,estimated_micro_usd=estimate,budget_debit_micro_usd=coalesce(estimate,budget_debit_micro_usd),completed_at=clock_timestamp() where id=g.id returning * into g;
 return jsonb_build_object('ok',true,'generation',to_jsonb(g));
end $$;

create function public.ai_generation_get(p_workspace uuid,p_generation uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare g zoi.ai_generations;
begin
 if auth.uid() is null or zoi.ops_role(p_workspace) is null then raise exception 'not_authorized' using errcode='42501';end if;
 select * into g from zoi.ai_generations where workspace_id=p_workspace and id=p_generation;
 if g.id is null then raise exception 'generation_unavailable';end if;
 return jsonb_build_object('ok',true,'generation',to_jsonb(g));
end $$;
create function public.ai_generation_history(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb;usage jsonb;cfg zoi.ai_runtime;day_start timestamptz;
begin
 if auth.uid() is null or zoi.ops_role(p_workspace) is null then raise exception 'not_authorized' using errcode='42501';end if;
 select * into cfg from zoi.ai_runtime where singleton;
 day_start:=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC';
 select coalesce(jsonb_agg(to_jsonb(g) order by created_at desc),'[]') into rows from(select id,action,requested_count,model,status,error_code,provider_input_tokens,provider_output_tokens,estimated_micro_usd,budget_debit_micro_usd,created_at,completed_at from zoi.ai_generations where workspace_id=p_workspace order by created_at desc limit 50)g;
 select jsonb_build_object('reserved_or_estimated_micro_usd',coalesce(sum(budget_debit_micro_usd),0),'estimated_micro_usd',sum(estimated_micro_usd),'requests',count(*)) into usage from zoi.ai_generations where workspace_id=p_workspace and created_at>=day_start;
 return jsonb_build_object('ok',true,'generations',rows,'today',usage,'budget_enabled',cfg.enabled,'workspace_daily_micro_usd',cfg.workspace_daily_micro_usd,'user_daily_requests',cfg.user_daily_requests,'pricing_date',cfg.pricing_date,'cost_label','USD estimate from token rates; not a provider invoice');
end $$;
revoke all on function public.ai_generation_begin(uuid,uuid,uuid,text,text,text,integer,jsonb),public.ai_generation_finish(uuid,text,jsonb,text,text,integer,integer),public.ai_generation_get(uuid,uuid),public.ai_generation_history(uuid) from public,anon,authenticated;
grant execute on function public.ai_generation_begin(uuid,uuid,uuid,text,text,text,integer,jsonb),public.ai_generation_finish(uuid,text,jsonb,text,text,integer,integer) to service_role;
grant execute on function public.ai_generation_get(uuid,uuid),public.ai_generation_history(uuid) to authenticated;
create function public.ai_runtime_enabled() returns boolean language sql stable security definer set search_path='' as $$ select coalesce((select enabled from zoi.ai_runtime where singleton),false); $$;
revoke all on function public.ai_runtime_enabled() from public;
grant execute on function public.ai_runtime_enabled() to anon,authenticated,service_role;
commit;
