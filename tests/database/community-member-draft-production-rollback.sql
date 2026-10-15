-- ROOT OPERATOR ONLY after schema review. One transaction; no committed public
-- content, Storage/network/provider calls, auth-user creation or helper overrides.
BEGIN;
SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='45s';SET LOCAL idle_in_transaction_session_timeout='60s';
CREATE TEMP TABLE qa_member_draft_results(label text PRIMARY KEY,passed boolean)ON COMMIT DROP;
GRANT INSERT,SELECT ON qa_member_draft_results TO authenticated;
CREATE FUNCTION pg_temp.member_assert(ok boolean,label text)RETURNS void LANGUAGE plpgsql AS $$BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'member_draft_proof_failed:%',label;END IF;INSERT INTO pg_temp.qa_member_draft_results VALUES(label,true);END$$;
DO $proof$
DECLARE executor name:=current_user;account constant uuid:='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';actor constant uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';sid uuid;
 expired constant uuid:='c15d0000-0000-4000-8000-202610150001';r1 constant uuid:='c15d0000-0000-4000-8000-202610150011';r2 constant uuid:='c15d0000-0000-4000-8000-202610150012';r3 constant uuid:='c15d0000-0000-4000-8000-202610150013';r4 constant uuid:='c15d0000-0000-4000-8000-202610150014';r5 constant uuid:='c15d0000-0000-4000-8000-202610150015';r6 constant uuid:='c15d0000-0000-4000-8000-202610150016';
 payload jsonb:='{"body":"Rollback-only member draft proof 20261015","media":[],"listing":null,"context":{"intent":"moment","topics":["culture"],"city":null,"country":null,"media_alts":{}}}';d jsonb;v jsonb;prior jsonb;post uuid;denied boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.user_profiles p JOIN auth.users u ON u.id=p.auth_user_id WHERE p.id=actor AND p.auth_user_id=account AND u.deleted_at IS NULL AND NOT coalesce(u.is_anonymous,false)AND(u.banned_until IS NULL OR u.banned_until<=clock_timestamp()))THEN RAISE EXCEPTION 'dedicated_qa_member_unavailable';END IF;
 SELECT id INTO sid FROM auth.sessions WHERE user_id=account AND(not_after IS NULL OR not_after>clock_timestamp())ORDER BY created_at DESC NULLS LAST LIMIT 1;
 IF sid IS NULL THEN RAISE EXCEPTION 'dedicated_qa_current_session_unavailable';END IF;
 IF EXISTS(SELECT 1 FROM zoi.community_member_drafts WHERE profile_id=actor AND account_id=account AND state='draft')OR EXISTS(SELECT 1 FROM zoi.community_member_requests WHERE request_id IN(r1,r2,r3,r4,r5,r6))OR EXISTS(SELECT 1 FROM auth.sessions WHERE id=expired)THEN RAISE EXCEPTION 'qa_member_draft_fixture_collision';END IF;
 INSERT INTO auth.sessions(id,user_id,created_at,updated_at,not_after)VALUES(expired,account,clock_timestamp(),clock_timestamp(),clock_timestamp()-interval'1 minute');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated','session_id',sid)::text,true);PERFORM set_config('request.jwt.claim.sub',account::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 v:=public.community_draft_get();PERFORM pg_temp.member_assert(v->>'schema_version'='1'AND v->'draft'='null'::jsonb,'actual_schema1_private_draft_capability');
 prior:=public.community_draft_mutate(r1,'save',NULL,0,payload);d:=prior->'draft';PERFORM pg_temp.member_assert(d->>'version'='1'AND d#>>'{payload,body}'=payload->>'body','actual_ordinary_current_member_private_save');
 v:=public.community_draft_mutate(r1,'save',NULL,0,payload);PERFORM pg_temp.member_assert(v=prior,'identical_nonce_replay_immutable_receipt');
 denied:=false;BEGIN PERFORM public.community_draft_mutate(r1,'save',NULL,0,jsonb_set(payload,'{body}','"Changed"'));EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='community_request_conflict';END;PERFORM pg_temp.member_assert(denied,'changed_nonce_payload_refused');
 v:=public.community_draft_mutate(r2,'save',(d->>'id')::uuid,1,jsonb_set(payload,'{body}','"Edited rollback-only member draft proof 20261015"'));d:=v->'draft';PERFORM pg_temp.member_assert(d->>'version'='2','canonical_private_edit_cas');
 denied:=false;BEGIN PERFORM public.community_draft_mutate(r3,'save',(d->>'id')::uuid,1,payload);EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='community_draft_version_conflict';END;PERFORM pg_temp.member_assert(denied,'stale_version_refused');
 v:=public.community_draft_history((d->>'id')::uuid);PERFORM pg_temp.member_assert(jsonb_array_length(v->'versions')=2,'private_immutable_history_reopens');
 -- Uncommitted canonical feed insert is visible only inside this operator transaction.
 v:=public.community_draft_mutate(r4,'publish',(d->>'id')::uuid,2,NULL);post:=(v#>>'{draft,post_id}')::uuid;PERFORM pg_temp.member_assert(v#>>'{draft,state}'='published'AND post IS NOT NULL,'explicit_current_version_canonical_publication_uncommitted');
 PERFORM pg_temp.member_assert(public.community_draft_mutate(r4,'publish',(d->>'id')::uuid,2,NULL)=v,'publication_lost_reply_exact_recovery_no_second_post');
 v:=public.community_post_get(post);PERFORM pg_temp.member_assert(v#>>'{post,id}'=post::text,'canonical_feed_readback_inside_rollback');
 prior:=public.community_delete_post(r5,post);PERFORM pg_temp.member_assert(prior->>'state'='deleted'AND public.community_delete_post(r5,post)=prior,'own_delete_lost_reply_recovery');
 v:=public.community_post_get(post);PERFORM pg_temp.member_assert(v->'post'='null'::jsonb,'deleted_feed_readback_absent');
 v:=public.community_draft_request(r6,true);PERFORM pg_temp.member_assert(v->>'state'='cancelled','missing_nonce_cancellation');
 denied:=false;BEGIN PERFORM public.community_draft_mutate(r6,'save',NULL,0,payload);EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='community_request_conflict';END;PERFORM pg_temp.member_assert(denied,'cancelled_nonce_cannot_arrive_late');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated','session_id',expired)::text,true);
 denied:=false;BEGIN PERFORM public.community_draft_get((d->>'id')::uuid);EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='suite_session_unavailable';END;PERFORM pg_temp.member_assert(denied,'expired_session_private_read_refused');
 denied:=false;BEGIN PERFORM public.community_draft_request(r1);EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='suite_session_unavailable';END;PERFORM pg_temp.member_assert(denied,'expired_session_prior_receipt_refused');
 denied:=false;BEGIN PERFORM public.community_publish(r3,'Refused expired publication','{}',NULL,'{}');EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='suite_session_unavailable';END;PERFORM pg_temp.member_assert(denied,'legacy_publish_current_session_guard');
 denied:=false;BEGIN PERFORM public.feed_delete(post);EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='suite_session_unavailable';END;PERFORM pg_temp.member_assert(denied,'legacy_delete_current_session_guard');
 EXECUTE format('SET LOCAL ROLE %I',executor);
 PERFORM pg_temp.member_assert(NOT has_function_privilege('anon','public.community_draft_get(uuid)','EXECUTE')AND NOT has_table_privilege('authenticated','zoi.community_member_drafts','SELECT'),'private_schema_and_rpc_acl');
END $proof$;
SELECT count(*)AS assertions,bool_and(passed)AS all_passed,false AS actual_storage_bytes_checked,false AS provider_calls FROM qa_member_draft_results;
ROLLBACK;
SELECT NOT EXISTS(SELECT 1 FROM zoi.community_member_requests WHERE request_id BETWEEN'c15d0000-0000-4000-8000-202610150011'::uuid AND'c15d0000-0000-4000-8000-202610150016'::uuid)AS request_absent,
 NOT EXISTS(SELECT 1 FROM zoi.community_member_drafts WHERE payload->>'body'LIKE'%rollback-only member draft proof 20261015%'OR payload->>'body'='Rollback-only member draft proof 20261015')AS draft_absent,
 NOT EXISTS(SELECT 1 FROM zoi.community_member_draft_versions WHERE payload->>'body'LIKE'%rollback-only member draft proof 20261015%'OR payload->>'body'='Rollback-only member draft proof 20261015')AS history_absent,
 NOT EXISTS(SELECT 1 FROM zoi.feed_posts WHERE body LIKE'%rollback-only member draft proof 20261015%')AS post_absent,
 NOT EXISTS(SELECT 1 FROM zoi.community_publish_requests WHERE request_id='c15d0000-0000-4000-8000-202610150014')AS publication_receipt_absent,
 NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id='c15d0000-0000-4000-8000-202610150001')AS session_absent;
