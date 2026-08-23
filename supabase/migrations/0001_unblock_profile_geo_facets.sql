-- ============================================================================
-- Zoi — unblock the three things the front end is already built for.
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> New query -> paste this whole
-- file -> Run. It is idempotent; running it twice is harmless.
--
-- You do not need to know your table names. Part 1 finds the directory table by
-- looking for its column signature and builds everything against whatever it
-- finds, so there is nothing to edit.
--
-- Parts 2 and 3 are READ-ONLY. Part 4 is the one write path and it is NOT
-- included as runnable SQL on purpose — see the note there.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PART 1 — find the directory table and tell us what it is.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  select c.table_name into t
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.column_name in ('entity_type','slug','profile','latitude')
  group by c.table_name
  having count(distinct c.column_name) = 4
  order by c.table_name
  limit 1;

  if t is null then
    raise exception
      'Could not find a public table with entity_type + slug + profile + latitude. Run the SELECT in PART 1b and tell Claude the answer.';
  end if;

  raise notice 'Zoi directory table detected: public.%', t;
end $$;

-- PART 1b — if PART 1 raised, run just this and send back the result:
--   select table_name, count(*) filter (where column_name in
--            ('entity_type','slug','profile','latitude','category_slug')) as hits
--     from information_schema.columns
--    where table_schema='public' group by 1 having count(*) > 8 order by hits desc limit 20;


-- ---------------------------------------------------------------------------
-- PART 2 — coordinates in bulk.  Unblocks: the map.
--
-- Today nothing returns latitude/longitude for more than one listing at a time,
-- so 8,053 listings that all have coordinates cannot be plotted. This returns
-- them in pages of up to 5,000. Read-only, no personal data.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  select c.table_name into t
  from information_schema.columns c
  where c.table_schema='public'
    and c.column_name in ('entity_type','slug','profile','latitude')
  group by c.table_name having count(distinct c.column_name)=4
  order by c.table_name limit 1;

  execute format($f$
    create or replace function public.explore_geo(
      p_limit integer default 5000,
      p_offset integer default 0
    )
    returns table (
      slug text, entity_type text, name text, city text, country text,
      category_slug text, lat double precision, lng double precision
    )
    language sql
    stable
    security definer
    set search_path = public, pg_temp
    as $inner$
      select e.slug::text, e.entity_type::text, e.name::text,
             e.city::text, e.country::text, e.category_slug::text,
             e.latitude::double precision, e.longitude::double precision
        from public.%1$I e
       where e.latitude is not null
         and e.longitude is not null
       order by e.id
       limit least(coalesce(p_limit, 5000), 5000)
      offset greatest(coalesce(p_offset, 0), 0)
    $inner$;
  $f$, t);

  raise notice 'created public.explore_geo() over public.%', t;
end $$;

revoke all on function public.explore_geo(integer, integer) from public;
grant execute on function public.explore_geo(integer, integer) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- PART 3 — facet counts.  Unblocks: category and city landing pages.
--
-- There are 4,289 real category x city pairs. Only the ones above a listing
-- threshold should get an indexable page, and there is currently no way to ask
-- "how many listings are there for this category in this city" without pulling
-- every row. One grouped count answers it for the whole site.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  select c.table_name into t
  from information_schema.columns c
  where c.table_schema='public'
    and c.column_name in ('entity_type','slug','profile','latitude')
  group by c.table_name having count(distinct c.column_name)=4
  order by c.table_name limit 1;

  execute format($f$
    create or replace function public.explore_facets()
    returns table (
      country text, city text, category_slug text, entity_type text, n bigint
    )
    language sql
    stable
    security definer
    set search_path = public, pg_temp
    as $inner$
      select e.country::text, e.city::text, e.category_slug::text,
             e.entity_type::text, count(*)::bigint
        from public.%1$I e
       where e.city is not null
         and e.category_slug is not null
       group by 1,2,3,4
    $inner$;
  $f$, t);

  raise notice 'created public.explore_facets() over public.%', t;
end $$;

revoke all on function public.explore_facets() from public;
grant execute on function public.explore_facets() to anon, authenticated;


-- ---------------------------------------------------------------------------
-- PART 4 — the write path.  Unblocks: everything a claimed owner can publish.
--
-- NOT INCLUDED AS RUNNABLE SQL, deliberately. `profile` is the field that lets a
-- parish publish its service times, a taverna its menu, a musician their tour
-- dates. Writing to it must be gated on "this workspace actually owns this
-- listing", and your existing bizpage_save() already contains that check —
-- correctly — whereas I cannot read its body, so any version I invented here
-- would either duplicate your permission logic or get it wrong.
--
-- The smallest safe change is one parameter on the function that already works:
--
--   1. In the SQL Editor, run:
--        select pg_get_functiondef(p.oid)
--          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--         where n.nspname = 'public' and p.proname = 'bizpage_save';
--
--   2. Paste that output back to Claude. It is the existing definition, and the
--      change is mechanical: add `p_profile jsonb default null` to the signature
--      and `profile = coalesce(p_profile, profile)` to the UPDATE. Nothing about
--      your permission check moves.
--
-- seo_entity() already returns `profile`, so the read side needs no change —
-- the moment a value can be written, every vertical page renders it.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PART 5 — verify. Expect a row count and a sample; no errors.
-- ---------------------------------------------------------------------------
select count(*) as listings_with_coordinates from public.explore_geo(5000, 0);
select count(*) as category_city_pairs from public.explore_facets();
select * from public.explore_geo(3, 0);
