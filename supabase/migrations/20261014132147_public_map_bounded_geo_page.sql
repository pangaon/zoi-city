BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$ DECLARE p pg_proc;grants text[];BEGIN
 SELECT *INTO STRICT p FROM pg_proc WHERE oid='public.explore_geo(integer,integer)'::regprocedure;
 SELECT array_agg(coalesce(r.rolname,'PUBLIC')||':'||a.is_grantable::text ORDER BY coalesce(r.rolname,'PUBLIC'))INTO grants FROM aclexplode(p.proacl)a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE';
 IF md5(pg_get_functiondef(p.oid))<>'ed166405b051074c4ae94d1780a63109'OR md5(pg_get_viewdef('zoi.v_public_listings'::regclass,true))<>'2b46539e1df515c212845c391a322f74'
 OR pg_get_userbyid(p.proowner)<>'postgres'OR grants IS DISTINCT FROM ARRAY['anon:false','authenticated:false','postgres:false','service_role:false']::text[]
 THEN RAISE EXCEPTION 'bounded_geo_contract_changed';END IF;
END $guard$;
-- Encode the exact current public view scope, including its NULL duplicate rule.
CREATE INDEX listings_public_geo_id_idx ON zoi.listings(id) WHERE publish_status='published'AND moderation_status IN('clean','cleared')AND duplicate_status<>'confirmed_duplicate'AND coalesce(marketplace_status,'')<>'hidden'AND latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE OR REPLACE FUNCTION public.explore_geo(p_limit integer DEFAULT 5000,p_offset integer DEFAULT 0)
RETURNS TABLE(slug text,entity_type text,name text,city text,country text,category_slug text,lat double precision,lng double precision,geo_precision text,address text,id uuid,geo_metadata jsonb,reviewed_destination jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH page AS MATERIALIZED(
 SELECT l.id FROM zoi.listings l WHERE l.publish_status='published'AND l.moderation_status IN('clean','cleared')AND l.duplicate_status<>'confirmed_duplicate'AND coalesce(l.marketplace_status,'')<>'hidden'AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL ORDER BY l.id LIMIT least(greatest(coalesce(p_limit,5000),1),5000)OFFSET greatest(coalesce(p_offset,0),0)
 ),records AS MATERIALIZED(
 SELECT l.id,l.slug,l.entity_type,l.name,l.city,l.country,l.primary_category_id,l.latitude,l.longitude,l.geo_precision,l.address,l.profile->'_geo'AS geo FROM page p JOIN zoi.listings l ON l.id=p.id
 )
 SELECT l.slug::text,l.entity_type::text,l.name::text,l.city::text,zoi.geo_country_canon(l.country)::text,c.slug::text,l.latitude::double precision,l.longitude::double precision,zoi.geo_effective_precision(l.geo_precision::text,l.geo),l.address::text,l.id,
 jsonb_strip_nulls(jsonb_build_object('method',left(regexp_replace(l.geo->>'method','[^[:alnum:] _-]','','g'),120),'precision',left(regexp_replace(l.geo->>'precision','[^[:alnum:] _-]','','g'),40),'source',CASE WHEN l.geo->>'source'~'^[a-zA-Z0-9 _-]{1,80}$'THEN l.geo->>'source'END,'geocoded_at',CASE WHEN l.geo->>'geocoded_at'~'^\d{4}-\d{2}-\d{2}([T ][0-9:.+Z-]+)?$'THEN left(l.geo->>'geocoded_at',40)END)),
 CASE WHEN zoi.geo_effective_precision(l.geo_precision::text,l.geo)='street'AND nullif(l.geo->>'request_id','')IS NOT NULL THEN public.geography_reviewed_point(l.id)END
 FROM records l LEFT JOIN zoi.categories c ON c.id=l.primary_category_id ORDER BY l.id
$$;
NOTIFY pgrst,'reload schema';
COMMIT;
