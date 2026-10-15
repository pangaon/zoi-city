-- Support current workspace ownership reads without scanning the public catalogue.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $guard$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='zoi.listings'::regclass AND pg_get_userbyid(relowner)='postgres')
 OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='zoi.listings'::regclass AND attname='owner_workspace_id' AND atttypid='uuid'::regtype AND NOT attisdropped)
 OR to_regclass('zoi.listings_owner_workspace_lookup_idx') IS NOT NULL
 THEN RAISE EXCEPTION 'owner_listing_index_prerequisite_changed'; END IF;
END $guard$;
CREATE INDEX listings_owner_workspace_lookup_idx ON zoi.listings(owner_workspace_id) WHERE owner_workspace_id IS NOT NULL;
COMMENT ON INDEX zoi.listings_owner_workspace_lookup_idx IS 'Current owner-workspace equality reads; excludes the unowned public catalogue. No authorization or listing content change.';
COMMIT;
