-- Recipient-bound organization links. No email delivery is implied or dispatched.
alter table zoi.workspaces add column invitation_owner_revision uuid not null default gen_random_uuid();
create function zoi.workspace_invitation_owner_revision()returns trigger language plpgsql set search_path='' as $$begin
 if NEW.owner_profile_id is distinct from OLD.owner_profile_id then NEW.invitation_owner_revision:=gen_random_uuid();end if;return NEW;
end$$;
create trigger workspace_invitation_owner_revision before update of owner_profile_id on zoi.workspaces for each row execute function zoi.workspace_invitation_owner_revision();
create table zoi.workspace_invitations(
 id uuid primary key,workspace_id uuid not null references zoi.workspaces(id),recipient_email text not null,
 role text not null check(role in('admin','editor','viewer')),issuer_profile_id uuid not null references zoi.user_profiles(id),
 issuer_member_id uuid not null,issuer_revision uuid not null,owner_profile_id uuid not null,owner_revision uuid not null,token_hash text not null unique,
 expires_at timestamptz not null,state text not null default 'pending' check(state in('pending','revoked','accepted')),
 revision uuid not null default gen_random_uuid(),accepted_profile_id uuid references zoi.user_profiles(id),accepted_member_id uuid,
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create index workspace_invitations_workspace on zoi.workspace_invitations(workspace_id,created_at);
create table zoi.workspace_invitation_requests(actor uuid not null,request_id uuid not null,workspace_id uuid not null,
 operation text not null check(operation in('create','revoke','accept')),scope jsonb not null,arguments jsonb,result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(actor,request_id));
create index workspace_invitation_requests_actor_time on zoi.workspace_invitation_requests(actor,created_at);
create index workspace_invitation_requests_workspace on zoi.workspace_invitation_requests(workspace_id);
alter table zoi.workspace_invitations enable row level security;
alter table zoi.workspace_invitation_requests enable row level security;
revoke all on zoi.workspace_invitations,zoi.workspace_invitation_requests from public,anon,authenticated;

create function zoi.workspace_invitation_actor()returns uuid language plpgsql security definer set search_path='' as $$declare a uuid;begin
 if auth.uid() is null then raise exception 'not_authorized' using errcode='42501';end if;
 perform zoi.workspace_invitation_email(false);
 return auth.uid();
end$$;
create function zoi.workspace_invitation_email(p_lock boolean default true)returns text language plpgsql security definer set search_path='' as $$declare email text;sid text:=auth.jwt()->>'session_id';begin
 if auth.uid()is null or coalesce(sid,'')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception 'invitation_unavailable' using errcode='42501';end if;
 if p_lock then
  select lower(btrim(u.email)) into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and u.deleted_at is null and coalesce(u.is_anonymous,false)=false and(u.banned_until is null or u.banned_until<=clock_timestamp())for share;
  perform 1 from auth.sessions where id=sid::uuid and user_id=auth.uid()and(not_after is null or not_after>clock_timestamp())for share;
 else
  select lower(btrim(u.email)) into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and u.deleted_at is null and coalesce(u.is_anonymous,false)=false and(u.banned_until is null or u.banned_until<=clock_timestamp());
  perform 1 from auth.sessions where id=sid::uuid and user_id=auth.uid()and(not_after is null or not_after>clock_timestamp());
 end if;
 if not found or email is null or email='' then raise exception 'invitation_unavailable' using errcode='42501';end if;return email;
end$$;
create function zoi.workspace_invitation_valid(i zoi.workspace_invitations)returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from zoi.workspaces w where w.id=i.workspace_id and w.owner_profile_id=i.owner_profile_id and w.invitation_owner_revision=i.owner_revision
 and exists(select 1 from zoi.workspace_members m where m.workspace_id=w.id and m.profile_id=i.issuer_profile_id and m.id=i.issuer_member_id and m.team_revision=i.issuer_revision
 and exists(select 1 from zoi.user_profiles p join auth.users u on u.id=p.auth_user_id where p.id=m.profile_id and u.deleted_at is null and u.email_confirmed_at is not null and coalesce(u.is_anonymous,false)=false and(u.banned_until is null or u.banned_until<=now()))
 and ((m.role='owner' and m.profile_id=w.owner_profile_id) or (m.role='admin' and i.role in('editor','viewer')))));
