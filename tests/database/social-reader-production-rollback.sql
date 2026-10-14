-- Exact production reader contract probe. Fresh private fixture rows only.
-- Existing dedicated QA actor and real active session; no helper overrides.
BEGIN;
SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='45s';
CREATE TEMP TABLE qa_social_read_results(label text PRIMARY KEY,passed boolean)ON COMMIT DROP;
GRANT INSERT,SELECT ON qa_social_read_results TO authenticated,anon;
CREATE FUNCTION pg_temp.qa_social_read_assert(ok boolean,label text)RETURNS void LANGUAGE plpgsql AS $$BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'qa_social_reader_assertion_failed:%',label;END IF;INSERT INTO pg_temp.qa_social_read_results VALUES(label,true);END$$;
DO $qa$
DECLARE executor name:=current_user;
 actor constant uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';account constant uuid:='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';known_ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';
 ws constant uuid:='d3eb6d31-5454-4c5c-b52b-cd2610140001';post constant uuid:='d3eb6d31-5454-4c5c-b52b-cd2610140002';expired constant uuid:='d3eb6d31-5454-4c5c-b52b-cd2610140003';target constant uuid:='d3eb6d31-5454-4c5c-b52b-cd2610140004';sid uuid;channel bigint;v jsonb;call text;denied boolean;n integer;
