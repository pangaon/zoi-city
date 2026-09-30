BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
GRANT EXECUTE ON FUNCTION zoi.enrich_timestamp(text) TO service_role;
CREATE OR REPLACE FUNCTION zoi.profile_strip(p jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'zoi', 'public'
AS $function$
  SELECT coalesce(
    (SELECT jsonb_object_agg(k, v)
       FROM jsonb_each(coalesce(p, '{}'::jsonb)) AS t(k, v)
      WHERE k NOT IN ('rating','rating_count','review','reviews','reviewCount',
                      'aggregateRating','score','stars','ranking','provider_stats',
                      '_enrich','_geo','_coverage')
        AND k NOT LIKE 'rating%'
        AND k NOT LIKE 'review%'),
    '{}'::jsonb);
$function$;
-- Private worker receipts are not owner-authored profile data.
CREATE FUNCTION zoi.guard_listing_quality_receipts() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE prior_receipt jsonb;
BEGIN
 IF TG_OP='UPDATE' THEN prior_receipt:=OLD.profile->'_coverage';END IF;
 IF (current_user IN('anon','authenticated') OR current_setting('request.jwt.claim.role',true) IN('anon','authenticated') OR coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'role' IN('anon','authenticated')) AND NEW.profile->'_coverage' IS DISTINCT FROM prior_receipt THEN RAISE EXCEPTION 'quality_receipts_service_only';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION zoi.guard_listing_quality_receipts() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER listing_quality_receipts_guard BEFORE INSERT OR UPDATE OF profile ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.guard_listing_quality_receipts();
-- Coverage lives with the existing listing. This view accounts for every row
-- without seeding/re-writing the catalog or creating a competing queue.
CREATE FUNCTION zoi.listing_quality_fingerprint(l zoi.listings) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT md5(jsonb_build_array(l.name,l.entity_type,l.website,l.source_url,l.primary_category_id,l.owner_workspace_id,l.publish_status,l.moderation_status,l.marketplace_status,coalesce(l.profile,'{}')-'_enrich'-'_coverage'-'_geo')::text)
$$;
CREATE FUNCTION zoi.listing_quality_state(l zoi.listings) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE visible boolean:=l.publish_status='published' AND l.moderation_status IN('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden';
 source text:=coalesce(nullif(l.website,''),nullif(l.source_url,''),nullif(l.profile#>>'{_enrich,source_url}',''));fingerprint text:=zoi.listing_quality_fingerprint(l);task text;v jsonb;tasks jsonb:='{}';stored jsonb:=coalesce(l.profile->'_coverage','{}');
BEGIN
 FOREACH task IN ARRAY ARRAY['classification','enrichment','design','verification'] LOOP
  v:=jsonb_build_object('status',CASE WHEN NOT coalesce(visible,false) THEN 'blocked_visibility' WHEN source IS NULL THEN 'source_missing' WHEN task='enrichment' AND l.profile#>>'{_enrich,blocked}'='true' THEN 'blocked_existing' ELSE 'pending' END);
  IF coalesce(visible,false) AND source IS NOT NULL AND stored->>'fingerprint'=fingerprint AND stored#>>ARRAY['tasks',task,'status'] IN('verified','retry','blocked','fetched') AND (stored#>>ARRAY['tasks',task,'status']<>'verified' OR coalesce(zoi.enrich_timestamp(stored#>>ARRAY['tasks',task,'recorded_at']),'-infinity')>now()-interval '7 days') AND NOT(task='enrichment' AND coalesce(l.profile#>>'{_enrich,blocked}','false')='true') THEN v:=stored#>ARRAY['tasks',task];END IF;
  tasks:=tasks||jsonb_build_object(task,v);
 END LOOP;
 RETURN jsonb_build_object('version',1,'fingerprint',fingerprint,'public_eligible',coalesce(visible,false),'source_available',source IS NOT NULL,'source_kind',CASE WHEN source IS NULL THEN 'source_missing' WHEN source~*'/(profile|members?|directory|people|team|staff)(/|\?|$)' THEN 'member_or_directory' WHEN source~*'^https?://[^/]+/?$' THEN 'root_identity_unverified' ELSE 'source_identity_unverified' END,'owner_managed',l.owner_workspace_id IS NOT NULL,'tasks',tasks,'audit',CASE WHEN stored->>'fingerprint'=fingerprint THEN stored->'audit' ELSE NULL END);
END $$;
CREATE VIEW zoi.v_listing_quality_coverage AS SELECT l.id listing_id,l.entity_type,l.primary_category_id,zoi.listing_quality_state(l) coverage FROM zoi.listings l;
REVOKE ALL ON zoi.v_listing_quality_coverage FROM PUBLIC,anon,authenticated;
GRANT SELECT ON zoi.v_listing_quality_coverage TO service_role;
REVOKE ALL ON FUNCTION zoi.listing_quality_fingerprint(zoi.listings),zoi.listing_quality_state(zoi.listings) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION zoi.listing_quality_fingerprint(zoi.listings),zoi.listing_quality_state(zoi.listings) TO service_role;

-- Deterministic metadata audit: no network and no assertion of person identity.
-- One transaction is the lease for this short local task; active crawler/task
-- leases are skipped. Repeating the same rules/fingerprint does no writes.
CREATE FUNCTION public.listing_quality_audit(p_limit integer DEFAULT 40) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l zoi.listings;s jsonb;n integer:=0;ids uuid[]:='{}';
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid_quality_limit';END IF;
 FOR l IN SELECT x.* FROM zoi.listings x WHERE (x.profile#>>'{_coverage,fingerprint}' IS DISTINCT FROM zoi.listing_quality_fingerprint(x) OR x.profile#>>'{_coverage,audit,rules_version}' IS DISTINCT FROM '1') AND coalesce(zoi.enrich_timestamp(x.profile#>>'{_enrich,lease,expires_at}'),'-infinity')<now() ORDER BY x.id LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
  s:=zoi.listing_quality_state(l);
  s:=s||jsonb_build_object('audit',jsonb_build_object('rules_version','1','recorded_at',clock_timestamp(),'result','metadata_observed','identity_verified',false));
  UPDATE zoi.listings SET profile=coalesce(l.profile,'{}')||jsonb_build_object('_coverage',s) WHERE id=l.id;
  n:=n+1;ids:=array_append(ids,l.id);
 END LOOP;
 RETURN jsonb_build_object('ok',true,'processed',n,'listing_ids',ids,'network_requests',0,'identity_verifications',0);
END $$;
REVOKE ALL ON FUNCTION public.listing_quality_audit(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.listing_quality_audit(integer) TO service_role;

-- A TABLE return shape requires atomic recreation. Existing leading fields
-- and parameter names remain compatible; no CASCADE drops are permitted.
DROP FUNCTION public.enrich_queue_lease(integer,integer,integer);
DROP FUNCTION zoi.enrich_queue_lease(integer,integer,integer);
CREATE FUNCTION zoi.enrich_queue_lease(p_limit integer DEFAULT 40,p_max_age_days integer DEFAULT 30,p_lease_minutes integer DEFAULT 15)
RETURNS TABLE(slug text,website text,lease_id text,listing_id uuid,name text,entity_type text,existing_enrich jsonb,owner_managed boolean,owner_workspace_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE lease text:=gen_random_uuid()::text;
BEGIN
 RETURN QUERY WITH candidates AS (
 SELECT l.id FROM zoi.listings l WHERE l.publish_status='published' AND l.moderation_status IN('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden' AND l.website~*'^https?://' AND coalesce(l.profile#>>'{_enrich,blocked}','')<>'true'
 AND (zoi.enrich_timestamp(l.profile#>>'{_enrich,checked_at}') IS NULL OR zoi.enrich_timestamp(l.profile#>>'{_enrich,checked_at}')<current_date-greatest(coalesce(p_max_age_days,30),1) OR l.profile#>>'{_enrich,crawl_status}'='error')
 AND (l.profile#>>'{_enrich,crawl_status}' IS DISTINCT FROM 'error' OR coalesce(zoi.enrich_timestamp(l.profile#>>'{_enrich,last_attempt_at}'),'-infinity')<=now()-interval '6 hours')
 AND coalesce(zoi.enrich_timestamp(l.profile#>>'{_enrich,lease,expires_at}'),'-infinity')<now()
 ORDER BY (l.verification_status IN('verified','owner_verified','source_verified'))DESC,l.profile#>>'{_enrich,checked_at}' NULLS FIRST,l.id LIMIT greatest(least(coalesce(p_limit,40),200),1) FOR UPDATE SKIP LOCKED
 ),leased AS (
 UPDATE zoi.listings l SET profile=coalesce(l.profile,'{}')||jsonb_build_object('_enrich',coalesce(l.profile->'_enrich','{}')||jsonb_build_object('lease',jsonb_build_object('id',lease,'task','enrichment','fingerprint',zoi.listing_quality_fingerprint(l),'source_website',l.website,'expires_at',clock_timestamp()+make_interval(mins=>greatest(least(coalesce(p_lease_minutes,15),60),1))))) FROM candidates c WHERE l.id=c.id RETURNING l.*)
 SELECT l.slug,l.website,lease,l.id,l.name,l.entity_type,coalesce(l.profile->'_enrich','{}')-'lease',l.owner_workspace_id IS NOT NULL,l.owner_workspace_id FROM leased l;
END $$;
CREATE FUNCTION public.enrich_queue_lease(p_limit integer DEFAULT 40,p_max_age_days integer DEFAULT 30,p_lease_minutes integer DEFAULT 15)
RETURNS TABLE(slug text,website text,lease_id text,listing_id uuid,name text,entity_type text,existing_enrich jsonb,owner_managed boolean,owner_workspace_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$SELECT * FROM zoi.enrich_queue_lease(p_limit,p_max_age_days,p_lease_minutes)$$;
DROP FUNCTION public.enrich_sample_lease(uuid[]);
CREATE FUNCTION public.enrich_sample_lease(p_ids uuid[])
RETURNS TABLE(slug text,website text,lease_id text,listing_id uuid,name text,entity_type text,existing_enrich jsonb,owner_managed boolean,owner_workspace_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE lease text:=gen_random_uuid()::text;
BEGIN
 IF p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 3 OR array_position(p_ids,NULL) IS NOT NULL OR cardinality(p_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_ids)x) THEN RAISE EXCEPTION 'invalid_enrichment_sample';END IF;
 RETURN QUERY WITH candidates AS(SELECT l.id FROM zoi.listings l WHERE l.id=ANY(p_ids) AND l.publish_status='published' AND l.moderation_status IN('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden' AND l.website~*'^https?://' AND coalesce(l.profile#>>'{_enrich,blocked}','')<>'true' AND coalesce(zoi.enrich_timestamp(l.profile#>>'{_enrich,lease,expires_at}'),'-infinity')<now() ORDER BY l.id FOR UPDATE SKIP LOCKED),leased AS(
 UPDATE zoi.listings l SET profile=coalesce(l.profile,'{}')||jsonb_build_object('_enrich',coalesce(l.profile->'_enrich','{}')||jsonb_build_object('lease',jsonb_build_object('id',lease,'task','enrichment','fingerprint',zoi.listing_quality_fingerprint(l),'source_website',l.website,'expires_at',clock_timestamp()+interval '15 minutes')))FROM candidates c WHERE l.id=c.id RETURNING l.*)
 SELECT l.slug,l.website,lease,l.id,l.name,l.entity_type,coalesce(l.profile->'_enrich','{}')-'lease',l.owner_workspace_id IS NOT NULL,l.owner_workspace_id FROM leased l;
END $$;
REVOKE ALL ON FUNCTION zoi.enrich_queue_lease(integer,integer,integer),public.enrich_queue_lease(integer,integer,integer),public.enrich_sample_lease(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enrich_queue_lease(integer,integer,integer),public.enrich_sample_lease(uuid[]) TO service_role;

-- Existing owner profile siblings and coverage audit survive machine replacement.
CREATE OR REPLACE FUNCTION zoi.enrich_apply(p_batch jsonb)
 RETURNS TABLE(slug text, applied boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r jsonb;l zoi.listings;machine jsonb;incoming jsonb;lease jsonb;
BEGIN
 IF jsonb_typeof(p_batch) IS DISTINCT FROM 'array' OR jsonb_array_length(p_batch)>200 OR octet_length(p_batch::text)>2000000 THEN RAISE EXCEPTION 'invalid_enrichment_batch';END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_batch) LOOP
  SELECT * INTO l FROM zoi.listings WHERE listings.slug=r->>'slug' FOR UPDATE;
  lease:=l.profile->'_enrich'->'lease';
  IF l.id IS NULL OR l.publish_status IS DISTINCT FROM 'published' OR l.moderation_status NOT IN('clean','cleared') OR l.moderation_status IS NULL OR coalesce(l.marketplace_status,'')='hidden' OR lease->>'task' IS DISTINCT FROM 'enrichment' OR lease->>'fingerprint' IS DISTINCT FROM zoi.listing_quality_fingerprint(l) OR nullif(r->>'lease_id','') IS NULL OR (lease->>'id') IS DISTINCT FROM (r->>'lease_id') OR (lease->>'source_website') IS DISTINCT FROM l.website OR coalesce(zoi.enrich_timestamp(lease->>'expires_at'),'-infinity')<=clock_timestamp() THEN
   RETURN QUERY SELECT r->>'slug',false;CONTINUE;
  END IF;
  incoming:=coalesce(r->'profile','{}');
  IF jsonb_typeof(incoming) IS DISTINCT FROM 'object' OR jsonb_typeof(coalesce(r->'provenance','{}')) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_enrichment_fields';END IF;
  IF incoming->>'crawl_status'='error' THEN
   machine:=(coalesce(l.profile->'_enrich','{}')-'lease')||jsonb_build_object('crawl_status','error','status','error','last_error',left(coalesce(incoming->>'last_error','crawl_failed'),200),'last_attempt_at',clock_timestamp());
  ELSE
   machine:=(zoi.profile_strip(incoming)-'lease')||jsonb_build_object('provenance',coalesce(r->'provenance','{}'),'source_url',r->>'website','checked_at',to_char(now(),'YYYY-MM-DD'),'last_attempt_at',clock_timestamp(),'status',coalesce(incoming->>'crawl_status','ok'));
  END IF;
  UPDATE zoi.listings SET profile=coalesce(l.profile,'{}')||jsonb_build_object('_enrich',machine,'_coverage',jsonb_set(CASE WHEN incoming->>'crawl_status'='error' THEN zoi.listing_quality_state(l) ELSE jsonb_set(jsonb_set(jsonb_set(zoi.listing_quality_state(l),'{tasks,classification}','{"status":"pending"}'),'{tasks,design}','{"status":"pending"}'),'{tasks,verification}','{"status":"pending"}') END,'{tasks,enrichment}',jsonb_build_object('status',CASE WHEN incoming->>'crawl_status'='error' THEN 'retry' ELSE 'fetched' END,'recorded_at',clock_timestamp(),'lease_id',lease->>'id','evidence',jsonb_build_object('check','stored_source_fetch','identity_verified',false,'source_fingerprint',lease->>'fingerprint')),true)),updated_at=now() WHERE id=l.id;
  RETURN QUERY SELECT l.slug,true;
 END LOOP;
END $function$;

-- Longer classification/design/verification work shares the SAME existing
-- _enrich.lease slot with crawling; no listing can run both at once.
CREATE FUNCTION public.listing_quality_task_lease(p_task text,p_limit integer DEFAULT 40)
RETURNS TABLE(listing_id uuid,slug text,name text,entity_type text,website text,lease_id text,source_fingerprint text,owner_managed boolean,existing_enrich jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l zoi.listings;s jsonb;lease text;
BEGIN
 IF p_task IS NULL OR p_task NOT IN('classification','design','verification') OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid_quality_task';END IF;
 FOR l IN SELECT x.* FROM zoi.listings x WHERE x.publish_status='published' AND x.moderation_status IN('clean','cleared') AND coalesce(x.marketplace_status,'')<>'hidden'
 AND coalesce(nullif(x.website,''),nullif(x.source_url,''),nullif(x.profile#>>'{_enrich,source_url}',''))~*'^https?://'
 AND coalesce(zoi.enrich_timestamp(x.profile#>>'{_enrich,lease,expires_at}'),'-infinity')<now()
 AND zoi.listing_quality_state(x)#>>ARRAY['tasks',p_task,'status'] NOT IN('verified','blocked')
 AND (x.profile#>>'{_coverage,fingerprint}' IS DISTINCT FROM zoi.listing_quality_fingerprint(x) OR coalesce(zoi.enrich_timestamp(x.profile#>>ARRAY['_coverage','tasks',p_task,'next_attempt_at']),'-infinity')<=now())
 AND (p_task<>'design' OR zoi.listing_quality_state(x)#>>'{tasks,classification,status}'='verified')
 ORDER BY x.id LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
  lease:=gen_random_uuid()::text;
  UPDATE zoi.listings SET profile=coalesce(l.profile,'{}')||jsonb_build_object('_enrich',coalesce(l.profile->'_enrich','{}')||jsonb_build_object('lease',jsonb_build_object('id',lease,'task',p_task,'fingerprint',zoi.listing_quality_fingerprint(l),'source_website',l.website,'expires_at',clock_timestamp()+interval '15 minutes')))WHERE id=l.id;
  RETURN QUERY SELECT l.id,l.slug,l.name,l.entity_type,coalesce(nullif(l.website,''),nullif(l.source_url,''),l.profile#>>'{_enrich,source_url}'),lease,zoi.listing_quality_fingerprint(l),l.owner_workspace_id IS NOT NULL,coalesce(l.profile->'_enrich','{}')-'lease';
 END LOOP;
END $$;
CREATE FUNCTION public.listing_quality_task_finish(p_listing uuid,p_lease text,p_status text,p_evidence jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l zoi.listings;lease jsonb;task text;s jsonb;receipt jsonb;attempts integer;
BEGIN
 IF p_status IS NULL OR p_status NOT IN('verified','retry','blocked') OR jsonb_typeof(p_evidence) IS DISTINCT FROM 'object' OR octet_length(p_evidence::text)>4000 THEN RAISE EXCEPTION 'invalid_quality_receipt';END IF;
 SELECT * INTO l FROM zoi.listings WHERE id=p_listing FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'quality_listing_missing';END IF;
 s:=zoi.listing_quality_state(l);
 -- Exact repeated receipt is idempotent, but changed status/evidence cannot be replayed.
 FOR task IN SELECT unnest(ARRAY['classification','design','verification']) LOOP
  receipt:=s#>ARRAY['tasks',task];
  IF receipt->>'lease_id'=p_lease THEN
   IF receipt->>'requested_status'=p_status AND receipt->'evidence'=p_evidence THEN RETURN jsonb_build_object('ok',true,'already',true,'listing_id',p_listing,'task',task,'status',receipt->>'status');END IF;
   RAISE EXCEPTION 'quality_receipt_conflict';
  END IF;
 END LOOP;
 lease:=l.profile#>'{_enrich,lease}';task:=lease->>'task';
 IF p_lease IS NULL OR lease->>'id' IS DISTINCT FROM p_lease OR task NOT IN('classification','design','verification') OR task IS NULL OR lease->>'fingerprint' IS DISTINCT FROM zoi.listing_quality_fingerprint(l) OR coalesce(zoi.enrich_timestamp(lease->>'expires_at'),'-infinity')<=now() OR NOT coalesce((s->>'public_eligible')::boolean,false) THEN RAISE EXCEPTION 'quality_lease_stale';END IF;
 IF p_status='verified' THEN
  IF p_evidence->>'source_fingerprint' IS DISTINCT FROM lease->>'fingerprint' OR p_evidence->>'passed' IS DISTINCT FROM 'true' OR length(coalesce(p_evidence->>'evidence_ref',''))NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'quality_evidence_required';END IF;
  IF task='classification' AND (p_evidence->>'subject_name' IS DISTINCT FROM l.name OR p_evidence->>'identity_match' IS DISTINCT FROM 'true' OR p_evidence->>'source_role' IS NULL OR p_evidence->>'source_role' NOT IN('individual','practice','organization','chapter','venue','event','place','product'))THEN RAISE EXCEPTION 'quality_identity_evidence_required';END IF;
  IF task='design' AND (p_evidence->>'template_known' IS DISTINCT FROM 'true' OR p_evidence->>'source_sections_valid' IS DISTINCT FROM 'true')THEN RAISE EXCEPTION 'quality_design_evidence_required';END IF;
  IF task='verification' AND (p_evidence->>'http_status' IS DISTINCT FROM '200' OR p_evidence->>'controls_checked' IS DISTINCT FROM 'true' OR coalesce(p_evidence->>'route','')!~'^/[^/]')THEN RAISE EXCEPTION 'quality_route_evidence_required';END IF;
 END IF;
 attempts:=least(coalesce((s#>>ARRAY['tasks',task,'attempts'])::integer,0)+1,100);
 receipt:=jsonb_build_object('status',CASE WHEN p_status='retry'AND attempts>=5 THEN 'blocked' ELSE p_status END,'requested_status',p_status,'lease_id',p_lease,'recorded_at',clock_timestamp(),'attempts',attempts,'evidence',p_evidence,'next_attempt_at',CASE WHEN p_status='retry'THEN clock_timestamp()+make_interval(secs=>least(3600*power(2,least(attempts-1,5)),86400)::integer)ELSE NULL END);
 s:=jsonb_set(s,ARRAY['tasks',task],receipt,true);
 UPDATE zoi.listings SET profile=coalesce(l.profile,'{}')||jsonb_build_object('_coverage',s,'_enrich',coalesce(l.profile->'_enrich','{}')-'lease')WHERE id=l.id;
 RETURN jsonb_build_object('ok',true,'already',false,'listing_id',p_listing,'task',task,'status',receipt->>'status');
END $$;
REVOKE ALL ON FUNCTION public.listing_quality_task_lease(text,integer),public.listing_quality_task_finish(uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.listing_quality_task_lease(text,integer),public.listing_quality_task_finish(uuid,text,text,jsonb) TO service_role;
COMMIT;
