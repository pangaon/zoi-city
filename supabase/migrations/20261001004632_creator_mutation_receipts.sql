begin;
set local lock_timeout='5s';
-- Recovery markers contain no brief, contact details, proof URL or response text.
create table zoi.creator_mutation_receipts (
 actor_id uuid not null references zoi.user_profiles(id), request_id uuid not null,
 state text not null check (state in ('saved','cancelled')), action text,
 args_hash bytea, campaign_id uuid references zoi.creator_campaigns(id),
 entity_id uuid, entity_version integer, operator_required boolean,
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,request_id)
);
create index creator_mutation_campaign on zoi.creator_mutation_receipts(campaign_id);
alter table zoi.creator_mutation_receipts enable row level security;
revoke all on zoi.creator_mutation_receipts from public,anon,authenticated;

create function zoi.creator_receipt_value(r zoi.creator_mutation_receipts) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c zoi.creator_campaigns; actor uuid;
begin
 actor:=(select id from zoi.user_profiles where auth_user_id=auth.uid());
 if auth.uid() is null or actor is distinct from r.actor_id then raise exception 'creator_permission_denied' using errcode='42501';end if;
 if r.state='saved' then
  select * into c from zoi.creator_campaigns where id=r.campaign_id;
  if c.id is null or (r.operator_required and coalesce(zoi.ops_role(c.workspace_id),'') not in('owner','admin','editor')) or (not r.operator_required and actor is distinct from c.customer_id) then raise exception 'creator_permission_denied' using errcode='42501';end if;
 end if;
 return jsonb_build_object('ok',true,'state',r.state,'request_id',r.request_id,'action',r.action,'campaign_id',r.campaign_id,'entity_id',r.entity_id,'version',r.entity_version);
end $$;
revoke all on function zoi.creator_receipt_value(zoi.creator_mutation_receipts) from public,anon,authenticated;

create function public.creator_request_status(p_request uuid,p_cancel_if_missing boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;r zoi.creator_mutation_receipts;
begin
 actor:=(select id from zoi.user_profiles where auth_user_id=auth.uid());
 if auth.uid() is null or actor is null then raise exception 'creator_permission_denied' using errcode='42501';end if;
 if p_request is null then raise exception 'invalid_creator_request';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':'||p_request::text,0));
 select * into r from zoi.creator_mutation_receipts where actor_id=actor and request_id=p_request;
 if not found then
  if not coalesce(p_cancel_if_missing,false) then return jsonb_build_object('ok',true,'state','missing','request_id',p_request);end if;
  insert into zoi.creator_mutation_receipts(actor_id,request_id,state) values(actor,p_request,'cancelled') returning * into r;
 end if;
 return zoi.creator_receipt_value(r);
end $$;

create function public.creator_mutation_execute(p_request uuid,p_action text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;r zoi.creator_mutation_receipts;v_result jsonb;v_entity jsonb;v_campaign uuid;v_key text;v_operator boolean;v_hash bytea;
begin
 actor:=(select id from zoi.user_profiles where auth_user_id=auth.uid());
 if auth.uid() is null or actor is null then raise exception 'creator_permission_denied' using errcode='42501';end if;
 if p_request is null or p_action is null or p_action not in ('creator_convert','creator_draft_save','creator_deliverable_save','creator_brief_share','creator_submission_send','creator_brief_decide','creator_submission_decide') or jsonb_typeof(p_args) is distinct from 'object' or octet_length(p_args::text)>32000 then raise exception 'invalid_creator_request';end if;
 v_hash:=pg_catalog.sha256(pg_catalog.convert_to(p_args::text,'UTF8'));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':'||p_request::text,0));
 select * into r from zoi.creator_mutation_receipts where actor_id=actor and request_id=p_request;
 if found then
  if r.state='cancelled' then raise exception 'creator_request_cancelled';end if;
  if r.action is distinct from p_action or r.args_hash is distinct from v_hash then raise exception 'creator_request_conflict';end if;
  return zoi.creator_receipt_value(r);
 end if;
 v_operator:=p_action not in ('creator_brief_decide','creator_submission_decide');
 case p_action
 when 'creator_convert' then
  v_result:=public.creator_convert((p_args->>'p_workspace')::uuid,(p_args->>'p_inquiry')::uuid,(p_args->>'p_company')::uuid,p_args->>'p_kind',p_request);v_key:='campaign';v_campaign:=(v_result->'campaign'->>'id')::uuid;
 when 'creator_draft_save' then
  v_result:=public.creator_draft_save((p_args->>'p_campaign')::uuid,(p_args->>'p_expected_version')::integer,p_args->'p_data');v_key:='campaign';v_campaign:=(p_args->>'p_campaign')::uuid;
 when 'creator_deliverable_save' then
  v_result:=public.creator_deliverable_save((p_args->>'p_campaign')::uuid,coalesce((p_args->>'p_id')::uuid,p_request),(p_args->>'p_expected_version')::integer,p_args->'p_data');v_key:='deliverable';v_campaign:=(p_args->>'p_campaign')::uuid;
 when 'creator_brief_share' then
  v_result:=public.creator_brief_share((p_args->>'p_campaign')::uuid,(p_args->>'p_expected_version')::integer,p_request);v_key:='brief';v_campaign:=(p_args->>'p_campaign')::uuid;
 when 'creator_submission_send' then
  v_result:=public.creator_submission_send((p_args->>'p_campaign')::uuid,(p_args->>'p_deliverable')::uuid,p_args->>'p_url',p_args->>'p_note',p_request);v_key:='submission';v_campaign:=(p_args->>'p_campaign')::uuid;
 when 'creator_brief_decide' then
  v_result:=public.creator_brief_decide((p_args->>'p_brief')::uuid,p_args->>'p_decision',p_args->>'p_note',p_request);v_key:='brief';v_campaign:=(v_result->'brief'->>'campaign_id')::uuid;
 when 'creator_submission_decide' then
  v_result:=public.creator_submission_decide((p_args->>'p_submission')::uuid,p_args->>'p_decision',p_args->>'p_note',p_request);v_key:='submission';v_campaign:=(v_result->'submission'->>'campaign_id')::uuid;
 end case;
 v_entity:=v_result->v_key;
 if (v_result->>'ok')::boolean is distinct from true or v_entity->>'id' is null or v_campaign is null then raise exception 'creator_unconfirmed';end if;
 insert into zoi.creator_mutation_receipts(actor_id,request_id,state,action,args_hash,campaign_id,entity_id,entity_version,operator_required)
 values(actor,p_request,'saved',p_action,v_hash,v_campaign,(v_entity->>'id')::uuid,(v_entity->>'version')::integer,v_operator) returning * into r;
 return zoi.creator_receipt_value(r);
end $$;
revoke all on function public.creator_mutation_execute(uuid,text,jsonb),public.creator_request_status(uuid,boolean) from public,anon,authenticated;
grant execute on function public.creator_mutation_execute(uuid,text,jsonb),public.creator_request_status(uuid,boolean) to authenticated;
commit;
