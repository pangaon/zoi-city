-- Keep category/location hub cards aligned with the canonical directory contract.
create or replace function public.explore_place_listings(
  p_country text default null, p_region text default null, p_city text default null,
  p_category text default null, p_limit integer default 60, p_offset integer default 0)
returns jsonb
language sql stable security definer set search_path to 'zoi','public'
as $function$
  select jsonb_build_object(
    'total', (select count(*) from zoi.listings l
               left join zoi.categories c on c.id=l.primary_category_id
              where l.publish_status='published'
                and (p_country is null or p_country='' or l.country ilike p_country)
                and (p_region is null or p_region='' or l.region ilike p_region
                     or l.region_native ilike p_region or upper(l.region_code)=upper(p_region))
                and (p_city is null or p_city='' or l.city ilike p_city)
                and (p_category is null or p_category='' or c.slug=p_category)),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r)) from (
        select l.slug, l.name, l.entity_type, l.city, l.region, l.country,
               c.slug as category_slug, coalesce(c.label_en,c.slug) as category,
               left(coalesce(nullif(l.description,''), nullif(l.profile ->> 'description',''), nullif(l.profile -> '_enrich' ->> 'description',''), ''),150) as description,
               l.latitude, l.longitude,
               coalesce(nullif(l.photo_url,''), nullif(l.profile ->> 'photo_url',''), nullif(l.profile ->> 'logo_url',''), nullif(l.profile -> '_enrich' ->> 'photo_url',''), nullif(l.profile -> '_enrich' ->> 'logo_url',''), nullif(l.profile -> '_enrich' -> 'fields' ->> 'logo','')) as photo,
               l.verification_status
          from zoi.listings l
          left join zoi.categories c on c.id=l.primary_category_id
         where l.publish_status='published'
           and (p_country is null or p_country='' or l.country ilike p_country)
           and (p_region is null or p_region='' or l.region ilike p_region
                or l.region_native ilike p_region or upper(l.region_code)=upper(p_region))
           and (p_city is null or p_city='' or l.city ilike p_city)
           and (p_category is null or p_category='' or c.slug=p_category)
         order by (l.verification_status='verified') desc,
                  coalesce(nullif(l.photo_url,''), nullif(l.profile -> '_enrich' ->> 'photo_url',''), nullif(l.profile -> '_enrich' ->> 'logo_url','')) is not null desc,
                  l.trust_score desc nulls last, l.name
         limit least(greatest(p_limit,1),120) offset greatest(p_offset,0)
      ) r), '[]'::jsonb));
$function$;

revoke all on function public.explore_place_listings(text,text,text,text,integer,integer) from public;
grant execute on function public.explore_place_listings(text,text,text,text,integer,integer) to anon, authenticated, service_role;
