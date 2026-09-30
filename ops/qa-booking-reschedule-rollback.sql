-- Run only after private planner fixture cleanup. ALL test rows/state roll back.
-- The transaction's published/enabled fixture is never committed or visible to public requests.
begin;
set local statement_timeout='20s';
set local lock_timeout='3s';
create temporary table qa_reschedule_fixture(workspace_id uuid,booking_id uuid,source_slot uuid,target_slot uuid,request_id uuid,listing_id uuid) on commit drop;
do $setup$
declare ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor constant uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';listing uuid:=gen_random_uuid();cat bigint;s jsonb;r jsonb;source jsonb;target jsonb;b jsonb;
begin
 perform 1 from zoi.workspaces where id=ws for update;
 if not found or not exists(select 1 from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id=ws and m.profile_id=actor and m.role='owner' and p.auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd') then raise exception 'qa_workspace_identity_mismatch';end if;
 if exists(select 1 from zoi.booking_settings where workspace_id=ws) or exists(select 1 from zoi.listings where owner_workspace_id=ws and slug like 'qa-rollback-reschedule-%') then raise exception 'qa_existing_setup_do_not_modify';end if;
 select id into cat from zoi.categories order by id limit 1;if cat is null then raise exception 'qa_category_missing';end if;
 perform set_config('request.jwt.claim.sub','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd',true);
 insert into zoi.listings(id,entity_type,name,primary_category_id,city,country,address,website,publish_status,marketplace_status,owner_workspace_id,slug)
 values(listing,'business','Rollback reschedule QA',cat,'Athens','Greece','Rollback fixture','https://example.invalid','published','none',ws,'qa-rollback-reschedule-'||listing::text);
 perform public.booking_settings_save(ws,0,listing,'Europe/Athens','EUR',true);
 s:=public.booking_item_save(ws,'service',null,0,'{"name":"Rollback service","duration_minutes":60,"buffer_minutes":15,"price_cents":3500,"active":true}')->'item';
 r:=public.booking_item_save(ws,'resource',null,0,'{"name":"Rollback table","kind":"table","capacity":4,"active":true}')->'item';
 source:=public.booking_slot_save(ws,null,0,(s->>'id')::uuid,(r->>'id')::uuid,clock_timestamp()+interval '2 days',true)->'slot';
 s:=public.booking_item_save(ws,'service',(s->>'id')::uuid,1,'{"name":"Rollback service","duration_minutes":60,"buffer_minutes":15,"price_cents":4200,"active":true}')->'item';
 target:=public.booking_slot_save(ws,null,0,(s->>'id')::uuid,(r->>'id')::uuid,clock_timestamp()+interval '3 days',true)->'slot';
 b:=public.booking_create((source->>'id')::uuid,gen_random_uuid(),'Rollback QA','rollback@example.invalid',2,1)->'booking';
 insert into qa_reschedule_fixture values(ws,(b->>'id')::uuid,(source->>'id')::uuid,(target->>'id')::uuid,gen_random_uuid(),listing);
end $setup$;
grant select on qa_reschedule_fixture to authenticated,anon;
set local role anon;
do $anonymous$
declare f record;
begin
 select * into f from qa_reschedule_fixture;
 begin
  perform public.booking_reschedule_options(f.booking_id,clock_timestamp(),clock_timestamp()+interval '7 days');
  raise exception 'qa_anonymous_rpc_unexpected_access';
 exception when insufficient_privilege then null;end;
end $anonymous$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
do $no_session$
declare f record;
begin
 select * into f from qa_reschedule_fixture;
 begin
  perform public.booking_reschedule_history(f.booking_id);
  raise exception 'qa_missing_session_unexpected_access';
 exception when insufficient_privilege then null;end;
end $no_session$;
select set_config('request.jwt.claim.sub','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd',true);
do $verify$
declare f record;options jsonb;moved jsonb;retry jsonb;history jsonb;catalog jsonb;bookings jsonb;
begin
 select * into f from qa_reschedule_fixture;
 options:=public.booking_reschedule_options(f.booking_id,clock_timestamp(),clock_timestamp()+interval '7 days');
 if options->>'booking_id'<>f.booking_id::text or jsonb_array_length(options->'slots')<>1 or options->'slots'->0->>'id'<>f.target_slot::text then raise exception 'qa_replacement_options_failed';end if;
 begin
  perform public.booking_reschedule(f.booking_id,1,f.target_slot,1,f.request_id,3500,'EUR');
  raise exception 'qa_unreviewed_price_unexpected_success';
 exception when others then if sqlerrm<>'booking_price_changed' then raise;end if;end;
 bookings:=public.booking_my_list(f.listing_id);
 if not exists(select 1 from jsonb_array_elements(bookings->'bookings') b where b->>'id'=f.booking_id::text and b->>'slot_id'=f.source_slot::text and b->>'status'='confirmed' and b->>'version'='1') then raise exception 'qa_original_not_preserved';end if;
 moved:=public.booking_reschedule(f.booking_id,1,f.target_slot,1,f.request_id,4200,'EUR');
 if moved->'booking'->>'id'<>f.booking_id::text or moved->'booking'->>'slot_id'<>f.target_slot::text or moved->'booking'->>'version'<>'2' or moved->'booking'->>'status'<>'confirmed' or moved->>'payment_collected'<>'false' or moved->'new_slot'->>'price_cents'<>'4200' then raise exception 'qa_move_receipt_failed';end if;
 retry:=public.booking_reschedule(f.booking_id,1,f.target_slot,1,f.request_id,4200,'EUR');if retry is distinct from moved then raise exception 'qa_retry_receipt_changed';end if;
 history:=public.booking_reschedule_history(f.booking_id);
 if jsonb_array_length(history->'changes')<>1 or history->'changes'->0->'old_slot'->>'id'<>f.source_slot::text or history->'changes'->0->'new_slot'->>'id'<>f.target_slot::text or history->'changes'->0->'old_slot'->>'price_cents'<>'3500' then raise exception 'qa_move_audit_failed';end if;
 catalog:=public.booking_catalog(f.listing_id,clock_timestamp(),clock_timestamp()+interval '7 days');
 if jsonb_array_length(catalog->'slots')<>1 or catalog->'slots'->0->>'id'<>f.source_slot::text then raise exception 'qa_inventory_move_failed';end if;
 perform public.booking_status_set(f.booking_id,2,'cancelled');
 begin
  perform public.booking_reschedule(f.booking_id,3,f.source_slot,1,gen_random_uuid(),3500,'EUR');
  raise exception 'qa_cancelled_booking_unexpected_move';
 exception when others then if sqlerrm<>'booking_not_reschedulable' then raise;end if;end;
end $verify$;
reset role;
rollback;
select true as rollback_reschedule_flow_passed,
 (select count(*) from zoi.listings where owner_workspace_id='053a5656-b19b-48a4-8721-65c4674f647c' and slug like 'qa-rollback-reschedule-%') as persisted_test_listings,
 (select count(*) from zoi.booking_settings where workspace_id='053a5656-b19b-48a4-8721-65c4674f647c') as remaining_qa_booking_settings;
