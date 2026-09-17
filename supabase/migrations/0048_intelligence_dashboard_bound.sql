-- Bounded Intelligence dashboard read. The overview must stay responsive even
-- when historical issue/citation volume is large; details remain on demand.
create index if not exists seo_scans_entity_time_idx
  on zoi.seo_scans (target_type, scanned_at desc, id desc);

create or replace function public.seo_dashboard_fast()
returns jsonb
language sql stable security definer
set search_path = zoi, public, pg_temp
as $function$
  with recent as materialized (
    select s.id, s.target_ref, s.score, s.scanned_at, s.summary
      from zoi.seo_scans s
     where s.target_type = 'entity'
     order by s.scanned_at desc nulls last, s.id desc
     limit 25
  ), latest_site as (
    select s.score, s.summary
      from zoi.seo_scans s
     where s.target_type = 'site'
     order by s.scanned_at desc nulls last, s.id desc
     limit 1
  )
  select jsonb_build_object(
    'generated_at', now(),
    'ecosystem_score', (select score from latest_site),
    'ecosystem_summary', (select summary from latest_site),
    'scans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'scan_id', r.id,
        'entity', coalesce(l.name, r.target_ref),
        'entity_type', l.entity_type,
        'slug', l.slug,
        'score', r.score,
        'scanned_at', r.scanned_at,
        'summary', r.summary,
        'issue_count', coalesce(nullif(r.summary ->> 'issues_open', '')::int, 0),
        'top_issues', '[]'::jsonb
      ) order by r.scanned_at desc nulls last)
      from recent r left join zoi.listings l on l.id::text = r.target_ref
    ), '[]'::jsonb),
    'issue_counts', '{}'::jsonb,
    'citations', '[]'::jsonb
  );
$function$;

revoke all on function public.seo_dashboard_fast() from public;
grant execute on function public.seo_dashboard_fast() to anon, authenticated, service_role;
