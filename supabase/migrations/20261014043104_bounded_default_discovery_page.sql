-- Preserve the original RPC and filtered paths; optimize only true blank global pages.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $guard$
DECLARE p pg_proc;
BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure('public.explore_search(text,text,text,text,integer,integer,text)');
 IF p.oid IS NULL OR md5(pg_get_functiondef(p.oid))<>'f5b9d07ea1653f23b47eb7f80da52721'
  OR p.proowner<>'postgres'::regrole
  OR p.proacl IS DISTINCT FROM '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]
  OR NOT EXISTS (SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('zoi.listings_public_global_rank_idx') AND indisvalid AND indisready)
  OR to_regclass('zoi.listings_public_default_page_idx') IS NOT NULL
  OR to_regprocedure('zoi.explore_search_before_default_page(text,text,text,text,integer,integer,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'default_discovery_prerequisite_changed';END IF;
END
$guard$;
CREATE INDEX listings_public_default_page_idx ON zoi.listings
 ((verification_status='verified') DESC,trust_score DESC NULLS LAST,name,id)
 INCLUDE(verification_status,entity_type,city,country)
 WHERE publish_status='published' AND moderation_status IN('clean','cleared') AND coalesce(marketplace_status,'')<>'hidden';
CREATE FUNCTION zoi.explore_default_page(p_limit integer,p_offset integer) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' SET plan_cache_mode='force_custom_plan' AS $page$
 WITH page AS MATERIALIZED (
  SELECT candidate.id,candidate.name,candidate.verification_status,candidate.trust_score,0 AS name_relevance
  FROM zoi.listings candidate
  CROSS JOIN LATERAL (
   SELECT duplicate.id FROM zoi.listings duplicate
   WHERE duplicate.publish_status='published' AND duplicate.moderation_status IN ('clean','cleared') AND coalesce(duplicate.marketplace_status,'')<>'hidden'
    AND lower(trim(coalesce(duplicate.name,'')))=lower(trim(coalesce(candidate.name,'')))
    AND lower(trim(coalesce(duplicate.city,'')))=lower(trim(coalesce(candidate.city,'')))
    AND lower(trim(coalesce(zoi.geo_country_canon(duplicate.country),'')))=lower(trim(coalesce(zoi.geo_country_canon(candidate.country),'')))
   ORDER BY (duplicate.verification_status='verified') DESC,duplicate.trust_score DESC NULLS LAST,
    CASE duplicate.entity_type WHEN 'creator' THEN 0 WHEN 'artist' THEN 1 WHEN 'business' THEN 2 ELSE 3 END,
    duplicate.name,duplicate.id
   LIMIT 1
  ) winner
  WHERE candidate.publish_status='published' AND candidate.moderation_status IN ('clean','cleared') AND coalesce(candidate.marketplace_status,'')<>'hidden' AND winner.id=candidate.id
  ORDER BY (candidate.verification_status='verified') DESC,candidate.trust_score DESC NULLS LAST,candidate.name,candidate.id
  LIMIT least(greatest(p_limit,1),48) OFFSET greatest(p_offset,0)
 )
 SELECT coalesce(jsonb_agg(to_jsonb(r)-'_sort_verified'-'_sort_trust'-'_sort_relevance'
  ORDER BY r._sort_relevance,r._sort_verified DESC,r._sort_trust DESC NULLS LAST,r.name,r.id),'[]'::jsonb)
 FROM (
  SELECT l.id,l.slug,l.name,
   zoi.public_listing_card_description(l.entity_type,card.media_input) AS description,
   card.media_input,
   c.label_en AS category,l.entity_type,l.city,zoi.geo_country_canon(l.country) AS country,
   l.region,l.region_code,l.region_native,
   '/'||replace(l.entity_type,'travel_place','travel-place')||'/'||l.slug AS path,
   l.verification_status,l.rating,
   zoi.public_listing_card_photo(card.media_input) AS photo_url,
   CASE WHEN l.profile->>'hero_kind'='event_poster' AND zoi.public_listing_card_photo(card.media_input)=l.profile->>'hero_url' THEN 'event_poster' ELSE NULL END AS image_kind,
   (l.owner_workspace_id IS NULL AND coalesce(l.claim_status,'unclaimed') NOT IN ('claimed','approved')) AS claimable,
   page.name_relevance AS _sort_relevance,(page.verification_status='verified') AS _sort_verified,page.trust_score AS _sort_trust
  FROM page JOIN zoi.listings l ON l.id=page.id
  CROSS JOIN LATERAL (SELECT zoi.public_listing_card_input(l.id,l.website,l.photo_url,l.description,l.profile) AS media_input OFFSET 0) card
  LEFT JOIN zoi.categories c ON c.id=l.primary_category_id
 ) r;
$page$;
REVOKE ALL ON FUNCTION zoi.explore_default_page(integer,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION public.explore_search(text,text,text,text,integer,integer,text) RENAME TO explore_search_before_default_page;
ALTER FUNCTION public.explore_search_before_default_page(text,text,text,text,integer,integer,text) SET SCHEMA zoi;
REVOKE ALL ON FUNCTION zoi.explore_search_before_default_page(text,text,text,text,integer,integer,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.explore_search(p_q text DEFAULT NULL,p_type text DEFAULT NULL,p_city text DEFAULT NULL,p_country text DEFAULT NULL,p_limit integer DEFAULT 24,p_offset integer DEFAULT 0,p_region text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' SET plan_cache_mode='force_custom_plan' AS $function$
BEGIN
 -- Keep large-offset work on the original set-based query; the indexed probe
 -- path improves initial discovery without making deep paging more expensive.
 IF lower(btrim(coalesce(p_q,'')))='' AND coalesce(p_type,'')='' AND coalesce(p_city,'')='' AND coalesce(p_country,'')='' AND coalesce(p_region,'')='' AND greatest(p_offset,0)<=240 THEN
  RETURN zoi.explore_default_page(p_limit,p_offset);
 END IF;
 RETURN zoi.explore_search_before_default_page(p_q,p_type,p_city,p_country,p_limit,p_offset,p_region);
END;
$function$;
REVOKE ALL ON FUNCTION public.explore_search(text,text,text,text,integer,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.explore_search(text,text,text,text,integer,integer,text) TO anon,authenticated,service_role;
COMMIT;
