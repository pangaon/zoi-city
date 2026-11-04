BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Canonical listing IDs only. MESA is a measured site-plan, not verified safety,
-- satellite imagery, ticket inventory, payment collection or a separate directory.
CREATE TABLE zoi.festival_maps(
 event_id uuid PRIMARY KEY REFERENCES zoi.listings(id),
 workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),
 version integer NOT NULL CHECK(version>0),draft jsonb NOT NULL,
 published_layout jsonb,published_version integer,published_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((published_layout IS NULL AND published_version IS NULL AND published_at IS NULL)
 OR (published_layout IS NOT NULL AND published_version IS NOT NULL AND published_version>0 AND published_version<=version AND published_at IS NOT NULL))
);
CREATE TABLE zoi.festival_vendor_bindings(
 application_id uuid PRIMARY KEY REFERENCES zoi.festival_applications(id),
 vendor_workspace_id uuid REFERENCES zoi.workspaces(id),listing_id uuid REFERENCES zoi.listings(id),
 version integer NOT NULL CHECK(version>0),state text NOT NULL CHECK(state IN('proposed','accepted','revoked')),
 reviewed_by uuid REFERENCES zoi.user_profiles(id),reviewed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((vendor_workspace_id IS NULL)=(listing_id IS NULL)),
 CHECK(state='revoked' OR listing_id IS NOT NULL)
);
CREATE TABLE zoi.festival_map_requests(
 actor uuid NOT NULL REFERENCES zoi.user_profiles(id),request uuid NOT NULL,
 event_id uuid NOT NULL REFERENCES zoi.listings(id),payload jsonb NOT NULL,receipt jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor,request)
);
CREATE TABLE zoi.festival_map_audit(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,event_id uuid NOT NULL REFERENCES zoi.listings(id),
 actor uuid NOT NULL REFERENCES zoi.user_profiles(id),action text NOT NULL,
 request uuid NOT NULL,after_state jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX festival_map_requests_event ON zoi.festival_map_requests(event_id,created_at);
CREATE INDEX festival_vendor_bindings_listing ON zoi.festival_vendor_bindings(listing_id) WHERE state<>'revoked';
ALTER TABLE zoi.festival_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.festival_vendor_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.festival_map_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.festival_map_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.festival_maps,zoi.festival_vendor_bindings,zoi.festival_map_requests,zoi.festival_map_audit FROM PUBLIC,anon,authenticated;

CREATE FUNCTION zoi.mesa_operator(p_workspace uuid,p_event uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;r text;l zoi.listings;
BEGIN
 -- Same host-before-workspace ordering as the existing festival package writer.
 SELECT * INTO l FROM zoi.listings WHERE id=p_event FOR SHARE;
 IF l.id IS NULL OR l.owner_workspace_id IS DISTINCT FROM p_workspace
 OR l.publish_status IS DISTINCT FROM 'published' OR coalesce(l.marketplace_status,'')='hidden'
 OR coalesce(l.moderation_status,'') NOT IN('clean','cleared') THEN RAISE EXCEPTION 'mesa_event_unavailable' USING ERRCODE='42501';END IF;
 r:=zoi.workspace_locked_role(p_workspace);
 IF r NOT IN('owner','admin','editor') THEN RAISE EXCEPTION 'mesa_permission_denied' USING ERRCODE='42501';END IF;
 SELECT id INTO actor FROM zoi.user_profiles WHERE auth_user_id=auth.uid();
 IF actor IS NULL THEN RAISE EXCEPTION 'mesa_permission_denied' USING ERRCODE='42501';END IF;
 RETURN actor;
END $$;
CREATE FUNCTION zoi.mesa_vendor_actor(p_application uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;a zoi.festival_applications;
BEGIN
 PERFORM zoi.suite_lock_session();
 SELECT id INTO actor FROM zoi.user_profiles WHERE auth_user_id=auth.uid();
 -- Serialize absent-binding creation too; row CAS alone cannot lock a missing binding.
 SELECT * INTO a FROM zoi.festival_applications WHERE id=p_application FOR UPDATE;
 IF actor IS NULL OR a.id IS NULL OR a.profile_id IS DISTINCT FROM actor OR a.terms->>'kind' IS DISTINCT FROM 'booth'
 THEN RAISE EXCEPTION 'mesa_application_not_owned' USING ERRCODE='42501';END IF;
 RETURN actor;
END $$;
CREATE FUNCTION zoi.mesa_request_lock(p_request uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;
BEGIN
 IF p_request IS NULL THEN RAISE EXCEPTION 'mesa_request_required';END IF;
 PERFORM zoi.suite_lock_session();
 SELECT id INTO actor FROM zoi.user_profiles WHERE auth_user_id=auth.uid();
 IF actor IS NULL THEN RAISE EXCEPTION 'mesa_permission_denied' USING ERRCODE='42501';END IF;
 -- All writers take this before domain locks, even for a conflicting operation.
 PERFORM pg_advisory_xact_lock(hashtextextended('mesa-request:'||actor::text||':'||p_request::text,0));
 RETURN actor;
END $$;
CREATE FUNCTION zoi.mesa_lock_listings(p_host uuid,p_businesses uuid[],p_write boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 -- A business may itself host another festival. Lock every involved listing in
 -- UUID order before invoking the owner editor's FOR UPDATE listing guard.
 IF p_write THEN
  PERFORM 1 FROM zoi.listings WHERE id=ANY(array_append(coalesce(p_businesses,'{}'::uuid[]),p_host)) ORDER BY id FOR UPDATE;
 ELSE
  PERFORM 1 FROM zoi.listings WHERE id=ANY(array_append(coalesce(p_businesses,'{}'::uuid[]),p_host)) ORDER BY id FOR SHARE;
 END IF;
END $$;
CREATE FUNCTION zoi.mesa_layout(p_layout jsonb,p_collisions boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE b jsonb;c jsonb;w numeric;h numeric;x numeric;y numeric;bw numeric;bh numeric;rot integer;
BEGIN
 IF jsonb_typeof(p_layout) IS DISTINCT FROM 'object' OR octet_length(p_layout::text)>150000
 OR p_layout->'schema' IS DISTINCT FROM '1'::jsonb OR jsonb_typeof(p_layout->'width_m') IS DISTINCT FROM 'number'
 OR jsonb_typeof(p_layout->'height_m') IS DISTINCT FROM 'number' OR jsonb_typeof(p_layout->'booths') IS DISTINCT FROM 'array'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_layout)k WHERE k NOT IN('schema','width_m','height_m','booths'))
 THEN RAISE EXCEPTION 'mesa_invalid_layout';END IF;
 w:=(p_layout->>'width_m')::numeric;h:=(p_layout->>'height_m')::numeric;
 IF w NOT BETWEEN 1 AND 5000 OR h NOT BETWEEN 1 AND 5000 OR jsonb_array_length(p_layout->'booths')>200 THEN RAISE EXCEPTION 'mesa_invalid_layout';END IF;
 FOR b IN SELECT value FROM jsonb_array_elements(p_layout->'booths') LOOP
  IF jsonb_typeof(b) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(b)k WHERE k NOT IN('id','label','x_m','y_m','width_m','height_m','rotation','application_id'))
  OR NOT (b ?& ARRAY['id','label','x_m','y_m','width_m','height_m','rotation','application_id'])
  OR jsonb_typeof(b->'id') IS DISTINCT FROM 'string' OR (b->>'id')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  OR jsonb_typeof(b->'label') IS DISTINCT FROM 'string' OR length(btrim(b->>'label')) NOT BETWEEN 1 AND 40
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['x_m','y_m','width_m','height_m','rotation'])k WHERE jsonb_typeof(b->k) IS DISTINCT FROM 'number')
  OR (b->'application_id'<>'null'::jsonb AND (jsonb_typeof(b->'application_id') IS DISTINCT FROM 'string' OR (b->>'application_id')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') )
  THEN RAISE EXCEPTION 'mesa_invalid_booth';END IF;
  IF b->'rotation' NOT IN('0'::jsonb,'90'::jsonb,'180'::jsonb,'270'::jsonb) THEN RAISE EXCEPTION 'mesa_invalid_rotation';END IF;
  rot:=(b->>'rotation')::integer;x:=(b->>'x_m')::numeric;y:=(b->>'y_m')::numeric;
  bw:=(b->>'width_m')::numeric;bh:=(b->>'height_m')::numeric;
  IF bw NOT BETWEEN 0.5 AND 100 OR bh NOT BETWEEN 0.5 AND 100 THEN RAISE EXCEPTION 'mesa_invalid_booth';END IF;
  IF rot IN(90,270) THEN bw:=(b->>'height_m')::numeric;bh:=(b->>'width_m')::numeric;END IF;
  IF x-bw/2<0 OR y-bh/2<0 OR x+bw/2>w OR y+bh/2>h THEN RAISE EXCEPTION 'mesa_booth_outside_site';END IF;
 END LOOP;
 IF (SELECT count(DISTINCT (value->>'id')::uuid) FROM jsonb_array_elements(p_layout->'booths'))<>jsonb_array_length(p_layout->'booths') THEN RAISE EXCEPTION 'mesa_duplicate_booth';END IF;
 IF p_collisions AND EXISTS(
  SELECT 1 FROM jsonb_array_elements(p_layout->'booths')WITH ORDINALITY a(b,i)
  JOIN jsonb_array_elements(p_layout->'booths')WITH ORDINALITY c(b,i) ON a.i<c.i
  WHERE abs((a.b->>'x_m')::numeric-(c.b->>'x_m')::numeric)<
   ((CASE WHEN (a.b->>'rotation')::integer IN(90,270) THEN a.b->>'height_m' ELSE a.b->>'width_m' END)::numeric+(CASE WHEN (c.b->>'rotation')::integer IN(90,270) THEN c.b->>'height_m' ELSE c.b->>'width_m' END)::numeric)/2
  AND abs((a.b->>'y_m')::numeric-(c.b->>'y_m')::numeric)<
   ((CASE WHEN (a.b->>'rotation')::integer IN(90,270) THEN a.b->>'width_m' ELSE a.b->>'height_m' END)::numeric+(CASE WHEN (c.b->>'rotation')::integer IN(90,270) THEN c.b->>'width_m' ELSE c.b->>'height_m' END)::numeric)/2
 ) THEN RAISE EXCEPTION 'mesa_booth_collision';END IF;
 RETURN p_layout;
END $$;
CREATE FUNCTION zoi.mesa_uri_component(p_value text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE bytes bytea:=convert_to(p_value,'UTF8');out text:='';n integer;b integer;
BEGIN
 IF bytes IS NULL THEN RETURN NULL;END IF;
 FOR n IN 0..length(bytes)-1 LOOP b:=get_byte(bytes,n);IF b BETWEEN 65 AND 90 OR b BETWEEN 97 AND 122 OR b BETWEEN 48 AND 57 OR b IN(45,46,95,126) THEN out:=out||chr(b);ELSE out:=out||'%'||upper(lpad(to_hex(b),2,'0'));END IF;END LOOP;
 RETURN out;
END $$;
CREATE FUNCTION zoi.mesa_business(p_listing uuid,p_workspace uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE l zoi.listings;e jsonb;v jsonb;n jsonb;slug text;kind text;logo text;
BEGIN
 SELECT * INTO l FROM zoi.listings WHERE id=p_listing AND owner_workspace_id=p_workspace
 AND publish_status='published' AND moderation_status IN('clean','cleared') AND coalesce(marketplace_status,'')<>'hidden';
 IF l.id IS NULL OR l.entity_type IN('event','travel_place') THEN RETURN NULL;END IF;
 e:=public.home_entity(l.slug);
 IF e IS NULL OR e->>'id' IS DISTINCT FROM l.id::text THEN RETURN NULL;END IF;
 IF coalesce(e->'owner_content','{}') ? 'name' THEN n:=e#>'{owner_content,name}';
 ELSIF coalesce(e#>'{owner_content,profile}','{}') ? 'name' THEN n:=e#>'{owner_content,profile,name}';
 ELSIF coalesce(e->'profile','{}') ? 'name' THEN n:=e#>'{profile,name}';
 ELSE n:=e->'name';END IF;
 IF jsonb_typeof(n) IS DISTINCT FROM 'string' OR nullif(btrim(n#>>'{}'),'') IS NULL THEN RETURN NULL;END IF;
 slug:=coalesce(nullif(e->>'canonical_slug',''),e->>'slug');kind:=e->>'entity_type';
 IF slug IS NULL OR length(slug)>500 OR kind!~'^[a-z][a-z0-9_]*$' THEN RETURN NULL;END IF;
 -- Match publishedField presence precedence: explicit clears never resurrect source logos.
 IF coalesce(e->'owner_content','{}') ? 'logo_url' THEN v:=e#>'{owner_content,logo_url}';
 ELSIF coalesce(e#>'{owner_content,profile}','{}') ? 'logo_url' THEN v:=e#>'{owner_content,profile,logo_url}';
 ELSE v:=e#>'{profile,logo_url}';END IF;
 IF jsonb_typeof(v)='string' AND length(v#>>'{}')<=2048 AND (v#>>'{}')~'^https://' THEN logo:=v#>>'{}';END IF;
 RETURN jsonb_build_object('slug',slug,'name',n#>>'{}','logo',logo,'href','/'||CASE WHEN kind='travel_place' THEN 'travel-place' ELSE kind END||'/'||zoi.mesa_uri_component(slug));
END $$;
CREATE FUNCTION zoi.mesa_binding(p_application uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('version',b.version,'state',b.state,'listing_id',b.listing_id,'vendor_workspace_id',b.vendor_workspace_id,
 'business',CASE WHEN b.state<>'revoked' THEN zoi.mesa_business(b.listing_id,b.vendor_workspace_id) ELSE NULL END)
 FROM zoi.festival_vendor_bindings b WHERE application_id=p_application;
$$;
CREATE FUNCTION zoi.mesa_map_value(p_event uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('version',m.version,'draft',m.draft,'published_version',m.published_version,'published_at',m.published_at,'published_layout',m.published_layout)
 FROM zoi.festival_maps m WHERE event_id=p_event;
$$;
CREATE FUNCTION zoi.mesa_receipt(p_actor uuid,p_request uuid,p_event uuid,p_payload jsonb,p_result jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE prior zoi.festival_map_requests;
BEGIN
 IF p_request IS NULL THEN RAISE EXCEPTION 'mesa_request_required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('mesa-request:'||p_actor::text||':'||p_request::text,0));
 SELECT * INTO prior FROM zoi.festival_map_requests WHERE actor=p_actor AND request=p_request;
 IF FOUND THEN IF prior.payload IS DISTINCT FROM p_payload OR prior.event_id IS DISTINCT FROM p_event THEN RAISE EXCEPTION 'mesa_request_conflict';END IF;RETURN prior.receipt;END IF;
 IF p_result IS NOT NULL THEN
  INSERT INTO zoi.festival_map_requests(actor,request,event_id,payload,receipt) VALUES(p_actor,p_request,p_event,p_payload,p_result);
  INSERT INTO zoi.festival_map_audit(event_id,actor,action,request,after_state) VALUES(p_event,p_actor,p_payload->>'operation',p_request,p_result);
 END IF;
 RETURN p_result;
END $$;
CREATE FUNCTION zoi.mesa_validate_assignments(p_event uuid,p_workspace uuid,p_layout jsonb,p_publish boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE picked record;a zoi.festival_applications;k zoi.festival_packages;b zoi.festival_vendor_bindings;
BEGIN
 FOR picked IN SELECT (value->>'application_id')::uuid AS id,count(*) n FROM jsonb_array_elements(p_layout->'booths') WHERE value->>'application_id' IS NOT NULL GROUP BY 1 ORDER BY 1 LOOP
  SELECT * INTO a FROM zoi.festival_applications WHERE id=picked.id FOR SHARE;
  SELECT * INTO k FROM zoi.festival_packages WHERE id=a.package_id;
  IF a.id IS NULL OR a.workspace_id IS DISTINCT FROM p_workspace OR a.event_id IS DISTINCT FROM p_event OR a.status<>'approved'
   OR a.terms->>'kind' IS DISTINCT FROM 'booth' OR k.kind IS DISTINCT FROM 'booth' OR k.workspace_id IS DISTINCT FROM p_workspace OR k.event_id IS DISTINCT FROM p_event
   THEN RAISE EXCEPTION 'mesa_approved_booth_required';END IF;
  IF picked.n>a.units THEN RAISE EXCEPTION 'mesa_application_units_exceeded';END IF;
  IF p_publish THEN
   SELECT * INTO b FROM zoi.festival_vendor_bindings WHERE application_id=a.id FOR SHARE;
   IF b.state IS DISTINCT FROM 'accepted' THEN RAISE EXCEPTION 'mesa_business_acceptance_required';END IF;
   PERFORM 1 FROM zoi.listings WHERE id=b.listing_id AND owner_workspace_id=b.vendor_workspace_id FOR SHARE;
   IF NOT FOUND OR zoi.mesa_business(b.listing_id,b.vendor_workspace_id) IS NULL THEN RAISE EXCEPTION 'mesa_business_unavailable';END IF;
  END IF;
 END LOOP;
END $$;

CREATE FUNCTION public.festival_map_operator(p_workspace uuid,p_event uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;rows jsonb;total integer;
BEGIN
 actor:=zoi.mesa_operator(p_workspace,p_event);
 SELECT count(*) INTO total FROM zoi.festival_applications a JOIN zoi.festival_packages k ON k.id=a.package_id
 WHERE a.workspace_id=p_workspace AND a.event_id=p_event AND a.status='approved' AND a.terms->>'kind'='booth' AND k.kind='booth';
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'units',a.units,'status',a.status,'organisation',a.data->>'organisation','version',a.version,'binding',zoi.mesa_binding(a.id)) ORDER BY a.created_at DESC,a.id),'[]') INTO rows
 FROM(SELECT a.* FROM zoi.festival_applications a JOIN zoi.festival_packages k ON k.id=a.package_id
 WHERE a.workspace_id=p_workspace AND a.event_id=p_event AND a.status='approved' AND a.terms->>'kind'='booth' AND k.kind='booth' ORDER BY a.created_at DESC,a.id LIMIT 200)a;
 RETURN jsonb_build_object('ok',true,'role',zoi.workspace_current_role(p_workspace),'event',(SELECT jsonb_build_object('id',id,'name',name)FROM zoi.listings WHERE id=p_event),
 'map',(SELECT zoi.mesa_map_value(p_event) FROM zoi.festival_maps WHERE event_id=p_event AND workspace_id=p_workspace),'applications',rows,'application_count',total,'applications_truncated',total>200);
END $$;
CREATE FUNCTION public.festival_map_save(p_workspace uuid,p_event uuid,p_expected_version integer,p_request uuid,p_layout jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;m zoi.festival_maps;body jsonb;result jsonb;
BEGIN
 PERFORM zoi.mesa_request_lock(p_request);
 PERFORM pg_advisory_xact_lock(hashtextextended('mesa-map:'||p_event::text,0));
 actor:=zoi.mesa_operator(p_workspace,p_event);
 body:=jsonb_build_object('operation','map_save','workspace',p_workspace,'event',p_event,'version',p_expected_version,'layout',p_layout);
 result:=zoi.mesa_receipt(actor,p_request,p_event,body);IF result IS NOT NULL THEN RETURN result;END IF;
 PERFORM zoi.mesa_layout(p_layout);PERFORM zoi.mesa_validate_assignments(p_event,p_workspace,p_layout,false);
 SELECT * INTO m FROM zoi.festival_maps WHERE event_id=p_event FOR UPDATE;
 IF m.event_id IS NOT NULL AND m.workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'mesa_map_ownership_changed';END IF;
 IF p_expected_version IS DISTINCT FROM coalesce(m.version,0) THEN RAISE EXCEPTION 'mesa_version_conflict';END IF;
 INSERT INTO zoi.festival_maps(event_id,workspace_id,version,draft) VALUES(p_event,p_workspace,1,p_layout)
 ON CONFLICT(event_id) DO UPDATE SET draft=excluded.draft,version=festival_maps.version+1,updated_at=clock_timestamp();
 result:=jsonb_build_object('ok',true,'map',zoi.mesa_map_value(p_event),'request_id',p_request);
 RETURN zoi.mesa_receipt(actor,p_request,p_event,body,result);
END $$;
CREATE FUNCTION public.festival_map_publish(p_workspace uuid,p_event uuid,p_expected_version integer,p_request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;m zoi.festival_maps;body jsonb;result jsonb;businesses uuid[];
BEGIN
 PERFORM zoi.mesa_request_lock(p_request);
 PERFORM pg_advisory_xact_lock(hashtextextended('mesa-map:'||p_event::text,0));
 SELECT array_agg(v.listing_id) INTO businesses FROM zoi.festival_maps fm
 CROSS JOIN LATERAL jsonb_array_elements(fm.draft->'booths')e(b)
 JOIN zoi.festival_vendor_bindings v ON v.application_id=(e.b->>'application_id')::uuid WHERE fm.event_id=p_event;
 PERFORM zoi.mesa_lock_listings(p_event,businesses,false);
 actor:=zoi.mesa_operator(p_workspace,p_event);
 body:=jsonb_build_object('operation','map_publish','workspace',p_workspace,'event',p_event,'version',p_expected_version);
 result:=zoi.mesa_receipt(actor,p_request,p_event,body);IF result IS NOT NULL THEN RETURN result;END IF;
 SELECT * INTO m FROM zoi.festival_maps WHERE event_id=p_event FOR UPDATE;
 IF m.event_id IS NULL OR m.workspace_id IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'mesa_map_unavailable';END IF;
 IF p_expected_version IS DISTINCT FROM m.version THEN RAISE EXCEPTION 'mesa_version_conflict';END IF;
 PERFORM zoi.mesa_layout(m.draft,true);PERFORM zoi.mesa_validate_assignments(p_event,p_workspace,m.draft,true);
 UPDATE zoi.festival_maps SET version=version+1,published_version=version+1,published_layout=draft,published_at=clock_timestamp(),updated_at=clock_timestamp() WHERE event_id=p_event;
 result:=jsonb_build_object('ok',true,'map',zoi.mesa_map_value(p_event),'request_id',p_request);
 RETURN zoi.mesa_receipt(actor,p_request,p_event,body,result);
END $$;

CREATE FUNCTION public.festival_vendor_businesses(p_application uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;rows jsonb:='[]';a zoi.festival_applications;candidate record;candidate_role text;
BEGIN
 actor:=zoi.mesa_vendor_actor(p_application);SELECT * INTO a FROM zoi.festival_applications WHERE id=p_application;
 -- Do not put the raising authority function in a WHERE predicate. PostgreSQL
 -- may evaluate it on unrelated listings before the membership filter.
 FOR candidate IN
  SELECT l.id listing_id,l.owner_workspace_id workspace_id,l.name,l.slug FROM zoi.listings l
  JOIN zoi.workspace_members m ON m.workspace_id=l.owner_workspace_id AND m.profile_id=actor
  WHERE m.role IN('owner','admin','editor') AND l.publish_status='published' AND l.moderation_status IN('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden'
  AND l.entity_type NOT IN('event','travel_place') AND a.status='approved' ORDER BY l.name,l.id LIMIT 200
 LOOP
  BEGIN
   candidate_role:=zoi.workspace_current_role(candidate.workspace_id);
  EXCEPTION WHEN insufficient_privilege THEN
   -- A removed candidate membership is skipped, while invalid current sessions
   -- still fail the entire read through the canonical session guard.
   PERFORM zoi.suite_current_session();
   CONTINUE;
  END;
  IF candidate_role IN('owner','admin','editor') THEN rows:=rows||jsonb_build_array(to_jsonb(candidate));END IF;
 END LOOP;
 RETURN jsonb_build_object('ok',true,'application_id',p_application,'version',coalesce((SELECT version FROM zoi.festival_vendor_bindings WHERE application_id=p_application),0),'binding',zoi.mesa_binding(p_application),'choices',rows);
END $$;
CREATE FUNCTION public.festival_vendor_bind(p_application uuid,p_vendor_workspace uuid,p_listing uuid,p_expected_version integer,p_request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;current_actor uuid;a zoi.festival_applications;k zoi.festival_packages;b zoi.festival_vendor_bindings;body jsonb;result jsonb;revoke_binding boolean;event_scope uuid;
BEGIN
 actor:=zoi.mesa_request_lock(p_request);
 SELECT * INTO a FROM zoi.festival_applications WHERE id=p_application AND profile_id=actor;
 IF a.id IS NULL OR a.terms->>'kind' IS DISTINCT FROM 'booth' THEN RAISE EXCEPTION 'mesa_application_not_owned' USING ERRCODE='42501';END IF;
 event_scope:=a.event_id;
 -- Same ordering as save/publish/review: request -> event -> business/application.
 PERFORM pg_advisory_xact_lock(hashtextextended('mesa-map:'||event_scope::text,0));
 revoke_binding:=p_vendor_workspace IS NULL AND p_listing IS NULL;
 IF (p_vendor_workspace IS NULL)<>(p_listing IS NULL) THEN RAISE EXCEPTION 'mesa_invalid_business';END IF;
 -- Existing home editor locks profile before listing. Preserve that ordering
 -- before taking our sorted multi-listing set, avoiding profile/listing inversion.
 IF NOT revoke_binding THEN
  PERFORM 1 FROM zoi.user_profiles WHERE id=actor AND auth_user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mesa_permission_denied' USING ERRCODE='42501';END IF;
 END IF;
 PERFORM zoi.mesa_lock_listings(event_scope,ARRAY[p_listing],NOT revoke_binding);
 IF NOT revoke_binding THEN
  current_actor:=zoi.home_content_authorize(p_vendor_workspace,p_listing);
  IF current_actor IS DISTINCT FROM actor THEN RAISE EXCEPTION 'mesa_permission_denied' USING ERRCODE='42501';END IF;
  PERFORM 1 FROM zoi.listings WHERE id=p_listing AND owner_workspace_id=p_vendor_workspace FOR SHARE;
  IF NOT FOUND OR zoi.mesa_business(p_listing,p_vendor_workspace) IS NULL THEN RAISE EXCEPTION 'mesa_business_unavailable';END IF;
 END IF;
 current_actor:=zoi.mesa_vendor_actor(p_application);
 SELECT * INTO a FROM zoi.festival_applications WHERE id=p_application;
 IF current_actor IS DISTINCT FROM actor OR a.event_id IS DISTINCT FROM event_scope THEN RAISE EXCEPTION 'mesa_application_not_owned' USING ERRCODE='42501';END IF;
 IF NOT revoke_binding THEN
  PERFORM 1 FROM zoi.listings WHERE id=a.event_id AND owner_workspace_id=a.workspace_id AND publish_status='published' AND moderation_status IN('clean','cleared') AND coalesce(marketplace_status,'')<>'hidden' FOR SHARE;
  IF NOT FOUND OR a.status<>'approved' THEN RAISE EXCEPTION 'mesa_approved_booth_required';END IF;
  SELECT * INTO k FROM zoi.festival_packages WHERE id=a.package_id;
  IF k.kind IS DISTINCT FROM 'booth' OR k.workspace_id IS DISTINCT FROM a.workspace_id OR k.event_id IS DISTINCT FROM a.event_id THEN RAISE EXCEPTION 'mesa_approved_booth_required';END IF;
 END IF;
 -- Current authority above is checked even when returning an old request receipt.
 body:=jsonb_build_object('operation','vendor_bind','application',p_application,'workspace',p_vendor_workspace,'listing',p_listing,'version',p_expected_version);
 result:=zoi.mesa_receipt(actor,p_request,a.event_id,body);IF result IS NOT NULL THEN RETURN result;END IF;
 SELECT * INTO b FROM zoi.festival_vendor_bindings WHERE application_id=p_application FOR UPDATE;
 IF p_expected_version IS DISTINCT FROM coalesce(b.version,0) THEN RAISE EXCEPTION 'mesa_version_conflict';END IF;
 INSERT INTO zoi.festival_vendor_bindings(application_id,vendor_workspace_id,listing_id,version,state) VALUES(p_application,p_vendor_workspace,p_listing,1,CASE WHEN revoke_binding THEN 'revoked' ELSE 'proposed' END)
 ON CONFLICT(application_id) DO UPDATE SET vendor_workspace_id=excluded.vendor_workspace_id,listing_id=excluded.listing_id,version=festival_vendor_bindings.version+1,state=excluded.state,reviewed_by=NULL,reviewed_at=NULL,updated_at=clock_timestamp();
 result:=jsonb_build_object('ok',true,'application_id',p_application,'request_id',p_request,'binding',zoi.mesa_binding(p_application));
 RETURN zoi.mesa_receipt(actor,p_request,a.event_id,body,result);
END $$;
CREATE FUNCTION public.festival_vendor_review(p_workspace uuid,p_application uuid,p_expected_version integer,p_action text,p_request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;a zoi.festival_applications;k zoi.festival_packages;b zoi.festival_vendor_bindings;body jsonb;result jsonb;
BEGIN
 PERFORM zoi.mesa_request_lock(p_request);
 SELECT * INTO a FROM zoi.festival_applications WHERE id=p_application;
 IF a.id IS NULL THEN RAISE EXCEPTION 'mesa_application_unavailable';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('mesa-map:'||a.event_id::text,0));
 PERFORM zoi.mesa_lock_listings(a.event_id,ARRAY[(SELECT listing_id FROM zoi.festival_vendor_bindings WHERE application_id=p_application)],false);
 actor:=zoi.mesa_operator(p_workspace,a.event_id);
 SELECT * INTO a FROM zoi.festival_applications WHERE id=p_application FOR SHARE;
 SELECT * INTO k FROM zoi.festival_packages WHERE id=a.package_id;
 IF a.workspace_id IS DISTINCT FROM p_workspace OR a.status<>'approved' OR a.terms->>'kind' IS DISTINCT FROM 'booth' OR k.kind IS DISTINCT FROM 'booth' OR k.workspace_id IS DISTINCT FROM p_workspace OR k.event_id IS DISTINCT FROM a.event_id THEN RAISE EXCEPTION 'mesa_approved_booth_required';END IF;
 IF p_action IS NULL OR p_action NOT IN('accept','revoke') THEN RAISE EXCEPTION 'mesa_invalid_review';END IF;
 -- Binding cannot change while its listing authority is being inspected.
 SELECT * INTO b FROM zoi.festival_vendor_bindings WHERE application_id=p_application FOR UPDATE;
 IF b.application_id IS NULL THEN RAISE EXCEPTION 'mesa_binding_unavailable';END IF;
 IF p_action='accept' THEN
  PERFORM 1 FROM zoi.listings WHERE id=b.listing_id AND owner_workspace_id=b.vendor_workspace_id FOR SHARE;
  IF NOT FOUND OR zoi.mesa_business(b.listing_id,b.vendor_workspace_id) IS NULL THEN RAISE EXCEPTION 'mesa_business_unavailable';END IF;
 END IF;
 body:=jsonb_build_object('operation','vendor_review','workspace',p_workspace,'application',p_application,'version',p_expected_version,'action',p_action);
 result:=zoi.mesa_receipt(actor,p_request,a.event_id,body);IF result IS NOT NULL THEN RETURN result;END IF;
 IF p_expected_version IS DISTINCT FROM b.version THEN RAISE EXCEPTION 'mesa_version_conflict';END IF;
 IF p_action='accept' AND b.state<>'proposed' THEN RAISE EXCEPTION 'mesa_review_not_allowed';END IF;
 UPDATE zoi.festival_vendor_bindings SET state=CASE WHEN p_action='accept' THEN 'accepted' ELSE 'revoked' END,version=version+1,reviewed_by=actor,reviewed_at=clock_timestamp(),updated_at=clock_timestamp() WHERE application_id=p_application;
 result:=jsonb_build_object('ok',true,'application_id',p_application,'request_id',p_request,'binding',zoi.mesa_binding(p_application));
 RETURN zoi.mesa_receipt(actor,p_request,a.event_id,body,result);
END $$;
CREATE FUNCTION public.festival_map_public(p_event uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE m zoi.festival_maps;l zoi.listings;rows jsonb;
BEGIN
 SELECT * INTO m FROM zoi.festival_maps WHERE event_id=p_event;
 SELECT * INTO l FROM zoi.listings WHERE id=p_event AND owner_workspace_id=m.workspace_id
 AND publish_status='published' AND moderation_status IN('clean','cleared') AND coalesce(marketplace_status,'')<>'hidden';
 IF m.published_layout IS NULL OR l.id IS NULL THEN RETURN jsonb_build_object('ok',true,'available',false);END IF;
 SELECT coalesce(jsonb_agg((e.b-'application_id')||jsonb_build_object('label',CASE WHEN e.b->>'application_id' IS NOT NULL AND chosen.business IS NULL THEN 'Booth '||e.i ELSE e.b->>'label' END,'business',chosen.business) ORDER BY e.i),'[]') INTO rows
 FROM jsonb_array_elements(m.published_layout->'booths')WITH ORDINALITY e(b,i)
 LEFT JOIN LATERAL(
  SELECT zoi.mesa_business(v.listing_id,v.vendor_workspace_id) business
  FROM zoi.festival_applications a JOIN zoi.festival_packages k ON k.id=a.package_id
  JOIN zoi.festival_vendor_bindings v ON v.application_id=a.id AND v.state='accepted'
  WHERE a.id=(e.b->>'application_id')::uuid AND a.event_id=p_event AND a.workspace_id=m.workspace_id AND a.status='approved' AND a.terms->>'kind'='booth'
  AND k.kind='booth' AND k.event_id=p_event AND k.workspace_id=m.workspace_id
  AND (SELECT count(*) FROM jsonb_array_elements(m.published_layout->'booths')q WHERE (q->>'application_id')::uuid=a.id)<=a.units
 )chosen ON true;
 RETURN jsonb_build_object('ok',true,'available',true,'event',jsonb_build_object('id',l.id,'name',l.name),'version',m.published_version,'published_at',m.published_at,
 'layout',(m.published_layout-'booths')||jsonb_build_object('booths',rows));
END $$;

REVOKE ALL ON FUNCTION zoi.mesa_operator(uuid,uuid),zoi.mesa_vendor_actor(uuid),zoi.mesa_request_lock(uuid),zoi.mesa_lock_listings(uuid,uuid[],boolean),zoi.mesa_layout(jsonb,boolean),zoi.mesa_uri_component(text),zoi.mesa_business(uuid,uuid),zoi.mesa_binding(uuid),zoi.mesa_map_value(uuid),zoi.mesa_receipt(uuid,uuid,uuid,jsonb,jsonb),zoi.mesa_validate_assignments(uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.festival_map_operator(uuid,uuid),public.festival_map_save(uuid,uuid,integer,uuid,jsonb),public.festival_map_publish(uuid,uuid,integer,uuid),public.festival_map_public(uuid),public.festival_vendor_businesses(uuid),public.festival_vendor_bind(uuid,uuid,uuid,integer,uuid),public.festival_vendor_review(uuid,uuid,integer,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.festival_map_public(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.festival_map_operator(uuid,uuid),public.festival_map_save(uuid,uuid,integer,uuid,jsonb),public.festival_map_publish(uuid,uuid,integer,uuid),public.festival_vendor_businesses(uuid),public.festival_vendor_bind(uuid,uuid,uuid,integer,uuid),public.festival_vendor_review(uuid,uuid,integer,text,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
