-- ROOT REVIEW / EXECUTION ONLY. Synthetic ephemeral listings and ledger receipt.
-- Tests deployed generation/receipt-consumption semantics, NOT official-source
-- review/application authority, HTTP capture, owner-session authorization or UI.
-- Every fixture and job/receipt is rolled back; no existing customer is mutated.
BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='5s';
CREATE TEMP TABLE geography_continuous_fixture_result(check_name text,passed boolean) ON COMMIT DROP;
DO $fixture$
DECLARE fixture_id uuid:=gen_random_uuid();publisher_id uuid:=gen_random_uuid();fixture_slug text:='qa-geography-generation-'||fixture_id::text;fixture_owner uuid:=gen_random_uuid();receipt_id uuid:=gen_random_uuid();old_job uuid;old_hash text;job_count integer;generation bigint;new_hash text;l zoi.listings;
BEGIN
 IF md5(pg_get_functiondef('public.geography_repair_lease(integer,text)'::regprocedure)) IS DISTINCT FROM '7dee3566b96b2466515aba4097227661' OR md5(pg_get_functiondef('public.geography_publisher_enqueue(integer,uuid)'::regprocedure)) IS DISTINCT FROM 'd77c92651cc4643d79fddca2f967dca2' THEN RAISE EXCEPTION 'continuous_production_definition_changed';END IF;
 IF EXISTS(SELECT 1 FROM zoi.listings existing WHERE existing.id IN(fixture_id,publisher_id)OR existing.slug=fixture_slug)THEN RAISE EXCEPTION 'continuous_fixture_identity_collision';END IF;
 INSERT INTO zoi.listings(id,entity_type,name,slug,address,city,country,website,publish_status,created_by)VALUES(fixture_id,'business','QA transaction-only generation fixture',fixture_slug,'18 Synthetic Fixture Street','London','United Kingdom','https://fixture.example.org/','draft','qa_rollback_only');
 SET CONSTRAINTS ALL IMMEDIATE;
 IF EXISTS(SELECT 1 FROM zoi.geography_repair_jobs WHERE listing_id=fixture_id)THEN RAISE EXCEPTION 'draft_fixture_enqueued';END IF;
 SET CONSTRAINTS ALL DEFERRED;
 UPDATE zoi.listings SET publish_status='published'WHERE id=fixture_id;
 SET CONSTRAINTS ALL IMMEDIATE;
 SELECT id,source_generation INTO STRICT old_job,generation FROM zoi.geography_repair_jobs WHERE listing_id=fixture_id AND strategy='official_sources_v1';
 IF generation<>1 THEN RAISE EXCEPTION 'first_generation_missing';END IF;
 INSERT INTO geography_continuous_fixture_result VALUES('draft_to_eligible_insertion',true);
 UPDATE zoi.geography_repair_jobs SET status='unresolved',reason='synthetic_prior_runtime_failure',captured_at=clock_timestamp()WHERE id=old_job;
 SELECT md5(to_jsonb(j)::text)INTO old_hash FROM zoi.geography_repair_jobs j WHERE j.id=old_job;
 UPDATE zoi.listings SET address='22 Synthetic Changed Street'WHERE id=fixture_id;
 IF zoi.geography_source_generation(fixture_id)<>2 THEN RAISE EXCEPTION 'changed_input_generation_missing';END IF;
 UPDATE zoi.listings SET address='18 Synthetic Fixture Street'WHERE id=fixture_id;
 IF zoi.geography_source_generation(fixture_id)<>3 THEN RAISE EXCEPTION 'reverted_input_generation_missing';END IF;
 SELECT md5(to_jsonb(j)::text)INTO new_hash FROM zoi.geography_repair_jobs j WHERE j.id=old_job;
 IF old_hash IS DISTINCT FROM new_hash OR EXISTS(SELECT 1 FROM zoi.geography_repair_jobs j JOIN zoi.listings current_listing ON current_listing.id=j.listing_id WHERE j.id=old_job AND zoi.geography_source_job_current(j,current_listing))THEN RAISE EXCEPTION 'historical_terminal_result_reused_or_mutated';END IF;
 INSERT INTO geography_continuous_fixture_result VALUES('changed_and_reverted_input_preserves_history',true);
 SELECT count(*)INTO job_count FROM zoi.geography_repair_jobs WHERE listing_id=fixture_id;
 UPDATE zoi.listings SET description='Synthetic unrelated biography'WHERE id=fixture_id;
 IF(SELECT count(*)FROM zoi.geography_repair_jobs WHERE listing_id=fixture_id)<>job_count THEN RAISE EXCEPTION 'unrelated_edit_retried_source';END IF;
 UPDATE zoi.listings SET profile=jsonb_set(coalesce(profile,'{}'),'{_enrich}',jsonb_build_object('scope_review_required',true))WHERE id=fixture_id;
 IF NOT EXISTS(SELECT 1 FROM zoi.geography_repair_jobs WHERE listing_id=fixture_id AND source_generation=zoi.geography_source_generation(fixture_id)AND status='source_blocked'AND captured_at IS NULL AND attempts=0)THEN RAISE EXCEPTION 'source_hold_not_preserved';END IF;
 UPDATE zoi.listings SET profile=profile-'_enrich'WHERE id=fixture_id;
 SELECT count(*)INTO job_count FROM zoi.geography_repair_jobs WHERE listing_id=fixture_id;
 UPDATE zoi.listings SET owner_user_id=fixture_owner WHERE id=fixture_id;
 UPDATE zoi.listings SET address='Owner transaction-only fixture value'WHERE id=fixture_id;
 IF(SELECT count(*)FROM zoi.geography_repair_jobs WHERE listing_id=fixture_id)<>job_count THEN RAISE EXCEPTION 'owner_edit_source_capture_enqueued';END IF;
 UPDATE zoi.listings SET owner_user_id=NULL WHERE id=fixture_id;
 INSERT INTO geography_continuous_fixture_result VALUES('quarantine_and_owner_fences',true);
 SELECT count(*)INTO job_count FROM zoi.geography_repair_jobs WHERE listing_id=fixture_id;
 SET CONSTRAINTS ALL DEFERRED;
 UPDATE zoi.listings SET latitude=51.5,longitude=-0.1,geo_precision='street',profile=jsonb_set(coalesce(profile,'{}'),'{_geo}',jsonb_build_object('precision','street','request_id',receipt_id))WHERE id=fixture_id;
 SELECT *INTO STRICT l FROM zoi.listings WHERE id=fixture_id;
 -- This private synthetic receipt is deliberately inserted directly to isolate
 -- the trigger's post-ledger decision; it makes no source-verification claim.
 INSERT INTO zoi.geography_reviews(request_id,listing_id,payload,receipt,before_geo,after_fingerprint)VALUES(receipt_id,fixture_id,jsonb_build_object('kind','qa_transaction_fixture','synthetic',true),jsonb_build_object('listing_id',fixture_id,'request_id',receipt_id,'latitude',l.latitude,'longitude',l.longitude,'precision','street'),'{}',zoi.geography_fingerprint(l));
 SET CONSTRAINTS ALL IMMEDIATE;
 IF public.geography_reviewed_point(fixture_id)IS NULL OR(SELECT count(*)FROM zoi.geography_repair_jobs WHERE listing_id=fixture_id)<>job_count THEN RAISE EXCEPTION 'post_ledger_accepted_point_requeued';END IF;
 IF zoi.geography_source_enqueue_one(l,'official_sources_v1',zoi.geography_source_generation(fixture_id))<>0 THEN RAISE EXCEPTION 'accepted_point_manual_enqueue_repeated';END IF;
 INSERT INTO geography_continuous_fixture_result VALUES('deferred_post_ledger_receipt_skips_requeue',true);
 UPDATE zoi.listings SET latitude=51.6 WHERE id=fixture_id;
 IF public.geography_reviewed_point(fixture_id)IS NOT NULL OR(SELECT count(*)FROM zoi.geography_repair_jobs WHERE listing_id=fixture_id)<>job_count+1 THEN RAISE EXCEPTION 'stale_receipt_failed_to_research_changed_point';END IF;
 INSERT INTO geography_continuous_fixture_result VALUES('stale_receipt_creates_fresh_generation',true);
 INSERT INTO zoi.listings(id,entity_type,name,slug,address,city,country,source_url,publish_status,created_by)VALUES(publisher_id,'business','QA transaction-only supporting source fixture','qa-geography-publisher-'||publisher_id::text,'18 Synthetic Fixture Street','London','United Kingdom','https://www.lgr.co.uk/directory/','draft','qa_rollback_only');
 IF NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id=publisher_id AND publish_status='draft')OR EXISTS(SELECT 1 FROM zoi.geography_repair_jobs WHERE listing_id=publisher_id)THEN RAISE EXCEPTION 'supporting_draft_fixture_enqueued';END IF;
 UPDATE zoi.listings SET publish_status='published'WHERE id=publisher_id;
 IF(SELECT count(*)FROM zoi.geography_repair_jobs WHERE listing_id=publisher_id)<>2 OR NOT EXISTS(SELECT 1 FROM zoi.geography_repair_jobs WHERE listing_id=publisher_id AND strategy='publisher_profiles_v1'AND status='queued'AND original->>'source_kind'='supporting_publisher_profile'AND proposed IS NULL AND application_result IS NULL AND attempts=0)THEN RAISE EXCEPTION 'supporting_source_lane_missing_or_misclassified';END IF;
 UPDATE zoi.listings SET duplicate_status='confirmed_duplicate'WHERE id=publisher_id;
 IF EXISTS(SELECT 1 FROM zoi.geography_repair_jobs j JOIN zoi.listings current_listing ON current_listing.id=j.listing_id WHERE j.listing_id=publisher_id AND zoi.geography_source_job_current(j,current_listing))THEN RAISE EXCEPTION 'confirmed_duplicate_source_job_remains_current';END IF;
 INSERT INTO geography_continuous_fixture_result VALUES('supporting_publisher_and_real_duplicate_scope',true);
END $fixture$;
SELECT jsonb_build_object('passed',(SELECT count(*)FROM geography_continuous_fixture_result WHERE passed),'checks',(SELECT jsonb_agg(check_name ORDER BY check_name)FROM geography_continuous_fixture_result),'synthetic_receipt_consumption_only',true,'official_source_writer_proof',false,'provider_calls',0,'existing_customer_writes',0,'rollback_only',true)AS generation_rollback_proof;
ROLLBACK;
