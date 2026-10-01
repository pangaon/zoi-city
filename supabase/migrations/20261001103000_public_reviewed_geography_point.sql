BEGIN;
SET LOCAL lock_timeout='5s';
-- Only an unchanged, publicly visible independently reviewed row can expose its
-- immutable destination. The private report and review identity remain private.
CREATE FUNCTION public.geography_reviewed_point(p_listing uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('listing_id',l.id,'request_id',r.request_id,
   'latitude',l.latitude,'longitude',l.longitude,'precision',l.geo_precision)
 FROM zoi.listings l JOIN zoi.geography_reviews r ON r.listing_id=l.id
 WHERE l.id=p_listing AND l.publish_status='published' AND l.moderation_status='clean'
 AND l.marketplace_status IS DISTINCT FROM 'hidden'
 AND l.owner_user_id IS NULL AND l.owner_workspace_id IS NULL
 AND r.reverted_at IS NULL AND r.after_fingerprint=zoi.geography_fingerprint(l)
 AND l.profile->'_geo'->>'request_id'=r.request_id::text
 AND r.receipt->>'listing_id'=l.id::text
 AND r.receipt->>'request_id'=r.request_id::text
 AND r.receipt->'latitude'=to_jsonb(l.latitude)
 AND r.receipt->'longitude'=to_jsonb(l.longitude)
 AND r.receipt->>'precision'=l.geo_precision AND l.geo_precision='street'
 ORDER BY r.created_at DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.geography_reviewed_point(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.geography_reviewed_point(uuid) TO anon,authenticated,service_role;
COMMIT;
