begin;
set local statement_timeout='10s';
set local lock_timeout='3s';
do $$begin
 if not exists(select 1 from zoi.user_profiles where auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd') then raise exception 'dedicated_qa_profile_missing';end if;
 if has_function_privilege('anon','public.personal_calendar_save(uuid,integer,jsonb)','execute') or has_table_privilege('authenticated','zoi.personal_calendar_preferences','select') then raise exception 'private_calendar_acl_failed';end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd',true);
do $$declare before_state jsonb;first jsonb;retry jsonb;request uuid:=gen_random_uuid();version integer;data jsonb:='{"enabled":true,"calendar":"new","timezone":"Europe/Athens","feasts":["st_george"],"church_id":null}';begin
 before_state:=public.personal_calendar_get();version:=(before_state->>'version')::integer;
 first:=public.personal_calendar_save(request,version,data);
 if first->>'ok'<>'true' or(first->>'version')::integer<>version+1 or first->>'profile_id'<>before_state->>'profile_id' then raise exception 'calendar_save_receipt_failed';end if;
 retry:=public.personal_calendar_save(request,version,data);if retry is distinct from first then raise exception 'calendar_idempotency_failed';end if;
 begin perform public.personal_calendar_save(gen_random_uuid(),version,data);raise exception 'stale_version_accepted';exception when raise_exception then if sqlerrm<>'calendar_version_conflict' then raise;end if;end;
 if public.personal_calendar_get()->'preferences' is distinct from data then raise exception 'calendar_private_read_failed';end if;
end$$;
reset role;
select jsonb_build_object('ok',true,'checks',5,'external_messages',0,'persisted_preferences',0) as calendar_rollback_result;
rollback;
