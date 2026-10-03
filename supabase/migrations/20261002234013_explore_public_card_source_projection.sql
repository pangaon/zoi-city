-- Separate candidate: lead applies only after source/owner and performance review.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$
DECLARE f record; signature text; expected_hash text;
BEGIN
 FOR signature,expected_hash IN SELECT * FROM (VALUES
  ('public.explore_search(text,text,text,text,integer,integer,text)','7fc2041a21a19e4c28f1f5a239d1750e'),
  ('public.explore_search_types(text,text[],text,text,integer,integer,text)','0cc6eb68a31a7d92f68b0e8da911bc70')
 ) AS expected(signature,body_hash) LOOP
  SELECT p.*,md5(pg_get_functiondef(p.oid)) AS body_hash INTO f FROM pg_proc p WHERE p.oid=to_regprocedure(signature);
  IF NOT FOUND OR f.body_hash<>expected_hash OR f.proowner<>'postgres'::regrole
   OR f.proacl IS DISTINCT FROM '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]
  THEN RAISE EXCEPTION 'explore_card_projection_prerequisite_changed'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('zoi.public_owner_content(uuid)') AND md5(pg_get_functiondef(p.oid))='132a50666860f8dee5d4f33b3a3fdfa0' AND p.proowner='postgres'::regrole AND p.proacl='{postgres=X/postgres}'::aclitem[])
  OR to_regprocedure('zoi.public_listing_card_input(uuid,text,text,text,jsonb)') IS NOT NULL
  OR to_regprocedure('zoi.public_listing_card_description(text,jsonb)') IS NOT NULL
  OR to_regprocedure('zoi.public_listing_card_source_bound(jsonb)') IS NOT NULL
  OR to_regprocedure('zoi.public_listing_card_image(text,boolean)') IS NOT NULL
  OR to_regprocedure('zoi.public_listing_card_photo(jsonb)') IS NOT NULL
 THEN RAISE EXCEPTION 'explore_card_projection_prerequisite_changed'; END IF;
