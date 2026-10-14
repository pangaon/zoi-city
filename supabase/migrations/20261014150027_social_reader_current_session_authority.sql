BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='20s';
-- Reuse the current workspace/session read policy; viewers remain readers.
DO $guard$ DECLARE item record;p pg_proc;grants text[];BEGIN
 IF md5(pg_get_functiondef('zoi.assert_ws(uuid)'::regprocedure))<>'7813c61a30a77c170c624bc3bcf983da' THEN RAISE EXCEPTION 'social_read_authority_contract_changed:assert_ws';END IF;
 IF md5(pg_get_functiondef('zoi.suite_current_session()'::regprocedure))<>'8ceef7877aeb972d09d8694f6c85dff7' THEN RAISE EXCEPTION 'social_read_authority_contract_changed:suite_current_session';END IF;
 IF md5(pg_get_functiondef('zoi.workspace_current_role(uuid)'::regprocedure))<>'3e2c5882c1306cfb581eacde756e6962' THEN RAISE EXCEPTION 'social_read_authority_contract_changed:workspace_current_role';END IF;
 FOR item IN SELECT *FROM(VALUES
 ('public.social_channels_list(uuid)','c76c89984a88467c31eafdd47f218990',ARRAY['authenticated:false','postgres:false','service_role:false']::text[]),
 ('public.social_list_posts(uuid,timestamptz,timestamptz)','78a00d54f94a2faf28ae6637b95d6ad8',ARRAY['PUBLIC:false','anon:false','authenticated:false','postgres:false','service_role:false']::text[]),
 ('public.social_post_targets_list(uuid)','34fb67305bf4904d4f4923eb37232481',ARRAY['PUBLIC:false','anon:false','authenticated:false','postgres:false','service_role:false']::text[]),
 ('public.social_stats(uuid)','d980e705cd64e6bc9227fb66161fb8c5',ARRAY['authenticated:false','postgres:false','service_role:false']::text[])
 )v(signature,expected,expected_acl)LOOP
 SELECT *INTO STRICT p FROM pg_proc WHERE oid=item.signature::regprocedure;
 SELECT array_agg(coalesce(r.rolname,'PUBLIC')||':'||a.is_grantable::text ORDER BY coalesce(r.rolname,'PUBLIC'))INTO grants FROM aclexplode(p.proacl)a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE';
 IF md5(pg_get_functiondef(p.oid))<>item.expected OR pg_get_userbyid(p.proowner)<>'postgres'OR NOT p.prosecdef OR grants IS DISTINCT FROM item.expected_acl THEN RAISE EXCEPTION 'social_reader_contract_changed:%',item.signature;END IF;
 END LOOP;
END $guard$;
CREATE OR REPLACE FUNCTION public.social_list_posts(p_workspace uuid, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS SETOF zoi.social_posts
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM zoi.workspace_current_role(p_workspace);
  RETURN QUERY SELECT * FROM zoi.social_posts
  WHERE workspace_id = p_workspace
    AND (p_from IS NULL OR coalesce(scheduled_at, created_at) >= p_from)
    AND (p_to   IS NULL OR coalesce(scheduled_at, created_at) <= p_to)
  ORDER BY coalesce(scheduled_at, created_at) DESC;
END;
$function$;
CREATE OR REPLACE FUNCTION public.social_stats(p_workspace uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ BEGIN
 PERFORM zoi.workspace_current_role(p_workspace);
 RETURN jsonb_build_object(
 'scheduled',(SELECT count(*) FROM zoi.social_posts WHERE workspace_id=p_workspace AND status='scheduled'),
 'drafts',(SELECT count(*) FROM zoi.social_posts WHERE workspace_id=p_workspace AND status='draft'),
 'published',(SELECT count(*) FROM zoi.social_posts WHERE workspace_id=p_workspace AND status='published'),
 'channels',(SELECT count(*) FROM zoi.social_channels WHERE workspace_id=p_workspace AND connected IS TRUE),
 'channels_pending',(SELECT count(*) FROM zoi.social_channels WHERE workspace_id=p_workspace AND COALESCE(connected,false)=false));
END; $function$;
CREATE OR REPLACE FUNCTION public.social_channels_list(p_workspace uuid)
 RETURNS TABLE(id bigint, platform text, handle text, display_name text, external_id text, avatar_url text, status text, connected boolean, expires_at timestamp with time zone, needs_reconnect boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 perform zoi.workspace_current_role(p_workspace);
 return query select c.id,c.platform,c.handle,c.display_name,c.external_id,c.avatar_url,coalesce(c.status,'pending'),coalesce(c.connected,false),c.token_expires_at,(coalesce(c.connected,false) and c.token_expires_at is not null and c.token_expires_at<statement_timestamp()) from zoi.social_channels c where c.workspace_id=p_workspace order by c.created_at desc nulls last,c.id desc;
end $function$;
-- Targets already use assert_ws -> workspace_current_role; preserve its body.
REVOKE ALL ON FUNCTION public.social_list_posts(uuid,timestamptz,timestamptz),public.social_stats(uuid),public.social_channels_list(uuid),public.social_post_targets_list(uuid)FROM PUBLIC,anon;
NOTIFY pgrst,'reload schema';
COMMIT;
