-- ROOT REVIEW/EXECUTION ONLY. No actual execution by author. Rehearsal ALWAYS ROLLBACKS.
-- Source bodies below retain all original statements/guards except their three outer BEGIN/COMMIT wrappers.
begin;
set local lock_timeout='1s';
set local statement_timeout='5s';
do $install$begin
 if current_user<>'postgres' or current_setting('transaction_isolation')<>'read committed' then raise exception 'account_delete_install_authority';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('account-delete-first-install',0)) then raise exception 'account_delete_install_busy';end if;
 if to_regclass('zoi.account_deletion_requests')is not null or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('zoi','public')and p.proname like 'account_delete_%')or exists(select 1 from cron.job where jobname='zoi-account-delete-worker')then raise exception 'account_delete_first_empty_install_required';end if;
end $install$;
-- EXACT SOURCE BODY supabase/migrations/20261016040420_self_service_account_deletion.sql
-- Phase 1: real erasure for an account with no unsupported history. A review
-- hold is never a deletion receipt. No workspace/profile cascade is permitted.

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

-- END EXACT SOURCE BODY supabase/migrations/20261016040420_self_service_account_deletion.sql
-- EXACT SOURCE BODY supabase/migrations/20261016044936_account_deletion_community_erasure.sql
-- Companion to immutable core V2. No activation occurs in this migration.

set local lock_timeout='5s';set local statement_timeout='30s';
do $$begin
 if current_user<>'postgres' then raise exception 'account_delete_installer_required';end if;
 if not exists(select 1 from pg_proc where oid='public.account_delete_prepare(uuid,text)'::regprocedure and md5(prosrc)='7b926a953ab26e8c7ac4e1add70d2129' and prosecdef and proowner='postgres'::regrole and proconfig=array['search_path=""'] and proacl::text='{postgres=X/postgres,authenticated=X/postgres}') then raise exception 'account_delete_core_drift';end if;
 if not exists(select 1 from pg_proc where oid='public.account_delete_confirm(uuid)'::regprocedure and md5(prosrc)='fc344c289a5b7a1aab75532527e8ae25' and prosecdef and proowner='postgres'::regrole and proconfig=array['search_path=""'] and proacl::text='{postgres=X/postgres,authenticated=X/postgres}') then raise exception 'account_delete_core_drift';end if;
 if not exists(select 1 from pg_proc where oid='public.account_delete_cancel(uuid)'::regprocedure and md5(prosrc)='e26af799279e704b7100ee763e33861d' and prosecdef and proowner='postgres'::regrole and proconfig=array['search_path=""'] and proacl::text='{postgres=X/postgres,authenticated=X/postgres}') then raise exception 'account_delete_core_drift';end if;
 if not exists(select 1 from pg_proc where oid='public.account_delete_status(uuid,text)'::regprocedure and md5(prosrc)='034dcb6451daced76d839024b6dd0e90' and prosecdef and proowner='postgres'::regrole and proconfig=array['search_path=""'] and proacl::text='{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}') then raise exception 'account_delete_core_drift';end if;
 if not exists(select 1 from pg_proc where oid='public.account_delete_process(uuid,uuid)'::regprocedure and md5(prosrc)='66fe7ee37e142f48e637c3fc7b59e285' and prosecdef and proowner='postgres'::regrole and proconfig=array['search_path=""'] and proacl::text='{postgres=X/postgres,service_role=X/postgres}') then raise exception 'account_delete_core_drift';end if;
 if not exists(select 1 from pg_proc where oid='public.account_delete_finish(uuid,uuid)'::regprocedure and md5(prosrc)='528d5f7a9dd7536d8f26ec803baf5bb9' and prosecdef and proowner='postgres'::regrole and proconfig=array['search_path=""'] and proacl::text='{postgres=X/postgres,service_role=X/postgres}') then raise exception 'account_delete_core_drift';end if;
 if not exists(select 1 from pg_proc where oid='public.account_delete_pending()'::regprocedure and md5(prosrc)='9045c4033d3a64e8c38cf014b42c4963' and prosecdef and proowner='postgres'::regrole and proconfig=array['search_path=""'] and proacl::text='{postgres=X/postgres,service_role=X/postgres}') then raise exception 'account_delete_core_drift';end if;
 if (select coalesce(jsonb_agg(jsonb_build_object('child',conrelid::regclass::text,'parent',confrelid::regclass::text,'conname',conname,'definition',pg_get_constraintdef(oid)) order by conrelid::regclass::text,conname),'[]') from pg_constraint where contype='f' and confrelid=any(array['zoi.feed_posts'::regclass,'zoi.feed_comments'::regclass,'zoi.community_media_assets'::regclass,'zoi.community_member_drafts'::regclass])) is distinct from '[{"child":"zoi.community_comment_requests","parent":"zoi.feed_comments","conname":"community_comment_requests_comment_id_fkey","definition":"FOREIGN KEY (comment_id) REFERENCES zoi.feed_comments(id) ON DELETE CASCADE"},{"child":"zoi.community_comment_requests","parent":"zoi.feed_posts","conname":"community_comment_requests_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE CASCADE"},{"child":"zoi.community_media_byte_proofs","parent":"zoi.community_media_assets","conname":"community_media_byte_proofs_asset_id_fkey","definition":"FOREIGN KEY (asset_id) REFERENCES zoi.community_media_assets(id)"},{"child":"zoi.community_media_upload_grants","parent":"zoi.community_media_assets","conname":"community_media_upload_grants_asset_id_fkey","definition":"FOREIGN KEY (asset_id) REFERENCES zoi.community_media_assets(id)"},{"child":"zoi.community_member_draft_versions","parent":"zoi.community_member_drafts","conname":"community_member_draft_versions_draft_id_fkey","definition":"FOREIGN KEY (draft_id) REFERENCES zoi.community_member_drafts(id)"},{"child":"zoi.community_notifications","parent":"zoi.feed_comments","conname":"community_notifications_comment_id_fkey","definition":"FOREIGN KEY (comment_id) REFERENCES zoi.feed_comments(id) ON DELETE CASCADE"},{"child":"zoi.community_notifications","parent":"zoi.feed_posts","conname":"community_notifications_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE CASCADE"},{"child":"zoi.community_post_context","parent":"zoi.feed_comments","conname":"community_post_context_accepted_comment_id_fkey","definition":"FOREIGN KEY (accepted_comment_id) REFERENCES zoi.feed_comments(id) ON DELETE SET NULL"},{"child":"zoi.community_post_context","parent":"zoi.feed_posts","conname":"community_post_context_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE CASCADE"},{"child":"zoi.community_reports","parent":"zoi.feed_posts","conname":"community_reports_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE SET NULL"},{"child":"zoi.community_saved","parent":"zoi.feed_posts","conname":"community_saved_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE CASCADE"},{"child":"zoi.feed_comments","parent":"zoi.feed_posts","conname":"feed_comments_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE CASCADE"},{"child":"zoi.feed_likes","parent":"zoi.feed_posts","conname":"feed_likes_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE CASCADE"}]'::jsonb then raise exception 'account_delete_cascade_graph_drift';end if;
 if to_regprocedure('public.account_delete_community_step(uuid,uuid)') is not null then raise exception 'account_delete_community_already_installed';end if;
 if exists(select 1 from pg_proc where oid=any(array['zoi.community_member_immutable()'::regprocedure,'zoi.community_media_immutable()'::regprocedure]) and (proowner<>'postgres'::regrole or prosecdef or proconfig is distinct from array['search_path=""'] or proacl::text<>'{postgres=X/postgres}')) then raise exception 'account_delete_immutable_metadata_drift';end if;
 if (select prosrc from pg_proc where oid='zoi.community_member_immutable()'::regprocedure)<>'BEGIN RAISE EXCEPTION ''community_member_receipt_immutable'';END' or (select prosrc from pg_proc where oid='zoi.community_media_immutable()'::regprocedure)<>'BEGIN RAISE EXCEPTION ''media_immutable_evidence'';END' then raise exception 'account_delete_immutable_body_drift';end if;
