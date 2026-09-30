BEGIN;
SET LOCAL lock_timeout='5s';
DO $migration$
DECLARE definition text;needle text:=$needle$and l.publish_status='published' and coalesce(l.marketplace_status,'')<>'hidden'$needle$;
BEGIN
 definition:=pg_get_functiondef('public.booking_create(uuid,uuid,text,text,integer,integer)'::regprocedure);
 IF (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'booking_create_definition_changed_review_required';END IF;
 EXECUTE replace(definition,needle,$replacement$and l.publish_status='published' and l.moderation_status in('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden'$replacement$);
END $migration$;
NOTIFY pgrst,'reload schema';
COMMIT;
