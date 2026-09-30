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
