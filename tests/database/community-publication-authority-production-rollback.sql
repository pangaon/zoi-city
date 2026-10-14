-- Reviewed production SQL contract fixture only. No provider calls or public posts.
-- Existing dedicated QA owner and actual active session; all new rows rolled back.
-- Never replace authority helpers, disable triggers or print auth credentials.
BEGIN;
SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='45s';SET LOCAL idle_in_transaction_session_timeout='60s';
CREATE TEMP TABLE qa_publisher_results(label text PRIMARY KEY,passed boolean) ON COMMIT DROP;
GRANT INSERT,SELECT ON qa_publisher_results TO authenticated,service_role;
CREATE FUNCTION pg_temp.qa_publisher_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'qa_publisher_assertion_failed:%',label;END IF;INSERT INTO pg_temp.qa_publisher_results VALUES(label,true);END$$;
DO $qa$
DECLARE executor name:=current_user;
 ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor constant uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';account constant uuid:='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
 listing constant uuid:='c1eb6d31-5454-4c5c-b52b-cd2610140001';foreign_listing constant uuid:='c1eb6d31-5454-4c5c-b52b-cd2610140002';other_ws constant uuid:='c1eb6d31-5454-4c5c-b52b-cd2610140003';channel_id constant bigint:=-9126101400001;ephemeral_session constant uuid:='c1eb6d31-5454-4c5c-b52b-cd2610140004';fixture_source constant text:='qa-publisher-aged-rollback-20261014';source_record jsonb;due jsonb;snapshot jsonb;original_meta jsonb;sid uuid;category bigint;receipt jsonb;replay jsonb;post zoi.social_posts;denied boolean;
