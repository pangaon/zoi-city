-- Honest geocoder precision on the map, and the street address alongside it.
--
-- WHY
--   explore_geo returned zoi.listings.geo_precision raw. In production that
--   column carries ten distinct values:
--
--     none          5292   59.2%
--     city          2133   23.9%
--     approx         922   10.3%
--     street         535    6.0%
--     address         35    0.4%
--     approximate     13    0.1%
--     neighborhood     2  |  neighbourhood 1  |  suburb 1  |  rooftop 1
--
--   The map understood eight tokens, so 'none', 'approx', 'approximate',
--   'neighborhood', 'neighbourhood' and 'suburb' — 6,231 rows, 69.7% — all fell
--   through to a single fallback that rendered "Approximate location".
--
--   That label was wrong in both directions. It overstated the 'none' bucket,
--   which is not an approximation but an absence of evidence, and which
--   demonstrably contains pins on the wrong continent (a Kalamata spa at
--   -7.77,28.24 in the DRC; an Aristi resort at 43.18,-2.49 in Spain; a Corfu
--   resort at 42.96,-78.41 near Buffalo, New York). It also understated
--   records that genuinely hold a street-level fix.
--
-- WHAT THIS CHANGES
--   1. One canonical vocabulary, normalised in SQL so every client agrees:
--        street | neighbourhood | city | region | approximate | unknown
--      The spelling pairs approx/approximate and neighborhood/neighbourhood
--      stop being distinct values.
--
--   2. Recovers precision that was recorded but never read. The 0002 backfill
--      wrote its precision into profile->'_geo'->>'precision', while the RPC
--      read the geo_precision column. Two sources of truth, and the JSON one
--      was invisible. This coalesces to the column first and falls back to the
--      JSON, so nothing recorded is thrown away.
--
--   3. Returns `address`. The street address on a record is exact even when the
--      coordinate derived from it is not, so it is the correct destination for
--      a directions link. Routing a user to a city centroid is worse than not
--      offering to route them at all.
--
-- WHAT THIS DOES NOT DO
--   Invent precision. A row with an address but no recorded precision is
--   reported as 'unknown', not promoted to 'street'. We cannot know where that
--   coordinate came from, and the misplaced pins above are exactly what
--   guessing produces. Re-geocoding those rows is a separate, reviewed job.
--
--   No data is mutated. This is a read-path change only.

create or replace function zoi.geo_precision_canon(p_raw text)
returns text
language sql immutable
as $function$
  select case lower(nullif(trim(coalesce(p_raw, '')), ''))
    when 'rooftop'       then 'street'
    when 'address'       then 'street'
    when 'street'        then 'street'
    when 'neighborhood'  then 'neighbourhood'
    when 'neighbourhood' then 'neighbourhood'
    when 'suburb'        then 'neighbourhood'
    when 'locality'      then 'city'
    when 'town'          then 'city'
    when 'city'          then 'city'
    when 'region'        then 'region'
    when 'country'       then 'region'
    when 'approx'        then 'approximate'
    when 'approximate'   then 'approximate'
    -- 'none', NULL and anything unrecognised are an absence of evidence, and
    -- are named as such rather than being softened into 'approximate'.
    else 'unknown'
  end
$function$;

comment on function zoi.geo_precision_canon(text) is
  'Collapses the raw geo_precision vocabulary to: street | neighbourhood | city | region | approximate | unknown.';

drop function if exists public.explore_geo(integer, integer);

create function public.explore_geo(p_limit integer default 5000, p_offset integer default 0)
returns table (slug text, entity_type text, name text, city text, country text,
               category_slug text, lat double precision, lng double precision,
               geo_precision text, address text)
language sql stable security definer
set search_path = public, zoi, pg_temp as $function$
  select e.slug::text, e.entity_type::text, e.name::text, e.city::text, e.country::text,
         e.category_slug::text, e.latitude::double precision, e.longitude::double precision,
         zoi.geo_precision_canon(
           coalesce(nullif(l.geo_precision::text, 'none'),
                    l.profile->'_geo'->>'precision')
         )::text as geo_precision,
         e.address::text
    from zoi.v_public_listings e
    left join zoi.listings l on l.id = e.id
   where e.latitude is not null and e.longitude is not null
   order by e.id
   limit least(coalesce(p_limit, 5000), 5000)
  offset greatest(coalesce(p_offset, 0), 0)
$function$;

revoke all on function public.explore_geo(integer, integer) from public;
grant execute on function public.explore_geo(integer, integer) to anon, authenticated;

-- Distribution after normalisation. Run this to see how many 'none' rows the
-- profile->'_geo' fallback actually recovers.
--
--   select geo_precision, count(*)
--     from public.explore_geo(5000, 0)
--    group by 1 order by 2 desc;
