-- Durable bounded attempts on the existing canonical target journal.
-- A dispatch permission is granted once. Lost permission/remote responses are
-- conservative unknown outcomes, never an automatic second provider request.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$BEGIN
 IF(SELECT md5(prosrc)FROM pg_proc WHERE oid='public.social_due_posts_current(integer)'::regprocedure)IS DISTINCT FROM'9cfe63d619792eaf732cbe12227be7d1'OR(SELECT proowner::regrole::text FROM pg_proc WHERE oid='public.social_due_posts_current(integer)'::regprocedure)IS DISTINCT FROM'postgres'OR(SELECT proacl::text FROM pg_proc WHERE oid='public.social_due_posts_current(integer)'::regprocedure)IS DISTINCT FROM'{postgres=X/postgres,service_role=X/postgres}'THEN RAISE EXCEPTION 'current_social_due_definition_or_acl_changed';END IF;
 IF(SELECT md5(prosrc)FROM pg_proc WHERE oid='public.social_delivery_snapshot(uuid,text,bigint)'::regprocedure)IS DISTINCT FROM'581d952e9c01e789932099fe96358336'OR(SELECT proowner::regrole::text FROM pg_proc WHERE oid='public.social_delivery_snapshot(uuid,text,bigint)'::regprocedure)IS DISTINCT FROM'postgres'OR(SELECT proacl::text FROM pg_proc WHERE oid='public.social_delivery_snapshot(uuid,text,bigint)'::regprocedure)IS DISTINCT FROM'{postgres=X/postgres,service_role=X/postgres}'THEN RAISE EXCEPTION 'current_social_snapshot_definition_or_acl_changed';END IF;
 IF(SELECT md5(prosrc)FROM pg_proc WHERE oid='public.social_post_finalize(uuid,text)'::regprocedure)IS DISTINCT FROM'64b27102647c2cb1d9392551a2403b6f'OR(SELECT proowner::regrole::text FROM pg_proc WHERE oid='public.social_post_finalize(uuid,text)'::regprocedure)IS DISTINCT FROM'postgres'OR(SELECT proacl::text FROM pg_proc WHERE oid='public.social_post_finalize(uuid,text)'::regprocedure)IS DISTINCT FROM'{postgres=X/postgres,service_role=X/postgres}'THEN RAISE EXCEPTION 'legacy_social_finalizer_definition_or_acl_changed';END IF;
