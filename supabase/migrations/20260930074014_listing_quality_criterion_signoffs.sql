BEGIN;
CREATE TABLE zoi.quality_criteria(
 key text NOT NULL, revision integer NOT NULL CHECK(revision>0), family text NOT NULL,
 title text NOT NULL, task text NOT NULL CHECK(task IN('classification','design','verification')),
 evidence_kind text NOT NULL CHECK(evidence_kind IN('source','render','journey')),
 requirement text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(key,revision));
CREATE TABLE zoi.quality_signoffs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL UNIQUE,
 listing_id uuid NOT NULL REFERENCES zoi.listings(id) ON DELETE CASCADE,
 criterion text NOT NULL, revision integer NOT NULL, stage text NOT NULL CHECK(stage IN('specialist','reviewer')),
 actor text NOT NULL, specialist_id uuid REFERENCES zoi.quality_signoffs(id), source_fingerprint text NOT NULL,
 release_commit text NOT NULL CHECK(release_commit ~ '^[a-f0-9]{40}$'), status text NOT NULL CHECK(status IN('passed','blocked')),
 lease_id text, evidence jsonb NOT NULL, request jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(criterion,revision) REFERENCES zoi.quality_criteria(key,revision));
CREATE INDEX quality_signoffs_listing ON zoi.quality_signoffs(listing_id,criterion,recorded_at DESC);
ALTER TABLE zoi.quality_criteria ENABLE ROW LEVEL SECURITY;ALTER TABLE zoi.quality_signoffs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.quality_criteria,zoi.quality_signoffs FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON zoi.quality_criteria,zoi.quality_signoffs TO service_role;
CREATE FUNCTION zoi.quality_criterion_fingerprint(l zoi.listings) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT md5(jsonb_build_array(zoi.listing_quality_fingerprint(l),to_jsonb(l)-'profile'-'updated_at'-'created_at',coalesce(l.profile->'_enrich','{}')-'lease',coalesce(l.profile->'owner_content','{}'))::text)
$$;
CREATE FUNCTION zoi.quality_family(l zoi.listings) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT CASE WHEN l.entity_type='artist' THEN 'music' WHEN l.entity_type='creator' THEN 'creator' WHEN l.entity_type='professional' THEN 'professional' ELSE coalesce((SELECT CASE
 WHEN c.slug IN('restaurants','tavernas','cafes','meze-ouzo-bars','food-trucks') THEN 'restaurant'
 WHEN c.slug IN('faith-church','ministries','monasteries','orthodox-churches','cathedrals','chapels') THEN 'church'
 WHEN c.slug IN('banquet-halls','church-halls') THEN 'venue'
 WHEN c.slug IN('events-entertainment','theatre-comedy','dances','galas','concerts','festivals','bouzoukia') THEN 'entertainment'
 WHEN c.slug IN('bakeries','desserts-sweets') THEN 'bakery'
 END FROM zoi.categories c WHERE c.id=l.primary_category_id),'general') END