end $$;
alter table zoi.account_deletion_requests
 add column community_cursor integer not null default 0 check(community_cursor between 0 and 21),
 add column erasure_xid xid8,
 add column erasure_objects jsonb not null default '[]' check(jsonb_typeof(erasure_objects)='array' and jsonb_array_length(erasure_objects)<=100),
 add column next_retry_at timestamptz,
 add column completed_at timestamptz,
 add column due_at timestamptz;
-- Root configures a finite budget only in the same verified transaction that
-- enables the installed worker. A paused/unconfigured rollout cannot accept an
-- indefinite request. No API caller can alter the budget.
create function zoi.account_delete_completion_budget() returns interval language sql volatile security definer set search_path='' as $$select null::interval$$;
do $guard$
declare original text:=pg_get_functiondef('public.account_delete_confirm(uuid)'::regprocedure);changed text;needle text:=E' update zoi.account_deletion_requests set state=''accepted'',accepted_at=clock_timestamp(),updated_at=clock_timestamp() where request_id=p_request;';addition text:=E' budget:=zoi.account_delete_completion_budget();\n if budget is null or budget<=interval ''0 seconds'' or not isfinite(clock_timestamp()+budget) or clock_timestamp()+budget>=r.recovery_until then raise exception ''account_delete_worker_not_ready'';end if;\n';decl text:='session_until timestamptz;';replacement text:='session_until timestamptz;budget interval;';owner_before oid;acl_before aclitem[];config_before text[];
begin
 select proowner,proacl,proconfig into owner_before,acl_before,config_before from pg_proc where oid='public.account_delete_confirm(uuid)'::regprocedure;
 if (length(original)-length(replace(original,needle,'')))/length(needle)<>1 or (length(original)-length(replace(original,decl,'')))/length(decl)<>1 then raise exception 'account_delete_deadline_guard_shape';end if;
 changed:=replace(replace(original,decl,replacement),needle,addition||replace(needle,'updated_at=clock_timestamp()','updated_at=clock_timestamp(),due_at=clock_timestamp()+budget'));
 if replace(replace(replace(changed,addition,''),replacement,decl),'updated_at=clock_timestamp(),due_at=clock_timestamp()+budget','updated_at=clock_timestamp()')<>original then raise exception 'account_delete_deadline_guard_preservation';end if;
 execute changed;
 if exists(select 1 from pg_proc where oid='public.account_delete_confirm(uuid)'::regprocedure and (proowner<>owner_before or proacl is distinct from acl_before or proconfig is distinct from config_before or not prosecdef)) then raise exception 'account_delete_deadline_metadata_drift';end if;
