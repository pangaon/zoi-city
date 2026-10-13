-- Cover the category aggregate and its location filters without fetching the
-- wide listing heap; eligibility is identical to the public RPC predicate.
BEGIN;
SET LOCAL lock_timeout='3s';
CREATE INDEX listings_public_category_counts_idx ON zoi.listings
(primary_category_id,country,region,city) INCLUDE (region_native,region_code,entity_type)
WHERE publish_status='published' AND moderation_status IN ('clean','cleared')
AND coalesce(marketplace_status,'')<>'hidden';
COMMIT;
