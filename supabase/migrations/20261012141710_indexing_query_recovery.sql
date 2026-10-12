-- Recover anonymous sitemap and directory readers without raising role timeouts.
BEGIN;
SET LOCAL lock_timeout='3s';
CREATE OR REPLACE FUNCTION zoi.seo_text(p_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
AS $function$
 SELECT pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.lower(coalesce(p_value,'')), '[^[:alnum:]]+', ' ', 'g'));
$function$;

CREATE OR REPLACE FUNCTION zoi.seo_name(p_name text, p_city text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE PARALLEL SAFE
AS $function$
DECLARE n text:=zoi.seo_text(p_name); c text:=zoi.seo_text(p_city);
BEGIN
 IF c<>'' AND pg_catalog.length(n)>pg_catalog.length(c)+1 AND pg_catalog.right(n,pg_catalog.length(c)+1)=' '||c THEN
  RETURN pg_catalog.left(n,pg_catalog.length(n)-pg_catalog.length(c)-1);
 END IF;
 RETURN n;
END;
$function$;

CREATE OR REPLACE FUNCTION zoi.seo_canonical_rows()
 RETURNS TABLE(slug text, entity_type text, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET work_mem TO '16MB'
AS $function$
 WITH candidates AS MATERIALIZED (
  SELECT l.slug,l.entity_type,coalesce(l.updated_at,l.created_at) updated_at,
   zoi.seo_name(l.name,l.city) nname,zoi.seo_text(l.city) city_key,zoi.seo_text(l.region) region_key,
   zoi.seo_text(l.country) country_key,zoi.seo_text(l.address) address_key,
   (((l.address IS NOT NULL)::int)+((l.phone IS NOT NULL)::int)+((l.website IS NOT NULL)::int)+((l.latitude IS NOT NULL)::int)+((l.description IS NOT NULL)::int)) completeness,
   (l.slug ~ '-[0-9a-f]{6}$')::int ugly
  FROM zoi.listings l
  WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden'
   AND nullif(btrim(l.slug),'') IS NOT NULL AND nullif(btrim(l.name),'') IS NOT NULL
   AND (l.city IS NOT NULL OR l.address IS NOT NULL OR l.website IS NOT NULL)
 ), canonical AS (
  SELECT DISTINCT ON(nname,city_key,region_key,country_key,address_key,entity_type) slug,entity_type,updated_at
  FROM candidates ORDER BY nname,city_key,region_key,country_key,address_key,entity_type,completeness DESC,ugly,updated_at DESC,slug
 ) SELECT slug,entity_type,updated_at FROM canonical;
$function$;

CREATE OR REPLACE FUNCTION public.explore_categories(p_country text DEFAULT NULL::text, p_region text DEFAULT NULL::text, p_city text DEFAULT NULL::text)
 RETURNS TABLE(category_slug text, label text, entity_type text, listings bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
  SELECT c.slug, coalesce(c.label_en, c.slug), max(l.entity_type), count(*)
    FROM zoi.listings l
    JOIN zoi.categories c ON c.id = l.primary_category_id
   WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden'
     AND (p_country IS NULL OR p_country='' OR l.country ILIKE p_country)
     AND (p_region  IS NULL OR p_region=''  OR l.region ILIKE p_region
          OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))
     AND (p_city    IS NULL OR p_city=''    OR l.city ILIKE p_city)
   GROUP BY c.slug, c.label_en ORDER BY count(*) DESC;
$function$;

CREATE OR REPLACE FUNCTION public.explore_region_categories(p_min integer DEFAULT 3)
 RETURNS TABLE(country text, region text, category_slug text, listings bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
  SELECT l.country, l.region, c.slug, count(*)
    FROM zoi.listings l
    JOIN zoi.categories c ON c.id = l.primary_category_id
   WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden'
     AND l.region IS NOT NULL AND l.country IS NOT NULL
   GROUP BY l.country, l.region, c.slug
  HAVING count(*) >= greatest(p_min, 1)
   ORDER BY count(*) DESC;
$function$;

-- Parameter-bound EXECUTE selects a plan for the actual scope; no SQL interpolation.
CREATE OR REPLACE FUNCTION public.explore_place_listings(p_country text DEFAULT NULL::text, p_region text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_limit integer DEFAULT 60, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 EXECUTE $query$with country_filter as materialized (select coalesce(zoi.geo_country_canon($1),$1) as pattern), country_names as materialized (
  select distinct country from zoi.listings where nullif($1,'') is not null and publish_status='published' and moderation_status in ('clean','cleared') and coalesce(marketplace_status,'')<>'hidden'
 ), matched_countries as materialized (select country from country_names cross join country_filter where zoi.geo_country_canon(country) ilike country_filter.pattern),
 eligible as materialized (
  select l.id,l.name,l.verification_status,l.trust_score
  from zoi.listings l left join zoi.categories c on c.id=l.primary_category_id
  where l.publish_status='published' and l.moderation_status in ('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden'
   and nullif($1,'') is null
   and (nullif($2,'') is null or l.region ilike $2 or l.region_native ilike $2 or upper(l.region_code)=upper($2))
   and (nullif($3,'') is null or l.city ilike $3)
   and (nullif($4,'') is null or c.slug=$4)

 union all
  select l.id,l.name,l.verification_status,l.trust_score
  from matched_countries mc join zoi.listings l on l.country=mc.country left join zoi.categories c on c.id=l.primary_category_id
  where l.publish_status='published' and l.moderation_status in ('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden'
   and nullif($1,'') is not null
   and (nullif($2,'') is null or l.region ilike $2 or l.region_native ilike $2 or upper(l.region_code)=upper($2))
   and (nullif($3,'') is null or l.city ilike $3)
   and (nullif($4,'') is null or c.slug=$4)
 ), page as materialized (
  select * from eligible order by (verification_status='verified') desc,trust_score desc nulls last,name,id
  limit least(greatest(coalesce($5,60),1),120) offset greatest(coalesce($6,0),0)
 )
 select jsonb_build_object('total',(select count(*) from eligible),'rows',coalesce((
  select jsonb_agg(to_jsonb(r)-'_verified'-'_trust' order by r._verified desc,r._trust desc nulls last,r.name,r.id)
  from (select l.id,l.slug,l.name,l.entity_type,l.city,l.region,zoi.geo_country_canon(l.country) as country,c.slug as category_slug,coalesce(c.label_en,c.slug) as category,
   left(zoi.public_listing_card_description(l.entity_type,card.input),150) as description,
   l.latitude,l.longitude,
   zoi.public_listing_card_photo(card.input) as photo,
   l.verification_status,(p.verification_status='verified') as _verified,p.trust_score as _trust
   from page p join zoi.listings l on l.id=p.id left join zoi.categories c on c.id=l.primary_category_id
   cross join lateral (select zoi.public_listing_card_input(l.id,l.website,l.photo_url,l.description,l.profile) as input offset 0)card
  )r),'[]'::jsonb))$query$ INTO result USING p_country,p_region,p_city,p_category,p_limit,p_offset;
 RETURN result;
END
$function$;

COMMIT;
