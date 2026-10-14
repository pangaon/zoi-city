BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Refuse to replace a changed API, owner, return contract or privilege surface.
DO $prerequisites$ DECLARE p pg_proc; grants text[]; BEGIN
 SELECT * INTO STRICT p FROM pg_proc WHERE oid='public.explore_geo(integer,integer)'::regprocedure;
 SELECT array_agg(coalesce(r.rolname,'PUBLIC')||':'||a.is_grantable::text ORDER BY coalesce(r.rolname,'PUBLIC')) INTO grants
 FROM aclexplode(p.proacl) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE';
 IF md5(pg_get_functiondef(p.oid)) IS DISTINCT FROM '41ce05085c701536e06d3ef7303c6304'
 OR pg_get_userbyid(p.proowner) IS DISTINCT FROM 'postgres'
 OR pg_get_function_result(p.oid) IS DISTINCT FROM 'TABLE(slug text, entity_type text, name text, city text, country text, category_slug text, lat double precision, lng double precision, geo_precision text, address text)'
 OR grants IS DISTINCT FROM ARRAY['anon:false','authenticated:false','postgres:false','service_role:false']::text[]
 THEN RAISE EXCEPTION 'public_geo_source_contract_prerequisites_changed';END IF;
END $prerequisites$;
-- Durable source method takes precedence over an accidentally precise legacy label.
CREATE OR REPLACE FUNCTION zoi.geo_effective_precision(p_column text,p_geo jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE
 WHEN lower(btrim(p_geo->>'method')) ~ '^[[:space:]]*(city|town|village)[[:space:]]+(centroid|centre|center)[[:space:]]*$' THEN 'city'
 WHEN lower(btrim(p_geo->>'method')) ~ '^[[:space:]]*(country|region)[[:space:]]+(centroid|centre|center)[[:space:]]*$' THEN 'region'
 ELSE CASE WHEN zoi.geo_precision_canon(p_column)='unknown' THEN zoi.geo_precision_canon(p_geo->>'precision') ELSE zoi.geo_precision_canon(p_column) END END
$$;
REVOKE ALL ON FUNCTION zoi.geo_effective_precision(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION zoi.geo_effective_precision(text,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.geography_reviewed_point(p_listing uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('listing_id',l.id,'request_id',r.request_id,
 'latitude',l.latitude,'longitude',l.longitude,'precision',l.geo_precision)
 FROM zoi.listings l JOIN zoi.geography_reviews r ON r.listing_id=l.id
 WHERE l.id=p_listing AND l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
 AND l.marketplace_status IS DISTINCT FROM 'hidden'
 AND l.owner_user_id IS NULL AND l.owner_workspace_id IS NULL
 AND r.reverted_at IS NULL AND r.after_fingerprint=zoi.geography_fingerprint(l)
 AND l.profile->'_geo'->>'request_id'=r.request_id::text
 AND r.receipt->>'listing_id'=l.id::text AND r.receipt->>'request_id'=r.request_id::text
 AND r.receipt->'latitude'=to_jsonb(l.latitude) AND r.receipt->'longitude'=to_jsonb(l.longitude)
 AND r.receipt->>'precision'=l.geo_precision AND l.geo_precision='street'
 ORDER BY r.created_at DESC LIMIT 1
$$;
-- Changing the return shape requires recreation. Preserve named-role grants exactly.
CREATE TEMP TABLE map_geo_acl ON COMMIT DROP AS
 SELECT a.grantee,a.is_grantable FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
 WHERE p.oid='public.explore_geo(integer,integer)'::regprocedure AND a.privilege_type='EXECUTE';
DROP FUNCTION public.explore_geo(integer,integer);
CREATE FUNCTION public.explore_geo(p_limit integer DEFAULT 5000,p_offset integer DEFAULT 0)
RETURNS TABLE(slug text,entity_type text,name text,city text,country text,category_slug text,
 lat double precision,lng double precision,geo_precision text,address text,
 id uuid,geo_metadata jsonb,reviewed_destination jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT e.slug::text,e.entity_type::text,e.name::text,e.city::text,zoi.geo_country_canon(e.country)::text,e.category_slug::text,
 e.latitude::double precision,e.longitude::double precision,zoi.geo_effective_precision(l.geo_precision::text,l.profile->'_geo'),l.address::text,e.id,
 jsonb_strip_nulls(jsonb_build_object(
 'method',left(regexp_replace(l.profile->'_geo'->>'method','[^[:alnum:] _-]','','g'),120),
 'precision',left(regexp_replace(l.profile->'_geo'->>'precision','[^[:alnum:] _-]','','g'),40),
 -- Only provider identifiers are public; arbitrary URLs can contain private material.
 'source',CASE WHEN l.profile->'_geo'->>'source' ~ '^[a-zA-Z0-9 _-]{1,80}$' THEN l.profile->'_geo'->>'source' END,
 'geocoded_at',CASE WHEN l.profile->'_geo'->>'geocoded_at' ~ '^\d{4}-\d{2}-\d{2}([T ][0-9:.+Z-]+)?$' THEN left(l.profile->'_geo'->>'geocoded_at',40) END)),
 CASE WHEN zoi.geo_effective_precision(l.geo_precision::text,l.profile->'_geo')='street'
 AND nullif(l.profile->'_geo'->>'request_id','') IS NOT NULL
 THEN public.geography_reviewed_point(e.id) END
 FROM zoi.v_public_listings e JOIN zoi.listings l ON l.id=e.id
 WHERE e.latitude IS NOT NULL AND e.longitude IS NOT NULL
 AND l.publish_status='published' AND coalesce(l.marketplace_status,'')<>'hidden'
 ORDER BY e.id LIMIT LEAST(GREATEST(COALESCE(p_limit,5000),1),5000)
 OFFSET GREATEST(COALESCE(p_offset,0),0)
$$;
ALTER FUNCTION public.explore_geo(integer,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.explore_geo(integer,integer) FROM PUBLIC;
DO $$ DECLARE a record;role_name text; BEGIN
 FOR a IN SELECT * FROM map_geo_acl LOOP
 IF a.grantee=0 THEN RAISE EXCEPTION 'Unexpected public execute grant; review explicitly'; END IF;
 SELECT rolname INTO STRICT role_name FROM pg_roles WHERE oid=a.grantee;
 EXECUTE format('GRANT EXECUTE ON FUNCTION public.explore_geo(integer,integer) TO %I%s',role_name,
 CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
 END LOOP;
END $$;
COMMIT;
