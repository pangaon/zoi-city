BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='20s';
-- Full-row geography_fingerprint remains the write/revert/CAS contract.
-- Read authority is recorded only by NEW source-reviewed applications. No
-- historical receipt is backfilled, and the listings row type is untouched.
DO $guard$ DECLARE x record; p record; BEGIN
 FOR x IN SELECT * FROM (VALUES
 ('zoi.geography_fingerprint(zoi.listings)','b77ed3d5d9004f1957503c2f848fe4c8','{postgres=X/postgres,service_role=X/postgres}','postgres'),
 ('geography_review_apply(uuid,uuid,text,text,jsonb)','534a3f6b8a5c57fccc2eb741e87c58b2','{postgres=X/postgres,service_role=X/postgres}','postgres'),
 ('geography_review_revert(uuid,text)','e6f2ba4421641428065b817ad47bd3e8','{postgres=X/postgres,service_role=X/postgres}','postgres'),
 ('geography_reviewed_point(uuid)','96ab6ffd834c20e8f75e69a788bbc0d6','{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}','postgres')
 ) g(signature,digest,acl,owner_name) LOOP
 SELECT md5(pg_get_functiondef(oid)) AS digest,proacl::text AS acl,pg_get_userbyid(proowner) AS owner_name,proconfig INTO p FROM pg_proc WHERE oid=to_regprocedure(x.signature);
 IF p.digest IS DISTINCT FROM x.digest OR p.acl IS DISTINCT FROM x.acl OR p.owner_name IS DISTINCT FROM x.owner_name OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""'] THEN RAISE EXCEPTION 'geography_read_authority_dependency_drift:%',x.signature;END IF;
 END LOOP;
 IF to_regclass('zoi.geography_read_authority_epochs') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='zoi.geography_reviews'::regclass AND attname='read_authority_fingerprint' AND NOT attisdropped) THEN RAISE EXCEPTION 'geography_read_authority_already_present';END IF;
END $guard$;
ALTER TABLE zoi.geography_reviews ADD COLUMN read_authority_fingerprint text CHECK(read_authority_fingerprint IS NULL OR read_authority_fingerprint~'^[a-f0-9]{64}$');
CREATE TABLE zoi.geography_read_authority_epochs(
 listing_id uuid PRIMARY KEY REFERENCES zoi.listings(id),
 epoch bigint NOT NULL DEFAULT 0 CHECK(epoch>=0)
);
ALTER TABLE zoi.geography_read_authority_epochs OWNER TO postgres;
ALTER TABLE zoi.geography_read_authority_epochs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.geography_read_authority_epochs FROM PUBLIC,anon,authenticated,service_role;