$$;
create function zoi.workspace_invitation_view(i zoi.workspace_invitations)returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',i.id,'workspace_id',i.workspace_id,'recipient_email',i.recipient_email,'role',i.role,'revision',i.revision,'expires_at',i.expires_at,
 'state',case when i.state<>'pending' then i.state when not zoi.workspace_invitation_valid(i) then 'invalidated' when i.expires_at<=now() then 'expired' else 'pending' end,
 'created_at',i.created_at,'delivery','manual_share');$$;
create function zoi.workspace_invitation_budget(a uuid,w uuid)returns void language plpgsql security definer set search_path='' as $$begin
 if (select count(*) from zoi.workspace_invitation_requests where actor=a and created_at>clock_timestamp()-interval '1 day')>=150 then raise exception 'invitation_request_limit';end if;
 if (select count(*) from zoi.workspace_invitation_requests where workspace_id=w)>=5000 then raise exception 'invitation_receipt_capacity';end if;
end$$;
create function public.workspace_invitation_list(p_workspace uuid)returns jsonb language plpgsql security definer set search_path='' as $$declare rights jsonb;rows jsonb;begin
 rights:=zoi.workspace_team_authorize(p_workspace,true);perform zoi.workspace_invitation_email();
 select coalesce(jsonb_agg(zoi.workspace_invitation_view(i)order by i.created_at desc),'[]'::jsonb)into rows from zoi.workspace_invitations i where i.workspace_id=p_workspace;
 return jsonb_build_object('ok',true,'workspace_id',p_workspace,'role',rights->>'role','invitations',rows,'delivery','manual_share');end$$;

create function public.workspace_invitation_create(p_workspace uuid,p_request uuid,p_id uuid,p_email text,p_role text,p_expires_at timestamptz,p_token text)returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=zoi.workspace_invitation_actor();rights jsonb;m zoi.workspace_members;i zoi.workspace_invitations;r zoi.workspace_invitation_requests;args jsonb;scope jsonb;result jsonb;email text;hash text;
begin
 if p_request is null or p_id is null or coalesce(p_token,'')!~'^[0-9a-f]{64}$' then raise exception 'invalid_invitation';end if;
 perform pg_advisory_xact_lock(hashtextextended('workspace-invite:'||a::text,0));rights:=zoi.workspace_team_authorize(p_workspace,true);perform zoi.workspace_invitation_email();
 hash:=encode(extensions.digest(p_token,'sha256'),'hex');email:=lower(btrim(p_email));
 scope:=jsonb_build_object('workspace',p_workspace,'operation','create');args:=jsonb_build_object('id',p_id,'email',email,'role',p_role,'expires',p_expires_at,'token_hash',hash);
 select * into r from zoi.workspace_invitation_requests where actor=a and request_id=p_request;
 if found then if r.scope<>scope or (r.arguments is not null and r.arguments<>args)then raise exception 'request_mismatch';end if;return r.result;end if;
 perform zoi.workspace_invitation_budget(a,p_workspace);
 if email is null or length(email)>254 or email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_role is null or p_role not in('admin','editor','viewer')
 or p_expires_at is null or p_expires_at<=clock_timestamp() or p_expires_at>clock_timestamp()+interval '7 days' then raise exception 'invalid_invitation';end if;
 if rights->>'role'='admin' and p_role='admin' then raise exception 'owner_required' using errcode='42501';end if;
 if(select count(*)from zoi.workspace_invitations where workspace_id=p_workspace)>=1000 then raise exception 'invitation_capacity';end if;
 if exists(select 1 from zoi.workspace_invitations x where x.workspace_id=p_workspace and x.recipient_email=email and x.state='pending' and x.expires_at>clock_timestamp() and zoi.workspace_invitation_valid(x))then raise exception 'invitation_already_pending';end if;
 select * into m from zoi.workspace_members where workspace_id=p_workspace and profile_id=(rights->>'actor')::uuid for share;
 if m.id is null then raise exception 'issuer_membership_required' using errcode='42501';end if;
 insert into zoi.workspace_invitations(id,workspace_id,recipient_email,role,issuer_profile_id,issuer_member_id,issuer_revision,owner_profile_id,owner_revision,token_hash,expires_at)
 values(p_id,p_workspace,email,p_role,(rights->>'actor')::uuid,m.id,m.team_revision,(rights->>'owner')::uuid,(select invitation_owner_revision from zoi.workspaces where id=p_workspace),hash,p_expires_at)returning * into i;
 result:=jsonb_build_object('ok',true,'workspace_id',p_workspace,'request_id',p_request,'operation','create','invitation',zoi.workspace_invitation_view(i),'delivery','manual_share');
 insert into zoi.workspace_invitation_requests(actor,request_id,workspace_id,operation,scope,arguments,result)values(a,p_request,p_workspace,'create',scope,args,result);return result;