BEGIN
 IF EXISTS(SELECT 1 FROM zoi.listings WHERE id IN(listing,foreign_listing))OR EXISTS(SELECT 1 FROM zoi.workspaces WHERE id=other_ws)OR EXISTS(SELECT 1 FROM zoi.social_channels WHERE id=channel_id)OR EXISTS(SELECT 1 FROM auth.sessions WHERE id=ephemeral_session)OR EXISTS(SELECT 1 FROM zoi.editorial_sources WHERE id=fixture_source)OR EXISTS(SELECT 1 FROM zoi.social_posts WHERE meta->>'qa_publisher_fixture'='20261014')THEN RAISE EXCEPTION 'qa_publisher_fixture_collision';END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.workspaces w JOIN zoi.workspace_members m ON m.workspace_id=w.id JOIN zoi.user_profiles p ON p.id=m.profile_id JOIN auth.users u ON u.id=p.auth_user_id WHERE w.id=ws AND w.name='Zoi isolated QA 2026-09-30' AND w.owner_profile_id=actor AND m.profile_id=actor AND m.role='owner' AND p.auth_user_id=account AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND NOT coalesce(u.is_anonymous,false)AND(u.banned_until IS NULL OR u.banned_until<=clock_timestamp()))THEN RAISE EXCEPTION 'dedicated_qa_authority_unavailable';END IF;
 SELECT s.id INTO sid FROM auth.sessions s WHERE s.user_id=account AND(s.not_after IS NULL OR s.not_after>clock_timestamp())ORDER BY s.created_at DESC NULLS LAST LIMIT 1;IF sid IS NULL THEN RAISE EXCEPTION 'dedicated_qa_current_session_unavailable';END IF;
 SELECT id INTO category FROM zoi.categories WHERE slug='restaurants'LIMIT 1;IF category IS NULL THEN RAISE EXCEPTION 'qa_category_unavailable';END IF;
 INSERT INTO zoi.workspaces(id,name,kind,owner_profile_id,created_by_auth)VALUES(other_ws,'Rollback-only publisher client workspace','business',actor,account);
 INSERT INTO zoi.listings(id,owner_workspace_id,entity_type,name,slug,primary_category_id,publish_status,moderation_status,marketplace_status,profile)VALUES(listing,ws,'business','Rollback-only publisher client','qa-publisher-owned-rollback-20261014',category,'draft','clean','hidden','{}'),(foreign_listing,other_ws,'business','Rollback-only foreign publisher client','qa-publisher-foreign-rollback-20261014',category,'draft','clean','hidden','{}');

 IF to_regprocedure('public.social_delivery_snapshot(uuid,text,bigint)')IS NULL OR has_function_privilege('service_role','public.social_due_posts()','EXECUTE')THEN RAISE EXCEPTION 'reviewed_publisher_schema_not_ready';END IF;
 INSERT INTO zoi.social_channels(id,workspace_id,platform,connected,status,access_token,external_id,token_expires_at,meta)VALUES(channel_id,ws,'facebook',true,'connected','rollback-fixture-not-a-provider-credential','qa-no-provider-destination',clock_timestamp()+interval'1 hour','{"qa_fixture":true}');
 INSERT INTO auth.sessions(id,user_id,created_at,updated_at,not_after)VALUES(ephemeral_session,account,clock_timestamp(),clock_timestamp(),clock_timestamp()-interval'1 minute');
 original_meta:=jsonb_build_object('qa_publisher_fixture','20261014','client_listing_id',listing,'campaign','Rollback-only publisher');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated','session_id',sid)::text,true);PERFORM set_config('request.jwt.claim.sub',account::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);EXECUTE 'SET LOCAL ROLE authenticated';
 post:=public.social_save_post(ws,'Rollback-only publisher no-send20261014',ARRAY[channel_id::text],clock_timestamp()-interval'1 minute','scheduled','[]',NULL,original_meta,NULL);
 PERFORM pg_temp.qa_publisher_assert(post.id IS NOT NULL AND post.author_profile=actor AND post.status='scheduled'AND post.published_at IS NULL,'actual_authorized_canonical_schedule_no_publication');
 EXECUTE format('SET LOCAL ROLE %I',executor);PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);PERFORM set_config('request.jwt.claim.sub','',true);PERFORM set_config('request.jwt.claim.role','service_role',true);EXECUTE 'SET LOCAL ROLE service_role';
 snapshot:=public.social_delivery_snapshot(post.id);
 PERFORM pg_temp.qa_publisher_assert(snapshot->>'ok'='true'AND snapshot#>>'{post,id}'=post.id::text AND snapshot#>>'{post,meta,client_listing_id}'=listing::text,'positive_actual_current_authority_snapshot_only');
 replay:=public.social_delivery_snapshot(post.id,snapshot->>'payload_hash',channel_id);
 PERFORM pg_temp.qa_publisher_assert(replay#>>'{channel,id}'=channel_id::text AND replay#>>'{channel,external_id}'='qa-no-provider-destination','positive_current_selected_channel_receipt_only');
 EXECUTE format('SET LOCAL ROLE %I',executor);UPDATE zoi.social_channels SET connected=false WHERE id=channel_id;EXECUTE 'SET LOCAL ROLE service_role';
 denied:=false;BEGIN PERFORM public.social_delivery_snapshot(post.id,snapshot->>'payload_hash',channel_id);EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='social_channel_not_publishable';END;PERFORM pg_temp.qa_publisher_assert(denied,'disconnected_channel_receipt_refused');
 EXECUTE format('SET LOCAL ROLE %I',executor);UPDATE zoi.social_channels SET connected=true,token_expires_at=clock_timestamp()-interval'1 minute'WHERE id=channel_id;EXECUTE 'SET LOCAL ROLE service_role';
 denied:=false;BEGIN PERFORM public.social_delivery_snapshot(post.id,snapshot->>'payload_hash',channel_id);EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='social_channel_not_publishable';END;PERFORM pg_temp.qa_publisher_assert(denied,'expired_channel_receipt_refused');
 EXECUTE format('SET LOCAL ROLE %I',executor);UPDATE zoi.social_channels SET token_expires_at=clock_timestamp()+interval'1 hour',workspace_id=other_ws WHERE id=channel_id;EXECUTE 'SET LOCAL ROLE service_role';
 denied:=false;BEGIN PERFORM public.social_delivery_snapshot(post.id,snapshot->>'payload_hash',channel_id);EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='social_channel_not_publishable';END;PERFORM pg_temp.qa_publisher_assert(denied,'foreign_workspace_channel_receipt_refused');
 EXECUTE format('SET LOCAL ROLE %I',executor);UPDATE zoi.social_channels SET workspace_id=ws WHERE id=channel_id;UPDATE zoi.workspace_members SET role='viewer'WHERE workspace_id=ws AND profile_id=actor;EXECUTE 'SET LOCAL ROLE service_role';
 denied:=false;BEGIN PERFORM public.social_delivery_snapshot(post.id);EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;PERFORM pg_temp.qa_publisher_assert(denied,'viewer_snapshot_refused');
 -- This is ONLY a known-negative atomic publisher call. No positive publisher
 -- call, provider request, worker endpoint or public feed insertion is exercised.
 denied:=false;BEGIN PERFORM public.feed_publish_scheduled_post(post.id);EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;PERFORM pg_temp.qa_publisher_assert(denied,'viewer_atomic_publisher_refused_no_side_effect');
 EXECUTE format('SET LOCAL ROLE %I',executor);UPDATE zoi.workspace_members SET role='owner'WHERE workspace_id=ws AND profile_id=actor;UPDATE zoi.listings SET owner_workspace_id=other_ws WHERE id=listing;EXECUTE 'SET LOCAL ROLE service_role';
 denied:=false;BEGIN PERFORM public.social_delivery_snapshot(post.id);EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;PERFORM pg_temp.qa_publisher_assert(denied,'revoked_client_snapshot_refused');
 EXECUTE format('SET LOCAL ROLE %I',executor);UPDATE zoi.listings SET owner_workspace_id=ws WHERE id=listing;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated','session_id',ephemeral_session)::text,true);PERFORM set_config('request.jwt.claim.sub',account::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 denied:=false;BEGIN PERFORM public.feed_publish_social_post(post.id);EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='suite_session_unavailable';END;PERFORM pg_temp.qa_publisher_assert(denied,'expired_human_session_publisher_refused');
 denied:=false;BEGIN PERFORM public.social_delivery_snapshot(post.id);EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;PERFORM pg_temp.qa_publisher_assert(denied,'authenticated_cannot_read_service_credentials');
 EXECUTE format('SET LOCAL ROLE %I',executor);PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);PERFORM set_config('request.jwt.claim.sub','',true);EXECUTE 'SET LOCAL ROLE service_role';
 PERFORM public.social_target_record(post.id,channel_id,'facebook','unknown',NULL,NULL,'rollback_fixture_unknown_no_provider_request');
 PERFORM public.social_post_finalize(post.id,'failed');
 due:=public.social_due_posts_current();
 PERFORM pg_temp.qa_publisher_assert(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(due)v WHERE v->>'id'=post.id::text),'unknown_provider_outcome_excluded_from_due_reader');
 denied:=false;BEGIN PERFORM public.social_delivery_snapshot(post.id,snapshot->>'payload_hash',channel_id);EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='social_delivery_requires_reconciliation';END;PERFORM pg_temp.qa_publisher_assert(denied,'unknown_provider_outcome_refuses_selected_channel_snapshot');
 EXECUTE format('SET LOCAL ROLE %I',executor);PERFORM pg_temp.qa_publisher_assert(EXISTS(SELECT 1 FROM zoi.social_post_targets t WHERE t.post_id=post.id AND t.status='unknown'AND t.published_at IS NULL AND t.external_post_id IS NULL),'actual_target_writer_accepts_unknown_without_success_receipt');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated','session_id',sid)::text,true);PERFORM set_config('request.jwt.claim.sub',account::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 post:=public.social_save_post(ws,post.body,post.channels,clock_timestamp()-interval'1 minute','scheduled','[]',NULL,original_meta,post.id);
 EXECUTE format('SET LOCAL ROLE %I',executor);PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);PERFORM set_config('request.jwt.claim.sub','',true);EXECUTE 'SET LOCAL ROLE service_role';
 due:=public.social_due_posts_current();PERFORM pg_temp.qa_publisher_assert(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(due)v WHERE v->>'id'=post.id::text),'owner_requeue_does_not_erase_unknown_or_blind_retry');
 denied:=false;BEGIN PERFORM public.social_due_posts();EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;PERFORM pg_temp.qa_publisher_assert(denied,'old_worker_due_reader_permanently_refused');
 EXECUTE format('SET LOCAL ROLE %I',executor);
 -- A cloned historical source fixture is aged deliberately. Production source
 -- records are never edited; source freshness is exercised through snapshot only.
 SELECT record INTO source_record FROM zoi.editorial_sources WHERE id='seferis-nobel-lecture'AND active;
 IF source_record IS NULL THEN RAISE EXCEPTION 'reviewed_primary_source_unavailable';END IF;
 source_record:=source_record||jsonb_build_object('id',fixture_source,'revision',1);source_record:=jsonb_set(source_record,'{evidence}',(SELECT jsonb_agg(v||jsonb_build_object('checked_at',(current_date-181)::text))FROM jsonb_array_elements(source_record->'evidence')v));
 INSERT INTO zoi.editorial_sources(id,revision,record,active)VALUES(fixture_source,1,source_record,true);
 -- Unknown attempt history belongs to the first post, so use another canonical
 -- scheduled fixture to test freshness rather than bypassing its reconciliation.
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated','session_id',sid)::text,true);PERFORM set_config('request.jwt.claim.sub',account::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 post:=public.social_save_post(ws,'Rollback-only aged source no-send20261014','{zoi}',make_date(extract(year from current_date)::integer-1,12,11)::timestamptz,'scheduled','[]',NULL,original_meta,NULL);
 EXECUTE format('SET LOCAL ROLE %I',executor);INSERT INTO zoi.editorial_draft_links(workspace_id,source_id,source_revision,occurrence_date,time_zone,jurisdiction,context,context_hash,source_snapshot,post_id)VALUES(ws,fixture_source,1,make_date(extract(year from current_date)::integer-1,12,11),'UTC','cultural',jsonb_build_object('listing',listing,'campaign','Rollback-only publisher'),md5(jsonb_build_object('listing',listing,'campaign','Rollback-only publisher')::text),source_record,post.id);
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);PERFORM set_config('request.jwt.claim.sub','',true);EXECUTE 'SET LOCAL ROLE service_role';
 denied:=false;BEGIN PERFORM public.social_delivery_snapshot(post.id);EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='editorial_source_review_required';END;PERFORM pg_temp.qa_publisher_assert(denied,'unchanged_aged_source_snapshot_refused_before_delivery');
 EXECUTE format('SET LOCAL ROLE %I',executor);
 PERFORM pg_temp.qa_publisher_assert(NOT EXISTS(SELECT 1 FROM zoi.community_post_deliveries d JOIN zoi.social_posts p ON p.id=d.social_post_id WHERE p.meta->>'qa_publisher_fixture'='20261014')AND NOT EXISTS(SELECT 1 FROM zoi.feed_posts WHERE body IN('Rollback-only publisher no-send20261014','Rollback-only aged source no-send20261014')),'no_public_feed_insert_or_delivery_receipt');
