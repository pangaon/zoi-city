-- Canonical geography read contract.
--
-- This migration does not merge or delete listings. It normalizes safe country
-- aliases at the public RPC boundary and excludes rows with no country from
-- country/region hub aggregates, preventing duplicate labels and /in// URLs.
-- The underlying records remain available for a reviewed data cleanup.

create or replace function zoi.geo_country_canon(p_raw text)
returns text
language sql
immutable
as $function$
  select case lower(nullif(trim(coalesce(p_raw, '')), ''))
    when 'us' then 'United States'
    when 'usa' then 'United States'
    when 'u.s.' then 'United States'
    when 'u.s.a.' then 'United States'
    when 'united states of america' then 'United States'
    when 'uk' then 'United Kingdom'
    when 'great britain' then 'United Kingdom'
    when 'gb' then 'United Kingdom'
    when 'uae' then 'United Arab Emirates'
    when 'gr' then 'Greece'
    when 'el' then 'Greece'
    when 'ca' then 'Canada'
    when 'au' then 'Australia'
    when 'nz' then 'New Zealand'
    when 'cy' then 'Cyprus'
    else nullif(trim(p_raw), '')
  end
$function$;

comment on function zoi.geo_country_canon(text) is
  'Canonical public country label. Read normalization only; does not mutate listing identity.';

create or replace function public.explore_countries()
returns table(country text, listings bigint, regions bigint, cities bigint)
language sql stable security definer set search_path to 'zoi','public'
as $function$
  select zoi.geo_country_canon(l.country), count(*), count(distinct l.region), count(distinct l.city)
    from zoi.listings l
   where l.publish_status='published'
     and zoi.geo_country_canon(l.country) is not null
   group by zoi.geo_country_canon(l.country)
   order by count(*) desc;
$function$;

create or replace function public.explore_regions(p_country text default null)
returns table(country text, region text, region_code text, listings bigint, cities bigint)
language sql stable security definer set search_path to 'zoi','public'
as $function$
  select zoi.geo_country_canon(l.country), l.region, max(l.region_code), count(*), count(distinct l.city)
    from zoi.listings l
   where l.publish_status='published'
     and zoi.geo_country_canon(l.country) is not null
     and l.region is not null and l.region <> ''
     and (p_country is null or p_country='' or zoi.geo_country_canon(l.country) ilike p_country)
   group by zoi.geo_country_canon(l.country), l.region
   order by count(*) desc;
$function$;

create or replace function public.explore_region_cities(p_country text default null, p_region text default null)
returns table(country text, region text, city text, listings bigint)
language sql stable security definer set search_path to 'zoi','public'
as $function$
  select zoi.geo_country_canon(l.country), l.region, l.city, count(*)
    from zoi.listings l
   where l.publish_status='published'
     and zoi.geo_country_canon(l.country) is not null
     and l.city is not null and l.city <> ''
     and (p_country is null or p_country='' or zoi.geo_country_canon(l.country) ilike p_country)
     and (p_region is null or p_region='' or l.region ilike p_region
          or l.region_native ilike p_region or upper(l.region_code)=upper(p_region))
   group by zoi.geo_country_canon(l.country), l.region, l.city
   order by count(*) desc;
$function$;