end $guard$;
create function zoi.account_delete_erasure_allowed(data jsonb,table_name text) returns boolean language plpgsql security definer set search_path='' as $$
declare p uuid;a uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then return false;end if;
 if table_name not in('community_member_draft_versions','community_member_requests','community_media_upload_grants','community_media_byte_proofs') then return false;end if;
 if table_name='community_media_byte_proofs' then select profile_id into p from zoi.community_media_assets where id=(data->>'asset_id')::uuid;
 else p:=(data->>'profile_id')::uuid;a:=(data->>'account_id')::uuid;end if;
 return exists(select 1 from zoi.account_deletion_requests r where r.profile_id=p and (a is null or a=r.actor_id) and r.erasure_xid=pg_current_xact_id() and r.worker_id is not null and r.worker_until>clock_timestamp() and r.state in('accepted','requires_review') and r.community_cursor<21);
end $$;
-- Preserve each original immutable trigger and exception outside exact erasure.
create or replace function zoi.community_member_immutable() returns trigger language plpgsql set search_path='' as $$BEGIN IF TG_OP='DELETE' AND zoi.account_delete_erasure_allowed(to_jsonb(OLD),TG_TABLE_NAME) THEN RETURN OLD;END IF;RAISE EXCEPTION 'community_member_receipt_immutable';END$$;
create or replace function zoi.community_media_immutable() returns trigger language plpgsql set search_path='' as $$BEGIN IF TG_OP='DELETE' AND zoi.account_delete_erasure_allowed(to_jsonb(OLD),TG_TABLE_NAME) THEN RETURN OLD;END IF;RAISE EXCEPTION 'media_immutable_evidence';END$$;

create function zoi.account_delete_community_write_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare d jsonb:=to_jsonb(new);p uuid;a uuid;r zoi.account_deletion_requests;field text;
begin
 -- Existing service cleanup may hold this asset row before erasure holds its
 -- receipt. A discard-only bookkeeping transition cannot restore personal data
 -- and takes no reverse receipt lock. All other matching writes use NOWAIT.
 if tg_op='UPDATE' and tg_table_name='community_media_assets' then
  if new.state='discarded' and (to_jsonb(new)-array['state','storage_deleted_at']) is not distinct from (to_jsonb(old)-array['state','storage_deleted_at']) then return new;end if;
 end if;
 foreach field in array tg_argv loop
  if d->>field is not null then
   p:=(d->>field)::uuid;
   select * into r from zoi.account_deletion_requests where (profile_id=p or actor_id=p) and state<>'cancelled' for share nowait;
   if found and current_setting('transaction_isolation')<>'read committed' then raise exception 'account_delete_isolation_required';end if;
   if found and r.state<>'prepared' then raise exception 'account_deletion_in_progress' using errcode='42501';end if;
  end if;
 end loop;
 return new;
end $$;
-- Actor-linked tables outside the four core guards must not accept late data,
-- including service writes. Existing session/writer permissions do not widen.
do $$declare x record;begin
 for x in select * from (values
 ('community_member_drafts','profile_id,account_id'),('community_member_draft_versions','profile_id,account_id'),('community_member_requests','profile_id,account_id'),
 ('community_media_assets','profile_id'),('community_media_upload_grants','profile_id,account_id'),('community_publish_requests','profile_id'),('community_comment_requests','profile_id'),
 ('community_saved','profile_id'),('community_mutes','profile_id,muted'),('feed_likes','profile_id'),('feed_follows','follower,followee'),('feed_blocks','blocker,blocked'),('feed_reports','profile_id'),('community_notifications','actor,recipient')
 )v(t,fields) loop
 execute format('create trigger account_delete_community_write_guard before insert or update on zoi.%I for each row execute function zoi.account_delete_community_write_guard(%s)',x.t,(select string_agg(quote_literal(f),',') from unnest(string_to_array(x.fields,','))f));
 end loop;
end $$;
create function zoi.account_delete_storage_write_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare item record;r zoi.account_deletion_requests;
begin
 -- Inspect both old/new identities so rename cannot evade an accepted erasure.
 for item in select new.bucket_id bucket,new.name name union all select case when tg_op='UPDATE' then old.bucket_id end,case when tg_op='UPDATE' then old.name end loop
 if item.bucket='community-private' then
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'account_delete_isolation_required';end if;
  select * into r from zoi.account_deletion_requests where profile_id::text=split_part(item.name,'/',1) and state<>'cancelled' for share nowait;
  if found and r.state<>'prepared' then raise exception 'account_deletion_in_progress' using errcode='42501';end if;
 end if;
 end loop;return new;
end $$;
create trigger account_delete_storage_write_guard before insert or update on storage.objects for each row execute function zoi.account_delete_storage_write_guard();

