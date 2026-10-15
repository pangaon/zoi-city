-- Root operator only AFTER phase A + actual private Storage Edge proof + phase B.
-- This rollback verifies SQL authority, not Storage bytes or a device upload.
BEGIN;
SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='30s';
CREATE TEMP TABLE qa_community_media_results(label text PRIMARY KEY,passed boolean)ON COMMIT DROP;
GRANT INSERT,SELECT ON qa_community_media_results TO authenticated,service_role;
CREATE FUNCTION pg_temp.media_assert(ok boolean,label text)RETURNS void LANGUAGE plpgsql AS $$BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'community_media_proof_failed:%',label;END IF;INSERT INTO pg_temp.qa_community_media_results VALUES(label,true);END$$;
DO $proof$
DECLARE executor name:=current_user;account constant uuid:='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';actor constant uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';asset constant uuid:='c15f0000-0000-4000-8000-202610150001';nonce constant uuid:='c15f0000-0000-4000-8000-202610150002';sid uuid;started jsonb;done jsonb;denied boolean;metadata jsonb:='{"type":"image","mime_type":"image/png","width":1,"height":1,"duration_seconds":null}';digest text:=repeat('a',64);
BEGIN
 IF EXISTS(SELECT 1 FROM zoi.community_media_assets WHERE id=asset OR(profile_id=actor AND request_id=nonce))THEN RAISE EXCEPTION 'qa_media_fixture_collision';END IF;
 SELECT s.id INTO sid FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id JOIN zoi.user_profiles p ON p.auth_user_id=u.id WHERE s.user_id=account AND p.id=actor AND(s.not_after IS NULL OR s.not_after>clock_timestamp())AND u.deleted_at IS NULL AND NOT coalesce(u.is_anonymous,false)AND(u.banned_until IS NULL OR u.banned_until<=clock_timestamp())ORDER BY s.created_at DESC LIMIT 1;
 IF sid IS NULL THEN RAISE EXCEPTION 'dedicated_qa_current_session_unavailable';END IF;
 INSERT INTO zoi.community_media_assets(id,profile_id,request_id,purpose,mime_type,size_bytes,sha256,metadata)VALUES(asset,actor,nonce,'post','image/png',24,digest,metadata);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated','session_id',sid)::text,true);PERFORM set_config('request.jwt.claim.sub',account::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 started:=public.community_media_begin(nonce,'post','image/png',24,digest,metadata);PERFORM pg_temp.media_assert(started->>'id'=asset::text AND started->>'state'='pending'AND started->>'grant_id'IS NOT NULL,'current_member_upload_grant');
 denied:=false;BEGIN PERFORM public.community_media_finish_verified((started->>'grant_id')::uuid,digest,'image/png',24,metadata);EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;PERFORM pg_temp.media_assert(denied,'member_cannot_call_service_finalizer');
 EXECUTE format('SET LOCAL ROLE %I',executor);EXECUTE 'SET LOCAL ROLE service_role';
 denied:=false;BEGIN PERFORM public.community_media_finish(asset);EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='media_byte_proof_required';END;PERFORM pg_temp.media_assert(denied,'old_pending_writer_closed');
 denied:=false;BEGIN PERFORM public.community_media_finish_verified((started->>'grant_id')::uuid,repeat('b',64),'image/png',24,metadata);EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='media_byte_proof_mismatch';END;PERFORM pg_temp.media_assert(denied,'mismatched_digest_refused');
 done:=public.community_media_finish_verified((started->>'grant_id')::uuid,digest,'image/png',24,metadata);PERFORM pg_temp.media_assert(done#>>'{asset,content_verified}'='true','service_attested_metadata_sql_only_completion');
 PERFORM pg_temp.media_assert(public.community_media_finish_verified((started->>'grant_id')::uuid,digest,'image/png',24,metadata)=done,'same_grant_replay');
 EXECUTE format('SET LOCAL ROLE %I',executor);PERFORM pg_temp.media_assert((SELECT count(*)=1 FROM zoi.community_media_byte_proofs WHERE asset_id=asset),'one_durable_proof');
 denied:=false;BEGIN DELETE FROM zoi.community_media_byte_proofs WHERE asset_id=asset;EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='media_immutable_evidence';END;PERFORM pg_temp.media_assert(denied,'immutable_byte_evidence');
 PERFORM pg_temp.media_assert(NOT has_table_privilege('authenticated','zoi.community_media_upload_grants','SELECT')AND NOT has_table_privilege('service_role','zoi.community_media_byte_proofs','INSERT'),'no_direct_grant_or_proof_api_access');
END$proof$;
SELECT count(*)AS assertions,bool_and(passed)AS all_passed,false AS actual_storage_bytes_checked,false AS provider_calls FROM qa_community_media_results;
ROLLBACK;
SELECT NOT EXISTS(SELECT 1 FROM zoi.community_media_assets WHERE id='c15f0000-0000-4000-8000-202610150001')AS asset_absent,NOT EXISTS(SELECT 1 FROM zoi.community_media_upload_grants WHERE asset_id='c15f0000-0000-4000-8000-202610150001')AS grant_absent,NOT EXISTS(SELECT 1 FROM zoi.community_media_byte_proofs WHERE asset_id='c15f0000-0000-4000-8000-202610150001')AS proof_absent,true AS rollback_complete;
