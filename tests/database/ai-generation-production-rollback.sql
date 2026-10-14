-- Reviewed production SQL contract fixture only. No provider calls or public posts.
-- Existing dedicated QA owner and actual active session; all new rows rolled back.
-- Never replace authority helpers, disable triggers or print auth credentials.
BEGIN;
SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='45s';
CREATE TEMP TABLE qa_ai_results(label text PRIMARY KEY,passed boolean) ON COMMIT DROP;
GRANT INSERT,SELECT ON qa_ai_results TO authenticated;
CREATE FUNCTION pg_temp.qa_ai_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'qa_ai_assertion_failed:%',label;END IF;INSERT INTO pg_temp.qa_ai_results VALUES(label,true);END$$;
DO $qa$
DECLARE executor name:=current_user;
 ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor constant uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';account constant uuid:='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
 listing constant uuid:='b1eb6d31-5454-4c5c-b52b-cd2610140001';foreign_listing constant uuid:='b1eb6d31-5454-4c5c-b52b-cd2610140002';other_ws constant uuid:='b1eb6d31-5454-4c5c-b52b-cd2610140003';g constant uuid:='b1eb6d31-5454-4c5c-b52b-cd2610140004';nonce constant uuid:='b1eb6d31-5454-4c5c-b52b-cd2610140005';sid uuid;category bigint;receipt jsonb;replay jsonb;post zoi.social_posts;denied boolean;