-- Recheck only the current bounded stage's target, including parents outside
-- the four initial FK captures. Unknown child references/triggers are held
-- before mutation; catalog uncertainty never authorizes a business cascade.
create function zoi.account_delete_erasure_table_current(t regclass) returns void language plpgsql security definer set search_path='' as $$
declare expected jsonb:='[{"child":"zoi.community_comment_requests","parent":"zoi.feed_comments","conname":"community_comment_requests_comment_id_fkey","definition":"FOREIGN KEY (comment_id) REFERENCES zoi.feed_comments(id) ON DELETE CASCADE"},{"child":"zoi.community_comment_requests","parent":"zoi.feed_posts","conname":"community_comment_requests_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE CASCADE"},{"child":"zoi.community_media_byte_proofs","parent":"zoi.community_media_assets","conname":"community_media_byte_proofs_asset_id_fkey","definition":"FOREIGN KEY (asset_id) REFERENCES zoi.community_media_assets(id)"},{"child":"zoi.community_media_upload_grants","parent":"zoi.community_media_assets","conname":"community_media_upload_grants_asset_id_fkey","definition":"FOREIGN KEY (asset_id) REFERENCES zoi.community_media_assets(id)"},{"child":"zoi.community_member_draft_versions","parent":"zoi.community_member_drafts","conname":"community_member_draft_versions_draft_id_fkey","definition":"FOREIGN KEY (draft_id) REFERENCES zoi.community_member_drafts(id)"},{"child":"zoi.community_notifications","parent":"zoi.feed_comments","conname":"community_notifications_comment_id_fkey","definition":"FOREIGN KEY (comment_id) REFERENCES zoi.feed_comments(id) ON DELETE CASCADE"},{"child":"zoi.community_notifications","parent":"zoi.feed_posts","conname":"community_notifications_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE CASCADE"},{"child":"zoi.community_post_context","parent":"zoi.feed_comments","conname":"community_post_context_accepted_comment_id_fkey","definition":"FOREIGN KEY (accepted_comment_id) REFERENCES zoi.feed_comments(id) ON DELETE SET NULL"},{"child":"zoi.community_post_context","parent":"zoi.feed_posts","conname":"community_post_context_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE CASCADE"},{"child":"zoi.community_reports","parent":"zoi.feed_posts","conname":"community_reports_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE SET NULL"},{"child":"zoi.community_saved","parent":"zoi.feed_posts","conname":"community_saved_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE CASCADE"},{"child":"zoi.feed_comments","parent":"zoi.feed_posts","conname":"feed_comments_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE CASCADE"},{"child":"zoi.feed_likes","parent":"zoi.feed_posts","conname":"feed_likes_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE CASCADE"}]';actual jsonb;
begin
 if t::text not in('zoi.community_reports','zoi.community_member_draft_versions','zoi.community_member_requests','zoi.community_member_drafts','zoi.community_publish_requests','zoi.community_comment_requests','zoi.community_notifications','zoi.community_saved','zoi.community_mutes','zoi.feed_likes','zoi.feed_follows','zoi.feed_blocks','zoi.feed_reports','zoi.feed_comments','zoi.feed_posts','zoi.community_media_upload_grants','zoi.community_media_byte_proofs','zoi.community_media_assets','zoi.community_profiles','zoi.community_preferences') then raise exception 'account_delete_table_unavailable';end if;
 execute format('lock table %s in row exclusive mode',t);
 select coalesce(jsonb_agg(jsonb_build_object('child',conrelid::regclass::text,'parent',confrelid::regclass::text,'conname',conname,'definition',pg_get_constraintdef(oid)) order by conrelid::regclass::text,conname),'[]') into actual from pg_constraint where contype='f' and confrelid=t;
 if actual is distinct from (select coalesce(jsonb_agg(x order by x->>'child',x->>'conname'),'[]') from jsonb_array_elements(expected)x where x->>'parent'=t::text) then raise exception 'account_delete_cascade_graph_drift';end if;
 if exists(select 1 from pg_trigger where tgrelid=t and not tgisinternal and (tgtype::integer&24)<>0 and (tgenabled<>'O' or not(
  tgname='account_delete_personal_guard' and tgfoid='zoi.account_delete_personal_guard()'::regprocedure or
  tgname='account_delete_community_write_guard' and tgfoid='zoi.account_delete_community_write_guard()'::regprocedure or
  tgname in('community_member_versions_immutable','community_member_requests_immutable') and tgfoid='zoi.community_member_immutable()'::regprocedure or
  tgname in('community_media_grant_immutable','community_media_proof_immutable') and tgfoid='zoi.community_media_immutable()'::regprocedure
 ))) then raise exception 'account_delete_trigger_graph_drift';end if;
end $$;

