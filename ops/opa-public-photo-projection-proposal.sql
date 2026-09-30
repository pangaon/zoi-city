-- Reviewed official announcement artwork: align public card projection with existing hero.
BEGIN;
SET LOCAL statement_timeout='15s';
SELECT pg_advisory_xact_lock(hashtextextended('reviewed-opa-publication-2027',0));
DO $apply$ DECLARE n integer; BEGIN
 IF (SELECT count(*) FROM zoi.listings WHERE
   (id='3778e7a6-08f7-5d32-b9dd-d105476765e9'::uuid AND slug='opa-productions' AND source_url='http://www.opaproductions.com/') OR
   (id='9b241a00-f0c9-5748-8e22-79e2e0b57f79'::uuid AND slug='giannis-ploutarchos-andromache-montreal-2027' AND source_url='http://www.opaproductions.com/plut-andro-2026-montreal-floor-plan.html'))<>2 THEN RAISE EXCEPTION 'OPA exact source identity changed'; END IF;
 UPDATE zoi.listings SET photo_url=profile->>'hero_url'
 WHERE id IN ('3778e7a6-08f7-5d32-b9dd-d105476765e9'::uuid,'9b241a00-f0c9-5748-8e22-79e2e0b57f79'::uuid)
 AND photo_url IS NULL AND owner_user_id IS NULL AND owner_workspace_id IS NULL
 AND claim_status='unclaimed' AND publish_status='published'
 AND profile->>'hero_kind'='event_poster'
 AND profile->>'hero_url'='https://www.zoi.city/assets/events/opa/montreal-2027-poster.jpg';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>2 THEN RAISE EXCEPTION 'OPA photo preconditions changed: %',n; END IF;
END $apply$;
SELECT id,slug,photo_url,public.seo_entity(slug)->>'photo_url' AS public_photo_url FROM zoi.listings
WHERE id IN ('3778e7a6-08f7-5d32-b9dd-d105476765e9'::uuid,'9b241a00-f0c9-5748-8e22-79e2e0b57f79'::uuid);
ROLLBACK;
