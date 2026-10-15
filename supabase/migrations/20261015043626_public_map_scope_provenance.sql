BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='2s';
-- Exact deployed bounded reader source; refuse drift rather than overwrite it.
DO $guard$ DECLARE p pg_proc; grants text[]; BEGIN
 SELECT * INTO STRICT p FROM pg_proc WHERE oid='public.explore_geo(integer,integer)'::regprocedure;
 SELECT array_agg(coalesce(r.rolname,'PUBLIC')||':'||a.is_grantable::text ORDER BY coalesce(r.rolname,'PUBLIC')) INTO grants FROM aclexplode(p.proacl)a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE';
 IF md5(p.prosrc) IS DISTINCT FROM 'f6f492cedb166f9baaddb528f7161501' OR pg_get_userbyid(p.proowner)<>'postgres' OR p.prolang IS DISTINCT FROM(SELECT oid FROM pg_language WHERE lanname='sql')OR p.provolatile IS DISTINCT FROM 's'OR pg_get_expr(p.proargdefaults,0)IS DISTINCT FROM '5000, 0'OR p.prosecdef IS DISTINCT FROM true OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
 OR p.proargnames IS DISTINCT FROM ARRAY['p_limit','p_offset','slug','entity_type','name','city','country','category_slug','lat','lng','geo_precision','address','id','geo_metadata','reviewed_destination']::text[]
 OR pg_get_function_result(p.oid) IS DISTINCT FROM 'TABLE(slug text, entity_type text, name text, city text, country text, category_slug text, lat double precision, lng double precision, geo_precision text, address text, id uuid, geo_metadata jsonb, reviewed_destination jsonb)'
 OR grants IS DISTINCT FROM ARRAY['anon:false','authenticated:false','postgres:false','service_role:false']::text[] THEN RAISE EXCEPTION 'public_map_scope_contract_changed';END IF;
END $guard$;
-- Only an aggregate boolean is public. Private enrichment text/URLs never leave SQL.
CREATE OR REPLACE FUNCTION public.explore_geo(p_limit integer DEFAULT 5000,p_offset integer DEFAULT 0)
RETURNS TABLE(slug text,entity_type text,name text,city text,country text,category_slug text,lat double precision,lng double precision,geo_precision text,address text,id uuid,geo_metadata jsonb,reviewed_destination jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH page AS MATERIALIZED(
 SELECT l.id FROM zoi.listings l WHERE l.publish_status='published'AND l.moderation_status IN('clean','cleared')AND l.duplicate_status<>'confirmed_duplicate'AND coalesce(l.marketplace_status,'')<>'hidden'AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL ORDER BY l.id LIMIT least(greatest(coalesce(p_limit,5000),1),5000)OFFSET greatest(coalesce(p_offset,0),0)
 ),records AS MATERIALIZED(
 SELECT l.id,l.slug,l.entity_type,l.name,l.city,l.country,l.primary_category_id,l.latitude,l.longitude,l.geo_precision,l.address,l.profile->'_geo'AS geo,l.profile->'_enrich'AS scope FROM page p JOIN zoi.listings l ON l.id=p.id
 )
 SELECT l.slug::text,l.entity_type::text,l.name::text,l.city::text,zoi.geo_country_canon(l.country)::text,c.slug::text,l.latitude::double precision,l.longitude::double precision,zoi.geo_effective_precision(l.geo_precision::text,l.geo),l.address::text,l.id,
 jsonb_strip_nulls(jsonb_build_object('scope_conflict',coalesce(l.scope->>'source_scope_mismatch'='true'OR l.scope->>'scope_review_required'='true'OR l.scope->>'organization_identity_quarantine'='true'OR l.scope->>'blocked_reason'='source_scope_mismatch'OR(l.scope->>'identity_scope'='organization'AND l.entity_type IN('artist','creator','professional'))OR l.scope->>'source_kind'='association_member',false),'method',left(regexp_replace(l.geo->>'method','[^[:alnum:] _-]','','g'),120),'precision',left(regexp_replace(l.geo->>'precision','[^[:alnum:] _-]','','g'),40),'source',CASE WHEN l.geo->>'source'~'^[a-zA-Z0-9 _-]{1,80}$'THEN l.geo->>'source'END,'geocoded_at',CASE WHEN l.geo->>'geocoded_at'~'^\d{4}-\d{2}-\d{2}([T ][0-9:.+Z-]+)?$'THEN left(l.geo->>'geocoded_at',40)END)),
 CASE WHEN l.geo_precision::text='street'AND nullif(l.geo->>'request_id','')IS NOT NULL THEN public.geography_reviewed_point(l.id)END
 FROM records l LEFT JOIN zoi.categories c ON c.id=l.primary_category_id ORDER BY l.id
$$;
NOTIFY pgrst,'reload schema';
COMMIT;
