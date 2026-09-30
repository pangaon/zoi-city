BEGIN;
CREATE TABLE IF NOT EXISTS zoi.intake_draft_requests (
 actor_id uuid NOT NULL REFERENCES auth.users(id), request_id uuid NOT NULL,
 workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id), listing_id uuid NOT NULL REFERENCES zoi.listings(id),
 payload_hash text NOT NULL, receipt jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,request_id)
);
ALTER TABLE zoi.intake_draft_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.intake_draft_requests FROM PUBLIC,anon,authenticated;
GRANT ALL ON zoi.intake_draft_requests TO service_role;
CREATE OR REPLACE FUNCTION zoi.intake_public_url(p_url text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v text:=btrim(coalesce(p_url,''));h text;
BEGIN
 IF length(v)<4 OR length(v)>2000 OR v~'[[:space:][:cntrl:]]' THEN RAISE EXCEPTION 'invalid_website'; END IF;
 IF v!~*'^https?://' THEN IF v~'://' THEN RAISE EXCEPTION 'invalid_website'; END IF;v:='https://'||v;END IF;
 h:=lower(substring(v from '(?i)^https?://([^/?#]+)'));
 IF h IS NULL OR h!~'^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,63}$' OR h~'(^|\.)(localhost|internal|intranet|lan|home|corp|private|test|example|invalid|onion|local|metadata)$' THEN RAISE EXCEPTION 'invalid_website'; END IF;
 -- This validates storage, not network reachability. Future fetches still require DNS/redirect/robots guards.
 v:=lower(substring(v from '(?i)^(https?)'))||'://'||h||substring(v from '(?i)^https?://[^/?#]+(.*)$');
 RETURN regexp_replace(v,'#.*$','');
END $$;
CREATE OR REPLACE FUNCTION zoi.intake_site_key(p_url text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT regexp_replace(regexp_replace(regexp_replace(zoi.intake_public_url(p_url),'^https?://(www\.)?','','i'),'\?.*$',''),'/+$','')
$$;
CREATE OR REPLACE FUNCTION zoi.intake_existing_key(p_url text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN RETURN zoi.intake_site_key(p_url);EXCEPTION WHEN OTHERS THEN RETURN NULL;END $$;
REVOKE ALL ON FUNCTION zoi.intake_existing_key(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION zoi.intake_public_url(text),zoi.intake_site_key(text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.intake_options() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated';END IF;
 SELECT id INTO p FROM zoi.user_profiles WHERE auth_user_id=auth.uid();
 RETURN jsonb_build_object('ok',true,'workspaces',coalesce((SELECT jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'role',m.role) ORDER BY w.name) FROM zoi.workspaces w JOIN zoi.workspace_members m ON m.workspace_id=w.id WHERE m.profile_id=p AND m.role IN('owner','admin')),'[]'::jsonb),'categories',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'slug',c.slug,'label',c.label_en) ORDER BY c.label_en) FROM zoi.categories c),'[]'::jsonb),'extraction_available',false);
