-- Synthetic children only; exact existing QA workspace; every change rolls back.
begin;
set local statement_timeout='20s';set local lock_timeout='3s';
create temporary table qa_youth_fixture(listing uuid,program uuid,child uuid,registration uuid,event uuid) on commit drop;
do $setup$
declare ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor constant uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';l uuid:=gen_random_uuid();e uuid:=gen_random_uuid();cat bigint;
begin
 perform 1 from zoi.workspaces where id=ws for update;
 if not found or not exists(select 1 from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id=ws and m.profile_id=actor and m.role='owner' and p.auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd') then raise exception 'qa_identity_mismatch';end if;
 if exists(select 1 from zoi.listings where slug like 'qa-rollback-youth-%') or exists(select 1 from zoi.youth_children where guardian_id=actor) or exists(select 1 from zoi.youth_programs where workspace_id=ws) then raise exception 'qa_preexisting_data_do_not_modify';end if;
 select id into cat from zoi.categories order by id limit 1;
 insert into zoi.listings(id,entity_type,name,primary_category_id,city,country,address,website,publish_status,marketplace_status,moderation_status,owner_workspace_id,slug)values(l,'organization','Synthetic rollback youth organization',cat,'Athens','Greece','Rollback fixture','https://example.invalid','published','none','clean',ws,'qa-rollback-youth-'||l);
 insert into zoi.org_calendar_events(id,workspace_id,listing_id,kind,title,starts_at,ends_at,timezone,location,status,published_at)values(e,ws,l,'class','Synthetic rollback class',now()-interval '2 hours',now()-interval '1 hour','UTC','Synthetic hall','published',now()-interval '1 day');
 insert into qa_youth_fixture(listing,event)values(l,e);
end $setup$;
grant select,update on qa_youth_fixture to authenticated;grant select on qa_youth_fixture to anon;
select set_config('request.jwt.claim.sub','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd',true);
set local role authenticated;
do $flow$
declare f record;ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';p jsonb;c jsonb;r jsonb;a jsonb;k uuid:=gen_random_uuid();args jsonb;
begin
 select * into strict f from pg_temp.qa_youth_fixture;
 args:=jsonb_build_object('listing_id',f.listing,'title','Synthetic youth class','description','Rollback only','min_age',8,'max_age',12,'capacity',1,'terms','Synthetic guardian consent for rollback test only.','status','published');
 p:=public.youth_program_save(ws,null,0,gen_random_uuid(),args)->'program';
 c:=public.youth_child_save(null,0,k,'SYNTHETIC QA CHILD',false)->'child';
 if public.youth_child_save(null,0,k,'SYNTHETIC QA CHILD',false)->'child' is distinct from c then raise exception 'qa_retry_failed';end if;
 r:=public.youth_enrol((p->>'id')::uuid,(c->>'id')::uuid,0,1,gen_random_uuid(),'{"declared_age":10,"guardian_name":"SYNTHETIC GUARDIAN","authority_confirmed":true,"consent_confirmed":true}')->'registration';
 r:=public.youth_registration_decide(ws,(r->>'id')::uuid,1,gen_random_uuid(),'approved')->'registration';
 if r->>'status'<>'approved' or public.youth_catalog(f.listing)#>>'{programs,0,remaining}'<>'0' then raise exception 'qa_approval_failed';end if;
 perform public.youth_class_link(ws,(p->>'id')::uuid,f.event,true,gen_random_uuid());
 a:=public.youth_attendance_set(ws,(r->>'id')::uuid,f.event,0,gen_random_uuid(),'present')->'attendance';
 if a->>'status'<>'present' or jsonb_array_length(public.youth_family()->'attendance')<>1 then raise exception 'qa_attendance_failed';end if;
 p:=public.youth_program_save(ws,(p->>'id')::uuid,1,gen_random_uuid(),args||'{"terms":"Changed synthetic guardian consent for rollback test only."}')->'program';
 begin perform public.youth_attendance_set(ws,(r->>'id')::uuid,f.event,1,gen_random_uuid(),'excused');raise exception 'qa_stale_consent_allowed';exception when raise_exception then if sqlerrm<>'current_consent_required' then raise;end if;end;
 if public.youth_family()#>>'{registrations,0,consent_current}'<>'false' then raise exception 'qa_consent_state_failed';end if;
 update pg_temp.qa_youth_fixture set program=(p->>'id')::uuid,child=(c->>'id')::uuid,registration=(r->>'id')::uuid;
end $flow$;
set local role anon;
do $public$
declare l uuid;v jsonb;
begin
 select listing into l from pg_temp.qa_youth_fixture;v:=public.youth_catalog(l);
 if v->>'available'<>'true' or v::text like '%SYNTHETIC QA CHILD%' or v::text like '%SYNTHETIC GUARDIAN%' then raise exception 'qa_public_identity_leak';end if;
 begin perform public.youth_family();raise exception 'qa_anonymous_family_allowed';exception when insufficient_privilege then null;end;
 begin perform 1 from zoi.youth_children;raise exception 'qa_private_table_allowed';exception when insufficient_privilege then null;end;
end $public$;
reset role;
do $visibility$
declare l uuid;
begin
 select listing into l from qa_youth_fixture;if zoi.public_home_actions(l)->>'group_url' is distinct from '/groups/?listing='||l then raise exception 'qa_youth_discovery_missing';end if;update zoi.listings set moderation_status='flagged' where id=l;
 if zoi.public_home_actions(l) is not null then raise exception 'qa_flagged_discovery_leak';end if;
 if public.youth_catalog(l)->>'available'<>'false' then raise exception 'qa_flagged_public_leak';end if;
end $visibility$;
set local role authenticated;
do $withdraw$
declare r uuid;v jsonb;
begin
 select registration into r from pg_temp.qa_youth_fixture;v:=public.youth_family();
 if v#>'{registrations,0,program}' is distinct from 'null'::jsonb or jsonb_array_length(v->'children')<>1 then raise exception 'qa_private_history_boundary_failed';end if;
 v:=public.youth_withdraw(r,2,gen_random_uuid());if v#>>'{registration,status}'<>'withdrawn' then raise exception 'qa_withdrawal_failed';end if;
end $withdraw$;
reset role;
select jsonb_build_object('ok',true,'checks',12,'rollback_follows',true) qa_youth_result;
rollback;
select jsonb_build_object('ok',not exists(select 1 from zoi.listings where slug like 'qa-rollback-youth-%') and not exists(select 1 from zoi.youth_children where guardian_id='21a04e78-e3b1-448e-8517-47aad25dd5da'),'persisted_fixture_rows',(select count(*) from zoi.listings where slug like 'qa-rollback-youth-%')+(select count(*) from zoi.youth_children where guardian_id='21a04e78-e3b1-448e-8517-47aad25dd5da')) qa_youth_cleanup;
