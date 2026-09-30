begin;
set local timezone='UTC';
set local statement_timeout='15s';set local lock_timeout='3s';
do $qa$
declare ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor uuid:='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';eid uuid:=gen_random_uuid();pid uuid:=gen_random_uuid();rid uuid:=gen_random_uuid();cat bigint;p jsonb;a jsonb;r jsonb;offer jsonb;form jsonb;
begin
 perform set_config('request.jwt.claim.sub',actor::text,true);
 if coalesce(zoi.ops_role(ws),'') not in('owner','admin') then raise exception 'qa_owned_workspace_required';end if;
 select id into cat from zoi.categories limit 1;
 insert into zoi.listings(id,entity_type,name,primary_category_id,city,country,address,website,publish_status,marketplace_status,owner_workspace_id,slug)
 values(eid,'business','Transactional sponsor verification',cat,'Athens','Greece','Verification venue','https://example.org','published','none',ws,'rollback-festival-qa-'||eid);
 offer:=jsonb_build_object('event_id',eid,'kind','sponsor','name','Rollback sponsor package','description','Synthetic benefits','benefits',jsonb_build_array('Programme credit'),'price_cents',12500,'currency','EUR','capacity',1,'closes_at',to_char(clock_timestamp()+interval '7 days','YYYY-MM-DD"T"HH24:MI:SSOF'),'timezone','UTC','active',true);
 -- JSON timestamptz formatting guarantees an explicit ISO offset accepted by the RPC.
 offer:=jsonb_set(offer,'{closes_at}',to_jsonb(to_char(clock_timestamp()+interval '7 days','YYYY-MM-DD"T"HH24:MI:SS')||'+00:00'));
 p:=public.festival_package_save(ws,pid,0,offer)->'package';
 r:=public.festival_catalog(eid);if jsonb_array_length(r->'packages')<>1 then raise exception 'qa_offer_publication_failed';end if;
 form:='{"organisation":"Synthetic sponsor","contact_name":"QA","contact_email":"qa@example.invalid","category":"sponsor","units":1,"notes":"Rollback verification only"}'::jsonb;
 a:=public.festival_apply(pid,1,rid,form)->'application';r:=public.festival_apply(pid,1,rid,form);if r->'application'->>'id' is distinct from a->>'id' then raise exception 'qa_application_retry_failed';end if;
 r:=public.inquiry_thread((a->>'inquiry_id')::uuid);if jsonb_array_length(r->'messages')<>1 then raise exception 'qa_private_conversation_failed';end if;
 a:=public.festival_application_decide(ws,(a->>'id')::uuid,1,'approve','')->'application';r:=public.festival_catalog(eid);if (r->'packages'->0->>'remaining')::integer<>0 then raise exception 'qa_allocation_failed';end if;
 perform public.festival_package_save(ws,pid,1,jsonb_set(offer,'{price_cents}','15000'));
 r:=public.festival_my_applications(eid);if not exists(select 1 from jsonb_array_elements(r->'applications') x where x->>'id'=a->>'id' and (x->>'total_cents')::integer=12500) then raise exception 'qa_terms_snapshot_failed';end if;
 a:=public.festival_application_withdraw((a->>'id')::uuid,2,'Synthetic rollback withdrawal')->'application';r:=public.festival_catalog(eid);if a->>'status'<>'withdrawn' or (r->'packages'->0->>'remaining')::integer<>1 then raise exception 'qa_capacity_release_failed';end if;
 r:=public.festival_operator(ws,eid);if jsonb_array_length(r->'audit')<>5 then raise exception 'qa_audit_failed';end if;
end $qa$;
rollback;
select true as rollback_festival_flow_passed,(select count(*) from zoi.listings where slug like 'rollback-festival-qa-%') as persisted_test_listings;
