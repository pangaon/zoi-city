-- Read-only current-context projection for explicitly reviewed Food receipts.
-- CLI-created migration. No canonical listing, lease, writer or receipt mutation.
DO $guard$ DECLARE e jsonb;p record;BEGIN
 IF to_regprocedure('zoi.reviewed_food_public_context(zoi.listings)') IS NOT NULL THEN RAISE EXCEPTION 'reviewed_food_helper_exists';END IF;
 FOR e IN SELECT * FROM jsonb_array_elements($contracts$[
  {
    "signature": "public.enrich_sample_lease(uuid[])",
    "md5": "15626a3b9a0f095af32bb748627e651a",
    "owner": "postgres",
    "acl": "{postgres=X/postgres,service_role=X/postgres}",
    "config": [
      "search_path=\"\""
    ],
    "security_definer": true,
    "volatility": "v"
  },
  {
    "signature": "public.home_entity(text)",
    "md5": "73f866cdced061a329d1c5b7e827c6e0",
    "owner": "postgres",
    "acl": "{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}",
    "config": [
      "search_path=\"\""
    ],
    "security_definer": true,
    "volatility": "s"
  },
  {
    "signature": "public.seo_entity(text)",
    "md5": "e01c20df827c18865a0bfaadff2a9d49",
    "owner": "postgres",
    "acl": "{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}",
    "config": [
      "search_path=\"\""
    ],
    "security_definer": true,
    "volatility": "s"
  },
  {
    "signature": "zoi.enrich_apply(jsonb)",
    "md5": "310678a4bd7d77d5467dbd07604349d9",
    "owner": "postgres",
    "acl": "{postgres=X/postgres}",
    "config": [
      "search_path=\"\""
    ],
    "security_definer": true,
    "volatility": "v"
  },
  {
    "signature": "zoi.enrich_queue_lease(integer,integer,integer)",
    "md5": "950a5ee4f0fad7fa4700805d0ac034ee",
    "owner": "postgres",
    "acl": "{postgres=X/postgres}",
    "config": [
      "search_path=\"\""
    ],
    "security_definer": true,
    "volatility": "v"
  },
  {
    "signature": "zoi.listing_quality_fingerprint(zoi.listings)",
    "md5": "cc69353ab17d09e06846eb90c1ee34cd",
    "owner": "postgres",
    "acl": "{postgres=X/postgres,service_role=X/postgres}",
    "config": [
      "search_path=\"\""
    ],
    "security_definer": false,
    "volatility": "s"
  }
]$contracts$::jsonb) LOOP
  SELECT * INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure(e->>'signature');
  IF md5(pg_get_functiondef(p.oid)) IS DISTINCT FROM e->>'md5' OR pg_get_userbyid(p.proowner) IS DISTINCT FROM e->>'owner' OR p.proacl::text IS DISTINCT FROM e->>'acl'
    OR to_jsonb(p.proconfig) IS DISTINCT FROM e->'config' OR p.prosecdef IS DISTINCT FROM (e->>'security_definer')::boolean OR p.provolatile::text IS DISTINCT FROM e->>'volatility' THEN RAISE EXCEPTION 'reviewed_food_public_contract_drift:%',e->>'signature';END IF;
 END LOOP;
