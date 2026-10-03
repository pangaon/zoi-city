BEGIN;
SET LOCAL lock_timeout='3s';
DO $guard$
DECLARE f record; e record;
BEGIN
 FOR e IN SELECT * FROM (VALUES
 ('public.explore_place_listings(text,text,text,text,integer,integer)','26527f1ad65042427a5ad77e08b95eb9','postgres','{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}',true,'s','["search_path=\"\""]'),
 ('zoi.public_owner_content(uuid)','132a50666860f8dee5d4f33b3a3fdfa0','postgres','{postgres=X/postgres}',true,'s','["search_path=\"\""]'),
 ('zoi.public_listing_card_input(uuid,text,text,text,jsonb)','16c10d23ac9afd8c9bcde5d1d1ca7021','postgres','{postgres=X/postgres}',false,'s','["search_path=\"\""]'),
 ('zoi.public_listing_card_source_bound(jsonb)','02cc71fea32df26294be186d5cbceea0','postgres','{postgres=X/postgres}',false,'i','["search_path=\"\""]'),
 ('zoi.public_listing_card_description(text,jsonb)','04ad1df70e7dbca72fcadb45ad4b2d2e','postgres','{postgres=X/postgres}',false,'i','["search_path=\"\""]'),
 ('zoi.public_listing_card_image(text,boolean)','fe48dca6592b8916769e65d39139df0f','postgres','{postgres=X/postgres}',false,'i','["search_path=\"\""]'),
 ('zoi.public_listing_card_photo(jsonb)','fdbdd9f3d89bba2ac17fd81b9163f00f','postgres','{postgres=X/postgres}',false,'i','["search_path=\"\""]'),
 ('zoi.geo_country_canon(text)','a4610e0eee4af255cbc37d228b248be9','postgres',NULL,false,'i',NULL)
 ) AS expected(signature,definition_md5,owner_name,acl,definer,volatility,config) LOOP
  SELECT p.* INTO f FROM pg_proc p WHERE p.oid=to_regprocedure(e.signature);
  IF NOT FOUND OR md5(pg_get_functiondef(f.oid))<>e.definition_md5
   OR f.proowner::regrole::text IS DISTINCT FROM e.owner_name
   OR f.proacl::text IS DISTINCT FROM e.acl OR f.prosecdef IS DISTINCT FROM e.definer
   OR f.provolatile::text IS DISTINCT FROM e.volatility
   OR to_jsonb(f.proconfig) IS DISTINCT FROM e.config::jsonb
  THEN RAISE EXCEPTION 'place_reader_prerequisite_changed'; END IF;
 END LOOP;
END
$guard$;
CREATE OR REPLACE FUNCTION public.explore_place_listings(p_country text DEFAULT NULL::text, p_region text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_limit integer DEFAULT 60, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with country_filter as materialized (select coalesce(zoi.geo_country_canon(p_country),p_country) as pattern), country_names as materialized (
  select distinct country from zoi.listings where nullif(p_country,'') is not null and publish_status='published' and moderation_status in ('clean','cleared') and coalesce(marketplace_status,'')<>'hidden'
 ), matched_countries as materialized (select country from country_names cross join country_filter where zoi.geo_country_canon(country) ilike country_filter.pattern),
 eligible as materialized (
  select l.id,l.name,l.verification_status,l.trust_score
  from zoi.listings l left join zoi.categories c on c.id=l.primary_category_id
  where l.publish_status='published' and l.moderation_status in ('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden'
   and nullif(p_country,'') is null
   and (nullif(p_region,'') is null or l.region ilike p_region or l.region_native ilike p_region or upper(l.region_code)=upper(p_region))
   and (nullif(p_city,'') is null or l.city ilike p_city)
   and (nullif(p_category,'') is null or c.slug=p_category)

 union all
  select l.id,l.name,l.verification_status,l.trust_score
  from matched_countries mc join zoi.listings l on l.country=mc.country left join zoi.categories c on c.id=l.primary_category_id
  where l.publish_status='published' and l.moderation_status in ('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden'
   and nullif(p_country,'') is not null
   and (nullif(p_region,'') is null or l.region ilike p_region or l.region_native ilike p_region or upper(l.region_code)=upper(p_region))
   and (nullif(p_city,'') is null or l.city ilike p_city)
   and (nullif(p_category,'') is null or c.slug=p_category)
 ), page as materialized (
  select * from eligible order by (verification_status='verified') desc,trust_score desc nulls last,name,id
  limit least(greatest(coalesce(p_limit,60),1),120) offset greatest(coalesce(p_offset,0),0)
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
  )r),'[]'::jsonb));
$function$
;
COMMIT;
