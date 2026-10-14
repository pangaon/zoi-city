-- Exact production definition/owner/ACL captured read-only2026-10-14.
CREATE OR REPLACE FUNCTION public.social_due_posts()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(to_jsonb(p)),'[]'::jsonb)
  FROM (SELECT id, workspace_id, body, media, channels
        FROM zoi.social_posts
        WHERE status='scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= now()
        ORDER BY scheduled_at ASC LIMIT 50) p;
$function$;
ALTER FUNCTION public.social_due_posts()OWNER TO postgres;
REVOKE ALL ON FUNCTION public.social_due_posts()FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.social_due_posts()TO service_role;