END $guard$;
CREATE FUNCTION zoi.reviewed_food_public_context(l zoi.listings) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $function$
DECLARE q jsonb:=coalesce(l.profile->'_enrich','{}'::jsonb);identity jsonb;bound jsonb;actual jsonb;valid boolean;held boolean;projected jsonb:=l.profile;
BEGIN
 identity:=q->'source_identity';bound:=identity->'canonical_context';
 actual:=jsonb_build_object('listing_id',l.id,'name',l.name,'entity_type',l.entity_type,'website',l.website,'address',l.address,'city',l.city,'country',l.country,
  'category_slug',(SELECT c.slug FROM zoi.categories c WHERE c.id=l.primary_category_id),'primary_category_id',l.primary_category_id,'owner_user_id',l.owner_user_id,'owner_workspace_id',l.owner_workspace_id,'claim_status',l.claim_status);
 valid:=coalesce(identity->>'verification'='reviewed_official_visible_branch' AND jsonb_typeof(bound)='object' AND bound=actual
  AND l.owner_user_id IS NULL AND l.owner_workspace_id IS NULL AND (l.claim_status IS NULL OR l.claim_status='unclaimed')
  AND l.entity_type IN('business','vendor') AND actual->>'category_slug'~*'(restaurant|taverna|baker)'
  AND identity->>'name'=l.name AND identity->>'expected_entity_type'=l.entity_type AND identity->>'category_slug'=actual->>'category_slug'
  AND q->>'source_url'=l.website AND rtrim(identity->>'source_url','/')=rtrim(l.website,'/')
  AND identity->>'review_sha256'~'^[a-f0-9]{64}$' AND q#>>'{provenance,source_identity}'='reviewed_official_visible_branch#sha256='||(identity->>'review_sha256')
  AND q#>>'{food_source_coverage,identity_verification}'='reviewed_official_visible_branch' AND q#>>'{food_source_coverage,identity_review_sha256}'=identity->>'review_sha256',false);
 held:=coalesce(q->>'blocked','false')='true' OR coalesce(q->>'status','')='blocked' OR coalesce(q->>'crawl_status','')='blocked'
  OR (q->>'crawl_status'='error' AND coalesce(q->>'last_error','')<>'reviewed_visible_food_requires_review')
  OR coalesce(q->>'blocked_reason','')='source_scope_mismatch'
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['scope_review_required','organization_identity_quarantine','source_scope_mismatch','source_challenge','challenge'])k WHERE q->>k='true')
  OR coalesce(q->>'identity_scope','')<>'' OR q ? 'member' OR q ? 'association_member' OR q ? 'source_affiliation'
  OR coalesce(q->>'source_kind','') IN('association_directory','association_member','supporting_publisher_profile');
 IF NOT valid OR held THEN
  projected:=jsonb_set(coalesce(l.profile,'{}'::jsonb),'{_enrich}',q||jsonb_build_object('blocked',true,'blocked_reason','source_scope_mismatch','scope_review_required',true),true);
 ELSIF q->>'crawl_status'='error' AND q->>'last_error'='reviewed_visible_food_requires_review'
  AND coalesce(q->>'blocked','false')<>'true' AND coalesce(q->>'status','')<>'blocked'
  AND coalesce(q->>'blocked_reason','')<>'source_scope_mismatch'
  AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['scope_review_required','organization_identity_quarantine','source_scope_mismatch','source_challenge','challenge'])k WHERE q->>k='true') THEN
  -- This is a manual review deferral, not a new successful source crawl. Keep
  -- old proof and dates unchanged; older public consumers understand a nonerror
  -- review-required state without hiding the still-current receipt's facts.
  projected:=jsonb_set(l.profile,'{_enrich,crawl_status}','"review_required"'::jsonb,false);
 END IF;
 RETURN jsonb_build_object('current',valid,'profile',projected);
END $function$;
ALTER FUNCTION zoi.reviewed_food_public_context(zoi.listings) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.reviewed_food_public_context(zoi.listings) FROM PUBLIC,anon,authenticated,service_role;
DO $patch$ DECLARE definition text;needle text;replacement text;BEGIN
 SELECT pg_get_functiondef('public.seo_entity(text)'::regprocedure) INTO STRICT definition;
 needle:=$old$'profile',me.profile,'category_slug'$old$;
 replacement:=$new$'profile',CASE WHEN me.profile#>>'{_enrich,source_identity,verification}'='reviewed_official_visible_branch' THEN zoi.reviewed_food_public_context(me)->'profile' ELSE me.profile END,'category_slug'$new$;
 IF length(definition)-length(replace(definition,needle,''))<>length(needle) THEN RAISE EXCEPTION 'reviewed_food_profile_projection_anchor_drift';END IF;
 definition:=replace(definition,needle,replacement);
 needle:=$old$jsonb_build_object('owner_content',zoi.public_owner_content(me.id)) FROM me;$old$;
 replacement:=$new$jsonb_build_object('owner_content',zoi.public_owner_content(me.id)) || CASE WHEN me.profile#>>'{_enrich,source_identity,verification}'='reviewed_official_visible_branch' THEN jsonb_build_object('reviewed_food_receipt_current',(zoi.reviewed_food_public_context(me)->>'current')::boolean) ELSE '{}'::jsonb END FROM me;$new$;
 IF length(definition)-length(replace(definition,needle,''))<>length(needle) THEN RAISE EXCEPTION 'reviewed_food_validity_projection_anchor_drift';END IF;
 EXECUTE replace(definition,needle,replacement);
END $patch$;
