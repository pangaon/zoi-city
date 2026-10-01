-- Applied once by root on 2026-10-01. Historical evidence: do not replay.
-- Website-only correction verified against official Chi siamo and source browser.
-- Federation discovery source_url and every other listing field preserved.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $guard$
DECLARE before_row zoi.listings; after_row zoi.listings;
BEGIN
SELECT * INTO before_row FROM zoi.listings WHERE id='08106b1c-4664-47a1-b7cc-cd7cf575b050' FOR UPDATE;
IF NOT FOUND OR md5(to_jsonb(before_row)::text)<>'fbd3be71b78f19f7c94c5c9d905e6dbe' THEN RAISE EXCEPTION 'review_snapshot_changed';END IF;
IF before_row.name<>'Comunità Ellenica delle Marche' OR before_row.slug<>'comunit-ellenica-delle-marche' OR before_row.website IS DISTINCT FROM 'http://www.comunitaellenicamarche.weebly.com/' OR before_row.source_url IS DISTINCT FROM 'http://www.fccei.it/?page_id=7' OR before_row.owner_workspace_id IS NOT NULL OR before_row.owner_user_id IS NOT NULL OR before_row.claim_status IS DISTINCT FROM 'unclaimed' THEN RAISE EXCEPTION 'identity_or_ownership_changed';END IF;
UPDATE zoi.listings SET website='https://comunitaellenicamarche.weebly.com/' WHERE id=before_row.id;
SELECT * INTO after_row FROM zoi.listings WHERE id=before_row.id;
IF (to_jsonb(after_row)-ARRAY['website','updated_at']) IS DISTINCT FROM (to_jsonb(before_row)-ARRAY['website','updated_at']) THEN RAISE EXCEPTION 'unrelated_fields_changed';END IF;
IF after_row.website IS DISTINCT FROM 'https://comunitaellenicamarche.weebly.com/' THEN RAISE EXCEPTION 'website_not_saved';END IF;
END $guard$;
SELECT jsonb_build_object('id',id,'website',website,'source_url',source_url,'profile_hash',md5(profile::text),'source_fingerprint',zoi.listing_quality_fingerprint(l)) as receipt FROM zoi.listings l WHERE id='08106b1c-4664-47a1-b7cc-cd7cf575b050';
ROLLBACK;
