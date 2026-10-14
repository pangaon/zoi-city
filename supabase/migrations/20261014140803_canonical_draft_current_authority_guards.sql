BEGIN;
SET LOCAL lock_timeout='3s';
DO $preflight$DECLARE item record;BEGIN
 IF to_regprocedure('zoi.assert_workspace_write(uuid,text[])')IS NULL OR to_regclass('zoi.ai_generation_draft_links')IS NULL OR to_regclass('zoi.editorial_draft_links')IS NULL THEN RAISE EXCEPTION 'linked_draft_authority_dependency_unavailable';END IF;
 FOR item IN SELECT *FROM(VALUES
 ('public.ai_generation_draft_save(uuid,uuid,integer,uuid,jsonb)','4536cb73362380e3f3ffe92ede8de20a'),
 ('zoi.editorial_draft_actor(uuid)','3e2d9e628b4d9b7eced3628a675492dc'),
 ('zoi.editorial_schedule_source_guard()','cd3e46d3fc6108de52a97614db2b18d0'))v(signature,expected)LOOP
 IF md5(pg_get_functiondef(item.signature::regprocedure))<>item.expected THEN RAISE EXCEPTION 'linked_draft_authority_contract_changed:%',item.signature;END IF;
 END LOOP;
END $preflight$;
-- The shared foundation serializes workspace first, current member/real-owner
-- fallback next, then locks the actual auth session before any profile lock.
CREATE OR REPLACE FUNCTION zoi.editorial_draft_actor(p_workspace uuid)RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE actor uuid;BEGIN
 PERFORM zoi.assert_workspace_write(p_workspace);
 SELECT up.id INTO actor FROM zoi.user_profiles up WHERE up.auth_user_id=auth.uid()FOR SHARE OF up;
 IF actor IS NULL THEN RAISE EXCEPTION 'editorial_not_authorized' USING ERRCODE='42501';END IF;
 PERFORM zoi.suite_current_session();RETURN actor;
