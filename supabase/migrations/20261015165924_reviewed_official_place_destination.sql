BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='20s';
-- New-kind-only reviewed place evidence. No listing/job writes by migration.
-- Existing fingerprint/read/revert/epoch and job application CAS are unchanged.
DO $guard$ DECLARE expected jsonb;actual record;BEGIN
 IF to_regprocedure('zoi.geography_reviewed_place_proof(jsonb,jsonb,zoi.listings,zoi.geography_repair_jobs)')IS NOT NULL THEN RAISE EXCEPTION 'geography_place_extension_exists';END IF;
 FOR expected IN SELECT value FROM jsonb_array_elements($contracts$[{"signature":"public.geography_repair_record_application(uuid,uuid)","md5":"3f9e0896e6308211fd0366917f2ae68c","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"signature":"public.geography_review_apply(uuid,uuid,text,text,jsonb)","md5":"856ab1b56548ee6d68677dade4bc4fbd","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"signature":"public.geography_review_revert(uuid,text)","md5":"e6f2ba4421641428065b817ad47bd3e8","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"signature":"public.geography_reviewed_point(uuid)","md5":"a3320206addf52bd1bf5521ca1ac6cd9","owner":"postgres","acl":"{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"s"},{"signature":"zoi.geography_fingerprint(zoi.listings)","md5":"b77ed3d5d9004f1957503c2f848fe4c8","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"s"},{"signature":"zoi.geography_read_authority_changed()","md5":"baca38034b9b0974465026eff8aec89d","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"signature":"zoi.geography_read_authority_fingerprint(zoi.listings)","md5":"2757c108471ef5a863f4700e615e34d8","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"s"},{"signature":"zoi.geography_read_authority_input(zoi.listings)","md5":"3a452d0b2b9902436360a47d3a575e4e","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_repair_input(zoi.listings)","md5":"e2b3362b5f0ee526063b9d5d4665256b","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_source_listing_changed()","md5":"2d8c2ea0fb88550e057c51004100add1","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"signature":"zoi.claim_owner_changed()","md5":"e16849417c9c87d6a2ad8a4482dbb051","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"signature":"zoi.guard_listing_quality_receipts()","md5":"f0ebb7ba92e72b6bd34b43acc2676789","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"v"},{"signature":"zoi.ensure_listing_slug()","md5":"86de5ced4bc9ae28b48240ee6b149323","owner":"postgres","acl":null,"config":["search_path=\"\""],"security_definer":false,"volatility":"v"},{"signature":"zoi.tg_apply_publish_gate()","md5":"48db3959fc1281e9f09af3ff8164dae6","owner":"postgres","acl":null,"config":["search_path=\"\""],"security_definer":false,"volatility":"v"},{"signature":"zoi.skip_noop_listing_update()","md5":"059ca37c376f88162bc84423c543b024","owner":"postgres","acl":null,"config":["search_path=zoi, public"],"security_definer":false,"volatility":"v"},{"signature":"zoi.maintain_seo_identity_keys()","md5":"a6d10dbbedb1f4a9aff4a3010b3a03d0","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"signature":"zoi.auto_seo_fill()","md5":"f3f56fbc83395559e0b883f610182017","owner":"postgres","acl":null,"config":["search_path=\"\""],"security_definer":false,"volatility":"v"},{"signature":"zoi.set_updated_at()","md5":"1f8b6687e304c5f6502235344d4f0b7a","owner":"postgres","acl":null,"config":["search_path=\"\""],"security_definer":false,"volatility":"v"},{"signature":"zoi.maintain_seo_projection()","md5":"f17b227663468c63feaafdda7caf903f","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"signature":"zoi.geography_publisher_held(zoi.listings)","md5":"c81c146a5aebfa684c5223eb4d18f3a7","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_publisher_host(text)","md5":"18f04ea6d4ae44e2a6b7f6d9258e8e9c","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_repair_strategy_input(zoi.listings,text)","md5":"a87a595c8e9db085fb12e066aa66f1fd","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_source_authority_input(zoi.listings)","md5":"4a83d0513384898300eb5e924f12f59a","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_source_eligible(zoi.listings)","md5":"de128d988072e26b8c5b2c0bd6d5d65f","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"s"},{"signature":"zoi.geography_source_enqueue_one(zoi.listings,text,bigint)","md5":"1c1408dd9992138e1dd7a6490c17f88b","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"signature":"zoi.geography_source_generation(uuid)","md5":"d9bde7523cd57ea383fa2f77ec609e89","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"s"},{"signature":"zoi.publish_gate(text,text,bigint,text,text,text,text,text)","md5":"905be3e3473f808c3c50a4a6f5e7279c","owner":"postgres","acl":null,"config":["search_path=pg_catalog, pg_temp"],"security_definer":false,"volatility":"i"},{"signature":"zoi.seo_name(text,text)","md5":"6681315c7a01314ba7851d65c6fd2dce","owner":"postgres","acl":"{postgres=X/postgres}","config":null,"security_definer":false,"volatility":"i"},{"signature":"zoi.seo_text(text)","md5":"45ca783e5e2b06098a7c025a69347b9f","owner":"postgres","acl":"{postgres=X/postgres}","config":null,"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_url_component(text)","md5":"33ecf575f3c07144a0f90177791f03f3","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.listing_quality(text,text,text,text,bigint,text)","md5":"6d842320cba4f04697493b746ecea663","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog, pg_temp"],"security_definer":false,"volatility":"i"},{"signature":"zoi.schema_type(text,text)","md5":"979e6dbac201900f10e2a1cdb7a4d226","owner":"postgres","acl":null,"config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.seo_pluralize(text)","md5":"3a441e4585bf57f2b1da52a9c816029b","owner":"postgres","acl":null,"config":null,"security_definer":false,"volatility":"i"},{"signature":"zoi.seo_slug(text)","md5":"9b36fe6c6fabbe222376430aacf73323","owner":"postgres","acl":null,"config":null,"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_read_source_allowed(zoi.listings)","md5":"ecae4cf96a5794c0eb44154b145ef6eb","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"}]$contracts$::jsonb)LOOP
 SELECT md5(pg_get_functiondef(proc.oid))AS md5,pg_get_userbyid(proc.proowner)AS owner,proc.proacl::text AS acl,proc.proconfig AS config,proc.prosecdef AS security_definer,proc.provolatile::text AS volatility INTO actual FROM pg_proc proc WHERE proc.oid=to_regprocedure(expected->>'signature');
 IF to_jsonb(actual)IS DISTINCT FROM expected-'signature'THEN RAISE EXCEPTION 'geography_place_dependency_drift:%',expected->>'signature';END IF;END LOOP;
 IF(SELECT jsonb_agg(jsonb_build_object('name',tg.tgname,'trigger',CASE WHEN tg.tgname='geography_source_listing_update'AND pg_get_triggerdef(tg.oid)='CREATE CONSTRAINT TRIGGER geography_source_listing_update AFTER UPDATE ON zoi.listings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (((old.name IS DISTINCT FROM new.name) OR (old.entity_type IS DISTINCT FROM new.entity_type) OR (old.address IS DISTINCT FROM new.address) OR (old.city IS DISTINCT FROM new.city) OR (old.country IS DISTINCT FROM new.country) OR (old.website IS DISTINCT FROM new.website) OR (old.source_url IS DISTINCT FROM new.source_url) OR (old.latitude IS DISTINCT FROM new.latitude) OR (old.longitude IS DISTINCT FROM new.longitude) OR (old.geo_precision IS DISTINCT FROM new.geo_precision) OR (old.owner_user_id IS DISTINCT FROM new.owner_user_id) OR (old.owner_workspace_id IS DISTINCT FROM new.owner_workspace_id) OR (old.publish_status IS DISTINCT FROM new.publish_status) OR (old.moderation_status IS DISTINCT FROM new.moderation_status) OR (old.marketplace_status IS DISTINCT FROM new.marketplace_status) OR (old.duplicate_status IS DISTINCT FROM new.duplicate_status) OR ((old.profile -> ''_geo''::text) IS DISTINCT FROM (new.profile -> ''_geo''::text)) OR ((old.profile #> ''{_enrich,blocked_reason}''::text[]) IS DISTINCT FROM (new.profile #> ''{_enrich,blocked_reason}''::text[])) OR ((old.profile #> ''{_enrich,scope_review_required}''::text[]) IS DISTINCT FROM (new.profile #> ''{_enrich,scope_review_required}''::text[])) OR ((old.profile #> ''{_enrich,organization_identity_quarantine}''::text[]) IS DISTINCT FROM (new.profile #> ''{_enrich,organization_identity_quarantine}''::text[])))) EXECUTE FUNCTION zoi.geography_source_listing_changed()'THEN 'CREATE CONSTRAINT TRIGGER geography_source_listing_update AFTER UPDATE ON zoi.listings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN ((((((((((((((((((old.name IS DISTINCT FROM new.name) OR (old.entity_type IS DISTINCT FROM new.entity_type)) OR (old.address IS DISTINCT FROM new.address)) OR (old.city IS DISTINCT FROM new.city)) OR (old.country IS DISTINCT FROM new.country)) OR (old.website IS DISTINCT FROM new.website)) OR (old.source_url IS DISTINCT FROM new.source_url)) OR (old.latitude IS DISTINCT FROM new.latitude)) OR (old.longitude IS DISTINCT FROM new.longitude)) OR (old.geo_precision IS DISTINCT FROM new.geo_precision)) OR (old.owner_user_id IS DISTINCT FROM new.owner_user_id)) OR (old.owner_workspace_id IS DISTINCT FROM new.owner_workspace_id)) OR (old.publish_status IS DISTINCT FROM new.publish_status)) OR (old.moderation_status IS DISTINCT FROM new.moderation_status)) OR (old.marketplace_status IS DISTINCT FROM new.marketplace_status)) OR (old.duplicate_status IS DISTINCT FROM new.duplicate_status)) OR ((old.profile -> ''_geo''::text) IS DISTINCT FROM (new.profile -> ''_geo''::text)) OR ((old.profile #> ''{_enrich,blocked_reason}''::text[]) IS DISTINCT FROM (new.profile #> ''{_enrich,blocked_reason}''::text[])) OR ((old.profile #> ''{_enrich,scope_review_required}''::text[]) IS DISTINCT FROM (new.profile #> ''{_enrich,scope_review_required}''::text[])) OR ((old.profile #> ''{_enrich,organization_identity_quarantine}''::text[]) IS DISTINCT FROM (new.profile #> ''{_enrich,organization_identity_quarantine}''::text[])))) EXECUTE FUNCTION zoi.geography_source_listing_changed()'ELSE pg_get_triggerdef(tg.oid)END,'enabled',tg.tgenabled::text,'signature',proc.oid::regprocedure::text,'md5',md5(pg_get_functiondef(proc.oid)),'owner',pg_get_userbyid(proc.proowner),'acl',proc.proacl::text,'config',proc.proconfig,'security_definer',proc.prosecdef,'volatility',proc.provolatile::text)ORDER BY tg.tgname)FROM pg_trigger tg JOIN pg_proc proc ON proc.oid=tg.tgfoid WHERE tg.tgrelid='zoi.listings'::regclass AND NOT tg.tgisinternal)IS DISTINCT FROM $triggers$[{"name":"geography_read_authority_changed","trigger":"CREATE TRIGGER geography_read_authority_changed AFTER UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.geography_read_authority_changed()","enabled":"O","signature":"zoi.geography_read_authority_changed()","md5":"baca38034b9b0974465026eff8aec89d","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"name":"geography_source_listing_insert","trigger":"CREATE CONSTRAINT TRIGGER geography_source_listing_insert AFTER INSERT ON zoi.listings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION zoi.geography_source_listing_changed()","enabled":"O","signature":"zoi.geography_source_listing_changed()","md5":"2d8c2ea0fb88550e057c51004100add1","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"name":"geography_source_listing_update","trigger":"CREATE CONSTRAINT TRIGGER geography_source_listing_update AFTER UPDATE ON zoi.listings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN ((((((((((((((((((old.name IS DISTINCT FROM new.name) OR (old.entity_type IS DISTINCT FROM new.entity_type)) OR (old.address IS DISTINCT FROM new.address)) OR (old.city IS DISTINCT FROM new.city)) OR (old.country IS DISTINCT FROM new.country)) OR (old.website IS DISTINCT FROM new.website)) OR (old.source_url IS DISTINCT FROM new.source_url)) OR (old.latitude IS DISTINCT FROM new.latitude)) OR (old.longitude IS DISTINCT FROM new.longitude)) OR (old.geo_precision IS DISTINCT FROM new.geo_precision)) OR (old.owner_user_id IS DISTINCT FROM new.owner_user_id)) OR (old.owner_workspace_id IS DISTINCT FROM new.owner_workspace_id)) OR (old.publish_status IS DISTINCT FROM new.publish_status)) OR (old.moderation_status IS DISTINCT FROM new.moderation_status)) OR (old.marketplace_status IS DISTINCT FROM new.marketplace_status)) OR (old.duplicate_status IS DISTINCT FROM new.duplicate_status)) OR ((old.profile -> '_geo'::text) IS DISTINCT FROM (new.profile -> '_geo'::text)) OR ((old.profile #> '{_enrich,blocked_reason}'::text[]) IS DISTINCT FROM (new.profile #> '{_enrich,blocked_reason}'::text[])) OR ((old.profile #> '{_enrich,scope_review_required}'::text[]) IS DISTINCT FROM (new.profile #> '{_enrich,scope_review_required}'::text[])) OR ((old.profile #> '{_enrich,organization_identity_quarantine}'::text[]) IS DISTINCT FROM (new.profile #> '{_enrich,organization_identity_quarantine}'::text[])))) EXECUTE FUNCTION zoi.geography_source_listing_changed()","enabled":"O","signature":"zoi.geography_source_listing_changed()","md5":"2d8c2ea0fb88550e057c51004100add1","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"name":"listing_claim_owner_epoch","trigger":"CREATE TRIGGER listing_claim_owner_epoch AFTER UPDATE OF owner_workspace_id, owner_user_id ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.claim_owner_changed()","enabled":"O","signature":"zoi.claim_owner_changed()","md5":"e16849417c9c87d6a2ad8a4482dbb051","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"name":"listing_quality_receipts_guard","trigger":"CREATE TRIGGER listing_quality_receipts_guard BEFORE INSERT OR UPDATE OF profile ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.guard_listing_quality_receipts()","enabled":"O","signature":"zoi.guard_listing_quality_receipts()","md5":"f0ebb7ba92e72b6bd34b43acc2676789","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"v"},{"name":"listings_aa_slug","trigger":"CREATE TRIGGER listings_aa_slug BEFORE INSERT OR UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.ensure_listing_slug()","enabled":"O","signature":"zoi.ensure_listing_slug()","md5":"86de5ced4bc9ae28b48240ee6b149323","owner":"postgres","acl":null,"config":["search_path=\"\""],"security_definer":false,"volatility":"v"},{"name":"listings_publish_gate","trigger":"CREATE TRIGGER listings_publish_gate BEFORE INSERT ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.tg_apply_publish_gate()","enabled":"O","signature":"zoi.tg_apply_publish_gate()","md5":"48db3959fc1281e9f09af3ff8164dae6","owner":"postgres","acl":null,"config":["search_path=\"\""],"security_definer":false,"volatility":"v"},{"name":"listings_skip_noop","trigger":"CREATE TRIGGER listings_skip_noop BEFORE UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.skip_noop_listing_update()","enabled":"O","signature":"zoi.skip_noop_listing_update()","md5":"059ca37c376f88162bc84423c543b024","owner":"postgres","acl":null,"config":["search_path=zoi, public"],"security_definer":false,"volatility":"v"},{"name":"maintain_seo_identity_keys","trigger":"CREATE TRIGGER maintain_seo_identity_keys AFTER INSERT OR UPDATE OF id, name, city, region, country, address ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.maintain_seo_identity_keys()","enabled":"O","signature":"zoi.maintain_seo_identity_keys()","md5":"a6d10dbbedb1f4a9aff4a3010b3a03d0","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"name":"trg_listings_auto_seo","trigger":"CREATE TRIGGER trg_listings_auto_seo BEFORE INSERT OR UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.auto_seo_fill()","enabled":"O","signature":"zoi.auto_seo_fill()","md5":"f3f56fbc83395559e0b883f610182017","owner":"postgres","acl":null,"config":["search_path=\"\""],"security_definer":false,"volatility":"v"},{"name":"trg_listings_updated","trigger":"CREATE TRIGGER trg_listings_updated BEFORE UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.set_updated_at()","enabled":"O","signature":"zoi.set_updated_at()","md5":"1f8b6687e304c5f6502235344d4f0b7a","owner":"postgres","acl":null,"config":["search_path=\"\""],"security_definer":false,"volatility":"v"},{"name":"zz_maintain_seo_projection","trigger":"CREATE TRIGGER zz_maintain_seo_projection AFTER INSERT OR UPDATE OF id, name, city, region, country, address, slug, entity_type, updated_at, created_at, phone, website, latitude, description, publish_status, moderation_status, marketplace_status, duplicate_status ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.maintain_seo_projection()","enabled":"O","signature":"zoi.maintain_seo_projection()","md5":"f17b227663468c63feaafdda7caf903f","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"}]$triggers$::jsonb THEN RAISE EXCEPTION 'geography_place_listing_trigger_drift';END IF;
