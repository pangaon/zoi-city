begin;
set local lock_timeout='5s';set local statement_timeout='30s';
-- Canonicalize distinct country spellings once, not each of tens of thousands of rows.
create or replace function public.explore_countries()
returns table(country text,listings bigint,regions bigint,cities bigint)
language sql stable security definer set search_path='' as $$
 with names as materialized (select distinct l.country from zoi.listings l where l.publish_status='published' and l.moderation_status in ('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden' and nullif(l.country,'') is not null),
 canonical as materialized (select country as original,zoi.geo_country_canon(country) as name from names)
 select c.name,count(*),count(distinct l.region),count(distinct l.city)
 from zoi.listings l join canonical c on c.original=l.country
 where l.publish_status='published' and l.moderation_status in ('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden' and c.name is not null
 group by c.name order by count(*) desc,c.name;
$$;
create or replace function public.explore_place_listings(p_country text default null,p_region text default null,p_city text default null,p_category text default null,p_limit integer default 60,p_offset integer default 0)
returns jsonb language sql stable security definer set search_path='' as $$
 with country_filter as materialized (select coalesce(zoi.geo_country_canon(p_country),p_country) as pattern), country_names as materialized (
  select distinct country from zoi.listings where nullif(p_country,'') is not null and publish_status='published' and moderation_status in ('clean','cleared') and coalesce(marketplace_status,'')<>'hidden'
 ), matched_countries as materialized (select country from country_names cross join country_filter where zoi.geo_country_canon(country) ilike country_filter.pattern),
 eligible as materialized (
  select l.id,l.name,l.verification_status,l.trust_score
  from zoi.listings l left join zoi.categories c on c.id=l.primary_category_id
  where l.publish_status='published' and l.moderation_status in ('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden'
   and (nullif(p_country,'') is null or l.country in (select country from matched_countries))
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
   left(coalesce(nullif(l.description,''),nullif(l.profile->>'description',''),nullif(l.profile->'_enrich'->>'description',''),''),150) as description,
   l.latitude,l.longitude,
   coalesce(nullif(l.photo_url,''),nullif(l.profile->>'photo_url',''),nullif(l.profile->>'logo_url',''),nullif(l.profile->'_enrich'->>'photo_url',''),nullif(l.profile->'_enrich'->>'logo_url',''),nullif(l.profile->'_enrich'->'fields'->>'logo','')) as photo,
   l.verification_status,(p.verification_status='verified') as _verified,p.trust_score as _trust
   from page p join zoi.listings l on l.id=p.id left join zoi.categories c on c.id=l.primary_category_id
  )r),'[]'::jsonb));
$$;
revoke all on function public.explore_countries(),public.explore_place_listings(text,text,text,text,integer,integer) from public;
grant execute on function public.explore_countries(),public.explore_place_listings(text,text,text,text,integer,integer) to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
