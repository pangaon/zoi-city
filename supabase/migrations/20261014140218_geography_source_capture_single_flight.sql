BEGIN;
SET LOCAL lock_timeout='3s';
CREATE TABLE zoi.geography_source_capture_lock(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),lease_id uuid,expires_at timestamptz);
ALTER TABLE zoi.geography_source_capture_lock ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.geography_source_capture_lock FROM PUBLIC,anon,authenticated;
INSERT INTO zoi.geography_source_capture_lock(singleton)VALUES(true);
CREATE FUNCTION public.geography_source_capture_acquire(p_lease uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE claimed uuid;expiry timestamptz;BEGIN
 IF p_lease IS NULL THEN RAISE EXCEPTION 'capture_lease_required';END IF;
 UPDATE zoi.geography_source_capture_lock SET lease_id=p_lease,expires_at=clock_timestamp()+interval '180 seconds' WHERE singleton AND(expires_at IS NULL OR expires_at<=clock_timestamp())RETURNING lease_id,expires_at INTO claimed,expiry;
 RETURN jsonb_build_object('acquired',claimed IS NOT NULL,'lease_id',claimed,'expires_at',expiry);
END$$;
CREATE FUNCTION public.geography_source_capture_release(p_lease uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE released uuid;BEGIN
 IF p_lease IS NULL THEN RAISE EXCEPTION 'capture_lease_required';END IF;
 UPDATE zoi.geography_source_capture_lock SET lease_id=NULL,expires_at=NULL WHERE singleton AND lease_id=p_lease RETURNING p_lease INTO released;
 RETURN jsonb_build_object('released',released IS NOT NULL);
END$$;
REVOKE ALL ON FUNCTION public.geography_source_capture_acquire(uuid),public.geography_source_capture_release(uuid)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.geography_source_capture_acquire(uuid),public.geography_source_capture_release(uuid)TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
