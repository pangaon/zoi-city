-- Only the dedicated QA identity; synthetic private listing and reports, all rolled back.
begin;
set local statement_timeout='20s';set local lock_timeout='3s';
create temporary table qa_intelligence_fixture(listing uuid,hash text,report_id uuid) on commit drop;
do $setup$
declare ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor constant uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';l uuid:=gen_random_uuid();cat bigint;h text:=encode(extensions.gen_random_bytes(32),'hex');
begin
 perform 1 from zoi.workspaces where id=ws for update;
 if not found or not exists(select 1 from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id=ws and m.profile_id=actor and m.role='owner' and p.auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd') then raise exception 'qa_identity_mismatch';end if;
 select id into cat from zoi.categories order by id limit 1;
 insert into zoi.listings(id,entity_type,name,primary_category_id,city,country,website,publish_status,marketplace_status,moderation_status,owner_workspace_id,slug) values(l,'business','Synthetic private report test',cat,'Athens','Greece','https://example.org','draft','none','clean',ws,'qa-rollback-intelligence-'||l);
 insert into qa_intelligence_fixture values(l,h,null);
 perform public.intelligence_receipt_store(h,encode(extensions.gen_random_bytes(32),'hex'),jsonb_build_object('ok',true,'mode','free_test','requested_url','https://example.org/about','url','https://example.org/about','checked_at',now(),'checks',jsonb_build_array(jsonb_build_object('label','Title','ok',false,'detail','Synthetic test only'))));
end $setup$;
grant select,update on qa_intelligence_fixture to authenticated;
select set_config('request.jwt.claim.sub','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd',true);
set local role authenticated;
do $flow$
declare f record;a jsonb;b jsonb;ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';
begin
 select * into strict f from pg_temp.qa_intelligence_fixture;
 a:=public.intelligence_report_claim(ws,f.listing,f.hash);b:=public.intelligence_report_claim(ws,f.listing,f.hash);
 if a#>>'{report,id}' is null or a#>>'{report,id}' is distinct from b#>>'{report,id}' or b->>'already_saved'<>'true' then raise exception 'qa_idempotency_failed';end if;
 if public.intelligence_report_get(ws,(a#>>'{report,id}')::uuid)#>>'{report,listing_id}' is distinct from f.listing::text then raise exception 'qa_detail_scope_failed';end if;
 if jsonb_array_length(public.intelligence_reports_list(ws,f.listing,0)->'reports')<>1 then raise exception 'qa_history_failed';end if;
 begin perform public.intelligence_receipt_store(repeat('f',64),repeat('e',64),'{}');raise exception 'qa_receipt_forgery_allowed';exception when insufficient_privilege then null;end;
 begin perform 1 from zoi.intelligence_reports;raise exception 'qa_direct_read_allowed';exception when insufficient_privilege then null;end;
 update pg_temp.qa_intelligence_fixture set report_id=(a#>>'{report,id}')::uuid;
end $flow$;
set local role anon;
do $anon$
begin
 begin perform public.intelligence_reports_list('053a5656-b19b-48a4-8721-65c4674f647c',null,0);raise exception 'qa_anon_allowed';exception when insufficient_privilege then null;end;
end $anon$;
reset role;
select jsonb_build_object('ok',true,'checks',6,'rollback_follows',true) qa_intelligence_result;
rollback;
