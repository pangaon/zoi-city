-- Private fixture only. Refuse any existing booking setup; never publish the listing.
begin;
set local statement_timeout='15s';
set local lock_timeout='3s';
create temporary table qa_booking_planner_receipt(receipt jsonb) on commit preserve rows;
do $qa$
declare
 ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';
 actor constant uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';
 auth_actor constant uuid:='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
 listing uuid:=gen_random_uuid();service uuid:=gen_random_uuid();resource uuid:=gen_random_uuid();cat bigint;label text;stored zoi.listings;
begin
 perform 1 from zoi.workspaces where id=ws for update;
 if not found or not exists(select 1 from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id=ws and p.id=actor and p.auth_user_id=auth_actor and m.role='owner') then raise exception 'qa_workspace_identity_mismatch';end if;
 if exists(select 1 from zoi.booking_settings where workspace_id=ws) or exists(select 1 from zoi.listings where owner_workspace_id=ws and slug like 'qa-private-booking-planner-%') then raise exception 'qa_existing_setup_do_not_modify';end if;
 select id into cat from zoi.categories order by id limit 1;
 if cat is null then raise exception 'qa_category_missing';end if;
 label:='QA private booking planner '||listing::text;
 insert into zoi.listings(id,entity_type,name,primary_category_id,city,country,address,website,publish_status,marketplace_status,owner_workspace_id,slug)
 values(listing,'business',label,cat,'Athens','Greece','Private QA fixture','https://example.invalid','draft','hidden',ws,'qa-private-booking-planner-'||listing::text);
 select * into stored from zoi.listings where id=listing;
 if stored.publish_status is distinct from 'draft' or stored.marketplace_status is distinct from 'hidden' or stored.owner_workspace_id is distinct from ws then raise exception 'qa_insert_trigger_changed_visibility';end if;
 -- Deliberate private test fixture. Public setup RPC requires a published listing;
 -- this disabled row tests planning without making any QA page/customer availability public.
 insert into zoi.booking_settings(workspace_id,listing_id,timezone,currency,enabled) values(ws,listing,'Europe/Athens','EUR',false);
 insert into zoi.booking_services(id,workspace_id,name,duration_minutes,buffer_minutes,price_cents,active) values(service,ws,label,60,15,0,true);
 insert into zoi.booking_resources(id,workspace_id,name,kind,capacity,active) values(resource,ws,label,'staff',1,true);
 select * into stored from zoi.listings where id=listing;
 if stored.publish_status is distinct from 'draft' or stored.marketplace_status is distinct from 'hidden' then raise exception 'qa_fixture_visibility_changed';end if;
 insert into qa_booking_planner_receipt values(jsonb_build_object('ok',true,'workspace_id',ws,'listing_id',listing,'service_id',service,'resource_id',resource,'published',stored.publish_status='published','marketplace_status',stored.marketplace_status,'booking_enabled',false));
end $qa$;
commit;
select receipt from qa_booking_planner_receipt;
