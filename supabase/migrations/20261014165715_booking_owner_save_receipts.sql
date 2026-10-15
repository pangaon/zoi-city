-- Idempotent owner requests call the existing canonical booking writers. This
-- table is an immutable mutation receipt, not a second resource/booking store.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$BEGIN
 IF(SELECT md5(prosrc)FROM pg_proc WHERE oid='zoi.venue_require_member(uuid,boolean)'::regprocedure)IS DISTINCT FROM'8f8f063b04975a1673c48dff85851f1a'OR(SELECT proowner::regrole::text FROM pg_proc WHERE oid='zoi.venue_require_member(uuid,boolean)'::regprocedure)IS DISTINCT FROM'postgres'OR(SELECT proacl::text FROM pg_proc WHERE oid='zoi.venue_require_member(uuid,boolean)'::regprocedure)IS DISTINCT FROM'{postgres=X/postgres}'THEN RAISE EXCEPTION 'booking_current_authority_not_installed';END IF;
 IF to_regprocedure('public.booking_settings_save(uuid,integer,uuid,text,text,boolean)')IS NULL OR to_regprocedure('public.booking_item_save(uuid,text,uuid,integer,jsonb)')IS NULL OR to_regprocedure('public.booking_slot_save(uuid,uuid,integer,uuid,uuid,timestamptz,boolean)')IS NULL THEN RAISE EXCEPTION 'canonical_booking_writers_unavailable';END IF;
