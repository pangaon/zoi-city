-- Existing organization membership, not event staff or an invitation transport.
alter table zoi.workspace_members add column team_revision uuid not null default gen_random_uuid();
create function zoi.workspace_member_revision() returns trigger language plpgsql set search_path='' as $$begin
 if TG_OP='UPDATE' and (NEW.id is distinct from OLD.id or NEW.workspace_id is distinct from OLD.workspace_id or NEW.profile_id is distinct from OLD.profile_id) then raise exception 'membership_identity_immutable';end if;
 NEW.team_revision:=gen_random_uuid();return NEW;end$$;
create trigger workspace_member_revision before insert or update on zoi.workspace_members for each row execute function zoi.workspace_member_revision();
create table zoi.workspace_team_receipts(actor uuid not null,request_id uuid not null,workspace_id uuid not null,arguments jsonb,result jsonb not null,created_at timestamptz not null default now(),primary key(actor,request_id));
create index workspace_team_receipts_actor_time on zoi.workspace_team_receipts(actor,created_at);
create index workspace_team_receipts_workspace on zoi.workspace_team_receipts(workspace_id);
alter table zoi.workspace_team_receipts enable row level security;
revoke all on zoi.workspace_team_receipts from public,anon,authenticated;
-- Serialize API membership changes with workspace ownership and concurrent member inserts.
-- Direct row updates only change the revision; the trigger never takes a workspace lock.
create function zoi.workspace_team_authorize(p_workspace uuid,p_manage boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$declare a uuid;r text;w zoi.workspaces;begin
 if auth.uid() is null then raise exception 'not_authorized' using errcode='42501';end if;
 select id into a from zoi.user_profiles where auth_user_id=auth.uid();
 select * into w from zoi.workspaces where id=p_workspace for update;
 if a is null or w.id is null then raise exception 'not_authorized' using errcode='42501';end if;
 select role into r from zoi.workspace_members where workspace_id=p_workspace and profile_id=a for share;
 if not found and w.owner_profile_id=a then r:='owner';end if;
 if r='owner' and w.owner_profile_id is distinct from a then r:='viewer';end if;
 if r is null or (p_manage and r not in('owner','admin')) then raise exception 'not_authorized' using errcode='42501';end if;
 return jsonb_build_object('actor',a,'role',r,'owner',w.owner_profile_id);end$$;
create function zoi.workspace_team_change(p_workspace uuid,p_profile uuid,p_role text,p_remove boolean,p_member uuid default null,p_revision uuid default null,p_check boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$declare a jsonb;m zoi.workspace_members;begin
 a:=zoi.workspace_team_authorize(p_workspace,true);
 select * into m from zoi.workspace_members where workspace_id=p_workspace and profile_id=p_profile for update;
 if m.id is null then return jsonb_build_object('ok',false,'error','member_missing');end if;
 if p_profile=(a->>'owner')::uuid or m.role='owner' then raise exception 'owner_membership_protected' using errcode='42501';end if;
 if p_profile=(a->>'actor')::uuid then raise exception 'self_membership_protected' using errcode='42501';end if;
 if a->>'role'='admin' and (m.role='admin' or p_role='admin') then raise exception 'owner_required' using errcode='42501';end if;
 if not p_remove and (p_role is null or p_role not in('admin','editor','viewer')) then raise exception 'bad_role';end if;
 if p_check and (p_member is distinct from m.id or p_revision is distinct from m.team_revision) then return jsonb_build_object('ok',false,'error','membership_conflict');end if;
 if p_remove then delete from zoi.workspace_members where id=m.id;else update zoi.workspace_members set role=p_role where id=m.id returning * into m;end if;
 return jsonb_build_object('ok',true,'member_id',m.id,'profile_id',p_profile,'removed',p_remove,'role',case when p_remove then null else m.role end,'revision',case when p_remove then null else m.team_revision end);end$$;
create function public.workspace_team_get(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare a jsonb;members jsonb;begin
 a:=zoi.workspace_team_authorize(p_workspace);
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'profile_id',m.profile_id,'name',coalesce(nullif(u.display_name,''),nullif(u.first_name,''),'Team member'),'role',m.role,'revision',m.team_revision,'joined',m.created_at,'protected',m.profile_id=(a->>'owner')::uuid or m.role='owner' or m.profile_id=(a->>'actor')::uuid) order by m.created_at,m.id),'[]') into members from zoi.workspace_members m join zoi.user_profiles u on u.id=m.profile_id where m.workspace_id=p_workspace;
 return jsonb_build_object('ok',true,'workspace_id',p_workspace,'actor_profile_id',a->>'actor','role',a->>'role','members',members);end$$;
