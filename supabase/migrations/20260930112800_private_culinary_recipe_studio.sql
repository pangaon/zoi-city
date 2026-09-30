BEGIN;
CREATE TABLE zoi.culinary_recipes(id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),listing_id uuid NOT NULL REFERENCES zoi.listings(id),recipe_json jsonb NOT NULL,version integer NOT NULL CHECK(version>0),status text NOT NULL DEFAULT 'draft' CHECK(status='draft'),created_by uuid NOT NULL REFERENCES zoi.user_profiles(id),updated_by uuid NOT NULL REFERENCES zoi.user_profiles(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX culinary_recipes_workspace_updated ON zoi.culinary_recipes(workspace_id,updated_at DESC,id);
CREATE TABLE zoi.culinary_recipe_requests(actor_id uuid NOT NULL REFERENCES zoi.user_profiles(id),request_id uuid NOT NULL,workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),recipe_id uuid NOT NULL REFERENCES zoi.culinary_recipes(id),payload jsonb NOT NULL,receipt jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor_id,request_id));
ALTER TABLE zoi.culinary_recipes ENABLE ROW LEVEL SECURITY;ALTER TABLE zoi.culinary_recipe_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.culinary_recipes,zoi.culinary_recipe_requests FROM PUBLIC,anon,authenticated;
CREATE FUNCTION zoi.culinary_actor(p_workspace uuid)RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;
BEGIN SELECT id INTO actor FROM zoi.user_profiles WHERE auth_user_id=auth.uid();IF actor IS NULL THEN RAISE EXCEPTION 'not_authorized' USING errcode='42501';END IF;
 PERFORM 1 FROM zoi.workspace_members WHERE workspace_id=p_workspace AND profile_id=actor AND role IN('owner','admin','editor')FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized' USING errcode='42501';END IF;RETURN actor;
