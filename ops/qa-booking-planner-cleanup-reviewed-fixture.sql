-- ONE-OFF recovery for the exact fixture reviewed in /tmp/zoi-cleanup-review.json.
-- Requires root approval of the publication-trigger cause before execution.
-- Generic cleanup remains strict; this does not authorize deleting other published listings.
-- Unexpected changes, bookings or shared references abort the entire cleanup.
begin;
set local statement_timeout='15s';
set local lock_timeout='3s';
create temporary table qa_booking_planner_cleanup_receipt(receipt jsonb) on commit preserve rows;
do $qa$
declare
 ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';
 actor constant uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';
 cfg zoi.booking_settings;l zoi.listings;s zoi.booking_services;r zoi.booking_resources;
 label text;plan_count integer;slot_count integer;
begin
 perform 1 from zoi.workspaces where id=ws for update;
 if not found or not exists(select 1 from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id=ws and p.id=actor and p.auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd' and m.role='owner') then raise exception 'qa_workspace_identity_mismatch';end if;
 select * into cfg from zoi.booking_settings where workspace_id=ws for update;
 if cfg.workspace_id is null then raise exception 'qa_fixture_missing_do_not_guess';end if;
 select * into l from zoi.listings where id=cfg.listing_id and owner_workspace_id=ws for update;
 label:='QA private booking planner '||l.id::text;
 if l.id is distinct from 'e7b18e84-41cb-4b13-a591-2f1ed55ef4ff'::uuid or l.slug is distinct from 'qa-private-booking-planner-'||l.id::text or l.name is distinct from label or l.publish_status is distinct from 'published' or l.marketplace_status is distinct from 'hidden' or cfg.enabled is distinct from false or cfg.version<>1 or cfg.timezone<>'Europe/Athens' or cfg.currency<>'EUR' then raise exception 'qa_fixture_changed_do_not_delete';end if;
 if (select count(*) from zoi.booking_services where workspace_id=ws and name=label)<>1 or (select count(*) from zoi.booking_resources where workspace_id=ws and name=label)<>1 then raise exception 'qa_fixture_items_ambiguous';end if;
 select * into r from zoi.booking_resources where workspace_id=ws and name=label for update;
 select * into s from zoi.booking_services where workspace_id=ws and name=label for update;
 if s.id is distinct from 'cae180a0-d60a-465b-83eb-7bd5f49d071c'::uuid or r.id is distinct from '47a4534f-3ad8-4791-ada6-dc674eb52364'::uuid or s.version<>1 or r.version<>1 or s.duration_minutes<>60 or s.buffer_minutes<>15 or s.price_cents<>0 or r.kind<>'staff' or r.capacity<>1 then raise exception 'qa_fixture_items_changed';end if;
 if exists(select 1 from zoi.booking_slots where (service_id=s.id or resource_id=r.id) and (workspace_id<>ws or service_id<>s.id or resource_id<>r.id or version<>1)) or exists(select 1 from zoi.booking_availability_plans where (service_id=s.id or resource_id=r.id) and (workspace_id<>ws or service_id<>s.id or resource_id<>r.id or actor_profile_id<>actor)) then raise exception 'qa_fixture_unexpected_references';end if;
 if exists(select 1 from zoi.bookings b join zoi.booking_slots bs on bs.id=b.slot_id where bs.service_id=s.id or bs.resource_id=r.id) then raise exception 'qa_fixture_has_booking_do_not_delete';end if;
 -- Any unrelated availability/settings dependency prevents cleanup rather than being removed.
 if exists(select 1 from zoi.booking_slots where workspace_id=ws and (service_id<>s.id or resource_id<>r.id)) then raise exception 'qa_unrelated_workspace_slots_do_not_remove_settings';end if;
 if (select count(*) from zoi.booking_slots where workspace_id=ws and service_id=s.id and resource_id=r.id)<>2 or exists(select 1 from zoi.booking_slots where workspace_id=ws and service_id=s.id and resource_id=r.id and id not in('667442f4-f63a-489f-bca8-98f865d0dac5'::uuid,'b60a9e77-aeb7-46f2-b650-f9808e33fb60'::uuid)) then raise exception 'qa_unreviewed_slot_set';end if;
 if (select count(*) from zoi.booking_availability_plans where workspace_id=ws and service_id=s.id and resource_id=r.id)<>3 or exists(select 1 from zoi.booking_availability_plans where workspace_id=ws and service_id=s.id and resource_id=r.id and id not in('982428f0-4519-4a92-bb85-4ec0f6f7b2eb'::uuid,'854ee182-a4df-45e7-af4d-7b017b1675e6'::uuid,'a44b805d-0e5e-4e0b-a816-f0df5f784785'::uuid)) then raise exception 'qa_unreviewed_plan_set';end if;
 delete from zoi.booking_availability_plans where workspace_id=ws and service_id=s.id and resource_id=r.id and actor_profile_id=actor;get diagnostics plan_count=row_count;
 delete from zoi.booking_slots where workspace_id=ws and service_id=s.id and resource_id=r.id;get diagnostics slot_count=row_count;
 delete from zoi.booking_services where id=s.id and workspace_id=ws;
 delete from zoi.booking_resources where id=r.id and workspace_id=ws;
 delete from zoi.booking_settings where workspace_id=ws and listing_id=l.id and enabled=false and version=1;
 delete from zoi.listings where id=l.id and owner_workspace_id=ws and publish_status='published' and marketplace_status='hidden';
 insert into qa_booking_planner_cleanup_receipt values(jsonb_build_object('ok',true,'workspace_id',ws,'listing_id',l.id,'plans_deleted',plan_count,'slots_deleted',slot_count,'public_test_content',false));
end $qa$;
commit;
select receipt from qa_booking_planner_cleanup_receipt;