END
$guard$;
-- Bounded, private per-page projection. No base listing mutation or new public RPC.
CREATE FUNCTION zoi.public_listing_card_input(p_id uuid,p_website text,p_photo text,p_description text,p_profile jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO '' AS $function$
DECLARE raw jsonb:=CASE WHEN jsonb_typeof(p_profile)='object' THEN p_profile ELSE '{}'::jsonb END;
 source jsonb; owner jsonb; layer jsonb; compact jsonb; compact_raw jsonb:='{}'::jsonb; compact_source jsonb:='{}'::jsonb; compact_owner jsonb:='{}'::jsonb;
 k text; v jsonb; i integer; compact_owner_profile jsonb:='{}'::jsonb;
BEGIN
 source:=CASE WHEN jsonb_typeof(raw->'_enrich')='object' THEN raw->'_enrich' ELSE '{}'::jsonb END;
 owner:=coalesce(zoi.public_owner_content(p_id),'{}'::jsonb);
 FOR i IN 1..4 LOOP
  layer:=CASE i WHEN 1 THEN raw WHEN 2 THEN source WHEN 3 THEN owner ELSE coalesce(owner->'profile','{}'::jsonb) END;
  compact:='{}'::jsonb;
  FOR k,v IN SELECT x.key,x.value FROM jsonb_each(layer) x WHERE x.key IN ('description','biography','bio','excerpt','photo_url','hero_url','hero_kind','logo_url','logo','business_type','website','source_url','source_kind','identity_scope','blocked_reason') LOOP
   compact:=compact||jsonb_build_object(k,CASE WHEN jsonb_typeof(v)='string' THEN CASE WHEN k IN ('description','biography','bio','excerpt') THEN to_jsonb(left(v#>>'{}',2000)) WHEN length(v#>>'{}')<=3000 THEN v ELSE 'null'::jsonb END ELSE 'null'::jsonb END);
  END LOOP;
  IF layer ? 'brand' AND (layer->'brand') ? 'logo' THEN
   compact:=compact||jsonb_build_object('brand',jsonb_build_object('logo',CASE WHEN jsonb_typeof(layer#>'{brand,logo}')='string' AND length(layer#>>'{brand,logo}')<=3000 THEN to_jsonb(left(layer#>>'{brand,logo}',3000)) ELSE 'null'::jsonb END));
  END IF;
  FOR k IN SELECT unnest(ARRAY['photos','photo_urls','gallery']) LOOP
   IF layer ? k THEN
    compact:=compact||jsonb_build_object(k,coalesce((SELECT jsonb_agg(to_jsonb(left(url,3000)) ORDER BY ordinality) FROM (SELECT CASE WHEN jsonb_typeof(a.value)='string' THEN a.value#>>'{}' ELSE a.value->>'url' END AS url,a.ordinality FROM jsonb_array_elements(CASE WHEN jsonb_typeof(layer->k)='array' THEN layer->k ELSE '[]'::jsonb END) WITH ORDINALITY a WHERE a.ordinality<=12) images WHERE url IS NOT NULL AND length(url)<=3000),'[]'::jsonb));
   END IF;
  END LOOP;
  IF i=1 THEN compact_raw:=compact;
  ELSIF i=2 THEN
   FOR k IN SELECT unnest(ARRAY['organization_identity_quarantine','scope_review_required','source_affiliation','association_member']) LOOP
    IF layer ? k THEN compact:=compact||jsonb_build_object(k,layer->k NOT IN ('null'::jsonb,'false'::jsonb,'""'::jsonb)); END IF;
   END LOOP;
   IF source#>'{member,affiliation}' IS NOT NULL THEN compact:=compact||jsonb_build_object('member',jsonb_build_object('affiliation',source#>'{member,affiliation}' NOT IN ('null'::jsonb,'false'::jsonb,'""'::jsonb))); END IF;
   IF source ? 'fields' THEN compact:=compact||jsonb_build_object('fields',coalesce((SELECT jsonb_object_agg(key,CASE WHEN jsonb_typeof(value)='string' AND length(value#>>'{}')<=3000 THEN value ELSE 'null'::jsonb END) FROM jsonb_each(CASE WHEN jsonb_typeof(source->'fields')='object' THEN source->'fields' ELSE '{}'::jsonb END) WHERE key IN('photo_url','hero_url','logo_url','logo')),'{}'::jsonb)); END IF;
   IF source ? 'photo_roles' THEN compact:=compact||jsonb_build_object('photo_roles',coalesce((SELECT jsonb_agg(jsonb_build_object('url',left(a.value->>'url',3000),'role',a.value->>'role') ORDER BY a.ordinality) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(source->'photo_roles')='array' THEN source->'photo_roles' ELSE '[]'::jsonb END) WITH ORDINALITY a WHERE a.ordinality<=12 AND a.value->>'role'='gallery_only' AND length(a.value->>'url')<=3000),'[]'::jsonb)); END IF;
   compact_source:=compact;
  ELSIF i=3 THEN compact_owner:=compact;
  ELSE compact_owner_profile:=compact;
  END IF;
 END LOOP;
 IF owner ? 'profile' THEN compact_owner:=compact_owner||jsonb_build_object('profile',compact_owner_profile); END IF;
 RETURN jsonb_build_object('website',CASE WHEN length(p_website)<=3000 THEN p_website ELSE NULL END,'photo_url',CASE WHEN length(p_photo)<=3000 THEN p_photo ELSE NULL END,'description',left(p_description,2000),'profile',compact_raw||jsonb_build_object('_enrich',compact_source),'owner_content',compact_owner);
END
$function$;
ALTER FUNCTION zoi.public_listing_card_input(uuid,text,text,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.public_listing_card_input(uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION zoi.public_listing_card_source_bound(p_input jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$
DECLARE raw jsonb:=p_input->'profile'; owner jsonb:=p_input->'owner_content'; op jsonb:=owner->'profile'; source jsonb:=raw->'_enrich';
 website text; source_url text; wa text; sa text; wp text; sp text; trusted boolean:=false;
BEGIN
 website:=CASE WHEN owner ? 'website' THEN owner->>'website' WHEN op ? 'website' THEN op->>'website' WHEN raw ? 'website' THEN raw->>'website' ELSE p_input->>'website' END;
 source_url:=source->>'source_url';
 IF website~*'^https?://[^/?#]+([/?#]|$)' AND source_url~*'^https?://[^/?#]+([/?#]|$)' THEN
  wa:=lower(substring(website FROM '(?i)^https?://([^/?#]+)'));sa:=lower(substring(source_url FROM '(?i)^https?://([^/?#]+)'));
  wa:=regexp_replace(regexp_replace(wa,'^www\.',''),CASE WHEN website~*'^https://' THEN ':443$' ELSE ':80$' END,'');sa:=regexp_replace(regexp_replace(sa,'^www\.',''),CASE WHEN source_url~*'^https://' THEN ':443$' ELSE ':80$' END,'');
  wp:=coalesce(nullif(substring(website FROM '(?i)^https?://[^/?#]+([^?#]*)'),''),'/');sp:=coalesce(nullif(substring(source_url FROM '(?i)^https?://[^/?#]+([^?#]*)'),''),'/');
  trusted:=position('@' IN wa)=0 AND position('@' IN sa)=0 AND wa=sa AND (wp='/' OR regexp_replace(wp,'/$','')=regexp_replace(sp,'/$',''));
 END IF;
 trusted:=trusted AND coalesce(source->>'source_kind','') NOT IN('association_directory','association_member') AND coalesce(source->>'identity_scope','')<>'organization' AND coalesce(source->>'blocked_reason','')<>'source_scope_mismatch'
  AND NOT coalesce((source->>'organization_identity_quarantine')::boolean,false) AND NOT coalesce((source->>'scope_review_required')::boolean,false)
  AND NOT coalesce((source->>'source_affiliation')::boolean,false) AND NOT coalesce((source->>'association_member')::boolean,false) AND NOT coalesce((source#>>'{member,affiliation}')::boolean,false);
 RETURN trusted;
END
$function$;
ALTER FUNCTION zoi.public_listing_card_source_bound(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.public_listing_card_source_bound(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION zoi.public_listing_card_description(p_type text,p_input jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$
DECLARE raw jsonb:=p_input->'profile'; owner jsonb:=p_input->'owner_content'; op jsonb:=owner->'profile'; source jsonb:=raw->'_enrich';
 website text; source_url text; wa text; sa text; wp text; sp text; trusted boolean:=false; machine text; value text; layer jsonb;
BEGIN
 FOREACH layer IN ARRAY ARRAY[owner,op,raw] LOOP
  IF layer ? 'description' THEN RETURN left(coalesce(layer->>'description',''),170); END IF;
 END LOOP;
 trusted:=zoi.public_listing_card_source_bound(p_input);
 machine:=CASE WHEN trusted THEN coalesce(nullif(source->>'description',''),nullif(source->>'biography',''),nullif(source->>'bio',''),nullif(source->>'excerpt',''),'') ELSE '' END;
 value:=CASE WHEN p_type='artist' THEN coalesce(nullif(machine,''),p_input->>'description','') ELSE coalesce(nullif(p_input->>'description',''),machine,'') END;
 RETURN left(value,170);
END
$function$;
ALTER FUNCTION zoi.public_listing_card_description(text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.public_listing_card_description(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION zoi.public_listing_card_image(p_value text,p_explicit boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$
DECLARE url text:=btrim(p_value); authority text; path text;
BEGIN
 IF url IS NULL OR length(url)>3000 OR url!~*'^https://[^/?#[:space:]]+' THEN RETURN NULL; END IF;
 authority:=substring(url FROM '(?i)^https://([^/?#]+)');
 IF position('@' IN authority)>0 THEN RETURN NULL; END IF;
 IF p_explicit THEN RETURN url; END IF;
 path:=coalesce(substring(url FROM '(?i)^https://[^/?#]+([^?#]*)'),'');
 IF path IN('','/') AND url!~'\?' THEN RETURN NULL; END IF;
 IF path~*'(?:^|[/[:space:]_.+-])(?:(?:web[-_]?)?logos?|advert(?:isement)?|anzeige|flyer|poster|icon|avatar|sprite|pixel|tracking|favicon|badge|food[-_]rating|app[-_]?store|google[-_]?play|payment|placeholder)(?:[/[:space:]_.+-]|$)'
  OR path~*'/(?:apple|google|top|bottom|blue(?:[-_]left)?)(?:[-_]\d+w)?\.(?:png|svg|webp)$'
  OR path~*'/wp-content/plugins/(?:qtranslate(?:-x)?|polylang|wpglobus|sitepress-multilingual-cms)/(?:[^/]+/)*flags?/'
  OR url~*'^https://(?:lh\d+\.)?googleusercontent\.com/(?:a|a-)/'
  OR url~*'^https://(?:[a-z0-9-]+\.)?gravatar\.com/avatar/'
  OR url~*'^https://maps\.googleapis\.com/maps/api/staticmap(?:[/?]|$)'
  OR url~*'^https://(?:[a-z0-9-]+\.)?tile\.openstreetmap\.org/'
  OR url~*'^https://api\.mapbox\.com/styles/v1/[^?]+/static/'
  OR path~*'/maps/[^?#]+/\d+/\d+\.(?:png|jpe?g|webp)$'
 THEN RETURN NULL; END IF;
 RETURN url;
END
$function$;
ALTER FUNCTION zoi.public_listing_card_image(text,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.public_listing_card_image(text,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION zoi.public_listing_card_photo(p_input jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$
DECLARE raw jsonb:=p_input->'profile'; owner jsonb:=p_input->'owner_content'; op jsonb:=owner->'profile'; source jsonb:=raw->'_enrich';
 layer jsonb; k text; selected_url text; gallery jsonb; explicit_gallery boolean:=false; trusted boolean:=zoi.public_listing_card_source_bound(p_input);
BEGIN
 FOREACH layer IN ARRAY ARRAY[owner,op,raw] LOOP
  FOREACH k IN ARRAY ARRAY['photo_url','hero_url'] LOOP
   IF layer ? k THEN RETURN zoi.public_listing_card_image(layer->>k,true); END IF;
  END LOOP;
 END LOOP;
 FOREACH layer IN ARRAY ARRAY[op,owner,raw] LOOP
  FOREACH k IN ARRAY ARRAY['photo_urls','photos','gallery'] LOOP
   IF layer ? k THEN gallery:=layer->k;explicit_gallery:=true;EXIT; END IF;
  END LOOP;
  EXIT WHEN explicit_gallery;
 END LOOP;
 IF trusted OR (coalesce(source->>'source_url','')='' AND coalesce(source->>'source_kind','') NOT IN('association_directory','association_member') AND coalesce(source->>'identity_scope','')<>'organization' AND coalesce(source->>'blocked_reason','')<>'source_scope_mismatch' AND NOT coalesce((source->>'organization_identity_quarantine')::boolean,false) AND NOT coalesce((source->>'scope_review_required')::boolean,false) AND NOT coalesce((source->>'source_affiliation')::boolean,false) AND NOT coalesce((source->>'association_member')::boolean,false) AND NOT coalesce((source#>>'{member,affiliation}')::boolean,false)) THEN
  selected_url:=zoi.public_listing_card_image(p_input->>'photo_url');IF selected_url IS NOT NULL AND (explicit_gallery OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(source->'photo_roles','[]')) AS r(role) WHERE r.role->>'url'=selected_url AND r.role->>'role'='gallery_only')) THEN RETURN selected_url; END IF;
 END IF;
 IF trusted THEN
  FOREACH selected_url IN ARRAY ARRAY[source->>'hero_url',source->>'photo_url',source#>>'{fields,hero_url}',source#>>'{fields,photo_url}'] LOOP
   selected_url:=zoi.public_listing_card_image(selected_url);
   IF selected_url IS NOT NULL AND (explicit_gallery OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(source->'photo_roles','[]')) AS r(role) WHERE r.role->>'url'=selected_url AND r.role->>'role'='gallery_only')) THEN RETURN selected_url; END IF;
  END LOOP;
 END IF;
 IF NOT explicit_gallery AND trusted THEN gallery:=coalesce(source->'photo_urls',source->'photos','[]'); END IF;
 FOR selected_url IN SELECT a.value#>>'{}' FROM jsonb_array_elements(coalesce(gallery,'[]')) a LOOP
  selected_url:=zoi.public_listing_card_image(selected_url);
  IF selected_url IS NOT NULL AND (explicit_gallery OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(source->'photo_roles','[]')) AS r(role) WHERE r.role->>'url'=selected_url AND r.role->>'role'='gallery_only')) THEN RETURN selected_url; END IF;
 END LOOP;
 RETURN NULL;
END
$function$;
ALTER FUNCTION zoi.public_listing_card_photo(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.public_listing_card_photo(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.explore_search_types(p_q text DEFAULT NULL::text, p_types text[] DEFAULT NULL::text[], p_city text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0, p_region text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET plan_cache_mode TO 'force_custom_plan'
AS $function$
DECLARE v_q text:=lower(btrim(coalesce(p_q,'')));
 v_pattern text:='%'||replace(replace(replace(v_q,chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_')||'%';
BEGIN
 IF p_types IS NOT NULL THEN
  IF cardinality(p_types)>32 OR coalesce(array_ndims(p_types),1)<>1 OR EXISTS(SELECT 1 FROM unnest(p_types) AS t(value) WHERE value IS NULL OR value!~'^[a-z][a-z_]{0,39}$') THEN RAISE EXCEPTION 'invalid_search_types' USING errcode='22023';END IF;
  IF cardinality(p_types)=0 THEN RETURN '[]'::jsonb;END IF;
 END IF;
 -- Only literal nonempty city filters take the bounded locality-first path.
 -- Pattern and escape semantics continue through the original global query.
 IF p_city IS NOT NULL AND p_city<>'' AND strpos(p_city,'%')=0
  AND strpos(p_city,'_')=0 AND strpos(p_city,chr(92))=0 THEN
 RETURN (WITH locality AS MATERIALIZED (
  SELECT l.id,l.name,l.verification_status,l.trust_score,l.city,l.country,l.entity_type,
   l.search_tsv,l.region,l.region_native,l.region_code
  FROM zoi.listings l
  WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
   AND coalesce(l.marketplace_status,'')<>'hidden'
   AND lower(l.city)=lower(p_city) AND l.city ILIKE p_city
   AND (p_types IS NULL OR l.entity_type=ANY(p_types))
   AND (p_country IS NULL OR p_country='' OR zoi.geo_country_canon(l.country) ILIKE p_country)
   AND (p_country IS NULL OR p_country='' OR strpos(p_country,'%')>0 OR strpos(p_country,'_')>0
    OR strpos(p_country,chr(92))>0 OR lower(zoi.geo_country_canon(l.country))=lower(p_country))
   AND (p_region IS NULL OR p_region='' OR l.region ILIKE p_region
    OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))
 ), ranked AS NOT MATERIALIZED (
  SELECT l.id,l.name,l.verification_status,l.trust_score,
   CASE WHEN v_q='' THEN 0 WHEN lower(btrim(l.name))=v_q THEN 0
    WHEN left(lower(btrim(l.name)),length(v_q))=v_q THEN 1
    WHEN v_q=ANY(regexp_split_to_array(lower(l.name),'[^[:alnum:]_]+')) THEN 2
    WHEN strpos(lower(l.name),v_q)>0 THEN 3 ELSE 4 END AS name_relevance,
   row_number() OVER (
    PARTITION BY lower(trim(coalesce(l.name,''))),lower(trim(coalesce(l.city,''))),
     lower(trim(coalesce(zoi.geo_country_canon(l.country),'')))
    ORDER BY (l.verification_status='verified') DESC,l.trust_score DESC NULLS LAST,
     CASE l.entity_type WHEN 'creator' THEN 0 WHEN 'artist' THEN 1 WHEN 'business' THEN 2 ELSE 3 END,
     l.name,l.id
   ) AS dedupe_rank
  FROM locality l
  WHERE (v_q='' OR l.search_tsv @@ plainto_tsquery('simple',v_q)
    OR lower(l.name) LIKE v_pattern OR lower(l.region) LIKE v_pattern
    OR lower(l.region_native) LIKE v_pattern)
   AND (p_types IS NULL OR l.entity_type=ANY(p_types))
   AND (p_city IS NULL OR p_city='' OR l.city ILIKE p_city)
   AND (p_country IS NULL OR p_country='' OR zoi.geo_country_canon(l.country) ILIKE p_country)
   AND (p_region IS NULL OR p_region='' OR l.region ILIKE p_region
    OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))
 ), page AS MATERIALIZED (
  SELECT id,name,verification_status,trust_score,name_relevance
  FROM ranked WHERE dedupe_rank=1
  ORDER BY name_relevance,(verification_status='verified') DESC,trust_score DESC NULLS LAST,name,id
  LIMIT least(greatest(p_limit,1),48) OFFSET greatest(p_offset,0)
 )
 SELECT coalesce(jsonb_agg(to_jsonb(r)-'_sort_verified'-'_sort_trust'-'_sort_relevance'
  ORDER BY r._sort_relevance,r._sort_verified DESC,r._sort_trust DESC NULLS LAST,r.name,r.id),'[]'::jsonb)
 FROM (
  SELECT l.id,l.slug,l.name,
   zoi.public_listing_card_description(l.entity_type,card.media_input) AS description,
   card.media_input,
   c.label_en AS category,l.entity_type,l.city,zoi.geo_country_canon(l.country) AS country,
   l.region,l.region_code,l.region_native,
   '/'||replace(l.entity_type,'travel_place','travel-place')||'/'||l.slug AS path,
   l.verification_status,l.rating,
   zoi.public_listing_card_photo(card.media_input) AS photo_url,
   CASE WHEN l.profile->>'hero_kind'='event_poster' AND zoi.public_listing_card_photo(card.media_input)=l.profile->>'hero_url' THEN 'event_poster' ELSE NULL END AS image_kind,
   (l.owner_workspace_id IS NULL AND coalesce(l.claim_status,'unclaimed') NOT IN ('claimed','approved')) AS claimable,
   page.name_relevance AS _sort_relevance,(page.verification_status='verified') AS _sort_verified,page.trust_score AS _sort_trust
  FROM page JOIN zoi.listings l ON l.id=page.id
  CROSS JOIN LATERAL (SELECT zoi.public_listing_card_input(l.id,l.website,l.photo_url,l.description,l.profile) AS media_input OFFSET 0) card
  LEFT JOIN zoi.categories c ON c.id=l.primary_category_id
 ) r);
 END IF;
 RETURN (WITH ranked AS NOT MATERIALIZED (
  SELECT l.id,l.name,l.verification_status,l.trust_score,
   CASE WHEN v_q='' THEN 0 WHEN lower(btrim(l.name))=v_q THEN 0
    WHEN left(lower(btrim(l.name)),length(v_q))=v_q THEN 1
    WHEN v_q=ANY(regexp_split_to_array(lower(l.name),'[^[:alnum:]_]+')) THEN 2
    WHEN strpos(lower(l.name),v_q)>0 THEN 3 ELSE 4 END AS name_relevance,
   row_number() OVER (
    PARTITION BY lower(trim(coalesce(l.name,''))),lower(trim(coalesce(l.city,''))),
     lower(trim(coalesce(zoi.geo_country_canon(l.country),'')))
    ORDER BY (l.verification_status='verified') DESC,l.trust_score DESC NULLS LAST,
     CASE l.entity_type WHEN 'creator' THEN 0 WHEN 'artist' THEN 1 WHEN 'business' THEN 2 ELSE 3 END,
     l.name,l.id
   ) AS dedupe_rank
  FROM zoi.listings l
  WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
   AND coalesce(l.marketplace_status,'')<>'hidden'
   AND (v_q='' OR l.search_tsv @@ plainto_tsquery('simple',v_q)
    OR lower(l.name) LIKE v_pattern OR lower(l.region) LIKE v_pattern
    OR lower(l.region_native) LIKE v_pattern)
   AND (p_types IS NULL OR l.entity_type=ANY(p_types))
   AND (p_city IS NULL OR p_city='' OR l.city ILIKE p_city)
   AND (p_country IS NULL OR p_country='' OR zoi.geo_country_canon(l.country) ILIKE p_country)
   AND (p_region IS NULL OR p_region='' OR l.region ILIKE p_region
    OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))
 ), page AS MATERIALIZED (
  SELECT id,name,verification_status,trust_score,name_relevance
  FROM ranked WHERE dedupe_rank=1
  ORDER BY name_relevance,(verification_status='verified') DESC,trust_score DESC NULLS LAST,name,id
  LIMIT least(greatest(p_limit,1),48) OFFSET greatest(p_offset,0)
 )
 SELECT coalesce(jsonb_agg(to_jsonb(r)-'_sort_verified'-'_sort_trust'-'_sort_relevance'
  ORDER BY r._sort_relevance,r._sort_verified DESC,r._sort_trust DESC NULLS LAST,r.name,r.id),'[]'::jsonb)
 FROM (
  SELECT l.id,l.slug,l.name,
   zoi.public_listing_card_description(l.entity_type,card.media_input) AS description,
   card.media_input,
   c.label_en AS category,l.entity_type,l.city,zoi.geo_country_canon(l.country) AS country,
   l.region,l.region_code,l.region_native,
   '/'||replace(l.entity_type,'travel_place','travel-place')||'/'||l.slug AS path,
   l.verification_status,l.rating,
   zoi.public_listing_card_photo(card.media_input) AS photo_url,
   CASE WHEN l.profile->>'hero_kind'='event_poster' AND zoi.public_listing_card_photo(card.media_input)=l.profile->>'hero_url' THEN 'event_poster' ELSE NULL END AS image_kind,
   (l.owner_workspace_id IS NULL AND coalesce(l.claim_status,'unclaimed') NOT IN ('claimed','approved')) AS claimable,
   page.name_relevance AS _sort_relevance,(page.verification_status='verified') AS _sort_verified,page.trust_score AS _sort_trust
  FROM page JOIN zoi.listings l ON l.id=page.id
  CROSS JOIN LATERAL (SELECT zoi.public_listing_card_input(l.id,l.website,l.photo_url,l.description,l.profile) AS media_input OFFSET 0) card
  LEFT JOIN zoi.categories c ON c.id=l.primary_category_id
 ) r);
END;
$function$;

CREATE OR REPLACE FUNCTION public.explore_search(p_q text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0, p_region text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET plan_cache_mode TO 'force_custom_plan'
AS $function$
DECLARE v_q text:=lower(btrim(coalesce(p_q,'')));
 v_pattern text:='%'||replace(replace(replace(v_q,chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_')||'%';
BEGIN
 -- Only literal nonempty city filters take the bounded locality-first path.
 -- Pattern and escape semantics continue through the original global query.
 IF p_city IS NOT NULL AND p_city<>'' AND strpos(p_city,'%')=0
  AND strpos(p_city,'_')=0 AND strpos(p_city,chr(92))=0 THEN
 RETURN (WITH locality AS MATERIALIZED (
  SELECT l.id,l.name,l.verification_status,l.trust_score,l.city,l.country,l.entity_type,
   l.search_tsv,l.region,l.region_native,l.region_code
  FROM zoi.listings l
  WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
   AND coalesce(l.marketplace_status,'')<>'hidden'
   AND lower(l.city)=lower(p_city) AND l.city ILIKE p_city
   AND (p_type IS NULL OR p_type='' OR l.entity_type=p_type)
   AND (p_country IS NULL OR p_country='' OR zoi.geo_country_canon(l.country) ILIKE p_country)
   AND (p_country IS NULL OR p_country='' OR strpos(p_country,'%')>0 OR strpos(p_country,'_')>0
    OR strpos(p_country,chr(92))>0 OR lower(zoi.geo_country_canon(l.country))=lower(p_country))
   AND (p_region IS NULL OR p_region='' OR l.region ILIKE p_region
    OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))
 ), ranked AS NOT MATERIALIZED (
  SELECT l.id,l.name,l.verification_status,l.trust_score,
   CASE WHEN v_q='' THEN 0 WHEN lower(btrim(l.name))=v_q THEN 0
    WHEN left(lower(btrim(l.name)),length(v_q))=v_q THEN 1
    WHEN v_q=ANY(regexp_split_to_array(lower(l.name),'[^[:alnum:]_]+')) THEN 2
    WHEN strpos(lower(l.name),v_q)>0 THEN 3 ELSE 4 END AS name_relevance,
   row_number() OVER (
    PARTITION BY lower(trim(coalesce(l.name,''))),lower(trim(coalesce(l.city,''))),
     lower(trim(coalesce(zoi.geo_country_canon(l.country),'')))
    ORDER BY (l.verification_status='verified') DESC,l.trust_score DESC NULLS LAST,
     CASE l.entity_type WHEN 'creator' THEN 0 WHEN 'artist' THEN 1 WHEN 'business' THEN 2 ELSE 3 END,
     l.name,l.id
   ) AS dedupe_rank
  FROM locality l
  WHERE (v_q='' OR l.search_tsv @@ plainto_tsquery('simple',v_q)
    OR lower(l.name) LIKE v_pattern OR lower(l.region) LIKE v_pattern
    OR lower(l.region_native) LIKE v_pattern)
   AND (p_type IS NULL OR p_type='' OR l.entity_type=p_type)
   AND (p_city IS NULL OR p_city='' OR l.city ILIKE p_city)
   AND (p_country IS NULL OR p_country='' OR zoi.geo_country_canon(l.country) ILIKE p_country)
   AND (p_region IS NULL OR p_region='' OR l.region ILIKE p_region
    OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))
 ), page AS MATERIALIZED (
  SELECT id,name,verification_status,trust_score,name_relevance
  FROM ranked WHERE dedupe_rank=1
  ORDER BY name_relevance,(verification_status='verified') DESC,trust_score DESC NULLS LAST,name,id
  LIMIT least(greatest(p_limit,1),48) OFFSET greatest(p_offset,0)
 )
 SELECT coalesce(jsonb_agg(to_jsonb(r)-'_sort_verified'-'_sort_trust'-'_sort_relevance'
  ORDER BY r._sort_relevance,r._sort_verified DESC,r._sort_trust DESC NULLS LAST,r.name,r.id),'[]'::jsonb)
 FROM (
  SELECT l.id,l.slug,l.name,
   zoi.public_listing_card_description(l.entity_type,card.media_input) AS description,
   card.media_input,
   c.label_en AS category,l.entity_type,l.city,zoi.geo_country_canon(l.country) AS country,
   l.region,l.region_code,l.region_native,
   '/'||replace(l.entity_type,'travel_place','travel-place')||'/'||l.slug AS path,
   l.verification_status,l.rating,
   zoi.public_listing_card_photo(card.media_input) AS photo_url,
   CASE WHEN l.profile->>'hero_kind'='event_poster' AND zoi.public_listing_card_photo(card.media_input)=l.profile->>'hero_url' THEN 'event_poster' ELSE NULL END AS image_kind,
   (l.owner_workspace_id IS NULL AND coalesce(l.claim_status,'unclaimed') NOT IN ('claimed','approved')) AS claimable,
   page.name_relevance AS _sort_relevance,(page.verification_status='verified') AS _sort_verified,page.trust_score AS _sort_trust
  FROM page JOIN zoi.listings l ON l.id=page.id
  CROSS JOIN LATERAL (SELECT zoi.public_listing_card_input(l.id,l.website,l.photo_url,l.description,l.profile) AS media_input OFFSET 0) card
  LEFT JOIN zoi.categories c ON c.id=l.primary_category_id
 ) r);
 END IF;
 RETURN (WITH ranked AS NOT MATERIALIZED (
  SELECT l.id,l.name,l.verification_status,l.trust_score,
   CASE WHEN v_q='' THEN 0 WHEN lower(btrim(l.name))=v_q THEN 0
    WHEN left(lower(btrim(l.name)),length(v_q))=v_q THEN 1
    WHEN v_q=ANY(regexp_split_to_array(lower(l.name),'[^[:alnum:]_]+')) THEN 2
    WHEN strpos(lower(l.name),v_q)>0 THEN 3 ELSE 4 END AS name_relevance,
   row_number() OVER (
    PARTITION BY lower(trim(coalesce(l.name,''))),lower(trim(coalesce(l.city,''))),
     lower(trim(coalesce(zoi.geo_country_canon(l.country),'')))
    ORDER BY (l.verification_status='verified') DESC,l.trust_score DESC NULLS LAST,
     CASE l.entity_type WHEN 'creator' THEN 0 WHEN 'artist' THEN 1 WHEN 'business' THEN 2 ELSE 3 END,
     l.name,l.id
   ) AS dedupe_rank
  FROM zoi.listings l
  WHERE l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
   AND coalesce(l.marketplace_status,'')<>'hidden'
   AND (v_q='' OR l.search_tsv @@ plainto_tsquery('simple',v_q)
    OR lower(l.name) LIKE v_pattern OR lower(l.region) LIKE v_pattern
    OR lower(l.region_native) LIKE v_pattern)
   AND (p_type IS NULL OR p_type='' OR l.entity_type=p_type)
   AND (p_city IS NULL OR p_city='' OR l.city ILIKE p_city)
   AND (p_country IS NULL OR p_country='' OR zoi.geo_country_canon(l.country) ILIKE p_country)
   AND (p_region IS NULL OR p_region='' OR l.region ILIKE p_region
    OR l.region_native ILIKE p_region OR upper(l.region_code)=upper(p_region))
 ), page AS MATERIALIZED (
  SELECT id,name,verification_status,trust_score,name_relevance
  FROM ranked WHERE dedupe_rank=1
  ORDER BY name_relevance,(verification_status='verified') DESC,trust_score DESC NULLS LAST,name,id
  LIMIT least(greatest(p_limit,1),48) OFFSET greatest(p_offset,0)
 )
 SELECT coalesce(jsonb_agg(to_jsonb(r)-'_sort_verified'-'_sort_trust'-'_sort_relevance'
  ORDER BY r._sort_relevance,r._sort_verified DESC,r._sort_trust DESC NULLS LAST,r.name,r.id),'[]'::jsonb)
 FROM (
  SELECT l.id,l.slug,l.name,
   zoi.public_listing_card_description(l.entity_type,card.media_input) AS description,
   card.media_input,
   c.label_en AS category,l.entity_type,l.city,zoi.geo_country_canon(l.country) AS country,
   l.region,l.region_code,l.region_native,
   '/'||replace(l.entity_type,'travel_place','travel-place')||'/'||l.slug AS path,
   l.verification_status,l.rating,
   zoi.public_listing_card_photo(card.media_input) AS photo_url,
   CASE WHEN l.profile->>'hero_kind'='event_poster' AND zoi.public_listing_card_photo(card.media_input)=l.profile->>'hero_url' THEN 'event_poster' ELSE NULL END AS image_kind,
   (l.owner_workspace_id IS NULL AND coalesce(l.claim_status,'unclaimed') NOT IN ('claimed','approved')) AS claimable,
   page.name_relevance AS _sort_relevance,(page.verification_status='verified') AS _sort_verified,page.trust_score AS _sort_trust
  FROM page JOIN zoi.listings l ON l.id=page.id
  CROSS JOIN LATERAL (SELECT zoi.public_listing_card_input(l.id,l.website,l.photo_url,l.description,l.profile) AS media_input OFFSET 0) card
  LEFT JOIN zoi.categories c ON c.id=l.primary_category_id
 ) r);
END;
$function$;

COMMIT;