end$$;

create function public.workspace_invitation_revoke(p_workspace uuid,p_request uuid,p_id uuid,p_revision uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=zoi.workspace_invitation_actor();rights jsonb;i zoi.workspace_invitations;r zoi.workspace_invitation_requests;scope jsonb;args jsonb;result jsonb;begin
 if p_request is null or p_id is null or p_revision is null then raise exception 'invalid_invitation';end if;
 perform pg_advisory_xact_lock(hashtextextended('workspace-invite:'||a::text,0));rights:=zoi.workspace_team_authorize(p_workspace,true);perform zoi.workspace_invitation_email();
 scope:=jsonb_build_object('workspace',p_workspace,'operation','revoke');args:=jsonb_build_object('id',p_id,'revision',p_revision);
 select * into r from zoi.workspace_invitation_requests where actor=a and request_id=p_request;
 if found then if r.scope<>scope or (r.arguments is not null and r.arguments<>args)then raise exception 'request_mismatch';end if;return r.result;end if;
 perform zoi.workspace_invitation_budget(a,p_workspace);
 select * into i from zoi.workspace_invitations where id=p_id and workspace_id=p_workspace for update;
 if i.id is null then raise exception 'invitation_unavailable';end if;
 if rights->>'role'='admin' and i.role='admin'then raise exception 'owner_required' using errcode='42501';end if;
 if i.revision<>p_revision or i.state<>'pending' then result:=jsonb_build_object('ok',false,'error','invitation_conflict');
 else update zoi.workspace_invitations set state='revoked',revision=gen_random_uuid(),updated_at=clock_timestamp()where id=i.id returning * into i;result:=jsonb_build_object('ok',true,'invitation',zoi.workspace_invitation_view(i));end if;
 result:=result||jsonb_build_object('workspace_id',p_workspace,'request_id',p_request,'operation','revoke');
 insert into zoi.workspace_invitation_requests(actor,request_id,workspace_id,operation,scope,arguments,result)values(a,p_request,p_workspace,'revoke',scope,args,result);return result;
end$$;

-- Token possession alone never reveals an organization or grants membership.
create function public.workspace_invitation_preview(p_token text)returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=zoi.workspace_invitation_actor();p uuid;i zoi.workspace_invitations;w zoi.workspaces;m zoi.workspace_members;email text;begin
 select id into p from zoi.user_profiles where auth_user_id=a;
 if coalesce(p_token,'')!~'^[0-9a-f]{64}$' then raise exception 'invitation_unavailable' using errcode='42501';end if;
 select * into i from zoi.workspace_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 email:=zoi.workspace_invitation_email();if i.id is null or i.recipient_email<>email then raise exception 'invitation_unavailable' using errcode='42501';end if;
 if i.state='revoked' or (i.state='pending' and(i.expires_at<=clock_timestamp()or not zoi.workspace_invitation_valid(i)))or(i.state='accepted' and i.accepted_profile_id is distinct from p) then raise exception 'invitation_unavailable' using errcode='42501';end if;
 select * into w from zoi.workspaces where id=i.workspace_id;select * into m from zoi.workspace_members where workspace_id=i.workspace_id and profile_id=p;
 return jsonb_build_object('ok',true,'id',i.id,'workspace_id',i.workspace_id,'workspace_name',w.name,'role',i.role,'revision',i.revision,'expires_at',i.expires_at,'state',i.state,'current_member',m.id is not null,'current_role',m.role,'actor_profile_id',p,'auth_user_id',a);
end$$;

create function public.workspace_invitation_accept(p_token text,p_request uuid,p_revision uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=zoi.workspace_invitation_actor();i zoi.workspace_invitations;m zoi.workspace_members;r zoi.workspace_invitation_requests;w uuid;p uuid;hash text;scope jsonb;args jsonb;result jsonb;email text;existing boolean;begin
 if p_request is null or p_revision is null or coalesce(p_token,'')!~'^[0-9a-f]{64}$' then raise exception 'invitation_unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('workspace-invite:'||a::text,0));hash:=encode(extensions.digest(p_token,'sha256'),'hex');
 select workspace_id into w from zoi.workspace_invitations where token_hash=hash;
 perform 1 from zoi.workspaces where id=w for update;
 select * into i from zoi.workspace_invitations where token_hash=hash for update;
 if i.id is null then raise exception 'invitation_unavailable' using errcode='42501';end if;
 perform 1 from zoi.workspace_members where workspace_id=w and profile_id=i.issuer_profile_id for share;
 perform 1 from auth.users u join zoi.user_profiles p on p.auth_user_id=u.id where p.id=i.issuer_profile_id for share of u;
 email:=zoi.workspace_invitation_email();if i.recipient_email<>email then raise exception 'invitation_unavailable' using errcode='42501';end if;
 scope:=jsonb_build_object('workspace',w,'operation','accept','token_hash',hash);args:=jsonb_build_object('revision',p_revision);
 select * into r from zoi.workspace_invitation_requests where actor=a and request_id=p_request;
 if found then if r.scope<>scope or(r.arguments is not null and r.arguments<>args)then raise exception 'request_mismatch';end if;return r.result;end if;
 perform zoi.workspace_invitation_budget(a,w);
 if i.state<>'pending' or i.expires_at<=clock_timestamp()or not zoi.workspace_invitation_valid(i) then raise exception 'invitation_unavailable' using errcode='42501';end if;
 if i.revision<>p_revision then result:=jsonb_build_object('ok',false,'error','invitation_conflict');
 else
  select id into p from zoi.user_profiles where auth_user_id=a;
  if p is null then insert into zoi.user_profiles(id,auth_user_id)values(gen_random_uuid(),a)on conflict(auth_user_id)do nothing returning id into p;if p is null then select id into p from zoi.user_profiles where auth_user_id=a;end if;end if;
  select * into m from zoi.workspace_members where workspace_id=w and profile_id=p for update;existing:=m.id is not null;
  if not existing then
   -- Recorded owner without a membership must not be downgraded by accepting an invite.
   if exists(select 1 from zoi.workspaces where id=w and owner_profile_id=p)then raise exception 'owner_membership_protected' using errcode='42501';end if;
   insert into zoi.workspace_members(workspace_id,profile_id,role)values(w,p,i.role)on conflict(workspace_id,profile_id)do nothing returning * into m;
   if m.id is null then select * into m from zoi.workspace_members where workspace_id=w and profile_id=p for update;existing:=true;end if;
  end if;
  update zoi.workspace_invitations set state='accepted',accepted_profile_id=p,accepted_member_id=m.id,revision=gen_random_uuid(),updated_at=clock_timestamp()where id=i.id returning * into i;
  result:=jsonb_build_object('ok',true,'member_id',m.id,'profile_id',p,'role',m.role,'existing_member',existing,'invitation_id',i.id);
 end if;
 result:=result||jsonb_build_object('workspace_id',w,'request_id',p_request,'operation','accept');
 insert into zoi.workspace_invitation_requests(actor,request_id,workspace_id,operation,scope,arguments,result)values(a,p_request,w,'accept',scope,args,result);return result;
end$$;

create function public.workspace_invitation_request(p_request uuid,p_operation text,p_workspace uuid default null,p_token text default null,p_cancel_if_missing boolean default false)returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=zoi.workspace_invitation_actor();r zoi.workspace_invitation_requests;i zoi.workspace_invitations;w uuid;hash text;scope jsonb;result jsonb;begin
 if p_request is null or p_operation is null or p_operation not in('create','revoke','accept')then raise exception 'invalid_invitation';end if;
 perform pg_advisory_xact_lock(hashtextextended('workspace-invite:'||a::text,0));
 if p_operation='accept' then
  if p_workspace is not null or coalesce(p_token,'')!~'^[0-9a-f]{64}$'then raise exception 'invitation_unavailable' using errcode='42501';end if;
  hash:=encode(extensions.digest(p_token,'sha256'),'hex');select workspace_id into w from zoi.workspace_invitations where token_hash=hash;
  perform 1 from zoi.workspaces where id=w for update;select * into i from zoi.workspace_invitations where token_hash=hash for update;
  if i.id is null or i.recipient_email<>zoi.workspace_invitation_email()then raise exception 'invitation_unavailable' using errcode='42501';end if;
  scope:=jsonb_build_object('workspace',w,'operation','accept','token_hash',hash);
 else
  if p_workspace is null or p_token is not null then raise exception 'invalid_invitation';end if;
  perform zoi.workspace_team_authorize(p_workspace,true);perform zoi.workspace_invitation_email();w:=p_workspace;scope:=jsonb_build_object('workspace',w,'operation',p_operation);
 end if;
 select * into r from zoi.workspace_invitation_requests where actor=a and request_id=p_request;
 if found then if r.scope<>scope then raise exception 'request_mismatch';end if;return jsonb_build_object('ok',true,'workspace_id',w,'request_id',p_request,'operation',p_operation,'found',true,'result',r.result);end if;
 if not p_cancel_if_missing then return jsonb_build_object('ok',true,'workspace_id',w,'request_id',p_request,'operation',p_operation,'found',false);end if;
 perform zoi.workspace_invitation_budget(a,w);
 result:=jsonb_build_object('ok',false,'cancelled',true,'workspace_id',w,'request_id',p_request,'operation',p_operation);
 insert into zoi.workspace_invitation_requests(actor,request_id,workspace_id,operation,scope,arguments,result)values(a,p_request,w,p_operation,scope,null,result);
 return jsonb_build_object('ok',true,'workspace_id',w,'request_id',p_request,'operation',p_operation,'found',true,'result',result);
end$$;
revoke all on function zoi.workspace_invitation_owner_revision(),zoi.workspace_invitation_actor(),zoi.workspace_invitation_email(boolean),zoi.workspace_invitation_valid(zoi.workspace_invitations),zoi.workspace_invitation_view(zoi.workspace_invitations),zoi.workspace_invitation_budget(uuid,uuid)from public,anon,authenticated;
revoke all on function public.workspace_invitation_list(uuid),public.workspace_invitation_create(uuid,uuid,uuid,text,text,timestamptz,text),public.workspace_invitation_revoke(uuid,uuid,uuid,uuid),public.workspace_invitation_preview(text),public.workspace_invitation_accept(text,uuid,uuid),public.workspace_invitation_request(uuid,text,uuid,text,boolean)from public,anon,authenticated;
grant execute on function public.workspace_invitation_list(uuid),public.workspace_invitation_create(uuid,uuid,uuid,text,text,timestamptz,text),public.workspace_invitation_revoke(uuid,uuid,uuid,uuid),public.workspace_invitation_preview(text),public.workspace_invitation_accept(text,uuid,uuid),public.workspace_invitation_request(uuid,text,uuid,text,boolean)to authenticated;
