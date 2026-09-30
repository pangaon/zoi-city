begin;
set local statement_timeout='15s';set local lock_timeout='3s';
do $qa$
declare ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor uuid:='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';company jsonb;project jsonb;entry jsonb;reply jsonb;eid uuid:=gen_random_uuid();payload jsonb;
begin
 perform set_config('request.jwt.claim.sub',actor::text,true);
 if coalesce(zoi.ops_role(ws),'') not in('owner','admin') then raise exception 'qa_owned_workspace_required';end if;
 company:=public.ops_record_save(ws,'company','{"title":"Rollback timekeeping QA","sector":"lawyer"}',null,0)->'record';
 project:=public.ops_record_save(ws,'project',jsonb_build_object('title','Rollback matter','company_id',company->>'id','sector','lawyer'),null,0)->'record';
 payload:=jsonb_build_object('project_id',project->>'id','task_id',null,'started_at','2001-01-15T10:00:00Z','seconds',3600,'description','Synthetic historical time verification','rate_cents',12500,'currency','EUR','billable',true);
 entry:=public.time_entry_save(ws,eid,0,payload)->'entry';if (entry->>'estimated_cents')::integer<>12500 then raise exception 'qa_rate_snapshot_failed';end if;
 reply:=public.time_entry_save(ws,eid,0,payload);if reply->'entry'->>'id' is distinct from eid::text then raise exception 'qa_time_retry_failed';end if;
 entry:=public.time_entry_transition(ws,eid,1,'submit','')->'entry';entry:=public.time_entry_transition(ws,eid,2,'approve','')->'entry';if entry->>'status'<>'approved' then raise exception 'qa_time_approval_failed';end if;
 reply:=public.timekeeping_export(ws,'2001-01-01Z','2001-02-01Z');if not exists(select 1 from jsonb_array_elements(reply->'entries') x where x->>'id'=eid::text) then raise exception 'qa_time_export_failed';end if;
 reply:=public.time_entry_history(ws,eid);if jsonb_array_length(reply->'audit')<>3 then raise exception 'qa_time_audit_failed';end if;
 entry:=public.time_entry_transition(ws,eid,3,'void','Synthetic QA void')->'entry';if entry->>'status'<>'voided' then raise exception 'qa_time_void_failed';end if;
 reply:=public.timekeeping_export(ws,'2001-01-01Z','2001-02-01Z');if exists(select 1 from jsonb_array_elements(reply->'entries') x where x->>'id'=eid::text) then raise exception 'qa_voided_time_exported';end if;
end $qa$;
rollback;
select true as rollback_timekeeping_flow_passed,(select count(*) from zoi.time_entries where description='Synthetic historical time verification') as persisted_test_entries;