END$$;
ALTER TABLE zoi.social_post_targets ADD COLUMN delivery_request uuid,ADD COLUMN delivery_workspace uuid,ADD COLUMN delivery_channel_id bigint,ADD COLUMN delivery_lease uuid,ADD COLUMN delivery_lease_until timestamptz,ADD COLUMN delivery_state text,ADD COLUMN delivery_payload_hash text,ADD COLUMN delivery_payload jsonb,ADD COLUMN delivery_channel jsonb,ADD COLUMN delivery_started_at timestamptz,ADD COLUMN delivery_result jsonb,ADD COLUMN delivery_provider_ref jsonb,ADD COLUMN delivery_steps jsonb NOT NULL DEFAULT'[]',ADD COLUMN delivery_reconciliation jsonb NOT NULL DEFAULT'[]';
ALTER TABLE zoi.social_post_targets ADD CONSTRAINT delivery_state_valid CHECK(delivery_state IS NULL OR delivery_state IN('prepared','dispatching','published','rejected','unknown','closed','abandoned'));
CREATE UNIQUE INDEX social_delivery_request_unique ON zoi.social_post_targets(delivery_request)WHERE delivery_request IS NOT NULL;
CREATE UNIQUE INDEX social_delivery_active_target_unique ON zoi.social_post_targets(post_id,delivery_channel_id)WHERE delivery_state IN('prepared','dispatching');
CREATE INDEX social_delivery_attempt_history ON zoi.social_post_targets(post_id,delivery_channel_id,created_at DESC)WHERE delivery_request IS NOT NULL;
CREATE INDEX social_delivery_expired_leases ON zoi.social_post_targets(delivery_lease_until,id)WHERE delivery_state IN('prepared','dispatching');
-- Old worker versions fail closed before fresh dispatch during rollout. Their
-- definitions are retained, with no automatic regrant after the new release.
REVOKE ALL ON FUNCTION public.social_due_posts_current(integer),public.social_delivery_snapshot(uuid,text,bigint),public.social_post_finalize(uuid,text)FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION zoi.social_attempt_public(t zoi.social_post_targets)RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',t.id,'post_id',t.post_id,'channel_id',coalesce(t.delivery_channel_id,t.channel_id),'channel',t.delivery_channel,'platform',t.platform,'payload_hash',t.delivery_payload_hash,'state',t.delivery_state,'status',t.status,'lease_until',t.delivery_lease_until,'started_at',t.delivery_started_at,'created_at',t.created_at,'external_id',t.external_post_id,'external_url',t.external_url,'result',t.delivery_result,'provider_ref',t.delivery_provider_ref,'steps',t.delivery_steps,'reconciliation',t.delivery_reconciliation,'error',t.error)
$$;
CREATE FUNCTION zoi.social_attempt_workspace(p_post uuid)RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ws uuid;
BEGIN SELECT workspace_id INTO ws FROM zoi.social_posts WHERE id=p_post;IF NOT FOUND THEN RAISE EXCEPTION 'post_not_found';END IF;PERFORM 1 FROM zoi.workspaces WHERE id=ws FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'no_access_to_workspace';END IF;IF NOT EXISTS(SELECT 1 FROM zoi.social_posts WHERE id=p_post AND workspace_id=ws)THEN RAISE EXCEPTION 'social_delivery_snapshot_changed';END IF;RETURN ws;END$$;
CREATE FUNCTION zoi.social_delivery_expire_post(p_post uuid)RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t zoi.social_post_targets;n integer:=0;
BEGIN PERFORM zoi.social_attempt_workspace(p_post);FOR t IN SELECT *FROM zoi.social_post_targets WHERE post_id=p_post AND delivery_state IN('prepared','dispatching')AND delivery_lease_until<=clock_timestamp()FOR UPDATE LOOP UPDATE zoi.social_post_targets SET delivery_state=CASE WHEN t.delivery_state='prepared'THEN'abandoned'ELSE'unknown'END,status=CASE WHEN t.delivery_state='prepared'THEN'failed'ELSE'unknown'END,error=CASE WHEN t.delivery_state='prepared'THEN'lease_expired_before_dispatch'ELSE'dispatch_result_unknown_requires_reconciliation'END,updated_at=clock_timestamp()WHERE id=t.id;n:=n+1;END LOOP;RETURN n;END$$;
CREATE FUNCTION public.social_delivery_attempts_expire(p_limit integer DEFAULT 50)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE pid uuid;n integer:=0;
BEGIN FOR pid IN SELECT DISTINCT post_id FROM zoi.social_post_targets WHERE delivery_state IN('prepared','dispatching')AND delivery_lease_until<=clock_timestamp()ORDER BY post_id LIMIT greatest(1,least(coalesce(p_limit,50),50))LOOP n:=n+zoi.social_delivery_expire_post(pid);END LOOP;RETURN jsonb_build_object('ok',true,'expired',n);END$$;
CREATE FUNCTION public.social_delivery_attempt_claim(p_post uuid,p_channel bigint,p_request uuid,p_seconds integer DEFAULT 120)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ws uuid;t zoi.social_post_targets;checked jsonb;current_hash text;
BEGIN
 IF p_request IS NULL OR p_channel IS NULL OR p_seconds IS NULL OR p_seconds NOT BETWEEN 30 AND 300 THEN RAISE EXCEPTION 'invalid_delivery_claim';END IF;
 ws:=zoi.social_attempt_workspace(p_post);
 SELECT *INTO t FROM zoi.social_post_targets WHERE delivery_request=p_request FOR UPDATE;
 IF FOUND THEN IF t.post_id<>p_post OR t.delivery_channel_id<>p_channel OR t.delivery_workspace<>ws THEN RAISE EXCEPTION 'delivery_request_conflict';END IF;RETURN jsonb_build_object('ok',true,'claimed',t.delivery_state='prepared'AND t.delivery_lease_until>clock_timestamp(),'attempt',zoi.social_attempt_public(t),'lease',CASE WHEN t.delivery_state='prepared'AND t.delivery_lease_until>clock_timestamp()THEN t.delivery_lease END,'payload',t.delivery_payload,'replayed',true);END IF;
 -- Serialize lease replacement and record expiration without any provider call.
 FOR t IN SELECT *FROM zoi.social_post_targets WHERE post_id=p_post AND delivery_channel_id=p_channel AND delivery_state IN('prepared','dispatching')FOR UPDATE LOOP
  IF t.delivery_lease_until>clock_timestamp()THEN RETURN jsonb_build_object('ok',true,'claimed',false,'reason','busy','attempt',zoi.social_attempt_public(t));END IF;
  UPDATE zoi.social_post_targets SET delivery_state=CASE WHEN t.delivery_state='prepared'THEN'abandoned'ELSE'unknown'END,status=CASE WHEN t.delivery_state='prepared'THEN'failed'ELSE'unknown'END,error=CASE WHEN t.delivery_state='prepared'THEN'lease_expired_before_dispatch'ELSE'dispatch_result_unknown_requires_reconciliation'END,updated_at=clock_timestamp()WHERE id=t.id;
 END LOOP;
 IF EXISTS(SELECT 1 FROM zoi.social_post_targets WHERE post_id=p_post AND(status='unknown'OR delivery_state='closed'))THEN RETURN jsonb_build_object('ok',true,'claimed',false,'reason','reconciliation_required');END IF;
 SELECT *INTO t FROM zoi.social_post_targets WHERE post_id=p_post AND(channel_id=p_channel OR delivery_channel_id=p_channel)AND status='published'ORDER BY created_at DESC LIMIT 1;
 IF FOUND THEN SELECT zoi.social_delivery_payload_hash(p)INTO current_hash FROM zoi.social_posts p WHERE id=p_post AND workspace_id=ws;RETURN jsonb_build_object('ok',true,'claimed',false,'reason',CASE WHEN t.delivery_payload_hash IS NOT NULL AND t.delivery_payload_hash=current_hash THEN'already_delivered'ELSE'prior_delivery_payload_changed'END,'attempt',zoi.social_attempt_public(t));END IF;
 IF(SELECT count(*)FROM zoi.social_post_targets WHERE post_id=p_post AND delivery_channel_id=p_channel AND delivery_request IS NOT NULL AND created_at>clock_timestamp()-interval'24 hours')>=3 THEN RETURN jsonb_build_object('ok',true,'claimed',false,'reason','daily_attempt_limit');END IF;
 PERFORM zoi.social_delivery_snapshot(p_post,true,NULL,ws);
 checked:=public.social_delivery_snapshot(p_post,NULL,p_channel);
 INSERT INTO zoi.social_post_targets(post_id,channel_id,platform,status,attempts,delivery_request,delivery_workspace,delivery_channel_id,delivery_lease,delivery_lease_until,delivery_state,delivery_payload_hash,delivery_payload,delivery_channel)
 VALUES(p_post,p_channel,checked#>>'{channel,platform}','pending',1,p_request,ws,p_channel,gen_random_uuid(),clock_timestamp()+make_interval(secs=>p_seconds),'prepared',checked->>'payload_hash',checked->'post',jsonb_build_object('id',p_channel,'platform',checked#>>'{channel,platform}','external_id',checked#>>'{channel,external_id}','display_name',(SELECT to_jsonb(c)->>'display_name'FROM zoi.social_channels c WHERE c.id=p_channel),'handle',(SELECT to_jsonb(c)->>'handle'FROM zoi.social_channels c WHERE c.id=p_channel)))RETURNING *INTO t;
 RETURN jsonb_build_object('ok',true,'claimed',true,'attempt',zoi.social_attempt_public(t),'lease',t.delivery_lease,'payload',t.delivery_payload,'replayed',false);
END$$;
CREATE FUNCTION public.social_delivery_attempt_begin(p_attempt uuid,p_lease uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t zoi.social_post_targets;ws uuid;checked jsonb;
BEGIN
 SELECT *INTO t FROM zoi.social_post_targets WHERE id=p_attempt;IF t.delivery_request IS NULL THEN RAISE EXCEPTION 'delivery_attempt_not_found';END IF;
 ws:=zoi.social_attempt_workspace(t.post_id);SELECT *INTO t FROM zoi.social_post_targets WHERE id=p_attempt FOR UPDATE;
 IF t.delivery_workspace<>ws OR t.delivery_lease IS DISTINCT FROM p_lease THEN RAISE EXCEPTION 'delivery_lease_conflict';END IF;
 IF t.delivery_state<>'prepared'OR t.delivery_lease_until<=clock_timestamp()THEN RETURN jsonb_build_object('ok',true,'dispatch',false,'attempt',zoi.social_attempt_public(t));END IF;
 PERFORM zoi.social_delivery_snapshot(t.post_id,true,t.delivery_payload_hash,ws);
 checked:=public.social_delivery_snapshot(t.post_id,t.delivery_payload_hash,t.delivery_channel_id);
 IF checked#>>'{channel,platform}'IS DISTINCT FROM t.delivery_channel->>'platform'OR checked#>>'{channel,external_id}'IS DISTINCT FROM t.delivery_channel->>'external_id'THEN RAISE EXCEPTION 'delivery_channel_identity_changed';END IF;
 UPDATE zoi.social_post_targets SET delivery_state='dispatching',delivery_started_at=clock_timestamp(),delivery_lease_until=clock_timestamp()+interval'120 seconds',updated_at=clock_timestamp()WHERE id=t.id RETURNING *INTO t;
 -- This permission is returned once, even for identical request replay. A lost
 -- begin response cannot be converted into a second permission to send.
 RETURN jsonb_build_object('ok',true,'dispatch',true,'attempt',zoi.social_attempt_public(t),'post',checked->'post','channel',checked->'channel');
END$$;
CREATE FUNCTION public.social_delivery_attempt_record(p_attempt uuid,p_lease uuid,p_result jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t zoi.social_post_targets;ws uuid;outcome text;
BEGIN
 IF jsonb_typeof(p_result)IS DISTINCT FROM'object'OR octet_length(p_result::text)>2000 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_result)k WHERE k NOT IN('outcome','external_id','external_url','error_code'))THEN RAISE EXCEPTION 'invalid_delivery_result';END IF;
 outcome:=p_result->>'outcome';IF outcome IS NULL OR outcome NOT IN('published','rejected','unknown')OR(outcome='published'AND (coalesce(p_result->>'external_id','')!~'^[A-Za-z0-9:_-]+$'OR char_length(coalesce(p_result->>'external_id',''))NOT BETWEEN 1 AND 500))OR(p_result?'external_url'AND p_result->>'external_url'IS NOT NULL AND(p_result->>'external_url'!~'^https://(www\.)?(facebook\.com|linkedin\.com|twitter\.com|x\.com|instagram\.com|youtube\.com|tiktok\.com)/'OR p_result->>'external_url'~*'(access_token|refresh_token|authorization|secret)'))OR(p_result?'error_code'AND coalesce(p_result->>'error_code','')!~'^[a-z_]{1,80}$')THEN RAISE EXCEPTION 'invalid_delivery_result';END IF;
 SELECT *INTO t FROM zoi.social_post_targets WHERE id=p_attempt;IF t.delivery_request IS NULL THEN RAISE EXCEPTION 'delivery_attempt_not_found';END IF;
 ws:=zoi.social_attempt_workspace(t.post_id);SELECT *INTO t FROM zoi.social_post_targets WHERE id=p_attempt FOR UPDATE;
 IF t.delivery_workspace<>ws OR t.delivery_lease IS DISTINCT FROM p_lease THEN RAISE EXCEPTION 'delivery_lease_conflict';END IF;
 IF t.delivery_result IS NOT NULL THEN IF t.delivery_result IS DISTINCT FROM p_result THEN RAISE EXCEPTION 'delivery_result_conflict';END IF;RETURN jsonb_build_object('ok',true,'attempt',zoi.social_attempt_public(t),'replayed',true);END IF;
 IF t.delivery_state NOT IN('dispatching','unknown','closed')THEN RAISE EXCEPTION 'delivery_was_not_dispatched';END IF;
 -- Recording the fact of an already dispatched result must survive later team,
 -- client or source revocation. It authorizes no new remote side effect.
 UPDATE zoi.social_post_targets SET delivery_result=p_result,delivery_state=CASE WHEN delivery_state='closed'THEN'closed'ELSE outcome END,status=CASE WHEN outcome='rejected'THEN'failed'ELSE outcome END,external_post_id=CASE WHEN outcome='published'THEN p_result->>'external_id'END,external_url=CASE WHEN outcome='published'THEN p_result->>'external_url'END,published_at=CASE WHEN outcome='published'THEN clock_timestamp()END,error=p_result->>'error_code',updated_at=clock_timestamp()WHERE id=t.id RETURNING *INTO t;
 RETURN jsonb_build_object('ok',true,'attempt',zoi.social_attempt_public(t),'replayed',false);
END$$;
CREATE FUNCTION public.social_delivery_attempt_get(p_post uuid,p_channel bigint,p_request uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t zoi.social_post_targets;ws uuid;
BEGIN ws:=zoi.social_attempt_workspace(p_post);SELECT *INTO t FROM zoi.social_post_targets WHERE delivery_request=p_request AND post_id=p_post AND delivery_channel_id=p_channel AND delivery_workspace=ws;IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'found',false);END IF;RETURN jsonb_build_object('ok',true,'found',true,'attempt',zoi.social_attempt_public(t),'payload',t.delivery_payload,'lease',CASE WHEN t.delivery_state='prepared'AND t.delivery_lease_until>clock_timestamp()THEN t.delivery_lease END);END$$;
CREATE FUNCTION public.social_delivery_attempt_cancel(p_attempt uuid,p_lease uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t zoi.social_post_targets;ws uuid;
BEGIN SELECT *INTO t FROM zoi.social_post_targets WHERE id=p_attempt;IF t.delivery_request IS NULL THEN RAISE EXCEPTION 'delivery_attempt_not_found';END IF;ws:=zoi.social_attempt_workspace(t.post_id);SELECT *INTO t FROM zoi.social_post_targets WHERE id=p_attempt FOR UPDATE;IF t.delivery_workspace<>ws OR t.delivery_lease IS DISTINCT FROM p_lease THEN RAISE EXCEPTION 'delivery_lease_conflict';END IF;IF t.delivery_state='prepared'THEN UPDATE zoi.social_post_targets SET delivery_state='abandoned',status='failed',error='cancelled_before_dispatch',updated_at=clock_timestamp()WHERE id=t.id RETURNING *INTO t;END IF;RETURN jsonb_build_object('ok',true,'cancelled',t.delivery_state='abandoned','attempt',zoi.social_attempt_public(t));END$$;
CREATE FUNCTION public.social_delivery_attempt_checkpoint(p_attempt uuid,p_lease uuid,p_ref jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t zoi.social_post_targets;ws uuid;
BEGIN IF jsonb_typeof(p_ref)IS DISTINCT FROM'object'OR p_ref->>'kind'IS DISTINCT FROM'instagram_container'OR coalesce(p_ref->>'id','')!~'^[0-9]{1,100}$'OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_ref)k WHERE k NOT IN('kind','id'))THEN RAISE EXCEPTION 'invalid_provider_checkpoint';END IF;SELECT *INTO t FROM zoi.social_post_targets WHERE id=p_attempt;IF t.delivery_request IS NULL THEN RAISE EXCEPTION 'delivery_attempt_not_found';END IF;ws:=zoi.social_attempt_workspace(t.post_id);SELECT *INTO t FROM zoi.social_post_targets WHERE id=p_attempt FOR UPDATE;IF t.delivery_workspace<>ws OR t.delivery_lease IS DISTINCT FROM p_lease OR t.platform<>'instagram'OR t.delivery_state NOT IN('dispatching','unknown','closed')THEN RAISE EXCEPTION 'delivery_lease_conflict';END IF;IF t.delivery_provider_ref IS NOT NULL AND t.delivery_provider_ref IS DISTINCT FROM p_ref THEN RAISE EXCEPTION 'provider_checkpoint_conflict';END IF;UPDATE zoi.social_post_targets SET delivery_provider_ref=p_ref,updated_at=clock_timestamp()WHERE id=t.id RETURNING *INTO t;RETURN jsonb_build_object('ok',true,'attempt',zoi.social_attempt_public(t));END$$;
CREATE FUNCTION public.social_delivery_attempt_step(p_attempt uuid,p_lease uuid,p_step text)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t zoi.social_post_targets;ws uuid;checked jsonb;
BEGIN
 IF p_step IS DISTINCT FROM'instagram_publish'THEN RAISE EXCEPTION 'invalid_delivery_step';END IF;
 SELECT *INTO t FROM zoi.social_post_targets WHERE id=p_attempt;IF t.delivery_request IS NULL THEN RAISE EXCEPTION 'delivery_attempt_not_found';END IF;ws:=zoi.social_attempt_workspace(t.post_id);SELECT *INTO t FROM zoi.social_post_targets WHERE id=p_attempt FOR UPDATE;
 IF t.delivery_workspace<>ws OR t.delivery_lease IS DISTINCT FROM p_lease OR t.platform<>'instagram'OR t.delivery_provider_ref->>'kind'IS DISTINCT FROM'instagram_container'THEN RAISE EXCEPTION 'delivery_lease_conflict';END IF;
 IF t.delivery_state<>'dispatching'OR t.delivery_lease_until<=clock_timestamp()OR EXISTS(SELECT 1 FROM jsonb_array_elements(t.delivery_steps)v WHERE v->>'step'=p_step)THEN RETURN jsonb_build_object('ok',true,'dispatch',false,'attempt',zoi.social_attempt_public(t));END IF;
 PERFORM zoi.social_delivery_snapshot(t.post_id,true,t.delivery_payload_hash,ws);checked:=public.social_delivery_snapshot(t.post_id,t.delivery_payload_hash,t.delivery_channel_id);
 IF checked#>>'{channel,platform}'IS DISTINCT FROM t.delivery_channel->>'platform'OR checked#>>'{channel,external_id}'IS DISTINCT FROM t.delivery_channel->>'external_id'THEN RAISE EXCEPTION 'delivery_channel_identity_changed';END IF;
 UPDATE zoi.social_post_targets SET delivery_steps=delivery_steps||jsonb_build_array(jsonb_build_object('step',p_step,'at',clock_timestamp())),updated_at=clock_timestamp()WHERE id=t.id RETURNING *INTO t;
 RETURN jsonb_build_object('ok',true,'dispatch',true,'attempt',zoi.social_attempt_public(t),'post',checked->'post','channel',checked->'channel');
END$$;
CREATE FUNCTION public.social_delivery_due_attempts(p_limit integer DEFAULT 50)RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb)FROM(SELECT id,workspace_id,author_profile,body,media,channels,meta,scheduled_at,nameday_ref,zoi.social_delivery_payload_hash(p)AS payload_hash FROM zoi.social_posts p WHERE status='scheduled'AND scheduled_at<=clock_timestamp()AND NOT EXISTS(SELECT 1 FROM zoi.social_post_targets t WHERE t.post_id=p.id AND(t.status='unknown'OR t.delivery_state='closed'OR(t.delivery_state IN('prepared','dispatching')AND t.delivery_lease_until>clock_timestamp())))ORDER BY scheduled_at,id LIMIT greatest(1,least(coalesce(p_limit,50),50)))p
$$;
-- Newly inserted Community facts capture their canonical payload. Historical
-- ledger rows stay NULL: existence alone does not prove the current copy sent.
ALTER TABLE zoi.community_post_deliveries ADD COLUMN delivery_payload_hash text;
CREATE FUNCTION zoi.community_delivery_payload_capture()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN SELECT zoi.social_delivery_payload_hash(p)INTO NEW.delivery_payload_hash FROM zoi.social_posts p WHERE p.id=NEW.social_post_id;RETURN NEW;END$$;
CREATE TRIGGER community_delivery_payload_capture BEFORE INSERT ON zoi.community_post_deliveries FOR EACH ROW EXECUTE FUNCTION zoi.community_delivery_payload_capture();
REVOKE ALL ON FUNCTION zoi.community_delivery_payload_capture()FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.social_delivery_attempts_finalize(p_post uuid,p_expected_hash text,p_status text)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ws uuid;p zoi.social_posts;code text;platform_value text;ch zoi.social_channels;n integer;
BEGIN
 IF p_expected_hash IS NULL OR p_status NOT IN('published','failed')THEN RAISE EXCEPTION 'invalid_delivery_finalization';END IF;
 ws:=zoi.social_attempt_workspace(p_post);p:=zoi.social_delivery_snapshot(p_post,true,p_expected_hash,ws);
 IF p_status='failed'AND EXISTS(SELECT 1 FROM zoi.social_post_targets WHERE post_id=p.id AND delivery_state IN('prepared','dispatching')AND delivery_lease_until>clock_timestamp())THEN RAISE EXCEPTION 'delivery_in_progress';END IF;
 IF p_status='published'THEN
  IF coalesce(cardinality(p.channels),0)=0 THEN RAISE EXCEPTION 'delivery_receipts_incomplete';END IF;
  FOREACH code IN ARRAY p.channels LOOP
   IF code IN('zoi','community')THEN
    IF NOT EXISTS(SELECT 1 FROM zoi.community_post_deliveries WHERE social_post_id=p.id AND delivery_payload_hash=p_expected_hash)THEN RAISE EXCEPTION 'delivery_receipts_incomplete';END IF;
   ELSE
    platform_value:=CASE code WHEN'fb'THEN'facebook'WHEN'ig'THEN'instagram'WHEN'li'THEN'linkedin'WHEN'x'THEN'twitter'WHEN'tt'THEN'tiktok'WHEN'yt'THEN'youtube'ELSE code END;n:=0;
    FOR ch IN SELECT *FROM zoi.social_channels WHERE workspace_id=ws AND(id::text=code OR platform=platform_value)LOOP
     n:=n+1;
     IF NOT EXISTS(SELECT 1 FROM zoi.social_post_targets t WHERE t.post_id=p.id AND t.delivery_channel_id=ch.id AND t.delivery_payload_hash=p_expected_hash AND t.delivery_state='published'AND t.status='published'AND t.delivery_result->>'outcome'='published')THEN RAISE EXCEPTION 'delivery_receipts_incomplete';END IF;
    END LOOP;
    IF n=0 THEN RAISE EXCEPTION 'delivery_receipts_incomplete';END IF;
   END IF;
  END LOOP;
 END IF;
 UPDATE zoi.social_posts SET status=p_status,published_at=CASE WHEN p_status='published'THEN clock_timestamp()ELSE NULL END WHERE id=p.id;
 RETURN jsonb_build_object('ok',true,'post_id',p.id,'payload_hash',p_expected_hash,'status',p_status);