create function public.workspace_team_save(p_workspace uuid,p_request uuid,p_profile uuid,p_member uuid,p_revision uuid,p_action text,p_role text default null) returns jsonb language plpgsql security definer set search_path='' as $$declare a uuid;rights jsonb;args jsonb;receipt zoi.workspace_team_receipts;result jsonb;begin
 if auth.uid() is null or p_request is null then raise exception 'not_authorized' using errcode='42501';end if;
 select id into a from zoi.user_profiles where auth_user_id=auth.uid();if a is null then raise exception 'not_authorized' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('workspace-team:'||a::text,0));
 rights:=zoi.workspace_team_authorize(p_workspace,true);
 args:=jsonb_build_object('workspace',p_workspace,'profile',p_profile,'member',p_member,'revision',p_revision,'action',p_action,'role',p_role);
 select * into receipt from zoi.workspace_team_receipts where actor=a and request_id=p_request;
 if found then
  if receipt.workspace_id<>p_workspace then raise exception 'request_mismatch';end if;
  if receipt.arguments is null then return receipt.result;end if;
  if receipt.arguments<>args then raise exception 'request_mismatch';end if;
  return receipt.result;
 end if;
 if (select count(*) from zoi.workspace_team_receipts where actor=a and created_at>now()-interval '1 day')>=300 then raise exception 'team_request_limit';end if;
 if (select count(*) from zoi.workspace_team_receipts where workspace_id=p_workspace)>=5000 then raise exception 'team_receipt_capacity';end if;
 if p_action is null or p_action not in('role','remove') or p_profile is null or p_member is null or p_revision is null or (p_action='remove' and p_role is not null) then raise exception 'invalid_team_request';end if;
 result:=zoi.workspace_team_change(p_workspace,p_profile,p_role,p_action='remove',p_member,p_revision,true)||jsonb_build_object('workspace_id',p_workspace,'request_id',p_request);
 insert into zoi.workspace_team_receipts(actor,request_id,workspace_id,arguments,result)values(a,p_request,p_workspace,args,result);return result;end$$;
create function public.workspace_team_request(p_workspace uuid,p_request uuid,p_cancel_if_missing boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$declare a uuid;rights jsonb;r zoi.workspace_team_receipts;result jsonb;begin
 if auth.uid() is null or p_request is null then raise exception 'not_authorized' using errcode='42501';end if;
 select id into a from zoi.user_profiles where auth_user_id=auth.uid();if a is null then raise exception 'not_authorized' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('workspace-team:'||a::text,0));rights:=zoi.workspace_team_authorize(p_workspace,true);
 select * into r from zoi.workspace_team_receipts where actor=a and request_id=p_request;
 if found then if r.workspace_id<>p_workspace then raise exception 'request_mismatch';end if;return jsonb_build_object('ok',true,'workspace_id',p_workspace,'request_id',p_request,'found',true,'result',r.result);end if;
 if not p_cancel_if_missing then return jsonb_build_object('ok',true,'workspace_id',p_workspace,'request_id',p_request,'found',false);end if;
 if (select count(*) from zoi.workspace_team_receipts where actor=a and created_at>now()-interval '1 day')>=300 then raise exception 'team_request_limit';end if;
 if (select count(*) from zoi.workspace_team_receipts where workspace_id=p_workspace)>=5000 then raise exception 'team_receipt_capacity';end if;
 result:=jsonb_build_object('ok',false,'cancelled',true,'workspace_id',p_workspace,'request_id',p_request);
 insert into zoi.workspace_team_receipts(actor,request_id,workspace_id,arguments,result)values(a,p_request,p_workspace,null,result);
 return jsonb_build_object('ok',true,'workspace_id',p_workspace,'request_id',p_request,'found',true,'result',result);end$$;
-- Retain old signatures/boolean missing-row results. Deliberately reject unsafe owner
-- mutation and admin peer escalation. Legacy callers do not gain CAS semantics.
create or replace function public.ws_member_set_role(p_workspace uuid,p_profile uuid,p_role text) returns boolean language plpgsql security definer set search_path='' as $$begin return (zoi.workspace_team_change(p_workspace,p_profile,p_role,false)->>'ok')::boolean;end$$;
create or replace function public.ws_member_remove(p_workspace uuid,p_profile uuid) returns boolean language plpgsql security definer set search_path='' as $$begin return (zoi.workspace_team_change(p_workspace,p_profile,null,true)->>'ok')::boolean;end$$;
create or replace function public.ws_members_list(p_workspace uuid) returns table(profile_id uuid,name text,role text,joined timestamptz) language plpgsql security definer set search_path='' as $$begin
 perform zoi.workspace_team_authorize(p_workspace);
 return query select m.profile_id,coalesce(u.display_name,u.first_name,'Member'),m.role,m.created_at from zoi.workspace_members m left join zoi.user_profiles u on u.id=m.profile_id where m.workspace_id=p_workspace order by m.created_at;end$$;
revoke all on function zoi.workspace_team_authorize(uuid,boolean),zoi.workspace_team_change(uuid,uuid,text,boolean,uuid,uuid,boolean),zoi.workspace_member_revision() from public,anon,authenticated;
revoke all on function public.workspace_team_get(uuid),public.workspace_team_save(uuid,uuid,uuid,uuid,uuid,text,text),public.workspace_team_request(uuid,uuid,boolean),public.ws_member_set_role(uuid,uuid,text),public.ws_member_remove(uuid,uuid),public.ws_members_list(uuid) from public,anon,authenticated;
grant execute on function public.workspace_team_get(uuid),public.workspace_team_save(uuid,uuid,uuid,uuid,uuid,text,text),public.workspace_team_request(uuid,uuid,boolean),public.ws_member_set_role(uuid,uuid,text),public.ws_member_remove(uuid,uuid),public.ws_members_list(uuid) to authenticated;
