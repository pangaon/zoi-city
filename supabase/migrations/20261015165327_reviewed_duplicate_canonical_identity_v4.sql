-- Reviewed duplicate identity only: existing canonical public/SEO readers.
-- Depends on accepted reviewed-Food projection; no writer, source fact or listing
-- data mutation. Private resolver consumes existing reviewed duplicate decisions.
DO $guard$ DECLARE e jsonb;p record;BEGIN
 IF to_regprocedure('zoi.reviewed_duplicate_canonical_slug(text)')IS NOT NULL THEN RAISE EXCEPTION 'reviewed_duplicate_helper_exists';END IF;
 FOR e IN SELECT * FROM jsonb_array_elements($contracts$[
  {
    "acl": "{postgres=X/postgres}",
    "md5": "41441f9bbbaab95f8f939724fa327a4f",
    "owner": "postgres",
    "config": [
      "search_path=\"\"",
      "work_mem=16MB"
    ],
    "signature": "zoi.seo_canonical_rows()",
    "volatility": "s",
    "security_definer": true
  },
  {
    "acl": "{postgres=X/postgres}",
    "md5": "52d7ac288fc10dcc7ba112b8962a2d3a",
    "owner": "postgres",
    "config": [
      "search_path=\"\""
    ],
    "signature": "zoi.maintain_seo_projection()",
    "volatility": "v",
    "security_definer": true
  },
  {
    "acl": "{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
    "md5": "bcf7ce8af972d30472b28cf3787d524f",
    "owner": "postgres",
    "config": [
      "search_path=\"\""
    ],
    "signature": "explore_geo(text,text,text,text,integer)",
    "definition": "CREATE OR REPLACE FUNCTION public.explore_geo(p_q text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_limit integer DEFAULT 600)\n RETURNS jsonb\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO ''\nAS $function$\n SELECT COALESCE(jsonb_agg(to_jsonb(r)),'[]'::jsonb) FROM(\n SELECT l.id,l.name,COALESCE(l.canonical_path,'/p/'||l.slug) AS path,l.latitude AS lat,l.longitude AS lng,l.entity_type,l.city,(l.verification_status='verified') AS verified\n FROM zoi.listings l WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared') AND COALESCE(l.marketplace_status,'')<>'hidden' AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL\n AND(p_type IS NULL OR l.entity_type=p_type) AND(p_city IS NULL OR l.city ILIKE p_city) AND(p_country IS NULL OR l.country ILIKE p_country)\n AND(p_q IS NULL OR l.name ILIKE '%'||p_q||'%' OR l.search_tsv @@ pg_catalog.plainto_tsquery('pg_catalog.simple',p_q))\n ORDER BY(l.verification_status='verified') DESC,l.trust_score DESC NULLS LAST,l.id\n LIMIT LEAST(GREATEST(p_limit,1),1200))r\n$function$\n",
    "volatility": "s",
    "security_definer": true
  },
  {
    "acl": "{postgres=X/postgres}",
    "md5": "9ec461b982e9c353c3bb7322e6d7903d",
    "owner": "postgres",
    "config": [
      "search_path=\"\"",
      "plan_cache_mode=force_custom_plan"
    ],
    "signature": "zoi.explore_default_page(integer,integer)",
    "definition": "CREATE OR REPLACE FUNCTION zoi.explore_default_page(p_limit integer, p_offset integer)\n RETURNS jsonb\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO ''\n SET plan_cache_mode TO 'force_custom_plan'\nAS $function$\n WITH page AS MATERIALIZED (\n  SELECT candidate.id,candidate.name,candidate.verification_status,candidate.trust_score,0 AS name_relevance\n  FROM zoi.listings candidate\n  CROSS JOIN LATERAL (\n   SELECT duplicate.id FROM zoi.listings duplicate\n   WHERE duplicate.publish_status='published' AND duplicate.moderation_status IN ('clean','cleared') AND coalesce(duplicate.marketplace_status,'')<>'hidden'\n    AND lower(trim(coalesce(duplicate.name,'')))=lower(trim(coalesce(candidate.name,'')))\n    AND lower(trim(coalesce(duplicate.city,'')))=lower(trim(coalesce(candidate.city,'')))\n    AND lower(trim(coalesce(zoi.geo_country_canon(duplicate.country),'')))=lower(trim(coalesce(zoi.geo_country_canon(candidate.country),'')))\n   ORDER BY (duplicate.verification_status='verified') DESC,duplicate.trust_score DESC NULLS LAST,\n    CASE duplicate.entity_type WHEN 'creator' THEN 0 WHEN 'artist' THEN 1 WHEN 'business' THEN 2 ELSE 3 END,\n    duplicate.name,duplicate.id\n   LIMIT 1\n  ) winner\n  WHERE candidate.publish_status='published' AND candidate.moderation_status IN ('clean','cleared') AND coalesce(candidate.marketplace_status,'')<>'hidden' AND winner.id=candidate.id\n  ORDER BY (candidate.verification_status='verified') DESC,candidate.trust_score DESC NULLS LAST,candidate.name,candidate.id\n  LIMIT least(greatest(p_limit,1),48) OFFSET greatest(p_offset,0)\n )\n SELECT coalesce(jsonb_agg(to_jsonb(r)-'_sort_verified'-'_sort_trust'-'_sort_relevance'\n  ORDER BY r._sort_relevance,r._sort_verified DESC,r._sort_trust DESC NULLS LAST,r.name,r.id),'[]'::jsonb)\n FROM (\n  SELECT l.id,l.slug,l.name,\n   zoi.public_listing_card_description(l.entity_type,card.media_input) AS description,\n   card.media_input,\n   c.label_en AS category,l.entity_type,l.city,zoi.geo_country_canon(l.country) AS country,\n   l.region,l.region_code,l.region_native,\n   '/'||replace(l.entity_type,'travel_place','travel-place')||'/'||l.slug AS path,\n   l.verification_status,l.rating,\n   zoi.public_listing_card_photo(card.media_input) AS photo_url,\n   CASE WHEN l.profile->>'hero_kind'='event_poster' AND zoi.public_listing_card_photo(card.media_input)=l.profile->>'hero_url' THEN 'event_poster' ELSE NULL END AS image_kind,\n   (l.owner_workspace_id IS NULL AND coalesce(l.claim_status,'unclaimed') NOT IN ('claimed','approved')) AS claimable,\n   page.name_relevance AS _sort_relevance,(page.verification_status='verified') AS _sort_verified,page.trust_score AS _sort_trust\n  FROM page JOIN zoi.listings l ON l.id=page.id\n  CROSS JOIN LATERAL (SELECT zoi.public_listing_card_input(l.id,l.website,l.photo_url,l.description,l.profile) AS media_input OFFSET 0) card\n  LEFT JOIN zoi.categories c ON c.id=l.primary_category_id\n ) r;\n$function$\n",
    "volatility": "s",
    "security_definer": true
  },
  {
    "acl": "{postgres=X/postgres}",
    "md5": "b478b6f60f6a3ea44daf924855468401",
    "owner": "postgres",
    "config": [
      "search_path=\"\"",
      "plan_cache_mode=force_custom_plan"
    ],
    "signature": "zoi.explore_search_before_default_page(text,text,text,text,integer,integer,text)",
    "definition": "CREATE OR REPLACE FUNCTION zoi.explore_search_before_default_page(p_q text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0, p_region text DEFAULT NULL::text)\n RETURNS jsonb\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO ''\n SET plan_cache_mode TO 'force_custom_plan'\nAS $function$\nDECLARE v_q text:=lower(btrim(coalesce(p_q,'')));\n v_pattern text:='%'||replace(replace(replace(v_q,chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_')||'%';\nBEGIN\n -- Only literal nonempty city filters take the bounded locality-first path.\n -- Pattern and escape semantics continue through the original global query.\n IF p_city IS NOT NULL AND p_city<>'' AND strpos(p_city,'%')=0\n  AND strpos(p_city,'_')=0 AND strpos(p_city,chr(92))=0 THEN\n RETURN (WITH locality AS MATERIALIZED (\n  SELECT l.id,l.name,l.verification_status,l.trust_score,l.city,l.country,l.entity_type,\n   l.search_tsv,l.region,l.region_native,l.region_code\n  FROM zoi.listings l\n  WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared')\n   AND coalesce(l.marketplace_status,'')<>'hidden'\n   AND lower(l.city)=lower(p_city) AND l.city ILIKE p_city\n   AND (p_type IS NULL OR p_type='' OR l.entity_type=p_type)\n   AND (p_country IS NULL OR p_country='' OR zoi.geo_country_canon(l.country) ILIKE p_country)\n   AND (p_country IS NULL OR p_country='' OR strpos(p_country,'%')>0 OR strpos(p_country,'_')>0\n    OR strpos(p_country,chr(92))>0 OR lower(zoi.geo_country_canon(l.country))=lower(p_country))\n   AND (p_region IS NULL OR p_region='' OR l.region ILIKE p_region\n    OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))\n ), ranked AS NOT MATERIALIZED (\n  SELECT l.id,l.name,l.verification_status,l.trust_score,\n   CASE WHEN v_q='' THEN 0 WHEN lower(btrim(l.name))=v_q THEN 0\n    WHEN left(lower(btrim(l.name)),length(v_q))=v_q THEN 1\n    WHEN v_q=ANY(regexp_split_to_array(lower(l.name),'[^[:alnum:]_]+')) THEN 2\n    WHEN strpos(lower(l.name),v_q)>0 THEN 3 ELSE 4 END AS name_relevance,\n   row_number() OVER (\n    PARTITION BY lower(trim(coalesce(l.name,''))),lower(trim(coalesce(l.city,''))),\n     lower(trim(coalesce(zoi.geo_country_canon(l.country),'')))\n    ORDER BY (l.verification_status='verified') DESC,l.trust_score DESC NULLS LAST,\n     CASE l.entity_type WHEN 'creator' THEN 0 WHEN 'artist' THEN 1 WHEN 'business' THEN 2 ELSE 3 END,\n     l.name,l.id\n   ) AS dedupe_rank\n  FROM locality l\n  WHERE (v_q='' OR l.search_tsv @@ plainto_tsquery('simple',v_q)\n    OR lower(l.name) LIKE v_pattern OR lower(l.region) LIKE v_pattern\n    OR lower(l.region_native) LIKE v_pattern)\n   AND (p_type IS NULL OR p_type='' OR l.entity_type=p_type)\n   AND (p_city IS NULL OR p_city='' OR l.city ILIKE p_city)\n   AND (p_country IS NULL OR p_country='' OR zoi.geo_country_canon(l.country) ILIKE p_country)\n   AND (p_region IS NULL OR p_region='' OR l.region ILIKE p_region\n    OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))\n ), page AS MATERIALIZED (\n  SELECT id,name,verification_status,trust_score,name_relevance\n  FROM ranked WHERE dedupe_rank=1\n  ORDER BY name_relevance,(verification_status='verified') DESC,trust_score DESC NULLS LAST,name,id\n  LIMIT least(greatest(p_limit,1),48) OFFSET greatest(p_offset,0)\n )\n SELECT coalesce(jsonb_agg(to_jsonb(r)-'_sort_verified'-'_sort_trust'-'_sort_relevance'\n  ORDER BY r._sort_relevance,r._sort_verified DESC,r._sort_trust DESC NULLS LAST,r.name,r.id),'[]'::jsonb)\n FROM (\n  SELECT l.id,l.slug,l.name,\n   zoi.public_listing_card_description(l.entity_type,card.media_input) AS description,\n   card.media_input,\n   c.label_en AS category,l.entity_type,l.city,zoi.geo_country_canon(l.country) AS country,\n   l.region,l.region_code,l.region_native,\n   '/'||replace(l.entity_type,'travel_place','travel-place')||'/'||l.slug AS path,\n   l.verification_status,l.rating,\n   zoi.public_listing_card_photo(card.media_input) AS photo_url,\n   CASE WHEN l.profile->>'hero_kind'='event_poster' AND zoi.public_listing_card_photo(card.media_input)=l.profile->>'hero_url' THEN 'event_poster' ELSE NULL END AS image_kind,\n   (l.owner_workspace_id IS NULL AND coalesce(l.claim_status,'unclaimed') NOT IN ('claimed','approved')) AS claimable,\n   page.name_relevance AS _sort_relevance,(page.verification_status='verified') AS _sort_verified,page.trust_score AS _sort_trust\n  FROM page JOIN zoi.listings l ON l.id=page.id\n  CROSS JOIN LATERAL (SELECT zoi.public_listing_card_input(l.id,l.website,l.photo_url,l.description,l.profile) AS media_input OFFSET 0) card\n  LEFT JOIN zoi.categories c ON c.id=l.primary_category_id\n ) r);\n END IF;\n RETURN (WITH ranked AS NOT MATERIALIZED (\n  SELECT l.id,l.name,l.verification_status,l.trust_score,\n   CASE WHEN v_q='' THEN 0 WHEN lower(btrim(l.name))=v_q THEN 0\n    WHEN left(lower(btrim(l.name)),length(v_q))=v_q THEN 1\n    WHEN v_q=ANY(regexp_split_to_array(lower(l.name),'[^[:alnum:]_]+')) THEN 2\n    WHEN strpos(lower(l.name),v_q)>0 THEN 3 ELSE 4 END AS name_relevance,\n   row_number() OVER (\n    PARTITION BY lower(trim(coalesce(l.name,''))),lower(trim(coalesce(l.city,''))),\n     lower(trim(coalesce(zoi.geo_country_canon(l.country),'')))\n    ORDER BY (l.verification_status='verified') DESC,l.trust_score DESC NULLS LAST,\n     CASE l.entity_type WHEN 'creator' THEN 0 WHEN 'artist' THEN 1 WHEN 'business' THEN 2 ELSE 3 END,\n     l.name,l.id\n   ) AS dedupe_rank\n  FROM zoi.listings l\n  WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared')\n   AND coalesce(l.marketplace_status,'')<>'hidden'\n   AND (v_q='' OR l.search_tsv @@ plainto_tsquery('simple',v_q)\n    OR lower(l.name) LIKE v_pattern OR lower(l.region) LIKE v_pattern\n    OR lower(l.region_native) LIKE v_pattern)\n   AND (p_type IS NULL OR p_type='' OR l.entity_type=p_type)\n   AND (p_city IS NULL OR p_city='' OR l.city ILIKE p_city)\n   AND (p_country IS NULL OR p_country='' OR zoi.geo_country_canon(l.country) ILIKE p_country)\n   AND (p_region IS NULL OR p_region='' OR l.region ILIKE p_region\n    OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))\n ), page AS MATERIALIZED (\n  SELECT id,name,verification_status,trust_score,name_relevance\n  FROM ranked WHERE dedupe_rank=1\n  ORDER BY name_relevance,(verification_status='verified') DESC,trust_score DESC NULLS LAST,name,id\n  LIMIT least(greatest(p_limit,1),48) OFFSET greatest(p_offset,0)\n )\n SELECT coalesce(jsonb_agg(to_jsonb(r)-'_sort_verified'-'_sort_trust'-'_sort_relevance'\n  ORDER BY r._sort_relevance,r._sort_verified DESC,r._sort_trust DESC NULLS LAST,r.name,r.id),'[]'::jsonb)\n FROM (\n  SELECT l.id,l.slug,l.name,\n   zoi.public_listing_card_description(l.entity_type,card.media_input) AS description,\n   card.media_input,\n   c.label_en AS category,l.entity_type,l.city,zoi.geo_country_canon(l.country) AS country,\n   l.region,l.region_code,l.region_native,\n   '/'||replace(l.entity_type,'travel_place','travel-place')||'/'||l.slug AS path,\n   l.verification_status,l.rating,\n   zoi.public_listing_card_photo(card.media_input) AS photo_url,\n   CASE WHEN l.profile->>'hero_kind'='event_poster' AND zoi.public_listing_card_photo(card.media_input)=l.profile->>'hero_url' THEN 'event_poster' ELSE NULL END AS image_kind,\n   (l.owner_workspace_id IS NULL AND coalesce(l.claim_status,'unclaimed') NOT IN ('claimed','approved')) AS claimable,\n   page.name_relevance AS _sort_relevance,(page.verification_status='verified') AS _sort_verified,page.trust_score AS _sort_trust\n  FROM page JOIN zoi.listings l ON l.id=page.id\n  CROSS JOIN LATERAL (SELECT zoi.public_listing_card_input(l.id,l.website,l.photo_url,l.description,l.profile) AS media_input OFFSET 0) card\n  LEFT JOIN zoi.categories c ON c.id=l.primary_category_id\n ) r);\nEND;\n$function$\n",
    "volatility": "s",
    "security_definer": true
  },
  {
    "signature": "public.seo_entity(text)",
    "md5": "9006c7b304263fbd4d12e574e5698a7f",
    "owner": "postgres",
    "acl": "{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}",
    "config": [
      "search_path=\"\""
    ],
    "security_definer": true,
    "volatility": "s"
  },
  {
    "signature": "zoi.reviewed_food_public_context(zoi.listings)",
    "md5": "afd4c37cb7254b589924db8bb3e7fb99",
    "owner": "postgres",
    "acl": "{postgres=X/postgres}",
    "config": [
      "search_path=\"\""
    ],
    "security_definer": false,
    "volatility": "s"
  },
  {
    "signature": "enrich_sample_lease(uuid[])",
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
    "signature": "home_entity(text)",
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
  }
]$contracts$::jsonb)LOOP
  SELECT * INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure(e->>'signature');
  IF md5(pg_get_functiondef(p.oid))IS DISTINCT FROM e->>'md5' OR pg_get_userbyid(p.proowner)IS DISTINCT FROM e->>'owner' OR p.proacl::text IS DISTINCT FROM e->>'acl'
   OR to_jsonb(p.proconfig)IS DISTINCT FROM e->'config' OR p.prosecdef IS DISTINCT FROM(e->>'security_definer')::boolean OR p.provolatile::text IS DISTINCT FROM e->>'volatility' THEN RAISE EXCEPTION 'reviewed_duplicate_contract_drift:%',e->>'signature';END IF;
 END LOOP;
 IF (SELECT pg_get_triggerdef(oid)FROM pg_trigger WHERE tgrelid='zoi.listings'::regclass AND tgname='zz_maintain_seo_projection')IS DISTINCT FROM $trigger$CREATE TRIGGER zz_maintain_seo_projection AFTER INSERT OR UPDATE OF id, name, city, region, country, address, slug, entity_type, updated_at, created_at, phone, website, latitude, description, publish_status, moderation_status, marketplace_status ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.maintain_seo_projection()$trigger$ THEN RAISE EXCEPTION 'reviewed_duplicate_seo_trigger_drift';END IF;
 IF(SELECT jsonb_agg(jsonb_build_object('name',guard_tg.tgname,'trigger',pg_get_triggerdef(guard_tg.oid),'enabled',guard_tg.tgenabled::text,'signature',guard_proc.oid::regprocedure::text,'md5',md5(pg_get_functiondef(guard_proc.oid)),'owner',pg_get_userbyid(guard_proc.proowner),'acl',guard_proc.proacl::text,'config',guard_proc.proconfig,'security_definer',guard_proc.prosecdef,'volatility',guard_proc.provolatile)ORDER BY guard_tg.tgname)FROM pg_trigger guard_tg JOIN pg_proc guard_proc ON guard_proc.oid=guard_tg.tgfoid WHERE guard_tg.tgrelid='zoi.listings'::regclass AND NOT guard_tg.tgisinternal AND(guard_tg.tgtype&2)=2 AND(guard_tg.tgtype&16)=16)IS DISTINCT FROM '[{"name":"listing_quality_receipts_guard","trigger":"CREATE TRIGGER listing_quality_receipts_guard BEFORE INSERT OR UPDATE OF profile ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.guard_listing_quality_receipts()","enabled":"O","signature":"zoi.guard_listing_quality_receipts()","md5":"f0ebb7ba92e72b6bd34b43acc2676789","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"v"},{"name":"listings_aa_slug","trigger":"CREATE TRIGGER listings_aa_slug BEFORE INSERT OR UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.ensure_listing_slug()","enabled":"O","signature":"zoi.ensure_listing_slug()","md5":"86de5ced4bc9ae28b48240ee6b149323","owner":"postgres","acl":null,"config":["search_path=\"\""],"security_definer":false,"volatility":"v"},{"name":"listings_skip_noop","trigger":"CREATE TRIGGER listings_skip_noop BEFORE UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.skip_noop_listing_update()","enabled":"O","signature":"zoi.skip_noop_listing_update()","md5":"059ca37c376f88162bc84423c543b024","owner":"postgres","acl":null,"config":["search_path=zoi, public"],"security_definer":false,"volatility":"v"},{"name":"trg_listings_auto_seo","trigger":"CREATE TRIGGER trg_listings_auto_seo BEFORE INSERT OR UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.auto_seo_fill()","enabled":"O","signature":"zoi.auto_seo_fill()","md5":"f3f56fbc83395559e0b883f610182017","owner":"postgres","acl":null,"config":["search_path=\"\""],"security_definer":false,"volatility":"v"},{"name":"trg_listings_updated","trigger":"CREATE TRIGGER trg_listings_updated BEFORE UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.set_updated_at()","enabled":"O","signature":"zoi.set_updated_at()","md5":"1f8b6687e304c5f6502235344d4f0b7a","owner":"postgres","acl":null,"config":["search_path=\"\""],"security_definer":false,"volatility":"v"}]'::jsonb THEN RAISE EXCEPTION 'duplicate_before_update_trigger_contract_drift';END IF;
 IF(SELECT jsonb_build_object('md5',md5(pg_get_functiondef(guard_proc.oid)),'owner',pg_get_userbyid(guard_proc.proowner),'acl',guard_proc.proacl::text,'config',guard_proc.proconfig,'security_definer',guard_proc.prosecdef,'volatility',guard_proc.provolatile)FROM pg_proc guard_proc WHERE guard_proc.oid='zoi.schema_type(text,text)'::regprocedure)IS DISTINCT FROM '{"md5":"979e6dbac201900f10e2a1cdb7a4d226","owner":"postgres","acl":null,"config":["search_path=\"\""],"security_definer":false,"volatility":"i"}'::jsonb THEN RAISE EXCEPTION 'duplicate_trigger_helper_contract_drift:%','zoi.schema_type(text,text)';END IF;
 IF(SELECT jsonb_build_object('md5',md5(pg_get_functiondef(guard_proc.oid)),'owner',pg_get_userbyid(guard_proc.proowner),'acl',guard_proc.proacl::text,'config',guard_proc.proconfig,'security_definer',guard_proc.prosecdef,'volatility',guard_proc.provolatile)FROM pg_proc guard_proc WHERE guard_proc.oid='zoi.seo_pluralize(text)'::regprocedure)IS DISTINCT FROM '{"md5":"3a441e4585bf57f2b1da52a9c816029b","owner":"postgres","acl":null,"config":null,"security_definer":false,"volatility":"i"}'::jsonb THEN RAISE EXCEPTION 'duplicate_trigger_helper_contract_drift:%','zoi.seo_pluralize(text)';END IF;
 IF(SELECT jsonb_build_object('md5',md5(pg_get_functiondef(guard_proc.oid)),'owner',pg_get_userbyid(guard_proc.proowner),'acl',guard_proc.proacl::text,'config',guard_proc.proconfig,'security_definer',guard_proc.prosecdef,'volatility',guard_proc.provolatile)FROM pg_proc guard_proc WHERE guard_proc.oid='zoi.seo_slug(text)'::regprocedure)IS DISTINCT FROM '{"md5":"9b36fe6c6fabbe222376430aacf73323","owner":"postgres","acl":null,"config":null,"security_definer":false,"volatility":"i"}'::jsonb THEN RAISE EXCEPTION 'duplicate_trigger_helper_contract_drift:%','zoi.seo_slug(text)';END IF;

 -- The anti-semijoin is equivalent to the former positive join because this
 -- validated immediate FK prevents orphan keys; the existing selective status
 -- index avoids scanning every wide listing on anonymous sitemap requests.
 IF(SELECT jsonb_build_object('name',c.conname,'deferred',c.condeferred,'validated',c.convalidated,'deferrable',c.condeferrable,'definition',pg_get_constraintdef(c.oid))FROM pg_constraint c WHERE c.conrelid='zoi.seo_identity_keys'::regclass AND c.confrelid='zoi.listings'::regclass AND c.contype='f' AND c.conname='seo_identity_keys_listing_id_fkey')IS DISTINCT FROM '{"name":"seo_identity_keys_listing_id_fkey","deferred":false,"validated":true,"deferrable":false,"definition":"FOREIGN KEY (listing_id) REFERENCES zoi.listings(id) ON DELETE CASCADE"}'::jsonb THEN RAISE EXCEPTION 'duplicate_sitemap_foreign_key_contract_drift';END IF;
 IF(SELECT jsonb_agg(jsonb_build_object('name',ci.relname,'definition',pg_get_indexdef(ci.oid),'valid',i.indisvalid,'ready',i.indisready)ORDER BY ci.relname)FROM pg_index i JOIN pg_class ci ON ci.oid=i.indexrelid JOIN pg_namespace n ON n.oid=ci.relnamespace WHERE n.nspname='zoi'AND ci.relname IN('idx_zoi_listings_dupe','listings_pkey','seo_identity_keys_pkey'))IS DISTINCT FROM '[{"name":"idx_zoi_listings_dupe","definition":"CREATE INDEX idx_zoi_listings_dupe ON zoi.listings USING btree (duplicate_status)","valid":true,"ready":true},{"name":"listings_pkey","definition":"CREATE UNIQUE INDEX listings_pkey ON zoi.listings USING btree (id)","valid":true,"ready":true},{"name":"seo_identity_keys_pkey","definition":"CREATE UNIQUE INDEX seo_identity_keys_pkey ON zoi.seo_identity_keys USING btree (listing_id)","valid":true,"ready":true}]'::jsonb THEN RAISE EXCEPTION 'duplicate_sitemap_index_contract_drift';END IF;