END$$;
CREATE OR REPLACE FUNCTION public.ai_generation_draft_save(p_workspace uuid,p_generation uuid,p_item integer,p_request uuid,p_context jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor_profile uuid;actor_role text;g zoi.ai_generations;l zoi.ai_generation_draft_links;prior zoi.ai_generation_draft_receipts;post zoi.social_posts;current_post zoi.social_posts;body text;context_value jsonb;client_listing uuid;meta jsonb;already boolean:=false;
BEGIN
 PERFORM zoi.assert_workspace_write(p_workspace);
 PERFORM zoi.suite_current_session();
 SELECT up.id INTO actor_profile FROM zoi.user_profiles up WHERE up.auth_user_id=auth.uid() FOR SHARE OF up;
 IF actor_profile IS NULL THEN RAISE EXCEPTION 'ai_draft_not_authorized' USING ERRCODE='42501';END IF;
 IF p_generation IS NULL OR p_request IS NULL OR p_item IS NULL OR p_item NOT BETWEEN 0 AND 13 OR jsonb_typeof(p_context)IS DISTINCT FROM'object' OR octet_length(p_context::text)>2000
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_context)k WHERE k NOT IN('campaign','listing'))
 OR (p_context?'campaign'AND jsonb_typeof(p_context->'campaign')NOT IN('string','null'))
 OR char_length(coalesce(p_context->>'campaign',''))>200
 OR (p_context?'listing'AND p_context->'listing'<>'null'::jsonb AND (jsonb_typeof(p_context->'listing')<>'string'OR p_context->>'listing'!~'^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$')) THEN RAISE EXCEPTION 'invalid_ai_draft_context';END IF;
 client_listing:=nullif(p_context->>'listing','')::uuid;
 IF client_listing IS NOT NULL THEN PERFORM zoi.home_content_authorize(p_workspace,client_listing);END IF;
 context_value:=jsonb_strip_nulls(jsonb_build_object('campaign',nullif(btrim(p_context->>'campaign'),''),'listing',client_listing));
 PERFORM pg_advisory_xact_lock(hashtextextended('ai-draft-request:'||p_request::text,0));
 SELECT *INTO prior FROM zoi.ai_generation_draft_receipts WHERE request_id=p_request;
 IF FOUND THEN
  IF prior.actor_auth IS DISTINCT FROM auth.uid() OR prior.workspace_id IS DISTINCT FROM p_workspace OR prior.generation_id IS DISTINCT FROM p_generation OR prior.item_index IS DISTINCT FROM p_item OR prior.context IS DISTINCT FROM context_value THEN RAISE EXCEPTION 'ai_draft_request_conflict';END IF;
  SELECT *INTO l FROM zoi.ai_generation_draft_links WHERE id=prior.link_id;
  SELECT *INTO current_post FROM zoi.social_posts WHERE id=l.post_id AND workspace_id=p_workspace;
  PERFORM zoi.suite_current_session();
  RETURN jsonb_build_object('ok',true,'workspace',p_workspace,'generation_id',p_generation,'item_index',p_item,'request_id',p_request,'post_snapshot',prior.post_snapshot,'post',CASE WHEN current_post.id IS NULL THEN NULL ELSE to_jsonb(current_post)END,'status',CASE WHEN current_post.id IS NULL THEN'removed'ELSE'saved'END,'already_saved',true,'replayed',true);
 END IF;
 SELECT *INTO g FROM zoi.ai_generations WHERE id=p_generation AND workspace_id=p_workspace FOR UPDATE;
 IF g.id IS NULL OR g.status<>'succeeded' THEN RAISE EXCEPTION 'ai_generation_not_ready';END IF;
 IF g.action='week'AND jsonb_typeof(g.result)='array'AND p_item<jsonb_array_length(g.result)THEN body:=g.result->p_item->>'text';
 ELSIF g.action IN('caption','reply')AND p_item=0 AND jsonb_typeof(g.result)='object'THEN body:=g.result->>'text';ELSE RAISE EXCEPTION 'invalid_ai_draft_item';END IF;
 IF body IS NULL OR char_length(btrim(body))=0 OR char_length(body)>2000 OR octet_length(body)>8000 THEN RAISE EXCEPTION 'invalid_ai_draft_item';END IF;
 SELECT *INTO l FROM zoi.ai_generation_draft_links WHERE workspace_id=p_workspace AND generation_id=p_generation AND item_index=p_item;
 IF l.id IS NOT NULL THEN
  IF l.context IS DISTINCT FROM context_value THEN RAISE EXCEPTION 'ai_draft_context_conflict';END IF;
  SELECT *INTO post FROM zoi.social_posts WHERE id=l.post_id AND workspace_id=p_workspace;
  IF post.id IS NULL THEN RAISE EXCEPTION 'ai_draft_previously_removed';END IF;
  already:=true;
 ELSE
  meta:=jsonb_build_object('source','ai-studio','action',g.action,'ai_generated',true,'ai_generation_id',g.id,'ai_generation_item',p_item,'ai_profile_snapshot',jsonb_build_object('business_name',g.profile_snapshot->>'business_name'))||jsonb_build_object('campaign',context_value->'campaign','client_listing_id',context_value->'listing');
  SELECT *INTO post FROM public.social_save_post(p_workspace,body,ARRAY[]::text[],NULL,'draft','[]'::jsonb,NULL,meta,NULL);
  IF post.id IS NULL OR post.workspace_id IS DISTINCT FROM p_workspace OR post.author_profile IS DISTINCT FROM actor_profile OR post.body IS DISTINCT FROM body OR post.status IS DISTINCT FROM'draft'OR post.scheduled_at IS NOT NULL OR post.channels IS DISTINCT FROM ARRAY[]::text[] OR post.media IS DISTINCT FROM'[]'::jsonb OR post.meta IS DISTINCT FROM meta THEN RAISE EXCEPTION 'ai_draft_receipt_unconfirmed';END IF;
  INSERT INTO zoi.ai_generation_draft_links(workspace_id,generation_id,item_index,post_id,context)VALUES(p_workspace,p_generation,p_item,post.id,context_value)RETURNING *INTO l;
 END IF;
 INSERT INTO zoi.ai_generation_draft_receipts(request_id,actor_auth,workspace_id,generation_id,item_index,context,link_id,post_snapshot)VALUES(p_request,auth.uid(),p_workspace,p_generation,p_item,context_value,l.id,to_jsonb(post));
 PERFORM zoi.suite_current_session();
 RETURN jsonb_build_object('ok',true,'workspace',p_workspace,'generation_id',p_generation,'item_index',p_item,'request_id',p_request,'post_snapshot',to_jsonb(post),'post',to_jsonb(post),'status','saved','already_saved',already,'replayed',false);
END $$;

