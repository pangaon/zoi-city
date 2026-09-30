-- Live review 2026-09-30: social_stats exposed counts without membership checks.
-- Preserve JSON keys/count types; anonymous callers must not query workspaces.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE OR REPLACE FUNCTION public.social_stats(p_workspace uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$ BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(zoi.is_ws_member(p_workspace),false) THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
 'scheduled',(SELECT count(*) FROM zoi.social_posts WHERE workspace_id=p_workspace AND status='scheduled'),
 'drafts',(SELECT count(*) FROM zoi.social_posts WHERE workspace_id=p_workspace AND status='draft'),
 'published',(SELECT count(*) FROM zoi.social_posts WHERE workspace_id=p_workspace AND status='published'),
 'channels',(SELECT count(*) FROM zoi.social_channels WHERE workspace_id=p_workspace AND connected IS TRUE),
 'channels_pending',(SELECT count(*) FROM zoi.social_channels WHERE workspace_id=p_workspace AND COALESCE(connected,false)=false));
END; $$;
REVOKE ALL ON FUNCTION public.social_stats(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.social_stats(uuid) TO authenticated;
COMMIT;
