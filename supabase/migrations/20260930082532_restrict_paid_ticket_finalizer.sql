-- Payment confirmation is server-only. Do not alter/activate the legacy paid writer.
BEGIN;
REVOKE ALL ON FUNCTION public.tickets_paid_finalize(text,uuid,bigint,text,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tickets_paid_finalize(text,uuid,bigint,text,text,integer,integer) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
