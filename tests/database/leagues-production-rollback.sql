-- Bounded single-QA-account rollback: verifies configured fixture journey and self-confirm denial.
-- Independent second-account confirmation is covered locally; live acceptance requires a second isolated QA principal.
begin;
set local statement_timeout='15s';set local lock_timeout='3s';set local timezone='UTC';
do $qa$
declare ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor uuid:='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';host uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();home uuid:=gen_random_uuid();away uuid:=gen_random_uuid();fid uuid:=gen_random_uuid();cat bigint;s jsonb;r jsonb;data jsonb;denied boolean:=false;
begin
 perform set_config('request.jwt.claim.sub',actor::text,true);if coalesce(zoi.ops_role(ws),'') not in('owner','admin') then raise exception 'qa_owned_workspace_required';end if;select id into cat from zoi.categories limit 1;
 insert into zoi.listings(id,entity_type,name,primary_category_id,city,country,address,website,publish_status,marketplace_status,owner_workspace_id,slug) values(host,'sports','Transactional adult football QA',cat,'Athens','Greece','Verification venue','https://example.org','published','none',ws,'rollback-football-qa-'||host);
 data:=jsonb_build_object('host_id',host,'host_kind','club','name','Rollback adult competition','timezone','Europe/Athens','starts_on','2001-01-01','ends_on','2001-12-31','published',false);
 s:=public.football_season_save(ws,sid,0,data)->'season';r:=public.football_public(host,sid);if r->'season'<>'null'::jsonb then raise exception 'qa_private_draft_exposed';end if;
 perform public.football_season_save(ws,sid,1,jsonb_set(data,'{published}','true'));
 perform public.football_team_submit(ws,sid,home,jsonb_build_object('club_id',host,'name','Synthetic adults A','contact_notes','Private synthetic note','adult_confirmed',true),false);
 perform public.football_team_submit(ws,sid,away,jsonb_build_object('club_id',host,'name','Synthetic adults B','contact_notes','Private synthetic note','adult_confirmed',true),false);
 perform public.football_team_decide(ws,home,1,'approve');perform public.football_team_decide(ws,away,1,'approve');
 data:=jsonb_build_object('home_id',home,'away_id',away,'starts_at','2001-06-01T15:00:00Z','ends_at','2001-06-01T17:00:00Z','timezone','Europe/Athens','venue','Synthetic venue','published',true);
 perform public.football_fixture_save(ws,sid,fid,0,data);perform public.football_score_submit(ws,fid,1,2,1);
 begin perform public.football_score_decide(ws,fid,2,'confirm','');exception when others then if sqlerrm='football_independent_confirmation_required' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'qa_self_confirmation_allowed';end if;
 r:=public.football_public(host,sid);if r->'fixtures'->0->'home_score'<>'null'::jsonb or r::text like '%Private synthetic note%' then raise exception 'qa_unconfirmed_or_private_data_exposed';end if;
 perform public.football_fixture_save(ws,sid,fid,2,data||jsonb_build_object('cancelled',true,'reason','Synthetic QA cancellation'));r:=public.football_operator(ws,sid);if jsonb_array_length(r->'audit')<8 then raise exception 'qa_competition_audit_missing';end if;
end $qa$;
rollback;
select true as rollback_football_single_account_flow_passed,(select count(*) from zoi.listings where slug like 'rollback-football-qa-%') as persisted_test_listings;
