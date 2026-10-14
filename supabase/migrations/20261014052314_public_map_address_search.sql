BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $guard$ BEGIN
 IF to_regprocedure('public.explore_map_address_search(text,text,text,text[],integer)') IS NOT NULL
 OR to_regclass('zoi.listings_public_address_trgm_idx') IS NOT NULL
 THEN RAISE EXCEPTION 'map_address_search_prerequisite_changed';END IF;
END $guard$;
CREATE INDEX listings_public_address_trgm_idx ON zoi.listings USING gin (lower(address) public.gin_trgm_ops)
 WHERE publish_status='published' AND moderation_status IN('clean','cleared') AND coalesce(marketplace_status,'')<>'hidden' AND nullif(btrim(address),'') IS NOT NULL;
-- Search published addresses across the entire public catalogue, including
-- unlocated profiles. This reader never supplies or infers map coordinates.
CREATE FUNCTION public.explore_map_address_search(p_q text,p_city text DEFAULT NULL,p_country text DEFAULT NULL,p_types text[] DEFAULT NULL,p_limit integer DEFAULT 32)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' SET plan_cache_mode='force_custom_plan' AS $search$
DECLARE term text:=lower(btrim(coalesce(p_q,'')));pattern text;
BEGIN
 IF length(term)<3 THEN RETURN '[]'::jsonb;END IF;
 IF length(term)>200 OR length(coalesce(p_city,''))>160 OR length(coalesce(p_country,''))>160
 OR cardinality(p_types)>32 OR EXISTS(SELECT 1 FROM unnest(p_types)t WHERE t IS NULL OR t!~'^[a-z][a-z_]{0,39}$')
 THEN RAISE EXCEPTION 'invalid_map_address_search';END IF;
 pattern:='%'||replace(replace(replace(term,chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_')||'%';
 RETURN (
  WITH matches AS (
   SELECT l.id,l.slug,l.name,l.entity_type,l.address,l.city,zoi.geo_country_canon(l.country) AS country,l.verification_status,l.trust_score,
    CASE WHEN lower(btrim(l.address))=term THEN 0 ELSE 1 END AS relevance,
    row_number() OVER(PARTITION BY lower(btrim(coalesce(l.name,''))),lower(btrim(coalesce(l.city,''))),lower(btrim(coalesce(zoi.geo_country_canon(l.country),''))),lower(btrim(l.address))
     ORDER BY (l.verification_status='verified') DESC,l.trust_score DESC NULLS LAST,
      CASE l.entity_type WHEN 'creator' THEN 0 WHEN 'artist' THEN 1 WHEN 'business' THEN 2 ELSE 3 END,l.name,l.id) AS duplicate_rank
   FROM zoi.listings l
   WHERE l.publish_status='published' AND l.moderation_status IN('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden'
    AND nullif(btrim(l.address),'') IS NOT NULL AND lower(l.address) LIKE pattern ESCAPE E'\\'
    AND (nullif(btrim(p_city),'') IS NULL OR lower(btrim(l.city))=lower(btrim(p_city)))
    AND (nullif(btrim(p_country),'') IS NULL OR lower(zoi.geo_country_canon(l.country))=lower(zoi.geo_country_canon(p_country)))
    AND (p_types IS NULL OR l.entity_type=ANY(p_types))
  ), page AS (
   SELECT * FROM matches WHERE duplicate_rank=1
   ORDER BY relevance,(verification_status='verified') DESC,trust_score DESC NULLS LAST,name,id LIMIT least(greatest(p_limit,1),32)
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'slug',slug,'name',name,'entity_type',entity_type,'address',address,'city',city,'country',country,'path','/p/'||slug)
    ORDER BY relevance,(verification_status='verified') DESC,trust_score DESC NULLS LAST,name,id),'[]'::jsonb) FROM page
 );
END $search$;
REVOKE ALL ON FUNCTION public.explore_map_address_search(text,text,text,text[],integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.explore_map_address_search(text,text,text,text[],integer) TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
