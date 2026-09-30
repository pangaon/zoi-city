-- Clone the installed queue against a temporary table: never lease actual listings.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='15s';
CREATE TEMP TABLE qa_gap_listings AS SELECT * FROM zoi.listings WITH NO DATA;
DO $$
DECLARE body text;rows jsonb;
BEGIN
 body:=pg_get_functiondef('zoi.enrich_queue_lease(integer,integer,integer)'::regprocedure);
 body:=replace(body,'FUNCTION zoi.enrich_queue_lease(','FUNCTION pg_temp.qa_gap_queue(');
 body:=replace(body,'zoi.listings','pg_temp.qa_gap_listings');
 body:=replace(body,'zoi.listing_quality_fingerprint(l)','zoi.listing_quality_fingerprint(jsonb_populate_record(NULL::zoi.listings,to_jsonb(l)))');
 EXECUTE body;
 INSERT INTO pg_temp.qa_gap_listings(id,slug,name,entity_type,website,verification_status,publish_status,moderation_status,profile)
 SELECT gen_random_uuid(),'gap-rollback-'||i,'QA only','business','https://example.org/'||i,'unverified','published','clean',jsonb_build_object('_enrich',CASE WHEN i=4 THEN jsonb_build_object('checked_at','2020-01-01','crawl_status','error','last_attempt_at','2020-01-01') ELSE jsonb_build_object('checked_at',now()) END) FROM generate_series(1,4)i;
 SELECT jsonb_agg(t) INTO rows FROM pg_temp.qa_gap_queue(40)t;
 IF jsonb_array_length(rows)<>3 OR (SELECT count(*) FROM jsonb_array_elements(rows) x WHERE x->'existing_enrich'->>'crawl_status'='error')<>1 THEN RAISE EXCEPTION 'qa_gap_quota_failed';END IF;
 IF (SELECT count(*) FROM pg_temp.qa_gap_queue(40))<>1 THEN RAISE EXCEPTION 'qa_gap_progress_failed';END IF;
 IF has_function_privilege('anon','public.enrich_queue_lease(integer,integer,integer)','execute') OR has_function_privilege('authenticated','public.enrich_queue_lease(integer,integer,integer)','execute') THEN RAISE EXCEPTION 'qa_queue_public_grant';END IF;
END $$;
ROLLBACK;
SELECT jsonb_build_object('ok',true,'temporary_fixture_only',true,'actual_listing_leases',0) AS qa_enrichment_gap_result;
