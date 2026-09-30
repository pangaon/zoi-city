-- Transaction-only fixtures: no public listing, calendar, membership or attendance is committed.
begin;
set local statement_timeout='25s';
set local lock_timeout='3s';
create temporary table qa_org_fixture(workspace_id uuid,listing_id uuid,event_id uuid,shift_id uuid,membership_id uuid) on commit drop;
do $setup$
declare ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor constant uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';listing uuid:=gen_random_uuid();cat bigint;
begin
 perform 1 from zoi.workspaces where id=ws for update;
 if not found or not exists(select 1 from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id=ws and m.profile_id=actor and m.role='owner' and p.auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd') then raise exception 'qa_workspace_identity_mismatch';end if;
 if exists(select 1 from zoi.listings where owner_workspace_id=ws and slug like 'qa-rollback-org-%') then raise exception 'qa_existing_fixture_do_not_modify';end if;
 select id into cat from zoi.categories order by id limit 1;if cat is null then raise exception 'qa_category_missing';end if;
 perform set_config('request.jwt.claim.sub','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd',true);
 insert into zoi.listings(id,entity_type,name,primary_category_id,city,country,address,website,publish_status,marketplace_status,owner_workspace_id,slug)
 values(listing,'organization','Rollback dance organization QA',cat,'Athens','Greece','Rollback fixture','https://example.invalid','published','none',ws,'qa-rollback-org-'||listing::text);
 if not exists(select 1 from zoi.listings where id=listing and publish_status='published' and marketplace_status<>'hidden') then raise exception 'qa_fixture_not_published';end if;
 insert into qa_org_fixture(workspace_id,listing_id) values(ws,listing);
end $setup$;
grant select,update on qa_org_fixture to authenticated;
grant select on qa_org_fixture to anon;
set local role anon;
do $anon$
declare f record;r jsonb;
begin
 select * into f from qa_org_fixture;
 r:=public.group_member_state(f.listing_id);if r->>'available'<>'false' or r->'membership'<>'null'::jsonb then raise exception 'qa_unconfigured_group_public_leak';end if;
 begin perform public.group_roster(f.workspace_id,f.listing_id);raise exception 'qa_anon_roster_unexpected_access';exception when insufficient_privilege then null;end;
end $anon$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
do $missing_auth$
declare f record;
begin select * into f from qa_org_fixture;begin perform public.org_calendar_meta(f.workspace_id,now(),now()+interval '30 days');raise exception 'qa_missing_auth_unexpected_access';exception when insufficient_privilege then null;end;end $missing_auth$;
select set_config('request.jwt.claim.sub','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd',true);
do $journey$
declare f record;p jsonb;data jsonb;preview jsonb;expected jsonb;receipt jsonb;retry jsonb;m jsonb;e jsonb;request uuid:=gen_random_uuid();day date:=current_date+14;r jsonb;
begin
 select * into f from qa_org_fixture;
 p:=public.org_program_save(f.workspace_id,'Rollback welcoming team','Transaction-only program','published')->'program';
 data:=jsonb_build_object('listing_id',f.listing_id,'kind','rehearsal','title','Rollback rehearsal','description','Confirmed practice','location','Hall','timezone','Europe/Athens','status','published','program_id',p->>'id','program_version',(p->>'version')::integer,'volunteer_title','Welcome team','capacity',2,'pattern',jsonb_build_object('dateFrom',day,'dateTo',day,'weekdays',jsonb_build_array(extract(dow from day)::integer),'opens','10:00','closes','11:00'));
 preview:=public.org_calendar_preview(f.workspace_id,data);
 select jsonb_agg(jsonb_build_object('starts_at',x->>'starts_at','ends_at',x->>'ends_at')) into expected from jsonb_array_elements(preview->'occurrences')x;
 receipt:=public.org_calendar_batch_save(f.workspace_id,request,data,expected);retry:=public.org_calendar_batch_save(f.workspace_id,request,data,expected);
 if receipt is distinct from retry or jsonb_array_length(receipt->'events')<>1 then raise exception 'qa_calendar_retry_failed';end if;
 e:=receipt->'events'->0;if e->>'status'<>'published' or e->>'version'<>'2' or e->>'shift_id' is null then raise exception 'qa_calendar_publish_failed';end if;
 update qa_org_fixture set event_id=(e->>'id')::uuid,shift_id=(e->>'shift_id')::uuid;
 perform public.org_signup((e->>'shift_id')::uuid);
 r:=public.org_calendar_public(f.listing_id,now(),now()+interval '30 days');if r->'events'->0->>'volunteer_shift_id'<>e->>'shift_id' then raise exception 'qa_volunteer_link_missing';end if;
 perform public.group_settings_save(f.workspace_id,f.listing_id,0,true,'Rollback adult dance group','Adults only; transaction QA');
 begin perform public.group_membership_request(f.listing_id,0,false);raise exception 'qa_adult_confirmation_bypassed';exception when others then if sqlerrm<>'adult_confirmation_required' then raise;end if;end;
 m:=public.group_membership_request(f.listing_id,0,true)->'membership';
 if public.group_membership_request(f.listing_id,0,true)->'membership' is distinct from m then raise exception 'qa_membership_retry_failed';end if;
 update qa_org_fixture set membership_id=(m->>'id')::uuid;
 m:=public.group_member_decide(f.workspace_id,(m->>'id')::uuid,1,'approved')->'membership';if m->>'version'<>'2' then raise exception 'qa_approval_failed';end if;
 r:=public.group_roster(f.workspace_id,f.listing_id,'approved',0);if jsonb_array_length(r->'members')<>1 then raise exception 'qa_roster_failed';end if;
 begin perform public.group_attendance_set(f.workspace_id,(e->>'id')::uuid,(m->>'id')::uuid,0,'present');raise exception 'qa_future_attendance_unexpected_success';exception when others then if sqlerrm<>'attendance_event_not_started' then raise;end if;end;
end $journey$;
reset role;
do $home$
declare f record;r jsonb;
begin select * into f from qa_org_fixture;r:=zoi.public_home_actions(f.listing_id);if r->>'calendar_url' is distinct from '/organization-calendar/?listing='||f.listing_id::text or r->>'group_url' is distinct from '/groups/?listing='||f.listing_id::text then raise exception 'qa_home_actions_missing';end if;end $home$;
-- Only this uncommitted calendar event is moved into the past to verify attendance.
update zoi.org_calendar_events set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id=(select event_id from qa_org_fixture);
update zoi.workspace_members set role='viewer' where workspace_id='053a5656-b19b-48a4-8721-65c4674f647c' and profile_id='21a04e78-e3b1-448e-8517-47aad25dd5da';
set local role authenticated;
do $viewer$
declare f record;
begin select * into f from qa_org_fixture;begin perform public.group_roster(f.workspace_id,f.listing_id);raise exception 'qa_viewer_roster_unexpected_access';exception when insufficient_privilege then null;end;begin perform public.org_calendar_event_set(f.workspace_id,f.event_id,2,'cancelled');raise exception 'qa_viewer_mutation_unexpected_access';exception when insufficient_privilege then null;end;end $viewer$;
reset role;
update zoi.workspace_members set role='owner' where workspace_id='053a5656-b19b-48a4-8721-65c4674f647c' and profile_id='21a04e78-e3b1-448e-8517-47aad25dd5da';
set local role authenticated;
do $finish$
declare f record;r jsonb;retry jsonb;
begin
 select * into f from qa_org_fixture;
 r:=public.group_attendance_set(f.workspace_id,f.event_id,f.membership_id,0,'present');retry:=public.group_attendance_set(f.workspace_id,f.event_id,f.membership_id,0,'present');if r is distinct from retry then raise exception 'qa_attendance_retry_failed';end if;
 r:=public.group_attendance_list(f.workspace_id,f.event_id);if r->'members'->0->'attendance'->>'status'<>'present' then raise exception 'qa_attendance_read_failed';end if;
 r:=public.org_calendar_event_set(f.workspace_id,f.event_id,2,'cancelled');if r->'event'->>'version'<>'3' then raise exception 'qa_calendar_cancel_failed';end if;
 r:=public.group_membership_withdraw(f.membership_id,2);if r->'membership'->>'status'<>'withdrawn' then raise exception 'qa_membership_withdraw_failed';end if;
 if jsonb_array_length(public.group_activity(f.workspace_id,f.listing_id)->'changes')<4 then raise exception 'qa_group_audit_failed';end if;
end $finish$;
reset role;
do $integrity$
declare f record;
begin select * into f from qa_org_fixture;if not exists(select 1 from zoi.org_shifts where id=f.shift_id and status='cancelled') or exists(select 1 from zoi.org_registrations where shift_id=f.shift_id and status='active') then raise exception 'qa_linked_cancellation_not_atomic';end if;end $integrity$;
rollback;
select true as organization_calendar_groups_rollback_passed,
 (select count(*) from zoi.listings where owner_workspace_id='053a5656-b19b-48a4-8721-65c4674f647c' and slug like 'qa-rollback-org-%') as persisted_test_listings;
