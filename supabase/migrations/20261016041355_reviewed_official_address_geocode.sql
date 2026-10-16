BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='20s';
DO $guard$ DECLARE expected jsonb;actual record;BEGIN
 IF to_regprocedure('zoi.geography_reviewed_address_geocode_proof(jsonb,jsonb,zoi.listings,zoi.geography_repair_jobs)')IS NOT NULL THEN RAISE EXCEPTION 'geography_address_extension_exists';END IF;
 FOR expected IN SELECT value FROM jsonb_array_elements($contracts$[{"acl":"{postgres=X/postgres}","md5":"a6d10dbbedb1f4a9aff4a3010b3a03d0","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.maintain_seo_identity_keys()","volatility":"v","security_definer":true},{"acl":"{postgres=X/postgres}","md5":"d9bde7523cd57ea383fa2f77ec609e89","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_source_generation(uuid)","volatility":"s","security_definer":false},{"acl":null,"md5":"979e6dbac201900f10e2a1cdb7a4d226","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.schema_type(text,text)","volatility":"i","security_definer":false},{"acl":"{postgres=X/postgres}","md5":"a87a595c8e9db085fb12e066aa66f1fd","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_repair_strategy_input(zoi.listings,text)","volatility":"i","security_definer":false},{"acl":null,"md5":"86de5ced4bc9ae28b48240ee6b149323","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.ensure_listing_slug()","volatility":"v","security_definer":false},{"acl":"{postgres=X/postgres,service_role=X/postgres}","md5":"3f9e0896e6308211fd0366917f2ae68c","owner":"postgres","config":["search_path=\"\""],"signature":"public.geography_repair_record_application(uuid,uuid)","volatility":"v","security_definer":true},{"acl":"{postgres=X/postgres}","md5":"65dc127bf783ad7f87d9d656b9b8afaa","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_reviewed_place_proof(jsonb,jsonb,zoi.listings,zoi.geography_repair_jobs)","volatility":"s","security_definer":false},{"acl":"{postgres=X/postgres}","md5":"baca38034b9b0974465026eff8aec89d","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_read_authority_changed()","volatility":"v","security_definer":true},{"acl":"{postgres=X/postgres}","md5":"3a452d0b2b9902436360a47d3a575e4e","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_read_authority_input(zoi.listings)","volatility":"i","security_definer":false},{"acl":"{postgres=X/postgres}","md5":"ac9235a21dafc3931bfee9b06703796c","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_place_norm(text)","volatility":"i","security_definer":false},{"signature":"public.geography_review_apply(uuid,uuid,text,text,jsonb)","md5":"afacc98be456cde6e87e1951dab1e235","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"acl":"{postgres=X/postgres}","md5":"ecae4cf96a5794c0eb44154b145ef6eb","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_read_source_allowed(zoi.listings)","volatility":"i","security_definer":false},{"acl":"{postgres=X/postgres}","md5":"33ecf575f3c07144a0f90177791f03f3","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_url_component(text)","volatility":"i","security_definer":false},{"acl":null,"md5":"3a441e4585bf57f2b1da52a9c816029b","owner":"postgres","config":null,"signature":"zoi.seo_pluralize(text)","volatility":"i","security_definer":false},{"acl":"{postgres=X/postgres}","md5":"e16849417c9c87d6a2ad8a4482dbb051","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.claim_owner_changed()","volatility":"v","security_definer":true},{"acl":null,"md5":"f3f56fbc83395559e0b883f610182017","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.auto_seo_fill()","volatility":"v","security_definer":false},{"acl":"{postgres=X/postgres}","md5":"1c1408dd9992138e1dd7a6490c17f88b","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_source_enqueue_one(zoi.listings,text,bigint)","volatility":"v","security_definer":true},{"acl":null,"md5":"1f8b6687e304c5f6502235344d4f0b7a","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.set_updated_at()","volatility":"v","security_definer":false},{"acl":null,"md5":"059ca37c376f88162bc84423c543b024","owner":"postgres","config":["search_path=zoi, public"],"signature":"zoi.skip_noop_listing_update()","volatility":"v","security_definer":false},{"acl":"{postgres=X/postgres}","md5":"0f974f98a350a12633ddb0201f6ce25e","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_place_anchor_href(text)","volatility":"i","security_definer":false},{"acl":"{postgres=X/postgres}","md5":"18f04ea6d4ae44e2a6b7f6d9258e8e9c","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_publisher_host(text)","volatility":"i","security_definer":false},{"acl":"{postgres=X/postgres}","md5":"2370a3d4d34208172a01eb35751b2c0d","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_place_quote(bytea,jsonb,text)","volatility":"i","security_definer":false},{"acl":"{postgres=X/postgres}","md5":"4a83d0513384898300eb5e924f12f59a","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_source_authority_input(zoi.listings)","volatility":"i","security_definer":false},{"acl":null,"md5":"905be3e3473f808c3c50a4a6f5e7279c","owner":"postgres","config":["search_path=pg_catalog, pg_temp"],"signature":"zoi.publish_gate(text,text,bigint,text,text,text,text,text)","volatility":"i","security_definer":false},{"acl":null,"md5":"48db3959fc1281e9f09af3ff8164dae6","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.tg_apply_publish_gate()","volatility":"v","security_definer":false},{"acl":"{postgres=X/postgres}","md5":"45ca783e5e2b06098a7c025a69347b9f","owner":"postgres","config":null,"signature":"zoi.seo_text(text)","volatility":"i","security_definer":false},{"acl":"{postgres=X/postgres}","md5":"f0ebb7ba92e72b6bd34b43acc2676789","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.guard_listing_quality_receipts()","volatility":"v","security_definer":false},{"acl":"{postgres=X/postgres,service_role=X/postgres}","md5":"e6f2ba4421641428065b817ad47bd3e8","owner":"postgres","config":["search_path=\"\""],"signature":"public.geography_review_revert(uuid,text)","volatility":"v","security_definer":true},{"acl":"{postgres=X/postgres}","md5":"e2b3362b5f0ee526063b9d5d4665256b","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_repair_input(zoi.listings)","volatility":"i","security_definer":false},{"acl":"{postgres=X/postgres}","md5":"6681315c7a01314ba7851d65c6fd2dce","owner":"postgres","config":null,"signature":"zoi.seo_name(text,text)","volatility":"i","security_definer":false},{"acl":null,"md5":"9b36fe6c6fabbe222376430aacf73323","owner":"postgres","config":null,"signature":"zoi.seo_slug(text)","volatility":"i","security_definer":false},{"signature":"public.geography_reviewed_point(uuid)","md5":"a3320206addf52bd1bf5521ca1ac6cd9","owner":"postgres","acl":"{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"s"},{"acl":"{postgres=X/postgres}","md5":"b9949947fae26d1a1e265dd0abb99e36","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_place_html_decode(text)","volatility":"i","security_definer":false},{"acl":"{postgres=X/postgres}","md5":"6d842320cba4f04697493b746ecea663","owner":"postgres","config":["search_path=pg_catalog, pg_temp"],"signature":"zoi.listing_quality(text,text,text,text,bigint,text)","volatility":"i","security_definer":false},{"acl":"{postgres=X/postgres}","md5":"c81c146a5aebfa684c5223eb4d18f3a7","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_publisher_held(zoi.listings)","volatility":"i","security_definer":false},{"acl":"{postgres=X/postgres}","md5":"de128d988072e26b8c5b2c0bd6d5d65f","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_source_eligible(zoi.listings)","volatility":"s","security_definer":false},{"acl":"{postgres=X/postgres}","md5":"2d8c2ea0fb88550e057c51004100add1","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_source_listing_changed()","volatility":"v","security_definer":true},{"acl":"{postgres=X/postgres}","md5":"2757c108471ef5a863f4700e615e34d8","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_read_authority_fingerprint(zoi.listings)","volatility":"s","security_definer":false},{"acl":"{postgres=X/postgres,service_role=X/postgres}","md5":"b77ed3d5d9004f1957503c2f848fe4c8","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.geography_fingerprint(zoi.listings)","volatility":"s","security_definer":false},{"acl":"{postgres=X/postgres}","md5":"f17b227663468c63feaafdda7caf903f","owner":"postgres","config":["search_path=\"\""],"signature":"zoi.maintain_seo_projection()","volatility":"v","security_definer":true},{"signature":"zoi.geography_wix_json_unique(text)","md5":"807b0629928809083af5f52cb2df907c","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_wix_canonical(jsonb)","md5":"db155f78728954081ae91d1cf9c5a394","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_wix_source_url(text,text)","md5":"12bb8d281ae0c6a06c1b02240c11bcb8","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_wix_parcel_contains(jsonb,jsonb)","md5":"4321aaedba54d623daab5414fbdc7ff5","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"i"},{"signature":"zoi.geography_reviewed_wix_proof(jsonb,jsonb,zoi.listings,zoi.geography_repair_jobs)","md5":"9b3898864f43d09030fb5bd2250219c0","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=\"\""],"security_definer":false,"volatility":"s"},{"signature":"public.geography_source_capture_acquire(uuid)","md5":"8941c21efae7b8f687a2e839c6ba3eb2","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"signature":"public.geography_source_capture_release(uuid)","md5":"0554c412af77901a5f4a0d607bf2376a","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"v"},{"signature":"public.geography_source_archive_budget()","md5":"d2ecc17519cf06e5008f105a58fb45a6","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=\"\""],"security_definer":true,"volatility":"s"}]$contracts$::jsonb)LOOP
 SELECT md5(pg_get_functiondef(proc.oid))AS md5,pg_get_userbyid(proc.proowner)AS owner,proc.proacl::text AS acl,proc.proconfig AS config,proc.prosecdef AS security_definer,proc.provolatile::text AS volatility INTO actual FROM pg_proc proc WHERE proc.oid=to_regprocedure(expected->>'signature');
 IF to_jsonb(actual)IS DISTINCT FROM expected-'signature'THEN RAISE EXCEPTION 'geography_address_dependency_drift:%',expected->>'signature';END IF;END LOOP;
 IF(SELECT jsonb_agg(jsonb_build_object('name',tg.tgname,'enabled',tg.tgenabled::text,'trigger',CASE WHEN tg.tgname='geography_source_listing_update'AND pg_get_triggerdef(tg.oid)='CREATE CONSTRAINT TRIGGER geography_source_listing_update AFTER UPDATE ON zoi.listings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (((old.name IS DISTINCT FROM new.name) OR (old.entity_type IS DISTINCT FROM new.entity_type) OR (old.address IS DISTINCT FROM new.address) OR (old.city IS DISTINCT FROM new.city) OR (old.country IS DISTINCT FROM new.country) OR (old.website IS DISTINCT FROM new.website) OR (old.source_url IS DISTINCT FROM new.source_url) OR (old.latitude IS DISTINCT FROM new.latitude) OR (old.longitude IS DISTINCT FROM new.longitude) OR (old.geo_precision IS DISTINCT FROM new.geo_precision) OR (old.owner_user_id IS DISTINCT FROM new.owner_user_id) OR (old.owner_workspace_id IS DISTINCT FROM new.owner_workspace_id) OR (old.publish_status IS DISTINCT FROM new.publish_status) OR (old.moderation_status IS DISTINCT FROM new.moderation_status) OR (old.marketplace_status IS DISTINCT FROM new.marketplace_status) OR (old.duplicate_status IS DISTINCT FROM new.duplicate_status) OR ((old.profile -> ''_geo''::text) IS DISTINCT FROM (new.profile -> ''_geo''::text)) OR ((old.profile #> ''{_enrich,blocked_reason}''::text[]) IS DISTINCT FROM (new.profile #> ''{_enrich,blocked_reason}''::text[])) OR ((old.profile #> ''{_enrich,scope_review_required}''::text[]) IS DISTINCT FROM (new.profile #> ''{_enrich,scope_review_required}''::text[])) OR ((old.profile #> ''{_enrich,organization_identity_quarantine}''::text[]) IS DISTINCT FROM (new.profile #> ''{_enrich,organization_identity_quarantine}''::text[])))) EXECUTE FUNCTION zoi.geography_source_listing_changed()'THEN 'CREATE CONSTRAINT TRIGGER geography_source_listing_update AFTER UPDATE ON zoi.listings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN ((((((((((((((((((old.name IS DISTINCT FROM new.name) OR (old.entity_type IS DISTINCT FROM new.entity_type)) OR (old.address IS DISTINCT FROM new.address)) OR (old.city IS DISTINCT FROM new.city)) OR (old.country IS DISTINCT FROM new.country)) OR (old.website IS DISTINCT FROM new.website)) OR (old.source_url IS DISTINCT FROM new.source_url)) OR (old.latitude IS DISTINCT FROM new.latitude)) OR (old.longitude IS DISTINCT FROM new.longitude)) OR (old.geo_precision IS DISTINCT FROM new.geo_precision)) OR (old.owner_user_id IS DISTINCT FROM new.owner_user_id)) OR (old.owner_workspace_id IS DISTINCT FROM new.owner_workspace_id)) OR (old.publish_status IS DISTINCT FROM new.publish_status)) OR (old.moderation_status IS DISTINCT FROM new.moderation_status)) OR (old.marketplace_status IS DISTINCT FROM new.marketplace_status)) OR (old.duplicate_status IS DISTINCT FROM new.duplicate_status)) OR ((old.profile -> ''_geo''::text) IS DISTINCT FROM (new.profile -> ''_geo''::text)) OR ((old.profile #> ''{_enrich,blocked_reason}''::text[]) IS DISTINCT FROM (new.profile #> ''{_enrich,blocked_reason}''::text[])) OR ((old.profile #> ''{_enrich,scope_review_required}''::text[]) IS DISTINCT FROM (new.profile #> ''{_enrich,scope_review_required}''::text[])) OR ((old.profile #> ''{_enrich,organization_identity_quarantine}''::text[]) IS DISTINCT FROM (new.profile #> ''{_enrich,organization_identity_quarantine}''::text[])))) EXECUTE FUNCTION zoi.geography_source_listing_changed()'ELSE pg_get_triggerdef(tg.oid)END,'deferrable',tg.tgdeferrable,'initially_deferred',tg.tginitdeferred)ORDER BY tg.tgname)FROM pg_trigger tg WHERE tg.tgrelid='zoi.listings'::regclass AND NOT tg.tgisinternal)IS DISTINCT FROM $triggers$[{"name":"geography_read_authority_changed","enabled":"O","trigger":"CREATE TRIGGER geography_read_authority_changed AFTER UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.geography_read_authority_changed()","deferrable":false,"initially_deferred":false},{"name":"geography_source_listing_insert","enabled":"O","trigger":"CREATE CONSTRAINT TRIGGER geography_source_listing_insert AFTER INSERT ON zoi.listings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION zoi.geography_source_listing_changed()","deferrable":true,"initially_deferred":true},{"name":"geography_source_listing_update","enabled":"O","trigger":"CREATE CONSTRAINT TRIGGER geography_source_listing_update AFTER UPDATE ON zoi.listings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN ((((((((((((((((((old.name IS DISTINCT FROM new.name) OR (old.entity_type IS DISTINCT FROM new.entity_type)) OR (old.address IS DISTINCT FROM new.address)) OR (old.city IS DISTINCT FROM new.city)) OR (old.country IS DISTINCT FROM new.country)) OR (old.website IS DISTINCT FROM new.website)) OR (old.source_url IS DISTINCT FROM new.source_url)) OR (old.latitude IS DISTINCT FROM new.latitude)) OR (old.longitude IS DISTINCT FROM new.longitude)) OR (old.geo_precision IS DISTINCT FROM new.geo_precision)) OR (old.owner_user_id IS DISTINCT FROM new.owner_user_id)) OR (old.owner_workspace_id IS DISTINCT FROM new.owner_workspace_id)) OR (old.publish_status IS DISTINCT FROM new.publish_status)) OR (old.moderation_status IS DISTINCT FROM new.moderation_status)) OR (old.marketplace_status IS DISTINCT FROM new.marketplace_status)) OR (old.duplicate_status IS DISTINCT FROM new.duplicate_status)) OR ((old.profile -> '_geo'::text) IS DISTINCT FROM (new.profile -> '_geo'::text)) OR ((old.profile #> '{_enrich,blocked_reason}'::text[]) IS DISTINCT FROM (new.profile #> '{_enrich,blocked_reason}'::text[])) OR ((old.profile #> '{_enrich,scope_review_required}'::text[]) IS DISTINCT FROM (new.profile #> '{_enrich,scope_review_required}'::text[])) OR ((old.profile #> '{_enrich,organization_identity_quarantine}'::text[]) IS DISTINCT FROM (new.profile #> '{_enrich,organization_identity_quarantine}'::text[])))) EXECUTE FUNCTION zoi.geography_source_listing_changed()","deferrable":true,"initially_deferred":true},{"name":"listing_claim_owner_epoch","enabled":"O","trigger":"CREATE TRIGGER listing_claim_owner_epoch AFTER UPDATE OF owner_workspace_id, owner_user_id ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.claim_owner_changed()","deferrable":false,"initially_deferred":false},{"name":"listing_quality_receipts_guard","enabled":"O","trigger":"CREATE TRIGGER listing_quality_receipts_guard BEFORE INSERT OR UPDATE OF profile ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.guard_listing_quality_receipts()","deferrable":false,"initially_deferred":false},{"name":"listings_aa_slug","enabled":"O","trigger":"CREATE TRIGGER listings_aa_slug BEFORE INSERT OR UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.ensure_listing_slug()","deferrable":false,"initially_deferred":false},{"name":"listings_publish_gate","enabled":"O","trigger":"CREATE TRIGGER listings_publish_gate BEFORE INSERT ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.tg_apply_publish_gate()","deferrable":false,"initially_deferred":false},{"name":"listings_skip_noop","enabled":"O","trigger":"CREATE TRIGGER listings_skip_noop BEFORE UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.skip_noop_listing_update()","deferrable":false,"initially_deferred":false},{"name":"maintain_seo_identity_keys","enabled":"O","trigger":"CREATE TRIGGER maintain_seo_identity_keys AFTER INSERT OR UPDATE OF id, name, city, region, country, address ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.maintain_seo_identity_keys()","deferrable":false,"initially_deferred":false},{"name":"trg_listings_auto_seo","enabled":"O","trigger":"CREATE TRIGGER trg_listings_auto_seo BEFORE INSERT OR UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.auto_seo_fill()","deferrable":false,"initially_deferred":false},{"name":"trg_listings_updated","enabled":"O","trigger":"CREATE TRIGGER trg_listings_updated BEFORE UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.set_updated_at()","deferrable":false,"initially_deferred":false},{"name":"zz_maintain_seo_projection","enabled":"O","trigger":"CREATE TRIGGER zz_maintain_seo_projection AFTER INSERT OR UPDATE OF id, name, city, region, country, address, slug, entity_type, updated_at, created_at, phone, website, latitude, description, publish_status, moderation_status, marketplace_status, duplicate_status ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.maintain_seo_projection()","deferrable":false,"initially_deferred":false}]$triggers$::jsonb THEN RAISE EXCEPTION 'geography_address_listing_trigger_drift';END IF;
