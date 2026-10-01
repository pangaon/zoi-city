begin;
set local lock_timeout='5s';
alter table zoi.workspaces add column settings_revision uuid not null default gen_random_uuid();
alter table zoi.ai_profiles add column settings_revision uuid not null default gen_random_uuid();
-- Persistent voice revision survives profile deletion, preventing absent-row ABA.
create table zoi.workspace_voice_revisions(workspace_id uuid primary key references zoi.workspaces(id) on delete cascade,revision uuid not null default gen_random_uuid());
insert into zoi.workspace_voice_revisions(workspace_id) select id from zoi.workspaces;
alter table zoi.workspace_voice_revisions enable row level security;
revoke all on zoi.workspace_voice_revisions from public,anon,authenticated;
create function zoi.settings_voice_revision_update() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='workspaces' then insert into zoi.workspace_voice_revisions(workspace_id) values(new.id);return new;end if;
 update zoi.workspace_voice_revisions set revision=gen_random_uuid() where workspace_id=case when tg_op='DELETE' then old.workspace_id else new.workspace_id end;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger workspace_voice_revision_init after insert on zoi.workspaces for each row execute function zoi.settings_voice_revision_update();
create trigger ai_voice_revision after insert or update or delete on zoi.ai_profiles for each row execute function zoi.settings_voice_revision_update();
create function zoi.settings_revision_update() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='ai_profiles' and tg_op='UPDATE' then
  if new.workspace_id is distinct from old.workspace_id then raise exception 'settings_workspace_immutable';end if;
 end if;
 if tg_op='INSERT' then new.settings_revision:=gen_random_uuid();return new;end if;
 if tg_table_name='workspaces' then
  if new.name is distinct from old.name then new.settings_revision:=gen_random_uuid();else new.settings_revision:=old.settings_revision;end if;
 else
  if (to_jsonb(new)-'settings_revision'-'updated_at') is distinct from (to_jsonb(old)-'settings_revision'-'updated_at') then new.settings_revision:=gen_random_uuid();else new.settings_revision:=old.settings_revision;end if;
 end if;
 return new;
end $$;
create trigger workspace_settings_revision before update on zoi.workspaces for each row execute function zoi.settings_revision_update();
create trigger ai_settings_revision before insert or update on zoi.ai_profiles for each row execute function zoi.settings_revision_update();
create table zoi.workspace_settings_receipts(actor uuid not null,request_id uuid not null,workspace_id uuid not null references zoi.workspaces(id) on delete cascade,section text not null check(section in('identity','voice')),input_hash text not null,result jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(actor,request_id));
create index workspace_settings_receipts_actor_created on zoi.workspace_settings_receipts(actor,created_at);
alter table zoi.workspace_settings_receipts enable row level security;
revoke all on zoi.workspace_settings_receipts from public,anon,authenticated;
create function zoi.settings_authorize(p_workspace uuid,p_section text,p_write boolean) returns text language plpgsql security definer set search_path='' as $$
declare member_role text;legacy_owner boolean;
begin
 if auth.uid() is null then raise exception 'not_authorized' using errcode='42501';end if;
 select zoi.ops_role(p_workspace),exists(select 1 from zoi.workspaces w left join zoi.user_profiles up on up.auth_user_id=auth.uid() where w.id=p_workspace and(w.created_by_auth=auth.uid() or w.owner_profile_id=up.id)) into member_role,legacy_owner;
 if p_section not in('identity','voice') or p_section is null then raise exception 'invalid_settings_section';end if;
 if not p_write then
  if member_role is null and not legacy_owner then raise exception 'not_authorized' using errcode='42501';end if;
 elsif p_section='identity' then
  if coalesce(member_role,'') not in('owner','admin') and not legacy_owner then raise exception 'insufficient_permission' using errcode='42501';end if;
 elsif coalesce(member_role,'') not in('owner','admin','editor') then raise exception 'insufficient_permission' using errcode='42501';end if;
 return coalesce(member_role,case when legacy_owner then 'owner' end);
end $$;
create function zoi.settings_section(p_workspace uuid,p_section text) returns jsonb language sql security definer set search_path='' as $$
 select case when p_section='identity' then (select jsonb_build_object('name',name,'version',settings_revision) from zoi.workspaces where id=p_workspace)
 else coalesce((select jsonb_build_object('business_name',coalesce(business_name,''),'about',coalesce(about,''),'tone',coalesce(tone,''),'languages',coalesce(languages,''),'sample',coalesce(sample,''),'version',(select revision from zoi.workspace_voice_revisions where workspace_id=p_workspace)) from zoi.ai_profiles where workspace_id=p_workspace),jsonb_build_object('business_name','','about','','tone','','languages','','sample','','version',(select revision from zoi.workspace_voice_revisions where workspace_id=p_workspace))) end;
