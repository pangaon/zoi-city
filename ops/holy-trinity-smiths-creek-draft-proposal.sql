-- COMPLETED ONCE 2026-09-30: hidden draft inserted by release owner; DO NOT REPLAY.
-- Retained as the exact reviewed operation; snapshot and duplicate guards must not be relaxed.
-- Primary evidence checked 2026-09-30:
-- https://stanthonysmonastery.org/pages/affiliated-monasteries (entry 12, live)
-- https://www.goarch.org/-/holy-monastery-of-holy-trinity (indexed; direct403)
-- https://www.detroit.goarch.org/about/parishes (indexed; direct403)
-- No stand-alone monastery website, email, photo, opening hours or services verified.
-- Existing17-source collection covers North America, not all Greece.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='3s';
-- Serializes duplicate check with concurrent ordinary listing INSERT/UPDATE.
-- If busy, abort; do not retry automatically or bypass this guard.
LOCK TABLE zoi.listings IN SHARE ROW EXCLUSIVE MODE;
DO $draft$
DECLARE
 candidate constant uuid:='3905208b-8527-4902-be75-8d9723a7013c';
 candidate_slug constant text:='holy-trinity-monastery-smiths-creek';
 source constant text:='https://stanthonysmonastery.org/pages/affiliated-monasteries';
 category bigint; saved zoi.listings; checklist jsonb;
BEGIN
 SELECT id INTO STRICT category FROM zoi.categories WHERE slug='monasteries';
 IF category<>38 THEN RAISE EXCEPTION 'monastery_category_changed';END IF;
 -- All statuses/countries: never adopt or overwrite an existing record.
 IF EXISTS(SELECT 1 FROM zoi.listings l WHERE l.id=candidate OR l.slug=candidate_slug
   OR regexp_replace(coalesce(l.phone,''),'[^0-9]','','g') IN('8103678134','18103678134')
   OR lower(coalesce(l.address,'')) LIKE '%sturdevant%'
   OR lower(coalesce(l.city,'')) IN('smiths creek','smith creek','kimball')
   OR lower(l.name) LIKE '%smith%creek%' OR lower(coalesce(l.slug,'')) LIKE '%smith%creek%'
   OR ((lower(l.name) LIKE '%trinity%monast%' OR lower(l.name) LIKE '%triad%monast%' OR lower(coalesce(l.slug,'')) LIKE '%trinity%monast%')
       AND lower(coalesce(l.country,'')) NOT IN('greece','gr','grc')))
 THEN RAISE EXCEPTION 'monastery_draft_duplicate_or_identity_review_required';END IF;
 INSERT INTO zoi.listings(id,name,slug,entity_type,primary_category_id,city,country,address,phone,source_url,
   website,email,photo_url,owner_workspace_id,publish_status,marketplace_status,moderation_status,verification_status,claim_status,profile)
 VALUES(candidate,'Holy Trinity Monastery',candidate_slug,'church',category,'Smiths Creek','United States',
   '125 Sturdevant Road, Smiths Creek, MI 48074','+18103678134',source,
   NULL,NULL,NULL,NULL,'draft','hidden','clean','unverified','unclaimed',
   jsonb_build_object('_enrich',jsonb_build_object('source_url',source,'source_kind','institution_affiliation_entry',
     'source_reviewed_at','2026-09-30','identity_scope','single_monastery_entry','source_entry_number',12,
     'provenance',jsonb_build_object('name',source,'address',source,'phone',source),
     'affiliation',jsonb_build_object('relationship','listed_affiliation','source_url',source,'region_scope','North America'))));
 SELECT * INTO STRICT saved FROM zoi.listings WHERE id=candidate;
 IF saved.publish_status IS DISTINCT FROM 'draft' OR saved.marketplace_status IS DISTINCT FROM 'hidden'
   OR saved.owner_workspace_id IS NOT NULL OR saved.verification_status IS DISTINCT FROM 'unverified'
   OR saved.website IS NOT NULL OR saved.email IS NOT NULL OR saved.photo_url IS NOT NULL
   OR saved.name<>'Holy Trinity Monastery' OR saved.phone<>'+18103678134' OR saved.primary_category_id<>38
 THEN RAISE EXCEPTION 'monastery_draft_posttrigger_state_changed';END IF;
 IF public.home_entity(candidate_slug) IS NOT NULL OR public.seo_entity(candidate_slug) IS NOT NULL
 THEN RAISE EXCEPTION 'monastery_draft_public_projection_exposed';END IF;
 checklist:=public.listing_quality_checklist(candidate);
 IF coalesce((checklist->>'complete')::boolean,true) OR jsonb_array_length(coalesce(checklist->'criteria','[]'))=0
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(checklist->'criteria') x WHERE x->>'status' IS DISTINCT FROM 'blocked_visibility')
 THEN RAISE EXCEPTION 'monastery_draft_quality_state_unexpected';END IF;
END $draft$;
SELECT jsonb_build_object('ok',true,'listing_id','3905208b-8527-4902-be75-8d9723a7013c',
 'status','draft','visibility','hidden','quality_complete',false,'public_link_created',false) AS draft_receipt;
COMMIT;
