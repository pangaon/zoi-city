-- Enrichment control plane: leased work, durable provenance, and profile
-- completeness signals. No crawler input is accepted from a caller.

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
            l.profile -> '_enrich' ->> 'checked_at' is null
         or (l.profile -> '_enrich' ->> 'checked_at')::date
              < (current_date - make_interval(days => greatest(p_max_age_days, 1)))
         or (
              coalesce(l.profile -> '_enrich' ->> 'crawl_status', '') = 'error'
          and (l.profile -> '_enrich' ->> 'checked_at')::date <= (current_date - 1)
            )
       )
       and (
         (l.profile -> '_enrich' -> 'lease' ->> 'expires_at') is null
         or (l.profile -> '_enrich' -> 'lease' ->> 'expires_at')::timestamptz < now()
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
             'expires_at', to_char(clock_timestamp() + make_interval(minutes => greatest(coalesce(p_lease_minutes, 15), 1)), 'YYYY-MM-DD"T"HH24:MI:SSOF')
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

revoke all on function zoi.enrich_queue_lease(integer, integer, integer) from public;

create or replace function public.enrich_queue_lease(
  p_limit integer default 40,
  p_max_age_days integer default 30,
  p_lease_minutes integer default 15
)
returns table(slug text, website text, lease_id text)
language sql security definer
set search_path = public, zoi, pg_temp
as $function$
  select * from zoi.enrich_queue_lease(p_limit, p_max_age_days, p_lease_minutes);
$function$;

revoke all on function public.enrich_queue_lease(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.enrich_queue_lease(integer, integer, integer) to service_role;

create or replace function zoi.enrich_apply(p_batch jsonb)
returns table(slug text, applied boolean)
language plpgsql security definer
set search_path = zoi, public, pg_temp
as $function$
declare
  r jsonb;
  v_lease text;
begin
  if p_batch is null or jsonb_typeof(p_batch) <> 'array' then
    raise exception 'batch must be a JSON array';
  end if;

  for r in select * from jsonb_array_elements(p_batch) loop
    v_lease := nullif(r ->> 'lease_id', '');
    return query
    update zoi.listings l
       set profile = coalesce(l.profile, '{}'::jsonb) || jsonb_build_object(
             '_enrich',
             (coalesce(l.profile -> '_enrich', '{}'::jsonb)
               || zoi.profile_strip(coalesce(r -> 'profile', '{}'::jsonb))
               || jsonb_build_object(
                    'provenance', coalesce(l.profile -> '_enrich' -> 'provenance', '{}'::jsonb)
                                   || coalesce(r -> 'provenance', '{}'::jsonb),
                    'source_url', r ->> 'website',
                    'checked_at', to_char(now(), 'YYYY-MM-DD'),
                    'status', coalesce(r -> 'profile' ->> 'crawl_status', 'ok')
                  )
               - 'lease')
           ),
           updated_at = now()
     where l.slug = (r ->> 'slug')
       and (v_lease is null or l.profile -> '_enrich' -> 'lease' ->> 'id' = v_lease)
    returning l.slug, true;
  end loop;
end;
$function$;

revoke all on function zoi.enrich_apply(jsonb) from public;

create or replace function zoi.profile_completeness(p_listing uuid)
returns jsonb
language plpgsql stable security definer
set search_path = zoi, public, pg_temp
as $function$
declare
  l record;
  p jsonb;
  e jsonb;
  required text[];
  present text[] := array[]::text[];
  missing text[] := array[]::text[];
  field text;
begin
    select entity_type, profile, description, photo_url, website,
      phone, email, city
    into l
    from zoi.listings
   where id = p_listing and publish_status = 'published';
  if not found then return null; end if;

  p := coalesce(l.profile, '{}'::jsonb);
  e := coalesce(p -> '_enrich', '{}'::jsonb);
  required := array['description', 'image', 'contact', 'location'];
  if l.entity_type in ('business', 'restaurant', 'professional', 'venue', 'hotel') then
    required := required || array['hours'];
  end if;
  if l.entity_type in ('restaurant', 'bakery', 'food_shop') then
    required := required || array['menu'];
  elsif l.entity_type in ('professional', 'organization', 'school') then
    required := required || array['services'];
  elsif l.entity_type in ('event', 'venue', 'travel_place') then
    required := required || array['booking'];
  end if;

  foreach field in array required loop
    if case field
       when 'description' then nullif(coalesce(p ->> 'description', e -> 'fields' ->> 'description', l.description), '') is not null
       when 'image' then nullif(coalesce(p ->> 'photo_url', l.photo_url, e -> 'fields' ->> 'logo'), '') is not null
       when 'contact' then nullif(coalesce(p ->> 'phone', l.phone, p ->> 'email', l.email, l.website), '') is not null
       when 'location' then nullif(coalesce(p ->> 'address', l.city), '') is not null
      when 'hours' then nullif(coalesce(p ->> 'hours', e -> 'fields' ->> 'hours'), '') is not null
       when 'menu' then (p ? 'menu' or p ? 'menu_url' or e ? 'menu')
       when 'services' then (p ? 'services' or p ? 'service_list' or e ? 'services')
       when 'booking' then (p ? 'booking' or p ? 'booking_url' or p ? 'reservation_url' or e ? 'booking')
       else false
    end then
      present := array_append(present, field);
    else
      missing := array_append(missing, field);
    end if;
  end loop;

  return jsonb_build_object(
    'score', round((100.0 * cardinality(present) / greatest(cardinality(required), 1))::numeric, 1),
    'complete', cardinality(missing) = 0,
    'required', to_jsonb(required),
    'present', to_jsonb(present),
    'missing', to_jsonb(missing),
    'checked_at', e ->> 'checked_at'
  );
end;
$function$;

revoke all on function zoi.profile_completeness(uuid) from public;

create or replace function public.listing_completeness(p_slug text)
returns jsonb
language sql stable security definer
set search_path = public, zoi, pg_temp
as $function$
  select zoi.profile_completeness(l.id)
    from zoi.listings l
   where l.slug = p_slug
     and l.publish_status = 'published';
$function$;

revoke all on function public.listing_completeness(text) from public;
grant execute on function public.listing_completeness(text) to anon, authenticated;

comment on function public.listing_completeness(text) is
  'Reports evidence-backed profile fields still missing; never invents content.';