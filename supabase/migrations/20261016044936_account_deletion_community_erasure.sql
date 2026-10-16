-- Companion to immutable core V2. No activation occurs in this migration.
begin;
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
commit;
