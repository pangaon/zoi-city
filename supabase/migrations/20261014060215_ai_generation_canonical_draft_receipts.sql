-- Additive draft identity and immutable save receipts; social_posts remains canonical.
DO $preflight$ BEGIN
 IF to_regprocedure('zoi.suite_current_session()') IS NULL
 OR to_regprocedure('public.social_save_post(uuid,text,text[],timestamptz,text,jsonb,text,jsonb,uuid)') IS NULL
 OR to_regclass('zoi.ai_generations') IS NULL THEN RAISE EXCEPTION 'ai_draft_dependency_unavailable';END IF;
END $preflight$;
CREATE TABLE zoi.ai_generation_draft_links(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),generation_id uuid NOT NULL REFERENCES zoi.ai_generations(id),item_index integer NOT NULL CHECK(item_index BETWEEN 0 AND 13),
 post_id uuid REFERENCES zoi.social_posts(id) ON DELETE SET NULL,context jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,generation_id,item_index)
);
CREATE TABLE zoi.ai_generation_draft_receipts(
 request_id uuid PRIMARY KEY,actor_auth uuid NOT NULL,workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),generation_id uuid NOT NULL,item_index integer NOT NULL,context jsonb NOT NULL,link_id uuid NOT NULL REFERENCES zoi.ai_generation_draft_links(id),post_snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE zoi.ai_generation_draft_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.ai_generation_draft_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.ai_generation_draft_links,zoi.ai_generation_draft_receipts FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.ai_generation_draft_save(p_workspace uuid,p_generation uuid,p_item integer,p_request uuid,p_context jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor_profile uuid;actor_role text;g zoi.ai_generations;l zoi.ai_generation_draft_links;prior zoi.ai_generation_draft_receipts;post zoi.social_posts;current_post zoi.social_posts;body text;context_value jsonb;client_listing uuid;meta jsonb;already boolean:=false;
BEGIN
 PERFORM zoi.suite_current_session();
 SELECT up.id,wm.role INTO actor_profile,actor_role FROM zoi.user_profiles up JOIN zoi.workspace_members wm ON wm.profile_id=up.id
 WHERE up.auth_user_id=auth.uid() AND wm.workspace_id=p_workspace FOR SHARE OF up,wm;
 IF actor_profile IS NULL OR actor_role NOT IN('owner','admin','editor') THEN RAISE EXCEPTION 'ai_draft_not_authorized' USING ERRCODE='42501';END IF;
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
REVOKE ALL ON FUNCTION public.ai_generation_draft_save(uuid,uuid,integer,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ai_generation_draft_save(uuid,uuid,integer,uuid,jsonb) TO authenticated;
