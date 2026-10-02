-- Separate candidate only: lead owns live load/lock review and execution.
-- Match the installed reader's complete existing ORDER BY and public predicate.
-- No function replacement, copied brand fields, added tie breakers, or new ACLs.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $guard$
DECLARE f record;
BEGIN
  SELECT p.*, md5(pg_get_functiondef(p.oid)) AS body_hash
    INTO f FROM pg_proc p
   WHERE p.oid = to_regprocedure('public.dir_browse(text,text,integer,integer)');
  IF NOT FOUND
    OR f.body_hash <> 'e279764dcf6230973418c810c14732dd'
    OR f.proowner <> 'postgres'::regrole
    OR f.proacl IS DISTINCT FROM
      '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]
    OR to_regclass('zoi.listings_public_directory_order_idx') IS NOT NULL
  THEN
    RAISE EXCEPTION 'directory_order_prerequisite_changed';
  END IF;
END
$guard$;

CREATE INDEX listings_public_directory_order_idx ON zoi.listings (
  (rating IS NOT NULL) DESC,
  rating DESC NULLS LAST,
  (nullif(profile #>> '{brand,logo}', '') IS NOT NULL) DESC,
  completeness_score DESC NULLS LAST,
  name ASC
)
WHERE publish_status = 'published'
  AND moderation_status IN ('clean','cleared')
  AND coalesce(marketplace_status,'') <> 'hidden';

COMMIT;
