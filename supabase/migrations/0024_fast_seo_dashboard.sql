-- Fast bounded read model for Intelligence. Keep the legacy dashboard intact,
-- but give the product a predictable query: recent real scans, their issues,
-- latest site score, and recent citation checks.
CREATE INDEX IF NOT EXISTS idx_seo_scans_type_time
  ON zoi.seo_scans (target_type, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_issues_scan_status
  ON zoi.seo_issues (scan_id, status);

CREATE OR REPLACE FUNCTION public.seo_dashboard_fast()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = zoi, public
AS $function$
  WITH recent AS MATERIALIZED (
    SELECT s.id, s.target_ref, s.score, s.scanned_at, s.summary
      FROM zoi.seo_scans s
     WHERE s.target_type = 'entity'
     ORDER BY s.scanned_at DESC NULLS LAST
     LIMIT 100
  ),
  issue_counts AS (
    SELECT i.severity, count(*)::int AS count
      FROM zoi.seo_issues i
      JOIN recent r ON r.id = i.scan_id
     WHERE i.status = 'open'
     GROUP BY i.severity
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'ecosystem_score', (SELECT score FROM zoi.seo_scans WHERE target_type = 'site' ORDER BY scanned_at DESC NULLS LAST LIMIT 1),
    'ecosystem_summary', (SELECT summary FROM zoi.seo_scans WHERE target_type = 'site' ORDER BY scanned_at DESC NULLS LAST LIMIT 1),
    'scans', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'scan_id', r.id, 'entity', l.name, 'entity_type', l.entity_type, 'slug', l.slug,
      'score', r.score, 'scanned_at', r.scanned_at, 'summary', r.summary,
      'top_issues', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'check_key', i.check_key, 'severity', i.severity, 'status', i.status,
        'evidence', i.evidence, 'risk', i.risk, 'expected_benefit', i.expected_benefit,
        'rollback', i.rollback, 'approval_required', i.approval_required
      ) ORDER BY CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END)
      FROM (SELECT * FROM zoi.seo_issues WHERE scan_id = r.id ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END LIMIT 6) i), '[]'::jsonb)
    ) ORDER BY r.scanned_at DESC)
      FROM recent r LEFT JOIN zoi.listings l ON l.id::text = r.target_ref
    ), '[]'::jsonb),
    'issue_counts', coalesce((SELECT jsonb_object_agg(severity, count) FROM issue_counts), '{}'::jsonb),
    'citations', coalesce((SELECT jsonb_agg(jsonb_build_object('query', query, 'engine', engine, 'appeared', appeared, 'position', position, 'confidence', confidence, 'checked_at', checked_at) ORDER BY checked_at DESC NULLS LAST) FROM (SELECT * FROM zoi.citation_checks ORDER BY checked_at DESC NULLS LAST LIMIT 200) c), '[]'::jsonb)
  );
$function$;

REVOKE ALL ON FUNCTION public.seo_dashboard_fast() FROM public;
GRANT EXECUTE ON FUNCTION public.seo_dashboard_fast() TO anon, authenticated, service_role;