$$;
CREATE FUNCTION public.listing_quality_checklist(p_listing uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l zoi.listings;fp text;criteria jsonb;
BEGIN SELECT * INTO l FROM zoi.listings WHERE id=p_listing;IF NOT FOUND THEN RAISE EXCEPTION 'listing_not_found';END IF;fp:=zoi.quality_criterion_fingerprint(l);
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',c.key,'revision',c.revision,'family',c.family,'title',c.title,'task',c.task,'evidence_kind',c.evidence_kind,'requirement',c.requirement,'status',CASE WHEN NOT coalesce((zoi.listing_quality_state(l)->>'public_eligible')::boolean,false) THEN 'blocked_visibility' WHEN s.id IS NULL THEN 'pending' WHEN s.source_fingerprint<>fp OR s.recorded_at<now()-interval '7 days' THEN 'pending_recheck' WHEN s.status='blocked' THEN 'blocked' WHEN s.stage='specialist' THEN 'awaiting_independent_review' ELSE 'signed_off' END,'latest_evidence',CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('id',s.id,'stage',s.stage,'actor',s.actor,'release_commit',s.release_commit,'recorded_at',s.recorded_at,'evidence',s.evidence) END) ORDER BY c.key),'[]') INTO criteria
 FROM (SELECT DISTINCT ON(key) * FROM zoi.quality_criteria ORDER BY key,revision DESC)c LEFT JOIN LATERAL(SELECT x.* FROM zoi.quality_signoffs x WHERE x.listing_id=l.id AND x.criterion=c.key AND x.revision=c.revision ORDER BY x.recorded_at DESC,x.id DESC LIMIT 1)s ON true WHERE c.family IN('*',zoi.quality_family(l),'category:'||l.primary_category_id);
 RETURN jsonb_build_object('listing_id',l.id,'category_id',l.primary_category_id,'family',zoi.quality_family(l),'source_fingerprint',fp,'criteria',criteria,'complete',NOT EXISTS(SELECT 1 FROM jsonb_array_elements(criteria)c WHERE c->>'status'<>'signed_off'));
END $$;
CREATE FUNCTION public.listing_quality_criterion_record(p_request uuid,p_listing uuid,p_criterion text,p_revision integer,p_stage text,p_actor text,p_specialist uuid,p_lease text,p_fingerprint text,p_commit text,p_status text,p_evidence jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l zoi.listings;c zoi.quality_criteria;s zoi.quality_signoffs;old zoi.quality_signoffs;body jsonb;result zoi.quality_signoffs;lease jsonb;
BEGIN
 body:=jsonb_build_array(p_listing,p_criterion,p_revision,p_stage,p_actor,p_specialist,p_lease,p_fingerprint,p_commit,p_status,p_evidence);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,72110));SELECT * INTO old FROM zoi.quality_signoffs WHERE request_id=p_request;
 IF FOUND THEN IF old.request IS DISTINCT FROM body THEN RAISE EXCEPTION 'request_conflict';END IF;RETURN jsonb_build_object('ok',true,'id',old.id,'already',true);END IF;
 IF p_request IS NULL OR p_stage IS NULL OR p_stage NOT IN('specialist','reviewer') OR p_status IS NULL OR p_status NOT IN('passed','blocked') OR p_actor IS NULL OR p_actor !~ '^[a-zA-Z0-9_./:@-]{3,120}$' OR p_commit IS NULL OR p_commit !~ '^[a-f0-9]{40}$' OR jsonb_typeof(p_evidence) IS DISTINCT FROM 'object' OR octet_length(p_evidence::text)>16000 THEN RAISE EXCEPTION 'invalid_criterion_evidence';END IF;
 SELECT * INTO l FROM zoi.listings WHERE id=p_listing FOR SHARE;IF NOT FOUND OR p_fingerprint IS DISTINCT FROM zoi.quality_criterion_fingerprint(l) THEN RAISE EXCEPTION 'source_changed';END IF;
 SELECT * INTO c FROM zoi.quality_criteria WHERE key=p_criterion ORDER BY revision DESC LIMIT 1;
 IF c.key IS NULL OR p_revision IS DISTINCT FROM c.revision OR c.family NOT IN('*',zoi.quality_family(l),'category:'||l.primary_category_id) THEN RAISE EXCEPTION 'criterion_changed';END IF;
 IF p_evidence->>'kind' IS DISTINCT FROM c.evidence_kind OR jsonb_typeof(p_evidence->'refs') IS DISTINCT FROM 'array' OR jsonb_array_length(p_evidence->'refs') NOT BETWEEN 1 AND 12 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_evidence->'refs')r WHERE coalesce(r->>'uri','') !~ '^https://' OR coalesce(r->>'sha256','') !~ '^[a-f0-9]{64}$') OR jsonb_typeof(p_evidence->'blockers') IS DISTINCT FROM 'array' OR length(coalesce(p_evidence->>'observations','')) NOT BETWEEN 20 AND 6000 THEN RAISE EXCEPTION 'evidence_artifacts_required';END IF;
 IF p_status='passed' AND (jsonb_array_length(p_evidence->'blockers')<>0 OR p_evidence->>'performed' IS DISTINCT FROM 'true' OR NOT coalesce((zoi.listing_quality_state(l)->>'public_eligible')::boolean,false)) THEN RAISE EXCEPTION 'blockers_prevent_signoff';END IF;
 IF p_stage='specialist' THEN
 lease:=l.profile#>'{_enrich,lease}';
 IF p_lease IS NULL OR lease->>'id' IS DISTINCT FROM p_lease OR lease->>'task' IS DISTINCT FROM c.task OR lease->>'fingerprint' IS DISTINCT FROM zoi.listing_quality_fingerprint(l) OR coalesce(zoi.enrich_timestamp(lease->>'expires_at'),'-infinity')<=now() OR p_specialist IS NOT NULL THEN RAISE EXCEPTION 'existing_quality_lease_required';END IF;
 ELSE
 SELECT * INTO s FROM zoi.quality_signoffs WHERE id=p_specialist;
 IF s.id IS NULL OR s.stage<>'specialist' OR s.status<>'passed' OR s.listing_id<>p_listing OR s.criterion<>c.key OR s.revision<>c.revision OR s.source_fingerprint<>p_fingerprint OR s.release_commit<>p_commit OR s.actor=p_actor OR s.recorded_at<now()-interval '7 days' THEN RAISE EXCEPTION 'independent_review_required';END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_evidence->'refs') r WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.evidence->'refs') oldref WHERE oldref->>'sha256'=r->>'sha256')) THEN RAISE EXCEPTION 'independent_review_artifact_required';END IF;
 IF EXISTS(SELECT 1 FROM zoi.quality_signoffs x WHERE x.listing_id=p_listing AND x.criterion=c.key AND x.recorded_at>s.recorded_at AND x.stage='specialist') THEN RAISE EXCEPTION 'specialist_superseded';END IF;
 END IF;
 INSERT INTO zoi.quality_signoffs(request_id,listing_id,criterion,revision,stage,actor,specialist_id,source_fingerprint,release_commit,status,lease_id,evidence,request)VALUES(p_request,p_listing,c.key,c.revision,p_stage,p_actor,p_specialist,p_fingerprint,p_commit,p_status,p_lease,p_evidence,body)RETURNING * INTO result;
 RETURN jsonb_build_object('ok',true,'id',result.id,'already',false);