END $qa$;
SELECT label,passed FROM qa_publisher_results ORDER BY label;
ROLLBACK;
SELECT jsonb_build_object('rollback_completed',true,'fixture_posts_absent',NOT EXISTS(SELECT 1 FROM zoi.social_posts WHERE meta->>'qa_publisher_fixture'='20261014'),'fixture_targets_absent',NOT EXISTS(SELECT 1 FROM zoi.social_post_targets WHERE error='rollback_fixture_unknown_no_provider_request'),'fixture_channels_absent',NOT EXISTS(SELECT 1 FROM zoi.social_channels WHERE id=-9126101400001),'fixture_source_absent',NOT EXISTS(SELECT 1 FROM zoi.editorial_sources WHERE id='qa-publisher-aged-rollback-20261014'),'fixture_links_absent',NOT EXISTS(SELECT 1 FROM zoi.editorial_draft_links WHERE source_id='qa-publisher-aged-rollback-20261014'),'fixture_session_absent',NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id='c1eb6d31-5454-4c5c-b52b-cd2610140004'),'fixture_listings_absent',NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id IN('c1eb6d31-5454-4c5c-b52b-cd2610140001','c1eb6d31-5454-4c5c-b52b-cd2610140002')),'fixture_workspace_absent',NOT EXISTS(SELECT 1 FROM zoi.workspaces WHERE id='c1eb6d31-5454-4c5c-b52b-cd2610140003'),'provider_or_publication_acceptance',false)AS publisher_no_send_contract_evidence;