create function public.account_delete_community_step(p_request uuid,p_worker uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r zoi.account_deletion_requests;a uuid;p uuid;tables text[]:=array['community_reports','community_member_draft_versions','community_member_requests','community_member_drafts','community_publish_requests','community_comment_requests','community_notifications','community_saved','community_mutes','feed_likes','feed_follows','feed_blocks','feed_reports'];predicates text[]:=array['reporter=$1','profile_id=$1 and account_id=$2','profile_id=$1 and account_id=$2','profile_id=$1 and account_id=$2','profile_id=$1','profile_id=$1','recipient=$1 or actor=$1','profile_id=$1','profile_id=$1 or muted=$1','profile_id=$1','follower=$1 or followee=$1','blocker=$1 or blocked=$1','profile_id=$1'];n integer:=0;objects jsonb;outcome text:='accepted';
begin
 if auth.role()<>'service_role' or p_worker is null then raise exception 'account_delete_worker_required' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'account_delete_isolation_required';end if;
 lock table zoi.feed_posts,zoi.feed_comments,zoi.community_media_assets,zoi.community_member_drafts in row exclusive mode;
 if (select coalesce(jsonb_agg(jsonb_build_object('child',conrelid::regclass::text,'parent',confrelid::regclass::text,'conname',conname,'definition',pg_get_constraintdef(oid)) order by conrelid::regclass::text,conname),'[]') from pg_constraint where contype='f' and confrelid=any(array['zoi.feed_posts'::regclass,'zoi.feed_comments'::regclass,'zoi.community_media_assets'::regclass,'zoi.community_member_drafts'::regclass])) is distinct from '[{"child":"zoi.community_comment_requests","parent":"zoi.feed_comments","conname":"community_comment_requests_comment_id_fkey","definition":"FOREIGN KEY (comment_id) REFERENCES zoi.feed_comments(id) ON DELETE CASCADE"},{"child":"zoi.community_comment_requests","parent":"zoi.feed_posts","conname":"community_comment_requests_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE CASCADE"},{"child":"zoi.community_media_byte_proofs","parent":"zoi.community_media_assets","conname":"community_media_byte_proofs_asset_id_fkey","definition":"FOREIGN KEY (asset_id) REFERENCES zoi.community_media_assets(id)"},{"child":"zoi.community_media_upload_grants","parent":"zoi.community_media_assets","conname":"community_media_upload_grants_asset_id_fkey","definition":"FOREIGN KEY (asset_id) REFERENCES zoi.community_media_assets(id)"},{"child":"zoi.community_member_draft_versions","parent":"zoi.community_member_drafts","conname":"community_member_draft_versions_draft_id_fkey","definition":"FOREIGN KEY (draft_id) REFERENCES zoi.community_member_drafts(id)"},{"child":"zoi.community_notifications","parent":"zoi.feed_comments","conname":"community_notifications_comment_id_fkey","definition":"FOREIGN KEY (comment_id) REFERENCES zoi.feed_comments(id) ON DELETE CASCADE"},{"child":"zoi.community_notifications","parent":"zoi.feed_posts","conname":"community_notifications_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE CASCADE"},{"child":"zoi.community_post_context","parent":"zoi.feed_comments","conname":"community_post_context_accepted_comment_id_fkey","definition":"FOREIGN KEY (accepted_comment_id) REFERENCES zoi.feed_comments(id) ON DELETE SET NULL"},{"child":"zoi.community_post_context","parent":"zoi.feed_posts","conname":"community_post_context_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE CASCADE"},{"child":"zoi.community_reports","parent":"zoi.feed_posts","conname":"community_reports_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE SET NULL"},{"child":"zoi.community_saved","parent":"zoi.feed_posts","conname":"community_saved_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE CASCADE"},{"child":"zoi.feed_comments","parent":"zoi.feed_posts","conname":"feed_comments_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE CASCADE"},{"child":"zoi.feed_likes","parent":"zoi.feed_posts","conname":"feed_likes_post_id_fkey","definition":"FOREIGN KEY (post_id) REFERENCES zoi.feed_posts(id) ON DELETE CASCADE"}]'::jsonb then raise exception 'account_delete_cascade_graph_drift';end if;
 if (select array_agg(attname::text order by attnum) from pg_attribute where attrelid='zoi.community_reports'::regclass and attnum>0 and not attisdropped) is distinct from array['id','reporter','post_id','request_id','reason','details','content_snapshot','status','reviewed_by','review_note','created_at','reviewed_at'] then raise exception 'account_delete_snapshot_schema_drift';end if;
 select actor_id,profile_id into a,p from zoi.account_deletion_requests where request_id=p_request;
 if a is null then raise exception 'account_delete_unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended('account-delete-admission:'||a::text,0));
 perform pg_advisory_xact_lock(hashtextextended('account-delete:'||a::text,0));
 perform 1 from zoi.user_profiles where id=p for update;
 select * into r from zoi.account_deletion_requests where request_id=p_request for update;
 if r.state not in('accepted','requires_review') or r.community_cursor=21 then return jsonb_build_object('request_id',p_request,'state',r.state,'community_complete',r.community_cursor=21);end if;
 if r.worker_until>clock_timestamp() and r.worker_id is distinct from p_worker then raise exception 'account_delete_busy';end if;
 if r.next_retry_at>clock_timestamp() then return jsonb_build_object('request_id',p_request,'state',r.state,'community_complete',false);end if;
 if exists(select 1 from zoi.community_member_drafts where (profile_id=p or account_id=a) and (profile_id<>p or account_id<>a)) or exists(select 1 from zoi.community_member_draft_versions where (profile_id=p or account_id=a) and (profile_id<>p or account_id<>a)) or exists(select 1 from zoi.community_member_requests where (profile_id=p or account_id=a) and (profile_id<>p or account_id<>a)) then
  update zoi.account_deletion_requests set state='requires_review',reason='schema_review',worker_id=null,worker_until=null where request_id=p_request;
  return jsonb_build_object('request_id',p_request,'state','requires_review','community_complete',false);
 end if;
 loop
 n:=0;
 update zoi.account_deletion_requests set state='accepted',reason=null,worker_id=p_worker,worker_until=clock_timestamp()+interval '2 minutes',erasure_xid=pg_current_xact_id(),updated_at=clock_timestamp() where request_id=p_request;
 if r.community_cursor<13 then
  perform zoi.account_delete_erasure_table_current(('zoi.'||tables[r.community_cursor+1])::regclass);
  execute format('delete from zoi.%I where ctid in(select ctid from zoi.%I where %s order by ctid limit 100)',tables[r.community_cursor+1],tables[r.community_cursor+1],predicates[r.community_cursor+1]) using p,a;
  get diagnostics n=row_count;
 elsif r.community_cursor=13 then
  perform zoi.account_delete_erasure_table_current('zoi.community_reports'::regclass);
  -- Canonical report snapshots store top-level author.id, not free-text guesses.
  update zoi.community_reports set content_snapshot='{"removed":true}',details='',review_note=null,reviewed_by=case when reviewed_by=p then null else reviewed_by end
   where id in(select id from zoi.community_reports where (post_id in(select id from zoi.feed_posts where profile_id=p) or content_snapshot->'author'->>'id'=p::text) and content_snapshot<>'{"removed":true}'::jsonb order by id limit 100);
  get diagnostics n=row_count;
  if n=0 then
   perform zoi.account_delete_erasure_table_current('zoi.feed_reports'::regclass);
   update zoi.feed_reports set reason='Content removed' where id in(select id from zoi.feed_reports where post_id in(select id from zoi.feed_posts where profile_id=p) and reason is distinct from 'Content removed' order by id limit 100);
   get diagnostics n=row_count;
  end if;
 elsif r.community_cursor=14 then
  perform zoi.account_delete_erasure_table_current('zoi.community_reports'::regclass);
  update zoi.community_reports set reviewed_by=null,review_note=null where id in(select id from zoi.community_reports where reviewed_by=p order by id limit 100);
  get diagnostics n=row_count;
 elsif r.community_cursor=15 then
  perform zoi.account_delete_erasure_table_current('zoi.feed_comments'::regclass);
  delete from zoi.feed_comments where id in(select id from zoi.feed_comments where profile_id=p order by id limit 100);get diagnostics n=row_count;
 elsif r.community_cursor=16 then
  perform zoi.account_delete_erasure_table_current('zoi.feed_comments'::regclass);
  -- Keep other authors' text. Detach replies before parent FK cascade can erase them.
  update zoi.feed_comments set post_id=null where id in(select c.id from zoi.feed_comments c join zoi.feed_posts f on f.id=c.post_id where f.profile_id=p and c.profile_id<>p order by c.id limit 100);get diagnostics n=row_count;
 elsif r.community_cursor=17 then
  perform zoi.account_delete_erasure_table_current('zoi.feed_posts'::regclass);
  delete from zoi.feed_posts where id in(select id from zoi.feed_posts where profile_id=p order by id limit 100);get diagnostics n=row_count;
 elsif r.community_cursor=18 then
  if exists(select 1 from storage.objects where bucket_id='community-private' and split_part(name,'/',1)=p::text and name!~('^'||p::text||'/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')) then
   update zoi.account_deletion_requests set state='requires_review',reason='storage_review',erasure_xid=null,worker_id=null,worker_until=null,next_retry_at=null where request_id=p_request;
   return jsonb_build_object('request_id',p_request,'state','requires_review','community_complete',false);
  end if;
  if jsonb_array_length(r.erasure_objects)>0 then
   objects:=r.erasure_objects;
   if exists(select 1 from storage.objects o join jsonb_array_elements(objects)x on o.bucket_id='community-private' and o.name=x->>'path' where o.id::text is distinct from x->>'id' or o.version is distinct from x->>'version') then raise exception 'account_delete_storage_context_changed';end if;
  else
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'path',name,'version',version) order by name),'[]') into objects from(select id,name,version from storage.objects where bucket_id='community-private' and split_part(name,'/',1)=p::text order by name limit 8)x;
  end if;
  if jsonb_array_length(objects)>0 then
   update zoi.account_deletion_requests set erasure_objects=objects,erasure_xid=null where request_id=p_request;
   return jsonb_build_object('request_id',p_request,'state','accepted','community_complete',false,'worker_id',p_worker,'objects',objects);
  end if;
 elsif r.community_cursor=19 then
  perform zoi.account_delete_erasure_table_current('zoi.community_media_assets'::regclass);
  -- FK children, including immutable proof rows, are erased in the same owned
  -- transaction before their asset; original bytes already passed absence gate.
  delete from zoi.community_media_upload_grants where id in(select g.id from zoi.community_media_upload_grants g join zoi.community_media_assets a on a.id=g.asset_id where a.profile_id=p order by g.id limit 100);get diagnostics n=row_count;
  if n=0 then
  delete from zoi.community_media_byte_proofs where asset_id in(select g.asset_id from zoi.community_media_byte_proofs g join zoi.community_media_assets a on a.id=g.asset_id where a.profile_id=p order by g.asset_id limit 100);get diagnostics n=row_count;
  end if;
  if n=0 then
  delete from zoi.community_media_assets where id in(select a.id from zoi.community_media_assets a where a.profile_id=p and not exists(select 1 from zoi.community_media_upload_grants g where g.asset_id=a.id) and not exists(select 1 from zoi.community_media_byte_proofs g where g.asset_id=a.id) order by a.id limit 100);get diagnostics n=row_count;
  end if;
 elsif r.community_cursor=20 then
  perform zoi.account_delete_erasure_table_current('zoi.community_profiles'::regclass);perform zoi.account_delete_erasure_table_current('zoi.community_preferences'::regclass);
  delete from zoi.community_profiles where profile_id=p;delete from zoi.community_preferences where profile_id=p;
 end if;
 update zoi.account_deletion_requests set community_cursor=case when n=0 then community_cursor+1 else community_cursor end,erasure_xid=null,worker_id=null,worker_until=null,next_retry_at=clock_timestamp(),updated_at=clock_timestamp() where request_id=p_request returning * into r;
 if n>0 or r.community_cursor in(18,21) then return jsonb_build_object('request_id',p_request,'state','accepted','community_complete',r.community_cursor=21);end if;
 end loop;
