-- Compatibility contract for the directory city selector.
create or replace function public.explore_cities(p_limit integer default 24)
returns table(city text, country text, n bigint)
language sql stable security definer set search_path to 'zoi','public'
as $function$
  select l.city, zoi.geo_country_canon(l.country), count(*)
    from zoi.listings l
   where l.publish_status = 'published'
     and l.city is not null and l.city <> ''
   group by l.city, zoi.geo_country_canon(l.country)
   order by count(*) desc, l.city
   limit least(greatest(coalesce(p_limit, 24), 1), 100);
$function$;

revoke all on function public.explore_cities(integer) from public;
grant execute on function public.explore_cities(integer) to anon, authenticated;