$$;
create function public.workspace_settings_get(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text;
begin
 r:=zoi.settings_authorize(p_workspace,'identity',false);
 return jsonb_build_object('ok',true,'workspace_id',p_workspace,'role',r,'identity',zoi.settings_section(p_workspace,'identity'),'voice',case when zoi.ops_role(p_workspace) is not null then zoi.settings_section(p_workspace,'voice') else null end);
end $$;
create function public.workspace_settings_request(p_workspace uuid,p_request uuid,p_section text,p_cancel_if_missing boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt zoi.workspace_settings_receipts;result_value jsonb;
begin
 perform zoi.settings_authorize(p_workspace,p_section,true);
 if p_request is null then raise exception 'invalid_settings_request';end if;
 perform pg_advisory_xact_lock(hashtextextended('settings-actor:'||auth.uid()::text,0));
 perform zoi.settings_authorize(p_workspace,p_section,true);
 select * into receipt from zoi.workspace_settings_receipts where actor=auth.uid() and request_id=p_request;
 if found then
  if receipt.workspace_id<>p_workspace or receipt.section<>p_section then raise exception 'settings_request_conflict';end if;
  return receipt.result;
 end if;
 if not coalesce(p_cancel_if_missing,false) then return jsonb_build_object('ok',false,'error','request_unknown','workspace_id',p_workspace,'request_id',p_request,'section',p_section);end if;
 if (select count(*) from zoi.workspace_settings_receipts where actor=auth.uid())>=10000 then raise exception 'settings_receipt_capacity';end if;
 if (select count(*) from zoi.workspace_settings_receipts where actor=auth.uid() and created_at>=date_trunc('day',clock_timestamp()))>=500 then raise exception 'settings_request_limit';end if;
 result_value:=jsonb_build_object('ok',false,'error','request_cancelled','workspace_id',p_workspace,'request_id',p_request,'section',p_section);
 insert into zoi.workspace_settings_receipts(actor,request_id,workspace_id,section,input_hash,result) values(auth.uid(),p_request,p_workspace,p_section,'cancelled',result_value);
 return result_value;
end $$;
create function public.workspace_settings_save(p_workspace uuid,p_request uuid,p_section text,p_expected_version uuid,p_values jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt zoi.workspace_settings_receipts;input_hash text;current_value jsonb;result_value jsonb;field text;
begin
 perform zoi.settings_authorize(p_workspace,p_section,true);
 if p_request is null or jsonb_typeof(p_values) is distinct from 'object' then raise exception 'invalid_settings_values';end if;
 if p_section='identity' then
  if (select count(*) from jsonb_object_keys(p_values))<>1 or jsonb_typeof(p_values->'name') is distinct from 'string' or length(btrim(p_values->>'name')) not between 1 and 120 or p_values->>'name'<>btrim(p_values->>'name') then raise exception 'invalid_settings_values';end if;
 else
  if (select count(*) from jsonb_object_keys(p_values))<>5 then raise exception 'invalid_settings_values';end if;
  foreach field in array array['business_name','about','tone','languages','sample'] loop
   if jsonb_typeof(p_values->field) is distinct from 'string' or length(p_values->>field)>(case field when 'business_name' then 120 when 'about' then 1500 when 'tone' then 80 when 'languages' then 160 else 2000 end) then raise exception 'invalid_settings_values';end if;
  end loop;
 end if;
 input_hash:=encode(sha256(convert_to(jsonb_build_array(p_workspace,p_section,p_expected_version,p_values)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('settings-actor:'||auth.uid()::text,0));
 perform zoi.settings_authorize(p_workspace,p_section,true);
 select * into receipt from zoi.workspace_settings_receipts where actor=auth.uid() and request_id=p_request;
 if found then
  if receipt.workspace_id<>p_workspace or receipt.section<>p_section then raise exception 'settings_request_conflict';end if;
  if receipt.result->>'error' is distinct from 'request_cancelled' and receipt.input_hash<>input_hash then raise exception 'settings_request_conflict';end if;
  return receipt.result;
 end if;
 if (select count(*) from zoi.workspace_settings_receipts where actor=auth.uid())>=10000 then raise exception 'settings_receipt_capacity';end if;
 if (select count(*) from zoi.workspace_settings_receipts where actor=auth.uid() and created_at>=date_trunc('day',clock_timestamp()))>=500 then raise exception 'settings_request_limit';end if;
 if p_section='identity' then perform 1 from zoi.workspaces where id=p_workspace for update;
 else
  -- Existing profile first, then persistent revision: same order as direct writes.
  perform 1 from zoi.ai_profiles where workspace_id=p_workspace for update;
  perform 1 from zoi.workspace_voice_revisions where workspace_id=p_workspace for update;
 end if;
 perform zoi.settings_authorize(p_workspace,p_section,true);
 current_value:=zoi.settings_section(p_workspace,p_section);
 if (current_value->>'version')::uuid is distinct from p_expected_version then
  result_value:=jsonb_build_object('ok',false,'error','version_conflict','request_id',p_request,'workspace_id',p_workspace,'section',p_section,'current',current_value);
 else
  if p_section='identity' then update zoi.workspaces set name=p_values->>'name' where id=p_workspace;
  else insert into zoi.ai_profiles(workspace_id,business_name,about,tone,languages,sample,updated_at) values(p_workspace,p_values->>'business_name',p_values->>'about',p_values->>'tone',p_values->>'languages',p_values->>'sample',now()) on conflict(workspace_id) do update set business_name=excluded.business_name,about=excluded.about,tone=excluded.tone,languages=excluded.languages,sample=excluded.sample,updated_at=now();end if;
  current_value:=zoi.settings_section(p_workspace,p_section);
  result_value:=jsonb_build_object('ok',true,'request_id',p_request,'workspace_id',p_workspace,'section',p_section,'version',current_value->'version','value',current_value);
 end if;
 insert into zoi.workspace_settings_receipts(actor,request_id,workspace_id,section,input_hash,result) values(auth.uid(),p_request,p_workspace,p_section,input_hash,result_value);
 return result_value;
end $$;
revoke all on function zoi.settings_voice_revision_update(),zoi.settings_revision_update(),zoi.settings_authorize(uuid,text,boolean),zoi.settings_section(uuid,text) from public,anon,authenticated;
revoke all on function public.workspace_settings_get(uuid),public.workspace_settings_request(uuid,uuid,text,boolean),public.workspace_settings_save(uuid,uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.workspace_settings_get(uuid),public.workspace_settings_request(uuid,uuid,text,boolean),public.workspace_settings_save(uuid,uuid,text,uuid,jsonb) to authenticated;
commit;