end $$;

create function public.account_delete_community_storage_done(p_request uuid,p_worker uuid,p_objects jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r zoi.account_deletion_requests;
begin
 if auth.role()<>'service_role' then raise exception 'account_delete_worker_required' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'account_delete_isolation_required';end if;
 select * into r from zoi.account_deletion_requests where request_id=p_request;
 perform pg_advisory_xact_lock(hashtextextended('account-delete-admission:'||r.actor_id::text,0));
 select * into r from zoi.account_deletion_requests where request_id=p_request for update;
 if not found or r.state<>'accepted' or r.community_cursor<>18 or r.worker_id is distinct from p_worker or r.worker_until<=clock_timestamp() or p_objects is distinct from r.erasure_objects then raise exception 'account_delete_request_conflict';end if;
 if exists(select 1 from storage.objects o join jsonb_array_elements(p_objects)x on o.bucket_id='community-private' and o.name=x->>'path') then raise exception 'account_delete_storage_remaining';end if;
 update zoi.account_deletion_requests set erasure_objects='[]',worker_id=null,worker_until=null,next_retry_at=clock_timestamp(),updated_at=clock_timestamp() where request_id=p_request;
 return jsonb_build_object('request_id',p_request,'state','accepted','community_complete',false);
end $$;
create function public.account_delete_community_retry(p_request uuid,p_worker uuid) returns void language plpgsql security definer set search_path='' as $$
declare a uuid;
begin
 if auth.role()<>'service_role' then raise exception 'account_delete_worker_required' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'account_delete_isolation_required';end if;
 select actor_id into a from zoi.account_deletion_requests where request_id=p_request;
 perform pg_advisory_xact_lock(hashtextextended('account-delete-admission:'||a::text,0));
 update zoi.account_deletion_requests set worker_id=null,worker_until=null,next_retry_at=clock_timestamp()+make_interval(secs=>least(3600,30*power(2,least(attempts,6))::integer)),attempts=attempts+1,erasure_xid=null,updated_at=clock_timestamp() where request_id=p_request and worker_id=p_worker and state='accepted';
end $$;
create or replace function public.account_delete_pending() returns jsonb language plpgsql security definer set search_path='' as $$begin
 if auth.role()<>'service_role' then raise exception 'account_delete_worker_required' using errcode='42501';end if;
 return(select coalesce(jsonb_agg(request_id),'[]') from(select request_id from zoi.account_deletion_requests where state in('accepted','auth_pending') and (worker_until is null or worker_until<=clock_timestamp()) and (next_retry_at is null or next_retry_at<=clock_timestamp()) order by updated_at,created_at,request_id limit 5)x);
end $$;
create or replace function public.account_delete_status(p_request uuid,p_recovery_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r zoi.account_deletion_requests;
begin
 if p_recovery_token is null or p_recovery_token!~'^[0-9a-f]{64}$' then raise exception 'account_delete_unavailable' using errcode='42501';end if;
 select * into r from zoi.account_deletion_requests where request_id=p_request and recovery_hash=encode(extensions.digest(p_recovery_token,'sha256'),'hex') and recovery_until>clock_timestamp();
 if not found then raise exception 'account_delete_unavailable' using errcode='42501';end if;
 return jsonb_build_object('request_id',r.request_id,'state',r.state,'accepted_at',r.accepted_at,'updated_at',r.updated_at,'due_at',r.due_at,'completed_at',case when r.state='completed' then r.updated_at else null end,'stage',case when r.state='completed' then 'completed' when r.state='requires_review' then 'additional_cleanup' when r.community_cursor<18 then 'community' when r.community_cursor<20 then 'media' else 'account' end);
end $$;
do $$declare f record;begin for f in select p.oid::regprocedure sig,p.proname,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='zoi' and p.proname in('account_delete_erasure_allowed','account_delete_community_write_guard','account_delete_storage_write_guard','account_delete_erasure_table_current','account_delete_completion_budget')) or (n.nspname='public' and p.proname in('account_delete_community_step','account_delete_community_storage_done','account_delete_community_retry')) loop
 execute format('alter function %s owner to postgres',f.sig);execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
 if f.nspname='public' then execute format('grant execute on function %s to service_role',f.sig);end if;
end loop;end $$;

-- END EXACT SOURCE BODY supabase/migrations/20261016044936_account_deletion_community_erasure.sql
-- EXACT SOURCE BODY supabase/migrations/20261016044937_account_deletion_worker_schedule.sql
-- Separate, initially PAUSED scheduler. Root activates only after deployed Edge,
-- dedicated synthetic erasure, backlog/capacity and deadline admission pass.

set local lock_timeout='2s';set local statement_timeout='5s';
do $$begin
 if current_user<>'postgres' then raise exception 'account_delete_installer_required';end if;
 if to_regprocedure('zoi.account_delete_schedule()') is not null or exists(select 1 from cron.job where jobname='zoi-account-delete-worker') then raise exception 'account_delete_schedule_already_exists';end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.account_delete_community_step(uuid,uuid)') and proowner='postgres'::regrole and prosecdef and proconfig=array['search_path=""'] and proacl::text='{postgres=X/postgres,service_role=X/postgres}') then raise exception 'account_delete_worker_dependency_drift';end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.account_delete_community_step(uuid,uuid)') and md5(prosrc)='7aa5974150180e5cd4679e9b610cb916' and proowner='postgres'::regrole and prosecdef and proconfig=array['search_path=""'] and proacl::text='{postgres=X/postgres,service_role=X/postgres}') then raise exception 'account_delete_worker_body_drift';end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.account_delete_community_storage_done(uuid,uuid,jsonb)') and md5(prosrc)='57f70f2261ddc7489a6792c1c2056352' and proowner='postgres'::regrole and prosecdef and proconfig=array['search_path=""'] and proacl::text='{postgres=X/postgres,service_role=X/postgres}') then raise exception 'account_delete_worker_body_drift';end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.account_delete_community_retry(uuid,uuid)') and md5(prosrc)='09a0438c331749b24ef7d0c5b9d8629b' and proowner='postgres'::regrole and prosecdef and proconfig=array['search_path=""'] and proacl::text='{postgres=X/postgres,service_role=X/postgres}') then raise exception 'account_delete_worker_body_drift';end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.account_delete_pending()') and md5(prosrc)='bd4efa0869ca52ecd4ad2857041c4cf2' and proowner='postgres'::regrole and prosecdef and proconfig=array['search_path=""'] and proacl::text='{postgres=X/postgres,service_role=X/postgres}') then raise exception 'account_delete_worker_body_drift';end if;
 if (select count(*) from vault.secrets where name='service_role_key')<>1 then raise exception 'account_delete_service_configuration_required';end if;
