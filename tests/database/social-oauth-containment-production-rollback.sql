begin;
set local statement_timeout='10s';
do $$declare v_name text;v_ok boolean;begin
 foreach v_name in array array['social_channels_for_publish','social_channel_upsert','social_oauth_state_put','social_oauth_state_take','social_cron_secret_get','social_due_posts','social_target_record','social_post_finalize'] loop
 select bool_and(not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE') and has_function_privilege('service_role',p.oid,'EXECUTE')) into v_ok from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=v_name;
 if v_ok is distinct from true then raise exception 'social_worker_acl_failed: %',v_name;end if;end loop;
 if has_table_privilege('authenticated','zoi.social_channels','SELECT') or has_table_privilege('anon','zoi.social_oauth_states','SELECT') then raise exception 'social_table_acl_failed';end if;
 if has_function_privilege('authenticated','public.social_channel_remove(uuid,bigint)','EXECUTE') or has_function_privilege('authenticated','public.social_channel_add(uuid,text,text,text)','EXECUTE') then raise exception 'social_legacy_write_acl_failed';end if;
end $$;
select jsonb_build_object('worker_acl_checks',8,'credential_rows_read',0,'secret_values_read',0,'writes',0) as result;
rollback;
