BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='zoi.social_channels'::regclass AND relkind='r' AND pg_get_userbyid(relowner)='postgres') OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='zoi.social_channels'::regclass AND conname='social_channels_status_check' AND contype='c' AND convalidated AND md5(pg_get_constraintdef(oid))='7a2b6f12902e3fafc4b5a8b87e65d235') THEN RAISE EXCEPTION 'social_channel_status_constraint_changed';END IF;
END $guard$;
ALTER TABLE zoi.social_channels DROP CONSTRAINT social_channels_status_check;
ALTER TABLE zoi.social_channels ADD CONSTRAINT social_channels_status_check CHECK(status IN('pending','connected','error','disconnected'));
COMMIT;
