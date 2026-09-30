begin;
set local statement_timeout='15s';set local lock_timeout='3s';
do $qa$
declare ws uuid;actor uuid;eid uuid:=gen_random_uuid();tid bigint:=-(1000000000+floor(random()*1000000000))::bigint;plan jsonb;h jsonb;r jsonb;c jsonb;h2 jsonb;r2 jsonb;layout jsonb;cat bigint;
begin
 select m.workspace_id,p.auth_user_id into ws,actor from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.role in ('owner','admin') and p.auth_user_id is not null limit 1;
 if ws is null then raise exception 'qa_owner_missing';end if;
 select id into cat from zoi.categories limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 update zoi.seating_runtime set enabled=true;
 insert into zoi.listings(id,entity_type,name,primary_category_id,city,country,address,website,publish_status,marketplace_status,owner_workspace_id,slug)
 values(eid,'event','Transactional venue verification',cat,'Athens','Greece','Verification venue','https://example.org','published','none',ws,'rollback-qa-'||eid);
 if (select publish_status from zoi.listings where id=eid)<>'published' then raise exception 'qa_publication_gate_failed';end if;
 insert into zoi.ticket_types(id,event_id,workspace_id,name,price_cents,capacity) values(tid,eid,ws,'Rollback QA free seating',0,2);
 layout:='{"version":1,"name":"Transactional verification","width":10,"depth":10,"objects":[{"id":"a1","kind":"seat","label":"A1","x":1,"y":1,"width":0.65,"depth":0.65,"height":0.85,"accessible":false,"excluded":false},{"id":"a2","kind":"seat","label":"A2","x":2,"y":1,"width":0.65,"depth":0.65,"height":0.85,"accessible":false,"excluded":false}]}'::jsonb;
 plan:=public.venue_plan_save(ws,null,0,layout);
 perform public.venue_plan_publish(ws,(plan->>'plan_id')::uuid,1,eid,tid);
 if jsonb_array_length(public.tickets_seat_map(eid)->'seats')<>2 then raise exception 'qa_map_failed';end if;
 h:=public.tickets_seat_hold(eid,array['a1'],gen_random_uuid());
 r:=public.tickets_seat_reserve((h->>'hold_id')::uuid,'Rollback QA','rollback@example.invalid');
 if coalesce((r->>'ok')::boolean,false) is not true or (r->>'code') is null then raise exception 'qa_reserve_failed';end if;
 c:=public.tickets_checkin(ws,r->>'code');
 if coalesce((c->>'ok')::boolean,false) is not true or (c->>'already')::boolean then raise exception 'qa_checkin_failed';end if;
 c:=public.tickets_checkin(ws,r->>'code');if not (c->>'already')::boolean then raise exception 'qa_repeat_scan_failed';end if;
 h2:=public.tickets_seat_hold(eid,array['a2'],gen_random_uuid());
 r2:=public.tickets_seat_reserve((h2->>'hold_id')::uuid,'Rollback QA','rollback@example.invalid');
 c:=public.tickets_seat_cancel((h2->>'hold_id')::uuid);if not (c->>'cancelled')::boolean then raise exception 'qa_cancel_failed';end if;
 perform public.tickets_seat_release((h2->>'hold_id')::uuid);
 c:=public.tickets_seat_cancel((h2->>'hold_id')::uuid);if not (c->>'cancelled')::boolean then raise exception 'qa_cancel_retry_failed';end if;
 c:=public.tickets_checkin(ws,r2->>'code');if c->>'error'<>'reservation_cancelled' then raise exception 'qa_cancelled_scan_failed';end if;
 if (select reserved from zoi.ticket_types where id=tid)<>1 then raise exception 'qa_counter_failed';end if;
 if jsonb_array_length(public.tickets_seat_status(eid)->'reservations')<>2 then raise exception 'qa_status_failed';end if;
end $qa$;
rollback;
select true as rollback_flow_passed,(select enabled from zoi.seating_runtime) as runtime_enabled_after_rollback,(select count(*) from zoi.listings where slug like 'rollback-qa-%') as persisted_test_events;
