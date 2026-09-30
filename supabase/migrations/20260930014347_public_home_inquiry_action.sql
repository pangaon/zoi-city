BEGIN;
SET LOCAL lock_timeout='5s';
CREATE OR REPLACE FUNCTION zoi.public_home_actions(p_listing uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_strip_nulls(jsonb_build_object(
 'booking_url',CASE WHEN EXISTS(SELECT 1 FROM zoi.booking_settings b WHERE b.listing_id=l.id AND b.workspace_id=l.owner_workspace_id AND b.enabled) THEN '/book/?listing='||l.id::text END,
 'inquiry_url',CASE WHEN EXISTS(SELECT 1 FROM zoi.inquiry_settings s WHERE s.listing_id=l.id AND s.workspace_id=l.owner_workspace_id AND s.enabled) THEN '/inquiries/?listing='||l.id::text END,
 'volunteer_url',CASE WHEN EXISTS(SELECT 1 FROM zoi.org_programs p JOIN zoi.org_shifts s ON s.program_id=p.id AND s.workspace_id=p.workspace_id WHERE p.workspace_id=l.owner_workspace_id AND p.status='published' AND s.status='scheduled' AND s.starts_at>now()) THEN '/volunteer/?workspace='||l.owner_workspace_id::text END))
 FROM zoi.listings l WHERE l.id=p_listing AND l.publish_status='published' AND coalesce(l.marketplace_status,'')<>'hidden';
$$;
REVOKE ALL ON FUNCTION zoi.public_home_actions(uuid) FROM PUBLIC,anon,authenticated;
COMMIT;
