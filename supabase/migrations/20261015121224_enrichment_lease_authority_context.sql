BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='20s';
-- Authority is derived on the server at lease creation and rechecked under the
-- existing writer's listing lock. Never trust context supplied in the payload.
-- Outstanding pre-migration leases are deliberately refused (applied:false),
-- including failure writes. They expire normally and may then be leased again.
-- No lease reset, source retry, table rewrite, or new writer is installed here.
DO $guard$ DECLARE e jsonb;p pg_proc;BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'enrich_authority_executor_required';END IF;
 IF to_regprocedure('zoi.enrich_authority_fingerprint(zoi.listings)') IS NOT NULL THEN RAISE EXCEPTION 'enrich_authority_helper_already_exists';END IF;
 FOR e IN SELECT value FROM jsonb_array_elements($contracts$[
  {
    "signature": "zoi.enrich_queue_lease(integer,integer,integer)",
    "md5": "2ed0bc99f1c6abf79efefa285aafccfb",
    "acl": "{postgres=X/postgres}",
    "security_definer": true,
    "volatility": "v"
  },
  {
    "signature": "public.enrich_sample_lease(uuid[])",
    "md5": "3288adcdf686fe6c7139b26af4cff14e",
    "acl": "{postgres=X/postgres,service_role=X/postgres}",
    "security_definer": true,
    "volatility": "v"
  },
  {
    "signature": "zoi.enrich_apply(jsonb)",
    "md5": "8e41b35a16426573b5867436e60f0abf",
    "acl": "{postgres=X/postgres}",
    "security_definer": true,
    "volatility": "v"
  },
  {
    "signature": "zoi.listing_quality_fingerprint(zoi.listings)",
    "md5": "cc69353ab17d09e06846eb90c1ee34cd",
    "acl": "{postgres=X/postgres,service_role=X/postgres}",
    "security_definer": false,
    "volatility": "s"
  }
]$contracts$::jsonb) LOOP
  SELECT * INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure(e->>'signature');
  IF md5(pg_get_functiondef(p.oid)) IS DISTINCT FROM e->>'md5' OR pg_get_userbyid(p.proowner)<>'postgres' OR p.proacl::text IS DISTINCT FROM e->>'acl'
   OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""'] OR p.prosecdef IS DISTINCT FROM (e->>'security_definer')::boolean OR p.provolatile::text IS DISTINCT FROM e->>'volatility' THEN RAISE EXCEPTION 'enrich_authority_baseline_drift:%',e->>'signature';END IF;
 END LOOP;
END $guard$;
CREATE FUNCTION zoi.enrich_authority_fingerprint(l zoi.listings) RETURNS text
LANGUAGE sql STABLE SET search_path='' AS $function$
 SELECT md5(jsonb_build_array(1,zoi.listing_quality_fingerprint(l),
  l.id,l.slug,l.owner_user_id,l.owner_workspace_id,l.claim_status,l.duplicate_status,
  l.address,l.city,l.country,l.region,l.province_state,l.neighborhood,l.region_id,l.place_id,l.latitude,l.longitude,l.geo_precision,
  -- Keep the complete prior machine facts and provenance current. Lease metadata
  -- is the only changing server reservation; quality bookkeeping is outside _enrich.
  coalesce(l.profile->'_enrich','{}'::jsonb)-ARRAY['lease','_lease_source_context'])::text)
$function$;
REVOKE ALL ON FUNCTION zoi.enrich_authority_fingerprint(zoi.listings) FROM PUBLIC,anon,authenticated,service_role;
DO $patch$ DECLARE signature text;definition text;needle text;replacement text;BEGIN
 FOREACH signature IN ARRAY ARRAY['zoi.enrich_queue_lease(integer,integer,integer)','public.enrich_sample_lease(uuid[])'] LOOP
  SELECT pg_get_functiondef(to_regprocedure(signature)) INTO STRICT definition;
  needle:=$old$'source_website',l.website,'expires_at'$old$;
  replacement:=$new$'source_website',l.website,'authority_version',1,'authority_fingerprint',zoi.enrich_authority_fingerprint(l),'expires_at'$new$;
  IF (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'enrich_authority_lease_patch_drift';END IF;
  EXECUTE replace(definition,needle,replacement);
 END LOOP;
 SELECT pg_get_functiondef('zoi.enrich_apply(jsonb)'::regprocedure) INTO STRICT definition;
 needle:=$old$OR nullif(r->>'lease_id','') IS NULL$old$;
 replacement:=$new$OR lease->>'authority_version' IS DISTINCT FROM '1' OR lease->>'authority_fingerprint' IS DISTINCT FROM zoi.enrich_authority_fingerprint(l) OR nullif(r->>'lease_id','') IS NULL$new$;
 IF (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'enrich_authority_apply_patch_drift';END IF;
 EXECUTE replace(definition,needle,replacement);
END $patch$;
COMMENT ON FUNCTION zoi.enrich_authority_fingerprint(zoi.listings) IS 'Private server-derived current source branch/identity/ownership/visibility/hold fingerprint for existing enrichment leases. No client-supplied context authority.';
COMMIT;