-- Include exact identity, canonical/published overrides, branch/source scope,
-- ownership, visibility, point and provenance. Exclude menus, descriptions,
-- coverage, crawl timestamps and updated_at. Presence and explicit clears of
-- published identity/address overrides remain distinct through JSON values.
CREATE FUNCTION zoi.geography_read_authority_input(l zoi.listings) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $fn$
 SELECT jsonb_build_object(
 'schema',1,'listing_id',l.id,'entity_type',l.entity_type,'name',l.name,
 'legal_name',l.legal_name,'display_name',l.display_name,
 'address',l.address,'city',l.city,'country',l.country,'region',l.region,
 'province_state',l.province_state,'neighborhood',l.neighborhood,'region_id',l.region_id,
 'place_id',l.place_id,'region_code',l.region_code,'region_native',l.region_native,
 'website',l.website,'source_id',l.source_id,'source_url',l.source_url,
 'source_type',l.source_type,'source_trust_tier',l.source_trust_tier,
 'claim_status',l.claim_status,'verification_status',l.verification_status,
 'field_authority',(SELECT coalesce(jsonb_object_agg(k,v),'{}'::jsonb) FROM jsonb_each(CASE WHEN jsonb_typeof(l.field_meta)='object' THEN l.field_meta ELSE '{}'::jsonb END) AS f(k,v) WHERE k IN('name','legal_name','display_name','address','city','country','region','province_state','latitude','longitude','geo_precision','website','source_url','source_id','source_type','place_id')),
 'owner_user',l.owner_user_id,'owner_workspace',l.owner_workspace_id,
 'publish_status',l.publish_status,'moderation_status',l.moderation_status,
 'marketplace_status',l.marketplace_status,'duplicate_status',l.duplicate_status,
 'latitude',l.latitude,'longitude',l.longitude,'precision',l.geo_precision,
 'geo_provenance',l.profile->'_geo',
 'published_overrides',(SELECT coalesce(jsonb_object_agg(k,v),'{}'::jsonb) FROM jsonb_each(CASE WHEN jsonb_typeof(l.profile)='object' THEN l.profile ELSE '{}'::jsonb END) AS f(k,v) WHERE k IN('name','legal_name','display_name','address','city','country','region','province_state','neighborhood','website','latitude','longitude','geo_precision','location','locations','branches')),
 'source_authority',jsonb_build_object(
   'source_url',l.profile#>'{_enrich,source_url}','source_kind',l.profile#>'{_enrich,source_kind}',
   'identity_scope',l.profile#>'{_enrich,identity_scope}',
   'source_identity',l.profile#>'{_enrich,source_identity}',
   'source_scope_mismatch',coalesce(l.profile#>>'{_enrich,source_scope_mismatch}'='true',false),
   'scope_mismatch_reason',coalesce(l.profile#>>'{_enrich,blocked_reason}'='source_scope_mismatch',false),
   'scope_review_required',coalesce(l.profile#>>'{_enrich,scope_review_required}'='true',false),
   'organization_identity_quarantine',coalesce(l.profile#>>'{_enrich,organization_identity_quarantine}'='true',false),
   'blocked',coalesce(l.profile#>>'{_enrich,blocked}'='true',false),
   'source_challenge',coalesce(l.profile#>>'{_enrich,source_challenge}'='true',false)
 ))
$fn$;
ALTER FUNCTION zoi.geography_read_authority_input(zoi.listings) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.geography_read_authority_input(zoi.listings) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION zoi.geography_read_source_allowed(l zoi.listings) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $fn$
 SELECT NOT(coalesce(l.profile#>>'{_enrich,blocked_reason}'='source_scope_mismatch',false)
 OR coalesce(l.profile#>>'{_enrich,source_scope_mismatch}'='true',false)
 OR coalesce(l.profile#>>'{_enrich,source_kind}'='association_member',false)
 OR coalesce(l.profile#>>'{_enrich,identity_scope}'='organization' AND l.entity_type IN('artist','creator','professional'),false)
 OR coalesce(l.profile#>>'{_enrich,scope_review_required}'='true',false)
 OR coalesce(l.profile#>>'{_enrich,organization_identity_quarantine}'='true',false)
 OR coalesce(l.profile#>>'{_enrich,blocked}'='true',false)
 OR coalesce(l.profile#>>'{_enrich,source_challenge}'='true',false))
 AND NOT EXISTS(SELECT 1 FROM jsonb_each(CASE WHEN jsonb_typeof(l.profile)='object' THEN l.profile ELSE '{}'::jsonb END) AS f(k,v)
 WHERE k IN('name','address','city','country','website','latitude','longitude','geo_precision')
 AND v IS DISTINCT FROM to_jsonb(l)->k)
$fn$;
ALTER FUNCTION zoi.geography_read_source_allowed(zoi.listings) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.geography_read_source_allowed(zoi.listings) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION zoi.geography_read_authority_fingerprint(l zoi.listings) RETURNS text
LANGUAGE sql STABLE SET search_path='' AS $fn$
 SELECT encode(extensions.digest(convert_to(jsonb_build_object('authority',zoi.geography_read_authority_input(l),'epoch',e.epoch)::text,'UTF8'),'sha256'),'hex')
 FROM zoi.geography_read_authority_epochs e WHERE e.listing_id=l.id
$fn$;
ALTER FUNCTION zoi.geography_read_authority_fingerprint(zoi.listings) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.geography_read_authority_fingerprint(zoi.listings) FROM PUBLIC,anon,authenticated,service_role;

-- The listing lock is already held. Update only a lazily established epoch;
-- this is NOT a catalogue seed or another job queue. The monotonic epoch
-- prevents a source/address/ownership change away and back from reviving an
-- old receipt, while ordinary menu/coverage edits perform no epoch write.
CREATE FUNCTION zoi.geography_read_authority_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF zoi.geography_read_authority_input(OLD) IS DISTINCT FROM zoi.geography_read_authority_input(NEW) THEN
   UPDATE zoi.geography_read_authority_epochs SET epoch=epoch+1 WHERE listing_id=NEW.id;
 END IF;
 RETURN NULL;
END $fn$;
ALTER FUNCTION zoi.geography_read_authority_changed() OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.geography_read_authority_changed() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER geography_read_authority_changed AFTER UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.geography_read_authority_changed();

CREATE OR REPLACE FUNCTION public.geography_review_apply(p_request uuid, p_listing uuid, p_expected text, p_report_text text, p_review jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 l zoi.listings; prior zoi.geography_reviews; report jsonb; c jsonb;b jsonb;
 named_parts text[]; payload jsonb; receipt jsonb; before_geo jsonb; report_hash text;
 lat double precision;lng double precision; south double precision;north double precision;
 west double precision;east double precision;review_time timestamptz;source_host text;website_host text;source_path text;website_path text;
BEGIN
 IF p_request IS NULL OR p_listing IS NULL OR p_expected IS NULL
 OR p_report_text IS NULL OR octet_length(p_report_text)>32768
 OR jsonb_typeof(p_review) IS DISTINCT FROM 'object' OR octet_length(p_review::text)>16384
 THEN RAISE EXCEPTION 'invalid_geography_review';END IF;
 report:=p_report_text::jsonb;
 report_hash:=encode(extensions.digest(convert_to(p_report_text,'UTF8'),'sha256'),'hex');
 payload:=jsonb_build_object('listing',p_listing,'expected',p_expected,'report',report,'report_hash',report_hash,'review',p_review);
 PERFORM pg_advisory_xact_lock(hashtextextended('geography-review:'||p_request::text,0));
 SELECT * INTO l FROM zoi.listings WHERE id=p_listing FOR UPDATE;
 IF NOT FOUND OR l.owner_user_id IS NOT NULL OR l.owner_workspace_id IS NOT NULL
 OR l.publish_status IS DISTINCT FROM 'published' OR coalesce(l.moderation_status,'') NOT IN('clean','cleared')
 OR coalesce(l.marketplace_status,'')='hidden' THEN RAISE EXCEPTION 'geography_listing_unavailable';END IF;
 IF l.profile IS NOT NULL AND jsonb_typeof(l.profile) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'geography_profile_shape_invalid';END IF;
 SELECT * INTO prior FROM zoi.geography_reviews WHERE request_id=p_request;
 IF FOUND THEN
  IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'geography_request_conflict';END IF;
  IF prior.reverted_at IS NOT NULL THEN RAISE EXCEPTION 'geography_review_reverted';END IF;
  IF zoi.geography_fingerprint(l) IS DISTINCT FROM prior.after_fingerprint THEN RAISE EXCEPTION 'geography_snapshot_changed';END IF;
  RETURN prior.receipt;
 END IF;
 IF zoi.geography_fingerprint(l) IS DISTINCT FROM p_expected
 OR p_review->>'database_snapshot' IS DISTINCT FROM p_expected
 OR report->>'listing_id' IS DISTINCT FROM p_listing::text
 OR report->>'source_fingerprint' IS DISTINCT FROM zoi.listing_quality_fingerprint(l)
 THEN RAISE EXCEPTION 'geography_snapshot_changed';END IF;
 IF report->>'status' IS DISTINCT FROM 'review_required'
 OR report->>'reason' IS DISTINCT FROM 'coordinate_plausibility_review_required'
 OR p_review->>'report_sha256' IS DISTINCT FROM report_hash
 OR p_review->'exact_address_confirmed' IS DISTINCT FROM 'true'::jsonb
 OR p_review->'not_area_centroid' IS DISTINCT FROM 'true'::jsonb
 OR length(btrim(coalesce(p_review->>'reviewer',''))) NOT BETWEEN 1 AND 160
 OR length(btrim(coalesce(p_review->>'specialist',''))) NOT BETWEEN 1 AND 160
 OR lower(btrim(p_review->>'reviewer'))=lower(btrim(p_review->>'specialist'))
 THEN RAISE EXCEPTION 'independent_geography_review_required';END IF;
 review_time:=(p_review->>'reviewed_at')::timestamptz;
 IF review_time IS NULL OR review_time<clock_timestamp()-interval '7 days'
 OR review_time>clock_timestamp()+interval '5 minutes' THEN RAISE EXCEPTION 'geography_review_expired';END IF;
 source_host:=lower(substring(report->>'source_url' FROM '^https://([^/:?#@]+)(?:/|$)'));
 website_host:=lower(substring(l.website FROM '^https://([^/:?#@]+)(?:/|$)'));
 IF source_host IS NULL OR website_host IS NULL
 OR regexp_replace(source_host,'^www\.','')<>regexp_replace(website_host,'^www\.','')
 OR coalesce(report->>'source_sha256','')!~'^[0-9a-f]{64}$'
 THEN RAISE EXCEPTION 'geography_source_mismatch';END IF;
 c:=report->'candidate';b:=p_review->'locality_extent';
 source_path:=regexp_replace(regexp_replace(report->>'source_url','^https://[^/]+',''),'[?#].*$','');
 website_path:=rtrim(regexp_replace(regexp_replace(l.website,'^https://[^/]+',''),'[?#].*$',''),'/');
 -- Conservative property scoping: raw URL prefixes are not safe when a
 -- browser/server could normalize dot segments or encoded separators first.
 -- Reject ambiguous forms instead of guessing their decoded destination.
 IF strpos(report->>'source_url',chr(92))>0 OR strpos(l.website,chr(92))>0
 OR source_path ~* '(^|/)[.]{1,2}(/|$)|//|%(2e|2f|5c|25)'
 OR website_path ~* '(^|/)[.]{1,2}(/|$)|//|%(2e|2f|5c|25)'
 THEN RAISE EXCEPTION 'geography_source_path_noncanonical';END IF;
 IF report->'schema' IS DISTINCT FROM '1'::jsonb
 OR report->>'kind' IS DISTINCT FROM 'official_coordinate_dry_run'
 OR report->'http_status' IS DISTINCT FROM '200'::jsonb
 OR coalesce(report->>'snapshot_sha256','')!~'^[0-9a-f]{64}$'
 OR coalesce(c->>'evidence_kind','') NOT IN('jsonld','official_destination','reviewed_named_place_shortlink')
 OR lower(btrim(c->>'name')) IS DISTINCT FROM lower(btrim(l.name))
 OR p_review->'official_source_confirmed' IS DISTINCT FROM 'true'::jsonb
 OR p_review->'candidate_address' IS DISTINCT FROM c->'address'
 OR jsonb_typeof(c->'address') IS DISTINCT FROM 'object'
 OR length(btrim(coalesce(c#>>'{address,street}','')))=0
 OR length(btrim(coalesce(c#>>'{address,city}','')))=0
 OR length(btrim(coalesce(c#>>'{address,country}','')))=0
 OR p_review->>'stored_address' IS DISTINCT FROM l.address
 OR p_review->>'stored_city' IS DISTINCT FROM l.city
 OR p_review->>'stored_country' IS DISTINCT FROM l.country
 OR (c->>'evidence_kind'<>'reviewed_named_place_shortlink' AND website_path<>'' AND source_path<>website_path AND left(source_path,length(website_path)+1)<>website_path||'/')
 THEN RAISE EXCEPTION 'geography_identity_review_required';END IF;
 IF c->>'evidence_kind'='reviewed_named_place_shortlink' THEN
  IF p_review->'publisher_contact_scope' IS DISTINCT FROM 'true'::jsonb
  OR p_review->'named_place_confirmed' IS DISTINCT FROM 'true'::jsonb
  OR p_review->>'destination_purpose' IS DISTINCT FROM 'place_location'
  OR p_review->>'source_sha256' IS DISTINCT FROM report->>'source_sha256'
  OR coalesce(report->>'identity_review_sha256','')!~'^[0-9a-f]{64}$'
  OR p_review->>'identity_review_sha256' IS DISTINCT FROM report->>'identity_review_sha256'
  OR coalesce(c->>'capture_sha256','')!~'^[0-9a-f]{64}$'
  OR coalesce(c->>'contact_card_sha256','')!~'^[0-9a-f]{64}$'
  OR p_review->>'capture_sha256' IS DISTINCT FROM c->>'capture_sha256'
  OR p_review->>'contact_card_sha256' IS DISTINCT FROM c->>'contact_card_sha256'
  OR p_review->>'destination_url' IS DISTINCT FROM c->>'evidence_url'
  OR p_review->>'shortlink_url' IS DISTINCT FROM c->>'shortlink_url'
  OR p_review->>'place_id' IS DISTINCT FROM c->>'place_id'
  OR coalesce(c->>'shortlink_url','')!~'^https://maps[.]app[.]goo[.]gl/[A-Za-z0-9]+$'
  OR c->'destination_locality' IS DISTINCT FROM b
  THEN RAISE EXCEPTION 'geography_named_place_review_required';END IF;
  named_parts:=regexp_match(c->>'evidence_url','^https://www[.]google[.]com/maps/place/([^/]+)/@[^/]+/data=!4m9!3m8!1s(0x[0-9a-f]+:0x[0-9a-f]+)!5m2!4m1!1i2!8m2!3d(-?[0-9]+(?:[.][0-9]+)?)!4d(-?[0-9]+(?:[.][0-9]+)?)!16s[^!?#]+(?:[?][^#]+)?$','i');
  IF named_parts IS NULL OR lower(zoi.geography_url_component(named_parts[1])) IS DISTINCT FROM lower(l.name)
  OR named_parts[2] IS DISTINCT FROM c->>'place_id'
  OR (named_parts[3])::double precision IS DISTINCT FROM (c->>'latitude')::double precision
  OR (named_parts[4])::double precision IS DISTINCT FROM (c->>'longitude')::double precision
  OR EXISTS(SELECT 1 FROM regexp_split_to_table(split_part(c->>'evidence_url','?',2),'&') AS item WHERE item<>'' AND split_part(item,'=',1) NOT IN('entry','g_ep','skid'))
  THEN RAISE EXCEPTION 'geography_named_destination_mismatch';END IF;
 END IF;
 IF c->>'evidence_kind'='official_destination' AND (
 p_review->>'destination_purpose' IS DISTINCT FROM 'place_location'
 OR p_review->>'destination_url' IS DISTINCT FROM c->>'evidence_url'
 OR coalesce(c->>'evidence_url','')!~'^https://(www\.)?google\.com/maps/dir/')
 THEN RAISE EXCEPTION 'geography_destination_review_required';END IF;
 IF c->>'precision' IS DISTINCT FROM 'source_published'
 OR jsonb_typeof(c->'latitude') IS DISTINCT FROM 'number' OR jsonb_typeof(c->'longitude') IS DISTINCT FROM 'number'
 OR jsonb_typeof(b->'south') IS DISTINCT FROM 'number' OR jsonb_typeof(b->'north') IS DISTINCT FROM 'number'
 OR jsonb_typeof(b->'west') IS DISTINCT FROM 'number' OR jsonb_typeof(b->'east') IS DISTINCT FROM 'number'
 OR coalesce(b->>'source_url','')!~'^https://[^/:?#@]+/' THEN RAISE EXCEPTION 'geography_locality_evidence_required';END IF;
 lat:=(c->>'latitude')::double precision;lng:=(c->>'longitude')::double precision;
 south:=(b->>'south')::double precision;north:=(b->>'north')::double precision;
 west:=(b->>'west')::double precision;east:=(b->>'east')::double precision;
 IF south< -90 OR north>90 OR west< -180 OR east>180 OR south>=north OR west>=east
 OR north-south>5 OR east-west>5 OR lat<south OR lat>north OR lng<west OR lng>east OR(lat=0 AND lng=0)
 THEN RAISE EXCEPTION 'geography_outside_reviewed_locality';END IF;
 IF NOT zoi.geography_read_source_allowed(l) THEN RAISE EXCEPTION 'geography_source_authority_held';END IF;
 INSERT INTO zoi.geography_read_authority_epochs(listing_id) VALUES(l.id) ON CONFLICT(listing_id) DO NOTHING;
 before_geo:=jsonb_build_object('latitude',l.latitude,'longitude',l.longitude,'geo_precision',l.geo_precision,
 'profile_was_null',l.profile IS NULL,'had_geo',coalesce(l.profile,'{}'::jsonb)?'_geo','geo',l.profile->'_geo');
 UPDATE zoi.listings SET latitude=lat,longitude=lng,geo_precision='street',
 profile=coalesce(l.profile,'{}'::jsonb)||jsonb_build_object('_geo',jsonb_build_object(
 'precision','street','method','reviewed_official_source','source_url',report->>'source_url',
 'source_sha256',report->>'source_sha256','report_sha256',report_hash,'reviewer',p_review->>'reviewer',
 'reviewed_at',review_time,'request_id',p_request)),updated_at=clock_timestamp()
 WHERE id=p_listing RETURNING * INTO l;
 receipt:=jsonb_build_object('ok',true,'request_id',p_request,'listing_id',p_listing,
 'latitude',l.latitude,'longitude',l.longitude,'precision',l.geo_precision,'report_sha256',report_hash,
 'after_snapshot',zoi.geography_fingerprint(l));
 IF NOT zoi.geography_read_source_allowed(l) THEN RAISE EXCEPTION 'geography_source_authority_held';END IF;
 INSERT INTO zoi.geography_reviews(request_id,listing_id,payload,receipt,before_geo,after_fingerprint,read_authority_fingerprint)
 VALUES(p_request,p_listing,payload,receipt,before_geo,zoi.geography_fingerprint(l),zoi.geography_read_authority_fingerprint(l));
 RETURN receipt;
END $function$
;

CREATE OR REPLACE FUNCTION public.geography_reviewed_point(p_listing uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object('listing_id',l.id,'request_id',r.request_id,
 'latitude',l.latitude,'longitude',l.longitude,'precision',l.geo_precision)
 FROM zoi.listings l JOIN zoi.geography_reviews r ON r.listing_id=l.id AND r.request_id=CASE WHEN l.profile#>>'{_geo,request_id}'~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (l.profile#>>'{_geo,request_id}')::uuid ELSE NULL END
 WHERE l.id=p_listing AND l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
 AND l.marketplace_status IS DISTINCT FROM 'hidden'
 AND l.duplicate_status <> 'confirmed_duplicate'
 AND l.owner_user_id IS NULL AND l.owner_workspace_id IS NULL
 AND r.reverted_at IS NULL AND zoi.geography_read_source_allowed(l) AND CASE WHEN r.read_authority_fingerprint IS NULL THEN r.after_fingerprint=zoi.geography_fingerprint(l) ELSE r.read_authority_fingerprint=zoi.geography_read_authority_fingerprint(l) END
 AND l.profile->'_geo'->>'request_id'=r.request_id::text
 AND r.receipt->>'listing_id'=l.id::text AND r.receipt->>'request_id'=r.request_id::text
 AND r.receipt->'latitude'=to_jsonb(l.latitude) AND r.receipt->'longitude'=to_jsonb(l.longitude)
 AND r.receipt->>'precision'=l.geo_precision AND l.geo_precision='street'
 ORDER BY r.created_at DESC LIMIT 1
$function$
;
COMMENT ON COLUMN zoi.geography_reviews.read_authority_fingerprint IS 'Read-only authority binding for newly source-reviewed applications. NULL legacy rows retain full-row comparison. Does not replace full-row application/revert CAS.';
NOTIFY pgrst,'reload schema';
COMMIT;
