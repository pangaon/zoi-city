BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF md5(pg_get_functiondef('public.geography_reviewed_point(uuid)'::regprocedure)) IS DISTINCT FROM '91f7e4d96519f9a4bb0800a25e1c9e65' OR NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.geography_reviewed_point(uuid)'::regprocedure AND pg_get_userbyid(p.proowner)='postgres' AND p.proacl::text='{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}') THEN RAISE EXCEPTION 'reviewed_point_public_contract_changed';END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public.geography_reviewed_point(p_listing uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object('listing_id',l.id,'request_id',r.request_id,
 'latitude',l.latitude,'longitude',l.longitude,'precision',l.geo_precision)
 FROM zoi.listings l JOIN zoi.geography_reviews r ON r.listing_id=l.id
 WHERE l.id=p_listing AND l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
 AND l.marketplace_status IS DISTINCT FROM 'hidden'
 AND l.duplicate_status <> 'confirmed_duplicate'
 AND l.owner_user_id IS NULL AND l.owner_workspace_id IS NULL
 AND r.reverted_at IS NULL AND r.after_fingerprint=zoi.geography_fingerprint(l)
 AND l.profile->'_geo'->>'request_id'=r.request_id::text
 AND r.receipt->>'listing_id'=l.id::text AND r.receipt->>'request_id'=r.request_id::text
 AND r.receipt->'latitude'=to_jsonb(l.latitude) AND r.receipt->'longitude'=to_jsonb(l.longitude)
 AND r.receipt->>'precision'=l.geo_precision AND l.geo_precision='street'
 ORDER BY r.created_at DESC LIMIT 1
$function$

;
NOTIFY pgrst,'reload schema';
COMMIT;
