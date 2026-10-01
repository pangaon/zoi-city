-- REVIEW PROPOSAL ONLY. Default rollback. Deploy exact event-route redirects first.
-- No ownership, sellable inventory, payment configuration or coordinates are created.
BEGIN;
SET LOCAL statement_timeout='15s';
SELECT pg_advisory_xact_lock(hashtextextended('reviewed-signature-toronto-concert-2027-03-20',0));
DO $proposal$
DECLARE event_id uuid; organizer uuid; category bigint; r zoi.listings%ROWTYPE;
BEGIN
 SELECT id INTO organizer FROM zoi.listings WHERE slug='signatureproductions-6aa61d' AND entity_type='business' AND id='9d969028-74cb-4b49-97f1-58eba8fc0e69'::uuid AND lower(website) IN('https://signatureproductions.ca/','https://www.signatureproductions.ca/');
 IF organizer IS NULL THEN RAISE EXCEPTION 'Signature organizer identity changed; review';END IF;
 SELECT id INTO category FROM zoi.categories WHERE slug='events-entertainment';
 IF category IS NULL THEN RAISE EXCEPTION 'Event category missing';END IF;
 IF EXISTS(SELECT 1 FROM zoi.listings WHERE
  slug='giannis-ploutarchos-andromache-toronto-2027'
  OR (entity_type='event' AND (
   lower(coalesce(website,'')) ~ '^https?://(www\.)?signatureproductions\.ca/giannisploutarchosandromache/?([?#].*)?$'
   OR lower(coalesce(source_url,'')) ~ '^https?://(www\.)?signatureproductions\.ca/giannisploutarchosandromache/?([?#].*)?$'
   OR ((lower(name) LIKE '%ploutarch%' OR lower(name) LIKE '%andromach%') AND
     (lower(coalesce(city,'')) IN('toronto','north york') OR lower(name) LIKE '%toronto%' OR lower(coalesce(profile->>'venue','')) LIKE '%parkview%'))
  ))) THEN RAISE EXCEPTION 'Potential Toronto concert duplicate exists; review instead of inserting';END IF;
 INSERT INTO zoi.listings(entity_type,name,slug,description,primary_category_id,city,country,website,source_url,source_type,verification_status,claim_status,publish_status,bookable,geo_precision,canonical_path,profile,created_by,source_last_checked_at)
 VALUES('event','Giannis Ploutarchos & Andromache — Toronto 2027','giannis-ploutarchos-andromache-toronto-2027','Giannis Ploutarchos and Andromache perform at Parkview Manor on March 20, 2027, presented by Signature Productions. Doors open at 8 pm and the show starts at 10 pm. Explore the room and organize your group; ticket requests are confirmed by the organizer.',category,'Toronto','Canada','https://www.signatureproductions.ca/giannisploutarchosandromache','https://www.signatureproductions.ca/giannisploutarchosandromache','official_website','unverified','unclaimed','published',false,'none','/events/giannis-ploutarchos-andromache-toronto-2027/',
 jsonb_build_object('starts','2027-03-20','date_precision','day','timezone','America/Toronto','doors','20:00','show','22:00','venue','Parkview Manor','organizer_id',organizer,'organizer_name','Signature Productions','organizer_url','/business/signatureproductions-6aa61d','lineup',jsonb_build_array('Giannis Ploutarchos','Andromache'),'hero_url','https://www.zoi.city/assets/events/signature/poster.jpg','hero_kind','event_poster','photo_urls',jsonb_build_array('https://www.zoi.city/assets/events/signature/poster.jpg'),'floor_plan_url','https://www.zoi.city/assets/events/signature/floorplan.jpg','ticketing_status','contact_organizer','seating_note','Organizer publishes 10 seats per table or booth. This is a non-food event.','source_evidence',jsonb_build_object('checked_at','2026-10-01','event_source','https://www.signatureproductions.ca/giannisploutarchosandromache','date_evidence','Official page supplies March 20; retained official poster supplies 2027.','source_facts','/assets/events/signature/source-facts.mjs','official_html_sha256','45eba0739771f53199ed2980ff7e256728f209f6b3ee1da3646a1602e2f93d10','poster_sha256','74d9c5eaaf6e261e416a3654581fb892d05721cff6304032ccb1c30732877e97','sale_status','announcement_only')),
 'reviewed_signature_event_source_2026_10_01',now()) RETURNING id INTO event_id;
 SELECT * INTO r FROM zoi.listings WHERE id=event_id;
 IF r.publish_status<>'published' OR r.owner_user_id IS NOT NULL OR r.owner_workspace_id IS NOT NULL OR r.claim_status<>'unclaimed' OR r.bookable IS TRUE OR r.latitude IS NOT NULL OR r.longitude IS NOT NULL THEN RAISE EXCEPTION 'Toronto publication invariant failed';END IF;
 IF public.seo_entity(r.slug)->>'canonical_slug' IS DISTINCT FROM r.slug THEN RAISE EXCEPTION 'Toronto public slug projection failed';END IF;
 RAISE NOTICE 'New Toronto catalogue event id: % (database-generated)',event_id;
END $proposal$;
SELECT id,entity_type,slug,publish_status,claim_status,bookable,canonical_path FROM zoi.listings WHERE slug='giannis-ploutarchos-andromache-toronto-2027';
ROLLBACK;
