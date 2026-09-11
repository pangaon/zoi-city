-- Keep the existing Intelligence dashboard real, but bounded and fast enough for
-- production traffic. The UI needs the worst current scans and open issues, not
-- an unbounded export of every historical row.
CREATE INDEX IF NOT EXISTS idx_seo_scans_site_latest
  ON zoi.seo_scans (target_type, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_scans_entity_latest
  ON zoi.seo_scans (target_type, target_ref, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_issues_scan_status_severity
  ON zoi.seo_issues (scan_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_citation_checks_query_engine
  ON zoi.citation_checks (query, engine);

CREATE OR REPLACE FUNCTION zoi.seo_dashboard()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = zoi, public
AS $function$
  WITH latest_site AS (
    SELECT score, summary FROM zoi.seo_scans
     WHERE target_type = 'site'
     ORDER BY scanned_at DESC LIMIT 1
  ),
  entity_scans AS (
    SELECT DISTINCT ON (s.target_ref) s.id, s.target_ref, s.score, s.scanned_at, s.summary
      FROM zoi.seo_scans s
     WHERE s.target_type = 'entity'
     ORDER BY s.target_ref, s.scanned_at DESC
  ),
  worst AS (
    SELECT * FROM entity_scans ORDER BY score ASC NULLS FIRST LIMIT 100
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'ecosystem_score', (SELECT score FROM latest_site),
    'ecosystem_summary', (SELECT summary FROM latest_site),
    'scans', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'scan_id', es.id, 'entity', l.name, 'entity_type', l.entity_type,
        'slug', l.slug, 'score', es.score, 'scanned_at', es.scanned_at,
        'summary', es.summary,
        'top_issues', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'check_key', i.check_key, 'severity', i.severity, 'status', i.status,
            'evidence', i.evidence, 'risk', i.risk, 'expected_benefit', i.expected_benefit,
            'rollback', i.rollback, 'approval_required', i.approval_required
          ) ORDER BY CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END)
          FROM (SELECT * FROM zoi.seo_issues WHERE scan_id = es.id ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END LIMIT 6) i
        ), '[]'::jsonb)
      ) ORDER BY es.score ASC NULLS FIRST)
      FROM worst es LEFT JOIN zoi.listings l ON l.id::text = es.target_ref
    ), '[]'::jsonb),
    'issue_counts', COALESCE((
      SELECT jsonb_object_agg(severity, c) FROM (
        SELECT i.severity, count(*) c
          FROM zoi.seo_issues i
          JOIN worst es ON es.id = i.scan_id
         WHERE i.status = 'open'
         GROUP BY i.severity
      ) t
    ), '{}'::jsonb),
    'citations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'query', c.query, 'engine', c.engine, 'appeared', c.appeared,
        'position', c.position, 'confidence', c.confidence, 'checked_at', c.checked_at
      ) ORDER BY c.query, c.engine)
      FROM (SELECT * FROM zoi.citation_checks ORDER BY checked_at DESC NULLS LAST LIMIT 200) c
    ), '[]'::jsonb)
  );
$function$;
