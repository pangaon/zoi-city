-- V2 supersedes HELD/unapplied phaseA; original migration is preserved only in its frozen tree.
BEGIN;
SET LOCAL statement_timeout='5s';
SET LOCAL lock_timeout='1s';
DO $guard$ BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'quality_atomic_requires_postgres';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.listing_quality_checklist(uuid)') AND md5(pg_get_functiondef(oid))='8bc7eaa240a980f81c299c0c5e5ba14c' AND proacl::text='{postgres=X/postgres,service_role=X/postgres}' AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=""'] AND prosecdef=true) THEN RAISE EXCEPTION 'quality_atomic_dependency_drift: listing_quality_checklist';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.listing_quality_criterion_record(uuid,uuid,text,integer,text,text,uuid,text,text,text,text,jsonb)') AND md5(pg_get_functiondef(oid))='5a4f7aba7c7338225cd31213ab8c0f57' AND proacl::text='{postgres=X/postgres,service_role=X/postgres}' AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=""'] AND prosecdef=true) THEN RAISE EXCEPTION 'quality_atomic_dependency_drift: listing_quality_criterion_record';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.listing_quality_task_finish(uuid,text,text,jsonb)') AND md5(pg_get_functiondef(oid))='c941e6de4473d919bc4c054d85e1c024' AND proacl::text='{postgres=X/postgres,service_role=X/postgres}' AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=""'] AND prosecdef=true) THEN RAISE EXCEPTION 'quality_atomic_dependency_drift: listing_quality_task_finish';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.listing_quality_task_lease(text,integer)') AND md5(pg_get_functiondef(oid))='d27811ceaaf8e1ed2a7f0000daddba47' AND proacl::text='{postgres=X/postgres,service_role=X/postgres}' AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=""'] AND prosecdef=true) THEN RAISE EXCEPTION 'quality_atomic_dependency_drift: listing_quality_task_lease';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.listing_quality_fingerprint(zoi.listings)') AND md5(pg_get_functiondef(oid))='cc69353ab17d09e06846eb90c1ee34cd' AND proacl::text='{postgres=X/postgres,service_role=X/postgres}' AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=""'] AND prosecdef=false) THEN RAISE EXCEPTION 'quality_atomic_dependency_drift: listing_quality_fingerprint';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.listing_quality_state(zoi.listings)') AND md5(pg_get_functiondef(oid))='ea1641facea45c788f8e6ca84feaf6d4' AND proacl::text='{postgres=X/postgres,service_role=X/postgres}' AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=""'] AND prosecdef=false) THEN RAISE EXCEPTION 'quality_atomic_dependency_drift: listing_quality_state';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.quality_criterion_fingerprint(zoi.listings)') AND md5(pg_get_functiondef(oid))='a6386c358b3b3df01fb1efa4d8f538f1' AND proacl::text='{postgres=X/postgres}' AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=""'] AND prosecdef=false) THEN RAISE EXCEPTION 'quality_atomic_dependency_drift: quality_criterion_fingerprint';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('zoi.quality_family(zoi.listings)') AND md5(pg_get_functiondef(oid))='5cff969787c5f341903e53c8e82fd984' AND proacl::text='{postgres=X/postgres}' AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=""'] AND prosecdef=false) THEN RAISE EXCEPTION 'quality_atomic_dependency_drift: quality_family';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.listing_quality_criterion_revise(text,integer,text)') AND md5(pg_get_functiondef(oid))='d9f3bc5f58c636b0cf01684b0df83f8e' AND proacl::text='{postgres=X/postgres,service_role=X/postgres}' AND pg_get_userbyid(proowner)='postgres' AND prosecdef AND proconfig=ARRAY['search_path=""'])THEN RAISE EXCEPTION 'quality_atomic_revision_publisher_drift';END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='zoi' AND p.proname IN('quality_source_hold_state','quality_criterion_context','quality_checklist_snapshot')) OR (n.nspname='public'AND p.proname='listing_quality_current_source_context')) THEN RAISE EXCEPTION 'quality_atomic_helper_exists';END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN('zoi.quality_criteria'::regclass,'zoi.quality_signoffs'::regclass) AND (NOT relrowsecurity OR pg_get_userbyid(relowner)<>'postgres' OR relacl::text IS DISTINCT FROM (CASE WHEN current_setting('server_version_num')::integer>=170000 THEN '{postgres=arwdDxtm/postgres,service_role=r/postgres}' ELSE '{postgres=arwdDxt/postgres,service_role=r/postgres}' END))) OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid IN('zoi.quality_criteria'::regclass,'zoi.quality_signoffs'::regclass)) OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid IN('zoi.quality_criteria'::regclass,'zoi.quality_signoffs'::regclass)AND NOT tgisinternal) THEN RAISE EXCEPTION 'quality_atomic_store_drift';END IF;
END $guard$;
DO $shape$ BEGIN IF (SELECT jsonb_agg(pg_get_constraintdef(oid)ORDER BY pg_get_constraintdef(oid))FROM pg_constraint WHERE conrelid='zoi.quality_criteria'::regclass) IS DISTINCT FROM '["CHECK ((evidence_kind = ANY (ARRAY[''source''::text, ''render''::text, ''journey''::text])))","CHECK ((revision > 0))","CHECK ((task = ANY (ARRAY[''classification''::text, ''design''::text, ''verification''::text])))","PRIMARY KEY (key, revision)"]'::jsonb THEN RAISE EXCEPTION 'quality_atomic_constraint_drift: quality_criteria';END IF;END $shape$;
DO $shape$ BEGIN IF (SELECT jsonb_agg(pg_get_constraintdef(oid)ORDER BY pg_get_constraintdef(oid))FROM pg_constraint WHERE conrelid='zoi.quality_signoffs'::regclass) IS DISTINCT FROM '["CHECK ((release_commit ~ ''^[a-f0-9]{40}$''::text))","CHECK ((stage = ANY (ARRAY[''specialist''::text, ''reviewer''::text])))","CHECK ((status = ANY (ARRAY[''passed''::text, ''blocked''::text])))","FOREIGN KEY (criterion, revision) REFERENCES zoi.quality_criteria(key, revision)","FOREIGN KEY (listing_id) REFERENCES zoi.listings(id) ON DELETE CASCADE","FOREIGN KEY (specialist_id) REFERENCES zoi.quality_signoffs(id)","PRIMARY KEY (id)","UNIQUE (request_id)"]'::jsonb THEN RAISE EXCEPTION 'quality_atomic_constraint_drift: quality_signoffs';END IF;END $shape$;
CREATE FUNCTION zoi.quality_source_hold_state(l zoi.listings) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $hold$
DECLARE e jsonb:=coalesce(l.profile->'_enrich','{}');snapshot jsonb:='{}';valid boolean:=l.profile IS NULL OR jsonb_typeof(l.profile)='object';held boolean:=false;k text;v jsonb;
BEGIN
 IF jsonb_typeof(e) IS DISTINCT FROM 'object' THEN RETURN jsonb_build_object('valid',false,'held',true,'snapshot',jsonb_build_object('invalid_enrich',e));END IF;
 FOREACH k IN ARRAY ARRAY['blocked','blocked_reason','scope_review_required','source_scope_mismatch','organization_identity_quarantine','source_identity','identity_scope','source_kind','member','association_member','source_affiliation','source_challenge','challenge','crawl_status','last_error'] LOOP
 IF e?k THEN snapshot:=snapshot||jsonb_build_object(k,e->k);END IF;END LOOP;
 IF octet_length(snapshot::text)>65536 THEN RETURN jsonb_build_object('valid',false,'held',true,'snapshot',jsonb_build_object('context_oversize_sha256',encode(sha256(convert_to(snapshot::text,'UTF8')),'hex')));END IF;
 FOREACH k IN ARRAY ARRAY['blocked','scope_review_required','source_scope_mismatch','organization_identity_quarantine','source_challenge','challenge'] LOOP
 v:=e->k;IF e?k AND v NOT IN('true'::jsonb,'false'::jsonb,'"true"'::jsonb,'"false"'::jsonb,'null'::jsonb) THEN valid:=false;END IF;
 IF e->>k='true' THEN held:=true;END IF;END LOOP;
 FOREACH k IN ARRAY ARRAY['blocked_reason','identity_scope','source_kind','crawl_status','last_error'] LOOP
 IF e?k AND jsonb_typeof(e->k) NOT IN('string','null') THEN valid:=false;END IF;END LOOP;
 IF e?'source_identity' AND jsonb_typeof(e->'source_identity') NOT IN('object','null') THEN valid:=false;END IF;
 IF e#>'{source_identity,verification}' IS NOT NULL AND jsonb_typeof(e#>'{source_identity,verification}') NOT IN('string','null') THEN valid:=false;END IF;
 held:=held OR length(btrim(coalesce(e->>'blocked_reason','')))>0 OR coalesce(e#>>'{source_identity,verification}','')~*'review_required|quarantin|blocked|scope_mismatch|unverified|pending|challenge' OR e->>'identity_scope'='organization' OR e->>'source_kind'IN('association_directory','association_member','supporting_publisher_profile') OR e?'member' OR e?'association_member' OR e?'source_affiliation' OR e->>'crawl_status'='error';
 RETURN jsonb_build_object('valid',valid,'held',NOT valid OR coalesce(held,false),'snapshot',snapshot);
END $hold$;
CREATE FUNCTION zoi.quality_criterion_context(c zoi.quality_criteria,s zoi.quality_signoffs,p_task_fp text,p_criterion_fp text,p_hold jsonb) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $context$
 SELECT jsonb_build_object('schema','zoi.quality.criterion-atomic-context.v1','task_fingerprint',p_task_fp,'criterion_fingerprint',p_criterion_fp,'server_requirement_sha256',encode(sha256(convert_to(jsonb_build_array(c.key,c.revision,c.family,c.title,c.task,c.evidence_kind,c.requirement)::text,'UTF8')),'hex'),'requirement_descriptor',jsonb_build_object('key',c.key,'revision',c.revision,'family',c.family,'title',c.title,'task',c.task,'evidence_kind',c.evidence_kind,'requirement',c.requirement),'source_hold_snapshot',p_hold->'snapshot','source_context_valid',p_hold->'valid','expected_latest_id',s.id)
$context$;
CREATE FUNCTION zoi.quality_checklist_snapshot(l zoi.listings) RETURNS jsonb LANGUAGE plpgsql VOLATILE SET search_path='' AS $snapshot$
DECLARE criteria jsonb;fp text;task_fp text;h jsonb:=zoi.quality_source_hold_state(l);visible boolean:=coalesce(l.publish_status='published'AND l.moderation_status IN('clean','cleared')AND coalesce(l.marketplace_status,'')<>'hidden',false);
BEGIN
 IF h->>'valid'='true' THEN fp:=zoi.quality_criterion_fingerprint(l);task_fp:=zoi.listing_quality_fingerprint(l);END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',c.key,'revision',c.revision,'family',c.family,'title',c.title,'task',c.task,'evidence_kind',c.evidence_kind,'requirement',c.requirement,'status',CASE WHEN NOT visible THEN 'blocked_visibility' WHEN h->>'valid' IS DISTINCT FROM 'true' THEN 'blocked_source_context' WHEN h->>'held'='true' THEN 'blocked_source_hold' WHEN NOT coalesce((zoi.listing_quality_state(l)->>'source_available')::boolean,false) THEN 'blocked_source_missing' WHEN s.id IS NULL THEN 'pending' WHEN s.source_fingerprint IS DISTINCT FROM fp OR s.recorded_at<clock_timestamp()-interval '7 days' OR s.recorded_at>clock_timestamp()+interval '5 minutes' OR s.evidence#>>'{atomic_context,schema}' IS DISTINCT FROM 'zoi.quality.criterion-atomic-context.v1' THEN 'pending_recheck' WHEN s.status='blocked' THEN 'blocked' WHEN s.stage='specialist' THEN 'awaiting_independent_review' ELSE 'signed_off' END,'atomic_context',zoi.quality_criterion_context(c,s,task_fp,fp,h),'latest_evidence',CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('id',s.id,'request_id',s.request_id,'request_sha256',encode(sha256(convert_to(s.request::text,'UTF8')),'hex'),'stage',s.stage,'actor',s.actor,'release_commit',s.release_commit,'recorded_at',s.recorded_at,'evidence',s.evidence) END)ORDER BY c.key),'[]')INTO criteria
 FROM(SELECT DISTINCT ON(key)* FROM zoi.quality_criteria ORDER BY key,revision DESC)c LEFT JOIN LATERAL(SELECT x.* FROM zoi.quality_signoffs x WHERE x.listing_id=l.id AND x.criterion=c.key AND x.revision=c.revision ORDER BY x.recorded_at DESC,x.id DESC LIMIT 1)s ON true WHERE c.family IN('*',zoi.quality_family(l),'category:'||l.primary_category_id);
 RETURN jsonb_build_object('listing_id',l.id,'category_id',l.primary_category_id,'family',zoi.quality_family(l),'source_fingerprint',fp,'criteria',criteria,'complete',jsonb_array_length(criteria)>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(criteria)c WHERE c->>'status'<>'signed_off'));
