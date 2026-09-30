-- Each constituent verification is independently rolled back. No committed fixtures.
begin;
set local statement_timeout='15s';set local lock_timeout='3s';set local timezone='UTC';
do $qa$
declare ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor uuid:='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';eid uuid:=gen_random_uuid();aid uuid:=gen_random_uuid();pid uuid:=gen_random_uuid();tid uuid:=gen_random_uuid();iid uuid:=gen_random_uuid();cat bigint;p jsonb;t jsonb;i jsonb;r jsonb;proposal jsonb;
begin
 perform set_config('request.jwt.claim.sub',actor::text,true);if coalesce(zoi.ops_role(ws),'') not in('owner','admin') then raise exception 'qa_owned_workspace_required';end if;
 select id into cat from zoi.categories limit 1;
 insert into zoi.listings(id,entity_type,name,primary_category_id,city,country,address,website,publish_status,marketplace_status,owner_workspace_id,slug) values
 (eid,'event','Transactional trip event',cat,'Athens','Greece','Verification venue','https://example.org','published','none',ws,'rollback-trip-event-'||eid),
 (aid,'artist','Transactional trip artist',cat,'Athens','Greece',null,'https://example.org','published','none',ws,'rollback-trip-artist-'||aid);
 proposal:=jsonb_build_object('artist_id',aid,'event_id',eid,'starts_at',to_char(clock_timestamp()+interval '7 days','YYYY-MM-DD"T"HH24:MI:SS')||'+00:00','ends_at',to_char(clock_timestamp()+interval '7 days 1 hour','YYYY-MM-DD"T"HH24:MI:SS')||'+00:00','timezone','Europe/Athens','source_url','https://example.org/rollback-show');
 p:=public.appearance_propose(pid,proposal)->'appearance';if p->>'status'<>'confirmed' then raise exception 'qa_joint_owner_confirmation_failed';end if;
 r:=public.artist_shows(aid);if jsonb_array_length(r->'shows')<>1 then raise exception 'qa_show_discovery_failed';end if;
 t:=public.trip_save(tid,0,'{"name":"Rollback trip verification","timezone":"Europe/Athens","notes":"Private synthetic plan"}')->'trip';
 i:=public.trip_item_save(tid,iid,0,jsonb_build_object('listing_id',eid,'appearance_id',pid,'notes','Synthetic planned show'))->'item';if i->>'starts_at' is distinct from p->>'starts_at' then raise exception 'qa_server_show_time_failed';end if;
 r:=public.trip_get(tid);if jsonb_array_length(r->'items')<>1 or (r->'items'->0->>'appearance_confirmed')::boolean is distinct from true then raise exception 'qa_trip_read_failed';end if;
 perform public.appearance_decide(pid,1,'withdraw');r:=public.trip_get(tid);if (r->'items'->0->>'appearance_confirmed')::boolean is distinct from false then raise exception 'qa_withdrawn_show_warning_failed';end if;
 perform public.trip_remove(tid,iid,1);r:=public.trip_get(tid);if jsonb_array_length(r->'items')<>0 then raise exception 'qa_trip_remove_failed';end if;perform public.trip_remove(tid,null,1);
end $qa$;
rollback;
select true as rollback_trip_flow_passed,(select count(*) from zoi.listings where slug like 'rollback-trip-event-%' or slug like 'rollback-trip-artist-%') as persisted_test_listings;

begin;
set local statement_timeout='15s';set local lock_timeout='3s';set local timezone='UTC';
do $qa$
declare ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor uuid:='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';host uuid:=gen_random_uuid();pid uuid:=gen_random_uuid();rid uuid:=gen_random_uuid();cat bigint;payload jsonb;p jsonb;r jsonb;request jsonb;
begin
 perform set_config('request.jwt.claim.sub',actor::text,true);if coalesce(zoi.ops_role(ws),'') not in('owner','admin') then raise exception 'qa_owned_workspace_required';end if;select id into cat from zoi.categories limit 1;
 insert into zoi.listings(id,entity_type,name,primary_category_id,city,country,address,website,publish_status,marketplace_status,owner_workspace_id,slug) values(host,'business','Transactional property QA',cat,'Athens','Greece','Synthetic verification address','https://example.org','published','none',ws,'rollback-property-qa-'||host);
 payload:=jsonb_build_object('host_id',host,'place_id',host,'mode','holiday_stay','timezone','Europe/Athens','title','Synthetic property verification','description','Synthetic facts only','city','Athens','country','Greece','public_address','','price_on_request',false,'price_cents',15000,'currency','EUR','area',100,'area_unit','sqm','bedrooms',2,'photos','[]'::jsonb,'fee_terms','Ask the owner for all fees.','source_url','https://example.org/synthetic-property','source_checked_on',current_date,'representation','owner','representation_confirmed',true,'status','available','published',false,'source_conflict',false,'conflict_reason','');
 p:=public.property_offer_save(ws,pid,0,payload)->'offer';r:=public.property_catalog(host,pid,null,'');if jsonb_array_length(r->'offers')<>0 then raise exception 'qa_property_draft_exposed';end if;
 payload:=payload||jsonb_build_object('published',true);perform public.property_offer_save(ws,pid,1,payload);r:=public.property_catalog(host,pid,null,'');if r->'offers'->0->'data'->>'price_basis'<>'nightly' then raise exception 'qa_property_price_basis_failed';end if;
 request:='{"kind":"information","message":"Synthetic private property enquiry"}'::jsonb;r:=public.property_request(pid,2,rid,request);if r->'request'->>'inquiry_id' is null then raise exception 'qa_property_thread_missing';end if;
 p:=public.property_request(pid,2,rid,request);if p->'request'->>'id' is distinct from r->'request'->>'id' then raise exception 'qa_property_retry_failed';end if;
 p:=public.inquiry_thread((r->'request'->>'inquiry_id')::uuid);if jsonb_array_length(p->'messages')<>1 then raise exception 'qa_property_conversation_failed';end if;
 perform public.property_offer_save(ws,pid,2,payload||jsonb_build_object('price_cents',16000));p:=public.property_operator(ws);if not exists(select 1 from jsonb_array_elements(p->'requests') x where x->>'id'=r->'request'->>'id' and (x->'offer_snapshot'->'data'->>'price_cents')::integer=15000) then raise exception 'qa_original_property_snapshot_lost';end if;
 perform public.property_offer_save(ws,pid,3,payload||jsonb_build_object('source_conflict',true,'conflict_reason','Synthetic conflicting source'));r:=public.property_catalog(host,pid,null,'');if jsonb_array_length(r->'offers')<>0 then raise exception 'qa_conflicting_property_published';end if;
end $qa$;
rollback;
select true as rollback_property_flow_passed,(select count(*) from zoi.listings where slug like 'rollback-property-qa-%') as persisted_test_listings;
