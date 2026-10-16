-- Phase 1: real erasure for an account with no unsupported history. A review
-- hold is never a deletion receipt. No workspace/profile cascade is permitted.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$begin
 if current_user<>'postgres' then raise exception 'account_delete_installer_required';end if;
 if md5(pg_get_functiondef('zoi.suite_current_session()'::regprocedure))<>'8ceef7877aeb972d09d8694f6c85dff7'
 or md5(pg_get_functiondef('zoi.suite_lock_session()'::regprocedure))<>'04328c4d98e5f5671777a88435870c58'
 then raise exception 'account_delete_authority_drift';end if;
 if exists(select 1 from pg_proc where oid=any(array['zoi.suite_current_session()'::regprocedure,'zoi.suite_lock_session()'::regprocedure]) and (not prosecdef or proowner<>'postgres'::regrole or proacl::text<>'{postgres=X/postgres}' or proconfig is distinct from array['search_path=""'])) then raise exception 'account_delete_authority_metadata_drift';end if;
 if to_regclass('zoi.account_deletion_requests') is not null then raise exception 'account_delete_already_installed';end if;
 if md5(pg_get_functiondef('zoi.ensure_profile()'::regprocedure))<>'a6d10d22f2cda05e1d4260997273afc0'
 or exists(select 1 from pg_proc where oid='zoi.ensure_profile()'::regprocedure and (not prosecdef or proconfig is distinct from array['search_path=zoi, public'] or proacl is not null)) then raise exception 'account_delete_legacy_actor_drift';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('zoi','public') and p.proname like 'account_delete_%') then raise exception 'account_delete_namespace_drift';end if;
end $$;
create table zoi.account_deletion_requests(
 request_id uuid primary key, actor_id uuid not null, profile_id uuid,
 session_id uuid not null, recovery_hash text not null check(recovery_hash~'^[0-9a-f]{64}$'),
 state text not null check(state in('prepared','accepted','requires_review','auth_pending','completed','cancelled')),
 created_at timestamptz not null default clock_timestamp(), accepted_at timestamptz,
 updated_at timestamptz not null default clock_timestamp(), recovery_until timestamptz not null default clock_timestamp()+interval '30 days',
 worker_id uuid, worker_until timestamptz, attempts integer not null default 0,
 reason text check(reason in('unsupported_history','storage_review','schema_review','retry_required') or reason is null)
);
create unique index account_deletion_current_actor on zoi.account_deletion_requests(actor_id) where state<>'cancelled';
alter table zoi.account_deletion_requests enable row level security;
revoke all on zoi.account_deletion_requests from public,anon,authenticated,service_role;

-- Exact entry-only guard; original NULL handling and all remaining bytes,
-- owner/ACL/configuration stay unchanged. The transaction lock spans each
-- legacy caller's entire write, even when it began before preparation.
do $guard$
declare original text:=pg_get_functiondef('zoi.ensure_profile()'::regprocedure);needle text:=E'  IF auth.uid() IS NULL THEN RETURN NULL; END IF;\n';addition text:=E'  IF current_setting(''transaction_isolation'')<>''read committed'' THEN RAISE EXCEPTION ''account_delete_isolation_required''; END IF;\n  PERFORM pg_advisory_xact_lock(hashtextextended(''account-delete:''||auth.uid()::text,0));\n  IF EXISTS(SELECT 1 FROM zoi.account_deletion_requests WHERE actor_id=auth.uid() AND state NOT IN(''prepared'',''cancelled'')) THEN RAISE EXCEPTION ''account_deletion_in_progress'' USING ERRCODE=''42501''; END IF;\n';changed text;old_owner oid;old_acl aclitem[];old_config text[];
begin
 select proowner,proacl,proconfig into old_owner,old_acl,old_config from pg_proc where oid='zoi.ensure_profile()'::regprocedure;
 if (length(original)-length(replace(original,needle,'')))/length(needle)<>1 then raise exception 'account_delete_legacy_guard_shape';end if;
 changed:=replace(original,needle,needle||addition);
 if replace(changed,addition,'')<>original then raise exception 'account_delete_legacy_guard_preservation';end if;
 execute changed;
 if exists(select 1 from pg_proc where oid='zoi.ensure_profile()'::regprocedure and (proowner<>old_owner or proacl is distinct from old_acl or proconfig is distinct from old_config or not prosecdef)) then raise exception 'account_delete_legacy_metadata_preservation';end if;
