BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='20s';
DO $bucket$ BEGIN
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='geography-source-evidence'AND public IS DISTINCT FROM false)THEN RAISE EXCEPTION 'geography_archive_must_be_private';END IF;
END $bucket$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)VALUES('geography-source-evidence','geography-source-evidence',false,2097152,ARRAY['text/html'])ON CONFLICT(id)DO NOTHING;
CREATE POLICY geography_source_archive_service_only ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated USING(bucket_id<>'geography-source-evidence')WITH CHECK(bucket_id<>'geography-source-evidence');
CREATE FUNCTION public.geography_source_archive_budget()RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH usage AS(SELECT coalesce(sum(CASE WHEN metadata->>'size'~'^[0-9]+$'THEN(metadata->>'size')::numeric ELSE 0 END),0)AS bytes,count(*)FILTER(WHERE metadata->>'size'IS NULL OR metadata->>'size'!~'^[0-9]+$')AS unknown FROM storage.objects)
 SELECT jsonb_build_object('can_archive',unknown=0 AND bytes+15000000<=536870912,'stored_bytes',bytes,'limit_bytes',536870912,'unknown_size_objects',unknown,'definition','All current Storage objects, capped at512MiB with15MB invocation reserve. Unmeasured object sizes block new leases.')FROM usage
$$;
REVOKE ALL ON FUNCTION public.geography_source_archive_budget()FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.geography_source_archive_budget()TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