END $$;
CREATE OR REPLACE FUNCTION public.intake_lookup(p_website text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v text;k text;h text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated';END IF;
 v:=zoi.intake_public_url(p_website);k:=zoi.intake_site_key(v);h:=split_part(k,'/',1);
 RETURN jsonb_build_object('ok',true,'website',v,'extraction_available',false,'matches',coalesce((SELECT jsonb_agg(x) FROM (
 SELECT l.id,l.name,l.slug,l.entity_type,l.city,l.country,
 '/'||CASE WHEN l.entity_type='travel_place' THEN 'travel-place' WHEN l.entity_type IN('business','professional','church','school','organization','event','venue','sports','vendor','creator','artist') THEN l.entity_type ELSE 'p' END||'/'||l.slug AS path,
 zoi.intake_existing_key(l.website)=k AS exact_url
 FROM zoi.listings l WHERE l.publish_status='published' AND l.moderation_status IN('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden'
 AND lower(regexp_replace(substring(l.website from '(?i)^https?://([^/?#]+)'),'^www\.',''))=h
 ORDER BY (zoi.intake_existing_key(l.website)=k) DESC,l.name,l.id LIMIT 12)x),'[]'::jsonb));
END $$;
CREATE OR REPLACE FUNCTION public.intake_create_draft(p_request uuid,p_workspace uuid,p_website text,p_name text,p_entity_type text,p_category bigint,p_city text DEFAULT NULL,p_country text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid();prof uuid;role_name text;v text;k text;nm text:=btrim(coalesce(p_name,''));ct text:=btrim(coalesce(p_city,''));co text:=btrim(coalesce(p_country,''));h text;prior zoi.intake_draft_requests; lid uuid;lslug text;receipt jsonb;existing record;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated';END IF;
 IF p_request IS NULL OR p_workspace IS NULL THEN RAISE EXCEPTION 'invalid_request';END IF;
 SELECT id INTO prof FROM zoi.user_profiles WHERE auth_user_id=uid;
 SELECT role INTO role_name FROM zoi.workspace_members WHERE workspace_id=p_workspace AND profile_id=prof FOR SHARE;
 IF role_name IS NULL OR role_name NOT IN('owner','admin') THEN RAISE EXCEPTION 'insufficient_permission';END IF;
 v:=zoi.intake_public_url(p_website);k:=zoi.intake_site_key(v);
 IF length(nm) NOT BETWEEN 2 AND 200 OR length(ct)>120 OR length(co)>120 OR nm~'[[:cntrl:]]' OR ct~'[[:cntrl:]]' OR co~'[[:cntrl:]]' THEN RAISE EXCEPTION 'invalid_details';END IF;
 IF p_entity_type IS NULL OR p_entity_type NOT IN('business','professional','church','school','organization','venue','sports','vendor','creator','artist','travel_place') OR NOT EXISTS(SELECT 1 FROM zoi.categories WHERE id=p_category) THEN RAISE EXCEPTION 'invalid_category';END IF;
 h:=md5(jsonb_build_object('workspace',p_workspace,'website',v,'name',nm,'type',p_entity_type,'category',p_category,'city',ct,'country',co)::text);
 PERFORM pg_advisory_xact_lock(hashtextextended('intake-actor:'||uid::text,0));
 SELECT * INTO prior FROM zoi.intake_draft_requests WHERE actor_id=uid AND request_id=p_request;
 IF FOUND THEN
  IF prior.payload_hash<>h OR prior.workspace_id<>p_workspace THEN RAISE EXCEPTION 'request_conflict';END IF;
  IF NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id=prior.listing_id AND owner_workspace_id=p_workspace) THEN RAISE EXCEPTION 'ownership_changed';END IF;
  RETURN prior.receipt;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('intake-identity:'||k||':'||lower(nm)||':'||lower(ct)||':'||lower(co),0));
 -- Reuse this workspace's existing private draft; never reveal another account's private record.
 SELECT id,slug,entity_type,primary_category_id INTO existing FROM zoi.listings WHERE owner_workspace_id=p_workspace AND profile#>>'{_intake,site_key}'=k AND lower(name)=lower(nm) AND lower(coalesce(city,''))=lower(ct) AND lower(coalesce(country,''))=lower(co) AND publish_status='draft' AND marketplace_status='hidden' AND verification_status='unverified' AND claim_status='unclaimed' ORDER BY id LIMIT 1 FOR UPDATE;
 IF FOUND THEN IF existing.entity_type<>p_entity_type OR existing.primary_category_id IS DISTINCT FROM p_category THEN RAISE EXCEPTION 'existing_draft_requires_edit';END IF;lid:=existing.id;lslug:=existing.slug;
 ELSE
  IF EXISTS(SELECT 1 FROM zoi.listings WHERE profile#>>'{_intake,site_key}'=k AND lower(name)=lower(nm) AND lower(coalesce(city,''))=lower(ct) AND lower(coalesce(country,''))=lower(co)) THEN RAISE EXCEPTION 'submission_requires_review';END IF;
  IF (SELECT count(*) FROM zoi.listings WHERE profile#>>'{_intake,submitted_by}'=uid::text AND created_at>now()-interval '1 day')>=5 THEN RAISE EXCEPTION 'rate_limited';END IF;
  lid:=gen_random_uuid();lslug:='draft-'||lid::text;
  INSERT INTO zoi.listings(id,slug,name,website,city,country,entity_type,primary_category_id,publish_status,marketplace_status,verification_status,claim_status,owner_workspace_id,owner_user_id,profile)
  VALUES(lid,lslug,nm,v,nullif(ct,''),nullif(co,''),p_entity_type,p_category,'draft','hidden','unverified','unclaimed',p_workspace,uid,jsonb_build_object('_intake',jsonb_build_object('submitted_by',uid,'submitted_at',now(),'source','self_serve_workspace','site_key',k,'review_status','draft','extraction_status','not_requested','ownership_verified',false)));
  -- Fail closed if an existing trigger unexpectedly changes this private boundary.
  IF NOT EXISTS(SELECT 1 FROM zoi.listings WHERE id=lid AND publish_status='draft' AND marketplace_status='hidden' AND verification_status='unverified' AND claim_status='unclaimed' AND owner_workspace_id=p_workspace) THEN RAISE EXCEPTION 'private_draft_not_confirmed';END IF;
 END IF;
 IF (SELECT count(*) FROM zoi.intake_draft_requests WHERE actor_id=uid AND created_at>now()-interval '1 day')>=20 THEN RAISE EXCEPTION 'rate_limited';END IF;
 receipt:=jsonb_build_object('ok',true,'request_id',p_request,'workspace_id',p_workspace,'listing_id',lid,'slug',lslug,'name',nm,'status','private_draft','published',false,'ownership_verified',false,'extraction_status','not_requested');
 INSERT INTO zoi.intake_draft_requests VALUES(uid,p_request,p_workspace,lid,h,receipt,now());
 RETURN receipt;
END $$;
CREATE OR REPLACE FUNCTION public.intake_draft_receipt(p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r zoi.intake_draft_requests;prof uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated';END IF;
 SELECT * INTO r FROM zoi.intake_draft_requests WHERE actor_id=auth.uid() AND request_id=p_request;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'found',false);END IF;
 SELECT id INTO prof FROM zoi.user_profiles WHERE auth_user_id=auth.uid();
 IF NOT EXISTS(SELECT 1 FROM zoi.workspace_members m JOIN zoi.listings l ON l.owner_workspace_id=m.workspace_id WHERE m.workspace_id=r.workspace_id AND m.profile_id=prof AND m.role IN('owner','admin') AND l.id=r.listing_id) THEN RAISE EXCEPTION 'insufficient_permission';END IF;
 RETURN jsonb_build_object('ok',true,'found',true,'receipt',r.receipt);
END $$;
-- Old callers may search safely, but must use the guided workspace flow to write.
CREATE OR REPLACE FUNCTION public.intake_submit(p_website text,p_name text DEFAULT NULL,p_city text DEFAULT NULL,p_country text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb;
BEGIN
 r:=public.intake_lookup(p_website);
 RETURN r||jsonb_build_object('ok',false,'error','workspace_draft_required','status','review_matches','next','/add/');
END $$;
REVOKE ALL ON FUNCTION public.intake_options(),public.intake_lookup(text),public.intake_create_draft(uuid,uuid,text,text,text,bigint,text,text),public.intake_draft_receipt(uuid),public.intake_submit(text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.intake_options(),public.intake_lookup(text),public.intake_create_draft(uuid,uuid,text,text,text,bigint,text,text),public.intake_draft_receipt(uuid),public.intake_submit(text,text,text,text) TO authenticated,service_role;
COMMIT;
