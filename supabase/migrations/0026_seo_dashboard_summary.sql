-- Compact Intelligence dashboard read. Detail rows are loaded on demand so a
-- large issue payload can never block the main screen.
CREATE OR REPLACE FUNCTION public.seo_dashboard_fast()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = zoi, public
AS $function$
  WITH recent AS MATERIALIZED (
    SELECT s.id, s.target_ref, s.score, s.scanned_at, s.summary
      FROM zoi.seo_scans s
     WHERE s.target_type = 'entity'
     ORDER BY s.scanned_at DESC NULLS LAST
     LIMIT 50
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'ecosystem_score', (SELECT score FROM zoi.seo_scans WHERE target_type='site' ORDER BY scanned_at DESC NULLS LAST LIMIT 1),
    'ecosystem_summary', (SELECT summary FROM zoi.seo_scans WHERE target_type='site' ORDER BY scanned_at DESC NULLS LAST LIMIT 1),
    'scans', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'scan_id',r.id,'entity',l.name,'entity_type',l.entity_type,'slug',l.slug,
      'score',r.score,'scanned_at',r.scanned_at,'summary',r.summary,
      'issue_count',coalesce((r.summary->>'issues_open')::int,0)
    ) ORDER BY r.scanned_at DESC) FROM recent r LEFT JOIN zoi.listings l ON l.id::text=r.target_ref),'[]'::jsonb),
    'issue_counts', '{}'::jsonb,
    'citations', '[]'::jsonb
  );
$function$;

CREATE OR REPLACE FUNCTION public.seo_scan_detail(p_scan uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = zoi, public
AS $function$
  SELECT jsonb_build_object(
    'scan', (SELECT jsonb_build_object('id',s.id,'score',s.score,'scanned_at',s.scanned_at,'summary',s.summary) FROM zoi.seo_scans s WHERE s.id=p_scan),
    'issues', coalesce((SELECT jsonb_agg(jsonb_build_object('check_key',i.check_key,'severity',i.severity,'status',i.status,'evidence',i.evidence,'risk',i.risk,'expected_benefit',i.expected_benefit,'rollback',i.rollback,'approval_required',i.approval_required) ORDER BY CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END) FROM zoi.seo_issues i WHERE i.scan_id=p_scan),'[]'::jsonb)
  );
$function$;

REVOKE ALL ON FUNCTION public.seo_dashboard_fast() FROM public;
GRANT EXECUTE ON FUNCTION public.seo_dashboard_fast() TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.seo_scan_detail(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.seo_scan_detail(uuid) TO anon, authenticated, service_role;
