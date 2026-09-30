-- Only an isolated QA workspace draft is written, wholly inside ROLLBACK. No event publication or external image fetch.
begin;
set local statement_timeout='20s';
set local lock_timeout='3s';
create temporary table qa_venue_reference(plan_id uuid,layout jsonb) on commit drop;
do $identity$
begin
 perform 1 from zoi.workspaces where id='053a5656-b19b-48a4-8721-65c4674f647c' for update;
 if not found or not exists(select 1 from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id='053a5656-b19b-48a4-8721-65c4674f647c' and m.profile_id='21a04e78-e3b1-448e-8517-47aad25dd5da' and m.role='owner' and p.auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd') then raise exception 'qa_workspace_identity_mismatch';end if;
 if exists(select 1 from zoi.venue_plans where workspace_id='053a5656-b19b-48a4-8721-65c4674f647c' and layout->>'name'='QA rollback calibrated reference') then raise exception 'qa_existing_fixture_do_not_modify';end if;
end $identity$;
grant select,insert on qa_venue_reference to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd',true);
do $save$
declare ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';image jsonb:=jsonb_build_object('url','https://images.example.com/qa-floor.jpg','caption','QA documentary reference only');l jsonb;r jsonb;loaded jsonb;
begin
 if public.venue_reference_capabilities(ws)->>'version'<>'1' then raise exception 'qa_reference_capability_unavailable';end if;
 l:=jsonb_build_object('version',1,'name','QA rollback calibrated reference','width',20,'depth',15,'objects',jsonb_build_array(jsonb_build_object('id','seat-a1','kind','seat','label','A1','x',2,'y',4,'width',0.65,'depth',0.65,'height',0.85,'accessible',false,'excluded',false,'section_id','left','view_image',image)),'sections',jsonb_build_array(jsonb_build_object('id','left','label','Left section','view_image',image)),'reference',image||jsonb_build_object('pixel_width',1000,'pixel_height',750,'calibration',jsonb_build_object('x1',0,'y1',0,'x2',1000,'y2',0,'distance_m',20)));
 r:=public.venue_plan_save(ws,null,0,l);if r->'layout' is distinct from l or r->>'revision'<>'1' then raise exception 'qa_reference_persistence_mismatch';end if;
 insert into qa_venue_reference values((r->>'plan_id')::uuid,l);
 loaded:=public.venue_plan_get(ws,(r->>'plan_id')::uuid);if loaded->'layout' is distinct from l then raise exception 'qa_reference_read_mismatch';end if;
 begin perform public.venue_plan_save(ws,null,0,jsonb_set(l,'{reference,url}','"https://127.0.0.1/unsafe.jpg"'));raise exception 'qa_unsafe_image_unexpected_success';exception when others then if sqlerrm<>'unsafe_venue_image_url' then raise;end if;end;
 r:=public.venue_plan_save(ws,(r->>'plan_id')::uuid,1,jsonb_set(l,'{reference,caption}','"Updated organizer drawing"'));if r->>'revision'<>'2' then raise exception 'qa_reference_revision_failed';end if;
 begin perform public.venue_plan_save(ws,(r->>'plan_id')::uuid,1,l);raise exception 'qa_stale_reference_unexpected_success';exception when serialization_failure then null;end;
end $save$;
reset role;
do $history$
declare f record;
begin select * into f from qa_venue_reference;if(select layout from zoi.venue_plan_revisions where plan_id=f.plan_id and revision=1) is distinct from f.layout then raise exception 'qa_original_reference_revision_changed';end if;end $history$;
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
do $anonymous_identity$
declare f record;
begin select * into f from qa_venue_reference;begin perform public.venue_plan_get('053a5656-b19b-48a4-8721-65c4674f647c',f.plan_id);raise exception 'qa_no_session_unexpected_access';exception when insufficient_privilege then null;end;end $anonymous_identity$;
reset role;
rollback;
select true as venue_reference_rollback_passed,(select count(*) from zoi.venue_plans where workspace_id='053a5656-b19b-48a4-8721-65c4674f647c' and layout->>'name'='QA rollback calibrated reference') as persisted_test_plans;
