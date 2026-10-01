-- Bound literal-city search before expensive global text matching. No ranking/projection change.
-- Preserve deployed visibility/dedupe/filter/plan settings; rank name relevance before pagination.
-- Literal substring matching prevents %/_ queries expanding into wildcard listings.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE INDEX listings_public_locality_name_idx ON zoi.listings
 (lower(city),lower(zoi.geo_country_canon(country)))
 WHERE publish_status='published' AND moderation_status IN ('clean','cleared')
 AND coalesce(marketplace_status,'')<>'hidden';
CREATE OR REPLACE FUNCTION public.explore_search(p_q text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0, p_region text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET plan_cache_mode TO 'force_custom_plan'
AS $function$
DECLARE v_q text:=lower(btrim(coalesce(p_q,'')));
 v_pattern text:='%'||replace(replace(replace(v_q,chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_')||'%';
BEGIN
 -- Only literal nonempty city filters take the bounded locality-first path.
 -- Pattern and escape semantics continue through the original global query.
 IF p_city IS NOT NULL AND p_city<>'' AND strpos(p_city,'%')=0
  AND strpos(p_city,'_')=0 AND strpos(p_city,chr(92))=0 THEN
 RETURN (WITH locality AS MATERIALIZED (
  SELECT l.id,l.name,l.verification_status,l.trust_score,l.city,l.country,l.entity_type,
   l.search_tsv,l.region,l.region_native,l.region_code
  FROM zoi.listings l
  WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
   AND coalesce(l.marketplace_status,'')<>'hidden'
   AND lower(l.city)=lower(p_city) AND l.city ILIKE p_city
   AND (p_type IS NULL OR p_type='' OR l.entity_type=p_type)
   AND (p_country IS NULL OR p_country='' OR zoi.geo_country_canon(l.country) ILIKE p_country)
   AND (p_country IS NULL OR p_country='' OR strpos(p_country,'%')>0 OR strpos(p_country,'_')>0
    OR strpos(p_country,chr(92))>0 OR lower(zoi.geo_country_canon(l.country))=lower(p_country))
   AND (p_region IS NULL OR p_region='' OR l.region ILIKE p_region
    OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))
 ), ranked AS NOT MATERIALIZED (
  SELECT l.id,l.name,l.verification_status,l.trust_score,
   CASE WHEN v_q='' THEN 0 WHEN lower(btrim(l.name))=v_q THEN 0
    WHEN left(lower(btrim(l.name)),length(v_q))=v_q THEN 1
    WHEN v_q=ANY(regexp_split_to_array(lower(l.name),'[^[:alnum:]_]+')) THEN 2
    WHEN strpos(lower(l.name),v_q)>0 THEN 3 ELSE 4 END AS name_relevance,
   row_number() OVER (
    PARTITION BY lower(trim(coalesce(l.name,''))),lower(trim(coalesce(l.city,''))),
     lower(trim(coalesce(zoi.geo_country_canon(l.country),'')))
    ORDER BY (l.verification_status='verified') DESC,l.trust_score DESC NULLS LAST,
     CASE l.entity_type WHEN 'creator' THEN 0 WHEN 'artist' THEN 1 WHEN 'business' THEN 2 ELSE 3 END,
     l.name,l.id
   ) AS dedupe_rank
  FROM locality l
  WHERE (v_q='' OR l.search_tsv @@ plainto_tsquery('simple',v_q)
    OR lower(l.name) LIKE v_pattern OR lower(l.region) LIKE v_pattern
    OR lower(l.region_native) LIKE v_pattern)
   AND (p_type IS NULL OR p_type='' OR l.entity_type=p_type)
   AND (p_city IS NULL OR p_city='' OR l.city ILIKE p_city)
   AND (p_country IS NULL OR p_country='' OR zoi.geo_country_canon(l.country) ILIKE p_country)
   AND (p_region IS NULL OR p_region='' OR l.region ILIKE p_region
    OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))
 ), page AS MATERIALIZED (
  SELECT id,name,verification_status,trust_score,name_relevance
  FROM ranked WHERE dedupe_rank=1
  ORDER BY name_relevance,(verification_status='verified') DESC,trust_score DESC NULLS LAST,name,id
  LIMIT least(greatest(p_limit,1),48) OFFSET greatest(p_offset,0)
 )
 SELECT coalesce(jsonb_agg(to_jsonb(r)-'_sort_verified'-'_sort_trust'-'_sort_relevance'
  ORDER BY r._sort_relevance,r._sort_verified DESC,r._sort_trust DESC NULLS LAST,r.name,r.id),'[]'::jsonb)
 FROM (
  SELECT l.id,l.slug,l.name,
   left(coalesce(nullif(l.description,''),nullif(l.profile->>'description',''),
    nullif(l.profile->'_enrich'->>'description',''),''),170) AS description,
   c.label_en AS category,l.entity_type,l.city,zoi.geo_country_canon(l.country) AS country,
   l.region,l.region_code,l.region_native,
   '/'||replace(l.entity_type,'travel_place','travel-place')||'/'||l.slug AS path,
   l.verification_status,l.rating,
   coalesce(nullif(l.photo_url,''),nullif(l.profile->>'photo_url',''),nullif(l.profile->>'logo_url',''),
    nullif(l.profile->'_enrich'->>'photo_url',''),nullif(l.profile->'_enrich'->>'logo_url',''),
    nullif(l.profile->'_enrich'->'fields'->>'photo_url',''),
    nullif(l.profile->'_enrich'->'fields'->>'logo','')) AS photo_url,
   CASE WHEN l.profile->>'hero_kind'='event_poster' AND coalesce(nullif(l.photo_url,''),nullif(l.profile->>'photo_url',''),nullif(l.profile->>'logo_url',''),
    nullif(l.profile->'_enrich'->>'photo_url',''),nullif(l.profile->'_enrich'->>'logo_url',''),
    nullif(l.profile->'_enrich'->'fields'->>'photo_url',''),
    nullif(l.profile->'_enrich'->'fields'->>'logo',''))=l.profile->>'hero_url' THEN 'event_poster' ELSE NULL END AS image_kind,
   (l.owner_workspace_id IS NULL AND coalesce(l.claim_status,'unclaimed') NOT IN ('claimed','approved')) AS claimable,
   page.name_relevance AS _sort_relevance,(page.verification_status='verified') AS _sort_verified,page.trust_score AS _sort_trust
  FROM page JOIN zoi.listings l ON l.id=page.id
  LEFT JOIN zoi.categories c ON c.id=l.primary_category_id
 ) r);
 END IF;
 RETURN (WITH ranked AS NOT MATERIALIZED (
  SELECT l.id,l.name,l.verification_status,l.trust_score,
   CASE WHEN v_q='' THEN 0 WHEN lower(btrim(l.name))=v_q THEN 0
    WHEN left(lower(btrim(l.name)),length(v_q))=v_q THEN 1
    WHEN v_q=ANY(regexp_split_to_array(lower(l.name),'[^[:alnum:]_]+')) THEN 2
    WHEN strpos(lower(l.name),v_q)>0 THEN 3 ELSE 4 END AS name_relevance,
   row_number() OVER (
    PARTITION BY lower(trim(coalesce(l.name,''))),lower(trim(coalesce(l.city,''))),
     lower(trim(coalesce(zoi.geo_country_canon(l.country),'')))
    ORDER BY (l.verification_status='verified') DESC,l.trust_score DESC NULLS LAST,
     CASE l.entity_type WHEN 'creator' THEN 0 WHEN 'artist' THEN 1 WHEN 'business' THEN 2 ELSE 3 END,
     l.name,l.id
   ) AS dedupe_rank
  FROM zoi.listings l
  WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
   AND coalesce(l.marketplace_status,'')<>'hidden'
   AND (v_q='' OR l.search_tsv @@ plainto_tsquery('simple',v_q)
    OR lower(l.name) LIKE v_pattern OR lower(l.region) LIKE v_pattern
    OR lower(l.region_native) LIKE v_pattern)
   AND (p_type IS NULL OR p_type='' OR l.entity_type=p_type)
   AND (p_city IS NULL OR p_city='' OR l.city ILIKE p_city)
   AND (p_country IS NULL OR p_country='' OR zoi.geo_country_canon(l.country) ILIKE p_country)
   AND (p_region IS NULL OR p_region='' OR l.region ILIKE p_region
    OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))
 ), page AS MATERIALIZED (
  SELECT id,name,verification_status,trust_score,name_relevance
  FROM ranked WHERE dedupe_rank=1
  ORDER BY name_relevance,(verification_status='verified') DESC,trust_score DESC NULLS LAST,name,id
  LIMIT least(greatest(p_limit,1),48) OFFSET greatest(p_offset,0)
 )
 SELECT coalesce(jsonb_agg(to_jsonb(r)-'_sort_verified'-'_sort_trust'-'_sort_relevance'
  ORDER BY r._sort_relevance,r._sort_verified DESC,r._sort_trust DESC NULLS LAST,r.name,r.id),'[]'::jsonb)
 FROM (
  SELECT l.id,l.slug,l.name,
   left(coalesce(nullif(l.description,''),nullif(l.profile->>'description',''),
    nullif(l.profile->'_enrich'->>'description',''),''),170) AS description,
   c.label_en AS category,l.entity_type,l.city,zoi.geo_country_canon(l.country) AS country,
   l.region,l.region_code,l.region_native,
   '/'||replace(l.entity_type,'travel_place','travel-place')||'/'||l.slug AS path,
   l.verification_status,l.rating,
   coalesce(nullif(l.photo_url,''),nullif(l.profile->>'photo_url',''),nullif(l.profile->>'logo_url',''),
    nullif(l.profile->'_enrich'->>'photo_url',''),nullif(l.profile->'_enrich'->>'logo_url',''),
    nullif(l.profile->'_enrich'->'fields'->>'photo_url',''),
    nullif(l.profile->'_enrich'->'fields'->>'logo','')) AS photo_url,
   CASE WHEN l.profile->>'hero_kind'='event_poster' AND coalesce(nullif(l.photo_url,''),nullif(l.profile->>'photo_url',''),nullif(l.profile->>'logo_url',''),
    nullif(l.profile->'_enrich'->>'photo_url',''),nullif(l.profile->'_enrich'->>'logo_url',''),
    nullif(l.profile->'_enrich'->'fields'->>'photo_url',''),
    nullif(l.profile->'_enrich'->'fields'->>'logo',''))=l.profile->>'hero_url' THEN 'event_poster' ELSE NULL END AS image_kind,
   (l.owner_workspace_id IS NULL AND coalesce(l.claim_status,'unclaimed') NOT IN ('claimed','approved')) AS claimable,
   page.name_relevance AS _sort_relevance,(page.verification_status='verified') AS _sort_verified,page.trust_score AS _sort_trust
  FROM page JOIN zoi.listings l ON l.id=page.id
  LEFT JOIN zoi.categories c ON c.id=l.primary_category_id
 ) r);
END;
$function$;

NOTIFY pgrst,'reload schema';
COMMIT;
