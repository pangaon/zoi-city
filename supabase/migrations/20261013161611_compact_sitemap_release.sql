-- Exact eligibility and canonical ranking maintained atomically with listing writes.
BEGIN;
SET LOCAL lock_timeout='3s';
DO $$ BEGIN IF md5(pg_get_functiondef('zoi.seo_canonical_rows()'::regprocedure)) <> '5727895166d77d660e31fb62252fc81a' THEN RAISE EXCEPTION 'Canonical reader changed'; END IF; END $$;
LOCK TABLE zoi.listings IN SHARE ROW EXCLUSIVE MODE;
ALTER TABLE zoi.seo_identity_keys
 ADD COLUMN slug text, ADD COLUMN entity_type text, ADD COLUMN updated_at timestamptz,
 ADD COLUMN completeness integer, ADD COLUMN ugly integer, ADD COLUMN is_indexable boolean;
CREATE FUNCTION zoi.maintain_seo_projection() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN UPDATE zoi.seo_identity_keys k SET slug=NEW.slug,entity_type=NEW.entity_type,updated_at=coalesce(NEW.updated_at,NEW.created_at),
 completeness=(((NEW.address IS NOT NULL)::int)+((NEW.phone IS NOT NULL)::int)+((NEW.website IS NOT NULL)::int)+((NEW.latitude IS NOT NULL)::int)+((NEW.description IS NOT NULL)::int)),
 ugly=(NEW.slug ~ '-[0-9a-f]{6}$')::int,
 is_indexable=coalesce(NEW.publish_status='published' AND NEW.moderation_status IN ('clean','cleared') AND coalesce(NEW.marketplace_status,'')<>'hidden'
 AND nullif(btrim(NEW.slug),'') IS NOT NULL AND nullif(btrim(NEW.name),'') IS NOT NULL
 AND (NEW.city IS NOT NULL OR NEW.address IS NOT NULL OR NEW.website IS NOT NULL),false)
WHERE k.listing_id=NEW.id;
 RETURN NEW; END $$; REVOKE ALL ON FUNCTION zoi.maintain_seo_projection() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER zz_maintain_seo_projection AFTER INSERT OR UPDATE OF id,name,city,region,country,address,slug,entity_type,updated_at,created_at,phone,website,latitude,description,publish_status,moderation_status,marketplace_status ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.maintain_seo_projection();
UPDATE zoi.seo_identity_keys k SET slug=l.slug,entity_type=l.entity_type,updated_at=coalesce(l.updated_at,l.created_at),
 completeness=(((l.address IS NOT NULL)::int)+((l.phone IS NOT NULL)::int)+((l.website IS NOT NULL)::int)+((l.latitude IS NOT NULL)::int)+((l.description IS NOT NULL)::int)),
 ugly=(l.slug ~ '-[0-9a-f]{6}$')::int,
 is_indexable=coalesce(l.publish_status='published' AND l.moderation_status IN ('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden'
 AND nullif(btrim(l.slug),'') IS NOT NULL AND nullif(btrim(l.name),'') IS NOT NULL
 AND (l.city IS NOT NULL OR l.address IS NOT NULL OR l.website IS NOT NULL),false)
FROM zoi.listings l WHERE k.listing_id=l.id;

DO $coverage$ BEGIN
 IF EXISTS (SELECT 1 FROM zoi.listings l LEFT JOIN zoi.seo_identity_keys k ON k.listing_id=l.id WHERE k.listing_id IS NULL) THEN
  RAISE EXCEPTION 'Canonical projection coverage incomplete';
 END IF;
END $coverage$;
CREATE OR REPLACE FUNCTION zoi.seo_canonical_rows()
RETURNS TABLE(slug text,entity_type text,updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' SET work_mem='16MB' AS $$
BEGIN
 RETURN QUERY
 SELECT DISTINCT ON(k.name_key,k.city_key,k.region_key,k.country_key,k.address_key,k.entity_type)
 k.slug,k.entity_type,k.updated_at FROM zoi.seo_identity_keys k WHERE k.is_indexable
 ORDER BY k.name_key,k.city_key,k.region_key,k.country_key,k.address_key,k.entity_type,
 k.completeness DESC,k.ugly,k.updated_at DESC,k.slug;
END;
$$;
ANALYZE zoi.seo_identity_keys;
COMMIT;

