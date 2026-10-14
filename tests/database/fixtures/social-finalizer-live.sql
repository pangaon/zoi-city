-- Exact production read-only capture 2026-10-14; no authority helper override.
CREATE OR REPLACE FUNCTION public.social_post_finalize(p_post uuid, p_status text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
  UPDATE zoi.social_posts
  SET status=p_status, published_at=CASE WHEN p_status='published' THEN now() ELSE published_at END, updated_at=now()
  WHERE id=p_post;
$function$;
ALTER FUNCTION public.social_post_finalize(uuid,text)OWNER TO postgres;
REVOKE ALL ON FUNCTION public.social_post_finalize(uuid,text)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.social_post_finalize(uuid,text)TO service_role;
