begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
-- Public projection only: internal appearance rows and confirmation actor IDs stay private.
create function public.event_artists(p_event uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('ok',true,'event_id',p_event,
  'artists',coalesce((select jsonb_agg(to_jsonb(q) order by q.starts_at,q.id) from (
   select p.id,p.artist_id,p.event_id,a.name artist_name,a.entity_type,a.slug,a.city,a.country,
    p.starts_at,p.ends_at,p.timezone,p.source_url,p.updated_at
   from zoi.artist_appearances p
   join zoi.listings a on a.id=p.artist_id
   join zoi.listings e on e.id=p.event_id
   where p.event_id=p_event and e.entity_type='event' and a.entity_type in('artist','creator')
    and nullif(btrim(a.slug),'') is not null
    and a.moderation_status in('clean','cleared') and e.moderation_status in('clean','cleared')
    and p.status='confirmed' and p.artist_confirmed_by is not null and p.event_confirmed_by is not null
    and p.ends_at>=clock_timestamp() and zoi.appearance_current(p)
   order by p.starts_at,p.id limit 100
  ) q),'[]'::jsonb),'confirmation','event_and_artist_workspace');
$$;
revoke all on function public.event_artists(uuid) from public,anon,authenticated;
grant execute on function public.event_artists(uuid) to anon,authenticated;
comment on function public.event_artists(uuid) is 'Public upcoming confirmed event appearances, current ownership and publication checked on both sides. Does not imply tickets, payment, or availability.';
create or replace function public.artist_shows(p_artist uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare rows jsonb;begin
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into rows from(select p.id,p.artist_id,p.event_id,p.starts_at,p.ends_at,p.timezone,p.source_url,p.updated_at,a.name artist_name,e.name event_name,e.slug,e.city,e.country from zoi.artist_appearances p join zoi.listings a on a.id=p.artist_id join zoi.listings e on e.id=p.event_id where p.artist_id=p_artist and a.entity_type in('artist','creator') and e.entity_type='event' and a.moderation_status in('clean','cleared') and e.moderation_status in('clean','cleared') and p.artist_confirmed_by is not null and p.event_confirmed_by is not null and nullif(e.slug,'') is not null and p.status='confirmed' and p.ends_at>=clock_timestamp() and zoi.appearance_current(p) order by p.starts_at,p.id limit 100)q;
 return jsonb_build_object('ok',true,'shows',rows,'confirmation','event_and_artist_workspace');end $$;
revoke all on function public.artist_shows(uuid) from public,anon,authenticated;
grant execute on function public.artist_shows(uuid) to anon,authenticated;
commit;