end $guard$;

create function zoi.account_delete_profile_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare r zoi.account_deletion_requests; clean jsonb;
begin
 -- A row lock follows the profile lock in both confirmation and processing.
 -- FOR SHARE rechecks an updated request after a concurrent confirmation wait.
 select * into r from zoi.account_deletion_requests where (actor_id=new.auth_user_id or profile_id=new.id) and state<>'cancelled' for share;
 if found and r.state<>'prepared' then
  clean:=to_jsonb(new)-array['id','created_at'];
  if tg_op='INSERT' or new.auth_user_id is not null or exists(select 1 from jsonb_each(clean) x where x.value<>'null'::jsonb) then raise exception 'account_deletion_in_progress' using errcode='42501';end if;
 end if;
 return new;
end $$;
create trigger account_delete_profile_guard before insert or update on zoi.user_profiles for each row execute function zoi.account_delete_profile_guard();

create function zoi.account_delete_personal_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare s text;
begin
 select state into s from zoi.account_deletion_requests where profile_id=(to_jsonb(new)->>'profile_id')::uuid and state<>'cancelled' for share;
 if found and s<>'prepared' then raise exception 'account_deletion_in_progress' using errcode='42501';end if;return new;
end $$;
do $$declare t text;begin foreach t in array array['feed_posts','feed_comments','community_profiles','community_preferences'] loop
 if to_regclass('zoi.'||t) is null then raise exception 'account_delete_schema_drift';end if;
 execute format('create trigger account_delete_personal_guard before insert or update on zoi.%I for each row execute function zoi.account_delete_personal_guard()',t);
end loop;end $$;

