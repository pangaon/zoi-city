-- Expose geocoder precision so the map can distinguish city-centroid points
-- from coordinates that represent an actual street location.
do $$
declare t text;
begin
  select c.table_name into t
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.column_name in ('entity_type', 'slug', 'profile', 'latitude')
   group by c.table_name
  having count(distinct c.column_name) = 4
   order by c.table_name limit 1;

  if t is null then
    raise exception 'Directory table not found';
  end if;

  drop function if exists public.explore_geo(integer, integer);
  execute format($f$
    create function public.explore_geo(p_limit integer default 5000, p_offset integer default 0)
    returns table (slug text, entity_type text, name text, city text, country text,
                   category_slug text, lat double precision, lng double precision,
                   geo_precision text)
    language sql stable security definer set search_path = public, pg_temp as $i$
      select e.slug::text, e.entity_type::text, e.name::text, e.city::text, e.country::text,
             e.category_slug::text, e.latitude::double precision, e.longitude::double precision,
             (e.profile -> '_geo' ->> 'precision')::text
        from public.%1$I e
       where e.latitude is not null and e.longitude is not null
       order by e.id
       limit least(coalesce(p_limit, 5000), 5000) offset greatest(coalesce(p_offset, 0), 0)
    $i$;
  $f$, t);

  revoke all on function public.explore_geo(integer, integer) from public;
  grant execute on function public.explore_geo(integer, integer) to anon, authenticated;
end $$;