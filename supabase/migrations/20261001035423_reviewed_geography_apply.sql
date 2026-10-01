BEGIN;
SET LOCAL lock_timeout='5s';

-- Service-only evidence ledger. No application user can self-certify a map pin.
CREATE TABLE zoi.geography_reviews (
  request_id uuid PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES zoi.listings(id),
  payload jsonb NOT NULL,
  receipt jsonb NOT NULL,
  before_geo jsonb NOT NULL,
  after_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reverted_at timestamptz
);
ALTER TABLE zoi.geography_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.geography_reviews FROM PUBLIC,anon,authenticated;

-- Freeze the entire row, including source, name, owner and imported content.
-- An unrelated concurrent edit conservatively requires a fresh review.
CREATE FUNCTION zoi.geography_fingerprint(p_listing zoi.listings)
RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT md5(to_jsonb(p_listing)::text)
$$;
REVOKE ALL ON FUNCTION zoi.geography_fingerprint(zoi.listings) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION zoi.geography_fingerprint(zoi.listings) TO service_role;

CREATE FUNCTION public.geography_review_apply(
 p_request uuid,p_listing uuid,p_expected text,p_report_text text,p_review jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 l zoi.listings; prior zoi.geography_reviews; report jsonb; c jsonb;b jsonb;
 payload jsonb; receipt jsonb; before_geo jsonb; report_hash text;
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
 OR coalesce(c->>'evidence_kind','') NOT IN('jsonld','official_destination')
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
 OR (website_path<>'' AND source_path<>website_path AND left(source_path,length(website_path)+1)<>website_path||'/')
 THEN RAISE EXCEPTION 'geography_identity_review_required';END IF;
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
 INSERT INTO zoi.geography_reviews(request_id,listing_id,payload,receipt,before_geo,after_fingerprint)
 VALUES(p_request,p_listing,payload,receipt,before_geo,zoi.geography_fingerprint(l));
 RETURN receipt;
END $$;
REVOKE ALL ON FUNCTION public.geography_review_apply(uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.geography_review_apply(uuid,uuid,text,text,jsonb) TO service_role;

CREATE FUNCTION public.geography_review_revert(p_request uuid,p_expected text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r zoi.geography_reviews;l zoi.listings;
BEGIN
 IF p_request IS NULL OR p_expected IS NULL THEN RAISE EXCEPTION 'invalid_geography_review';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('geography-review:'||p_request::text,0));
 SELECT * INTO r FROM zoi.geography_reviews WHERE request_id=p_request;
 IF NOT FOUND THEN RAISE EXCEPTION 'geography_review_missing';END IF;
 SELECT * INTO l FROM zoi.listings WHERE id=r.listing_id FOR UPDATE;
 IF NOT FOUND OR l.owner_user_id IS NOT NULL OR l.owner_workspace_id IS NOT NULL
 THEN RAISE EXCEPTION 'geography_listing_unavailable';END IF;
 IF r.reverted_at IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'reverted',true,'request_id',p_request);END IF;
 IF p_expected IS DISTINCT FROM r.after_fingerprint OR zoi.geography_fingerprint(l) IS DISTINCT FROM r.after_fingerprint
 THEN RAISE EXCEPTION 'geography_snapshot_changed';END IF;
 UPDATE zoi.listings SET latitude=(r.before_geo->>'latitude')::double precision,
 longitude=(r.before_geo->>'longitude')::double precision,geo_precision=r.before_geo->>'geo_precision',
 profile=CASE WHEN r.before_geo->'profile_was_null'='true'::jsonb THEN NULL WHEN r.before_geo->'had_geo'='true'::jsonb THEN jsonb_set(coalesce(l.profile,'{}'::jsonb),'{_geo}',r.before_geo->'geo') ELSE coalesce(l.profile,'{}'::jsonb)-'_geo' END,
 updated_at=clock_timestamp() WHERE id=r.listing_id;
 UPDATE zoi.geography_reviews SET reverted_at=clock_timestamp() WHERE request_id=p_request;
 RETURN jsonb_build_object('ok',true,'reverted',true,'request_id',p_request);
END $$;
REVOKE ALL ON FUNCTION public.geography_review_revert(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.geography_review_revert(uuid,text) TO service_role;
COMMIT;
