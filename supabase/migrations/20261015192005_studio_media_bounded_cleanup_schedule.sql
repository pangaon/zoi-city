BEGIN;
SET LOCAL lock_timeout='2s';SET LOCAL statement_timeout='5s';
-- Reuse the canonical Studio grant/cancel/cleanup writers. This scheduler never
-- deletes an object or edits an asset/post itself, and exposes no public RPC.
DO $guard$
DECLARE item record;
BEGIN
 IF to_regprocedure('zoi.studio_media_schedule_cleanup()')IS NOT NULL OR EXISTS(SELECT 1 FROM cron.job WHERE jobname='zoi-studio-media-cleanup')THEN RAISE EXCEPTION 'studio_cleanup_schedule_already_exists';END IF;
 FOR item IN SELECT * FROM(VALUES
 ('public.studio_media_cleanup_candidates()','2687ec2fbdb2a17e9945da729cf59c1d'),
 ('public.studio_media_cleanup_plan(uuid)','0d8893d412903ecf29d26925c212fad6'),
 ('public.studio_media_cleanup_finish(uuid)','f7c7a92ad3d3e2b8b0489ef65514f6bf'))v(signature,digest)LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(item.signature)AND md5(pg_get_functiondef(p.oid))=item.digest AND p.proowner='postgres'::regrole AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']::text[] AND p.proacl::text='{postgres=X/postgres,service_role=X/postgres}')THEN RAISE EXCEPTION 'studio_cleanup_contract_changed:%',item.signature;END IF;
 END LOOP;
 IF(SELECT count(*)FROM vault.secrets WHERE name='service_role_key')<>1 THEN RAISE EXCEPTION 'studio_cleanup_service_configuration_required';END IF;
END$guard$;
CREATE FUNCTION zoi.studio_media_schedule_cleanup()RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $fn$
DECLARE candidates jsonb;credential text;request_id bigint;
BEGIN
 IF NOT pg_try_advisory_xact_lock(hashtextextended('zoi-studio-media-cleanup-schedule',0))THEN RETURN NULL;END IF;
 candidates:=public.studio_media_cleanup_candidates();
 IF jsonb_typeof(candidates)IS DISTINCT FROM 'array'OR jsonb_array_length(candidates)>20 OR EXISTS(SELECT 1 FROM jsonb_array_elements(candidates)value WHERE jsonb_typeof(value)IS DISTINCT FROM 'string'OR(value#>>'{}')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')THEN RAISE EXCEPTION 'studio_cleanup_candidates_invalid';END IF;
 IF jsonb_array_length(candidates)=0 THEN RETURN NULL;END IF;
 IF EXISTS(SELECT 1 FROM net.http_request_queue WHERE url='https://csebihpaychdkanjjsmz.supabase.co/functions/v1/studio-media?action=cleanup')THEN RETURN NULL;END IF;
 SELECT decrypted_secret INTO STRICT credential FROM vault.decrypted_secrets WHERE name='service_role_key';
 IF credential IS NULL OR length(credential)NOT BETWEEN 20 AND 4096 OR credential~'[[:space:]]'THEN RAISE EXCEPTION 'studio_cleanup_service_configuration_required';END IF;
 SELECT net.http_post(url:='https://csebihpaychdkanjjsmz.supabase.co/functions/v1/studio-media?action=cleanup',headers:=jsonb_build_object('Content-Type','application/json','apikey',credential,'Authorization','Bearer '||credential),body:='{}'::jsonb,timeout_milliseconds:=90000)INTO request_id;
 RETURN request_id;
END$fn$;
ALTER FUNCTION zoi.studio_media_schedule_cleanup()OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.studio_media_schedule_cleanup()FROM PUBLIC,anon,authenticated,service_role;
SELECT cron.schedule('zoi-studio-media-cleanup','3,18,33,48 * * * *','select zoi.studio_media_schedule_cleanup();');
COMMIT;
