-- Let scoped place candidates read their filter/ranking fields from an index.
BEGIN;
SET LOCAL lock_timeout='3s';
CREATE INDEX listings_public_place_candidates_idx ON zoi.listings
(country,region,city,primary_category_id)
INCLUDE (id,name,verification_status,trust_score,region_native,region_code)
WHERE publish_status='published' AND moderation_status IN ('clean','cleared')
AND coalesce(marketplace_status,'')<>'hidden';
COMMIT;