BEGIN
 IF EXISTS(SELECT 1 FROM zoi.listings WHERE id IN(listing,foreign_listing))OR EXISTS(SELECT 1 FROM zoi.workspaces WHERE id=other_ws)OR EXISTS(SELECT 1 FROM zoi.ai_generations WHERE id=g)OR EXISTS(SELECT 1 FROM zoi.ai_generation_draft_receipts WHERE request_id=nonce)THEN RAISE EXCEPTION 'qa_ai_fixture_collision';END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.workspaces w JOIN zoi.workspace_members m ON m.workspace_id=w.id JOIN zoi.user_profiles p ON p.id=m.profile_id JOIN auth.users u ON u.id=p.auth_user_id WHERE w.id=ws AND w.name='Zoi isolated QA 2026-09-30' AND w.owner_profile_id=actor AND m.profile_id=actor AND m.role='owner' AND p.auth_user_id=account AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND NOT coalesce(u.is_anonymous,false)AND(u.banned_until IS NULL OR u.banned_until<=clock_timestamp()))THEN RAISE EXCEPTION 'dedicated_qa_authority_unavailable';END IF;
 SELECT s.id INTO sid FROM auth.sessions s WHERE s.user_id=account AND(s.not_after IS NULL OR s.not_after>clock_timestamp())ORDER BY s.created_at DESC NULLS LAST LIMIT 1;IF sid IS NULL THEN RAISE EXCEPTION 'dedicated_qa_current_session_unavailable';END IF;
 SELECT id INTO category FROM zoi.categories WHERE slug='restaurants'LIMIT 1;IF category IS NULL THEN RAISE EXCEPTION 'qa_category_unavailable';END IF;
 INSERT INTO zoi.workspaces(id,name,kind,owner_profile_id,created_by_auth)VALUES(other_ws,'Rollback-only AI client workspace','business',actor,account);
 INSERT INTO zoi.listings(id,owner_workspace_id,entity_type,name,slug,primary_category_id,publish_status,moderation_status,marketplace_status,profile)VALUES(listing,ws,'business','Rollback-only AI client','qa-ai-owned-rollback-20261014',category,'draft','clean','hidden','{}'),(foreign_listing,other_ws,'business','Rollback-only foreign AI client','qa-ai-foreign-rollback-20261014',category,'draft','clean','hidden','{}');
 INSERT INTO zoi.ai_generations(id,workspace_id,profile_id,request_id,input_hash,action,input,requested_count,profile_snapshot,model,pricing_date,input_rate,output_rate,max_output_tokens,reserved_input_tokens,status,result,budget_debit_micro_usd,completed_at)
 VALUES(g,ws,actor,g,repeat('a',64),'week','Explicit rollback-only saved fixture',2,'{"business_name":"Rollback-only client","writing_sample":"Private fixture must stay private"}','rollback-fixture-no-provider',current_date,0,0,1,1,'succeeded','[{"day":"Mon","text":"Saved generation fixture caption"},{"day":"Tue","text":"Other client denied fixture"}]',0,clock_timestamp());
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated','session_id',sid)::text,true);PERFORM set_config('request.jwt.claim.sub',account::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);EXECUTE 'SET LOCAL ROLE authenticated';
 receipt:=public.ai_generation_draft_save(ws,g,0,nonce,jsonb_build_object('listing',listing,'campaign','Rollback-only campaign'));
 PERFORM pg_temp.qa_ai_assert(receipt->>'ok'='true' AND receipt#>>'{post,meta,client_listing_id}'=listing::text AND receipt#>>'{post,meta,ai_generation_id}'=g::text,'real_owned_client_canonical_receipt');
 PERFORM pg_temp.qa_ai_assert(receipt#>'{post,channels}'='[]'::jsonb AND receipt#>>'{post,status}'='draft' AND receipt#>'{post,scheduled_at}'='null'::jsonb AND NOT(receipt#>'{post,meta,ai_profile_snapshot}'?'writing_sample'),'no_audience_schedule_publish_or_private_sample');
 replay:=public.ai_generation_draft_save(ws,g,0,nonce,jsonb_build_object('listing',listing,'campaign','Rollback-only campaign'));PERFORM pg_temp.qa_ai_assert(replay->>'replayed'='true' AND replay#>>'{post,id}'=receipt#>>'{post,id}','exact_receipt_retry_same_canonical_post');
 denied:=false;BEGIN PERFORM public.ai_generation_draft_save(ws,g,1,gen_random_uuid(),jsonb_build_object('listing',foreign_listing));EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;PERFORM pg_temp.qa_ai_assert(denied,'foreign_client_denied_actual_authority');
 post:=public.social_save_post(ws,'Owner revised fixture caption','{}',NULL,'draft','[]',NULL,receipt#>'{post,meta}',(receipt#>>'{post,id}')::uuid);PERFORM pg_temp.qa_ai_assert(post.id=(receipt#>>'{post,id}')::uuid AND post.body='Owner revised fixture caption','canonical_composer_writer_same_id');
 replay:=public.ai_generation_draft_save(ws,g,0,nonce,jsonb_build_object('listing',listing,'campaign','Rollback-only campaign'));PERFORM pg_temp.qa_ai_assert(replay#>>'{post,body}'='Owner revised fixture caption' AND replay#>>'{post_snapshot,body}'='Saved generation fixture caption','latest_owner_post_immutable_original_receipt');
 EXECUTE format('SET LOCAL ROLE %I',executor);
 PERFORM pg_temp.qa_ai_assert((SELECT count(*)FROM zoi.ai_generation_draft_links WHERE generation_id=g)=1,'one_canonical_post_no_foreign_client_write');
 UPDATE zoi.listings SET owner_workspace_id=other_ws WHERE id=listing;EXECUTE 'SET LOCAL ROLE authenticated';denied:=false;BEGIN PERFORM public.ai_generation_draft_save(ws,g,0,nonce,jsonb_build_object('listing',listing,'campaign','Rollback-only campaign'));EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;PERFORM pg_temp.qa_ai_assert(denied,'revoked_listing_blocks_prior_receipt');EXECUTE format('SET LOCAL ROLE %I',executor);
END $qa$;
SELECT label,passed FROM qa_ai_results ORDER BY label;
ROLLBACK;
SELECT jsonb_build_object('rollback_completed',true,'fixture_generation_absent',NOT EXISTS(SELECT 1 FROM zoi.ai_generations WHERE id='b1eb6d31-5454-4c5c-b52b-cd2610140004'),'fixture_listings_absent',NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id IN('b1eb6d31-5454-4c5c-b52b-cd2610140001','b1eb6d31-5454-4c5c-b52b-cd2610140002')),'fixture_workspace_absent',NOT EXISTS(SELECT 1 FROM zoi.workspaces WHERE id='b1eb6d31-5454-4c5c-b52b-cd2610140003'),'http_or_provider_acceptance',false) AS production_ai_contract_evidence;