END$$;
REVOKE ALL ON FUNCTION public.social_delivery_attempts_finalize(uuid,text,text)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.social_delivery_attempts_finalize(uuid,text,text)TO service_role;
CREATE FUNCTION zoi.social_delivery_history_retained()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF TG_OP='UPDATE'THEN IF NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN IF EXISTS(SELECT 1 FROM zoi.social_post_targets WHERE post_id=OLD.id AND delivery_request IS NOT NULL)THEN RAISE EXCEPTION 'social_delivery_post_scope_immutable';END IF;END IF;RETURN NEW;END IF;IF EXISTS(SELECT 1 FROM zoi.social_post_targets WHERE post_id=OLD.id AND(delivery_request IS NOT NULL OR status='unknown'))THEN RAISE EXCEPTION 'delivery_history_requires_draft_instead_of_delete';END IF;RETURN OLD;END$$;
CREATE TRIGGER social_delivery_history_retained BEFORE DELETE OR UPDATE ON zoi.social_posts FOR EACH ROW EXECUTE FUNCTION zoi.social_delivery_history_retained();
CREATE FUNCTION public.social_delivery_attempts_get(p_workspace uuid,p_post uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p zoi.social_posts;client uuid;t zoi.social_post_targets;items jsonb:='[]';
BEGIN PERFORM zoi.assert_workspace_write(p_workspace);SELECT *INTO p FROM zoi.social_posts WHERE id=p_post AND workspace_id=p_workspace;IF NOT FOUND THEN RAISE EXCEPTION 'post_not_found';END IF;client:=nullif(p.meta->>'client_listing_id','')::uuid;IF client IS NOT NULL THEN PERFORM zoi.home_content_authorize(p_workspace,client);END IF;PERFORM zoi.social_delivery_expire_post(p_post);FOR t IN SELECT *FROM zoi.social_post_targets WHERE post_id=p_post ORDER BY created_at DESC,id LIMIT 100 LOOP client:=nullif(t.delivery_payload#>>'{meta,client_listing_id}','')::uuid;IF client IS NOT NULL THEN PERFORM zoi.home_content_authorize(p_workspace,client);END IF;items:=items||jsonb_build_array(zoi.social_attempt_public(t));END LOOP;RETURN jsonb_build_object('ok',true,'workspace',p_workspace,'post_id',p_post,'attempts',items,'has_more',(SELECT count(*)>100 FROM zoi.social_post_targets WHERE post_id=p_post));END$$;
CREATE FUNCTION public.social_delivery_reconcile(p_workspace uuid,p_attempt uuid,p_request uuid,p_action text,p_details jsonb DEFAULT'{}')RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t zoi.social_post_targets;actor uuid;entry jsonb;prior jsonb;p zoi.social_posts;client uuid;
BEGIN
 IF p_request IS NULL OR p_action IS NULL OR p_action NOT IN('close_without_retry','report_existing_post')OR jsonb_typeof(p_details)IS DISTINCT FROM'object'OR octet_length(p_details::text)>2000 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_details)k WHERE k NOT IN('url','note'))OR(p_details?'url'AND (coalesce(p_details->>'url','')!~'^https://(www\.)?(facebook\.com|linkedin\.com|twitter\.com|x\.com|instagram\.com|youtube\.com|tiktok\.com)/'OR p_details->>'url'~*'[?&#](access_token|refresh_token|authorization|secret|api_key)='))OR char_length(coalesce(p_details->>'note',''))>500 THEN RAISE EXCEPTION 'invalid_delivery_reconciliation';END IF;
 PERFORM zoi.assert_workspace_write(p_workspace);SELECT id INTO actor FROM zoi.user_profiles WHERE auth_user_id=auth.uid();
 SELECT *INTO t FROM zoi.social_post_targets WHERE id=p_attempt;IF NOT FOUND OR(t.delivery_workspace IS NOT NULL AND t.delivery_workspace<>p_workspace)THEN RAISE EXCEPTION 'delivery_attempt_not_found';END IF;SELECT *INTO p FROM zoi.social_posts WHERE id=t.post_id AND workspace_id=p_workspace;IF NOT FOUND THEN RAISE EXCEPTION 'post_not_found';END IF;client:=nullif(coalesce(t.delivery_payload#>>'{meta,client_listing_id}',p.meta->>'client_listing_id'),'')::uuid;IF client IS NOT NULL THEN PERFORM zoi.home_content_authorize(p_workspace,client);END IF;
 SELECT *INTO t FROM zoi.social_post_targets WHERE id=p_attempt FOR UPDATE;
 SELECT v INTO prior FROM jsonb_array_elements(t.delivery_reconciliation)v WHERE v->>'request_id'=p_request::text;
 IF FOUND THEN IF prior->>'action'IS DISTINCT FROM p_action OR prior->'details'IS DISTINCT FROM p_details OR prior->>'actor'IS DISTINCT FROM actor::text THEN RAISE EXCEPTION 'delivery_reconciliation_request_conflict';END IF;RETURN jsonb_build_object('ok',true,'attempt',zoi.social_attempt_public(t),'replayed',true);END IF;
 IF coalesce(t.delivery_state,t.status)NOT IN('unknown','closed')THEN RAISE EXCEPTION 'delivery_not_in_reconciliation';END IF;
 IF jsonb_array_length(t.delivery_reconciliation)>=20 THEN RAISE EXCEPTION 'delivery_reconciliation_limit';END IF;
 entry:=jsonb_build_object('request_id',p_request,'actor',actor,'action',p_action,'details',p_details,'at',clock_timestamp(),'evidence_state','owner_reported');
 UPDATE zoi.social_post_targets SET delivery_reconciliation=delivery_reconciliation||jsonb_build_array(entry),delivery_workspace=coalesce(delivery_workspace,p_workspace),delivery_channel_id=coalesce(delivery_channel_id,channel_id),delivery_state=CASE WHEN p_action='close_without_retry'THEN'closed'ELSE coalesce(delivery_state,'unknown')END,updated_at=clock_timestamp()WHERE id=t.id RETURNING *INTO t;
 -- Owner reporting is not independent provider verification and never releases
 -- the unknown target for another automatic send or marks it published.
 RETURN jsonb_build_object('ok',true,'attempt',zoi.social_attempt_public(t),'replayed',false);
END$$;
REVOKE ALL ON FUNCTION zoi.social_attempt_public(zoi.social_post_targets),zoi.social_attempt_workspace(uuid),zoi.social_delivery_history_retained(),zoi.social_delivery_expire_post(uuid)FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.social_delivery_attempt_claim(uuid,bigint,uuid,integer),public.social_delivery_attempt_begin(uuid,uuid),public.social_delivery_attempt_record(uuid,uuid,jsonb),public.social_delivery_attempt_get(uuid,bigint,uuid),public.social_delivery_attempt_cancel(uuid,uuid),public.social_delivery_attempt_checkpoint(uuid,uuid,jsonb),public.social_delivery_attempt_step(uuid,uuid,text),public.social_delivery_due_attempts(integer),public.social_delivery_attempts_expire(integer)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.social_delivery_attempt_claim(uuid,bigint,uuid,integer),public.social_delivery_attempt_begin(uuid,uuid),public.social_delivery_attempt_record(uuid,uuid,jsonb),public.social_delivery_attempt_get(uuid,bigint,uuid),public.social_delivery_attempt_cancel(uuid,uuid),public.social_delivery_attempt_checkpoint(uuid,uuid,jsonb),public.social_delivery_attempt_step(uuid,uuid,text),public.social_delivery_due_attempts(integer),public.social_delivery_attempts_expire(integer)TO service_role;
REVOKE ALL ON FUNCTION public.social_delivery_attempts_get(uuid,uuid),public.social_delivery_reconcile(uuid,uuid,uuid,text,jsonb)FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.social_delivery_attempts_get(uuid,uuid),public.social_delivery_reconcile(uuid,uuid,uuid,text,jsonb)TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