BEGIN
 IF EXISTS(SELECT 1 FROM zoi.workspaces WHERE id=ws)OR EXISTS(SELECT 1 FROM zoi.social_posts WHERE id=post)OR EXISTS(SELECT 1 FROM auth.sessions WHERE id=expired)OR EXISTS(SELECT 1 FROM zoi.social_post_targets WHERE id=target)THEN RAISE EXCEPTION 'qa_social_reader_fixture_collision';END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.workspaces w JOIN zoi.user_profiles p ON p.id=w.owner_profile_id JOIN auth.users u ON u.id=p.auth_user_id WHERE w.id=known_ws AND w.name='Zoi isolated QA 2026-09-30'AND w.owner_profile_id=actor AND p.auth_user_id=account AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND NOT coalesce(u.is_anonymous,false)AND(u.banned_until IS NULL OR u.banned_until<=clock_timestamp()))THEN RAISE EXCEPTION 'dedicated_qa_authority_unavailable';END IF;
 SELECT id INTO sid FROM auth.sessions WHERE user_id=account AND(not_after IS NULL OR not_after>clock_timestamp())ORDER BY created_at DESC NULLS LAST LIMIT 1;IF sid IS NULL THEN RAISE EXCEPTION 'dedicated_qa_current_session_unavailable';END IF;
 INSERT INTO zoi.workspaces(id,name,kind,owner_profile_id,created_by_auth)VALUES(ws,'Rollback-only social reader fixture','business',actor,account);
 INSERT INTO zoi.workspace_members(workspace_id,profile_id,role)VALUES(ws,actor,'viewer');
 INSERT INTO zoi.social_posts(id,workspace_id,author_profile,body,status,channels,media,meta,created_at)VALUES(post,ws,actor,'Private rollback-only reader fixture','draft','{}','[]','{}','2026-10-01');
 INSERT INTO zoi.social_channels(workspace_id,platform,handle,display_name,connected,status,access_token)VALUES(ws,'facebook','qa-reader-rollback-20261014','Rollback-only channel',false,'pending','NONCREDENTIAL_FIXTURE_MARKER')RETURNING id INTO channel;
 INSERT INTO zoi.social_post_targets(id,post_id,channel_id,platform,status)VALUES(target,post,channel,'facebook','pending');
 INSERT INTO auth.sessions(id,user_id,created_at,updated_at,not_after)VALUES(expired,account,clock_timestamp(),clock_timestamp(),clock_timestamp()-interval'1minute');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated','session_id',sid)::text,true);PERFORM set_config('request.jwt.claim.sub',account::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT count(*)INTO n FROM public.social_list_posts(ws);PERFORM pg_temp.qa_social_read_assert(n=1,'current_viewer_reads_actual_private_post');
 SELECT to_jsonb(p)INTO v FROM public.social_list_posts(ws,'2026-09-30','2026-10-02')p;PERFORM pg_temp.qa_social_read_assert(v->>'id'=post::text AND v->>'body'='Private rollback-only reader fixture','named_date_filters_and_canonical_shape');
 v:=public.social_stats(ws);PERFORM pg_temp.qa_social_read_assert(v->>'drafts'='1'AND v->>'channels_pending'='1','current_viewer_actual_stats');
 SELECT to_jsonb(c)INTO v FROM public.social_channels_list(ws)c;PERFORM pg_temp.qa_social_read_assert(v->>'id'=channel::text AND NOT(v?'access_token')AND NOT(v?'refresh_token')AND strpos(v::text,'NONCREDENTIAL_FIXTURE_MARKER')=0,'current_viewer_channels_do_not_expose_credentials');
 v:=public.social_post_targets_list(ws);PERFORM pg_temp.qa_social_read_assert(v?post::text AND v#>>ARRAY[post::text,'0','status']='pending','current_viewer_actual_delivery_targets');
 denied:=false;BEGIN PERFORM public.social_save_post(ws,'Viewer cannot write','{}',NULL,'draft','[]',NULL,'{}',post);EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;PERFORM pg_temp.qa_social_read_assert(denied,'reader_gate_does_not_grant_viewer_write');
 denied:=false;BEGIN PERFORM public.social_delete_post(ws,post);EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;PERFORM pg_temp.qa_social_read_assert(denied,'reader_gate_does_not_grant_viewer_delete');
 EXECUTE format('SET LOCAL ROLE %I',executor);DELETE FROM zoi.workspace_members WHERE workspace_id=ws AND profile_id=actor;EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM pg_temp.qa_social_read_assert((public.social_stats(ws)->>'drafts')::integer=1,'actual_owner_without_member_fallback');SELECT count(*)INTO n FROM public.social_list_posts(ws);PERFORM pg_temp.qa_social_read_assert(n=1,'real_owner_without_member_reads');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated','session_id',expired)::text,true);
 FOREACH call IN ARRAY ARRAY[format('SELECT count(*)FROM public.social_list_posts(%L)',ws),format('SELECT public.social_stats(%L)',ws),format('SELECT count(*)FROM public.social_channels_list(%L)',ws),format('SELECT public.social_post_targets_list(%L)',ws)]LOOP denied:=false;BEGIN EXECUTE call;EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='suite_session_unavailable';END;PERFORM pg_temp.qa_social_read_assert(denied,'expired_session_refused_'||split_part(call,'public.',2));END LOOP;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated')::text,true);
 FOREACH call IN ARRAY ARRAY[format('SELECT count(*)FROM public.social_list_posts(%L)',ws),format('SELECT public.social_stats(%L)',ws),format('SELECT count(*)FROM public.social_channels_list(%L)',ws),format('SELECT public.social_post_targets_list(%L)',ws)]LOOP denied:=false;BEGIN EXECUTE call;EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='suite_session_unavailable';END;PERFORM pg_temp.qa_social_read_assert(denied,'missing_session_refused_'||split_part(call,'public.',2));END LOOP;
 EXECUTE format('SET LOCAL ROLE %I',executor);PERFORM set_config('request.jwt.claims','{}',true);PERFORM set_config('request.jwt.claim.sub','',true);EXECUTE 'SET LOCAL ROLE anon';
 FOREACH call IN ARRAY ARRAY[format('SELECT count(*)FROM public.social_list_posts(%L)',ws),format('SELECT public.social_stats(%L)',ws),format('SELECT count(*)FROM public.social_channels_list(%L)',ws),format('SELECT public.social_post_targets_list(%L)',ws)]LOOP denied:=false;BEGIN EXECUTE call;EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;PERFORM pg_temp.qa_social_read_assert(denied,'anonymous_execution_refused_'||split_part(call,'public.',2));END LOOP;
 EXECUTE format('SET LOCAL ROLE %I',executor);
END $qa$;
SELECT count(*)AS passed_assertions,bool_and(passed)AS all_passed FROM qa_social_read_results;
ROLLBACK;
SELECT jsonb_build_object('rollback_completed',true,'workspace_absent',NOT EXISTS(SELECT 1 FROM zoi.workspaces WHERE id='d3eb6d31-5454-4c5c-b52b-cd2610140001'),'post_absent',NOT EXISTS(SELECT 1 FROM zoi.social_posts WHERE id='d3eb6d31-5454-4c5c-b52b-cd2610140002'),'session_absent',NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id='d3eb6d31-5454-4c5c-b52b-cd2610140003'),'target_absent',NOT EXISTS(SELECT 1 FROM zoi.social_post_targets WHERE id='d3eb6d31-5454-4c5c-b52b-cd2610140004'),'channel_absent',NOT EXISTS(SELECT 1 FROM zoi.social_channels WHERE handle='qa-reader-rollback-20261014'),'provider_operations',false)AS production_reader_contract_evidence;
