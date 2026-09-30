begin;
set local statement_timeout='20s';set local lock_timeout='3s';
do $qa$
declare ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor uuid:='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';eid uuid:=gen_random_uuid();cat bigint;company jsonb;inquiry jsonb;campaign jsonb;deliverable jsonb;brief jsonb;submission jsonb;reply jsonb;req uuid:=gen_random_uuid();
begin
 perform set_config('request.jwt.claim.sub',actor::text,true);
 if coalesce(zoi.ops_role(ws),'') not in('owner','admin') then raise exception 'qa_owned_workspace_required';end if;
 select id into cat from zoi.categories limit 1;
 insert into zoi.listings(id,entity_type,name,primary_category_id,city,country,address,website,publish_status,marketplace_status,owner_workspace_id,slug)
 values(eid,'business','Transactional creator verification',cat,'Athens','Greece','Verification venue','https://example.org','published','none',ws,'rollback-creator-qa-'||eid);
 company:=public.ops_record_save(ws,'company','{"title":"Transactional creator QA","sector":"creator"}',null,0)->'record';
 perform public.inquiry_settings_save(ws,eid,true,0);
 inquiry:=public.inquiry_start(eid,'Transactional sponsorship','Synthetic campaign scope',gen_random_uuid())->'thread';
 campaign:=public.creator_convert(ws,(inquiry->>'id')::uuid,(company->>'id')::uuid,'sponsorship',req)->'campaign';
 reply:=public.creator_convert(ws,(inquiry->>'id')::uuid,(company->>'id')::uuid,'sponsorship',req);if reply->'campaign'->>'id' is distinct from campaign->>'id' then raise exception 'qa_conversion_retry_failed';end if;
 campaign:=public.creator_draft_save((campaign->>'id')::uuid,1,'{"title":"Synthetic campaign","summary":"One sponsored video","planned_fee_cents":10000,"currency":"EUR","channels":["instagram"],"usage_terms":"Organic placement","disclosure_notes":"Clearly identified sponsorship"}')->'campaign';
 reply:=public.creator_deliverable_save((campaign->>'id')::uuid,gen_random_uuid(),0,'{"title":"Sponsored video","description":"One original video","channel":"instagram","due_at":null}');deliverable:=reply->'deliverable';campaign:=reply->'campaign';
 brief:=public.creator_brief_share((campaign->>'id')::uuid,(campaign->>'version')::integer,gen_random_uuid())->'brief';
 brief:=public.creator_brief_decide((brief->>'id')::uuid,'accepted','Synthetic acknowledgment',gen_random_uuid())->'brief';if brief->>'status'<>'accepted' then raise exception 'qa_brief_acceptance_failed';end if;
 submission:=public.creator_submission_send((campaign->>'id')::uuid,(deliverable->>'id')::uuid,'https://example.org/qa-proof','Synthetic proof only',gen_random_uuid())->'submission';
 submission:=public.creator_submission_decide((submission->>'id')::uuid,'accepted','Synthetic delivery approval',gen_random_uuid())->'submission';if submission->>'status'<>'accepted' then raise exception 'qa_delivery_acceptance_failed';end if;
 if (select status from zoi.ops_records where id=(deliverable->>'task_id')::uuid)<>'completed' then raise exception 'qa_linked_task_completion_failed';end if;
 reply:=public.creator_get((campaign->>'id')::uuid);if jsonb_array_length(reply->'briefs')<>1 or jsonb_array_length(reply->'submissions')<>1 then raise exception 'qa_shared_history_failed';end if;
end $qa$;
rollback;
select true as rollback_creator_flow_passed,(select count(*) from zoi.listings where slug like 'rollback-creator-qa-%') as persisted_test_listings;