create or replace function public.explore_search(
  p_q text default null,
  p_type text default null,
  p_city text default null,
  p_country text default null,
  p_limit integer default 24,
  p_offset integer default 0,
  p_region text default null
) returns jsonb
language sql stable security definer set search_path to 'zoi','public'
as $function$
  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from (
    select id, slug, name, description, category, entity_type, city, country,
      region, region_code, region_native, path, verification_status, rating,
      photo_url, claimable
    from (
      select l.id, l.slug, l.name,
        left(coalesce(l.description,''),170) as description,
        c.label_en as category, l.entity_type, l.city,
        zoi.geo_country_canon(l.country) as country,
        l.region, l.region_code, l.region_native,
        coalesce(l.canonical_path,
          '/' || replace(l.entity_type,'travel_place','travel-place') || '/' || l.slug) as path,
        l.verification_status, l.rating,
        coalesce(
          nullif(l.photo_url, ''),
          nullif(l.profile ->> 'photo_url', ''),
          nullif(l.profile ->> 'logo_url', ''),
          nullif(l.profile -> '_enrich' ->> 'photo_url', ''),
          nullif(l.profile -> '_enrich' ->> 'logo_url', ''),
          nullif(l.profile -> '_enrich' -> 'fields' ->> 'photo_url', ''),
          nullif(l.profile -> '_enrich' -> 'fields' ->> 'logo', '')
        ) as photo_url,
        (l.owner_workspace_id is null and coalesce(l.claim_status,'unclaimed') not in ('claimed','approved')) as claimable,
        l.trust_score,
        row_number() over (
          partition by lower(trim(coalesce(l.name,''))),
                       lower(trim(coalesce(l.city,''))),
                       lower(trim(coalesce(zoi.geo_country_canon(l.country), '')))
          order by
            (l.verification_status='verified') desc,
            l.trust_score desc nulls last,
            case l.entity_type
              when 'creator' then 0
              when 'artist' then 1
              when 'business' then 2
              else 3
            end,
            l.name,
            l.id
        ) as dedupe_rank
      from zoi.listings l
      left join zoi.categories c on c.id=l.primary_category_id
      where l.publish_status='published'
        and (p_q is null or p_q='' or l.search_tsv @@ plainto_tsquery('simple',p_q)
             or l.name ilike '%'||p_q||'%' or l.region ilike '%'||p_q||'%'
             or l.region_native ilike '%'||p_q||'%')
        and (p_type is null or p_type='' or l.entity_type=p_type)
        and (p_city is null or p_city='' or l.city ilike p_city)
        and (p_country is null or p_country='' or zoi.geo_country_canon(l.country) ilike p_country)
        and (p_region is null or p_region='' or l.region ilike p_region
             or l.region_native ilike p_region or upper(l.region_code)=upper(p_region))
    ) ranked
    where dedupe_rank = 1
    order by (verification_status='verified') desc, trust_score desc nulls last, name, id
    limit least(greatest(p_limit,1),48) offset greatest(p_offset,0)
  ) r;
$function$;

create or replace function public.explore_geo(p_limit integer default 5000, p_offset integer default 0)
returns table(slug text, entity_type text, name text, city text, country text,
              category_slug text, lat double precision, lng double precision,
              geo_precision text, address text)
language sql stable security definer
set search_path = public, zoi, pg_temp as $function$
  select e.slug::text, e.entity_type::text, e.name::text, e.city::text,
         zoi.geo_country_canon(e.country)::text,
         e.category_slug::text, e.latitude::double precision, e.longitude::double precision,
         zoi.geo_precision_canon(coalesce(nullif(l.geo_precision::text,'none'), l.profile->'_geo'->>'precision'))::text,
         l.address::text
    from zoi.v_public_listings e
    left join zoi.listings l on l.id=e.id
   where e.latitude is not null and e.longitude is not null
   order by e.id
   limit least(coalesce(p_limit,5000),5000)
  offset greatest(coalesce(p_offset,0),0)
$function$;

revoke all on function public.explore_countries() from public;
grant execute on function public.explore_countries() to anon, authenticated;
revoke all on function public.explore_regions(text) from public;
grant execute on function public.explore_regions(text) to anon, authenticated;
revoke all on function public.explore_region_cities(text,text) from public;
grant execute on function public.explore_region_cities(text,text) to anon, authenticated;
revoke all on function public.explore_search(text,text,text,text,integer,integer,text) from public;
grant execute on function public.explore_search(text,text,text,text,integer,integer,text) to anon, authenticated;
revoke all on function public.explore_geo(integer,integer) from public;
grant execute on function public.explore_geo(integer,integer) to anon, authenticated;
