BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL request.jwt.claim.sub='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
DO $$DECLARE actor uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';gid uuid:=gen_random_uuid();req uuid:=gen_random_uuid();data jsonb;first jsonb;again jsonb;r jsonb;BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.user_profiles WHERE id=actor AND auth_user_id=auth.uid()) THEN RAISE EXCEPTION 'qa_actor_unavailable';END IF;
 data:=jsonb_build_object('label','Synthetic rollback group','arrangement','together','members',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'first_name','Example','ticket_quantity',3)));
 first:=public.saved_guest_group_save(gid,0,req,data,false);
 again:=public.saved_guest_group_save(gid,0,req,data,false);
 IF first IS DISTINCT FROM again OR first#>>'{group,version}' IS DISTINCT FROM '1' OR first#>>'{group,data,members,0,ticket_quantity}' IS DISTINCT FROM '3' THEN RAISE EXCEPTION 'group_receipt_failed';END IF;
 r:=public.saved_guest_group_receipt(req);IF r->>'found' IS DISTINCT FROM 'true' OR r->'receipt' IS DISTINCT FROM first THEN RAISE EXCEPTION 'group_recovery_failed';END IF;
 PERFORM public.saved_guest_group_save(gid,1,gen_random_uuid(),data,true);
 IF public.saved_guest_group_get(gid)#>>'{group,archived}' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'group_archive_failed';END IF;
 IF has_function_privilege('anon','public.saved_guest_group_list()','EXECUTE') OR has_table_privilege('authenticated','zoi.saved_guest_groups','SELECT') THEN RAISE EXCEPTION 'group_acl_failed';END IF;
END$$;
SELECT 'saved_guest_groups_rollback_passed' AS result;
ROLLBACK;
