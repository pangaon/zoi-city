BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
CREATE TABLE zoi.delivery_founders(user_id uuid PRIMARY KEY REFERENCES auth.users(id),enabled boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE zoi.delivery_state(key text PRIMARY KEY,value jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE zoi.delivery_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL UNIQUE,kind text NOT NULL,title text NOT NULL,payload jsonb NOT NULL,evidence_state text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX delivery_events_recent_idx ON zoi.delivery_events(created_at DESC,id);
CREATE TABLE zoi.delivery_features(id text PRIMARY KEY,info jsonb NOT NULL,release jsonb NOT NULL,proof jsonb NOT NULL,state text NOT NULL CHECK(state IN('live and verified','failed','rolled back')),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE zoi.delivery_record_evidence(category text NOT NULL,listing_id uuid NOT NULL REFERENCES zoi.listings(id),changed text NOT NULL,before_value jsonb,after_value jsonb,evidence jsonb NOT NULL,release jsonb,verification text NOT NULL CHECK(verification IN('reported','independent source verified','production journey verified')),record_fingerprint text NOT NULL,completed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(category,listing_id));
CREATE TABLE zoi.delivery_reports(request_id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),context jsonb NOT NULL,queue_group text NOT NULL,message text NOT NULL,state text NOT NULL DEFAULT 'being tested',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE zoi.delivery_action_checks(request_id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),action_id text NOT NULL,state text NOT NULL DEFAULT 'check_required',observation jsonb,created_at timestamptz NOT NULL DEFAULT now(),checked_at timestamptz);
DO $secure$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['delivery_founders','delivery_state','delivery_events','delivery_features','delivery_record_evidence','delivery_reports','delivery_action_checks'] LOOP
 EXECUTE format('ALTER TABLE zoi.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON zoi.%I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
END $secure$;
CREATE FUNCTION zoi.delivery_require_founder() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();sid_text text:=auth.jwt()->>'session_id';sid uuid;
BEGIN
 IF actor IS NULL OR NOT coalesce(zoi.is_admin(),false) OR NOT EXISTS(SELECT 1 FROM zoi.delivery_founders f WHERE f.user_id=actor AND f.enabled)
 OR coalesce(sid_text,'')!~'^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$' THEN RAISE EXCEPTION 'founder_access_required' USING ERRCODE='42501';END IF;
 sid:=sid_text::uuid;
 IF NOT EXISTS(SELECT 1 FROM auth.users u JOIN auth.sessions s ON s.user_id=u.id WHERE u.id=actor AND s.id=sid
 AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND NOT coalesce(u.is_anonymous,false)
 AND (u.banned_until IS NULL OR u.banned_until<=now()) AND (s.not_after IS NULL OR s.not_after>now()))
 THEN RAISE EXCEPTION 'current_founder_session_required' USING ERRCODE='42501';END IF;
 RETURN actor;
END $$;
REVOKE ALL ON FUNCTION zoi.delivery_require_founder() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.zoi_delivery_progress(p_request uuid,p_kind text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE prior zoi.delivery_events;payload_size integer:=octet_length(p_payload::text);feature text;
BEGIN
 IF p_request IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR payload_size>1800000
 OR p_kind NOT IN('queue_sync','metrics_sync','owner_actions_sync','mobile_sync','activity','release_verified','release_failed','release_rolled_back','record_verified','action_observed')
 OR p_payload::text ~ '(gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40}|sk_(live|test)_[A-Za-z0-9]{16}|AIza[0-9A-Za-z_-]{35}|BEGIN [A-Z ]*PRIVATE KEY)'
 THEN RAISE EXCEPTION 'invalid_delivery_event';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('delivery-event:'||p_request::text,0));
 SELECT * INTO prior FROM zoi.delivery_events WHERE request_id=p_request;
 IF FOUND THEN IF prior.kind<>p_kind OR prior.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'delivery_event_payload_conflict';END IF;RETURN jsonb_build_object('ok',true,'id',prior.id,'replayed',true);END IF;
 IF p_kind IN('queue_sync','metrics_sync','owner_actions_sync','mobile_sync') THEN
  INSERT INTO zoi.delivery_state(key,value)VALUES(p_kind,p_payload) ON CONFLICT(key)DO UPDATE SET value=excluded.value,updated_at=now();
 ELSIF p_kind='release_verified' THEN
  IF p_payload#>>'{proof,result}' IS DISTINCT FROM 'passed' OR p_payload#>>'{proof,environment}' IS DISTINCT FROM 'production'
  OR p_payload#>'{proof,independent}' IS DISTINCT FROM 'true'::jsonb OR p_payload#>>'{proof,type}' IS DISTINCT FROM 'customer_journey'
  OR p_payload#>>'{release,state}' IS DISTINCT FROM 'READY' OR nullif(p_payload#>>'{release,id}','') IS NULL
  OR jsonb_typeof(p_payload#>'{proof,evidence}') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload#>'{proof,evidence}')=0
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload#>'{proof,evidence}') x WHERE jsonb_typeof(x)<>'string' OR length(btrim(x#>>'{}'))<3)
  OR jsonb_typeof(p_payload#>'{proof,record_ids}') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload#>'{proof,record_ids}')=0
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload#>'{proof,record_ids}') x WHERE jsonb_typeof(x)<>'string' OR length(btrim(x#>>'{}'))NOT BETWEEN 1 AND 240)
  OR coalesce(p_payload#>>'{proof,verified_at}','')!~'^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$'
  OR(p_payload#>>'{proof,verified_at}')::timestamptz<now()-interval '7 days' OR(p_payload#>>'{proof,verified_at}')::timestamptz>now()+interval '5 minutes'
  OR coalesce(p_payload#>>'{release,commit}','')!~'^[0-9a-f]{40}$' OR nullif(p_payload#>>'{info,open_url}','') IS NULL
  THEN RAISE EXCEPTION 'deployed_independent_journey_proof_required';END IF;
  feature:=p_payload->>'feature_id';IF nullif(feature,'') IS NULL OR length(feature)>160 THEN RAISE EXCEPTION 'invalid_delivery_feature';END IF;
  INSERT INTO zoi.delivery_features(id,info,release,proof,state)VALUES(feature,p_payload->'info',p_payload->'release',p_payload->'proof','live and verified')
  ON CONFLICT(id)DO UPDATE SET info=excluded.info,release=excluded.release,proof=excluded.proof,state=excluded.state,updated_at=now();
 ELSIF p_kind IN('release_failed','release_rolled_back') THEN
  UPDATE zoi.delivery_features SET state=CASE WHEN p_kind='release_failed'THEN 'failed'ELSE 'rolled back'END,updated_at=now()
  WHERE id=p_payload->>'feature_id' AND (nullif(p_payload->>'release_id','') IS NULL OR release->>'id'=p_payload->>'release_id');
 ELSIF p_kind='record_verified' THEN
  IF p_payload->>'category' NOT IN('websites_reviewed','profiles_enriched','homes_visual','customer_actions')
  OR p_payload->>'verification' NOT IN('independent source verified','production journey verified')
  OR jsonb_typeof(p_payload->'evidence') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'evidence')=0
  OR p_payload->>'category'='customer_actions' AND(p_payload->>'verification'<>'production journey verified' OR NOT EXISTS(SELECT 1 FROM zoi.delivery_features f WHERE f.state='live and verified'AND f.release->>'id'=p_payload#>>'{release,id}'AND f.proof->'record_ids'@>jsonb_build_array(p_payload->>'listing_id')))
  THEN RAISE EXCEPTION 'record_verification_required';END IF;
  INSERT INTO zoi.delivery_record_evidence(category,listing_id,changed,before_value,after_value,evidence,release,verification,record_fingerprint)
  VALUES(p_payload->>'category',(p_payload->>'listing_id')::uuid,left(p_payload->>'changed',1000),p_payload->'before',p_payload->'after',p_payload->'evidence',p_payload->'release',p_payload->>'verification',(SELECT zoi.geography_fingerprint(l)FROM zoi.listings l WHERE l.id=(p_payload->>'listing_id')::uuid))
  ON CONFLICT(category,listing_id)DO UPDATE SET changed=excluded.changed,before_value=excluded.before_value,after_value=excluded.after_value,evidence=excluded.evidence,release=excluded.release,verification=excluded.verification,record_fingerprint=excluded.record_fingerprint,completed_at=now();
 ELSIF p_kind='action_observed' THEN
  IF p_payload->>'state' NOT IN('not configured','authorized','degraded','revoked','externally blocked','ready for operator verification') THEN RAISE EXCEPTION 'operational_verification_cannot_be_inferred';END IF;
  UPDATE zoi.delivery_action_checks SET state=p_payload->>'state',observation=p_payload->'observation',checked_at=now() WHERE request_id=(p_payload->>'check_request')::uuid;
 END IF;
 INSERT INTO zoi.delivery_events(request_id,kind,title,payload,evidence_state) VALUES(p_request,p_kind,left(coalesce(p_payload->>'title','Delivery update'),300),p_payload,CASE WHEN p_kind IN('release_verified','record_verified')THEN 'independent_verified'WHEN p_kind IN('queue_sync','activity')THEN 'reported'ELSE 'automatic'END)RETURNING * INTO prior;
 RETURN jsonb_build_object('ok',true,'id',prior.id,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.zoi_delivery_progress(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zoi_delivery_progress(uuid,text,jsonb) TO service_role;
CREATE FUNCTION public.zoi_delivery_dashboard(p_since timestamptz DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;queue jsonb;metrics jsonb;actions jsonb;mobiles jsonb;last_activity timestamptz;ready jsonb;groups jsonb;history jsonb;reports jsonb;feeds jsonb;
BEGIN
 actor:=zoi.delivery_require_founder();
 SELECT value INTO queue FROM zoi.delivery_state WHERE key='queue_sync';
 SELECT value INTO metrics FROM zoi.delivery_state WHERE key='metrics_sync';
 SELECT jsonb_set(coalesce(metrics,'{}'::jsonb),'{metrics}',coalesce((SELECT jsonb_agg(m||jsonb_build_object('records_available',CASE WHEN m->>'key'IN('websites_reviewed','profiles_enriched','homes_visual','customer_actions') THEN (m->'value'<>'null'::jsonb OR EXISTS(SELECT 1 FROM zoi.delivery_record_evidence e WHERE e.category=m->>'key')) ELSE coalesce((m->>'records_available')::boolean,false) END,'value',CASE WHEN m->>'key'IN('websites_reviewed','profiles_enriched','homes_visual','customer_actions')AND(m->'value'<>'null'::jsonb OR EXISTS(SELECT 1 FROM zoi.delivery_record_evidence e WHERE e.category=m->>'key'))THEN to_jsonb((SELECT count(DISTINCT e.listing_id)FROM zoi.delivery_record_evidence e JOIN zoi.listings l ON l.id=e.listing_id WHERE e.category=m->>'key'AND e.record_fingerprint=zoi.geography_fingerprint(l)AND(e.category<>'customer_actions'OR EXISTS(SELECT 1 FROM zoi.delivery_features f WHERE f.state='live and verified'AND f.release->>'id'=e.release->>'id'AND f.proof->'record_ids'@>jsonb_build_array(l.id::text)))))ELSE m->'value'END))FROM jsonb_array_elements(coalesce(metrics->'metrics','[]'::jsonb))m),'[]'::jsonb))INTO metrics;
 SELECT value INTO actions FROM zoi.delivery_state WHERE key='owner_actions_sync';
 SELECT value INTO mobiles FROM zoi.delivery_state WHERE key='mobile_sync';
 SELECT max(created_at)INTO last_activity FROM zoi.delivery_events;
 SELECT coalesce(jsonb_agg(info||jsonb_build_object('id',id,'release',release,'verification',proof,'verified_at',proof->>'verified_at','status',state)ORDER BY updated_at DESC),'[]'::jsonb)INTO ready FROM zoi.delivery_features WHERE state='live and verified';
 SELECT coalesce(jsonb_agg(g||jsonb_build_object('status',CASE WHEN g->>'status'='live and verified' THEN CASE WHEN jsonb_array_length(coalesce(g->'outcomes','[]'::jsonb))>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(g->'outcomes','[]'::jsonb))o WHERE NOT EXISTS(SELECT 1 FROM zoi.delivery_features f WHERE f.id=o->>'id'AND f.state='live and verified'))THEN 'live and verified'ELSE 'being tested'END ELSE coalesce(g->>'status','not started')END,'outcomes',coalesce((SELECT jsonb_agg(o||jsonb_build_object('status',CASE WHEN f.state='live and verified'THEN f.state WHEN f.state IS NOT NULL THEN 'being tested'WHEN o->>'status'='live and verified'THEN 'being tested'ELSE coalesce(o->>'status','not started')END))FROM jsonb_array_elements(coalesce(g->'outcomes','[]'::jsonb))o LEFT JOIN zoi.delivery_features f ON f.id=o->>'id'),'[]'::jsonb))),'[]'::jsonb)
 INTO groups FROM jsonb_array_elements(coalesce(queue->'groups','[]'::jsonb))g;
 SELECT coalesce(jsonb_agg(g||jsonb_build_object('status',CASE WHEN EXISTS(SELECT 1 FROM zoi.delivery_reports r WHERE r.queue_group=g->>'id' AND r.state<>'live and verified') THEN 'being tested' ELSE g->>'status' END,'outcomes',coalesce(g->'outcomes','[]'::jsonb)||coalesce((SELECT jsonb_agg(jsonb_build_object('id','problem:'||r.request_id,'title',r.message,'status',r.state,'remaining','Investigate and verify the reported problem with its original profile, feature and release context.','evidence',r.context,'reported_at',r.created_at))FROM zoi.delivery_reports r WHERE r.queue_group=g->>'id'),'[]'::jsonb))),'[]'::jsonb)INTO groups FROM jsonb_array_elements(groups)g;
 SELECT coalesce(jsonb_agg(x ORDER BY x->>'at' DESC),'[]'::jsonb)INTO history FROM(SELECT jsonb_build_object('id',id,'event',kind,'title',title,'at',created_at,'evidence_state',evidence_state,'record_id',payload->>'listing_id','release',payload->'release')x FROM zoi.delivery_events WHERE p_since IS NULL OR created_at>p_since ORDER BY created_at DESC LIMIT 60)s;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',request_id,'message',message,'context',context,'status',state,'at',created_at)ORDER BY created_at DESC),'[]'::jsonb)INTO reports FROM(SELECT *FROM zoi.delivery_reports ORDER BY created_at DESC LIMIT 100)s;
 SELECT coalesce(jsonb_agg(jsonb_build_object('name',CASE key WHEN 'queue_sync'THEN 'Authoritative work queue'WHEN 'metrics_sync'THEN 'Record coverage and corrections'WHEN 'owner_actions_sync'THEN 'Owner actions'WHEN 'mobile_sync'THEN 'Mobile releases'END,'state','connected','last_success_at',updated_at)),'[]'::jsonb)INTO feeds FROM zoi.delivery_state;
 feeds:=feeds||coalesce(queue->'feeds','[]'::jsonb);
 RETURN jsonb_build_object('schema_version',1,'generated_at',now(),'last_activity_at',last_activity,'scope',coalesce(queue->'scope','{}'::jsonb),'metrics',coalesce(metrics->'metrics','[]'::jsonb),'coverage',coalesce(metrics->'coverage','{}'::jsonb),'groups',groups,'ready',ready,'actions',coalesce((SELECT jsonb_agg(a||jsonb_build_object('status',coalesce((SELECT state FROM zoi.delivery_action_checks c WHERE c.action_id=a->>'id'ORDER BY created_at DESC LIMIT 1),a->>'status','needs your action'),'last_checked_at',(SELECT checked_at FROM zoi.delivery_action_checks c WHERE c.action_id=a->>'id'ORDER BY created_at DESC LIMIT 1)))FROM jsonb_array_elements(coalesce(actions->'actions','[]'::jsonb))a),'[]'::jsonb),'activity',history,'mobile',coalesce(mobiles->'mobile','[]'::jsonb),'feeds',feeds,'reported_problems',reports);
END $$;
CREATE FUNCTION public.zoi_delivery_records(p_category text,p_limit integer DEFAULT 32,p_offset integer DEFAULT 0,p_query text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;rows jsonb;total integer;
BEGIN
 actor:=zoi.delivery_require_founder();
 IF p_category NOT IN('websites_reviewed','profiles_enriched','homes_visual','customer_actions','addresses_corrected','precision_labels','city_coordinates','awaiting_review') THEN RAISE EXCEPTION 'invalid_delivery_category';END IF;
 IF p_category IN('addresses_corrected','precision_labels','city_coordinates') THEN
  WITH records AS(SELECT DISTINCT ON(l.id)l.id,l.name,l.entity_type AS category,concat_ws(', ',l.city,zoi.geo_country_canon(l.country))AS location,'/p/'||l.slug AS profile_url,
   CASE WHEN p_category='precision_labels'THEN 'Corrected a city-centre point incorrectly labelled as a street location. Coordinates did not move.'WHEN p_category='city_coordinates'THEN 'Corrected the city-area position using its verified locality. This is not a street-address certification.'ELSE 'Corrected the address-level point using independently reviewed official evidence.'END AS changed,
   CASE WHEN r.after_fingerprint=zoi.geography_fingerprint(l)AND r.reverted_at IS NULL THEN 'Current guarded correction'ELSE 'Historical correction; current record needs rechecking'END AS verification,r.created_at AS completed_at,r.before_geo AS before,jsonb_build_object('latitude',l.latitude,'longitude',l.longitude,'precision',l.geo_precision)AS after,
   jsonb_build_object('request_id',r.request_id,'kind',r.payload->>'kind','source',r.payload#>>'{report,source_url}','source_sha256',r.payload#>>'{report,source_sha256}','coordinate_changed',(r.before_geo->>'latitude')::double precision IS DISTINCT FROM l.latitude OR(r.before_geo->>'longitude')::double precision IS DISTINCT FROM l.longitude)AS evidence
   FROM zoi.geography_reviews r JOIN zoi.listings l ON l.id=r.listing_id WHERE r.reverted_at IS NULL AND l.publish_status='published'AND l.moderation_status IN('clean','cleared')AND coalesce(l.marketplace_status,'')<>'hidden'
    AND CASE WHEN p_category='precision_labels'THEN r.payload->>'kind'='precision_claim_correction'WHEN p_category='city_coordinates'THEN r.receipt->>'precision'='city'AND((r.before_geo->>'latitude')::double precision IS DISTINCT FROM l.latitude OR(r.before_geo->>'longitude')::double precision IS DISTINCT FROM l.longitude)ELSE r.receipt->>'precision'='street'AND r.after_fingerprint=zoi.geography_fingerprint(l)AND((r.before_geo->>'latitude')::double precision IS DISTINCT FROM l.latitude OR(r.before_geo->>'longitude')::double precision IS DISTINCT FROM l.longitude)END
    AND(nullif(btrim(p_query),'')IS NULL OR strpos(lower(l.name||' '||coalesce(l.city,'')),lower(btrim(p_query)))>0)ORDER BY l.id,r.created_at DESC)
   SELECT(SELECT count(*)FROM records),coalesce((SELECT jsonb_agg(to_jsonb(x))FROM(SELECT *FROM records ORDER BY completed_at DESC,id LIMIT least(greatest(coalesce(p_limit,32),1),100)OFFSET greatest(coalesce(p_offset,0),0))x),'[]'::jsonb)INTO total,rows;
 ELSIF p_category='awaiting_review'THEN
  IF to_regclass('zoi.geography_repair_jobs')IS NULL THEN RETURN jsonb_build_object('rows','[]'::jsonb,'total',NULL,'state','not yet measured');END IF;
  EXECUTE 'WITH records AS(SELECT DISTINCT ON(j.listing_id)j.listing_id AS id,l.name,l.entity_type AS category,concat_ws('', '',l.city,l.country) AS location,''/p/''||l.slug AS profile_url,j.reason AS changed,j.status AS verification,j.updated_at AS completed_at,j.original AS before,j.proposed AS after,j.source AS evidence FROM zoi.geography_repair_jobs j JOIN zoi.listings l ON l.id=j.listing_id WHERE j.status NOT IN(''applied'',''input_changed'')AND($1 IS NULL OR strpos(lower(l.name),lower($1))>0)ORDER BY j.listing_id,j.updated_at DESC)SELECT(SELECT count(*)FROM records),coalesce((SELECT jsonb_agg(to_jsonb(x))FROM(SELECT *FROM records ORDER BY completed_at DESC,id LIMIT $2 OFFSET $3)x),''[]''::jsonb)'
  INTO total,rows USING nullif(btrim(p_query),''),least(greatest(coalesce(p_limit,32),1),100),greatest(coalesce(p_offset,0),0);
 ELSE
  WITH records AS(SELECT l.id,l.name,l.entity_type AS category,concat_ws(', ',l.city,zoi.geo_country_canon(l.country))AS location,e.changed,CASE WHEN e.record_fingerprint=zoi.geography_fingerprint(l)AND(e.category<>'customer_actions'OR EXISTS(SELECT 1 FROM zoi.delivery_features f WHERE f.state='live and verified'AND f.release->>'id'=e.release->>'id'AND f.proof->'record_ids'@>jsonb_build_array(l.id::text)))THEN e.verification ELSE 'Needs rechecking after record change'END AS verification,e.completed_at,'/p/'||l.slug AS profile_url,e.before_value AS before,e.after_value AS after,e.evidence FROM zoi.delivery_record_evidence e JOIN zoi.listings l ON l.id=e.listing_id WHERE e.category=p_category AND e.record_fingerprint=zoi.geography_fingerprint(l) AND(e.category<>'customer_actions'OR EXISTS(SELECT 1 FROM zoi.delivery_features f WHERE f.state='live and verified'AND f.release->>'id'=e.release->>'id'AND f.proof->'record_ids'@>jsonb_build_array(l.id::text))) AND(nullif(btrim(p_query),'')IS NULL OR strpos(lower(l.name||' '||coalesce(l.city,'')),lower(btrim(p_query)))>0))
  SELECT(SELECT count(*)FROM records),coalesce((SELECT jsonb_agg(to_jsonb(x))FROM(SELECT *FROM records ORDER BY completed_at DESC,id LIMIT least(greatest(coalesce(p_limit,32),1),100)OFFSET greatest(coalesce(p_offset,0),0))x),'[]'::jsonb)INTO total,rows;
 END IF;
 RETURN jsonb_build_object('rows',rows,'total',total,'category',p_category);
END $$;
CREATE FUNCTION public.zoi_delivery_report(p_request uuid,p_context jsonb,p_message text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;prior zoi.delivery_reports;group_id text;BEGIN
 actor:=zoi.delivery_require_founder();
 IF p_request IS NULL OR jsonb_typeof(p_context)IS DISTINCT FROM 'object'OR octet_length(p_context::text)>4096 OR length(btrim(coalesce(p_message,'')))NOT BETWEEN 3 AND 2000
 OR p_message~'(gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40}|sk_(live|test)_[A-Za-z0-9]{16}|AIza[0-9A-Za-z_-]{35}|BEGIN [A-Z ]*PRIVATE KEY)' THEN RAISE EXCEPTION 'invalid_delivery_report';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('delivery-report:'||p_request::text,0));SELECT *INTO prior FROM zoi.delivery_reports WHERE request_id=p_request;
 IF FOUND THEN IF prior.user_id<>actor OR prior.context IS DISTINCT FROM p_context OR prior.message IS DISTINCT FROM btrim(p_message)THEN RAISE EXCEPTION 'delivery_report_payload_conflict';END IF;RETURN jsonb_build_object('ok',true,'id',prior.request_id,'replayed',true);END IF;
 group_id:=coalesce(nullif(p_context->>'group',''),(SELECT f.info->>'group' FROM zoi.delivery_features f WHERE f.id=p_context->>'feature_id'),'owners');
 IF NOT EXISTS(SELECT 1 FROM zoi.delivery_state s CROSS JOIN LATERAL jsonb_array_elements(coalesce(s.value->'groups','[]'::jsonb))g WHERE s.key='queue_sync'AND g->>'id'=group_id) THEN group_id:='owners';END IF;
 INSERT INTO zoi.delivery_reports(request_id,user_id,context,queue_group,message)VALUES(p_request,actor,p_context,group_id,btrim(p_message));
 INSERT INTO zoi.delivery_events(request_id,kind,title,payload,evidence_state)VALUES(p_request,'problem_reported','Founder reported a problem',jsonb_build_object('context',p_context,'queue_item',p_request),'reported');
 RETURN jsonb_build_object('ok',true,'id',p_request,'replayed',false);
END $$;
CREATE FUNCTION public.zoi_delivery_action_ack(p_request uuid,p_action text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;prior zoi.delivery_action_checks;BEGIN
 actor:=zoi.delivery_require_founder();
 IF p_request IS NULL OR nullif(btrim(p_action),'')IS NULL OR length(p_action)>160
 OR NOT EXISTS(SELECT 1 FROM zoi.delivery_state s CROSS JOIN LATERAL jsonb_array_elements(coalesce(s.value->'actions','[]'::jsonb))a WHERE s.key='owner_actions_sync'AND a->>'id'=p_action)THEN RAISE EXCEPTION 'invalid_owner_action';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('delivery-ack:'||p_request::text,0));SELECT *INTO prior FROM zoi.delivery_action_checks WHERE request_id=p_request;
 IF FOUND THEN IF prior.user_id<>actor OR prior.action_id<>p_action THEN RAISE EXCEPTION 'delivery_ack_payload_conflict';END IF;RETURN jsonb_build_object('ok',true,'id',p_request,'status',prior.state,'check_required',true,'replayed',true);END IF;
 INSERT INTO zoi.delivery_action_checks(request_id,user_id,action_id)VALUES(p_request,actor,p_action);
 INSERT INTO zoi.delivery_events(request_id,kind,title,payload,evidence_state)VALUES(p_request,'owner_action_acknowledged','Owner action acknowledged; verification still required',jsonb_build_object('action',p_action),'reported');
 RETURN jsonb_build_object('ok',true,'id',p_request,'status','check_required','check_required',true,'replayed',false);
END $$;
CREATE FUNCTION public.zoi_delivery_check_context(p_request uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;check_row zoi.delivery_action_checks;BEGIN
 actor:=zoi.delivery_require_founder();
 SELECT *INTO check_row FROM zoi.delivery_action_checks WHERE request_id=p_request AND user_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'founder_check_not_found' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('action_id',check_row.action_id,'request_id',check_row.request_id);
END $$;
DO $grants$ DECLARE signature text;BEGIN
 FOREACH signature IN ARRAY ARRAY['public.zoi_delivery_dashboard(timestamptz)','public.zoi_delivery_records(text,integer,integer,text)','public.zoi_delivery_report(uuid,jsonb,text)','public.zoi_delivery_action_ack(uuid,text)','public.zoi_delivery_check_context(uuid)'] LOOP
 EXECUTE 'REVOKE ALL ON FUNCTION '||signature||' FROM PUBLIC,anon';EXECUTE 'GRANT EXECUTE ON FUNCTION '||signature||' TO authenticated';
 END LOOP;
END $grants$;
NOTIFY pgrst,'reload schema';
COMMIT;
