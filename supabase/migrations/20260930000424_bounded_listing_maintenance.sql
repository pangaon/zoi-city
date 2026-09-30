-- Reviewed against live zoi.run_maintenance on 2026-09-30.
-- Replace three unconditional whole-table UPDATEs with one changed-row batch.
BEGIN;
SET LOCAL lock_timeout='2s';
CREATE OR REPLACE FUNCTION zoi.maintenance_event_date(p_value text)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
  IF p_value IS NULL OR p_value !~ '^\d{4}-\d{2}-\d{2}($|T| )' THEN RETURN NULL; END IF;
  RETURN left(p_value,10)::date;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION zoi.maintenance_event_date(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zoi.maintenance_event_date(text) TO service_role;

CREATE OR REPLACE FUNCTION zoi.run_maintenance()
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE changed integer;
BEGIN
  -- A second cron/manual invocation must not compete for the same rows.
  IF NOT pg_try_advisory_xact_lock(hashtextextended('zoi.run_maintenance',0)) THEN RETURN; END IF;
  WITH scores AS MATERIALIZED (
    SELECT id,
      round(((CASE WHEN description IS NOT NULL AND length(description)>10 THEN 1 ELSE 0 END)
       +(CASE WHEN website IS NOT NULL THEN 1 ELSE 0 END)
       +(CASE WHEN address IS NOT NULL THEN 1 ELSE 0 END)
       +(CASE WHEN phone IS NOT NULL THEN 1 ELSE 0 END)
       +(CASE WHEN primary_category_id IS NOT NULL THEN 1 ELSE 0 END))::numeric/5,3) AS completeness,
      least(1.0,round((CASE verification_status WHEN 'admin_verified' THEN 0.9 WHEN 'owner_verified' THEN 0.85
        WHEN 'partner_verified' THEN 0.8 WHEN 'source_verified' THEN 0.6 WHEN 'owner_claimed' THEN 0.5 ELSE 0.3 END
        +CASE source_trust_tier WHEN 'official' THEN 0.1 WHEN 'partner' THEN 0.08 WHEN 'public_directory' THEN 0.05 ELSE 0 END)::numeric,3)) AS trust,
      CASE WHEN entity_type='event' AND zoi.maintenance_event_date(profile->>'end_datetime')<current_date THEN 0.2
        WHEN last_seen_at>now()-interval '14 days' THEN 0.95 ELSE 0.6 END AS freshness,
      CASE WHEN entity_type='event' AND zoi.maintenance_event_date(profile->>'end_datetime')<current_date-14
         AND coalesce(profile->>'recurring','')<>'annual' THEN 'archived' ELSE publish_status END AS next_status
    FROM zoi.listings
  ), due AS (
    SELECT s.* FROM scores s JOIN zoi.listings l USING(id)
    WHERE ROW(l.completeness_score,l.trust_score,l.freshness_score,l.publish_status)
      IS DISTINCT FROM ROW(s.completeness,s.trust,s.freshness,s.next_status)
    ORDER BY s.id LIMIT 1000
  )
  UPDATE zoi.listings l SET completeness_score=d.completeness,trust_score=d.trust,
    freshness_score=d.freshness,publish_status=d.next_status
  FROM due d WHERE l.id=d.id;
  GET DIAGNOSTICS changed=ROW_COUNT;
  INSERT INTO zoi.audit_log(actor,action,target_type,reason)
    VALUES('cron','run_maintenance','listing',format('Bounded score/freshness/archive maintenance: %s changed rows',changed));
END;
$$;

-- Duplicate discovery is deliberately separate from score maintenance. It
-- preserves the existing same-type/place/name rules, with a bounded insert.
CREATE OR REPLACE FUNCTION zoi.run_duplicate_maintenance()
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('zoi.run_duplicate_maintenance',0)) THEN RETURN; END IF;
  INSERT INTO zoi.duplicate_candidates(listing_a_id,listing_b_id,match_signals,match_score,status)
  SELECT a.id,b.id,jsonb_build_object('signal',CASE WHEN a.website IS NOT NULL AND a.website=b.website
       THEN 'same_website_same_name_same_place' ELSE 'same_phone_same_name_same_place' END,
       'name_sim',round(public.similarity(lower(a.name),lower(b.name))::numeric,2)),
       round(public.similarity(lower(a.name),lower(b.name))::numeric,2),'open'
  FROM zoi.listings a JOIN zoi.listings b ON a.id<b.id
    AND ((a.website IS NOT NULL AND a.website=b.website) OR (a.phone IS NOT NULL AND a.phone=b.phone))
  WHERE a.entity_type=b.entity_type AND a.region_id IS NOT NULL AND a.region_id=b.region_id
    AND public.similarity(lower(a.name),lower(b.name))>=0.55
    AND NOT (a.entity_type='event' AND substring(a.name from '\d{4}') IS DISTINCT FROM substring(b.name from '\d{4}'))
    AND NOT EXISTS (SELECT 1 FROM zoi.duplicate_candidates d WHERE d.listing_a_id=a.id AND d.listing_b_id=b.id)
  LIMIT 500;
END;
$$;
REVOKE ALL ON FUNCTION zoi.run_maintenance() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION zoi.run_duplicate_maintenance() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION zoi.run_maintenance(),zoi.run_duplicate_maintenance() TO service_role;

-- Leave scheduling disabled until production execution has been verified.
-- The legacy fullblast enrichment schedule remains retired; hourly enrichment
-- is the existing canonical scheduler and is not changed by this migration.
COMMIT;
