-- Metadata-only acceptance; never creates or finalizes a ticket.
DO $qa$
BEGIN
 IF has_function_privilege('anon','public.tickets_paid_finalize(text,uuid,bigint,text,text,integer,integer)','EXECUTE')
 OR has_function_privilege('authenticated','public.tickets_paid_finalize(text,uuid,bigint,text,text,integer,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'paid_finalizer_client_access_not_contained'; END IF;
 IF NOT has_function_privilege('service_role','public.tickets_paid_finalize(text,uuid,bigint,text,text,integer,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'paid_finalizer_server_grant_missing'; END IF;
END $qa$;
SELECT true AS paid_finalizer_server_only;
