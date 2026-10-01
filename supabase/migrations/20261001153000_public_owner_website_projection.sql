BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Preserve the reviewed live projection, its security settings and full current
-- hospitality allowlist. Only expose a website already written by the owner suite.
DO $migration$
DECLARE definition text; patched text;
BEGIN
 SELECT pg_get_functiondef('zoi.public_owner_content(uuid)'::regprocedure) INTO definition;
 IF md5(definition) <> 'd34e6bb9fa641480743f2ccc9a9419d0' THEN
  RAISE EXCEPTION 'owner_projection_changed_review_required';
 END IF;
 patched:=replace(definition,'''description'',l.description,''phone'',l.phone,''email'',l.email,',
 '''description'',l.description,''phone'',l.phone,''email'',l.email,''website'',l.website,');
 IF patched=definition THEN RAISE EXCEPTION 'owner_projection_patch_not_applied';END IF;
 EXECUTE patched;
END $migration$;
NOTIFY pgrst,'reload schema';
COMMIT;