create function public.account_delete_prepare(p_request uuid,p_recovery_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid();sid uuid;p uuid;r zoi.account_deletion_requests;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'account_delete_isolation_required';end if;
 if a is null or p_request is null or p_recovery_hash is null or p_recovery_hash!~'^[0-9a-f]{64}$' then raise exception 'account_delete_unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('account-delete-admission:'||a::text,0));
 perform pg_advisory_xact_lock(hashtextextended('account-delete:'||a::text,0));
 perform zoi.suite_lock_session();sid:=(auth.jwt()->>'session_id')::uuid;
 if not exists(select 1 from auth.sessions where id=sid and user_id=a and created_at between clock_timestamp()-interval '5 minutes' and clock_timestamp()) then raise exception 'account_delete_reauthenticate' using errcode='42501';end if;
 select id into p from zoi.user_profiles where auth_user_id=a for update;
 select * into r from zoi.account_deletion_requests where actor_id=a and state<>'cancelled' for update;
 -- Revalidate the retained session after profile/request waits, before effects.
 perform zoi.suite_lock_session();
 if not exists(select 1 from auth.sessions where id=sid and user_id=a and created_at between clock_timestamp()-interval '5 minutes' and clock_timestamp()) then raise exception 'account_delete_reauthenticate' using errcode='42501';end if;
 if r.request_id is not null then
  if r.request_id<>p_request or r.recovery_hash<>p_recovery_hash or r.session_id<>sid then raise exception 'account_delete_request_conflict';end if;
 else
  insert into zoi.account_deletion_requests(request_id,actor_id,profile_id,session_id,recovery_hash,state) values(p_request,a,p,sid,p_recovery_hash,'prepared') returning * into r;
 end if;
 return jsonb_build_object('request_id',r.request_id,'state',r.state);
end $$;

create function public.account_delete_confirm(p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid();sid uuid;r zoi.account_deletion_requests;p uuid;reauth_at timestamptz;session_until timestamptz;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'account_delete_isolation_required';end if;
 if a is null then raise exception 'account_delete_unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('account-delete-admission:'||a::text,0));
 perform zoi.suite_lock_session();sid:=(auth.jwt()->>'session_id')::uuid;
 if not exists(select 1 from auth.sessions where id=sid and user_id=a and created_at between clock_timestamp()-interval '5 minutes' and clock_timestamp()) then raise exception 'account_delete_reauthenticate' using errcode='42501';end if;
 select created_at,not_after into reauth_at,session_until from auth.sessions where id=sid and user_id=a;
 select * into r from zoi.account_deletion_requests where request_id=p_request and actor_id=a;
 if not found or r.session_id<>sid or r.state<>'prepared' then raise exception 'account_delete_request_conflict';end if;
 -- Never hold the legacy actor lock while waiting for session SHARE holders.
 delete from auth.sessions where user_id=a;
 perform pg_advisory_xact_lock(hashtextextended('account-delete:'||a::text,0));
 select id into p from zoi.user_profiles where auth_user_id=a for update;
 select * into r from zoi.account_deletion_requests where request_id=p_request and actor_id=a for update;
 if not found then raise exception 'account_delete_request_conflict';end if;
 -- An insert may have held the prepared receipt while this statement waited.
 -- Existing rows were locked above; a newly appeared row causes refusal below.
 select id into p from zoi.user_profiles where auth_user_id=a;
 if session_until is not null and session_until<=clock_timestamp() then raise exception 'suite_session_unavailable' using errcode='42501';end if;
 if reauth_at<clock_timestamp()-interval '5 minutes' or r.session_id<>sid or r.profile_id is distinct from p or r.state<>'prepared' or r.created_at<clock_timestamp()-interval '15 minutes' then raise exception 'account_delete_request_conflict';end if;
 update zoi.account_deletion_requests set state='accepted',accepted_at=clock_timestamp(),updated_at=clock_timestamp() where request_id=p_request;
 -- Acceptance and session revocation commit together; a failed recheck rolls both back.
 return jsonb_build_object('request_id',p_request,'state','accepted');
end $$;

-- This status capability is high entropy, read-only, bounded and carries no PII.
create function public.account_delete_status(p_request uuid,p_recovery_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r zoi.account_deletion_requests;
begin
 if p_recovery_token is null or p_recovery_token!~'^[0-9a-f]{64}$' then raise exception 'account_delete_unavailable' using errcode='42501';end if;
 select * into r from zoi.account_deletion_requests where request_id=p_request and recovery_hash=encode(extensions.digest(p_recovery_token,'sha256'),'hex') and recovery_until>clock_timestamp();
 if not found then raise exception 'account_delete_unavailable' using errcode='42501';end if;
 return jsonb_build_object('request_id',r.request_id,'state',r.state);
end $$;

create function public.account_delete_cancel(p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid();r zoi.account_deletion_requests;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'account_delete_isolation_required';end if;
 if a is null then raise exception 'account_delete_unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('account-delete-admission:'||a::text,0));
 perform pg_advisory_xact_lock(hashtextextended('account-delete:'||a::text,0));perform zoi.suite_lock_session();
 select * into r from zoi.account_deletion_requests where request_id=p_request and actor_id=a for update;
 if not found or r.state not in('prepared','cancelled') then raise exception 'account_delete_request_conflict';end if;
 perform zoi.suite_lock_session(); -- Session time expiry can occur during the receipt wait.
 update zoi.account_deletion_requests set state='cancelled',updated_at=clock_timestamp() where request_id=p_request;
 return jsonb_build_object('request_id',p_request,'state','cancelled');
end $$;

-- Read-only residual detection, never wildcard deletion. Includes FK and known
-- non-FK actor fields. Any unknown linked history is held for an explicit map.
create function zoi.account_delete_has_history(a uuid,p uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare x record;hit boolean;
begin
 for x in
 select distinct n.nspname schema_name,c.relname table_name,at.attname column_name
 from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute at on at.attrelid=c.oid and at.attnum>0 and not at.attisdropped
 where n.nspname in('zoi','public') and c.relkind in('r','p') and at.atttypid='uuid'::regtype
 and (at.attname=any(array['auth_user_id','user_id','profile_id','owner_user_id','owner_profile_id','created_by_auth','author_id','actor_id','actor_profile_id','member_id','follower','followee','blocker','blocked','friend_id','guardian_id','submitted_by','reviewed_by','reporter','recipient','actor','muted','created_by','updated_by','uploaded_by','claimed_by','collected_by_staff_id','issuer_profile_id','accepted_profile_id','saved_by'])
 or exists(select 1 from pg_constraint k where k.conrelid=c.oid and k.contype='f' and at.attnum=any(k.conkey) and k.confrelid in('zoi.user_profiles'::regclass,'auth.users'::regclass)))
 and not(n.nspname='zoi' and c.relname in('account_deletion_requests','user_profiles','community_profiles','community_preferences'))
 order by n.nspname,c.relname,at.attname
 loop
  execute format('select exists(select 1 from %I.%I where %I=any($1))',x.schema_name,x.table_name,x.column_name) into hit using array[a,p];
  if hit then return true;end if;
 end loop;
 return false;
end $$;

create function public.account_delete_process(p_request uuid,p_worker uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r zoi.account_deletion_requests;p uuid;a uuid;v_schema text;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'account_delete_isolation_required';end if;
 if auth.role()<>'service_role' or p_worker is null then raise exception 'account_delete_worker_required' using errcode='42501';end if;
 select actor_id,profile_id into a,p from zoi.account_deletion_requests where request_id=p_request;
 if a is null then raise exception 'account_delete_unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended('account-delete-admission:'||a::text,0));
 select * into r from zoi.account_deletion_requests where request_id=p_request;
 if r.state not in('accepted','auth_pending') then return jsonb_build_object('request_id',p_request,'state',r.state);end if;
 delete from auth.sessions where user_id=a;
 perform pg_advisory_xact_lock(hashtextextended('account-delete:'||a::text,0));
 perform 1 from zoi.user_profiles where id=p for update;
 select * into r from zoi.account_deletion_requests where request_id=p_request for update;
 if r.state not in('accepted','auth_pending') then return jsonb_build_object('request_id',p_request,'state',r.state);end if;
 if r.worker_until>clock_timestamp() and r.worker_id is distinct from p_worker then raise exception 'account_delete_busy';end if;
 -- Refuse schema additions that would leave personal profile columns behind.
 select string_agg(attname,',' order by attname) into v_schema from pg_attribute where attrelid='zoi.user_profiles'::regclass and attnum>0 and not attisdropped;
 if v_schema<>'auth_user_id,city,country,created_at,display_name,first_name,id,identity,name_day_day,name_day_month,name_key,origin_place_id,roots_place,roots_region,team' then
  update zoi.account_deletion_requests set state='requires_review',reason='schema_review',updated_at=clock_timestamp() where request_id=p_request;
  return jsonb_build_object('request_id',p_request,'state','requires_review');
 end if;
 if exists(select 1 from zoi.user_profiles where auth_user_id=a and id is distinct from p) or zoi.account_delete_has_history(a,p) or exists(select 1 from zoi.community_profiles where profile_id=p and (avatar_media_id is not null or nullif(avatar_url,'') is not null)) then
  update zoi.account_deletion_requests set state='requires_review',reason='unsupported_history',updated_at=clock_timestamp() where request_id=p_request;
  return jsonb_build_object('request_id',p_request,'state','requires_review');
 end if;
 if exists(select 1 from storage.objects where owner=a or owner_id=a::text or split_part(name,'/',1)=a::text) then
  update zoi.account_deletion_requests set state='requires_review',reason='storage_review',updated_at=clock_timestamp() where request_id=p_request;
  return jsonb_build_object('request_id',p_request,'state','requires_review');
 end if;
 -- Whole rows include initial_data snapshots. Unsupported posts, reports,
 -- content_snapshot and media are held above, never silently retained as done.
 delete from zoi.community_profiles where profile_id=p;
 delete from zoi.community_preferences where profile_id=p;
 delete from zoi.workspace_members where profile_id=p;
 update zoi.user_profiles set auth_user_id=null,display_name=null,first_name=null,name_key=null,name_day_month=null,name_day_day=null,roots_place=null,roots_region=null,city=null,country=null,team=null,identity=null,origin_place_id=null where id=p;
 update zoi.account_deletion_requests set state='auth_pending',worker_id=p_worker,worker_until=clock_timestamp()+interval '2 minutes',attempts=attempts+1,updated_at=clock_timestamp() where request_id=p_request;
 return jsonb_build_object('request_id',p_request,'state','auth_pending','actor_id',a,'worker_id',p_worker);
end $$;

create function public.account_delete_finish(p_request uuid,p_worker uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r zoi.account_deletion_requests;p uuid;a uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'account_delete_isolation_required';end if;
 if auth.role()<>'service_role' then raise exception 'account_delete_worker_required' using errcode='42501';end if;
 select actor_id,profile_id into a,p from zoi.account_deletion_requests where request_id=p_request;
 perform pg_advisory_xact_lock(hashtextextended('account-delete-admission:'||a::text,0));
 perform pg_advisory_xact_lock(hashtextextended('account-delete:'||a::text,0));
 perform 1 from zoi.user_profiles where id=p for update;
 select * into r from zoi.account_deletion_requests where request_id=p_request for update;
 if not found or r.state<>'auth_pending' or r.worker_id is distinct from p_worker then raise exception 'account_delete_request_conflict';end if;
 if exists(select 1 from auth.users where id=a) or exists(select 1 from auth.sessions where user_id=a) or exists(select 1 from zoi.user_profiles where auth_user_id=a) or zoi.account_delete_has_history(a,p) or exists(select 1 from storage.objects where owner=a or owner_id=a::text or split_part(name,'/',1)=a::text) then raise exception 'account_delete_incomplete';end if;
 if exists(select 1 from zoi.user_profiles u cross join lateral jsonb_each(to_jsonb(u)-array['id','created_at']) v where u.id=p and v.value<>'null'::jsonb) then raise exception 'account_delete_incomplete';end if;
 update zoi.account_deletion_requests set state='completed',worker_id=null,worker_until=null,updated_at=clock_timestamp() where request_id=p_request;
 return jsonb_build_object('request_id',p_request,'state','completed');
end $$;

create function public.account_delete_pending() returns jsonb language plpgsql security definer set search_path='' as $$begin
 if auth.role()<>'service_role' then raise exception 'account_delete_worker_required' using errcode='42501';end if;
 return(select coalesce(jsonb_agg(request_id),'[]') from(select request_id from zoi.account_deletion_requests where state in('accepted','auth_pending') and (worker_until is null or worker_until<=clock_timestamp()) order by created_at,request_id limit 5)x);
end $$;

do $$declare f record;begin for f in select p.oid::regprocedure sig,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('zoi','public') and p.proname like 'account_delete_%' loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
 if f.nspname='public' then
  if f.proname in('account_delete_prepare','account_delete_confirm','account_delete_cancel') then execute format('grant execute on function %s to authenticated',f.sig);
  elsif f.proname='account_delete_status' then execute format('grant execute on function %s to anon,authenticated',f.sig);
  else execute format('grant execute on function %s to service_role',f.sig);end if;
 end if;
end loop;end $$;
commit;
