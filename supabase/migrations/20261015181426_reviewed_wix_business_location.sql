BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='20s';
-- Explicit manually reviewed Wix business location only. No listing/job writes.
-- Full archived document/script scans are an independent manual trust boundary;
-- bounded prefix bytes below EXCLUDE the explicitly recorded one-byte framing.
DO $guard$ DECLARE expected jsonb;actual record;BEGIN
 IF to_regprocedure('zoi.geography_reviewed_wix_proof(jsonb,jsonb,zoi.listings,zoi.geography_repair_jobs)')IS NOT NULL THEN RAISE EXCEPTION 'geography_wix_extension_exists';END IF;
 FOR expected IN SELECT value FROM jsonb_array_elements($contracts$[{"signature":"zoi.maintain_seo_identity_keys()","md5":"a6d10dbbedb1f4a9aff4a3010b3a03d0","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"signature":"zoi.geography_source_generation(uuid)","md5":"d9bde7523cd57ea383fa2f77ec609e89","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"s"},{"signature":"zoi.schema_type(text,text)","md5":"979e6dbac201900f10e2a1cdb7a4d226","owner":"postgres","acl":null,"config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_repair_strategy_input(zoi.listings,text)","md5":"a87a595c8e9db085fb12e066aa66f1fd","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.ensure_listing_slug()","md5":"86de5ced4bc9ae28b48240ee6b149323","owner":"postgres","acl":null,"config":["search_path=\"\""],"security_definer":false,"volatility":"v"},{"signature":"public.geography_repair_record_application(uuid,uuid)","md5":"3f9e0896e6308211fd0366917f2ae68c","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"signature":"zoi.geography_reviewed_place_proof(jsonb,jsonb,zoi.listings,zoi.geography_repair_jobs)","md5":"65dc127bf783ad7f87d9d656b9b8afaa","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"s"},{"signature":"zoi.geography_read_authority_changed()","md5":"baca38034b9b0974465026eff8aec89d","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"signature":"zoi.geography_read_authority_input(zoi.listings)","md5":"3a452d0b2b9902436360a47d3a575e4e","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_place_norm(text)","md5":"ac9235a21dafc3931bfee9b06703796c","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"public.geography_review_apply(uuid,uuid,text,text,jsonb)","md5":"9b7223dd2e6752ca28762e9e8e1ab869","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"signature":"zoi.geography_read_source_allowed(zoi.listings)","md5":"ecae4cf96a5794c0eb44154b145ef6eb","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_url_component(text)","md5":"33ecf575f3c07144a0f90177791f03f3","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.seo_pluralize(text)","md5":"3a441e4585bf57f2b1da52a9c816029b","owner":"postgres","acl":null,"config":null,"security_definer":false,"volatility":"i"},{"signature":"zoi.claim_owner_changed()","md5":"e16849417c9c87d6a2ad8a4482dbb051","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"signature":"zoi.auto_seo_fill()","md5":"f3f56fbc83395559e0b883f610182017","owner":"postgres","acl":null,"config":["search_path=\"\""],"security_definer":false,"volatility":"v"},{"signature":"zoi.geography_source_enqueue_one(zoi.listings,text,bigint)","md5":"1c1408dd9992138e1dd7a6490c17f88b","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"signature":"zoi.set_updated_at()","md5":"1f8b6687e304c5f6502235344d4f0b7a","owner":"postgres","acl":null,"config":["search_path=\"\""],"security_definer":false,"volatility":"v"},{"signature":"zoi.skip_noop_listing_update()","md5":"059ca37c376f88162bc84423c543b024","owner":"postgres","acl":null,"config":["search_path=zoi, public"],"security_definer":false,"volatility":"v"},{"signature":"zoi.geography_place_anchor_href(text)","md5":"0f974f98a350a12633ddb0201f6ce25e","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_publisher_host(text)","md5":"18f04ea6d4ae44e2a6b7f6d9258e8e9c","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_place_quote(bytea,jsonb,text)","md5":"2370a3d4d34208172a01eb35751b2c0d","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_source_authority_input(zoi.listings)","md5":"4a83d0513384898300eb5e924f12f59a","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.publish_gate(text,text,bigint,text,text,text,text,text)","md5":"905be3e3473f808c3c50a4a6f5e7279c","owner":"postgres","acl":null,"config":["search_path=pg_catalog, pg_temp"],"security_definer":false,"volatility":"i"},{"signature":"zoi.tg_apply_publish_gate()","md5":"48db3959fc1281e9f09af3ff8164dae6","owner":"postgres","acl":null,"config":["search_path=\"\""],"security_definer":false,"volatility":"v"},{"signature":"zoi.seo_text(text)","md5":"45ca783e5e2b06098a7c025a69347b9f","owner":"postgres","acl":"{postgres=X/postgres}","config":null,"security_definer":false,"volatility":"i"},{"signature":"zoi.guard_listing_quality_receipts()","md5":"f0ebb7ba92e72b6bd34b43acc2676789","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"v"},{"signature":"public.geography_review_revert(uuid,text)","md5":"e6f2ba4421641428065b817ad47bd3e8","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"signature":"zoi.geography_repair_input(zoi.listings)","md5":"e2b3362b5f0ee526063b9d5d4665256b","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.seo_name(text,text)","md5":"6681315c7a01314ba7851d65c6fd2dce","owner":"postgres","acl":"{postgres=X/postgres}","config":null,"security_definer":false,"volatility":"i"},{"signature":"zoi.seo_slug(text)","md5":"9b36fe6c6fabbe222376430aacf73323","owner":"postgres","acl":null,"config":null,"security_definer":false,"volatility":"i"},{"signature":"public.geography_reviewed_point(uuid)","md5":"a3320206addf52bd1bf5521ca1ac6cd9","owner":"postgres","acl":"{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"s"},{"signature":"zoi.geography_place_html_decode(text)","md5":"b9949947fae26d1a1e265dd0abb99e36","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.listing_quality(text,text,text,text,bigint,text)","md5":"6d842320cba4f04697493b746ecea663","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog, pg_temp"],"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_publisher_held(zoi.listings)","md5":"c81c146a5aebfa684c5223eb4d18f3a7","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_source_eligible(zoi.listings)","md5":"de128d988072e26b8c5b2c0bd6d5d65f","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"s"},{"signature":"zoi.geography_source_listing_changed()","md5":"2d8c2ea0fb88550e057c51004100add1","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"signature":"zoi.geography_read_authority_fingerprint(zoi.listings)","md5":"2757c108471ef5a863f4700e615e34d8","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"s"},{"signature":"zoi.geography_fingerprint(zoi.listings)","md5":"b77ed3d5d9004f1957503c2f848fe4c8","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"s"},{"signature":"zoi.maintain_seo_projection()","md5":"f17b227663468c63feaafdda7caf903f","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"}]$contracts$::jsonb)LOOP
 SELECT md5(pg_get_functiondef(proc.oid))AS md5,pg_get_userbyid(proc.proowner)AS owner,proc.proacl::text AS acl,proc.proconfig AS config,proc.prosecdef AS security_definer,proc.provolatile::text AS volatility INTO actual FROM pg_proc proc WHERE proc.oid=to_regprocedure(expected->>'signature');
 IF to_jsonb(actual)IS DISTINCT FROM expected-'signature'THEN RAISE EXCEPTION 'geography_wix_dependency_drift:%',expected->>'signature';END IF;END LOOP;
 IF(SELECT jsonb_agg(jsonb_build_object('name',tg.tgname,'enabled',tg.tgenabled::text,'trigger',CASE WHEN tg.tgname='geography_source_listing_update'AND pg_get_triggerdef(tg.oid)='CREATE CONSTRAINT TRIGGER geography_source_listing_update AFTER UPDATE ON zoi.listings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (((old.name IS DISTINCT FROM new.name) OR (old.entity_type IS DISTINCT FROM new.entity_type) OR (old.address IS DISTINCT FROM new.address) OR (old.city IS DISTINCT FROM new.city) OR (old.country IS DISTINCT FROM new.country) OR (old.website IS DISTINCT FROM new.website) OR (old.source_url IS DISTINCT FROM new.source_url) OR (old.latitude IS DISTINCT FROM new.latitude) OR (old.longitude IS DISTINCT FROM new.longitude) OR (old.geo_precision IS DISTINCT FROM new.geo_precision) OR (old.owner_user_id IS DISTINCT FROM new.owner_user_id) OR (old.owner_workspace_id IS DISTINCT FROM new.owner_workspace_id) OR (old.publish_status IS DISTINCT FROM new.publish_status) OR (old.moderation_status IS DISTINCT FROM new.moderation_status) OR (old.marketplace_status IS DISTINCT FROM new.marketplace_status) OR (old.duplicate_status IS DISTINCT FROM new.duplicate_status) OR ((old.profile -> ''_geo''::text) IS DISTINCT FROM (new.profile -> ''_geo''::text)) OR ((old.profile #> ''{_enrich,blocked_reason}''::text[]) IS DISTINCT FROM (new.profile #> ''{_enrich,blocked_reason}''::text[])) OR ((old.profile #> ''{_enrich,scope_review_required}''::text[]) IS DISTINCT FROM (new.profile #> ''{_enrich,scope_review_required}''::text[])) OR ((old.profile #> ''{_enrich,organization_identity_quarantine}''::text[]) IS DISTINCT FROM (new.profile #> ''{_enrich,organization_identity_quarantine}''::text[])))) EXECUTE FUNCTION zoi.geography_source_listing_changed()'THEN 'CREATE CONSTRAINT TRIGGER geography_source_listing_update AFTER UPDATE ON zoi.listings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN ((((((((((((((((((old.name IS DISTINCT FROM new.name) OR (old.entity_type IS DISTINCT FROM new.entity_type)) OR (old.address IS DISTINCT FROM new.address)) OR (old.city IS DISTINCT FROM new.city)) OR (old.country IS DISTINCT FROM new.country)) OR (old.website IS DISTINCT FROM new.website)) OR (old.source_url IS DISTINCT FROM new.source_url)) OR (old.latitude IS DISTINCT FROM new.latitude)) OR (old.longitude IS DISTINCT FROM new.longitude)) OR (old.geo_precision IS DISTINCT FROM new.geo_precision)) OR (old.owner_user_id IS DISTINCT FROM new.owner_user_id)) OR (old.owner_workspace_id IS DISTINCT FROM new.owner_workspace_id)) OR (old.publish_status IS DISTINCT FROM new.publish_status)) OR (old.moderation_status IS DISTINCT FROM new.moderation_status)) OR (old.marketplace_status IS DISTINCT FROM new.marketplace_status)) OR (old.duplicate_status IS DISTINCT FROM new.duplicate_status)) OR ((old.profile -> ''_geo''::text) IS DISTINCT FROM (new.profile -> ''_geo''::text)) OR ((old.profile #> ''{_enrich,blocked_reason}''::text[]) IS DISTINCT FROM (new.profile #> ''{_enrich,blocked_reason}''::text[])) OR ((old.profile #> ''{_enrich,scope_review_required}''::text[]) IS DISTINCT FROM (new.profile #> ''{_enrich,scope_review_required}''::text[])) OR ((old.profile #> ''{_enrich,organization_identity_quarantine}''::text[]) IS DISTINCT FROM (new.profile #> ''{_enrich,organization_identity_quarantine}''::text[])))) EXECUTE FUNCTION zoi.geography_source_listing_changed()'ELSE pg_get_triggerdef(tg.oid)END,'deferrable',tg.tgdeferrable,'initially_deferred',tg.tginitdeferred)ORDER BY tg.tgname)FROM pg_trigger tg WHERE tg.tgrelid='zoi.listings'::regclass AND NOT tg.tgisinternal)IS DISTINCT FROM $triggers$[{"name":"geography_read_authority_changed","enabled":"O","trigger":"CREATE TRIGGER geography_read_authority_changed AFTER UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.geography_read_authority_changed()","deferrable":false,"initially_deferred":false},{"name":"geography_source_listing_insert","enabled":"O","trigger":"CREATE CONSTRAINT TRIGGER geography_source_listing_insert AFTER INSERT ON zoi.listings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION zoi.geography_source_listing_changed()","deferrable":true,"initially_deferred":true},{"name":"geography_source_listing_update","enabled":"O","trigger":"CREATE CONSTRAINT TRIGGER geography_source_listing_update AFTER UPDATE ON zoi.listings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN ((((((((((((((((((old.name IS DISTINCT FROM new.name) OR (old.entity_type IS DISTINCT FROM new.entity_type)) OR (old.address IS DISTINCT FROM new.address)) OR (old.city IS DISTINCT FROM new.city)) OR (old.country IS DISTINCT FROM new.country)) OR (old.website IS DISTINCT FROM new.website)) OR (old.source_url IS DISTINCT FROM new.source_url)) OR (old.latitude IS DISTINCT FROM new.latitude)) OR (old.longitude IS DISTINCT FROM new.longitude)) OR (old.geo_precision IS DISTINCT FROM new.geo_precision)) OR (old.owner_user_id IS DISTINCT FROM new.owner_user_id)) OR (old.owner_workspace_id IS DISTINCT FROM new.owner_workspace_id)) OR (old.publish_status IS DISTINCT FROM new.publish_status)) OR (old.moderation_status IS DISTINCT FROM new.moderation_status)) OR (old.marketplace_status IS DISTINCT FROM new.marketplace_status)) OR (old.duplicate_status IS DISTINCT FROM new.duplicate_status)) OR ((old.profile -> '_geo'::text) IS DISTINCT FROM (new.profile -> '_geo'::text)) OR ((old.profile #> '{_enrich,blocked_reason}'::text[]) IS DISTINCT FROM (new.profile #> '{_enrich,blocked_reason}'::text[])) OR ((old.profile #> '{_enrich,scope_review_required}'::text[]) IS DISTINCT FROM (new.profile #> '{_enrich,scope_review_required}'::text[])) OR ((old.profile #> '{_enrich,organization_identity_quarantine}'::text[]) IS DISTINCT FROM (new.profile #> '{_enrich,organization_identity_quarantine}'::text[])))) EXECUTE FUNCTION zoi.geography_source_listing_changed()","deferrable":true,"initially_deferred":true},{"name":"listing_claim_owner_epoch","enabled":"O","trigger":"CREATE TRIGGER listing_claim_owner_epoch AFTER UPDATE OF owner_workspace_id, owner_user_id ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.claim_owner_changed()","deferrable":false,"initially_deferred":false},{"name":"listing_quality_receipts_guard","enabled":"O","trigger":"CREATE TRIGGER listing_quality_receipts_guard BEFORE INSERT OR UPDATE OF profile ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.guard_listing_quality_receipts()","deferrable":false,"initially_deferred":false},{"name":"listings_aa_slug","enabled":"O","trigger":"CREATE TRIGGER listings_aa_slug BEFORE INSERT OR UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.ensure_listing_slug()","deferrable":false,"initially_deferred":false},{"name":"listings_publish_gate","enabled":"O","trigger":"CREATE TRIGGER listings_publish_gate BEFORE INSERT ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.tg_apply_publish_gate()","deferrable":false,"initially_deferred":false},{"name":"listings_skip_noop","enabled":"O","trigger":"CREATE TRIGGER listings_skip_noop BEFORE UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.skip_noop_listing_update()","deferrable":false,"initially_deferred":false},{"name":"maintain_seo_identity_keys","enabled":"O","trigger":"CREATE TRIGGER maintain_seo_identity_keys AFTER INSERT OR UPDATE OF id, name, city, region, country, address ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.maintain_seo_identity_keys()","deferrable":false,"initially_deferred":false},{"name":"trg_listings_auto_seo","enabled":"O","trigger":"CREATE TRIGGER trg_listings_auto_seo BEFORE INSERT OR UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.auto_seo_fill()","deferrable":false,"initially_deferred":false},{"name":"trg_listings_updated","enabled":"O","trigger":"CREATE TRIGGER trg_listings_updated BEFORE UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.set_updated_at()","deferrable":false,"initially_deferred":false},{"name":"zz_maintain_seo_projection","enabled":"O","trigger":"CREATE TRIGGER zz_maintain_seo_projection AFTER INSERT OR UPDATE OF id, name, city, region, country, address, slug, entity_type, updated_at, created_at, phone, website, latitude, description, publish_status, moderation_status, marketplace_status, duplicate_status ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.maintain_seo_projection()","deferrable":false,"initially_deferred":false}]$triggers$::jsonb THEN RAISE EXCEPTION 'geography_wix_listing_trigger_drift';END IF;
END $guard$;
-- These pure validators are private; the existing service-only canonical writer
-- is the sole mutation authority. Full raw scripts remain independently reviewed
-- immutable archive evidence, not bounded-prefix objects.
CREATE FUNCTION zoi.geography_wix_json_unique(raw text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $fn$
DECLARE queue json[];depths integer[];node json;entry record;position integer:=1;nodes integer:=0;depth integer;BEGIN
 IF raw IS NULL OR octet_length(raw)NOT BETWEEN 1 AND 32768 THEN RAISE EXCEPTION 'geography_wix_json_bound';END IF;
 queue:=ARRAY[raw::json];depths:=ARRAY[0];
 WHILE position<=coalesce(array_length(queue,1),0)LOOP
 node:=queue[position];depth:=depths[position];position:=position+1;nodes:=nodes+1;
 IF nodes>16384 OR depth>16 THEN RAISE EXCEPTION 'geography_wix_json_bound';END IF;
 IF json_typeof(node)='object'THEN
 IF EXISTS(SELECT 1 FROM json_each(node)GROUP BY key HAVING count(*)>1)THEN RAISE EXCEPTION 'geography_wix_json_duplicate';END IF;
 FOR entry IN SELECT value FROM json_each(node)LOOP queue:=array_append(queue,entry.value);depths:=array_append(depths,depth+1);END LOOP;
 ELSIF json_typeof(node)='array'THEN FOR entry IN SELECT value FROM json_array_elements(node)LOOP queue:=array_append(queue,entry.value);depths:=array_append(depths,depth+1);END LOOP;END IF;
 IF coalesce(array_length(queue,1),0)>16384 THEN RAISE EXCEPTION 'geography_wix_json_bound';END IF;
 END LOOP;RETURN raw::jsonb;
END $fn$;
CREATE FUNCTION zoi.geography_wix_canonical(value jsonb)RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $fn$
DECLARE result text;BEGIN
 IF jsonb_typeof(value)='object'THEN SELECT '{'||coalesce(string_agg(to_jsonb(key)::text||':'||zoi.geography_wix_canonical(v),','ORDER BY key COLLATE "C"),'')||'}'INTO result FROM jsonb_each(value)AS x(key,v);RETURN result;
 ELSIF jsonb_typeof(value)='array'THEN SELECT '['||coalesce(string_agg(zoi.geography_wix_canonical(v),','ORDER BY ord),'')||']'INTO result FROM jsonb_array_elements(value)WITH ORDINALITY x(v,ord);RETURN result;
 ELSE RETURN value::text;END IF;
END $fn$;
CREATE FUNCTION zoi.geography_wix_source_url(raw text,website text)RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $fn$
DECLARE a text[];b text[];ap text;bp text;BEGIN
 a:=regexp_match(raw,'^https://([a-z0-9][a-z0-9.-]*)(/[^?#]*)?$');b:=regexp_match(website,'^https://([a-z0-9][a-z0-9.-]*)(/[^?#]*)?$');
 IF a IS NULL OR b IS NULL OR raw~'[[:space:]\\]'OR website~'[[:space:]\\]'THEN RETURN false;END IF;
 ap:=coalesce(a[2],'/');bp:=rtrim(coalesce(b[2],''),'/');
 IF ap~*'(^|/)[.]{1,2}(/|$)|//|%(2e|2f|5c|25)'OR bp~*'(^|/)[.]{1,2}(/|$)|//|%(2e|2f|5c|25)'THEN RETURN false;END IF;
 RETURN regexp_replace(a[1],'^www[.]','')=regexp_replace(b[1],'^www[.]','')AND(bp=''OR ap=bp OR left(ap,length(bp)+1)=bp||'/');
END $fn$;
CREATE FUNCTION zoi.geography_wix_parcel_contains(p jsonb,rings jsonb)RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $fn$
DECLARE ring jsonb;v jsonb;prev jsonb;inside boolean:=false;n integer:=0;i integer;x double precision;y double precision;xi double precision;yi double precision;xj double precision;yj double precision;cross_at double precision;BEGIN
 IF jsonb_typeof(p->'latitude')IS DISTINCT FROM 'number'OR jsonb_typeof(p->'longitude')IS DISTINCT FROM 'number'OR jsonb_typeof(rings)IS DISTINCT FROM 'array'OR jsonb_array_length(rings)NOT BETWEEN 1 AND 8 THEN RAISE EXCEPTION 'geography_wix_parcel_geometry';END IF;
 x:=(p->>'longitude')::double precision;y:=(p->>'latitude')::double precision;IF abs(x)>180 OR abs(y)>90 OR(x=0 AND y=0)THEN RAISE EXCEPTION 'geography_wix_parcel_geometry';END IF;
 FOR ring IN SELECT value FROM jsonb_array_elements(rings)LOOP
 IF jsonb_typeof(ring)IS DISTINCT FROM 'array'OR jsonb_array_length(ring)<4 OR ring->0 IS DISTINCT FROM ring->(jsonb_array_length(ring)-1)THEN RAISE EXCEPTION 'geography_wix_parcel_geometry';END IF;
 n:=n+jsonb_array_length(ring);IF n>128 THEN RAISE EXCEPTION 'geography_wix_parcel_geometry';END IF;
 FOR v IN SELECT value FROM jsonb_array_elements(ring)LOOP IF jsonb_typeof(v)IS DISTINCT FROM 'array'OR jsonb_array_length(v)<>2 OR jsonb_typeof(v->0)IS DISTINCT FROM 'number'OR jsonb_typeof(v->1)IS DISTINCT FROM 'number'OR abs((v->>0)::double precision)>180 OR abs((v->>1)::double precision)>90 THEN RAISE EXCEPTION 'geography_wix_parcel_geometry';END IF;END LOOP;
 prev:=ring->(jsonb_array_length(ring)-1);
 FOR i IN 0..jsonb_array_length(ring)-1 LOOP v:=ring->i;xi:=(v->>0)::double precision;yi:=(v->>1)::double precision;xj:=(prev->>0)::double precision;yj:=(prev->>1)::double precision;
 cross_at:=(x-xi)*(yj-yi)-(y-yi)*(xj-xi);
 IF abs(cross_at)<1e-12 AND x BETWEEN least(xi,xj)AND greatest(xi,xj)AND y BETWEEN least(yi,yj)AND greatest(yi,yj)THEN RAISE EXCEPTION 'geography_wix_parcel_boundary';END IF;
 IF(yi>y)<>(yj>y)THEN IF x<(xj-xi)*(y-yi)/(yj-yi)+xi THEN inside:=NOT inside;END IF;END IF;prev:=v;END LOOP;END LOOP;
 RETURN inside;
END $fn$;
CREATE FUNCTION zoi.geography_reviewed_wix_proof(c jsonb,review jsonb,l zoi.listings,j zoi.geography_repair_jobs)RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $fn$
DECLARE p jsonb;cap jsonb;d jsonb;range_at jsonb;prefix jsonb;context jsonb;first_context jsonb;f jsonb;card jsonb;a jsonb;role_at jsonb;roles jsonb;inventory jsonb:='[]';source_inventory jsonb:='[]';primary_at jsonb;parcel jsonb;attrs jsonb;rings jsonb;b jsonb;parts text[];params jsonb:='{}';item text;key text;parameter_value text;token text;raw text;before_token text;visible text;captured timestamptz;primary_time timestamptz;body bytea;start_at integer;end_at integer;index_at integer:=0;source_bytes integer;field_name text;field_value text;field_units integer;point_at jsonb;source_point jsonb;zip text;field_names text[]:=ARRAY['siteName','siteUrl','domain','defaultUrl','businessName','businessLocationCountry','businessLocationFormatted','businesLocationsState','businessLocationCity','businesLocationsStreet','businessLocationsStreetNumber','businessPostalCode','businessLocationCoordinates'];BEGIN
 IF c->>'evidence_kind'IS DISTINCT FROM 'reviewed_official_wix_business_location'OR jsonb_typeof(c->'wix_evidence_text')IS DISTINCT FROM 'string'THEN RAISE EXCEPTION 'geography_wix_proof_required';END IF;
 p:=zoi.geography_wix_json_unique(c->>'wix_evidence_text');
 IF p->'schema'IS DISTINCT FROM '1'::jsonb OR p->'canonical_context'IS DISTINCT FROM jsonb_build_object('id',l.id,'name',l.name,'address',l.address,'city',l.city,'country',l.country,'website',l.website)
 OR l.owner_user_id IS NOT NULL OR l.owner_workspace_id IS NOT NULL OR coalesce(l.claim_status,'unclaimed')<>'unclaimed'OR l.duplicate_status='confirmed_duplicate'OR NOT zoi.geography_read_source_allowed(l)OR nullif(btrim(l.profile#>>'{_enrich,blocked_reason}'),'')IS NOT NULL
 OR jsonb_typeof(review->'reviewer')IS DISTINCT FROM 'string'OR jsonb_typeof(review->'specialist')IS DISTINCT FROM 'string'
 OR review->>'wix_proof_sha256'IS DISTINCT FROM encode(extensions.digest(convert_to(c->>'wix_evidence_text','UTF8'),'sha256'),'hex')THEN RAISE EXCEPTION 'geography_wix_independent_review_required';END IF;
 FOREACH key IN ARRAY ARRAY['full_archived_raw_rehashed','full_duplicate_context_scan_confirmed','exact_identity_confirmed','exact_country_confirmed','visible_branch_confirmed','point_role_resolution_confirmed','same_property_not_point_equivalence']LOOP IF review->key IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'geography_wix_independent_review_required';END IF;END LOOP;
 cap:=p->'capture';captured:=(cap->>'captured_at')::timestamptz;
 IF cap->>'job_id'IS DISTINCT FROM j.id::text OR cap->>'listing_id'IS DISTINCT FROM l.id::text OR j.listing_id IS DISTINCT FROM l.id OR j.strategy IS DISTINCT FROM 'official_sources_v1'OR cap->>'strategy'IS DISTINCT FROM j.strategy
 OR j.status NOT IN('unresolved','needs_identity_review','needs_address_review','needs_coordinate_review','reviewed')OR j.lease_id IS NOT NULL OR j.completed_lease_id IS NULL OR cap->>'completed_lease_id'IS DISTINCT FROM j.completed_lease_id::text
 OR cap->>'input_fingerprint'IS DISTINCT FROM j.input_fingerprint OR j.input_fingerprint IS DISTINCT FROM zoi.geography_repair_input(l)
 OR cap->>'capture_result_hash'IS DISTINCT FROM j.capture_result_hash OR coalesce(j.capture_result_hash,'')!~'^[a-f0-9]{32}$'
 OR cap->>'source_json_sha256'IS DISTINCT FROM encode(extensions.digest(convert_to(j.source::text,'UTF8'),'sha256'),'hex')
 OR captured IS NULL OR NOT isfinite(captured)OR captured IS DISTINCT FROM j.captured_at OR captured<clock_timestamp()-interval '7days'OR captured>clock_timestamp()+interval '5minutes'
 OR coalesce(cap->>'private_archive','')!~'^[a-zA-Z0-9_-]{1,100}$'OR cap->>'private_archive'IS DISTINCT FROM j.source->>'private_archive'OR cap->>'archive_format'IS DISTINCT FROM 'decoded_utf8_sha256'OR cap->>'archive_format'IS DISTINCT FROM j.source->>'archive_format'
 OR cap->'pages'IS DISTINCT FROM j.source->'pages'OR jsonb_typeof(p->'documents')IS DISTINCT FROM 'array'OR jsonb_array_length(p->'documents')NOT BETWEEN 1 AND 3 OR jsonb_typeof(cap->'pages')IS DISTINCT FROM 'array'OR jsonb_array_length(cap->'pages')<>jsonb_array_length(p->'documents')THEN RAISE EXCEPTION 'geography_wix_capture_mismatch';END IF;
 FOR d IN SELECT value FROM jsonb_array_elements(p->'documents')LOOP
 IF d->>'kind'IS DISTINCT FROM 'official_wix_business_location_support'OR d->>'authority'IS DISTINCT FROM 'none'OR coalesce(d->>'source_sha256','')!~'^[a-f0-9]{64}$'OR jsonb_typeof(d->'source_bytes')IS DISTINCT FROM 'number'OR coalesce(d->>'source_bytes','')!~'^[0-9]+$'OR NOT zoi.geography_wix_source_url(d->>'source_url',l.website)
 OR cap#>>ARRAY['pages',index_at::text,'url']IS DISTINCT FROM d->>'source_url'OR cap#>>ARRAY['pages',index_at::text,'sha256']IS DISTINCT FROM d->>'source_sha256'OR cap#>ARRAY['pages',index_at::text,'http_status']IS DISTINCT FROM '200'::jsonb THEN RAISE EXCEPTION 'geography_wix_document_binding';END IF;
 source_bytes:=(d->>'source_bytes')::integer;
 IF source_bytes NOT BETWEEN 1 AND 1500000 OR NOT EXISTS(SELECT 1 FROM storage.buckets bucket JOIN storage.objects obj ON obj.bucket_id=bucket.id WHERE bucket.id=cap->>'private_archive'AND bucket.public=false AND obj.name=(d->>'source_sha256')||'.html'AND obj.metadata->>'size'~'^[0-9]+$'AND(obj.metadata->>'size')::bigint=source_bytes)THEN RAISE EXCEPTION 'geography_wix_private_archive_required';END IF;
 FOR range_at IN SELECT value FROM jsonb_array_elements(jsonb_build_array(d->'script',d#>'{script,body}',d->'context',d->'prefix'))LOOP
 IF jsonb_typeof(range_at)IS DISTINCT FROM 'object'OR jsonb_typeof(range_at->'start_byte')IS DISTINCT FROM 'number'OR jsonb_typeof(range_at->'end_byte')IS DISTINCT FROM 'number'OR coalesce(range_at->>'start_byte','')!~'^[0-9]+$'OR coalesce(range_at->>'end_byte','')!~'^[0-9]+$'OR coalesce(range_at->>'sha256','')!~'^[a-f0-9]{64}$'OR(range_at->>'start_byte')::integer>=(range_at->>'end_byte')::integer OR(range_at->>'end_byte')::integer>source_bytes THEN RAISE EXCEPTION 'geography_wix_document_ranges';END IF;END LOOP;
 prefix:=d->'prefix';raw:=prefix->>'raw';body:=convert_to(raw,'UTF8');start_at:=(prefix->>'start_byte')::integer;end_at:=(prefix->>'end_byte')::integer;
 IF(d#>>'{script,body,start_byte}')::integer<=(d#>>'{script,start_byte}')::integer OR(d#>>'{script,body,end_byte}')::integer>=(d#>>'{script,end_byte}')::integer OR(d#>>'{context,start_byte}')::integer<(d#>>'{script,body,start_byte}')::integer OR(d#>>'{context,end_byte}')::integer>(d#>>'{script,body,end_byte}')::integer OR start_at<>(d#>>'{context,start_byte}')::integer OR end_at>=(d#>>'{context,end_byte}')::integer
 OR(d#>>'{script,body,end_byte}')::integer-(d#>>'{script,body,start_byte}')::integer>524288 OR(d#>>'{context,end_byte}')::integer-(d#>>'{context,start_byte}')::integer>65536 OR octet_length(body)NOT BETWEEN 1 AND 8192 OR end_at-start_at<>octet_length(body)OR prefix->>'sha256'IS DISTINCT FROM encode(extensions.digest(body,'sha256'),'hex')OR prefix->>'structural_framing'IS DISTINCT FROM '}'OR prefix->>'framing_sha256'IS DISTINCT FROM encode(extensions.digest(convert_to('}','UTF8'),'sha256'),'hex')THEN RAISE EXCEPTION 'geography_wix_prefix_binding';END IF;
 context:=zoi.geography_wix_json_unique(raw||'}');
 IF jsonb_typeof(context)IS DISTINCT FROM 'object'THEN RAISE EXCEPTION 'geography_wix_prefix_binding';END IF;
 FOREACH field_name IN ARRAY field_names LOOP
 IF field_name<>'businessLocationCoordinates'THEN
 IF jsonb_typeof(context->field_name)IS DISTINCT FROM 'string'THEN RAISE EXCEPTION 'geography_wix_field_shape';END IF;
 field_value:=context->>field_name;
 SELECT coalesce(sum(CASE WHEN ascii(ch)>65535 THEN 2 ELSE 1 END),0)INTO field_units FROM regexp_split_to_table(field_value,'')ch;
 IF btrim(field_value,E'\t\n\f\r '||chr(11)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279))=''OR field_units>(CASE WHEN field_name~'Url$'THEN 2048 ELSE 512 END)THEN RAISE EXCEPTION 'geography_wix_field_shape';END IF;
 END IF;
 f:=d#>ARRAY['fields',field_name];IF jsonb_typeof(f)IS DISTINCT FROM 'object'OR f->'value'IS DISTINCT FROM context->field_name OR jsonb_typeof(f->'start_byte')IS DISTINCT FROM 'number'OR jsonb_typeof(f->'end_byte')IS DISTINCT FROM 'number'OR coalesce(f->>'start_byte','')!~'^[0-9]+$'OR coalesce(f->>'end_byte','')!~'^[0-9]+$'THEN RAISE EXCEPTION 'geography_wix_field_binding';END IF;
 IF(f->>'start_byte')::integer<start_at OR(f->>'end_byte')::integer>end_at OR(f->>'start_byte')::integer>=(f->>'end_byte')::integer THEN RAISE EXCEPTION 'geography_wix_field_binding';END IF;
 token:=convert_from(substring(body FROM(f->>'start_byte')::integer-start_at+1 FOR(f->>'end_byte')::integer-(f->>'start_byte')::integer),'UTF8');before_token:=convert_from(substring(body FROM 1 FOR(f->>'start_byte')::integer-start_at),'UTF8');
 IF f->>'sha256'IS DISTINCT FROM encode(extensions.digest(convert_to(token,'UTF8'),'sha256'),'hex')OR zoi.geography_wix_json_unique(token)IS DISTINCT FROM context->field_name OR before_token!~('"'||field_name||'"[[:space:]]*:[[:space:]]*$')THEN RAISE EXCEPTION 'geography_wix_field_binding';END IF;END LOOP;
 IF(d#>>'{fields,businessLocationCoordinates,end_byte}')::integer<>end_at THEN RAISE EXCEPTION 'geography_wix_prefix_member_boundary';END IF;
 source_point:=context->'businessLocationCoordinates';
 IF jsonb_typeof(source_point)IS DISTINCT FROM 'object'OR(SELECT array_agg(k ORDER BY k)FROM jsonb_object_keys(source_point)k)IS DISTINCT FROM ARRAY['latitude','longitude']OR jsonb_typeof(source_point->'latitude')IS DISTINCT FROM 'number'OR jsonb_typeof(source_point->'longitude')IS DISTINCT FROM 'number'OR abs((source_point->>'latitude')::double precision)>90 OR abs((source_point->>'longitude')::double precision)>180 OR((source_point->>'latitude')::double precision=0 AND(source_point->>'longitude')::double precision=0)
 OR d->'point'IS DISTINCT FROM(source_point||jsonb_build_object('role','typed_business_location'))OR c->'latitude'IS DISTINCT FROM source_point->'latitude'OR c->'longitude'IS DISTINCT FROM source_point->'longitude'
 OR NOT zoi.geography_wix_source_url(context->>'siteUrl',l.website)OR NOT zoi.geography_wix_source_url(l.website,context->>'siteUrl')OR NOT zoi.geography_wix_source_url(context->>'defaultUrl',d->>'source_url')OR NOT zoi.geography_wix_source_url(d->>'source_url',context->>'defaultUrl')OR context->>'domain'IS DISTINCT FROM regexp_replace(substring(l.website FROM '^https://([^/]+)'),'^www[.]','')
 THEN RAISE EXCEPTION 'geography_wix_business_point';END IF;
 IF first_context IS NULL THEN first_context:=context;ELSIF(context-ARRAY['siteName','siteUrl','domain','defaultUrl','siteName'])IS DISTINCT FROM(first_context-ARRAY['siteName','siteUrl','domain','defaultUrl','siteName'])THEN RAISE EXCEPTION 'geography_wix_pages_conflict';END IF;
 card:=d->'identity_card';body:=convert_to(card->>'raw','UTF8');visible:=zoi.geography_place_norm(zoi.geography_place_html_decode(regexp_replace(card->>'raw','<[^>]*>',' ','g')));a:=p->'source_address';
 IF jsonb_typeof(card)IS DISTINCT FROM 'object'OR octet_length(body)NOT BETWEEN 1 AND 8192 OR jsonb_typeof(card->'start_byte')IS DISTINCT FROM 'number'OR jsonb_typeof(card->'end_byte')IS DISTINCT FROM 'number'OR coalesce(card->>'start_byte','')!~'^[0-9]+$'OR coalesce(card->>'end_byte','')!~'^[0-9]+$'OR(card->>'end_byte')::integer<>(card->>'start_byte')::integer+octet_length(body)OR(card->>'end_byte')::integer>source_bytes OR card->>'sha256'IS DISTINCT FROM encode(extensions.digest(body,'sha256'),'hex')OR card->>'raw'~*'<!--|<(script|style|noscript|template|svg|iframe)[[:space:]>]|<[a-z][^>]*[[:space:]]hidden([[:space:]=]|>)|<[a-z][^>]*aria-hidden[[:space:]]*=[[:space:]]*["'']true|display[[:space:]]*:[[:space:]]*none|visibility[[:space:]]*:[[:space:]]*hidden'
 OR card->'exact_name_confirmed'IS DISTINCT FROM 'true'::jsonb OR card->'exact_address_confirmed'IS DISTINCT FROM 'true'::jsonb OR NOT zoi.geography_place_quote(body,card#>'{quotes,name}',card->>'source_name')OR NOT zoi.geography_place_quote(body,card#>'{quotes,street}',a->>'street')OR NOT zoi.geography_place_quote(body,card#>'{quotes,city}',a->>'city')
 OR nullif(zoi.geography_place_norm(card->>'source_name'),'')IS NULL OR strpos(' '||zoi.geography_place_norm(a->>'business_name')||' ',' '||zoi.geography_place_norm(card->>'source_name')||' ')=0 OR(zoi.geography_place_norm(card->>'source_name')IS DISTINCT FROM zoi.geography_place_norm(l.name)AND card->'name_alias_confirmed'IS DISTINCT FROM 'true'::jsonb)
 OR strpos(' '||visible||' ',' '||zoi.geography_place_norm(card->>'source_name')||' ')=0 OR strpos(' '||visible||' ',' '||zoi.geography_place_norm(a->>'street')||' ')=0 OR strpos(' '||visible||' ',' '||zoi.geography_place_norm(a->>'city')||' ')=0 THEN RAISE EXCEPTION 'geography_wix_identity_card';END IF;
 roles:=d->'other_point_roles';IF jsonb_typeof(roles)IS DISTINCT FROM 'array'OR jsonb_array_length(roles)>8 OR d->>'inventory_sha256'IS DISTINCT FROM encode(extensions.digest(convert_to(zoi.geography_wix_canonical(roles),'UTF8'),'sha256'),'hex')OR d#>'{full_json_scan,duplicate_keys}'IS DISTINCT FROM '0'::jsonb OR jsonb_typeof(d#>'{full_json_scan,nodes}')IS DISTINCT FROM 'number'OR jsonb_typeof(d#>'{full_json_scan,maximum_depth}')IS DISTINCT FROM 'number'OR coalesce(d#>>'{full_json_scan,nodes}','')!~'^[0-9]+$'OR coalesce(d#>>'{full_json_scan,maximum_depth}','')!~'^[0-9]+$'OR(d#>>'{full_json_scan,nodes}')::integer NOT BETWEEN 1 AND 16384 OR(d#>>'{full_json_scan,maximum_depth}')::integer NOT BETWEEN 1 AND 16 THEN RAISE EXCEPTION 'geography_wix_role_inventory';END IF;
 source_inventory:=source_inventory||jsonb_build_array(jsonb_build_object('source_sha256',d->>'source_sha256','inventory_sha256',d->>'inventory_sha256'));
 inventory:=inventory||jsonb_build_array(jsonb_build_object('source_sha256',d->>'source_sha256','role','typed_business_location')||(d->'point'));
 FOR role_at IN SELECT value FROM jsonb_array_elements(roles)LOOP
 IF role_at->>'role'IS DISTINCT FROM 'published_place_destination'OR coalesce(role_at->>'sha256','')!~'^[a-f0-9]{64}$'OR jsonb_typeof(role_at->'start_byte')IS DISTINCT FROM 'number'OR jsonb_typeof(role_at->'end_byte')IS DISTINCT FROM 'number'OR coalesce(role_at->>'start_byte','')!~'^[0-9]+$'OR coalesce(role_at->>'end_byte','')!~'^[0-9]+$'OR(role_at->>'end_byte')::integer<=(role_at->>'start_byte')::integer OR(role_at->>'end_byte')::integer>source_bytes OR(role_at->>'end_byte')::integer-(role_at->>'start_byte')::integer>4096 THEN RAISE EXCEPTION 'geography_wix_unclassified_role';END IF;
 parts:=regexp_match(role_at->>'url','^https://www[.]google[.]com/maps/place/([^/]+)/@(-?[0-9]+(?:[.][0-9]+)?),(-?[0-9]+(?:[.][0-9]+)?),[0-9]+(?:[.][0-9]+)?z/data=!3m1!4b1!4m5!3m4!1s(0x[0-9a-f]+:0x[0-9a-f]+)!8m2!3d(-?[0-9]+(?:[.][0-9]+)?)!4d(-?[0-9]+(?:[.][0-9]+)?)$');
 IF parts IS NULL OR length(role_at->>'url')>3000 OR role_at->>'url'~'[[:space:]\\?#<>"`{}]'OR parts[1]~*'%(2e|2f|5c|25)'OR role_at->>'place_id'IS DISTINCT FROM parts[4]OR role_at->>'label'IS DISTINCT FROM zoi.geography_url_component(parts[1])OR role_at->'latitude'IS DISTINCT FROM to_jsonb(parts[5]::double precision)OR role_at->'longitude'IS DISTINCT FROM to_jsonb(parts[6]::double precision)OR abs(parts[2]::double precision)>90 OR abs(parts[3]::double precision)>180 THEN RAISE EXCEPTION 'geography_wix_destination_role';END IF;
 inventory:=inventory||jsonb_build_array(jsonb_build_object('source_sha256',d->>'source_sha256')||role_at);END LOOP;
 index_at:=index_at+1;END LOOP;
 IF jsonb_array_length(inventory)-jsonb_array_length(p->'documents')>8 THEN RAISE EXCEPTION 'geography_wix_complete_role_inventory_size';END IF;
 a:=p->'source_address';zip:=first_context->>'businessPostalCode';
 IF first_context->>'businessLocationCountry'IS DISTINCT FROM 'US'OR l.country NOT IN('United States','United States of America','USA','US')OR a->>'country'IS DISTINCT FROM l.country OR a->>'business_name'IS DISTINCT FROM first_context->>'businessName'OR a->>'street_number'IS DISTINCT FROM first_context->>'businessLocationsStreetNumber'OR a->>'street'IS DISTINCT FROM(first_context->>'businessLocationsStreetNumber')||' '||(first_context->>'businesLocationsStreet')OR a->>'city'IS DISTINCT FROM first_context->>'businessLocationCity'OR a->>'region'IS DISTINCT FROM 'NJ'OR a->>'region'IS DISTINCT FROM first_context->>'businesLocationsState'OR a->>'postal_code'IS DISTINCT FROM zip OR coalesce(zip,'')!~'^[0-9]{5}(-[0-9]{4})?$'
 OR zoi.geography_place_norm(a->>'city')IS DISTINCT FROM zoi.geography_place_norm(l.city)OR zoi.geography_place_norm(l.address)IS DISTINCT FROM zoi.geography_place_norm((a->>'street')||' '||(a->>'city')||' '||(a->>'region')||' '||left(zip,5))OR zoi.geography_place_norm(first_context->>'businessLocationFormatted')IS DISTINCT FROM zoi.geography_place_norm((a->>'street')||' '||(a->>'city')||' '||(a->>'region')||' USA')
 OR p#>'{name_alias_review,confirmed}'IS DISTINCT FROM 'true'::jsonb OR p#>>'{name_alias_review,source_name}'IS DISTINCT FROM a->>'business_name'OR p#>>'{name_alias_review,canonical_name}'IS DISTINCT FROM l.name OR nullif(btrim(p#>>'{name_alias_review,reason}'),'')IS NULL OR p#>'{postal_extension_review,confirmed}'IS DISTINCT FROM 'true'::jsonb OR p#>>'{postal_extension_review,source_postal}'IS DISTINCT FROM zip OR p#>>'{postal_extension_review,canonical_postal}'IS DISTINCT FROM left(zip,5)
 OR c->'address'IS DISTINCT FROM(a-'business_name'-'street_number')OR c->>'name'IS DISTINCT FROM l.name OR c->>'precision'IS DISTINCT FROM 'source_published'OR c->>'evidence_path'IS DISTINCT FROM 'siteFeaturesConfigs.seo.context.businessLocationCoordinates'THEN RAISE EXCEPTION 'geography_wix_address_review';END IF;
 FOREACH key IN ARRAY ARRAY['selected_point_exact','all_source_points_enumerated','both_page_business_fields_equal','published_destination_same_address_confirmed','same_property_not_point_equivalence','not_roof_or_entrance_precision','property_address_alias_confirmed','municipality_confirmed','primary_metadata_date_acknowledged']LOOP IF p#>ARRAY['role_review',key]IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'geography_wix_role_review';END IF;END LOOP;
 IF p#>>'{role_review,selected_role}'IS DISTINCT FROM 'typed_business_location'OR length(btrim(coalesce(p#>>'{role_review,role_resolution_reason}','')))NOT BETWEEN 1 AND 1000 OR p#>'{role_review,complete_point_inventory}'IS DISTINCT FROM inventory OR review->>'source_inventory_sha256'IS DISTINCT FROM encode(extensions.digest(convert_to(zoi.geography_wix_canonical(source_inventory),'UTF8'),'sha256'),'hex')THEN RAISE EXCEPTION 'geography_wix_role_review';END IF;
 primary_at:=p->'primary_property';primary_time:=(primary_at->>'captured_at')::timestamptz;
 IF octet_length(primary_at->>'evidence_text')NOT BETWEEN 1 AND 8192 OR primary_at->>'source_sha256'IS DISTINCT FROM encode(extensions.digest(convert_to(primary_at->>'evidence_text','UTF8'),'sha256'),'hex')OR review->>'primary_property_sha256'IS DISTINCT FROM primary_at->>'source_sha256'OR primary_at->'address_selected'IS DISTINCT FROM 'true'::jsonb OR primary_at->'primary_reference'IS DISTINCT FROM 'true'::jsonb OR primary_at->'response_record_cap'IS DISTINCT FROM '2'::jsonb OR primary_at->'response_byte_cap'IS DISTINCT FROM '262144'::jsonb OR primary_time IS NULL OR NOT isfinite(primary_time)OR primary_time<clock_timestamp()-interval '7days'OR primary_time>clock_timestamp()+interval '5minutes'THEN RAISE EXCEPTION 'geography_wix_primary_required';END IF;
 IF primary_at->>'source_url'!~'^https://maps[.]nj[.]gov/arcgis/rest/services/Framework/Cadastral/MapServer/0/query[?][^#]*$'THEN RAISE EXCEPTION 'geography_wix_primary_scope';END IF;
 FOR item IN SELECT regexp_split_to_table(split_part(primary_at->>'source_url','?',2),'&')LOOP key:=zoi.geography_url_component(split_part(item,'=',1));parameter_value:=zoi.geography_url_component(substring(item FROM strpos(item,'=')+1));IF strpos(item,'=')=0 OR key IS NULL OR parameter_value IS NULL OR params?key OR key<>ALL(ARRAY['f','where','outFields','outSR','returnGeometry','resultRecordCount','geometryPrecision'])THEN RAISE EXCEPTION 'geography_wix_primary_scope';END IF;params:=params||jsonb_build_object(key,parameter_value);END LOOP;
 IF params->>'f'IS DISTINCT FROM 'json'OR params->>'outSR'IS DISTINCT FROM '4326'OR params->>'resultRecordCount'IS DISTINCT FROM '2'OR params->>'returnGeometry'IS DISTINCT FROM 'true'OR params->>'geometryPrecision'IS DISTINCT FROM '8'OR(SELECT array_agg(v ORDER BY v)FROM regexp_split_to_table(params->>'outFields',',')v)IS DISTINCT FROM ARRAY['COUNTY','FAC_NAME','MUN_NAME','OBJECTID','PAMS_PIN','PCL_MUN','PCL_PBDATE','PROP_LOC']THEN RAISE EXCEPTION 'geography_wix_primary_scope';END IF;
 parcel:=zoi.geography_wix_json_unique(primary_at->>'evidence_text');
 IF parcel?'error'OR parcel->'exceededTransferLimit'='true'::jsonb OR jsonb_typeof(parcel->'features')IS DISTINCT FROM 'array'OR jsonb_array_length(parcel->'features')<>1 OR parcel#>'{spatialReference,wkid}'IS DISTINCT FROM '4326'::jsonb THEN RAISE EXCEPTION 'geography_wix_parcel_geometry';END IF;
 attrs:=parcel#>'{features,0,attributes}';rings:=parcel#>'{features,0,geometry,rings}';
 IF jsonb_typeof(attrs)IS DISTINCT FROM 'object'OR EXISTS(SELECT 1 FROM jsonb_object_keys(attrs)k WHERE k<>ALL(ARRAY['OBJECTID','PAMS_PIN','PCL_MUN','PROP_LOC','MUN_NAME','COUNTY','FAC_NAME','PCL_PBDATE']))OR attrs IS DISTINCT FROM primary_at->'feature_attributes'OR attrs->>'PROP_LOC'IS DISTINCT FROM p#>>'{role_review,property_address_literal}'OR coalesce(attrs->>'PCL_MUN','')!~'^[0-9]{4}$'OR attrs->>'PCL_MUN'IS DISTINCT FROM p#>>'{role_review,municipality_code}'OR coalesce(primary_at->>'query_street_prefix','')!~'^[0-9A-Z][0-9A-Z ]{2,99}$'OR left(zoi.geography_place_norm(a->>'street'),length(zoi.geography_place_norm(primary_at->>'query_street_prefix'))+1)IS DISTINCT FROM zoi.geography_place_norm(primary_at->>'query_street_prefix')||' 'OR left(zoi.geography_place_norm(attrs->>'PROP_LOC'),length(zoi.geography_place_norm(primary_at->>'query_street_prefix'))+1)IS DISTINCT FROM zoi.geography_place_norm(primary_at->>'query_street_prefix')||' '
 OR primary_at->>'literal_address_predicate'IS DISTINCT FROM 'PCL_MUN='||chr(39)||(attrs->>'PCL_MUN')||chr(39)||' AND PROP_LOC LIKE '||chr(39)||(primary_at->>'query_street_prefix')||'%'||chr(39)OR params->>'where'IS DISTINCT FROM primary_at->>'literal_address_predicate'OR jsonb_typeof(attrs->'PCL_PBDATE')IS DISTINCT FROM 'number'OR(attrs->>'PCL_PBDATE')::numeric IS DISTINCT FROM extract(epoch FROM(primary_at->>'feature_date')::timestamptz)*1000 OR NOT zoi.geography_wix_parcel_contains(c,rings)THEN RAISE EXCEPTION 'geography_wix_parcel_identity';END IF;
 FOR point_at IN SELECT value FROM jsonb_array_elements(inventory)WHERE value->>'role'='published_place_destination'LOOP IF NOT zoi.geography_wix_parcel_contains(point_at,rings)OR NOT(p#>'{role_review,published_address_labels}'? (point_at->>'label'))OR strpos(' '||zoi.geography_place_norm(point_at->>'label')||' ',' '||zoi.geography_place_norm(l.city)||' ')=0 THEN RAISE EXCEPTION 'geography_wix_destination_property';END IF;END LOOP;
 b:=p->'locality_extent';IF b IS DISTINCT FROM review->'locality_extent'OR coalesce(b->>'source_sha256','')!~'^[a-f0-9]{64}$'OR nullif(btrim(b->>'quote'),'')IS NULL OR strpos(' '||zoi.geography_place_norm(b->>'quote')||' ',' '||zoi.geography_place_norm(l.city)||' ')=0 THEN RAISE EXCEPTION 'geography_wix_locality_required';END IF;
 FOR key IN SELECT jsonb_object_keys(coalesce(l.profile,'{}'))LOOP IF key=ANY(ARRAY['name','address','city','country','website','latitude','longitude','geo_precision'])AND(l.profile->key)IS DISTINCT FROM coalesce(to_jsonb(l)->key,'null'::jsonb)THEN RAISE EXCEPTION 'geography_wix_raw_override';END IF;END LOOP;
 RETURN p;
END $fn$;

ALTER FUNCTION zoi.geography_wix_json_unique(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.geography_wix_json_unique(text) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION zoi.geography_wix_canonical(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.geography_wix_canonical(jsonb) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION zoi.geography_wix_source_url(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.geography_wix_source_url(text,text) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION zoi.geography_wix_parcel_contains(jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.geography_wix_parcel_contains(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION zoi.geography_reviewed_wix_proof(jsonb,jsonb,zoi.listings,zoi.geography_repair_jobs) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.geography_reviewed_wix_proof(jsonb,jsonb,zoi.listings,zoi.geography_repair_jobs) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.geography_review_apply(p_request uuid, p_listing uuid, p_expected text, p_report_text text, p_review jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 l zoi.listings; prior zoi.geography_reviews; report jsonb; c jsonb;b jsonb;
 place_job zoi.geography_repair_jobs;place_proof jsonb;place_before zoi.listings;place_geo jsonb;
 wix_job zoi.geography_repair_jobs;wix_proof jsonb;wix_before zoi.listings;wix_geo jsonb;
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
 IF report#>>'{candidate,evidence_kind}'='reviewed_official_place_destination'THEN
 SELECT * INTO place_job FROM zoi.geography_repair_jobs WHERE id=((report#>>'{candidate,place_evidence_text}')::jsonb#>>'{capture,job_id}')::uuid FOR SHARE;
 IF NOT FOUND OR place_job.listing_id IS DISTINCT FROM p_listing THEN RAISE EXCEPTION 'geography_place_capture_mismatch';END IF;END IF;
 IF report#>>'{candidate,evidence_kind}'='reviewed_official_wix_business_location'THEN
 SELECT * INTO wix_job FROM zoi.geography_repair_jobs WHERE id=((report#>>'{candidate,wix_evidence_text}')::jsonb#>>'{capture,job_id}')::uuid FOR SHARE;
 IF NOT FOUND OR wix_job.listing_id IS DISTINCT FROM p_listing THEN RAISE EXCEPTION 'geography_wix_capture_mismatch';END IF;END IF;
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
 IF c?'wix_evidence_text'AND c->>'evidence_kind'IS DISTINCT FROM 'reviewed_official_wix_business_location'THEN RAISE EXCEPTION 'geography_wix_kind_mismatch';END IF;
 IF c?'place_evidence_text'AND c->>'evidence_kind'IS DISTINCT FROM 'reviewed_official_place_destination'THEN RAISE EXCEPTION 'geography_place_kind_mismatch';END IF;
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
 OR coalesce(c->>'evidence_kind','') NOT IN('jsonld','official_destination','reviewed_named_place_shortlink','reviewed_official_place_destination','reviewed_official_wix_business_location')
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
 IF c->>'evidence_kind'='reviewed_official_place_destination'THEN
 IF length(btrim(coalesce(report->>'collector','')))NOT BETWEEN 1 AND 160 OR lower(btrim(report->>'collector'))IS DISTINCT FROM lower(btrim(p_review->>'specialist'))THEN RAISE EXCEPTION 'geography_place_independent_review_required';END IF;
 place_proof:=zoi.geography_reviewed_place_proof(c,p_review,l,place_job);
 IF place_proof#>>'{capture,source_url}'IS DISTINCT FROM report->>'source_url'OR place_proof#>>'{capture,source_sha256}'IS DISTINCT FROM report->>'source_sha256'THEN RAISE EXCEPTION 'geography_place_capture_mismatch';END IF;END IF;
 IF c->>'evidence_kind'='reviewed_official_wix_business_location'THEN
 IF length(btrim(coalesce(report->>'collector','')))NOT BETWEEN 1 AND 160 OR lower(btrim(report->>'collector'))IS DISTINCT FROM lower(btrim(p_review->>'specialist'))THEN RAISE EXCEPTION 'geography_wix_independent_review_required';END IF;
 wix_proof:=zoi.geography_reviewed_wix_proof(c,p_review,l,wix_job);
 IF wix_proof#>>'{documents,0,source_url}'IS DISTINCT FROM report->>'source_url'OR wix_proof#>>'{documents,0,source_sha256}'IS DISTINCT FROM report->>'source_sha256'THEN RAISE EXCEPTION 'geography_wix_capture_mismatch';END IF;END IF;
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
 IF place_proof IS NOT NULL THEN place_before:=l;place_geo:=jsonb_build_object('precision','street','method','reviewed_official_place_destination','evidence_kind','reviewed_official_place_destination','source_url',report->>'source_url','source_sha256',report->>'source_sha256','report_sha256',report_hash,'reviewer',p_review->>'reviewer','reviewed_at',review_time,'request_id',p_request,'place_proof_sha256',p_review->>'place_proof_sha256','source_job_id',place_job.id,'place_id',c->>'place_id','contact_card_sha256',place_proof#>>'{card,sha256}','source_link_occurrence_sha256',place_proof#>>'{selected,sha256}');END IF;
 IF wix_proof IS NOT NULL THEN wix_before:=l;wix_geo:=jsonb_build_object('precision','street','method','reviewed_official_wix_business_location','evidence_kind','reviewed_official_wix_business_location','source_url',report->>'source_url','source_sha256',report->>'source_sha256','report_sha256',report_hash,'reviewer',p_review->>'reviewer','reviewed_at',review_time,'request_id',p_request,'wix_proof_sha256',p_review->>'wix_proof_sha256','source_job_id',wix_job.id,'typed_business_point',wix_proof#>'{documents,0,point}','source_inventory_sha256',p_review->>'source_inventory_sha256','primary_property_sha256',p_review->>'primary_property_sha256','point_role','typed_business_location','not_roof_or_entrance_precision',true);END IF;
 UPDATE zoi.listings SET latitude=lat,longitude=lng,geo_precision='street',
 profile=coalesce(l.profile,'{}'::jsonb)||jsonb_build_object('_geo',CASE WHEN wix_proof IS NOT NULL THEN wix_geo WHEN place_proof IS NOT NULL THEN place_geo ELSE jsonb_build_object(
 'precision','street','method','reviewed_official_source','source_url',report->>'source_url',
 'source_sha256',report->>'source_sha256','report_sha256',report_hash,'reviewer',p_review->>'reviewer',
 'reviewed_at',review_time,'request_id',p_request)END),updated_at=clock_timestamp()
 WHERE id=p_listing RETURNING * INTO l;
 IF wix_proof IS NOT NULL AND(NOT FOUND OR to_jsonb(l)IS DISTINCT FROM(to_jsonb(wix_before)||jsonb_build_object('latitude',lat,'longitude',lng,'geo_precision','street','profile',coalesce(wix_before.profile,'{}'::jsonb)||jsonb_build_object('_geo',wix_geo),'updated_at',transaction_timestamp()))OR(SELECT to_jsonb(actual_row)FROM zoi.listings actual_row WHERE actual_row.id=p_listing)IS DISTINCT FROM to_jsonb(l))THEN RAISE EXCEPTION 'geography_wix_unexpected_listing_change';END IF;
 IF place_proof IS NOT NULL AND(NOT FOUND OR to_jsonb(l)IS DISTINCT FROM(to_jsonb(place_before)||jsonb_build_object('latitude',lat,'longitude',lng,'geo_precision','street','profile',coalesce(place_before.profile,'{}'::jsonb)||jsonb_build_object('_geo',place_geo),'updated_at',transaction_timestamp()))OR(SELECT to_jsonb(actual_row)FROM zoi.listings actual_row WHERE actual_row.id=p_listing)IS DISTINCT FROM to_jsonb(l))THEN RAISE EXCEPTION 'geography_place_unexpected_listing_change';END IF;
 receipt:=jsonb_build_object('ok',true,'request_id',p_request,'listing_id',p_listing,
 'latitude',l.latitude,'longitude',l.longitude,'precision',l.geo_precision,'report_sha256',report_hash,
 'after_snapshot',zoi.geography_fingerprint(l));
 IF NOT zoi.geography_read_source_allowed(l) THEN RAISE EXCEPTION 'geography_source_authority_held';END IF;
 INSERT INTO zoi.geography_reviews(request_id,listing_id,payload,receipt,before_geo,after_fingerprint,read_authority_fingerprint)
 VALUES(p_request,p_listing,payload,receipt,before_geo,zoi.geography_fingerprint(l),zoi.geography_read_authority_fingerprint(l));
 RETURN receipt;
END $function$
;
NOTIFY pgrst,'reload schema';
COMMIT;
