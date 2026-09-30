BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
DO $checks$
DECLARE l record; e jsonb; checked integer:=0;
BEGIN
 IF has_function_privilege('anon','zoi.public_owner_content(uuid)','EXECUTE') OR has_function_privilege('authenticated','zoi.public_owner_content(uuid)','EXECUTE') THEN RAISE EXCEPTION 'private_owner_projection_callable'; END IF;
 FOR l IN SELECT id,slug,photo_url,email FROM zoi.listings WHERE publish_status='published' AND moderation_status IN ('clean','cleared') AND coalesce(marketplace_status,'')<>'hidden' AND slug IS NOT NULL ORDER BY id LIMIT 12 LOOP
   e:=public.seo_entity(l.slug);
   IF (e->>'id')::uuid=l.id THEN
     IF e->>'photo_url' IS DISTINCT FROM l.photo_url OR e->>'email' IS DISTINCT FROM l.email THEN RAISE EXCEPTION 'public_projection_mismatch'; END IF;
     IF NOT (e?'owner_content') THEN RAISE EXCEPTION 'missing_owner_projection'; END IF;
     checked:=checked+1;
   END IF;
 END LOOP;
 IF checked=0 THEN RAISE EXCEPTION 'no_public_projection_checked'; END IF;
END $checks$;
SELECT jsonb_build_object('ok',true,'private_helper',true,'read_only',true,'persisted_rows',0) AS owner_content_result;
ROLLBACK;