END $$;
CREATE FUNCTION zoi.culinary_validate(p jsonb,p_id uuid,p_listing uuid,p_name text)RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE item jsonb;k text;ids text[];n numeric;controls text:='['||chr(1)||'-'||chr(8)||chr(11)||chr(12)||chr(14)||'-'||chr(31)||']';
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR octet_length(p::text)>100000 OR p_id IS NULL OR p_listing IS NULL THEN RAISE EXCEPTION 'invalid_recipe';END IF;
 FOR k IN SELECT jsonb_object_keys(p)LOOP IF k NOT IN('id','title','servings','chef','source_url','ingredients','steps','video')THEN RAISE EXCEPTION 'unsupported_recipe_field';END IF;END LOOP;
 IF p->>'id' IS DISTINCT FROM p_id::text OR jsonb_typeof(p->'title') IS DISTINCT FROM 'string' OR length(btrim(p->>'title')) NOT BETWEEN 1 AND 200 OR jsonb_typeof(p->'servings') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'invalid_recipe';END IF;
 IF (p->>'title')~controls OR (p#>>'{chef,name}')~controls THEN RAISE EXCEPTION 'invalid_recipe_text';END IF;
 n:=(p->>'servings')::numeric;IF n<>trunc(n) OR n NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid_servings';END IF;
 IF jsonb_typeof(p->'chef') IS DISTINCT FROM 'object' OR jsonb_typeof(p#>'{chef,name}') IS DISTINCT FROM 'string' OR p#>>'{chef,listing_id}' IS DISTINCT FROM p_listing::text OR p#>>'{chef,name}' IS DISTINCT FROM p_name OR length(p_name)>160 THEN RAISE EXCEPTION 'invalid_attribution';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p->'chef')v WHERE v NOT IN('name','listing_id'))THEN RAISE EXCEPTION 'unsupported_recipe_field';END IF;
 IF p?'source_url' AND p->'source_url'<>'null'::jsonb AND (jsonb_typeof(p->'source_url')<>'string' OR length(p->>'source_url')>2000 OR p->>'source_url' !~ '^https://[^/@[:space:]]+(\/[^[:space:]]*)?$')THEN RAISE EXCEPTION 'invalid_source_url';END IF;
 IF jsonb_typeof(p->'ingredients') IS DISTINCT FROM 'array' OR jsonb_typeof(p->'steps') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_recipe';END IF;
 IF jsonb_array_length(p->'ingredients') NOT BETWEEN 1 AND 100 OR jsonb_array_length(p->'steps') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid_recipe';END IF;
 ids:='{}';FOR item IN SELECT value FROM jsonb_array_elements(p->'ingredients')LOOP
 IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_ingredient';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(item)v WHERE v NOT IN('id','name','quantity','unit','note'))THEN RAISE EXCEPTION 'unsupported_recipe_field';END IF;
 IF jsonb_typeof(item->'id') IS DISTINCT FROM 'string' OR coalesce(item->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' OR (item->>'id')=ANY(ids) OR jsonb_typeof(item->'name') IS DISTINCT FROM 'string' OR length(btrim(item->>'name')) NOT BETWEEN 1 AND 200 OR jsonb_typeof(item->'unit') IS DISTINCT FROM 'string' OR length(item->>'unit')>40 THEN RAISE EXCEPTION 'invalid_ingredient';END IF;IF coalesce(item->>'name','')~controls OR coalesce(item->>'unit','')~controls OR coalesce(item->>'note','')~controls OR coalesce(item->>'text','')~controls THEN RAISE EXCEPTION 'invalid_recipe_text';END IF;ids:=array_append(ids,item->>'id');
 IF NOT(item?'quantity') OR (jsonb_typeof(item->'quantity') NOT IN('null','number')) THEN RAISE EXCEPTION 'invalid_quantity';END IF;
 IF jsonb_typeof(item->'quantity')='number' AND ((item->>'quantity')::numeric<=0 OR (item->>'quantity')::numeric>100000)THEN RAISE EXCEPTION 'invalid_quantity';END IF;
 IF item?'note' AND (jsonb_typeof(item->'note') IS DISTINCT FROM 'string' OR length(item->>'note')>300)THEN RAISE EXCEPTION 'invalid_ingredient';END IF;
 END LOOP;
 ids:='{}';FOR item IN SELECT value FROM jsonb_array_elements(p->'steps')LOOP
 IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_step';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(item)v WHERE v NOT IN('id','text','timer_seconds'))THEN RAISE EXCEPTION 'unsupported_recipe_field';END IF;
 IF jsonb_typeof(item->'id') IS DISTINCT FROM 'string' OR coalesce(item->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' OR (item->>'id')=ANY(ids) OR jsonb_typeof(item->'text') IS DISTINCT FROM 'string' OR length(btrim(item->>'text')) NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'invalid_step';END IF;IF coalesce(item->>'name','')~controls OR coalesce(item->>'unit','')~controls OR coalesce(item->>'note','')~controls OR coalesce(item->>'text','')~controls THEN RAISE EXCEPTION 'invalid_recipe_text';END IF;ids:=array_append(ids,item->>'id');
 IF item?'timer_seconds' AND item->'timer_seconds'<>'null'::jsonb THEN IF jsonb_typeof(item->'timer_seconds') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'invalid_timer';END IF;n:=(item->>'timer_seconds')::numeric;IF n<>trunc(n) OR n NOT BETWEEN 1 AND 86400 THEN RAISE EXCEPTION 'invalid_timer';END IF;END IF;
 END LOOP;
 IF p?'video' AND p->'video'<>'null'::jsonb THEN
 IF jsonb_typeof(p->'video') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_video';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p->'video')v WHERE v NOT IN('provider','id')) OR NOT coalesce((p#>>'{video,provider}'='youtube' AND p#>>'{video,id}'~'^[A-Za-z0-9_-]{11}$')OR(p#>>'{video,provider}'='vimeo' AND p#>>'{video,id}'~'^[1-9][0-9]{5,11}$'),false)THEN RAISE EXCEPTION 'invalid_video';END IF;END IF;
END $$;
CREATE FUNCTION public.culinary_recipe_list(p_workspace uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM zoi.culinary_actor(p_workspace);RETURN jsonb_build_object('ok',true,'workspace_id',p_workspace,'recipes',coalesce((SELECT jsonb_agg(x ORDER BY x.updated_at DESC,x.id)FROM(SELECT r.id,r.listing_id,r.recipe_json->>'title' AS title,r.version,r.status,r.updated_at FROM zoi.culinary_recipes r JOIN zoi.listings l ON l.id=r.listing_id AND l.owner_workspace_id=p_workspace WHERE r.workspace_id=p_workspace ORDER BY r.updated_at DESC,r.id LIMIT 100)x),'[]'::jsonb),'truncated',(SELECT count(*)>100 FROM zoi.culinary_recipes r JOIN zoi.listings l ON l.id=r.listing_id AND l.owner_workspace_id=p_workspace WHERE r.workspace_id=p_workspace),'listings',coalesce((SELECT jsonb_agg(x ORDER BY x.name,x.id)FROM(SELECT id,name FROM zoi.listings WHERE owner_workspace_id=p_workspace ORDER BY name,id LIMIT 200)x),'[]'::jsonb));END $$;
CREATE FUNCTION public.culinary_recipe_get(p_workspace uuid,p_recipe uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r zoi.culinary_recipes;
BEGIN PERFORM zoi.culinary_actor(p_workspace);SELECT c.* INTO r FROM zoi.culinary_recipes c JOIN zoi.listings l ON l.id=c.listing_id AND l.owner_workspace_id=p_workspace WHERE c.id=p_recipe AND c.workspace_id=p_workspace FOR SHARE OF c,l;IF NOT FOUND THEN RAISE EXCEPTION 'recipe_unavailable';END IF;RETURN jsonb_build_object('ok',true,'recipe',to_jsonb(r)-'created_by'-'updated_by');END $$;
CREATE FUNCTION public.culinary_recipe_save(p_workspace uuid,p_recipe uuid,p_listing uuid,p_expected_version integer,p_request uuid,p_recipe_json jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;r zoi.culinary_recipes;prior zoi.culinary_recipe_requests;payload jsonb;receipt jsonb;listing_name text;
BEGIN actor:=zoi.culinary_actor(p_workspace);IF p_request IS NULL OR p_recipe IS NULL OR p_listing IS NULL OR p_expected_version IS NULL OR p_expected_version<0 THEN RAISE EXCEPTION 'invalid_request';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('culinary-actor:'||actor::text,0));
 SELECT name INTO listing_name FROM zoi.listings WHERE id=p_listing AND owner_workspace_id=p_workspace FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'listing_unavailable';END IF;
 payload:=jsonb_build_object('workspace',p_workspace,'recipe',p_recipe,'listing',p_listing,'version',p_expected_version,'recipe_json',p_recipe_json);
 SELECT * INTO prior FROM zoi.culinary_recipe_requests WHERE actor_id=actor AND request_id=p_request;
 IF FOUND THEN IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN prior.receipt;END IF;
 PERFORM zoi.culinary_validate(p_recipe_json,p_recipe,p_listing,listing_name);
 IF(SELECT count(*) FROM zoi.culinary_recipe_requests WHERE actor_id=actor AND created_at>clock_timestamp()-interval '1 day')>=200 THEN RAISE EXCEPTION 'rate_limited';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('culinary-recipe:'||p_recipe::text,0));SELECT * INTO r FROM zoi.culinary_recipes WHERE id=p_recipe FOR UPDATE;
 IF FOUND THEN
 IF r.workspace_id<>p_workspace OR r.listing_id<>p_listing THEN RAISE EXCEPTION 'recipe_unavailable';END IF;IF r.version<>p_expected_version THEN RAISE EXCEPTION 'version_conflict';END IF;
 UPDATE zoi.culinary_recipes SET recipe_json=p_recipe_json,version=version+1,updated_by=actor,updated_at=clock_timestamp() WHERE id=p_recipe RETURNING * INTO r;
 ELSE
 IF p_expected_version<>0 THEN RAISE EXCEPTION 'version_conflict';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('culinary-workspace:'||p_workspace::text,0));IF(SELECT count(*)FROM zoi.culinary_recipes WHERE workspace_id=p_workspace)>=1000 THEN RAISE EXCEPTION 'recipe_limit';END IF;
 INSERT INTO zoi.culinary_recipes(id,workspace_id,listing_id,recipe_json,version,created_by,updated_by)VALUES(p_recipe,p_workspace,p_listing,p_recipe_json,1,actor,actor)RETURNING * INTO r;
 END IF;
 receipt:=jsonb_build_object('ok',true,'request_id',p_request,'recipe',to_jsonb(r)-'created_by'-'updated_by');INSERT INTO zoi.culinary_recipe_requests(actor_id,request_id,workspace_id,recipe_id,payload,receipt)VALUES(actor,p_request,p_workspace,p_recipe,payload,receipt);RETURN receipt;
END $$;
CREATE FUNCTION public.culinary_recipe_receipt(p_workspace uuid,p_request uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;prior zoi.culinary_recipe_requests;
BEGIN actor:=zoi.culinary_actor(p_workspace);SELECT * INTO prior FROM zoi.culinary_recipe_requests WHERE actor_id=actor AND request_id=p_request AND workspace_id=p_workspace;IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'found',false);END IF;
 PERFORM 1 FROM zoi.culinary_recipes r JOIN zoi.listings l ON l.id=r.listing_id AND l.owner_workspace_id=p_workspace WHERE r.id=prior.recipe_id AND r.workspace_id=p_workspace FOR SHARE OF r,l;IF NOT FOUND THEN RAISE EXCEPTION 'recipe_unavailable';END IF;
 RETURN jsonb_build_object('ok',true,'found',true,'receipt',prior.receipt);
END $$;
REVOKE ALL ON FUNCTION zoi.culinary_actor(uuid),zoi.culinary_validate(jsonb,uuid,uuid,text),public.culinary_recipe_receipt(uuid,uuid),public.culinary_recipe_list(uuid),public.culinary_recipe_get(uuid,uuid),public.culinary_recipe_save(uuid,uuid,uuid,integer,uuid,jsonb)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.culinary_recipe_receipt(uuid,uuid),public.culinary_recipe_list(uuid),public.culinary_recipe_get(uuid,uuid),public.culinary_recipe_save(uuid,uuid,uuid,integer,uuid,jsonb)TO authenticated;
COMMIT;