END $snapshot$;
CREATE FUNCTION public.listing_quality_current_source_context(p_listing uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET lock_timeout='1s' AS $reader$
DECLARE keys text[];k text;l zoi.listings;h jsonb;ck jsonb;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'criterion_read_committed_required';END IF;
 -- Global catalogue keys only (<=300), sorted before listing/category/catalogue locks.
 SELECT array_agg(key ORDER BY key)INTO keys FROM(SELECT DISTINCT key FROM zoi.quality_criteria)x;
 IF coalesce(cardinality(keys),0) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'criterion_catalogue_bounds';END IF;
 FOREACH k IN ARRAY keys LOOP PERFORM pg_advisory_xact_lock(hashtextextended(p_listing::text||':'||k,72111));END LOOP;
 SELECT * INTO l FROM zoi.listings WHERE id=p_listing FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'listing_not_found';END IF;
 PERFORM 1 FROM zoi.categories WHERE id=l.primary_category_id FOR SHARE;
 LOCK TABLE zoi.quality_criteria IN SHARE MODE;
 IF EXISTS(SELECT 1 FROM zoi.quality_criteria WHERE NOT(key=ANY(keys)))THEN RAISE EXCEPTION 'criterion_catalogue_changed';END IF;
 h:=zoi.quality_source_hold_state(l);ck:=zoi.quality_checklist_snapshot(l);
 RETURN jsonb_build_object('schema','zoi.quality.current-source-context.v1','contract_version','atomic-v1','listing_id',l.id,'criterion_fingerprint',ck->'source_fingerprint','task_fingerprint',CASE WHEN h->>'valid'='true' THEN zoi.listing_quality_fingerprint(l) END,'source_context_valid',h->'valid','source_held',h->'held','source_hold_snapshot',h->'snapshot','existing_enrich',CASE WHEN h->>'valid'='true' THEN h->'snapshot' ELSE '{}'::jsonb END,'checklist',ck,'observed_at',clock_timestamp());
END $reader$;
CREATE OR REPLACE FUNCTION public.listing_quality_checklist(p_listing uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET lock_timeout='1s' AS $checklist$
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'criterion_read_committed_required';END IF;
 RETURN public.listing_quality_current_source_context(p_listing)->'checklist';
END $checklist$;
CREATE OR REPLACE FUNCTION public.listing_quality_criterion_record(p_request uuid, p_listing uuid, p_criterion text, p_revision integer, p_stage text, p_actor text, p_specialist uuid, p_lease text, p_fingerprint text, p_commit text, p_status text, p_evidence jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 VOLATILE
 SECURITY DEFINER
 SET search_path TO ''
 SET lock_timeout TO '1s'
AS $function$
DECLARE l zoi.listings;c zoi.quality_criteria;s zoi.quality_signoffs;old zoi.quality_signoffs;body jsonb;result zoi.quality_signoffs;lease jsonb;h jsonb;tip zoi.quality_signoffs;ctx jsonb;ck jsonb;current_item jsonb;
BEGIN
 IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION 'criterion_read_committed_required';END IF;
 body:=jsonb_build_array(p_listing,p_criterion,p_revision,p_stage,p_actor,p_specialist,p_lease,p_fingerprint,p_commit,p_status,p_evidence);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,72110));SELECT * INTO old FROM zoi.quality_signoffs WHERE request_id=p_request;
 IF FOUND AND old.request IS DISTINCT FROM body THEN RAISE EXCEPTION 'request_conflict';END IF;
 IF p_request IS NULL OR p_stage IS NULL OR p_stage NOT IN('specialist','reviewer') OR p_status IS NULL OR p_status NOT IN('passed','blocked') OR p_actor IS NULL OR p_actor !~ '^[a-zA-Z0-9_./:@-]{3,120}$' OR p_commit IS NULL OR p_commit !~ '^[a-f0-9]{40}$' OR jsonb_typeof(p_evidence) IS DISTINCT FROM 'object' OR octet_length(p_evidence::text)>16000 THEN RAISE EXCEPTION 'invalid_criterion_evidence';END IF;
 IF p_listing IS NULL OR p_criterion IS NULL THEN RAISE EXCEPTION 'invalid_criterion_context';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_listing::text||':'||p_criterion,72111));
 SELECT * INTO l FROM zoi.listings WHERE id=p_listing FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'listing_not_found';END IF;
 PERFORM 1 FROM zoi.categories WHERE id=l.primary_category_id FOR SHARE;
 LOCK TABLE zoi.quality_criteria IN SHARE MODE;
 IF old.id IS NOT NULL THEN
  ck:=zoi.quality_checklist_snapshot(l);SELECT item INTO current_item FROM jsonb_array_elements(ck->'criteria')item WHERE item->>'key'=p_criterion;
  RETURN jsonb_build_object('ok',true,'id',old.id,'already',true,'recorded',true,'contract_version','atomic-v1','current',coalesce(current_item#>>'{latest_evidence,id}'=old.id::text AND old.source_fingerprint IS NOT DISTINCT FROM ck->>'source_fingerprint' AND old.revision::text=current_item->>'revision' AND old.evidence#>>'{atomic_context,schema}'='zoi.quality.criterion-atomic-context.v1' AND old.recorded_at>=clock_timestamp()-interval '7 days' AND old.recorded_at<=clock_timestamp()+interval '5 minutes' AND ((old.status='passed' AND current_item->>'status' IN('awaiting_independent_review','signed_off')) OR (old.status='blocked' AND current_item->>'status' IN('blocked','blocked_source_hold','blocked_source_missing'))),false),'current_status',current_item->>'status');
 END IF;
 h:=zoi.quality_source_hold_state(l);IF h->>'valid' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'current_source_hold';END IF;
 IF p_fingerprint IS DISTINCT FROM zoi.quality_criterion_fingerprint(l) THEN RAISE EXCEPTION 'source_changed';END IF;
 SELECT * INTO c FROM zoi.quality_criteria WHERE key=p_criterion ORDER BY revision DESC LIMIT 1;
 IF c.key IS NULL OR p_revision IS DISTINCT FROM c.revision OR c.family NOT IN('*',zoi.quality_family(l),'category:'||l.primary_category_id) THEN RAISE EXCEPTION 'criterion_changed';END IF;
 SELECT * INTO tip FROM zoi.quality_signoffs WHERE listing_id=l.id AND criterion=c.key AND revision=c.revision ORDER BY recorded_at DESC,id DESC LIMIT 1;
 h:=zoi.quality_source_hold_state(l);ctx:=zoi.quality_criterion_context(c,tip,zoi.listing_quality_fingerprint(l),p_fingerprint,h);
 IF p_status='passed' AND (h->>'valid' IS DISTINCT FROM 'true' OR h->>'held' IS DISTINCT FROM 'false' OR NOT coalesce((zoi.listing_quality_state(l)->>'source_available')::boolean,false))THEN RAISE EXCEPTION 'current_source_hold';END IF;
 IF p_evidence->'atomic_context' IS DISTINCT FROM ctx THEN RAISE EXCEPTION 'criterion_atomic_context_changed';END IF;
 IF p_evidence->>'kind' IS DISTINCT FROM c.evidence_kind OR jsonb_typeof(p_evidence->'refs') IS DISTINCT FROM 'array' OR jsonb_array_length(p_evidence->'refs') NOT BETWEEN 1 AND 12 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_evidence->'refs')r WHERE coalesce(r->>'uri','') !~ '^https://' OR coalesce(r->>'sha256','') !~ '^[a-f0-9]{64}$') OR jsonb_typeof(p_evidence->'blockers') IS DISTINCT FROM 'array' OR length(coalesce(p_evidence->>'observations','')) NOT BETWEEN 20 AND 6000 THEN RAISE EXCEPTION 'evidence_artifacts_required';END IF;
 IF p_status='passed' AND (jsonb_array_length(p_evidence->'blockers')<>0 OR p_evidence->>'performed' IS DISTINCT FROM 'true' OR NOT coalesce((zoi.listing_quality_state(l)->>'public_eligible')::boolean,false)) THEN RAISE EXCEPTION 'blockers_prevent_signoff';END IF;
 IF p_stage='specialist' THEN
 lease:=l.profile#>'{_enrich,lease}';
 IF p_lease IS NULL OR lease->>'id' IS DISTINCT FROM p_lease OR lease->>'task' IS DISTINCT FROM c.task OR lease->>'fingerprint' IS DISTINCT FROM zoi.listing_quality_fingerprint(l) OR coalesce(zoi.enrich_timestamp(lease->>'expires_at'),'-infinity')<=clock_timestamp() OR p_specialist IS NOT NULL THEN RAISE EXCEPTION 'existing_quality_lease_required';END IF;
 ELSE
 IF tip.id IS DISTINCT FROM p_specialist THEN RAISE EXCEPTION 'independent_current_specialist_required';END IF;
 SELECT * INTO s FROM zoi.quality_signoffs WHERE id=p_specialist;
 IF s.id IS NULL OR s.stage<>'specialist' OR s.status<>'passed' OR s.listing_id<>p_listing OR s.criterion<>c.key OR s.revision<>c.revision OR s.source_fingerprint<>p_fingerprint OR s.release_commit<>p_commit OR s.actor=p_actor OR s.evidence#>>'{atomic_context,schema}' IS DISTINCT FROM 'zoi.quality.criterion-atomic-context.v1' OR s.recorded_at<clock_timestamp()-interval '7 days' OR s.recorded_at>clock_timestamp()+interval '5 minutes' THEN RAISE EXCEPTION 'independent_review_required';END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_evidence->'refs') r WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.evidence->'refs') oldref WHERE oldref->>'sha256'=r->>'sha256')) THEN RAISE EXCEPTION 'independent_review_artifact_required';END IF;
 IF EXISTS(SELECT 1 FROM zoi.quality_signoffs x WHERE x.listing_id=p_listing AND x.criterion=c.key AND x.recorded_at>s.recorded_at AND x.stage='specialist') THEN RAISE EXCEPTION 'specialist_superseded';END IF;
 END IF;
 INSERT INTO zoi.quality_signoffs(request_id,listing_id,criterion,revision,stage,actor,specialist_id,source_fingerprint,release_commit,status,lease_id,evidence,request,recorded_at)VALUES(p_request,p_listing,c.key,c.revision,p_stage,p_actor,p_specialist,p_fingerprint,p_commit,p_status,p_lease,p_evidence,body,clock_timestamp())RETURNING * INTO result;
 SELECT * INTO tip FROM zoi.quality_signoffs WHERE listing_id=l.id AND criterion=c.key AND revision=c.revision ORDER BY recorded_at DESC,id DESC LIMIT 1;
 IF tip.id IS DISTINCT FROM result.id THEN RAISE EXCEPTION 'criterion_tip_order_uncertain';END IF;
 RETURN jsonb_build_object('ok',true,'id',result.id,'already',false,'recorded',true,'current',true,'contract_version','atomic-v1');
END $function$
;
REVOKE ALL ON FUNCTION zoi.quality_source_hold_state(zoi.listings),zoi.quality_criterion_context(zoi.quality_criteria,zoi.quality_signoffs,text,text,jsonb),zoi.quality_checklist_snapshot(zoi.listings),public.listing_quality_current_source_context(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.listing_quality_current_source_context(uuid) TO service_role;
COMMIT;
