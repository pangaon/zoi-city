-- Zoi: one paste. Adds two read-only lookups, then shows one existing function.
-- Safe to run twice. Changes no data.

do $$
declare t text;
begin
  select c.table_name into t
    from information_schema.columns c
   where c.table_schema='public'
     and c.column_name in ('entity_type','slug','profile','latitude')
   group by c.table_name
  having count(distinct c.column_name)=4
   order by c.table_name limit 1;

  if t is null then
    raise exception 'Directory table not found — send Claude the output of the SELECT at the bottom.';
  end if;
  raise notice 'Directory table: public.%', t;

  execute format($f$
    create or replace function public.explore_geo(p_limit integer default 5000, p_offset integer default 0)
    returns table (slug text, entity_type text, name text, city text, country text,
                   category_slug text, lat double precision, lng double precision)
    language sql stable security definer set search_path = public, pg_temp as $i$
      select e.slug::text, e.entity_type::text, e.name::text, e.city::text, e.country::text,
             e.category_slug::text, e.latitude::double precision, e.longitude::double precision
        from public.%1$I e
       where e.latitude is not null and e.longitude is not null
       order by e.id
       limit least(coalesce(p_limit,5000),5000) offset greatest(coalesce(p_offset,0),0)
    $i$;
  $f$, t);

  execute format($f$
    create or replace function public.explore_facets()
    returns table (country text, city text, category_slug text, entity_type text, n bigint)
    language sql stable security definer set search_path = public, pg_temp as $i$
      select e.country::text, e.city::text, e.category_slug::text, e.entity_type::text, count(*)::bigint
        from public.%1$I e
       where e.city is not null and e.category_slug is not null
       group by 1,2,3,4
    $i$;
  $f$, t);
end $$;

revoke all on function public.explore_geo(integer,integer) from public;
grant execute on function public.explore_geo(integer,integer) to anon, authenticated;
revoke all on function public.explore_facets() from public;
grant execute on function public.explore_facets() to anon, authenticated;

-- checks
select count(*) as listings_with_coordinates from public.explore_geo(5000,0);
select count(*) as category_city_pairs from public.explore_facets();

-- copy this result back to Claude
select pg_get_functiondef(p.oid) as bizpage_save_definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='bizpage_save';