END $guard$;
CREATE FUNCTION zoi.geography_place_html_decode(value text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $fn$
DECLARE result text:='';remaining text:=value;m text[];prefix text;entity text;n bigint;BEGIN
 IF value IS NULL OR octet_length(value)>8192 THEN RAISE EXCEPTION 'geography_place_html_invalid';END IF;
 LOOP m:=regexp_match(remaining,'(&amp;|&quot;|&apos;|&nbsp;|&lt;|&gt;|&#[0-9]+;|&#x[0-9a-f]+;)','i');EXIT WHEN m IS NULL;
 entity:=m[1];prefix:=split_part(remaining,entity,1);result:=result||prefix;
 IF lower(entity)IN('&amp;','&quot;','&apos;','&nbsp;','&lt;','&gt;')THEN result:=result||CASE lower(entity)WHEN '&amp;'THEN '&'WHEN '&quot;'THEN '"'WHEN '&apos;'THEN chr(39)WHEN '&nbsp;'THEN ' 'WHEN '&lt;'THEN '<'ELSE '>'END;
 ELSE IF lower(left(entity,3))='&#x'THEN IF length(entity)>12 THEN RAISE EXCEPTION 'geography_place_html_invalid';END IF;n:=('x'||lpad(substring(entity FROM 4 FOR length(entity)-4),8,'0'))::bit(32)::bigint;ELSE n:=substring(entity FROM 3 FOR length(entity)-3)::bigint;END IF;
 IF n<1 OR n>1114111 OR n BETWEEN 55296 AND 57343 THEN RAISE EXCEPTION 'geography_place_html_invalid';END IF;result:=result||chr(n::integer);END IF;
 remaining:=substring(remaining FROM length(prefix)+length(entity)+1);
 END LOOP;RETURN result||remaining;
END $fn$;
CREATE FUNCTION zoi.geography_place_norm(value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $fn$ SELECT btrim(regexp_replace(lower(normalize(value,NFKC)),'[[:punct:][:space:]]+',' ','g')) $fn$;
CREATE FUNCTION zoi.geography_place_anchor_href(anchor text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $fn$
DECLARE at integer:=3;total integer:=length(anchor);key text;value text;quote text;keys text[]:='{}';href text;char text;m text[];start_at integer;BEGIN
 IF octet_length(anchor)>4096 OR anchor!~*'^<a[[:space:]>]'OR anchor!~*'</a[[:space:]]*>$'OR anchor~*'<!--|<(script|style|noscript|template|svg)[[:space:]>]|<a[[:space:]>].*<a[[:space:]>]'THEN RAISE EXCEPTION 'geography_place_anchor_invalid';END IF;
 LOOP
 WHILE at<=total AND substring(anchor FROM at FOR 1)~'[[:space:]]'LOOP at:=at+1;END LOOP;EXIT WHEN substring(anchor FROM at FOR 1)='>';
 m:=regexp_match(substring(anchor FROM at),'^([^[:space:]=<>"''`/]+)');IF m IS NULL THEN RAISE EXCEPTION 'geography_place_anchor_invalid';END IF;key:=lower(m[1]);IF key=ANY(keys)THEN RAISE EXCEPTION 'geography_place_anchor_invalid';END IF;keys:=array_append(keys,key);at:=at+length(m[1]);
 WHILE at<=total AND substring(anchor FROM at FOR 1)~'[[:space:]]'LOOP at:=at+1;END LOOP;value:='';
 IF substring(anchor FROM at FOR 1)='='THEN at:=at+1;WHILE at<=total AND substring(anchor FROM at FOR 1)~'[[:space:]]'LOOP at:=at+1;END LOOP;quote:=substring(anchor FROM at FOR 1);IF quote NOT IN('"',chr(39))THEN RAISE EXCEPTION 'geography_place_anchor_invalid';END IF;at:=at+1;start_at:=at;
 LOOP IF at>total THEN RAISE EXCEPTION 'geography_place_anchor_invalid';END IF;EXIT WHEN substring(anchor FROM at FOR 1)=quote;at:=at+1;END LOOP;value:=zoi.geography_place_html_decode(substring(anchor FROM start_at FOR at-start_at));at:=at+1;END IF;
 IF key='href'THEN href:=value;END IF;
 IF key='hidden'OR(key='aria-hidden'AND value='true')OR(key='style'AND value~*'display[[:space:]]*:[[:space:]]*none|visibility[[:space:]]*:[[:space:]]*hidden')THEN RAISE EXCEPTION 'geography_place_anchor_invalid';END IF;
 END LOOP;
 IF href IS NULL OR at>total THEN RAISE EXCEPTION 'geography_place_anchor_invalid';END IF;RETURN href;
END $fn$;
CREATE FUNCTION zoi.geography_place_quote(card bytea,quote jsonb,literal text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $fn$
DECLARE start_at integer;end_at integer;raw text;visible text;BEGIN
 IF jsonb_typeof(quote)IS DISTINCT FROM 'object'OR jsonb_typeof(quote->'start_byte')IS DISTINCT FROM 'number'OR jsonb_typeof(quote->'end_byte')IS DISTINCT FROM 'number'OR coalesce(quote->>'start_byte','')!~'^[0-9]+$'OR coalesce(quote->>'end_byte','')!~'^[0-9]+$'OR nullif(zoi.geography_place_norm(literal),'')IS NULL THEN RETURN false;END IF;
 start_at:=(quote->>'start_byte')::integer;end_at:=(quote->>'end_byte')::integer;IF start_at<0 OR end_at<=start_at OR end_at>octet_length(card)THEN RETURN false;END IF;
 raw:=convert_from(substring(card FROM start_at+1 FOR end_at-start_at),'UTF8');visible:=zoi.geography_place_norm(zoi.geography_place_html_decode(regexp_replace(raw,'<[^>]*>',' ','g')));
 RETURN encode(extensions.digest(convert_to(raw,'UTF8'),'sha256'),'hex')IS NOT DISTINCT FROM quote->>'sha256'AND strpos(' '||visible||' ',' '||zoi.geography_place_norm(literal)||' ')>0;
END $fn$;
CREATE FUNCTION zoi.geography_reviewed_place_proof(c jsonb,review jsonb,l zoi.listings,j zoi.geography_repair_jobs) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $fn$
DECLARE p jsonb;cap jsonb;card jsonb;items jsonb;selected jsonb;item jsonb;identity jsonb;address jsonb;country jsonb;b jsonb;entry record;parts text[];label text;raw_card text;raw_anchor text;visible text;card_bytes bytea;card_start integer;card_end integer;start_at integer;end_at integer;prior_end integer:=-1;source_bytes integer;chosen integer;index_at integer:=0;inventory_text text:='[';captured timestamptz;BEGIN
 IF c->>'evidence_kind'IS DISTINCT FROM 'reviewed_official_place_destination'OR jsonb_typeof(c->'place_evidence_text')IS DISTINCT FROM 'string'THEN RAISE EXCEPTION 'geography_place_proof_required';END IF;p:=(c->>'place_evidence_text')::jsonb;
 IF p->'schema'IS DISTINCT FROM '1'::jsonb OR p->'canonical_context'IS DISTINCT FROM jsonb_build_object('id',l.id,'name',l.name,'address',l.address,'city',l.city,'country',l.country,'website',l.website)
 OR l.owner_user_id IS NOT NULL OR l.owner_workspace_id IS NOT NULL OR coalesce(l.claim_status,'unclaimed')<>'unclaimed'OR l.duplicate_status='confirmed_duplicate'OR NOT zoi.geography_read_source_allowed(l)OR nullif(btrim(l.profile#>>'{_enrich,blocked_reason}'),'')IS NOT NULL
 OR review->>'place_proof_sha256'IS DISTINCT FROM encode(extensions.digest(convert_to(c->>'place_evidence_text','UTF8'),'sha256'),'hex')
 OR review->'exact_identity_confirmed'IS DISTINCT FROM 'true'::jsonb OR review->'exact_country_confirmed'IS DISTINCT FROM 'true'::jsonb OR review->'visible_branch_confirmed'IS DISTINCT FROM 'true'::jsonb OR review->'complete_link_inventory_confirmed'IS DISTINCT FROM 'true'::jsonb OR review->>'destination_purpose'IS DISTINCT FROM 'place_location'
 THEN RAISE EXCEPTION 'geography_place_independent_review_required';END IF;
 cap:=p->'capture';captured:=(cap->>'captured_at')::timestamptz;
 IF jsonb_typeof(cap)IS DISTINCT FROM 'object'OR cap->>'job_id'IS DISTINCT FROM j.id::text OR cap->>'listing_id'IS DISTINCT FROM l.id::text OR j.listing_id IS DISTINCT FROM l.id OR j.strategy IS DISTINCT FROM 'official_sources_v1'OR cap->>'strategy'IS DISTINCT FROM j.strategy
 OR j.status NOT IN('unresolved','needs_identity_review','needs_address_review','needs_coordinate_review','reviewed')OR j.lease_id IS NOT NULL OR j.completed_lease_id IS NULL OR cap->>'completed_lease_id'IS DISTINCT FROM j.completed_lease_id::text
 OR cap->>'input_fingerprint'IS DISTINCT FROM j.input_fingerprint OR j.input_fingerprint IS DISTINCT FROM zoi.geography_repair_input(l)
 OR cap->>'capture_result_hash'IS DISTINCT FROM j.capture_result_hash OR coalesce(j.capture_result_hash,'')!~'^[a-f0-9]{32}$'
 OR cap->>'source_json_sha256'IS DISTINCT FROM encode(extensions.digest(convert_to(j.source::text,'UTF8'),'sha256'),'hex')
 OR captured IS NULL OR NOT isfinite(captured) OR captured IS DISTINCT FROM j.captured_at OR captured<clock_timestamp()-interval '7days'OR captured>clock_timestamp()+interval '5minutes'
 OR cap->>'private_archive'IS DISTINCT FROM j.source->>'private_archive'OR cap->>'archive_format'IS DISTINCT FROM 'decoded_utf8_sha256'OR cap->>'archive_format'IS DISTINCT FROM j.source->>'archive_format'
 OR coalesce(cap->>'source_sha256','')!~'^[a-f0-9]{64}$'OR review->>'source_sha256'IS DISTINCT FROM cap->>'source_sha256'
 OR jsonb_typeof(cap->'source_bytes')IS DISTINCT FROM 'number'OR coalesce(cap->>'source_bytes','')!~'^[0-9]+$'OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(j.source->'pages')='array'THEN j.source->'pages'ELSE '[]'::jsonb END)page WHERE page->>'url'=cap->>'source_url'AND page->>'sha256'=cap->>'source_sha256'AND page->'http_status'='200'::jsonb)
 THEN RAISE EXCEPTION 'geography_place_capture_mismatch';END IF;
 source_bytes:=(cap->>'source_bytes')::integer;
 IF source_bytes NOT BETWEEN 1 AND 1500000 OR NOT EXISTS(SELECT 1 FROM storage.buckets bucket JOIN storage.objects obj ON obj.bucket_id=bucket.id WHERE bucket.id=cap->>'private_archive'AND bucket.public=false AND obj.name=(cap->>'source_sha256')||'.html'AND obj.metadata->>'size'~'^[0-9]+$'AND(obj.metadata->>'size')::bigint=source_bytes)
 THEN RAISE EXCEPTION 'geography_place_private_archive_required';END IF;
 card:=p->'card';raw_card:=card->>'html';card_bytes:=convert_to(raw_card,'UTF8');
 IF jsonb_typeof(card)IS DISTINCT FROM 'object'OR jsonb_typeof(card->'start_byte')IS DISTINCT FROM 'number'OR jsonb_typeof(card->'end_byte')IS DISTINCT FROM 'number'OR octet_length(card_bytes)NOT BETWEEN 1 AND 8192 OR coalesce(card->>'start_byte','')!~'^[0-9]+$'OR coalesce(card->>'end_byte','')!~'^[0-9]+$'OR card->>'sha256'IS DISTINCT FROM encode(extensions.digest(card_bytes,'sha256'),'hex')OR raw_card~*'<!--|<(script|style|noscript|template|svg)[[:space:]>]|<[a-z][^>]*[[:space:]]hidden([[:space:]=]|>)|<[a-z][^>]*aria-hidden[[:space:]]*=[[:space:]]*["'']true|<[a-z][^>]*(display[[:space:]]*:[[:space:]]*none|visibility[[:space:]]*:[[:space:]]*hidden)'
 THEN RAISE EXCEPTION 'geography_place_card_required';END IF;
 card_start:=(card->>'start_byte')::integer;card_end:=(card->>'end_byte')::integer;IF card_start<0 OR card_end<>card_start+octet_length(card_bytes)OR card_end>source_bytes THEN RAISE EXCEPTION 'geography_place_card_required';END IF;
 items:=p->'occurrences';selected:=p->'selected';IF jsonb_typeof(items)IS DISTINCT FROM 'array'OR jsonb_array_length(items)NOT BETWEEN 1 AND 8 OR jsonb_typeof(selected->'index')IS DISTINCT FROM 'number'OR coalesce(selected->>'index','')!~'^[0-9]+$'THEN RAISE EXCEPTION 'geography_place_occurrence_required';END IF;chosen:=(selected->>'index')::integer;
 IF chosen<0 OR chosen>=jsonb_array_length(items)THEN RAISE EXCEPTION 'geography_place_occurrence_required';END IF;
 FOR entry IN SELECT value,ordinality FROM jsonb_array_elements(items)WITH ORDINALITY LOOP
 item:=entry.value;
 IF jsonb_typeof(item)IS DISTINCT FROM 'object'OR (SELECT count(*)FROM jsonb_object_keys(item))<>4 OR jsonb_typeof(item->'start_byte')IS DISTINCT FROM 'number'OR jsonb_typeof(item->'end_byte')IS DISTINCT FROM 'number'OR coalesce(item->>'start_byte','')!~'^[0-9]+$'OR coalesce(item->>'end_byte','')!~'^[0-9]+$'OR coalesce(item->>'sha256','')!~'^[a-f0-9]{64}$'OR item->>'href'IS DISTINCT FROM c->>'evidence_url'THEN RAISE EXCEPTION 'geography_place_occurrence_required';END IF;
 start_at:=(item->>'start_byte')::integer;end_at:=(item->>'end_byte')::integer;IF start_at<0 OR start_at<prior_end OR end_at<=start_at OR end_at>source_bytes OR end_at-start_at>4096 THEN RAISE EXCEPTION 'geography_place_occurrence_required';END IF;prior_end:=end_at;
 IF index_at>0 THEN inventory_text:=inventory_text||',';END IF;inventory_text:=inventory_text||'{"end_byte":'||(item->'end_byte')::text||',"href":'||(item->'href')::text||',"sha256":'||(item->'sha256')::text||',"start_byte":'||(item->'start_byte')::text||'}';
 IF index_at=chosen THEN
 IF jsonb_typeof(selected->'start_byte')IS DISTINCT FROM 'number'OR jsonb_typeof(selected->'end_byte')IS DISTINCT FROM 'number'OR coalesce(selected->>'start_byte','')!~'^[0-9]+$'OR coalesce(selected->>'end_byte','')!~'^[0-9]+$'OR card_start+(selected->>'start_byte')::integer<>start_at OR card_start+(selected->>'end_byte')::integer<>end_at OR start_at<card_start OR end_at>card_end THEN RAISE EXCEPTION 'geography_place_occurrence_required';END IF;
 raw_anchor:=convert_from(substring(card_bytes FROM start_at-card_start+1 FOR end_at-start_at),'UTF8');
 IF selected->>'sha256'IS DISTINCT FROM item->>'sha256'OR item->>'sha256'IS DISTINCT FROM encode(extensions.digest(convert_to(raw_anchor,'UTF8'),'sha256'),'hex')OR zoi.geography_place_anchor_href(raw_anchor)IS DISTINCT FROM c->>'evidence_url'THEN RAISE EXCEPTION 'geography_place_occurrence_required';END IF;
 END IF;index_at:=index_at+1;END LOOP;inventory_text:=inventory_text||']';
 IF p->>'inventory_sha256'IS DISTINCT FROM encode(extensions.digest(convert_to(inventory_text,'UTF8'),'sha256'),'hex')THEN RAISE EXCEPTION 'geography_place_inventory_mismatch';END IF;
 parts:=regexp_match(c->>'evidence_url','^https://www[.]google[.]com/maps/place/([^/]+)/@(-?[0-9]+(?:[.][0-9]+)?),(-?[0-9]+(?:[.][0-9]+)?),[0-9]+(?:[.][0-9]+)?z/data=!3m1!4b1!4m5!3m4!1s(0x[0-9a-f]+:0x[0-9a-f]+)!8m2!3d(-?[0-9]+(?:[.][0-9]+)?)!4d(-?[0-9]+(?:[.][0-9]+)?)$','i');
 IF parts IS NULL OR strpos(c->>'evidence_url','https://www.google.com/')<>1 OR c->>'evidence_url'!~'^[!-~]+$'OR c->>'evidence_url'~'[?#<>"`{}]'OR parts[1]IN('.','..')OR length(c->>'evidence_url')>3000 OR c->>'evidence_url'~'[[:space:]]|\\'OR parts[1]~*'%(2e|2f|5c|25)'THEN RAISE EXCEPTION 'geography_place_destination_mismatch';END IF;
 label:=zoi.geography_url_component(parts[1]);
 IF label IS NULL OR btrim(label)=''OR label~'[[:cntrl:]\\/]'OR p->>'literal_label'IS DISTINCT FROM label OR c->>'place_id'IS DISTINCT FROM parts[4]OR c->>'name'IS DISTINCT FROM l.name OR c->>'precision'IS DISTINCT FROM 'source_published'
 OR jsonb_typeof(c->'latitude')IS DISTINCT FROM 'number'OR jsonb_typeof(c->'longitude')IS DISTINCT FROM 'number'OR(parts[5])::double precision IS DISTINCT FROM(c->>'latitude')::double precision OR(parts[6])::double precision IS DISTINCT FROM(c->>'longitude')::double precision
 OR abs((parts[2])::double precision)>90 OR abs((parts[3])::double precision)>180 OR abs((parts[5])::double precision)>90 OR abs((parts[6])::double precision)>180 OR((parts[5])::double precision=0 AND(parts[6])::double precision=0)
 THEN RAISE EXCEPTION 'geography_place_destination_mismatch';END IF;
 identity:=p->'identity';address:=identity->'address';visible:=zoi.geography_place_norm(zoi.geography_place_html_decode(regexp_replace(raw_card,'<[^>]*>',' ','g')));
 IF length(btrim(coalesce(identity->>'source_name','')))NOT BETWEEN 1 AND 300 OR identity->'exact_name_confirmed'IS DISTINCT FROM 'true'::jsonb OR identity->'exact_address_confirmed'IS DISTINCT FROM 'true'::jsonb OR identity->'address_label_confirmed'IS DISTINCT FROM 'true'::jsonb OR address IS DISTINCT FROM c->'address'OR address->>'city'IS DISTINCT FROM l.city OR address->>'country'IS DISTINCT FROM l.country
 OR NOT zoi.geography_place_quote(card_bytes,identity#>'{quotes,name}',identity->>'source_name')OR NOT zoi.geography_place_quote(card_bytes,identity#>'{quotes,street}',address->>'street')OR NOT zoi.geography_place_quote(card_bytes,identity#>'{quotes,city}',address->>'city')
 OR(zoi.geography_place_norm(identity->>'source_name')IS DISTINCT FROM zoi.geography_place_norm(l.name)AND identity->'name_alias_confirmed'IS DISTINCT FROM 'true'::jsonb)
 OR identity->>'literal_address_label'IS DISTINCT FROM label OR strpos(' '||zoi.geography_place_norm(label)||' ',' '||zoi.geography_place_norm(l.city)||' ')=0
 OR strpos(' '||zoi.geography_place_norm(l.address)||' ',' '||zoi.geography_place_norm(address->>'street')||' ')=0
 OR visible~'(^| )(parking|car park|garage|nearby|recommended|other location)( |$)'THEN RAISE EXCEPTION 'geography_place_identity_required';END IF;
 country:=identity->'country_evidence';IF country->'confirmed'IS DISTINCT FROM 'true'::jsonb OR country->>'canonical_country'IS DISTINCT FROM l.country THEN RAISE EXCEPTION 'geography_place_country_required';END IF;
 IF country->>'kind'='literal_country'THEN
 IF zoi.geography_place_norm(country->>'literal_country')IS DISTINCT FROM zoi.geography_place_norm(l.country)OR NOT zoi.geography_place_quote(card_bytes,country->'quote',country->>'literal_country')THEN RAISE EXCEPTION 'geography_place_country_required';END IF;
 ELSIF country->>'kind'='primary_jurisdiction_reference'THEN
 IF country->'primary_reference'IS DISTINCT FROM 'true'::jsonb OR coalesce(country->>'source_url','')!~'^https://[^/:?#@]+/'OR coalesce(country->>'source_sha256','')!~'^[a-f0-9]{64}$'OR nullif(btrim(country->>'quote'),'')IS NULL OR country->>'region'IS DISTINCT FROM address->>'region'OR country->>'postal_code'IS DISTINCT FROM address->>'postal_code'OR nullif(zoi.geography_place_norm(country->>'region'),'')IS NULL OR nullif(zoi.geography_place_norm(country->>'postal_code'),'')IS NULL
 OR NOT zoi.geography_place_quote(card_bytes,identity#>'{quotes,region}',country->>'region')OR NOT zoi.geography_place_quote(card_bytes,identity#>'{quotes,postal_code}',country->>'postal_code')
 OR strpos(' '||zoi.geography_place_norm(country->>'quote')||' ',' '||zoi.geography_place_norm(country->>'region')||' ')=0 OR strpos(' '||zoi.geography_place_norm(country->>'quote')||' ',' '||zoi.geography_place_norm(country->>'postal_code')||' ')=0 THEN RAISE EXCEPTION 'geography_place_country_required';END IF;
 ELSE RAISE EXCEPTION 'geography_place_country_required';END IF;
 b:=p->'locality_extent';IF b IS DISTINCT FROM review->'locality_extent'OR coalesce(b->>'source_sha256','')!~'^[a-f0-9]{64}$'OR nullif(btrim(b->>'quote'),'')IS NULL OR strpos(' '||zoi.geography_place_norm(b->>'quote')||' ',' '||zoi.geography_place_norm(l.city)||' ')=0 THEN RAISE EXCEPTION 'geography_place_locality_required';END IF;
 RETURN p;
END $fn$;

ALTER FUNCTION zoi.geography_place_html_decode(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.geography_place_html_decode(text) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION zoi.geography_place_norm(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.geography_place_norm(text) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION zoi.geography_place_anchor_href(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.geography_place_anchor_href(text) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION zoi.geography_place_quote(bytea,jsonb,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.geography_place_quote(bytea,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION zoi.geography_reviewed_place_proof(jsonb,jsonb,zoi.listings,zoi.geography_repair_jobs) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.geography_reviewed_place_proof(jsonb,jsonb,zoi.listings,zoi.geography_repair_jobs) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.geography_review_apply(p_request uuid, p_listing uuid, p_expected text, p_report_text text, p_review jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 l zoi.listings; prior zoi.geography_reviews; report jsonb; c jsonb;b jsonb;
 place_job zoi.geography_repair_jobs;place_proof jsonb;place_before zoi.listings;place_geo jsonb;
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
 OR coalesce(c->>'evidence_kind','') NOT IN('jsonld','official_destination','reviewed_named_place_shortlink','reviewed_official_place_destination')
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
 UPDATE zoi.listings SET latitude=lat,longitude=lng,geo_precision='street',
 profile=coalesce(l.profile,'{}'::jsonb)||jsonb_build_object('_geo',CASE WHEN place_proof IS NOT NULL THEN place_geo ELSE jsonb_build_object(
 'precision','street','method','reviewed_official_source','source_url',report->>'source_url',
 'source_sha256',report->>'source_sha256','report_sha256',report_hash,'reviewer',p_review->>'reviewer',
 'reviewed_at',review_time,'request_id',p_request)END),updated_at=clock_timestamp()
 WHERE id=p_listing RETURNING * INTO l;
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
