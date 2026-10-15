-- Synthetic database behavior only. No source fetch, coordinate approval,
-- real listing mutation, provider operation or retained synthetic row.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='2s';
DO $qa$
DECLARE
 listing uuid:='ab700000-0000-4000-8000-000000000001';
 request uuid; saved jsonb; report jsonb; review jsonb; report_text text;
 expected text; candidate jsonb; before_epoch bigint; current_epoch bigint;
 phase integer; refused boolean; category bigint;
BEGIN
 IF to_regclass('zoi.geography_read_authority_epochs') IS NULL THEN RAISE EXCEPTION 'qa_read_authority_migration_required';END IF;
 IF EXISTS(SELECT 1 FROM zoi.listings WHERE id=listing)
 OR EXISTS(SELECT 1 FROM zoi.geography_reviews WHERE listing_id=listing)
 OR EXISTS(SELECT 1 FROM zoi.geography_read_authority_epochs WHERE listing_id=listing)
 THEN RAISE EXCEPTION 'qa_fixture_identity_exists';END IF;
 SELECT id INTO category FROM zoi.categories WHERE slug='restaurants' LIMIT 1;IF category IS NULL THEN RAISE EXCEPTION 'qa_fixture_category_missing';END IF;
 INSERT INTO zoi.listings(id,slug,name,entity_type,address,city,country,website,source_url,publish_status,moderation_status,marketplace_status,duplicate_status,geo_precision,profile,primary_category_id)
 VALUES(listing,'qa-geography-read-authority-rollback','Synthetic QA geography authority','business','18 Synthetic Street','London','United Kingdom','https://fixture.example.org/','https://fixture.example.org/','published','clean','eligible','unique','none','{}',category);
 candidate:=jsonb_build_object('name','Synthetic QA geography authority','address',jsonb_build_object('street','18 Synthetic Street','city','London','country','GB'),'latitude',51.5,'longitude',-0.1,'precision','source_published','schema_type','Restaurant','evidence_kind','jsonld');
 FOR phase IN 1..3 LOOP
  request:=('ab700000-0000-4000-8000-'||lpad((phase+1)::text,12,'0'))::uuid;
  SELECT zoi.geography_fingerprint(l) INTO expected FROM zoi.listings l WHERE id=listing;
  report:=jsonb_build_object('schema',1,'kind','official_coordinate_dry_run','status','review_required','reason','coordinate_plausibility_review_required','http_status',200,'listing_id',listing,'source_url','https://fixture.example.org/','source_sha256',repeat('a',64),'snapshot_sha256',repeat('b',64),'source_fingerprint',(SELECT zoi.listing_quality_fingerprint(l)FROM zoi.listings l WHERE id=listing),'candidate',candidate);
  report_text:=report::text;
  review:=jsonb_build_object('database_snapshot',expected,'report_sha256',encode(extensions.digest(convert_to(report_text,'UTF8'),'sha256'),'hex'),'reviewer','independent-synthetic-qa','specialist','synthetic-source-collector','reviewed_at',clock_timestamp(),'exact_address_confirmed',true,'not_area_centroid',true,'official_source_confirmed',true,'stored_address','18 Synthetic Street','stored_city','London','stored_country','United Kingdom','candidate_address',candidate->'address','locality_extent',jsonb_build_object('south',51.4,'north',51.6,'west',-0.2,'east',0,'source_url','https://fixture.example.org/locality'));
  saved:=public.geography_review_apply(request,listing,expected,report_text,review);
  IF saved->'ok' IS DISTINCT FROM 'true'::jsonb OR public.geography_reviewed_point(listing) IS NULL
  OR NOT EXISTS(SELECT 1 FROM zoi.geography_reviews WHERE request_id=request AND length(read_authority_fingerprint)=64)
  THEN RAISE EXCEPTION 'qa_fresh_authority_missing';END IF;
  SELECT epoch INTO before_epoch FROM zoi.geography_read_authority_epochs WHERE listing_id=listing;
  IF phase=1 THEN
   UPDATE zoi.listings SET description='Synthetic menu edit',profile=profile||'{"menu":[{"name":"Synthetic item"}],"_coverage":{"qa":"unrelated"}}'::jsonb,updated_at=clock_timestamp() WHERE id=listing;
   SELECT epoch INTO current_epoch FROM zoi.geography_read_authority_epochs WHERE listing_id=listing;
   IF current_epoch IS DISTINCT FROM before_epoch OR public.geography_reviewed_point(listing) IS NULL THEN RAISE EXCEPTION 'qa_unrelated_edit_revoked_authority';END IF;
   refused:=false;
   BEGIN PERFORM public.geography_review_apply(request,listing,expected,report_text,review);EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'geography_snapshot_changed' THEN RAISE;END IF;refused:=true;END;
   IF NOT refused THEN RAISE EXCEPTION 'qa_full_row_replay_weakened';END IF;
   refused:=false;
   BEGIN PERFORM public.geography_review_revert(request,saved->>'after_snapshot');EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'geography_snapshot_changed' THEN RAISE;END IF;refused:=true;END;
   IF NOT refused THEN RAISE EXCEPTION 'qa_full_row_revert_weakened';END IF;
   UPDATE zoi.listings SET address='19 Synthetic Street' WHERE id=listing;
   UPDATE zoi.listings SET address='18 Synthetic Street' WHERE id=listing;
   IF public.geography_reviewed_point(listing) IS NOT NULL THEN RAISE EXCEPTION 'qa_address_restoration_resurrected_receipt';END IF;
  ELSIF phase=2 THEN
   UPDATE zoi.listings SET source_url='https://fixture.example.org/other-branch' WHERE id=listing;
   UPDATE zoi.listings SET source_url='https://fixture.example.org/' WHERE id=listing;
   SELECT epoch INTO current_epoch FROM zoi.geography_read_authority_epochs WHERE listing_id=listing;
   IF current_epoch<>before_epoch+2 OR public.geography_reviewed_point(listing) IS NOT NULL THEN RAISE EXCEPTION 'qa_source_restoration_resurrected_receipt';END IF;
  ELSE
   saved:=public.geography_review_revert(request,saved->>'after_snapshot');
   IF saved->'reverted' IS DISTINCT FROM 'true'::jsonb OR public.geography_reviewed_point(listing) IS NOT NULL THEN RAISE EXCEPTION 'qa_exact_revert_failed';END IF;
  END IF;
 END LOOP;
END $qa$;
ROLLBACK;
SELECT jsonb_build_object('rollback_only',true,
 'listing_absent',NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id='ab700000-0000-4000-8000-000000000001'),
 'reviews_absent',NOT EXISTS(SELECT 1 FROM zoi.geography_reviews WHERE listing_id='ab700000-0000-4000-8000-000000000001'),
 'epoch_absent',NOT EXISTS(SELECT 1 FROM zoi.geography_read_authority_epochs WHERE listing_id='ab700000-0000-4000-8000-000000000001'),
 'source_verification_proof',false,'provider_calls',0);
