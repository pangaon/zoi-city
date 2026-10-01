begin;
set local lock_timeout='5s';
create table zoi.ops_mutation_receipts(
 actor_id uuid not null references zoi.user_profiles(id),request_id uuid not null,
 workspace_id uuid not null references zoi.workspaces(id),state text not null check(state in('saved','cancelled')),
 action text check(action in('save','archive')),args_hash bytea,record_id uuid references zoi.ops_records(id),kind text,version integer,
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,request_id)
);
create index ops_mutation_receipts_actor_created on zoi.ops_mutation_receipts(actor_id,created_at);
alter table zoi.ops_mutation_receipts enable row level security;
revoke all on zoi.ops_mutation_receipts from public,anon,authenticated;
create function zoi.ops_receipt_value(r zoi.ops_mutation_receipts) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;role_name text;
begin
 select id into actor from zoi.user_profiles where auth_user_id=auth.uid();role_name:=zoi.ops_role(r.workspace_id);
 if auth.uid() is null or actor is distinct from r.actor_id or coalesce(role_name,'') not in('owner','admin','editor') or(r.state='saved' and(role_name='editor' and(r.action='archive' or r.kind='company'))) then raise exception 'ops_permission_denied' using errcode='42501';end if;
 return jsonb_build_object('ok',true,'state',r.state,'workspace_id',r.workspace_id,'request_id',r.request_id,'action',r.action,'record_id',r.record_id,'kind',r.kind,'version',r.version);
end $$;
revoke all on function zoi.ops_receipt_value(zoi.ops_mutation_receipts) from public,anon,authenticated;
create function public.ops_request_status(p_workspace uuid,p_request uuid,p_cancel_if_missing boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;r zoi.ops_mutation_receipts;
begin
 select id into actor from zoi.user_profiles where auth_user_id=auth.uid();
 if auth.uid() is null or actor is null or coalesce(zoi.ops_role(p_workspace),'') not in('owner','admin','editor') then raise exception 'ops_permission_denied' using errcode='42501';end if;
 if p_request is null then raise exception 'invalid_ops_request';end if;
 perform pg_advisory_xact_lock(hashtextextended('ops-request:'||actor::text||':'||p_request::text,0));
 select * into r from zoi.ops_mutation_receipts where actor_id=actor and request_id=p_request;
 if found then
  if r.workspace_id is distinct from p_workspace then raise exception 'ops_permission_denied' using errcode='42501';end if;
  return zoi.ops_receipt_value(r);
 end if;
 if not coalesce(p_cancel_if_missing,false) then return jsonb_build_object('ok',true,'state','missing','workspace_id',p_workspace,'request_id',p_request);end if;
 perform pg_advisory_xact_lock(hashtextextended('ops-actor:'||actor::text,0));
 if (select count(*) from zoi.ops_mutation_receipts where actor_id=actor and created_at>clock_timestamp()-interval '24 hours')>=500 then raise exception 'ops_request_limit';end if;
 insert into zoi.ops_mutation_receipts(actor_id,request_id,workspace_id,state) values(actor,p_request,p_workspace,'cancelled') returning * into r;
 return zoi.ops_receipt_value(r);
end $$;
create function public.ops_mutation_execute(p_workspace uuid,p_request uuid,p_action text,p_args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;r zoi.ops_mutation_receipts;h bytea;result jsonb;record jsonb;role_name text;
begin
 select id into actor from zoi.user_profiles where auth_user_id=auth.uid();role_name:=zoi.ops_role(p_workspace);
 if auth.uid() is null or actor is null or coalesce(role_name,'') not in('owner','admin','editor') then raise exception 'ops_permission_denied' using errcode='42501';end if;
 if p_request is null or p_action is null or p_action not in('save','archive') or jsonb_typeof(p_args) is distinct from 'object' or octet_length(p_args::text)>32000 then raise exception 'invalid_ops_request';end if;
 if exists(select 1 from jsonb_object_keys(p_args) as keys(k) where k<>all(case when p_action='save' then array['p_kind','p_data','p_id','p_expected_version'] else array['p_id','p_expected_version'] end)) then raise exception 'invalid_ops_request';end if;
 h:=sha256(convert_to(p_args::text,'UTF8'));
 perform pg_advisory_xact_lock(hashtextextended('ops-request:'||actor::text||':'||p_request::text,0));
 select * into r from zoi.ops_mutation_receipts where actor_id=actor and request_id=p_request;
 if found then
  if r.workspace_id is distinct from p_workspace then raise exception 'ops_request_conflict';end if;
  if r.state='cancelled' then raise exception 'ops_request_cancelled';end if;
  if r.action is distinct from p_action or r.args_hash is distinct from h then raise exception 'ops_request_conflict';end if;
  return zoi.ops_receipt_value(r);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('ops-actor:'||actor::text,0));
 if (select count(*) from zoi.ops_mutation_receipts where actor_id=actor and created_at>clock_timestamp()-interval '24 hours')>=500 then raise exception 'ops_request_limit';end if;
 if p_action='save' then result:=public.ops_record_save(p_workspace,p_args->>'p_kind',p_args->'p_data',(p_args->>'p_id')::uuid,(p_args->>'p_expected_version')::integer);
 else result:=public.ops_record_archive(p_workspace,(p_args->>'p_id')::uuid,(p_args->>'p_expected_version')::integer);end if;
 record:=result->'record';
 if (result->>'ok')::boolean is distinct from true or record->>'id' is null or (record->>'workspace_id')::uuid is distinct from p_workspace then raise exception 'ops_unconfirmed';end if;
 insert into zoi.ops_mutation_receipts(actor_id,request_id,workspace_id,state,action,args_hash,record_id,kind,version) values(actor,p_request,p_workspace,'saved',p_action,h,(record->>'id')::uuid,record->>'kind',(record->>'version')::integer) returning * into r;
 return zoi.ops_receipt_value(r);
end $$;
revoke all on function public.ops_mutation_execute(uuid,uuid,text,jsonb),public.ops_request_status(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.ops_mutation_execute(uuid,uuid,text,jsonb),public.ops_request_status(uuid,uuid,boolean) to authenticated;
commit;