END $$;
CREATE FUNCTION public.listing_quality_criterion_revise(p_key text,p_expected_revision integer,p_requirement text)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c zoi.quality_criteria;
BEGIN PERFORM pg_advisory_xact_lock(hashtextextended(p_key,74014));SELECT * INTO c FROM zoi.quality_criteria WHERE key=p_key ORDER BY revision DESC LIMIT 1;
 IF c.key IS NULL OR c.revision IS DISTINCT FROM p_expected_revision OR length(coalesce(p_requirement,'')) NOT BETWEEN 20 AND 3000 THEN RAISE EXCEPTION 'criterion_version_conflict';END IF;
 INSERT INTO zoi.quality_criteria(key,revision,family,title,task,evidence_kind,requirement)VALUES(c.key,c.revision+1,c.family,c.title,c.task,c.evidence_kind,p_requirement);
 RETURN jsonb_build_object('ok',true,'key',c.key,'revision',c.revision+1,'requires_recheck',true);END $$;
REVOKE ALL ON FUNCTION public.listing_quality_checklist(uuid),public.listing_quality_criterion_record(uuid,uuid,text,integer,text,text,uuid,text,text,text,text,jsonb),public.listing_quality_criterion_revise(text,integer,text),zoi.quality_family(zoi.listings),zoi.quality_criterion_fingerprint(zoi.listings) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.listing_quality_checklist(uuid),public.listing_quality_criterion_record(uuid,uuid,text,integer,text,text,uuid,text,text,text,text,jsonb),public.listing_quality_criterion_revise(text,integer,text) TO service_role;
INSERT INTO zoi.quality_criteria(key,revision,family,title,task,evidence_kind,requirement)VALUES
('identity',1,'*','Identity and source','classification','source','Compare the exact entity identity with authoritative source content; exclude organization assets on individual profiles.'),
('visual',1,'*','Desktop and mobile presentation','design','render','Inspect actual rendered desktop and phone layouts, imagery role, legibility, contrast, motion and overflow.'),
('accessibility',1,'*','Keyboard and accessible controls','verification','journey','Perform keyboard navigation, focus, labels, reduced-motion and error announcements on actual controls.'),
('seo',1,'*','Search presentation','verification','render','Inspect rendered canonical, title, description, indexability and applicable structured data for this listing.'),
('functional',1,'*','Customer actions and failures','verification','journey','Exercise every primary customer action, real empty/loading/error states, truthful availability and confirmed receipts.'),
('owner_publish',1,'*','Owner edit to public page','verification','journey','Authorized owner edits supported wording, offerings, media, prices, promotions and hours; previews, publishes and verifies actual public output. Record unsupported controls as blockers.'),
('owner_integrity',1,'*','Owner edits remain safe','verification','journey','Exercise explicit clears, version conflict, lost-response retry, account/workspace switch and later source import preserving owner choices.'),
('menu',1,'restaurant','Menu, prices and provenance','classification','source','Compare actual menu items, price/currency and source date; do not infer availability from a stale menu.'),
('visit',1,'restaurant','Hours, address and service channels','verification','journey','Verify address, actual hours conflicts, photography, contact and configured reservation or ordering paths.'),
('programmes',1,'church','Services and family programmes','verification','journey','Verify dated parish services, calendar jurisdiction, volunteer and guardian/private enrolment flows where enabled.'),
('releases',1,'music','Music and appearances','verification','journey','Verify artist identity, provider playback, release precision and actual mutually confirmed appearances.'),
('collaboration',1,'creator','Creator collaboration','verification','journey','Verify real source channels, collaboration enquiry, scoped brief and deliverable approvals where enabled.'),
('practice',1,'professional','Professional identity and tools','classification','source','Verify individual credentials, practice contacts and sourced affiliation without inherited society imagery or unsupported claims.'),
('spaces',1,'venue','Venue layout and event planning','verification','journey','Verify organizer-provided room plans, capacity, tour and real hold/booking states without invented geometry or availability.'),
('events',1,'entertainment','Events and admission','verification','journey','Verify show dates, promoter identity, ticket inventory, pricing, seating, sponsorship and check-in where enabled.'),
('products',1,'bakery','Products and ordering','verification','journey','Verify sourced products, dietary claims, current prices and actual configured ordering or enquiry flow.');
-- Existing category taxonomy is authoritative; each category gets its own versioned master entry.
INSERT INTO zoi.quality_criteria(key,revision,family,title,task,evidence_kind,requirement)
 SELECT 'category.'||slug,1,'category:'||id,'Category completeness: '||slug,'verification','journey',
 'For category '||slug||', compare this listing against the current category offering: identity, sourced offering details, useful customer actions and full authorized owner edit/preview/publish/public-read journey. Document every unsupported or untested required workflow as a blocker; field presence or HTTP 200 is insufficient.'
 FROM zoi.categories;