end $$;
create function zoi.account_delete_schedule() returns bigint language plpgsql security definer set search_path='' as $$
declare credential text;request_id bigint;
begin
 if zoi.account_delete_completion_budget() is null then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('zoi-account-delete-schedule',0)) then return null;end if;
 if not exists(select 1 from zoi.account_deletion_requests where state in('accepted','auth_pending') and (worker_until is null or worker_until<=clock_timestamp()) and (next_retry_at is null or next_retry_at<=clock_timestamp())) then return null;end if;
 if exists(select 1 from net.http_request_queue where url='https://csebihpaychdkanjjsmz.supabase.co/functions/v1/account-delete') then return null;end if;
 select decrypted_secret into strict credential from vault.decrypted_secrets where name='service_role_key';
 if credential is null or length(credential) not between 20 and 4096 or credential~'[[:space:]]' then raise exception 'account_delete_service_configuration_required';end if;
 select net.http_post(url:='https://csebihpaychdkanjjsmz.supabase.co/functions/v1/account-delete',headers:=jsonb_build_object('Content-Type','application/json','apikey',credential,'Authorization','Bearer '||credential),body:='{"action":"process_pending"}'::jsonb,timeout_milliseconds:=55000) into request_id;
 return request_id;
end $$;
alter function zoi.account_delete_schedule() owner to postgres;
revoke all on function zoi.account_delete_schedule() from public,anon,authenticated,service_role;
do $$declare job_id bigint;begin
 select cron.schedule('zoi-account-delete-worker','* * * * *','select zoi.account_delete_schedule();') into job_id;
 perform cron.alter_job(job_id,active:=false);
