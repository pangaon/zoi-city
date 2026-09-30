-- Isolated QA workspace only. Every test mutation is rolled back.
-- Published fixture visibility exists only inside this uncommitted transaction.
begin;
set local statement_timeout='20s';
set local lock_timeout='3s';
create temporary table qa_catalog_fixture(listing uuid,service_b uuid,package_b uuid,property_b uuid) on commit drop;
do $setup$
declare ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor constant uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';l uuid:=gen_random_uuid();cat bigint;sa uuid:=gen_random_uuid();sb uuid:=gen_random_uuid();res uuid:=gen_random_uuid();fa uuid:=gen_random_uuid();fb uuid:=gen_random_uuid();pa uuid:=gen_random_uuid();pb uuid:=gen_random_uuid();v jsonb;
begin
 perform 1 from zoi.workspaces where id=ws for update;
 if not found or not exists(select 1 from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id=ws and m.profile_id=actor and m.role='owner' and p.auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd') then raise exception 'qa_workspace_identity_mismatch';end if;
 if exists(select 1 from zoi.booking_settings where workspace_id=ws) or exists(select 1 from zoi.listings where slug like 'qa-rollback-catalog-%') then raise exception 'qa_existing_setup_do_not_modify';end if;
 select id into cat from zoi.categories order by id limit 1;if cat is null then raise exception 'qa_category_missing';end if;
 insert into zoi.listings(id,entity_type,name,primary_category_id,city,country,address,website,publish_status,marketplace_status,moderation_status,owner_workspace_id,slug)
 values(l,'business','Rollback catalogue QA',cat,'Athens','Greece','Rollback fixture','https://example.invalid','published','none','clean',ws,'qa-rollback-catalog-'||l::text);
 if not exists(select 1 from zoi.listings where id=l and publish_status='published' and coalesce(marketplace_status,'')<>'hidden') then raise exception 'qa_fixture_not_public_inside_transaction';end if;
 insert into zoi.booking_settings(workspace_id,listing_id,timezone,currency,enabled)values(ws,l,'UTC','EUR',true);
 insert into zoi.booking_services(id,workspace_id,name,duration_minutes)values(sa,ws,'A earlier',30),(sb,ws,'B requested first',30);
 insert into zoi.booking_resources(id,workspace_id,name,kind,capacity)values(res,ws,'QA room','table',5);
 insert into zoi.booking_slots(workspace_id,service_id,resource_id,starts_at,ends_at,blocked_until,service_name,resource_name,capacity,price_cents,currency)
 values(ws,sa,res,now()+interval '2 days',now()+interval '2 days 30 minutes',now()+interval '2 days 30 minutes','A earlier','QA room',5,100,'EUR'),(ws,sb,res,now()+interval '3 days',now()+interval '3 days 30 minutes',now()+interval '3 days 30 minutes','B requested first','QA room',5,200,'EUR');
 insert into zoi.festival_packages(id,workspace_id,event_id,kind,name,description,benefits,price_cents,currency,capacity,closes_at,timezone,active,created_by,initial_data)
 values(fa,ws,l,'booth','A first alphabetically','Rollback-only','[]',100,'EUR',2,now()+interval '7 days','UTC',true,actor,'{}'),(fb,ws,l,'booth','B requested first','Rollback-only','[]',200,'EUR',2,now()+interval '7 days','UTC',true,actor,'{}');
 insert into zoi.property_offers(id,workspace_id,host_id,data,status,published,initial_data,created_by,updated_at)
 values(pa,ws,l,'{"title":"QA A","mode":"sale","city":"Athens"}','available',true,'{}',actor,now()),(pb,ws,l,'{"title":"QA B","mode":"sale","city":"Athens"}','available',true,'{}',actor,now()-interval '1 day');
 v:=jsonb_set(zoi.home_design_default(),'{item_order,offerings}',jsonb_build_array('booking:'||sb,'festival:'||fb,'property:'||pb));
 insert into zoi.home_designs(listing_id,workspace_id,draft,published,published_version)values(l,ws,jsonb_set(zoi.home_design_default(),'{copy,headline}','"PRIVATE QA DRAFT"'),v,1);
 insert into qa_catalog_fixture values(l,sb,fb,pb);
end $setup$;
grant select on qa_catalog_fixture to anon;
set local role anon;
do $reads$
declare f record;b jsonb;e jsonb;p jsonb;
begin
 select * into strict f from pg_temp.qa_catalog_fixture;
 b:=public.booking_catalog(f.listing,now(),now()+interval '7 days');e:=public.festival_catalog(f.listing);p:=public.property_catalog(f.listing);
 if jsonb_array_length(b->'slots')<>2 or b#>>'{slots,0,service_id}'<>f.service_b::text or b#>>'{slots,0,price_cents}'<>'200' then raise exception 'qa_booking_order_or_price_failed';end if;
 if jsonb_array_length(e->'packages')<>2 or e#>>'{packages,0,id}'<>f.package_b::text or e#>>'{packages,0,payment_collected}'<>'false' then raise exception 'qa_festival_order_or_capability_failed';end if;
 if jsonb_array_length(p->'offers')<>2 or p#>>'{offers,0,id}'<>f.property_b::text then raise exception 'qa_property_order_failed';end if;
 if (b::text||e::text||p::text) like '%PRIVATE QA DRAFT%' or (b::text||p::text) like '%sort_rank%' then raise exception 'qa_private_metadata_leak';end if;
 begin perform 1 from zoi.home_designs;raise exception 'qa_private_design_was_readable';exception when insufficient_privilege then null;end;
end $reads$;
reset role;
do $draft$
declare l uuid;v jsonb;
begin
 select listing into strict l from qa_catalog_fixture;
 update zoi.home_designs set published=null,published_version=null where listing_id=l;
 v:=public.booking_catalog(l,now(),now()+interval '7 days');if v#>>'{slots,0,service_name}'<>'A earlier' then raise exception 'qa_private_draft_affected_order';end if;
 update zoi.listings set moderation_status='flagged' where id=l;
 if public.booking_catalog(l,now(),now()+interval '7 days')->>'available'<>'false' or public.festival_catalog(l)->>'available'<>'false' or jsonb_array_length(public.property_catalog(l)->'offers')<>0 then raise exception 'qa_flagged_catalog_leak';end if;
 update zoi.listings set moderation_status='cleared' where id=l;
 if public.booking_catalog(l,now(),now()+interval '7 days')->>'available'<>'true' or public.festival_catalog(l)->>'available'<>'true' or jsonb_array_length(public.property_catalog(l)->'offers')<>2 then raise exception 'qa_cleared_catalog_missing';end if;
 update zoi.listings set marketplace_status='hidden' where id=l;
 if public.booking_catalog(l,now(),now()+interval '7 days')->>'available'<>'false' or public.festival_catalog(l)->>'available'<>'false' or jsonb_array_length(public.property_catalog(l)->'offers')<>0 then raise exception 'qa_hidden_catalog_leak';end if;
end $draft$;
select jsonb_build_object('ok',true,'checks',9,'rollback_follows',true) as qa_catalog_result;
rollback;
select jsonb_build_object('ok',not exists(select 1 from zoi.listings where slug like 'qa-rollback-catalog-%'),'persisted_fixture_rows',(select count(*) from zoi.listings where slug like 'qa-rollback-catalog-%')) as qa_catalog_cleanup;
