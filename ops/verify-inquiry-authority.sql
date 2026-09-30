begin;
set local statement_timeout='15s';set local lock_timeout='3s';
do $qa$
declare ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor uuid:='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';eid uuid:=gen_random_uuid();cat bigint;t jsonb;r jsonb;request uuid:=gen_random_uuid();cancel_request uuid:=gen_random_uuid();blocked boolean:=false;
begin
 perform set_config('request.jwt.claim.sub',actor::text,true);
 if coalesce(zoi.ops_role(ws),'') not in('owner','admin') then raise exception 'qa_owned_workspace_required';end if;
 select id into cat from zoi.categories where id=6 and slug='events-entertainment';if cat is null then raise exception 'qa_event_category_unavailable';end if;
 insert into zoi.listings(id,entity_type,name,primary_category_id,city,country,address,website,publish_status,marketplace_status,owner_workspace_id,slug,moderation_status,ingestion_source)
 values(eid,'event','Transactional enquiry verification',cat,'Athens','Greece','Verification venue','https://example.org','published','none',ws,'rollback-inquiry-qa-'||eid,'clean','organizer_created');
 if (public.inquiry_availability(eid)->>'available')::boolean is distinct from false then raise exception 'qa_opt_in_failed';end if;
 perform public.inquiry_settings_save(ws,eid,true,0);
 if (public.inquiry_availability(eid)->>'available')::boolean is distinct from true then raise exception 'qa_available_failed';end if;
 t:=public.inquiry_start(eid,'Rollback QA enquiry','Private synthetic test message',request)->'thread';
 r:=public.inquiry_start(eid,'Rollback QA enquiry','Private synthetic test message',request)->'thread';
 if t->>'id' is distinct from r->>'id' then raise exception 'qa_idempotency_failed';end if;
 r:=public.inquiry_reply((t->>'id')::uuid,'Private synthetic reply',gen_random_uuid());if r->'message'->>'id' is null then raise exception 'qa_reply_failed';end if;
 r:=public.inquiry_update(ws,(t->>'id')::uuid,2,'resolved',null);if r->'thread'->>'status'<>'resolved' then raise exception 'qa_resolution_failed';end if;
 r:=public.inquiry_thread((t->>'id')::uuid);if jsonb_array_length(r->'messages')<>2 or jsonb_array_length(r->'audit')<>3 then raise exception 'qa_thread_history_failed';end if;
 r:=public.inquiry_inbox(ws);if not exists(select 1 from jsonb_array_elements(r->'threads') x where x->>'id'=t->>'id') then raise exception 'qa_inbox_failed';end if;
 r:=public.inquiry_mine();if not exists(select 1 from jsonb_array_elements(r->'threads') x where x->>'id'=t->>'id') then raise exception 'qa_customer_history_failed';end if;
 r:=public.inquiry_receipt(request);if r#>>'{receipt,thread_id}' is distinct from t->>'id' or r#>>'{receipt,kind}' is distinct from 'start' then raise exception 'qa_receipt_failed';end if;
 update zoi.listings set moderation_status='flagged' where id=eid;
 if public.inquiry_availability(eid)->>'available' is distinct from 'false' or public.inquiry_thread((t->>'id')::uuid)->>'can_reply' is distinct from 'false' then raise exception 'qa_moderation_failed';end if;
 r:=public.inquiry_receipt(request);if r->>'found' is distinct from 'true' then raise exception 'qa_historical_receipt_failed';end if;
 update zoi.listings set moderation_status='clean' where id=eid;
 r:=public.inquiry_cancel_pending(cancel_request);if r->>'cancelled' is distinct from 'true' then raise exception 'qa_cancel_failed';end if;
 begin perform public.inquiry_start(eid,'Cancelled message','Must not arrive',cancel_request);exception when others then if sqlerrm='inquiry_request_cancelled' then blocked:=true;else raise;end if;end;
 if not blocked then raise exception 'qa_late_message_not_blocked';end if;
 r:=public.inquiry_cancel_pending(request);if r->>'cancelled' is distinct from 'false' or r#>>'{receipt,thread_id}' is distinct from t->>'id' then raise exception 'qa_committed_cancel_failed';end if;
 perform public.inquiry_settings_save(ws,eid,false,1);
 if (public.inquiry_availability(eid)->>'available')::boolean is distinct from false then raise exception 'qa_disable_failed';end if;
end $qa$;
rollback;
select true as rollback_inquiry_flow_passed,(select count(*) from zoi.listings where slug like 'rollback-inquiry-qa-%') as persisted_test_listings;
