BEGIN;
SET LOCAL lock_timeout='5s';
-- Evaluate full quality state only as the ordered read cursor advances. Previously the
-- planner evaluated it for the whole public inventory before sorting LIMIT 10.
CREATE OR REPLACE FUNCTION public.listing_quality_task_lease(p_task text,p_limit integer DEFAULT 40)
RETURNS TABLE(listing_id uuid,slug text,name text,entity_type text,website text,lease_id text,source_fingerprint text,owner_managed boolean,existing_enrich jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l zoi.listings;s jsonb;lease text;fingerprint text;claimed integer:=0;
BEGIN
 IF p_task IS NULL OR p_task NOT IN('classification','design','verification') OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid_quality_task';END IF;
 FOR l IN SELECT x.* FROM zoi.listings x
 WHERE x.publish_status='published' AND x.moderation_status IN('clean','cleared') AND coalesce(x.marketplace_status,'')<>'hidden'
 AND coalesce(nullif(x.website,''),nullif(x.source_url,''),nullif(x.profile#>>'{_enrich,source_url}',''))~*'^https?://'
 AND coalesce(zoi.enrich_timestamp(x.profile#>>'{_enrich,lease,expires_at}'),'-infinity')<now()
 ORDER BY x.id LOOP
  s:=zoi.listing_quality_state(l);fingerprint:=s->>'fingerprint';
  IF s#>>ARRAY['tasks',p_task,'status'] IN('verified','blocked') THEN CONTINUE;END IF;
  IF l.profile#>>'{_coverage,fingerprint}' IS NOT DISTINCT FROM fingerprint AND coalesce(zoi.enrich_timestamp(l.profile#>>ARRAY['_coverage','tasks',p_task,'next_attempt_at']),'-infinity')>now() THEN CONTINUE;END IF;
  IF p_task='design' AND s#>>'{tasks,classification,status}' IS DISTINCT FROM 'verified' THEN CONTINUE;END IF;
  -- Lock only an eligible candidate, then revalidate its fresh row after the lock.
  -- The read cursor may be stale if another worker or owner changed this record.
  SELECT x.* INTO l FROM zoi.listings x WHERE x.id=l.id FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN CONTINUE;END IF;
  IF l.publish_status IS DISTINCT FROM 'published' OR l.moderation_status IS NULL OR l.moderation_status NOT IN('clean','cleared') OR coalesce(l.marketplace_status,'')='hidden'
   OR coalesce(nullif(l.website,''),nullif(l.source_url,''),nullif(l.profile#>>'{_enrich,source_url}',''),'')!~*'^https?://'
   OR coalesce(zoi.enrich_timestamp(l.profile#>>'{_enrich,lease,expires_at}'),'-infinity')>=now() THEN CONTINUE;END IF;
  s:=zoi.listing_quality_state(l);fingerprint:=s->>'fingerprint';
  IF s#>>ARRAY['tasks',p_task,'status'] IN('verified','blocked') THEN CONTINUE;END IF;
  IF l.profile#>>'{_coverage,fingerprint}' IS NOT DISTINCT FROM fingerprint AND coalesce(zoi.enrich_timestamp(l.profile#>>ARRAY['_coverage','tasks',p_task,'next_attempt_at']),'-infinity')>now() THEN CONTINUE;END IF;
  IF p_task='design' AND s#>>'{tasks,classification,status}' IS DISTINCT FROM 'verified' THEN CONTINUE;END IF;
  lease:=gen_random_uuid()::text;
  UPDATE zoi.listings SET profile=coalesce(l.profile,'{}')||jsonb_build_object('_enrich',coalesce(l.profile->'_enrich','{}')||jsonb_build_object('lease',jsonb_build_object('id',lease,'task',p_task,'fingerprint',fingerprint,'source_website',l.website,'expires_at',clock_timestamp()+interval '15 minutes'))) WHERE id=l.id;
  RETURN QUERY SELECT l.id,l.slug,l.name,l.entity_type,coalesce(nullif(l.website,''),nullif(l.source_url,''),l.profile#>>'{_enrich,source_url}'),lease,fingerprint,l.owner_workspace_id IS NOT NULL,coalesce(l.profile->'_enrich','{}')-'lease';
  claimed:=claimed+1;EXIT WHEN claimed>=p_limit;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.listing_quality_task_lease(text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.listing_quality_task_lease(text,integer) TO service_role;
COMMIT;
