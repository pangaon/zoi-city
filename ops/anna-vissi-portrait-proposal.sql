-- PROPOSAL ONLY. Default ROLLBACK. Source-reviewed imported photograph repair.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='8s';
DO $$
DECLARE l zoi.listings; next_profile jsonb;
 new_photo text:='https://ugc.production.linktr.ee/1f804c97-d4c6-4a60-8abe-4ec52993756e_IMG-4009.jpeg';
BEGIN
 SELECT * INTO l FROM zoi.listings WHERE id='48162031-673e-491d-ba63-3e502dabf3fd' FOR UPDATE;
 IF NOT FOUND OR l.slug IS DISTINCT FROM 'anna-vissi-athens-481620' OR l.name IS DISTINCT FROM 'Anna Vissi'
 OR l.website IS DISTINCT FROM 'https://www.annavissilive.com' OR l.owner_workspace_id IS NOT NULL
 OR l.photo_url IS NOT NULL OR zoi.public_owner_content(l.id) IS DISTINCT FROM '{}'::jsonb
 OR md5(l.profile::text) IS DISTINCT FROM '93b4b6de6e9606bb136f044c3e1b3e2c'
 OR md5((to_jsonb(l)-'profile'-'photo_url'-'updated_at'-'search_tsv')::text) IS DISTINCT FROM '3433986998de51693e6f9dca16d17185'
 OR l.profile#>>'{_enrich,photo_url}' IS DISTINCT FROM 'https://www.annavissilive.com/wp-content/uploads/2026/04/WhatsApp-Image-2026-04-14-at-12.16.45-1024x576.jpeg'
 THEN RAISE EXCEPTION 'anna_portrait_snapshot_changed'; END IF;
 next_profile:=jsonb_set(l.profile,'{_enrich}',(l.profile->'_enrich')||jsonb_build_object(
 'photo_url',new_photo,
 'provenance',coalesce(l.profile#>'{_enrich,provenance}','{}'::jsonb)||jsonb_build_object('photo_url','reviewed-artist-channel:https://linktr.ee/annavissiofficial'),
 'photo_evidence',jsonb_build_object('source_url','https://linktr.ee/annavissiofficial','asset_url',new_photo,'checked_at','2026-09-30T23:27:58Z','method','artist_channel_profile_image_visual_review','width',2000,'height',2000,'sha256','8b03e272abf156bb06d19f015c466aa30a2fe3f3024780d6305e8135b2462f72','previous_url',l.profile#>>'{_enrich,photo_url}','previous_failure','HTTP 200 text/html challenge instead of JPEG','rights','Public artist channel publication; no explicit reuse license asserted')),true);
 UPDATE zoi.listings SET profile=next_profile,updated_at=now() WHERE id=l.id;
 IF NOT EXISTS(SELECT 1 FROM zoi.listings a WHERE a.id=l.id AND a.profile=next_profile AND a.photo_url IS NULL
 AND md5((to_jsonb(a)-'profile'-'photo_url'-'updated_at'-'search_tsv')::text)='3433986998de51693e6f9dca16d17185'
 AND zoi.public_owner_content(a.id)='{}'::jsonb) THEN RAISE EXCEPTION 'anna_portrait_postcondition_failed'; END IF;
END $$;
SELECT 'Anna imported portrait proposal validated; transaction will roll back' AS result;
ROLLBACK;
