-- Make enrichment resilient to malformed historical metadata and prevent stale
-- machine claims from surviving a successful refresh.
create or replace function zoi.enrich_queue_lease(
  p_limit integer default 40,
  p_max_age_days integer default 30,
  p_lease_minutes integer default 15
)
returns table(slug text, website text, lease_id text)
language plpgsql security definer
set search_path = zoi, public, pg_temp
as $function$
declare
  v_lease text := md5(clock_timestamp()::text || random()::text);
begin
  return query
  with candidates as (
    select l.id
      from zoi.listings l
     where l.website is not null
       and l.website <> ''
       and l.website ~* '^https?://'
       and coalesce(l.profile -> '_enrich' ->> 'blocked', '') <> 'true'
       and (
            nullif(l.profile -> '_enrich' ->> 'checked_at', '') is null
         or (l.profile -> '_enrich' ->> 'checked_at') ~ '^\d{4}-\d{2}-\d{2}$'
            and (l.profile -> '_enrich' ->> 'checked_at')::date < current_date - greatest(p_max_age_days, 1)
         or coalesce(l.profile -> '_enrich' ->> 'crawl_status', '') = 'error'
       )
       and (
         nullif(l.profile -> '_enrich' -> 'lease' ->> 'expires_at', '') is null
         or (l.profile -> '_enrich' -> 'lease' ->> 'expires_at') ~ '^\d{4}-\d{2}-\d{2}T'
            and (l.profile -> '_enrich' -> 'lease' ->> 'expires_at')::timestamptz < now()
       )
     order by (l.verification_status in ('verified', 'owner_verified', 'source_verified')) desc,
              (l.profile -> '_enrich' ->> 'checked_at') nulls first,
              l.id
     limit greatest(least(coalesce(p_limit, 40), 200), 1)
     for update skip locked
  ), leased as (
    update zoi.listings l
       set profile = coalesce(l.profile, '{}'::jsonb) || jsonb_build_object(
         '_enrich', coalesce(l.profile -> '_enrich', '{}'::jsonb) || jsonb_build_object(
           'lease', jsonb_build_object(
             'id', v_lease,
             'expires_at', to_char(clock_timestamp() + (greatest(coalesce(p_lease_minutes, 15), 1) || ' minutes')::interval, 'YYYY-MM-DD"T"HH24:MI:SSOF')
           )
         )
       )
      from candidates c
     where l.id = c.id
     returning l.slug, l.website
  )
  select leased.slug, leased.website, v_lease from leased;
end;
$function$;

create or replace function zoi.enrich_apply(p_batch jsonb)
returns table(slug text, applied boolean)
language plpgsql security definer
set search_path = zoi, public, pg_temp
as $function$
declare
  r jsonb;
  v_lease text;
  v_machine jsonb;
begin
  if p_batch is null or jsonb_typeof(p_batch) <> 'array' then
    raise exception 'batch must be a JSON array';
  end if;

  for r in select * from jsonb_array_elements(p_batch) loop
    v_lease := nullif(r ->> 'lease_id', '');
    v_machine := zoi.profile_strip(coalesce(r -> 'profile', '{}'::jsonb))
      || jsonb_build_object(
        'provenance', coalesce(r -> 'provenance', '{}'::jsonb),
        'source_url', r ->> 'website',
        'checked_at', to_char(now(), 'YYYY-MM-DD'),
        'status', coalesce(r -> 'profile' ->> 'crawl_status', 'ok')
      );
    return query
    update zoi.listings l
       set profile = coalesce(l.profile, '{}'::jsonb)
                    || jsonb_build_object('_enrich', v_machine),
           updated_at = now()
     where l.slug = (r ->> 'slug')
       and (v_lease is null or l.profile -> '_enrich' -> 'lease' ->> 'id' = v_lease)
    returning l.slug, true;
  end loop;
end;
$function$;

revoke all on function zoi.enrich_queue_lease(integer, integer, integer) from public;
revoke all on function zoi.enrich_apply(jsonb) from public;
