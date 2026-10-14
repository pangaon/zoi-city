-- Exact live target-result/finalizer definitions captured read-only2026-10-14.
-- The actual status column is text with no status CHECK or enum.
CREATE OR REPLACE FUNCTION public.social_target_record(p_post uuid,p_channel bigint,p_platform text,p_status text,p_external_id text,p_url text,p_error text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'zoi','public' AS $function$
  INSERT INTO zoi.social_post_targets(post_id,channel_id,platform,status,external_post_id,external_url,error,published_at,attempts,updated_at)
  VALUES(p_post,p_channel,p_platform,p_status,p_external_id,p_url,p_error,
         CASE WHEN p_status='published' THEN now() END,1,now());
$function$;
CREATE OR REPLACE FUNCTION public.social_post_finalize(p_post uuid,p_status text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'zoi','public' AS $function$
  UPDATE zoi.social_posts
  SET status=p_status, published_at=CASE WHEN p_status='published' THEN now() ELSE published_at END, updated_at=now()
  WHERE id=p_post;
$function$;
ALTER FUNCTION public.social_target_record(uuid,bigint,text,text,text,text,text)OWNER TO postgres;
ALTER FUNCTION public.social_post_finalize(uuid,text)OWNER TO postgres;
REVOKE ALL ON FUNCTION public.social_target_record(uuid,bigint,text,text,text,text,text),public.social_post_finalize(uuid,text)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.social_target_record(uuid,bigint,text,text,text,text,text),public.social_post_finalize(uuid,text)TO service_role;