-- Every human update/delete is protected, including drafts and unchanged-time
-- edits. Auth-null service source invalidation and trusted workers remain valid.
CREATE OR REPLACE FUNCTION zoi.editorial_schedule_source_guard()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l zoi.editorial_draft_links;r zoi.editorial_sources;
BEGIN
 SELECT *INTO l FROM zoi.editorial_draft_links WHERE post_id=OLD.id;
 IF NOT FOUND THEN IF TG_OP='DELETE'THEN RETURN OLD;ELSE RETURN NEW;END IF;END IF;
 IF OLD.workspace_id<>l.workspace_id THEN RAISE EXCEPTION 'editorial_post_scope_changed';END IF;
 IF TG_OP='UPDATE'THEN IF NEW.workspace_id<>l.workspace_id OR NEW.id<>OLD.id THEN RAISE EXCEPTION 'editorial_post_scope_changed';END IF;END IF;
 IF auth.uid()IS NOT NULL THEN
  PERFORM zoi.editorial_draft_actor(l.workspace_id);
  IF l.context?'listing'THEN PERFORM zoi.home_content_authorize(l.workspace_id,(l.context->>'listing')::uuid);END IF;
  PERFORM zoi.suite_current_session();
 END IF;
 IF TG_OP='DELETE'THEN RETURN OLD;END IF;
 IF nullif(NEW.meta->>'client_listing_id','')IS DISTINCT FROM l.context->>'listing'THEN RAISE EXCEPTION 'linked_draft_client_context_changed';END IF;
 IF l.context?'campaign'AND NEW.meta->>'campaign'IS DISTINCT FROM l.context->>'campaign'THEN RAISE EXCEPTION 'linked_draft_campaign_context_changed';END IF;
 IF NEW.status NOT IN('scheduled','published')THEN RETURN NEW;END IF;
 SELECT *INTO r FROM zoi.editorial_sources WHERE id=l.source_id;
 IF r.id IS NULL OR NOT r.active OR r.revision<>l.source_revision OR r.record<>l.source_snapshot THEN RAISE EXCEPTION 'editorial_source_changed';END IF;
 IF NEW.scheduled_at IS NULL OR(NEW.scheduled_at AT TIME ZONE l.time_zone)::date<>l.occurrence_date THEN RAISE EXCEPTION 'editorial_schedule_occurrence_mismatch';END IF;
 RETURN NEW;
END$$;
CREATE OR REPLACE TRIGGER editorial_schedule_source_guard BEFORE UPDATE OR DELETE ON zoi.social_posts FOR EACH ROW EXECUTE FUNCTION zoi.editorial_schedule_source_guard();
CREATE FUNCTION zoi.ai_linked_post_authority_guard()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l zoi.ai_generation_draft_links;
BEGIN
 SELECT *INTO l FROM zoi.ai_generation_draft_links WHERE post_id=OLD.id;
 IF NOT FOUND THEN IF TG_OP='DELETE'THEN RETURN OLD;ELSE RETURN NEW;END IF;END IF;
 IF OLD.workspace_id<>l.workspace_id THEN RAISE EXCEPTION 'ai_post_scope_changed';END IF;
 IF TG_OP='UPDATE'THEN IF NEW.workspace_id<>l.workspace_id OR NEW.id<>OLD.id THEN RAISE EXCEPTION 'ai_post_scope_changed';END IF;END IF;
 IF auth.uid()IS NOT NULL THEN
  PERFORM zoi.assert_workspace_write(l.workspace_id);
  IF l.context?'listing'THEN PERFORM zoi.home_content_authorize(l.workspace_id,(l.context->>'listing')::uuid);END IF;
  PERFORM zoi.suite_current_session();
 END IF;
 IF TG_OP='DELETE'THEN RETURN OLD;END IF;
 IF nullif(NEW.meta->>'client_listing_id','')IS DISTINCT FROM l.context->>'listing'THEN RAISE EXCEPTION 'linked_draft_client_context_changed';END IF;
 IF l.context?'campaign'AND NEW.meta->>'campaign'IS DISTINCT FROM l.context->>'campaign'THEN RAISE EXCEPTION 'linked_draft_campaign_context_changed';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER ai_linked_post_authority_guard BEFORE UPDATE OR DELETE ON zoi.social_posts FOR EACH ROW EXECUTE FUNCTION zoi.ai_linked_post_authority_guard();
REVOKE ALL ON FUNCTION zoi.ai_linked_post_authority_guard()FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.canonical_draft_context(p_workspace uuid,p_post uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ctx jsonb;kind text;
BEGIN
 PERFORM zoi.assert_workspace_write(p_workspace);
 SELECT context,'ai'INTO ctx,kind FROM zoi.ai_generation_draft_links WHERE workspace_id=p_workspace AND post_id=p_post;
 IF NOT FOUND THEN SELECT context,'editorial'INTO ctx,kind FROM zoi.editorial_draft_links WHERE workspace_id=p_workspace AND post_id=p_post;END IF;
 IF ctx?'listing'THEN PERFORM zoi.home_content_authorize(p_workspace,(ctx->>'listing')::uuid);END IF;
 PERFORM zoi.suite_current_session();RETURN jsonb_build_object('ok',true,'workspace',p_workspace,'post_id',p_post,'kind',kind,'context',ctx);
END$$;
REVOKE ALL ON FUNCTION public.canonical_draft_context(uuid,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.canonical_draft_context(uuid,uuid)TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
