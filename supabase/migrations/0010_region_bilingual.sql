-- Greek regions, in both languages.
--
-- OpenStreetMap returns the native administrative name — "Περιφέρεια Αττικής".
-- Correct, and useless to a diaspora Greek in Chicago typing "attica", which
-- returned 6 results while "north carolina" returned 47. The rest of the dataset
-- is in English, so region is normalised to English and the native name is kept
-- alongside it. Search matches either.
--
-- Also folds the legacy values that were already in this column before today:
-- bare genitives ("Αττικής"), the invented macro-region "US West", and city
-- names sitting in a region field.

BEGIN;

ALTER TABLE zoi.listings ADD COLUMN IF NOT EXISTS region_native text;
COMMENT ON COLUMN zoi.listings.region_native IS
  'The region name in its own language, where that differs from the English form.';

-- Keep the native name, set the English one.
WITH map(native, en) AS (VALUES
  ('Περιφέρεια Αττικής','Attica'),
  ('Περιφέρεια Κεντρικής Μακεδονίας','Central Macedonia'),
  ('Περιφέρεια Νοτίου Αιγαίου','South Aegean'),
  ('Περιφέρεια Βόρειου Αιγαίου','North Aegean'),
  ('Περιφέρεια Κρήτης','Crete'),
  ('Περιφέρεια Θεσσαλίας','Thessaly'),
  ('Περιφέρεια Πελοποννήσου','Peloponnese'),
  ('Περιφέρεια Δυτικής Ελλάδας','Western Greece'),
  ('Περιφέρεια Ανατολικής Μακεδονίας και Θράκης','Eastern Macedonia and Thrace'),
  ('Περιφέρεια Στερεάς Ελλάδας','Central Greece'),
  ('Περιφέρεια Ιονίων Νήσων','Ionian Islands'),
  ('Περιφέρεια Ηπείρου','Epirus'),
  ('Περιφέρεια Δυτικής Μακεδονίας','Western Macedonia'),
  ('Αυτόνομη Μοναστική Πολιτεία Αγίου Όρους','Mount Athos')
)
UPDATE zoi.listings l
   SET region_native = m.native,
       region        = m.en
  FROM map m
 WHERE l.region = m.native;

-- Legacy junk that predates today: a bare genitive is the same region as its
-- formal name, so fold it in rather than leaving two values for one place.
UPDATE zoi.listings l SET region = 'Attica',            region_native = 'Αττικής'      WHERE l.region = 'Αττικής';
UPDATE zoi.listings l SET region = 'Central Macedonia', region_native = 'Θεσσαλονίκης' WHERE l.region = 'Θεσσαλονίκης';
UPDATE zoi.listings l SET region = 'South Aegean',      region_native = 'Δωδεκανήσου'  WHERE l.region = 'Δωδεκανήσου';
UPDATE zoi.listings l SET region = 'Crete',             region_native = 'Ηρακλείου'    WHERE l.region = 'Ηρακλείου';
UPDATE zoi.listings l SET region = 'Western Greece',    region_native = 'Αχαΐας'       WHERE l.region = 'Αχαΐας';

-- "US West" is not a state. A listing whose region is a macro-region or its own
-- city name has no region: say so rather than keep a wrong answer.
UPDATE zoi.listings l
   SET region = NULL, region_code = NULL
 WHERE l.region IN ('US West','US East','US Midwest','US South','Greater Toronto')
    OR lower(l.region) = lower(l.city);

CREATE INDEX IF NOT EXISTS idx_listings_region_native
  ON zoi.listings (lower(region_native)) WHERE region_native IS NOT NULL;

-- Search matches the English name, the native name, or the ISO code.
CREATE OR REPLACE FUNCTION public.explore_search(
  p_q text DEFAULT NULL, p_type text DEFAULT NULL, p_city text DEFAULT NULL,
  p_country text DEFAULT NULL, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0,
  p_region text DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'zoi','public'
AS $function$
  SELECT COALESCE(jsonb_agg(to_jsonb(r)),'[]'::jsonb) FROM (
    SELECT l.id, l.slug, l.name,
      left(COALESCE(l.description,''),170) AS description,
      c.label_en AS category, l.entity_type, l.city, l.country,
      l.region, l.region_code, l.region_native,
      COALESCE(l.canonical_path,
               '/' || replace(l.entity_type,'travel_place','travel-place') || '/' || l.slug) AS path,
      l.verification_status, l.rating, l.photo_url,
      (l.owner_workspace_id IS NULL AND COALESCE(l.claim_status,'unclaimed') NOT IN ('claimed','approved')) AS claimable
    FROM zoi.listings l
    LEFT JOIN zoi.categories c ON c.id=l.primary_category_id
    WHERE l.publish_status='published'
      AND (p_q IS NULL OR p_q='' OR l.search_tsv @@ plainto_tsquery('simple', p_q)
           OR l.name ILIKE '%'||p_q||'%'
           OR l.region ILIKE '%'||p_q||'%'
           OR l.region_native ILIKE '%'||p_q||'%')
      AND (p_type    IS NULL OR p_type=''    OR l.entity_type=p_type)
      AND (p_city    IS NULL OR p_city=''    OR l.city ILIKE p_city)
      AND (p_country IS NULL OR p_country='' OR l.country ILIKE p_country)
      AND (p_region  IS NULL OR p_region=''  OR l.region ILIKE p_region
           OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))
    ORDER BY (l.verification_status='verified') DESC, l.trust_score DESC NULLS LAST, l.name
    LIMIT LEAST(GREATEST(p_limit,1),48) OFFSET GREATEST(p_offset,0)
  ) r;
$function$;

COMMIT;