end $$;

-- END EXACT SOURCE BODY supabase/migrations/20261016044937_account_deletion_worker_schedule.sql

-- No fixture actors, Auth claims, Storage requests or real-user rows are inserted.
do $verify$begin
 if (select count(*)from zoi.account_deletion_requests)<>0 or zoi.account_delete_completion_budget()is not null then raise exception 'account_delete_admission_must_remain_closed';end if;
 if(select count(*)from cron.job where jobname='zoi-account-delete-worker'and not active and schedule='* * * * *'and command='select zoi.account_delete_schedule();'and username='postgres')<>1 then raise exception 'account_delete_paused_schedule_required';end if;
 if zoi.account_delete_schedule()is not null then raise exception 'account_delete_unconfigured_dispatch_must_noop';end if;
 if has_table_privilege('anon','zoi.account_deletion_requests','SELECT')or has_table_privilege('authenticated','zoi.account_deletion_requests','SELECT')or has_table_privilege('service_role','zoi.account_deletion_requests','SELECT')then raise exception 'account_delete_private_ledger_acl';end if;
end $verify$;
select jsonb_build_object(
 'rehearsal_only',true,'requests',0,'budget_configured',false,'worker_active',false,
 'function_catalog',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'md5',md5(pg_get_functiondef(p.oid)),'owner',pg_get_userbyid(p.proowner),'config',p.proconfig,'acl',p.proacl::text)order by p.oid::regprocedure::text)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('zoi','public')and p.proname like 'account_delete_%'),
 'ledger_shape',(select jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod),'not_null',attnotnull)order by attnum)from pg_attribute where attrelid='zoi.account_deletion_requests'::regclass and attnum>0 and not attisdropped),
 'ledger_shape_sha256',(select encode(extensions.digest(string_agg(attname||':'||format_type(atttypid,atttypmod)||':'||attnotnull::text,E'\n'order by attnum),'sha256'),'hex')from pg_attribute where attrelid='zoi.account_deletion_requests'::regclass and attnum>0 and not attisdropped),
 'ledger_rls',(select relrowsecurity from pg_class where oid='zoi.account_deletion_requests'::regclass),
 'cron',(select jsonb_build_object('id',jobid,'active',active,'schedule',schedule,'command_md5',md5(command),'owner',username)from cron.job where jobname='zoi-account-delete-worker')
)as rollback_rehearsal;
rollback;
-- Root must separately verify after rollback: no ledger/functions/job, original ensure_profile hash and unrelated jobs unchanged.