END$$;
CREATE TABLE zoi.booking_owner_save_receipts(request_id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id),actor_profile_id uuid NOT NULL REFERENCES zoi.user_profiles(id),actor_auth_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('settings','service','resource','slot')),payload jsonb NOT NULL,client_listing_id uuid,receipt jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE zoi.booking_owner_save_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.booking_owner_save_receipts FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX booking_owner_save_history ON zoi.booking_owner_save_receipts(workspace_id,actor_profile_id,created_at DESC);
CREATE FUNCTION zoi.booking_owner_receipt_immutable()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN RAISE EXCEPTION 'booking_owner_receipt_immutable';END$$;
CREATE TRIGGER booking_owner_receipt_immutable BEFORE UPDATE OR DELETE ON zoi.booking_owner_save_receipts FOR EACH ROW EXECUTE FUNCTION zoi.booking_owner_receipt_immutable();
CREATE FUNCTION zoi.booking_owner_listing(p_workspace uuid,p_listing uuid)RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_ws uuid;
BEGIN IF p_listing IS NULL THEN RETURN;END IF;SELECT owner_workspace_id INTO owner_ws FROM zoi.listings WHERE id=p_listing FOR SHARE;IF NOT FOUND OR owner_ws IS DISTINCT FROM p_workspace THEN RAISE EXCEPTION 'booking_owner_client_unavailable' USING ERRCODE='42501';END IF;END$$;
CREATE FUNCTION public.booking_owner_save(p_workspace uuid,p_request uuid,p_kind text,p_payload jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;client uuid;current_client uuid;prior zoi.booking_owner_save_receipts;result jsonb;allowed text[];item_keys text[];row_id uuid;expected integer;
BEGIN
 actor:=zoi.venue_require_member(p_workspace,true);
 IF p_request IS NULL OR p_kind IS NULL OR p_kind NOT IN('settings','service','resource','slot')OR jsonb_typeof(p_payload)IS DISTINCT FROM'object'OR octet_length(p_payload::text)>8192 THEN RAISE EXCEPTION 'invalid_booking_owner_request';END IF;
 allowed:=CASE p_kind WHEN'settings'THEN ARRAY['expected_version','listing','timezone','currency','enabled']WHEN'slot'THEN ARRAY['id','expected_version','service','resource','starts_at','active']ELSE ARRAY['id','expected_version','data']END;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload)k WHERE NOT(k=ANY(allowed)))OR EXISTS(SELECT 1 FROM unnest(allowed)k WHERE NOT(p_payload?k))OR jsonb_typeof(p_payload->'expected_version')IS DISTINCT FROM'number'OR p_payload->>'expected_version'!~'^[0-9]{1,10}$'OR(p_payload->>'expected_version')::bigint>2147483647 THEN RAISE EXCEPTION 'invalid_booking_owner_request';END IF;
 expected:=(p_payload->>'expected_version')::integer;
 IF p_kind='settings'THEN
  IF jsonb_typeof(p_payload->'listing')IS DISTINCT FROM'string'OR p_payload->>'listing'!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'OR jsonb_typeof(p_payload->'timezone')IS DISTINCT FROM'string'OR jsonb_typeof(p_payload->'currency')IS DISTINCT FROM'string'OR jsonb_typeof(p_payload->'enabled')IS DISTINCT FROM'boolean'THEN RAISE EXCEPTION 'invalid_booking_owner_request';END IF;
  client:=(p_payload->>'listing')::uuid;
 ELSE
  IF jsonb_typeof(p_payload->'id')NOT IN('null','string')OR(jsonb_typeof(p_payload->'id')='string'AND p_payload->>'id'!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')THEN RAISE EXCEPTION 'invalid_booking_owner_request';END IF;row_id:=(p_payload->>'id')::uuid;
  IF p_kind='slot'THEN
   IF jsonb_typeof(p_payload->'service')IS DISTINCT FROM'string'OR p_payload->>'service'!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'OR jsonb_typeof(p_payload->'resource')IS DISTINCT FROM'string'OR p_payload->>'resource'!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'OR jsonb_typeof(p_payload->'starts_at')IS DISTINCT FROM'string'OR jsonb_typeof(p_payload->'active')IS DISTINCT FROM'boolean'THEN RAISE EXCEPTION 'invalid_booking_owner_request';END IF;
  ELSE
   item_keys:=CASE p_kind WHEN'service'THEN ARRAY['name','active','duration_minutes','buffer_minutes','price_cents']ELSE ARRAY['name','active','kind','capacity']END;
   IF jsonb_typeof(p_payload->'data')IS DISTINCT FROM'object'THEN RAISE EXCEPTION 'invalid_booking_owner_request';END IF;
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload->'data')k WHERE NOT(k=ANY(item_keys)))OR EXISTS(SELECT 1 FROM unnest(item_keys)k WHERE NOT(p_payload->'data'?k))OR jsonb_typeof(p_payload#>'{data,name}')IS DISTINCT FROM'string'OR jsonb_typeof(p_payload#>'{data,active}')IS DISTINCT FROM'boolean'THEN RAISE EXCEPTION 'invalid_booking_owner_request';END IF;
   IF p_kind='service'AND EXISTS(SELECT 1 FROM unnest(ARRAY['duration_minutes','buffer_minutes','price_cents'])k WHERE jsonb_typeof(p_payload->'data'->k)IS DISTINCT FROM'number'OR p_payload->'data'->>k!~'^[0-9]{1,10}$')OR p_kind='resource'AND(jsonb_typeof(p_payload#>'{data,kind}')IS DISTINCT FROM'string'OR jsonb_typeof(p_payload#>'{data,capacity}')IS DISTINCT FROM'number'OR p_payload#>>'{data,capacity}'!~'^[0-9]{1,10}$')THEN RAISE EXCEPTION 'invalid_booking_owner_request';END IF;
  END IF;
 END IF;
 -- Workspace/session/profile authority is locked before client and receipt data.
 SELECT listing_id INTO current_client FROM zoi.booking_settings WHERE workspace_id=p_workspace FOR SHARE;
 PERFORM zoi.booking_owner_listing(p_workspace,current_client);
 IF p_kind='settings'THEN PERFORM zoi.booking_owner_listing(p_workspace,client);ELSE client:=current_client;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,6844));
 SELECT *INTO prior FROM zoi.booking_owner_save_receipts WHERE request_id=p_request FOR UPDATE;
 IF FOUND THEN
  IF prior.workspace_id IS DISTINCT FROM p_workspace OR prior.actor_profile_id IS DISTINCT FROM actor OR prior.actor_auth_id IS DISTINCT FROM auth.uid()OR prior.kind IS DISTINCT FROM p_kind OR prior.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'booking_owner_request_conflict';END IF;
  PERFORM zoi.booking_owner_listing(p_workspace,prior.client_listing_id);
  RETURN jsonb_build_object('ok',true,'workspace',prior.workspace_id,'actor',prior.actor_profile_id,'account',prior.actor_auth_id,'request',prior.request_id,'kind',prior.kind,'payload',prior.payload,'client_listing_id',prior.client_listing_id,'receipt',prior.receipt,'created_at',prior.created_at,'replayed',true);
 END IF;
 CASE p_kind
 WHEN'settings'THEN result:=public.booking_settings_save(p_workspace,expected,client,p_payload->>'timezone',p_payload->>'currency',(p_payload->>'enabled')::boolean);
 WHEN'service','resource'THEN result:=public.booking_item_save(p_workspace,p_kind,row_id,expected,p_payload->'data');
 WHEN'slot'THEN result:=public.booking_slot_save(p_workspace,row_id,expected,(p_payload->>'service')::uuid,(p_payload->>'resource')::uuid,(p_payload->>'starts_at')::timestamptz,(p_payload->>'active')::boolean);
 END CASE;
 IF result->>'ok'IS DISTINCT FROM'true'THEN RAISE EXCEPTION 'booking_owner_receipt_unconfirmed';END IF;
 INSERT INTO zoi.booking_owner_save_receipts(request_id,workspace_id,actor_profile_id,actor_auth_id,kind,payload,client_listing_id,receipt)VALUES(p_request,p_workspace,actor,auth.uid(),p_kind,p_payload,client,result)RETURNING *INTO prior;
 RETURN jsonb_build_object('ok',true,'workspace',prior.workspace_id,'actor',prior.actor_profile_id,'account',prior.actor_auth_id,'request',prior.request_id,'kind',prior.kind,'payload',prior.payload,'client_listing_id',prior.client_listing_id,'receipt',prior.receipt,'created_at',prior.created_at,'replayed',false);
END$$;
CREATE FUNCTION public.booking_owner_save_capabilities(p_workspace uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE client uuid;
BEGIN PERFORM zoi.venue_require_member(p_workspace,true);SELECT listing_id INTO client FROM zoi.booking_settings WHERE workspace_id=p_workspace FOR SHARE;PERFORM zoi.booking_owner_listing(p_workspace,client);RETURN jsonb_build_object('ok',true,'schema_version',1,'workspace',p_workspace,'account',auth.uid(),'kinds',ARRAY['settings','service','resource','slot'],'immutable_receipts',true);END$$;
REVOKE ALL ON FUNCTION public.booking_owner_save_capabilities(uuid)FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.booking_owner_save_capabilities(uuid)TO authenticated;
REVOKE ALL ON FUNCTION zoi.booking_owner_receipt_immutable(),zoi.booking_owner_listing(uuid,uuid)FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.booking_owner_save(uuid,uuid,text,jsonb)FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.booking_owner_save(uuid,uuid,text,jsonb)TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
