begin;
set local statement_timeout='15s';set local lock_timeout='3s';
do $qa$
declare ws uuid;actor uuid;eid uuid:=gen_random_uuid();cat bigint;service jsonb;resource jsonb;slot jsonb;reservation jsonb;reply jsonb;begin_at timestamptz:=clock_timestamp()+interval '2 days';
begin
 select m.workspace_id,p.auth_user_id into ws,actor from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.role in ('owner','admin') and p.auth_user_id is not null and not exists(select 1 from zoi.booking_settings c where c.workspace_id=m.workspace_id) limit 1;
 if ws is null then raise exception 'qa_owner_without_booking_settings_missing';end if;
 select id into cat from zoi.categories limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into zoi.listings(id,entity_type,name,primary_category_id,city,country,address,website,publish_status,marketplace_status,owner_workspace_id,slug)
 values(eid,'business','Transactional booking verification',cat,'Athens','Greece','Verification venue','https://example.org','published','none',ws,'rollback-booking-qa-'||eid);
 perform public.booking_settings_save(ws,0,eid,'Europe/Athens','EUR',true);
 service:=public.booking_item_save(ws,'service',null,0,'{"name":"Transactional service","duration_minutes":60,"buffer_minutes":15,"price_cents":3500,"active":true}')->'item';
 resource:=public.booking_item_save(ws,'resource',null,0,'{"name":"Transactional table","kind":"table","capacity":4,"active":true}')->'item';
 slot:=public.booking_slot_save(ws,null,0,(service->>'id')::uuid,(resource->>'id')::uuid,begin_at,true)->'slot';
 reply:=public.booking_catalog(eid,clock_timestamp(),clock_timestamp()+interval '7 days');
 if jsonb_array_length(reply->'slots')<>1 then raise exception 'qa_availability_failed';end if;
 reservation:=public.booking_create((slot->>'id')::uuid,gen_random_uuid(),'Rollback QA','rollback@example.invalid',4,1)->'booking';
 if reservation->>'status'<>'confirmed' then raise exception 'qa_booking_failed';end if;
 reply:=public.booking_catalog(eid,clock_timestamp(),clock_timestamp()+interval '7 days');
 if jsonb_array_length(reply->'slots')<>0 then raise exception 'qa_booked_slot_still_available';end if;
 reply:=public.booking_my_list(eid);if jsonb_array_length(reply->'bookings')<>1 then raise exception 'qa_history_failed';end if;
 reply:=public.booking_operator_list(ws,clock_timestamp(),clock_timestamp()+interval '7 days');if jsonb_array_length(reply->'bookings')<>1 then raise exception 'qa_operator_failed';end if;
 reply:=public.booking_status_set((reservation->>'id')::uuid,1,'cancelled');if reply->'booking'->>'status'<>'cancelled' then raise exception 'qa_cancel_failed';end if;
 reply:=public.booking_catalog(eid,clock_timestamp(),clock_timestamp()+interval '7 days');if jsonb_array_length(reply->'slots')<>1 then raise exception 'qa_cancel_inventory_failed';end if;
 reply:=public.menu_items_list(ws)::jsonb;if (reply->>'ok')::boolean is not true then raise exception 'qa_menu_failed';end if;
end $qa$;
rollback;
select true as rollback_booking_flow_passed,(select count(*) from zoi.listings where slug like 'rollback-booking-qa-%') as persisted_test_listings;
