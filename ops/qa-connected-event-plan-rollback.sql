-- Exact isolated QA workspace only. Published resources exist solely inside this rolled-back transaction.
-- Production proof uses two resources within this QA provider; cross-provider privacy/races are covered by local PostgreSQL tests.
begin;
set local statement_timeout='25s';
set local lock_timeout='3s';
create temporary table qa_event_plan_fixture(workspace_id uuid,listing_id uuid,plan_id uuid,confirm_request uuid,hall_slot uuid,performer_slot uuid,held_booking uuid) on commit drop;
do $setup$
declare ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor constant uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';listing uuid:=gen_random_uuid();cat bigint;s jsonb;hall jsonb;band jsonb;a jsonb;b jsonb;selection_a jsonb;selection_b jsonb;data jsonb;p jsonb;held jsonb;
begin
 perform 1 from zoi.workspaces where id=ws for update;
 if not found or not exists(select 1 from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id=ws and m.profile_id=actor and m.role='owner' and p.auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd') then raise exception 'qa_workspace_identity_mismatch';end if;
 if exists(select 1 from zoi.booking_settings where workspace_id=ws) or exists(select 1 from zoi.listings where owner_workspace_id=ws and slug like 'qa-rollback-event-plan-%') then raise exception 'qa_existing_setup_do_not_modify';end if;
 select id into cat from zoi.categories order by id limit 1;if cat is null then raise exception 'qa_category_missing';end if;
 perform set_config('request.jwt.claim.sub','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd',true);
 insert into zoi.listings(id,entity_type,name,primary_category_id,city,country,address,website,publish_status,marketplace_status,owner_workspace_id,slug) values(listing,'business','Rollback event planner QA',cat,'Athens','Greece','Rollback fixture','https://example.invalid','published','none',ws,'qa-rollback-event-plan-'||listing::text);
 perform public.booking_settings_save(ws,0,listing,'Europe/Athens','EUR',true);
 s:=public.booking_item_save(ws,'service',null,0,'{"name":"Rollback event service","duration_minutes":60,"buffer_minutes":15,"price_cents":10000,"active":true}')->'item';
 hall:=public.booking_item_save(ws,'resource',null,0,'{"name":"Rollback hall","kind":"venue","capacity":250,"active":true}')->'item';
 band:=public.booking_item_save(ws,'resource',null,0,'{"name":"Rollback band","kind":"performer","capacity":1,"active":true}')->'item';
 a:=public.booking_slot_save(ws,null,0,(s->>'id')::uuid,(hall->>'id')::uuid,now()+interval '2 days',true)->'slot';
 b:=public.booking_slot_save(ws,null,0,(s->>'id')::uuid,(band->>'id')::uuid,now()+interval '2 days',true)->'slot';
 -- Accepted slot pricing must not be silently changed by a newer service price.
 perform public.booking_item_save(ws,'service',(s->>'id')::uuid,1,'{"name":"Rollback event service","duration_minutes":60,"buffer_minutes":15,"price_cents":15000,"active":true}');
 selection_a:=jsonb_build_object('slot_id',a->>'id','listing_id',listing,'workspace_id',ws,'slot_version',1,'settings_version',1,'party_size',200,'price_cents',10000,'currency','EUR','resource_kind','venue','role','Hall','shared_context','Only shared hall context');
 selection_b:=jsonb_build_object('slot_id',b->>'id','listing_id',listing,'workspace_id',ws,'slot_version',1,'settings_version',1,'party_size',1,'price_cents',10000,'currency','EUR','resource_kind','performer','role','Band','shared_context','Only shared band context');
 data:=jsonb_build_object('title','Rollback private occasion','kind','wedding','timezone','Europe/Athens','private_notes','PRIVATE NOTES MUST NOT REACH PROVIDERS','customer_name','Rollback QA','customer_email','rollback@example.invalid','selections',jsonb_build_array(selection_a,selection_b));
 p:=public.event_plan_save(null,0,gen_random_uuid(),data)->'plan';
 held:=public.booking_create((b->>'id')::uuid,gen_random_uuid(),'Rollback conflicting booking','rollback@example.invalid',1,1)->'booking';
 insert into qa_event_plan_fixture values(ws,listing,(p->>'id')::uuid,gen_random_uuid(),(a->>'id')::uuid,(b->>'id')::uuid,(held->>'id')::uuid);
end $setup$;
grant select on qa_event_plan_fixture to authenticated,anon;
set local role anon;
do $anonymous$
declare f record;
begin select * into f from qa_event_plan_fixture;begin perform public.event_plan_get(f.plan_id);raise exception 'qa_anonymous_plan_unexpected_access';exception when insufficient_privilege then null;end;end $anonymous$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
do $missing_session$
declare f record;
begin select * into f from qa_event_plan_fixture;begin perform public.event_plan_get(f.plan_id);raise exception 'qa_missing_session_unexpected_access';exception when insufficient_privilege then null;end;end $missing_session$;
select set_config('request.jwt.claim.sub','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd',true);
do $confirm$
declare f record;r jsonb;again jsonb;current_state jsonb;context jsonb;booking_id uuid;
begin
 select * into f from qa_event_plan_fixture;
 begin perform public.event_plan_confirm(f.plan_id,1,f.confirm_request);raise exception 'qa_conflicting_plan_unexpected_success';exception when others then if sqlerrm<>'slot_unavailable' then raise;end if;end;
 current_state:=public.event_plan_get(f.plan_id);if current_state->'plan'->>'status'<>'draft' or jsonb_array_length(current_state->'bookings')<>0 then raise exception 'qa_partial_plan_after_failure';end if;
 perform public.booking_status_set(f.held_booking,1,'cancelled');
 r:=public.event_plan_confirm(f.plan_id,1,f.confirm_request);again:=public.event_plan_confirm(f.plan_id,1,f.confirm_request);
 if r is distinct from again or jsonb_array_length(r->'bookings')<>2 or r->>'payment_collected'<>'false' then raise exception 'qa_atomic_plan_receipt_failed';end if;
 select (entry->'booking'->>'id')::uuid into booking_id from jsonb_array_elements(r->'bookings')entry where entry->>'role'='Hall';
 context:=public.event_plan_provider_context(booking_id);if context->'context'->>'shared_context'<>'Only shared hall context' or context::text like '%PRIVATE NOTES%' or context::text like '%shared band context%' or context::text like '%'||f.plan_id::text||'%' then raise exception 'qa_provider_context_privacy_failed';end if;
 perform public.booking_status_set(booking_id,1,'cancelled');
 current_state:=public.event_plan_get(f.plan_id);if not exists(select 1 from jsonb_array_elements(current_state->'bookings')entry where entry->'booking'->>'id'=booking_id::text and entry->'booking'->>'status'='cancelled') then raise exception 'qa_current_plan_state_not_refreshed';end if;
 if public.event_plan_confirm(f.plan_id,1,f.confirm_request) is distinct from r then raise exception 'qa_historical_confirmation_receipt_changed';end if;
end $confirm$;
reset role;
rollback;
select true as connected_event_plan_rollback_passed,
 (select count(*) from zoi.listings where owner_workspace_id='053a5656-b19b-48a4-8721-65c4674f647c' and slug like 'qa-rollback-event-plan-%') as persisted_test_listings,
 (select count(*) from zoi.booking_settings where workspace_id='053a5656-b19b-48a4-8721-65c4674f647c') as remaining_qa_booking_settings;