END $guard$;

-- Existing singleton, disabled finite allowance. No new table/queue/cron/token.
CREATE FUNCTION zoi.geography_address_source_allowed(l zoi.listings)RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $fn$
DECLARE e jsonb;q jsonb;k text;BEGIN
 IF NOT zoi.geography_read_source_allowed(l)OR zoi.geography_publisher_held(l)THEN RETURN false;END IF;e:=l.profile->'_enrich';IF e IS NULL THEN RETURN true;END IF;IF jsonb_typeof(e)IS DISTINCT FROM 'object'THEN RETURN false;END IF;
 FOR q IN SELECT value FROM jsonb_array_elements(jsonb_build_array(e)||CASE WHEN e?'source_identity'THEN jsonb_build_array(e->'source_identity')ELSE '[]'::jsonb END)LOOP
 IF jsonb_typeof(q)IS DISTINCT FROM 'object'THEN RETURN false;END IF;
 FOREACH k IN ARRAY ARRAY['blocked','source_challenge','source_scope_mismatch','scope_review_required','organization_identity_quarantine','identity_conflict','branch_conflict','identity_review_required','entity_family_review_required','challenge','source_challenged','captcha','challenge_detected']LOOP IF q?k AND q->k NOT IN('false'::jsonb,'"false"'::jsonb)THEN RETURN false;END IF;END LOOP;
 FOREACH k IN ARRAY ARRAY['blocked_reason','last_error']LOOP IF q?k AND q->k<>'null'::jsonb AND q->k<>'""'::jsonb THEN RETURN false;END IF;END LOOP;
 FOREACH k IN ARRAY ARRAY['status','crawl_status']LOOP IF q?k AND q->k<>'null'::jsonb AND(jsonb_typeof(q->k)<>'string'OR q->>k NOT IN('','ok','success','complete','completed','fetched','verified'))THEN RETURN false;END IF;END LOOP;
 IF q?'identity_match'AND q->'identity_match'NOT IN('true'::jsonb,'"true"'::jsonb)THEN RETURN false;END IF;
 END LOOP;
 q:=e->'source_identity';IF q IS NOT NULL AND(q?'verification'AND q->>'verification'IS DISTINCT FROM 'exact_name_typed_jsonld'OR q?'name'AND q->>'name'IS DISTINCT FROM l.name OR q?'expected_entity_type'AND q->>'expected_entity_type'IS DISTINCT FROM l.entity_type OR q?'source_url'AND q->>'source_url'IS DISTINCT FROM l.website)THEN RETURN false;END IF;
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION zoi.geography_address_source_allowed(zoi.listings)FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION zoi.geography_address_literal(value text)RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $fn$ SELECT btrim(regexp_replace(translate(coalesce(value,''),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'[[:space:]]+',' ','g'))$fn$;
REVOKE ALL ON FUNCTION zoi.geography_address_literal(text)FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION zoi.geography_qualified_address_proof(proof jsonb,l zoi.listings,job zoi.geography_repair_jobs)RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path='' AS $fn$
DECLARE a jsonb:=proof->'address';cap jsonb:=proof->'capture';card jsonb:=proof->'card';identity jsonb:=proof->'identity';body bytea;q jsonb;k text;literal text;country_name text;source_bytes integer;
BEGIN
 IF octet_length(proof::text)>16384 OR proof->'schema'IS DISTINCT FROM '1'::jsonb OR proof->>'kind'IS DISTINCT FROM 'reviewed_official_public_address'OR proof->>'authority'IS DISTINCT FROM 'official_address_only'OR proof->'coordinate_authority'IS DISTINCT FROM 'false'::jsonb OR proof->'canonical_context'IS DISTINCT FROM jsonb_build_object('id',l.id,'name',l.name,'address',l.address,'city',l.city,'country',l.country,'website',l.website)OR l.owner_user_id IS NOT NULL OR l.owner_workspace_id IS NOT NULL OR coalesce(l.claim_status,'unclaimed')<>'unclaimed'OR NOT zoi.geography_source_eligible(l)OR NOT zoi.geography_address_source_allowed(l)THEN RAISE EXCEPTION 'geography_address_context_or_review';END IF;
 FOREACH k IN ARRAY ARRAY['official_source_confirmed','public_business_address','full_document_branch_reviewed','exact_name_confirmed','exact_address_confirmed','exact_country_confirmed','country_code_confirmed']LOOP IF identity->k IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'geography_address_identity_review';END IF;END LOOP;
 IF length(btrim(coalesce(identity->>'reviewer','')))NOT BETWEEN 1 AND 160 OR identity->>'reviewed_at'IS NULL OR(identity->>'reviewed_at')::timestamptz<clock_timestamp()-interval '7 days'OR(identity->>'reviewed_at')::timestamptz>clock_timestamp()+interval '5 minutes'THEN RAISE EXCEPTION 'geography_address_identity_review';END IF;
 IF cap->>'strategy'IS DISTINCT FROM 'official_sources_v1'OR cap->>'listing_id'IS DISTINCT FROM l.id::text OR cap->>'job_id'IS DISTINCT FROM job.id::text OR job.listing_id IS DISTINCT FROM l.id OR job.strategy<>'official_sources_v1'OR job.completed_lease_id IS NULL OR coalesce(cap->>'source_sha256','')!~'^[a-f0-9]{64}$'
 OR cap->>'completed_lease_id'IS DISTINCT FROM job.completed_lease_id::text OR cap->>'capture_result_hash'IS DISTINCT FROM job.capture_result_hash OR cap->>'input_fingerprint'IS DISTINCT FROM job.input_fingerprint
 OR job.input_fingerprint IS DISTINCT FROM zoi.geography_repair_strategy_input(l,'official_sources_v1')OR job.source_generation IS DISTINCT FROM zoi.geography_source_generation(l.id)
 OR cap->>'source_json_sha256'IS DISTINCT FROM encode(extensions.digest(convert_to(job.source::text,'UTF8'),'sha256'),'hex')OR cap->>'archive_format'IS DISTINCT FROM 'decoded_utf8_sha256'OR cap->>'private_archive'IS DISTINCT FROM job.source->>'private_archive'
 OR cap->>'captured_at'IS NULL OR(cap->>'captured_at')::timestamptz IS DISTINCT FROM job.captured_at OR job.captured_at<clock_timestamp()-interval '7 days'OR job.captured_at>clock_timestamp()+interval '5 minutes'
 OR NOT zoi.geography_wix_source_url(cap->>'source_url',l.website)
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(job.source->'pages')p WHERE p->>'url'=cap->>'source_url'AND p->>'sha256'=cap->>'source_sha256'AND p->'http_status'='200'::jsonb)
 THEN RAISE EXCEPTION 'geography_address_capture_mismatch';END IF;
 source_bytes:=(cap->>'source_bytes')::integer;
 IF source_bytes NOT BETWEEN 1 AND 1500000 OR NOT EXISTS(SELECT 1 FROM storage.buckets b JOIN storage.objects o ON o.bucket_id=b.id WHERE b.id=cap->>'private_archive'AND NOT b.public AND o.name=(cap->>'source_sha256')||'.html'AND(o.metadata->>'size')::integer=source_bytes)THEN RAISE EXCEPTION 'geography_address_source_archive';END IF;
 body:=convert_to(card->>'html','UTF8');IF body IS NULL OR jsonb_typeof(card->'start_byte')IS DISTINCT FROM 'number'OR jsonb_typeof(card->'end_byte')IS DISTINCT FROM 'number'OR octet_length(body)NOT BETWEEN 1 AND 8192 OR card->>'sha256'IS DISTINCT FROM encode(extensions.digest(body,'sha256'),'hex')OR(card->>'start_byte')::integer<0 OR(card->>'end_byte')::integer IS DISTINCT FROM(card->>'start_byte')::integer+octet_length(body)OR(card->>'end_byte')::integer>source_bytes
 OR card->>'html'~*'<!--|<(script|style|noscript|template|svg|math|iframe|object|textarea|title|xmp|plaintext)\y|\yhidden(\s|=|>)|aria-hidden\s*=\s*["'']true|display\s*:\s*none|visibility\s*:\s*hidden'
 THEN RAISE EXCEPTION 'geography_address_card_invalid';END IF;
 IF a->>'street'IS DISTINCT FROM(a->>'house_number')||' '||(a->>'road')OR coalesce(a->>'house_number','')!~'^[0-9]+[[:alpha:]]?$'OR length(btrim(coalesce(a->>'road','')))=0 OR length(btrim(coalesce(a->>'postal_code','')))=0 OR a->>'city'IS DISTINCT FROM l.city OR a->>'country'IS DISTINCT FROM l.country OR identity->>'country_code'IS DISTINCT FROM a->>'country_code'
 OR NOT EXISTS(SELECT 1 FROM unnest(regexp_split_to_array(l.address,E'[,;()\\[\\]\\r\\n]+'))AS component(value)WHERE zoi.geography_address_literal(component.value)=zoi.geography_address_literal(a->>'street')) THEN RAISE EXCEPTION 'geography_address_parts';END IF;
 country_name:=CASE a->>'country_code'WHEN 'us'THEN 'United States'WHEN 'au'THEN 'Australia'WHEN 'ca'THEN 'Canada'WHEN 'cy'THEN 'Cyprus'WHEN 'de'THEN 'Germany'WHEN 'fr'THEN 'France'WHEN 'gb'THEN 'United Kingdom'WHEN 'gr'THEN 'Greece'WHEN 'ke'THEN 'Kenya'WHEN 'nz'THEN 'New Zealand'WHEN 'za'THEN 'South Africa'WHEN 'se'THEN 'Sweden'WHEN 'it'THEN 'Italy'WHEN 'nl'THEN 'Netherlands'END;
 IF country_name IS NULL OR zoi.geography_address_norm(country_name)<>zoi.geography_address_norm(l.country)AND NOT(a->>'country_code'='us'AND l.country='United States of America')THEN RAISE EXCEPTION 'geography_address_country';END IF;
 FOREACH k IN ARRAY ARRAY['name','street','city','postal_code','country']LOOP literal:=CASE WHEN k='name'THEN identity->>'source_name'ELSE a->>k END;q:=identity#>ARRAY['quotes',k];
 IF coalesce(literal,'')=''OR jsonb_typeof(q)IS DISTINCT FROM 'object'OR jsonb_typeof(q->'start_byte')IS DISTINCT FROM 'number'OR jsonb_typeof(q->'end_byte')IS DISTINCT FROM 'number'OR coalesce(q->>'start_byte','')!~'^[0-9]+$'OR coalesce(q->>'end_byte','')!~'^[0-9]+$'OR coalesce(q->>'sha256','')!~'^[a-f0-9]{64}$'THEN RAISE EXCEPTION 'geography_address_quote';END IF;
 IF(q->>'end_byte')::integer>(octet_length(body))OR(q->>'end_byte')::integer-(q->>'start_byte')::integer<>octet_length(convert_to(literal,'UTF8'))OR substring(body FROM(q->>'start_byte')::integer+1 FOR(q->>'end_byte')::integer-(q->>'start_byte')::integer)IS DISTINCT FROM convert_to(literal,'UTF8')OR q->>'sha256'IS DISTINCT FROM encode(extensions.digest(convert_to(literal,'UTF8'),'sha256'),'hex')THEN RAISE EXCEPTION 'geography_address_quote';END IF;
 IF strpos(' '||zoi.geography_address_norm(regexp_replace(card->>'html','<[^>]*>',' ','g'))||' ',' '||zoi.geography_address_norm(literal)||' ')=0 THEN RAISE EXCEPTION 'geography_address_quote';END IF;END LOOP;
 IF zoi.geography_address_norm(identity->>'source_name')<>zoi.geography_address_norm(l.name)AND identity->'name_alias_confirmed'IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'geography_address_name';END IF;

 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION zoi.geography_qualified_address_proof(jsonb,zoi.listings,zoi.geography_repair_jobs)FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.geography_geocoder_snapshot(p_listing uuid,p_address_proof jsonb)RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE l zoi.listings;job zoi.geography_repair_jobs;result jsonb;BEGIN
 SELECT * INTO job FROM zoi.geography_repair_jobs WHERE id=(p_address_proof#>>'{capture,job_id}')::uuid FOR SHARE;
 IF NOT FOUND OR job.listing_id IS DISTINCT FROM p_listing THEN RAISE EXCEPTION 'geography_address_capture_mismatch';END IF;
 SELECT * INTO l FROM zoi.listings WHERE id=p_listing FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'geography_address_listing_unavailable';END IF;
 PERFORM zoi.geography_qualified_address_proof(p_address_proof,l,job);
 SELECT jsonb_build_object('id',l.id,'name',l.name,'entity_type',l.entity_type,'address',l.address,'city',l.city,'country',l.country,'website',l.website,'latitude',l.latitude,'longitude',l.longitude,'geo_precision',l.geo_precision,'claim_status',l.claim_status,'duplicate_status',l.duplicate_status,'marketplace_status',l.marketplace_status,'owner_managed',l.owner_user_id IS NOT NULL OR l.owner_workspace_id IS NOT NULL,'public_eligible',l.publish_status='published'AND l.moderation_status IN('clean','cleared')AND l.marketplace_status IS DISTINCT FROM 'hidden'AND l.duplicate_status IS DISTINCT FROM 'confirmed_duplicate','source_kind','official_website','database_snapshot',zoi.geography_fingerprint(l),'source_fingerprint',zoi.listing_quality_fingerprint(l),'source_context',jsonb_build_object('blocked',NOT zoi.geography_address_source_allowed(l)),'profile',(SELECT coalesce(jsonb_object_agg(k,v),'{}'::jsonb)FROM jsonb_each(CASE WHEN jsonb_typeof(l.profile)='object'THEN l.profile ELSE '{}'::jsonb END)f(k,v)WHERE k IN('name','address','city','country','website','latitude','longitude','geo_precision')))INTO result
;RETURN result;END
$fn$;
REVOKE ALL ON FUNCTION public.geography_geocoder_snapshot(uuid,jsonb)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.geography_geocoder_snapshot(uuid,jsonb)TO service_role;
ALTER TABLE zoi.geography_source_capture_lock
 ADD COLUMN geocoder_approval_id uuid,
 ADD COLUMN geocoder_manifest_sha256 text CHECK(geocoder_manifest_sha256 IS NULL OR geocoder_manifest_sha256~'^[a-f0-9]{64}$'),
 ADD COLUMN geocoder_expires_at timestamptz,
 ADD COLUMN geocoder_reserved integer NOT NULL DEFAULT 0 CHECK(geocoder_reserved BETWEEN 0 AND 3),
 ADD COLUMN geocoder_last_dispatch_at timestamptz;
CREATE FUNCTION public.geography_geocoder_admit(p_lease uuid,p_manifest text)RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE s zoi.geography_source_capture_lock;BEGIN
 SELECT * INTO s FROM zoi.geography_source_capture_lock WHERE singleton FOR UPDATE;
 IF p_lease IS NULL OR p_manifest IS NULL OR p_manifest!~'^[a-f0-9]{64}$'OR s.lease_id IS NULL OR s.lease_id IS DISTINCT FROM p_lease OR s.expires_at IS NULL OR s.expires_at<=clock_timestamp()OR s.geocoder_approval_id IS NULL OR s.geocoder_manifest_sha256 IS DISTINCT FROM p_manifest OR s.geocoder_expires_at IS NULL OR s.geocoder_expires_at<=clock_timestamp()OR s.geocoder_expires_at>clock_timestamp()+interval '1 hour'OR s.geocoder_reserved>=3 THEN RAISE EXCEPTION 'geocoder_finite_allowance_disabled';END IF;
 RETURN jsonb_build_object('admitted',true,'singleton_held',true,'receipt_id',s.geocoder_approval_id,'provider','nominatim','max_queries',3,'minimum_spacing_ms',15000,'expires_at',least(s.expires_at,s.geocoder_expires_at));
END $fn$;
CREATE FUNCTION public.geography_geocoder_reserve(p_lease uuid,p_manifest text,p_request text)RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE s zoi.geography_source_capture_lock;BEGIN
 PERFORM public.geography_geocoder_admit(p_lease,p_manifest);
 SELECT * INTO s FROM zoi.geography_source_capture_lock WHERE singleton FOR UPDATE;
 IF p_request IS NULL OR p_request!~'^[a-f0-9]{64}$'OR s.geocoder_last_dispatch_at>clock_timestamp()-interval '15 seconds'THEN RAISE EXCEPTION 'geocoder_spacing_or_request_refused';END IF;
 UPDATE zoi.geography_source_capture_lock SET geocoder_reserved=geocoder_reserved+1,geocoder_last_dispatch_at=clock_timestamp()WHERE singleton;
 RETURN jsonb_build_object('reserved',true,'request_sha256',p_request,'receipt_id',s.geocoder_approval_id,'reserved_queries',s.geocoder_reserved+1);
END $fn$;
REVOKE ALL ON FUNCTION public.geography_geocoder_admit(uuid,text),public.geography_geocoder_reserve(uuid,text,text)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.geography_geocoder_admit(uuid,text),public.geography_geocoder_reserve(uuid,text,text)TO service_role;
-- Mark completion as well as reservation. The next batch waits 15 seconds
-- after this mark, so request transport latency cannot shorten global spacing.
CREATE FUNCTION public.geography_geocoder_finish(p_lease uuid,p_manifest text)RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE changed boolean;BEGIN
 IF p_lease IS NULL OR p_manifest IS NULL THEN RAISE EXCEPTION 'geocoder_finish_identity';END IF;
 UPDATE zoi.geography_source_capture_lock SET geocoder_last_dispatch_at=clock_timestamp()WHERE singleton AND lease_id=p_lease AND expires_at>clock_timestamp()AND geocoder_manifest_sha256=p_manifest RETURNING true INTO changed;
 IF changed IS DISTINCT FROM true THEN RAISE EXCEPTION 'geocoder_finish_identity';END IF;RETURN jsonb_build_object('marked',true);
END $fn$;
REVOKE ALL ON FUNCTION public.geography_geocoder_finish(uuid,text)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.geography_geocoder_finish(uuid,text)TO service_role;

-- Generated metadata guard and canonical writer extension are assembled below
-- from the exact read-only Oct16 definitions retained with the contract fixture.
CREATE FUNCTION zoi.geography_address_norm(value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $fn$
 SELECT btrim(lower(regexp_replace(normalize(coalesce(value,''),NFKC),'[[:punct:][:space:]]+',' ','g')))
$fn$;

CREATE FUNCTION zoi.geography_reviewed_address_geocode_proof(c jsonb,review jsonb,l zoi.listings,job zoi.geography_repair_jobs) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $fn$
DECLARE proof jsonb;a jsonb;cap jsonb;card jsonb;identity jsonb;request jsonb;provider jsonb;params jsonb;expected jsonb;rows jsonb;selected jsonb;r jsonb;addr jsonb;q jsonb;matches integer:=0;k text;literal text;body bytea;source_bytes integer;response_text text;response_sha text;country_name text;accuracy text;name_match boolean;lat float8;lng float8;bbox jsonb;v float8;at_time timestamptz;
BEGIN
 IF c->>'evidence_kind'IS DISTINCT FROM 'reviewed_geocoded_official_address'OR octet_length(c->>'geocode_evidence_text')>26000 THEN RAISE EXCEPTION 'geography_address_kind_invalid';END IF;
 proof:=zoi.geography_wix_json_unique(c->>'geocode_evidence_text');a:=proof#>'{address_proof,address}';cap:=proof#>'{address_proof,capture}';card:=proof#>'{address_proof,card}';identity:=proof#>'{address_proof,identity}';request:=proof->'request';provider:=proof->'provider_capture';
 IF proof->'schema'IS DISTINCT FROM '1'::jsonb OR proof#>>'{address_proof,kind}'IS DISTINCT FROM 'reviewed_official_public_address'OR proof#>>'{address_proof,authority}'IS DISTINCT FROM 'official_address_only'OR proof#>'{address_proof,coordinate_authority}'IS DISTINCT FROM 'false'::jsonb
 OR proof#>'{address_proof,canonical_context}'IS DISTINCT FROM jsonb_build_object('id',l.id,'name',l.name,'address',l.address,'city',l.city,'country',l.country,'website',l.website)
 OR coalesce(l.claim_status,'unclaimed')<>'unclaimed'OR l.duplicate_status='confirmed_duplicate'OR NOT zoi.geography_address_source_allowed(l)
 OR review->>'geocode_proof_sha256'IS DISTINCT FROM encode(extensions.digest(convert_to(c->>'geocode_evidence_text','UTF8'),'sha256'),'hex')
 OR review->>'reviewer'=identity->>'reviewer'
 THEN RAISE EXCEPTION 'geography_address_context_or_review';END IF;
 FOREACH k IN ARRAY ARRAY['exact_identity_confirmed','exact_country_confirmed','visible_branch_confirmed','full_archived_raw_rehashed','full_document_branch_reviewed','provider_address_match_confirmed','not_roof_or_entrance_precision']LOOP IF review->k IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'geography_address_independent_review';END IF;END LOOP;
 FOREACH k IN ARRAY ARRAY['official_source_confirmed','public_business_address','full_document_branch_reviewed','exact_name_confirmed','exact_address_confirmed','exact_country_confirmed','country_code_confirmed']LOOP IF identity->k IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'geography_address_identity_review';END IF;END LOOP;
 IF length(btrim(coalesce(identity->>'reviewer','')))NOT BETWEEN 1 AND 160 OR identity->>'reviewed_at'IS NULL OR(identity->>'reviewed_at')::timestamptz<clock_timestamp()-interval '7 days'OR(identity->>'reviewed_at')::timestamptz>clock_timestamp()+interval '5 minutes' THEN RAISE EXCEPTION 'geography_address_identity_review';END IF;
 PERFORM zoi.geography_qualified_address_proof(proof->'address_proof',l,job);
 params:=jsonb_build_object('format','jsonv2','street',a->>'street','city',a->>'city','postalcode',a->>'postal_code','country',a->>'country','countrycodes',a->>'country_code','addressdetails','1','namedetails','1','extratags','1','limit','3','accept-language','en');IF coalesce(a->>'region','')<>''THEN params:=params||jsonb_build_object('state',a->>'region');END IF;
 expected:=jsonb_build_object('provider','nominatim','endpoint','https://nominatim.openstreetmap.org/search','params',params);
 IF request->>'provider'IS DISTINCT FROM 'nominatim'OR request->>'method'IS DISTINCT FROM 'GET'OR request->>'endpoint'IS DISTINCT FROM 'https://nominatim.openstreetmap.org/search'OR request->'params'IS DISTINCT FROM params OR request->>'request_sha256'IS DISTINCT FROM encode(extensions.digest(convert_to(zoi.geography_wix_canonical(expected),'UTF8'),'sha256'),'hex')THEN RAISE EXCEPTION 'geography_address_request';END IF;
 response_text:=proof->>'response_text';response_sha:=encode(extensions.digest(convert_to(response_text,'UTF8'),'sha256'),'hex');
 IF octet_length(response_text)NOT BETWEEN 2 AND 16384 OR provider->>'request_sha256'IS DISTINCT FROM request->>'request_sha256'OR provider->>'response_sha256'IS DISTINCT FROM response_sha OR provider->'response_bytes'IS DISTINCT FROM to_jsonb(octet_length(response_text))OR provider->>'endpoint'IS DISTINCT FROM request->>'endpoint'OR provider->'status'IS DISTINCT FROM '200'::jsonb OR provider->'redirected'IS DISTINCT FROM 'false'::jsonb OR provider->>'private_archive'IS DISTINCT FROM cap->>'private_archive'
 OR provider#>'{admission,singleton_held}'IS DISTINCT FROM 'true'::jsonb OR provider#>'{admission,max_queries}'IS DISTINCT FROM '3'::jsonb OR provider#>'{admission,minimum_spacing_ms}'IS DISTINCT FROM '15000'::jsonb OR coalesce(provider#>>'{admission,receipt_id}','')!~'^[a-f0-9-]{36}$'
 OR provider->>'captured_at'IS NULL OR(provider->>'captured_at')::timestamptz<clock_timestamp()-interval '7 days'OR(provider->>'captured_at')::timestamptz>clock_timestamp()+interval '5 minutes'
 OR NOT EXISTS(SELECT 1 FROM storage.buckets b JOIN storage.objects o ON o.bucket_id=b.id WHERE b.id=cap->>'private_archive'AND NOT b.public AND o.name='geocoder/nominatim/responses/'||response_sha||'.json'AND(o.metadata->>'size')::integer=octet_length(response_text))
 OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id=cap->>'private_archive'AND o.name='geocoder/nominatim/queries/'||(request->>'request_sha256')||'.json')
 THEN RAISE EXCEPTION 'geography_address_provider_archive';END IF;
 rows:=zoi.geography_wix_json_unique(response_text);IF jsonb_typeof(rows)IS DISTINCT FROM 'array'OR jsonb_array_length(rows)>3 THEN RAISE EXCEPTION 'geography_address_provider_rows';END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(rows)LOOP
 addr:=r->'address';IF jsonb_typeof(addr)IS DISTINCT FROM 'object'THEN CONTINUE;END IF;
 IF addr->>'country_code'IS DISTINCT FROM a->>'country_code'OR zoi.geography_address_literal(addr->>'house_number')<>zoi.geography_address_literal(a->>'house_number')OR zoi.geography_address_literal(addr->>'road')<>zoi.geography_address_literal(a->>'road')OR upper(regexp_replace(coalesce(addr->>'postcode',''),'\s','','g'))<>upper(regexp_replace(a->>'postal_code','\s','','g'))THEN CONTINUE;END IF;
 IF NOT EXISTS(SELECT 1 FROM unnest(ARRAY['city','town','village','municipality']) key WHERE zoi.geography_address_literal(addr->>key)=zoi.geography_address_literal(a->>'city'))THEN CONTINUE;END IF;
 IF coalesce(a->>'region','')<>''AND zoi.geography_address_norm(addr->>'state')<>zoi.geography_address_norm(a->>'region')AND zoi.geography_address_norm(addr->>'ISO3166-2-lvl4')<>zoi.geography_address_norm(a->>'region')AND coalesce(identity->>'provider_region_alias','')<>coalesce(addr->>'state','')THEN CONTINUE;END IF;
 IF coalesce(r->>'category','')NOT IN('building','amenity','shop','tourism','office','leisure','historic')OR coalesce(r->>'type','')=''OR r->>'type'IN('parking','parking_entrance','bicycle_parking','bench','toilets','taxi','charging_station','waste_basket')OR coalesce(r->>'osm_type','')NOT IN('node','way','relation')OR coalesce(r->>'osm_id','')!~'^[0-9]+$'THEN CONTINUE;END IF;
 name_match:=EXISTS(SELECT 1 FROM jsonb_each_text(coalesce(r->'namedetails','{}'::jsonb)||jsonb_build_object('name',r->>'name')) names WHERE zoi.geography_address_norm(names.value)IN(zoi.geography_address_norm(l.name),zoi.geography_address_norm(identity->>'source_name'))OR identity->'provider_name_alias_confirmed'='true'::jsonb AND zoi.geography_address_norm(names.value)=zoi.geography_address_norm(identity->>'provider_name_alias'));
 IF r->>'category'<>'building'AND NOT name_match OR r->>'category'='building'AND coalesce(r->>'name','')<>''AND NOT name_match THEN CONTINUE;END IF;
 IF coalesce(r->>'lat','')!~'^-?[0-9]+([.][0-9]+)?$'OR coalesce(r->>'lon','')!~'^-?[0-9]+([.][0-9]+)?$'OR jsonb_typeof(r->'boundingbox')IS DISTINCT FROM 'array'OR jsonb_array_length(r->'boundingbox')<>4 THEN CONTINUE;END IF;
 lat:=(r->>'lat')::float8;lng:=(r->>'lon')::float8;bbox:=r->'boundingbox';IF lat NOT BETWEEN -90 AND 90 OR lng NOT BETWEEN -180 AND 180 OR(lat=0 AND lng=0)OR(bbox->>0)::float8>lat OR(bbox->>1)::float8<lat OR(bbox->>2)::float8>lng OR(bbox->>3)::float8<lng OR(bbox->>1)::float8-(bbox->>0)::float8>0.005 OR(bbox->>3)::float8-(bbox->>2)::float8>0.005 THEN CONTINUE;END IF;
 accuracy:=CASE WHEN r->>'category'='building'THEN 'mapped_building_centroid'ELSE 'mapped_venue_centroid'END;
 selected:=jsonb_build_object('latitude',lat,'longitude',lng,'accuracy',accuracy,'venue_identity_verified',r->>'category'<>'building'AND name_match,'address_accuracy','mapped_address','not_roof_or_entrance',true,'osm_type',r->>'osm_type','osm_id',r->>'osm_id','category',r->>'category','type',r->>'type','provider_name',nullif(r->>'name',''),'boundingbox',jsonb_build_array((bbox->>0)::float8,(bbox->>1)::float8,(bbox->>2)::float8,(bbox->>3)::float8));matches:=matches+1;
 END LOOP;
 IF matches<>1 OR selected IS DISTINCT FROM proof->'selected'OR EXISTS(SELECT 1 FROM jsonb_each(selected) kv WHERE c->kv.key IS DISTINCT FROM kv.value)OR c->>'precision'IS DISTINCT FROM 'mapped_address'OR c->'address'IS DISTINCT FROM a OR c->>'name'IS DISTINCT FROM l.name OR c->>'provider'IS DISTINCT FROM 'nominatim'OR c->>'licence'IS DISTINCT FROM 'ODbL-1.0'OR c->>'licence_url'IS DISTINCT FROM 'https://www.openstreetmap.org/copyright'OR c->>'attribution'IS DISTINCT FROM '© OpenStreetMap contributors'THEN RAISE EXCEPTION 'geography_address_mapped_result_required';END IF;
 RETURN proof;
END $fn$;

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
 address_job zoi.geography_repair_jobs;address_proof jsonb;address_before zoi.listings;address_geo jsonb;
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
 IF report#>>'{candidate,evidence_kind}'='reviewed_geocoded_official_address'THEN
 SELECT * INTO address_job FROM zoi.geography_repair_jobs WHERE id=((report#>>'{candidate,geocode_evidence_text}')::jsonb#>>'{address_proof,capture,job_id}')::uuid FOR SHARE;
 IF NOT FOUND OR address_job.listing_id IS DISTINCT FROM p_listing THEN RAISE EXCEPTION 'geography_address_capture_mismatch';END IF;END IF;
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
 IF c?'geocode_evidence_text'AND c->>'evidence_kind'IS DISTINCT FROM 'reviewed_geocoded_official_address'THEN RAISE EXCEPTION 'geography_address_kind_mismatch';END IF;
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
 OR report->>'kind' IS DISTINCT FROM (CASE WHEN c->>'evidence_kind'='reviewed_geocoded_official_address'THEN 'official_address_geocode_review'ELSE 'official_coordinate_dry_run'END)
 OR report->'http_status' IS DISTINCT FROM '200'::jsonb
 OR coalesce(report->>'snapshot_sha256','')!~'^[0-9a-f]{64}$'
 OR coalesce(c->>'evidence_kind','') NOT IN('jsonld','official_destination','reviewed_named_place_shortlink','reviewed_official_place_destination','reviewed_official_wix_business_location','reviewed_geocoded_official_address')
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
 IF c->>'evidence_kind'='reviewed_geocoded_official_address'THEN
 IF length(btrim(coalesce(report->>'collector','')))NOT BETWEEN 1 AND 160 OR lower(btrim(report->>'collector'))IS DISTINCT FROM lower(btrim(p_review->>'specialist'))THEN RAISE EXCEPTION 'geography_address_independent_review';END IF;
 address_proof:=zoi.geography_reviewed_address_geocode_proof(c,p_review,l,address_job);
 IF address_proof#>>'{address_proof,capture,source_url}'IS DISTINCT FROM report->>'source_url'OR address_proof#>>'{address_proof,capture,source_sha256}'IS DISTINCT FROM report->>'source_sha256'THEN RAISE EXCEPTION 'geography_address_capture_mismatch';END IF;END IF;
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
 IF c->>'precision' IS DISTINCT FROM (CASE WHEN address_proof IS NOT NULL THEN 'mapped_address'ELSE 'source_published'END)
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
 IF address_proof IS NOT NULL THEN address_before:=l;address_geo:=jsonb_build_object('precision','street','method','reviewed_geocoded_official_address','evidence_kind','reviewed_geocoded_official_address','source_url',report->>'source_url','source_sha256',report->>'source_sha256','report_sha256',report_hash,'reviewer',p_review->>'reviewer','reviewed_at',review_time,'request_id',p_request,'source_job_id',address_job.id,'geocode_proof_sha256',p_review->>'geocode_proof_sha256','provider','nominatim','provider_request_sha256',address_proof#>>'{request,request_sha256}','provider_response_sha256',address_proof#>>'{provider_capture,response_sha256}','accuracy',c->>'accuracy','not_roof_or_entrance',true,'venue_identity_verified',c->'venue_identity_verified','attribution','© OpenStreetMap contributors','licence','ODbL-1.0','licence_url','https://www.openstreetmap.org/copyright');END IF;
 UPDATE zoi.listings SET latitude=lat,longitude=lng,geo_precision='street',
 profile=coalesce(l.profile,'{}'::jsonb)||jsonb_build_object('_geo',CASE WHEN address_proof IS NOT NULL THEN address_geo WHEN wix_proof IS NOT NULL THEN wix_geo WHEN place_proof IS NOT NULL THEN place_geo ELSE jsonb_build_object(
 'precision','street','method','reviewed_official_source','source_url',report->>'source_url',
 'source_sha256',report->>'source_sha256','report_sha256',report_hash,'reviewer',p_review->>'reviewer',
 'reviewed_at',review_time,'request_id',p_request)END),updated_at=clock_timestamp()
 WHERE id=p_listing RETURNING * INTO l;
 IF wix_proof IS NOT NULL AND(NOT FOUND OR to_jsonb(l)IS DISTINCT FROM(to_jsonb(wix_before)||jsonb_build_object('latitude',lat,'longitude',lng,'geo_precision','street','profile',coalesce(wix_before.profile,'{}'::jsonb)||jsonb_build_object('_geo',wix_geo),'updated_at',transaction_timestamp()))OR(SELECT to_jsonb(actual_row)FROM zoi.listings actual_row WHERE actual_row.id=p_listing)IS DISTINCT FROM to_jsonb(l))THEN RAISE EXCEPTION 'geography_wix_unexpected_listing_change';END IF;
 IF place_proof IS NOT NULL AND(NOT FOUND OR to_jsonb(l)IS DISTINCT FROM(to_jsonb(place_before)||jsonb_build_object('latitude',lat,'longitude',lng,'geo_precision','street','profile',coalesce(place_before.profile,'{}'::jsonb)||jsonb_build_object('_geo',place_geo),'updated_at',transaction_timestamp()))OR(SELECT to_jsonb(actual_row)FROM zoi.listings actual_row WHERE actual_row.id=p_listing)IS DISTINCT FROM to_jsonb(l))THEN RAISE EXCEPTION 'geography_place_unexpected_listing_change';END IF;
 IF address_proof IS NOT NULL AND(NOT FOUND OR to_jsonb(l)IS DISTINCT FROM(to_jsonb(address_before)||jsonb_build_object('latitude',lat,'longitude',lng,'geo_precision','street','profile',coalesce(address_before.profile,'{}'::jsonb)||jsonb_build_object('_geo',address_geo),'updated_at',transaction_timestamp()))OR(SELECT to_jsonb(actual_row)FROM zoi.listings actual_row WHERE actual_row.id=p_listing)IS DISTINCT FROM to_jsonb(l))THEN RAISE EXCEPTION 'geography_address_unexpected_listing_change';END IF;
 receipt:=jsonb_build_object('ok',true,'request_id',p_request,'listing_id',p_listing,
 'latitude',l.latitude,'longitude',l.longitude,'precision',l.geo_precision,'report_sha256',report_hash,
 'after_snapshot',zoi.geography_fingerprint(l));
 IF NOT zoi.geography_read_source_allowed(l) THEN RAISE EXCEPTION 'geography_source_authority_held';END IF;
 INSERT INTO zoi.geography_reviews(request_id,listing_id,payload,receipt,before_geo,after_fingerprint,read_authority_fingerprint)
 VALUES(p_request,p_listing,payload,receipt,before_geo,zoi.geography_fingerprint(l),zoi.geography_read_authority_fingerprint(l));
 RETURN receipt;
END $function$
;

REVOKE ALL ON FUNCTION zoi.geography_address_norm(text),zoi.geography_reviewed_address_geocode_proof(jsonb,jsonb,zoi.listings,zoi.geography_repair_jobs)FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