CREATE VIEW zoi.v_listing_quality_checklists AS SELECT id listing_id,primary_category_id,public.listing_quality_checklist(id) checklist FROM zoi.listings;
REVOKE ALL ON zoi.v_listing_quality_checklists FROM PUBLIC,anon,authenticated;GRANT SELECT ON zoi.v_listing_quality_checklists TO service_role;
-- Reopen only the existing task state, in a bounded keyset page; no second queue.
CREATE FUNCTION public.listing_quality_criteria_requeue(p_after uuid DEFAULT NULL,p_limit integer DEFAULT 20)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l zoi.listings;item jsonb;coverage jsonb;t text;changed integer:=0;seen integer:=0;cursor_id uuid;dirty boolean;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'invalid_batch_limit';END IF;
 FOR l IN SELECT * FROM zoi.listings x WHERE (p_after IS NULL OR x.id>p_after) ORDER BY x.id LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
 seen:=seen+1;cursor_id:=l.id;dirty:=false;
 IF coalesce(zoi.enrich_timestamp(l.profile#>>'{_enrich,lease,expires_at}'),'-infinity')>now() THEN CONTINUE;END IF;
 coverage:=zoi.listing_quality_state(l);
 FOR item IN SELECT value FROM jsonb_array_elements(public.listing_quality_checklist(l.id)->'criteria') WHERE value->>'status' IN('pending','pending_recheck') LOOP
 t:=item->>'task';IF coverage#>>ARRAY['tasks',t,'status']='verified' THEN coverage:=jsonb_set(coverage,ARRAY['tasks',t],'{"status":"pending","reason":"criterion_recheck_required"}');dirty:=true;END IF;
 END LOOP;
 IF dirty THEN UPDATE zoi.listings SET profile=jsonb_set(coalesce(profile,'{}'),'{_coverage}',coverage)WHERE id=l.id;changed:=changed+1;END IF;
 END LOOP;
 RETURN jsonb_build_object('ok',true,'inspected',seen,'reopened',changed,'next_after',cursor_id);
END $$;
REVOKE ALL ON FUNCTION public.listing_quality_criteria_requeue(uuid,integer)FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.listing_quality_criteria_requeue(uuid,integer)TO service_role;
COMMIT;
