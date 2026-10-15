-- ROOT ONLY: actual canonical claim, rolled back before returning metrics.
-- No crawl/provider/worker invocation. No listing IDs, URLs or lease IDs output.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='30s';
CREATE TEMP TABLE qa_enrichment_claim_metrics(claimed integer,elapsed_ms numeric,valid_current_leases integer,lease_metadata_unchanged boolean)ON COMMIT DROP;
DO $proof$
DECLARE before_hash text;after_hash text;started timestamptz;elapsed numeric;claimed integer;valid integer;chosen uuid[];
BEGIN
 SELECT md5(string_agg(id::text||md5(coalesce(profile->'_enrich','{}')::text),''ORDER BY id)) INTO before_hash FROM zoi.listings;
 -- PL/pgSQL exception subtransaction restores all canonical claim writes while
 -- retaining local numeric measurements. No authority helper is replaced.
 BEGIN
  started:=clock_timestamp();
  SELECT array_agg(q.listing_id),count(*)INTO chosen,claimed FROM public.enrich_queue_lease(3,30,15)q;
  SELECT count(*)INTO valid FROM zoi.listings l WHERE l.id=ANY(chosen) AND l.profile#>>'{_enrich,lease,task}'='enrichment' AND l.profile#>>'{_enrich,lease,source_website}'=l.website AND l.profile#>>'{_enrich,lease,fingerprint}'=zoi.listing_quality_fingerprint(l) AND zoi.enrich_timestamp(l.profile#>>'{_enrich,lease,expires_at}')>clock_timestamp();
  elapsed:=extract(epoch FROM(clock_timestamp()-started))*1000;
  IF claimed>3 OR valid<>claimed THEN RAISE EXCEPTION 'enrichment_claim_receipt_invalid';END IF;
  RAISE EXCEPTION USING ERRCODE='PZ001',MESSAGE='rollback_only_claim_complete';
 EXCEPTION WHEN SQLSTATE'PZ001' THEN NULL;
 END;
 SELECT md5(string_agg(id::text||md5(coalesce(profile->'_enrich','{}')::text),''ORDER BY id)) INTO after_hash FROM zoi.listings;
 IF before_hash IS DISTINCT FROM after_hash THEN RAISE EXCEPTION 'enrichment_claim_rollback_mismatch';END IF;
 INSERT INTO qa_enrichment_claim_metrics VALUES(claimed,round(elapsed,2),valid,true);
END $proof$;
SELECT claimed,elapsed_ms,valid_current_leases,lease_metadata_unchanged FROM qa_enrichment_claim_metrics;
ROLLBACK;
