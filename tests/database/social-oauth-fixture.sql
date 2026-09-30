create table zoi.workspace_members(workspace_id uuid,profile_id uuid,role text);create table zoi.app_config(key text,value text);create function zoi.is_ws_member(p_workspace uuid) returns boolean language sql as $$select exists(select 1 from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id=p_workspace and p.auth_user_id=auth.uid())$$;
create table zoi.social_channels(id int8,workspace_id uuid,platform text,handle text,display_name text,connected bool,status text,created_at timestamptz,external_id text,avatar_url text,access_token text,refresh_token text,token_expires_at timestamptz,scopes text[],meta jsonb,connected_by uuid,last_error text,updated_at timestamptz);
create table zoi.social_oauth_states(state text,workspace_id uuid,platform text,profile_id uuid,return_to text,created_at timestamptz,expires_at timestamptz,code_verifier text,extra jsonb);
create table zoi.social_posts(id uuid,workspace_id uuid,author_profile uuid,body text,media jsonb,channels text[],status text,scheduled_at timestamptz,published_at timestamptz,nameday_ref text,meta jsonb,created_at timestamptz,updated_at timestamptz);
create table zoi.social_post_targets(id uuid,post_id uuid,channel_id int8,platform text,status text,external_post_id text,external_url text,error text,attempts int4,published_at timestamptz,created_at timestamptz,updated_at timestamptz);
CREATE OR REPLACE FUNCTION public.social_channel_upsert(p_workspace uuid, p_platform text, p_external_id text, p_handle text, p_display text, p_avatar text, p_access_token text, p_refresh_token text, p_expires_at timestamp with time zone, p_scopes text[], p_connected_by uuid, p_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
DECLARE v_id bigint;
BEGIN
  INSERT INTO zoi.social_channels(workspace_id,platform,external_id,handle,display_name,avatar_url,
    access_token,refresh_token,token_expires_at,scopes,connected,status,connected_by,meta,updated_at)
  VALUES(p_workspace,p_platform,p_external_id,p_handle,p_display,p_avatar,
    p_access_token,p_refresh_token,p_expires_at,p_scopes,true,'connected',p_connected_by,COALESCE(p_meta,'{}'::jsonb),now())
  ON CONFLICT (workspace_id,platform,COALESCE(external_id,'')) DO UPDATE SET
    handle=EXCLUDED.handle, display_name=EXCLUDED.display_name, avatar_url=EXCLUDED.avatar_url,
    access_token=EXCLUDED.access_token, refresh_token=EXCLUDED.refresh_token,
    token_expires_at=EXCLUDED.token_expires_at, scopes=EXCLUDED.scopes,
    connected=true, status='connected', last_error=NULL, meta=EXCLUDED.meta, updated_at=now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;$function$;

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

CREATE OR REPLACE FUNCTION public.social_channels_for_publish(p_workspace uuid, p_platforms text[])
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(to_jsonb(c)),'[]'::jsonb)
  FROM (SELECT id, platform, external_id, handle, display_name,
               access_token, refresh_token, token_expires_at, meta
        FROM zoi.social_channels
        WHERE workspace_id=p_workspace AND connected IS TRUE
          AND (p_platforms IS NULL OR platform = ANY(p_platforms))) c;
$function$;

CREATE OR REPLACE FUNCTION public.social_target_record(p_post uuid, p_channel bigint, p_platform text, p_status text, p_external_id text, p_url text, p_error text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
  INSERT INTO zoi.social_post_targets(post_id,channel_id,platform,status,external_post_id,external_url,error,published_at,attempts,updated_at)
  VALUES(p_post,p_channel,p_platform,p_status,p_external_id,p_url,p_error,
         CASE WHEN p_status='published' THEN now() END,1,now());
$function$;

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

CREATE OR REPLACE FUNCTION public.social_channel_add(p_workspace uuid, p_platform text, p_handle text, p_display text DEFAULT NULL::text)
 RETURNS zoi.social_channels
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
DECLARE r zoi.social_channels;
BEGIN
  IF NOT zoi.is_ws_member(p_workspace) THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO zoi.social_channels (workspace_id, platform, handle, display_name, connected, status)
  VALUES (p_workspace, p_platform, p_handle, p_display, false, 'pending')
  ON CONFLICT (workspace_id, platform, handle) DO UPDATE SET display_name=EXCLUDED.display_name
  RETURNING * INTO r;
  RETURN r;
END; $function$;

CREATE OR REPLACE FUNCTION public.social_channels_list(p_workspace uuid)
 RETURNS TABLE(id bigint, platform text, handle text, display_name text, external_id text, avatar_url text, status text, connected boolean, expires_at timestamp with time zone, needs_reconnect boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
  SELECT id, platform, handle, display_name, external_id, avatar_url,
         COALESCE(status,'pending') AS status,
         COALESCE(connected,false) AS connected,
         token_expires_at AS expires_at,
         (COALESCE(connected,false) AND token_expires_at IS NOT NULL AND token_expires_at < now()) AS needs_reconnect
  FROM zoi.social_channels
  WHERE workspace_id = p_workspace
  ORDER BY created_at DESC NULLS LAST, id DESC;
$function$;

CREATE OR REPLACE FUNCTION public.social_channel_remove(p_workspace uuid, p_id bigint)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
  WITH d AS (DELETE FROM zoi.social_channels WHERE workspace_id=p_workspace AND id=p_id RETURNING 1)
  SELECT EXISTS(SELECT 1 FROM d);
$function$;

CREATE OR REPLACE FUNCTION public.social_oauth_state_put(p_state text, p_workspace uuid, p_platform text, p_profile uuid, p_return_to text, p_code_verifier text DEFAULT NULL::text, p_extra jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
  INSERT INTO zoi.social_oauth_states(state,workspace_id,platform,profile_id,return_to,code_verifier,extra)
  VALUES(p_state,p_workspace,p_platform,p_profile,p_return_to,p_code_verifier,COALESCE(p_extra,'{}'::jsonb));
$function$;

CREATE OR REPLACE FUNCTION public.social_oauth_state_take(p_state text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
DECLARE r jsonb;
BEGIN
  DELETE FROM zoi.social_oauth_states s
  WHERE s.state=p_state AND s.expires_at > now()
  RETURNING to_jsonb(s) INTO r;
  RETURN r;
END;$function$;

CREATE OR REPLACE FUNCTION public.social_cron_secret_get()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
  SELECT value FROM zoi.app_config WHERE key='social_cron_secret';
$function$;

do $$declare f record;begin for f in select oid::regprocedure sig from pg_proc where proname like 'social_%' loop execute 'grant execute on function '||f.sig||' to public,anon,authenticated,service_role';end loop;end$$;