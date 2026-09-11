-- Expose geocoder precision so the map can distinguish city-centroid points
-- from coordinates that represent an actual street location.
drop function if exists public.explore_geo(integer, integer);

create function public.explore_geo(p_limit integer default 5000, p_offset integer default 0)
returns table (slug text, entity_type text, name text, city text, country text,
               category_slug text, lat double precision, lng double precision,
               geo_precision text)
language sql stable security definer
set search_path = public, zoi, pg_temp as $function$
  select e.slug::text, e.entity_type::text, e.name::text, e.city::text, e.country::text,
         e.category_slug::text, e.latitude::double precision, e.longitude::double precision,
         l.geo_precision::text
    from zoi.v_public_listings e
    left join zoi.listings l on l.id = e.id
   where e.latitude is not null and e.longitude is not null
   order by e.id
   limit least(coalesce(p_limit, 5000), 5000)
  offset greatest(coalesce(p_offset, 0), 0)
$function$;

revoke all on function public.explore_geo(integer, integer) from public;
grant execute on function public.explore_geo(integer, integer) to anon, authenticated;