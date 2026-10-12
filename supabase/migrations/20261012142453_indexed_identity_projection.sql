-- Normalize identity on writes, not on every anonymous sitemap request.
-- Public eligibility and canonical winner ranking remain live reads of listings.
BEGIN;
SET LOCAL lock_timeout='3s';
CREATE TABLE zoi.seo_identity_keys (
 listing_id uuid PRIMARY KEY REFERENCES zoi.listings(id) ON DELETE CASCADE,
 name_key text NOT NULL, city_key text NOT NULL, region_key text NOT NULL,
 country_key text NOT NULL, address_key text NOT NULL
);
ALTER TABLE zoi.seo_identity_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.seo_identity_keys FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION zoi.maintain_seo_identity_keys() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO zoi.seo_identity_keys VALUES
 (NEW.id,zoi.seo_name(NEW.name,NEW.city),zoi.seo_text(NEW.city),zoi.seo_text(NEW.region),zoi.seo_text(NEW.country),zoi.seo_text(NEW.address))
 ON CONFLICT (listing_id) DO UPDATE SET name_key=EXCLUDED.name_key,city_key=EXCLUDED.city_key,
 region_key=EXCLUDED.region_key,country_key=EXCLUDED.country_key,address_key=EXCLUDED.address_key;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION zoi.maintain_seo_identity_keys() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER maintain_seo_identity_keys
AFTER INSERT OR UPDATE OF id,name,city,region,country,address ON zoi.listings
FOR EACH ROW EXECUTE FUNCTION zoi.maintain_seo_identity_keys();
INSERT INTO zoi.seo_identity_keys
SELECT id,zoi.seo_name(name,city),zoi.seo_text(city),zoi.seo_text(region),zoi.seo_text(country),zoi.seo_text(address)
FROM zoi.listings;
CREATE OR REPLACE FUNCTION zoi.seo_canonical_rows()
RETURNS TABLE(slug text,entity_type text,updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' SET work_mem='16MB' AS $$
 WITH candidates AS MATERIALIZED (
  SELECT l.slug,l.entity_type,coalesce(l.updated_at,l.created_at) updated_at,
   k.name_key nname,k.city_key,k.region_key,k.country_key,k.address_key,
   (((l.address IS NOT NULL)::int)+((l.phone IS NOT NULL)::int)+((l.website IS NOT NULL)::int)+((l.latitude IS NOT NULL)::int)+((l.description IS NOT NULL)::int)) completeness,
   (l.slug ~ '-[0-9a-f]{6}$')::int ugly
  FROM zoi.listings l JOIN zoi.seo_identity_keys k ON k.listing_id=l.id
  WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
   AND coalesce(l.marketplace_status,'')<>'hidden'
   AND nullif(btrim(l.slug),'') IS NOT NULL AND nullif(btrim(l.name),'') IS NOT NULL
   AND (l.city IS NOT NULL OR l.address IS NOT NULL OR l.website IS NOT NULL)
 ), canonical AS (
  SELECT DISTINCT ON(nname,city_key,region_key,country_key,address_key,entity_type) slug,entity_type,updated_at
  FROM candidates ORDER BY nname,city_key,region_key,country_key,address_key,entity_type,completeness DESC,ugly,updated_at DESC,slug
 ) SELECT slug,entity_type,updated_at FROM canonical;
$$;
ANALYZE zoi.seo_identity_keys;
COMMIT;