END $guard$;
CREATE FUNCTION zoi.reviewed_duplicate_canonical_slug(p_slug text)RETURNS text
LANGUAGE plpgsql STABLE SET search_path='' AS $function$
DECLARE s zoi.listings;t zoi.listings;decision zoi.duplicate_candidates;history zoi.duplicate_candidates;proof jsonb;n integer:=0;withdrawals integer:=0;withdrawn_time timestamptz;valid_withdrawal boolean;
BEGIN
 -- Existing public slug readers can also resolve a literal listing ID without
 -- a new RPC. Invalid UUID text is never cast; private helper exposes only slug.
 IF p_slug~*'^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$' THEN SELECT * INTO s FROM zoi.listings WHERE id=p_slug::uuid;
 ELSE SELECT * INTO s FROM zoi.listings WHERE slug=p_slug;END IF;
 IF s.id IS NULL THEN RETURN NULL;END IF;
 -- Protocol orientation is explicit: A is source, B is canonical target.
 -- Key presence enrolls A even when its value is NULL/malformed or the decision
 -- is dismissed/revoked. An enrolled refusal must never fall back to source facts.
 FOR history IN SELECT * FROM zoi.duplicate_candidates
  WHERE listing_a_id=s.id AND match_signals ? 'reviewed_canonical'
 LOOP
  proof:=history.match_signals->'reviewed_canonical';
  valid_withdrawal:=false;
  IF history.status='dismissed' AND proof->>'state'='withdrawn'
   AND proof->>'schema'='1' AND proof->>'source_listing_id'=history.listing_a_id::text
   AND proof->>'canonical_listing_id'=history.listing_b_id::text
   AND proof->>'evidence_packet_sha256'~'^[a-f0-9]{64}$'
   AND proof->>'withdrawal_reason'='guarded_review_rollback'
   AND proof->>'withdrawn_by'='root-reviewed-identity-rollback-2026-10-15'
   AND proof->>'withdrawn_by'=history.resolved_by
   AND nullif(proof->>'withdrawn_at','') IS NOT NULL THEN
   BEGIN
    withdrawn_time:=(proof->>'withdrawn_at')::timestamptz;
    valid_withdrawal:=isfinite(withdrawn_time) AND withdrawn_time<=statement_timestamp();
   EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN valid_withdrawal:=false;END;
  END IF;
  IF valid_withdrawal THEN withdrawals:=withdrawals+1;
  ELSE n:=n+1;decision:=history;END IF;
 END LOOP;
 IF n=0 THEN
  IF withdrawals=0 OR s.duplicate_status IN('unique','primary_of_merge') THEN RETURN s.slug;END IF;
  RETURN NULL;
 END IF;
 IF n<>1 OR s.duplicate_status IS DISTINCT FROM 'confirmed_duplicate' OR decision.status IS DISTINCT FROM 'confirmed' THEN RETURN NULL;END IF;
 proof:=decision.match_signals->'reviewed_canonical';
 IF decision.listing_a_id IS DISTINCT FROM s.id OR proof ? 'state' THEN RETURN NULL;END IF;
 IF proof->>'schema' IS DISTINCT FROM '1' OR proof->>'source_listing_id' IS DISTINCT FROM s.id::text OR coalesce(decision.resolved_by,'')='' OR coalesce(proof->>'evidence_packet_sha256','')!~'^[a-f0-9]{64}$' THEN RETURN NULL;END IF;
 SELECT * INTO t FROM zoi.listings WHERE id=CASE WHEN decision.listing_a_id=s.id THEN decision.listing_b_id ELSE decision.listing_a_id END;
 IF t.id IS NULL OR t.id=s.id OR proof->>'canonical_listing_id' IS DISTINCT FROM t.id::text OR coalesce(t.duplicate_status,'') NOT IN('unique','primary_of_merge') THEN RETURN NULL;END IF;
 -- These are explicit reviewed business/vendor representations, not a global
 -- same-domain heuristic and not permission to cross an actual branch.
 IF coalesce(s.entity_type,'') NOT IN('business','vendor') OR coalesce(t.entity_type,'') NOT IN('business','vendor') OR s.primary_category_id IS NULL OR t.primary_category_id IS NULL OR s.primary_category_id IS DISTINCT FROM t.primary_category_id
  OR s.owner_user_id IS NOT NULL OR s.owner_workspace_id IS NOT NULL OR t.owner_user_id IS NOT NULL OR t.owner_workspace_id IS NOT NULL
  OR coalesce(s.claim_status,'unclaimed')<>'unclaimed' OR coalesce(t.claim_status,'unclaimed')<>'unclaimed'
  OR s.publish_status IS DISTINCT FROM 'published' OR t.publish_status IS DISTINCT FROM 'published'
  OR s.moderation_status NOT IN('clean','cleared') OR t.moderation_status NOT IN('clean','cleared') OR s.moderation_status IS NULL OR t.moderation_status IS NULL
  OR coalesce(s.marketplace_status,'')='hidden' OR coalesce(t.marketplace_status,'')='hidden' THEN RETURN NULL;END IF;
 IF proof->'source_context' IS DISTINCT FROM jsonb_build_object('listing_id',s.id,'name',s.name,'entity_type',s.entity_type,'website',s.website,'address',s.address,'city',s.city,'country',s.country,'primary_category_id',s.primary_category_id,'owner_user_id',s.owner_user_id,'owner_workspace_id',s.owner_workspace_id,'claim_status',s.claim_status,'source_url',s.source_url,'machine_authority',jsonb_build_object('source_url',s.profile#>'{_enrich,source_url}','source_identity',s.profile#>'{_enrich,source_identity}','address_parts',s.profile#>'{_enrich,address_parts}','identity_scope',s.profile#>'{_enrich,identity_scope}','source_kind',s.profile#>'{_enrich,source_kind}','blocked_reason',s.profile#>'{_enrich,blocked_reason}','scope_review_required',s.profile#>'{_enrich,scope_review_required}','organization_identity_quarantine',s.profile#>'{_enrich,organization_identity_quarantine}','source_scope_mismatch',s.profile#>'{_enrich,source_scope_mismatch}','source_affiliation',s.profile#>'{_enrich,source_affiliation}','blocked',s.profile#>'{_enrich,blocked}','source_challenge',s.profile#>'{_enrich,source_challenge}','challenge',s.profile#>'{_enrich,challenge}','member',s.profile#>'{_enrich,member}','association_member',s.profile#>'{_enrich,association_member}')) OR proof->'canonical_context' IS DISTINCT FROM jsonb_build_object('listing_id',t.id,'name',t.name,'entity_type',t.entity_type,'website',t.website,'address',t.address,'city',t.city,'country',t.country,'primary_category_id',t.primary_category_id,'owner_user_id',t.owner_user_id,'owner_workspace_id',t.owner_workspace_id,'claim_status',t.claim_status,'source_url',t.source_url,'machine_authority',jsonb_build_object('source_url',t.profile#>'{_enrich,source_url}','source_identity',t.profile#>'{_enrich,source_identity}','address_parts',t.profile#>'{_enrich,address_parts}','identity_scope',t.profile#>'{_enrich,identity_scope}','source_kind',t.profile#>'{_enrich,source_kind}','blocked_reason',t.profile#>'{_enrich,blocked_reason}','scope_review_required',t.profile#>'{_enrich,scope_review_required}','organization_identity_quarantine',t.profile#>'{_enrich,organization_identity_quarantine}','source_scope_mismatch',t.profile#>'{_enrich,source_scope_mismatch}','source_affiliation',t.profile#>'{_enrich,source_affiliation}','blocked',t.profile#>'{_enrich,blocked}','source_challenge',t.profile#>'{_enrich,source_challenge}','challenge',t.profile#>'{_enrich,challenge}','member',t.profile#>'{_enrich,member}','association_member',t.profile#>'{_enrich,association_member}')) THEN RETURN NULL;END IF;
 RETURN t.slug;
END $function$;
ALTER FUNCTION zoi.reviewed_duplicate_canonical_slug(text)OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.reviewed_duplicate_canonical_slug(text)FROM PUBLIC,anon,authenticated,service_role;
DO $patch$ DECLARE definition text;needle text;replacement text;trigger_definition text;BEGIN
 SELECT pg_get_functiondef('public.seo_entity(text)'::regprocedure)INTO STRICT definition;
 needle:=$old$l.slug=p_slug AND l.publish_status='published'$old$;
 replacement:=$new$l.slug=zoi.reviewed_duplicate_canonical_slug(p_slug) AND l.publish_status='published'$new$;
 IF length(definition)-length(replace(definition,needle,''))<>length(needle)THEN RAISE EXCEPTION 'reviewed_duplicate_public_anchor_drift';END IF;
 EXECUTE replace(definition,needle,replacement);
 SELECT pg_get_functiondef('zoi.seo_canonical_rows()'::regprocedure)INTO STRICT definition;
 needle:=$old$FROM zoi.seo_identity_keys k WHERE k.is_indexable$old$;
 replacement:=$new$FROM zoi.seo_identity_keys k WHERE k.is_indexable AND NOT EXISTS(SELECT 1 FROM zoi.listings l WHERE l.id=k.listing_id AND l.duplicate_status='confirmed_duplicate')$new$;
 IF length(definition)-length(replace(definition,needle,''))<>length(needle)THEN RAISE EXCEPTION 'reviewed_duplicate_sitemap_anchor_drift';END IF;
 EXECUTE replace(definition,needle,replacement);
 SELECT pg_get_functiondef('zoi.maintain_seo_projection()'::regprocedure)INTO STRICT definition;
 needle:=$old$AND coalesce(NEW.marketplace_status,'')<>'hidden'$old$;
 replacement:=$new$AND coalesce(NEW.marketplace_status,'')<>'hidden' AND NEW.duplicate_status IS DISTINCT FROM 'confirmed_duplicate'$new$;
 IF length(definition)-length(replace(definition,needle,''))<>length(needle)THEN RAISE EXCEPTION 'reviewed_duplicate_projection_anchor_drift';END IF;
 EXECUTE replace(definition,needle,replacement);
 SELECT pg_get_triggerdef(oid)INTO STRICT trigger_definition FROM pg_trigger WHERE tgrelid='zoi.listings'::regclass AND tgname='zz_maintain_seo_projection';
 needle:=$old$marketplace_status ON zoi.listings$old$;replacement:=$new$marketplace_status, duplicate_status ON zoi.listings$new$;
 IF length(trigger_definition)-length(replace(trigger_definition,needle,''))<>length(needle)THEN RAISE EXCEPTION 'reviewed_duplicate_trigger_anchor_drift';END IF;
 DROP TRIGGER zz_maintain_seo_projection ON zoi.listings;
 EXECUTE replace(trigger_definition,needle,replacement);
 -- Preserve the legacy map and both actual search branches for old consumers.
 SELECT pg_get_functiondef('public.explore_geo(text,text,text,text,integer)'::regprocedure)INTO STRICT definition;
 needle:=$old$AND COALESCE(l.marketplace_status,'')<>'hidden'$old$;
 replacement:=$new$AND COALESCE(l.marketplace_status,'')<>'hidden' AND l.duplicate_status IS DISTINCT FROM 'confirmed_duplicate'$new$;
 IF length(definition)-length(replace(definition,needle,''))<>length(needle)THEN RAISE EXCEPTION 'reviewed_duplicate_legacy_map_anchor_drift';END IF;
 EXECUTE replace(definition,needle,replacement);
 SELECT pg_get_functiondef('zoi.explore_default_page(integer,integer)'::regprocedure)INTO STRICT definition;
 needle:=$old$AND coalesce(duplicate.marketplace_status,'')<>'hidden'$old$;
 replacement:=$new$AND coalesce(duplicate.marketplace_status,'')<>'hidden' AND duplicate.duplicate_status IS DISTINCT FROM 'confirmed_duplicate'$new$;
 IF length(definition)-length(replace(definition,needle,''))<>length(needle)THEN RAISE EXCEPTION 'reviewed_duplicate_lateral_anchor_drift';END IF;
 definition:=replace(definition,needle,replacement);
 needle:=$old$AND coalesce(candidate.marketplace_status,'')<>'hidden'$old$;
 replacement:=$new$AND coalesce(candidate.marketplace_status,'')<>'hidden' AND candidate.duplicate_status IS DISTINCT FROM 'confirmed_duplicate'$new$;
 IF length(definition)-length(replace(definition,needle,''))<>length(needle)THEN RAISE EXCEPTION 'reviewed_duplicate_default_anchor_drift';END IF;
 EXECUTE replace(definition,needle,replacement);
 SELECT pg_get_functiondef('zoi.explore_search_before_default_page(text,text,text,text,integer,integer,text)'::regprocedure)INTO STRICT definition;
 needle:=$old$AND coalesce(l.marketplace_status,'')<>'hidden'$old$;
 replacement:=$new$AND coalesce(l.marketplace_status,'')<>'hidden' AND l.duplicate_status IS DISTINCT FROM 'confirmed_duplicate'$new$;
 IF length(definition)-length(replace(definition,needle,''))<>2*length(needle)THEN RAISE EXCEPTION 'reviewed_duplicate_search_anchors_drift';END IF;
 EXECUTE replace(definition,needle,replacement);
END $patch$;
