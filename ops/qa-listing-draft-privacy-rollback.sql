-- Exercises the deployed trigger AND deployed quality scorer; persists no listings.
begin;
set local statement_timeout='15s';set local lock_timeout='3s';
do $verify$
declare ws constant uuid:='053a5656-b19b-48a4-8721-65c4674f647c';cat bigint;requested text;passes boolean;r zoi.listings;identity uuid;expected text;
begin
 if not exists(select 1 from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id=ws and m.role='owner' and p.id='21a04e78-e3b1-448e-8517-47aad25dd5da' and p.auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd') then raise exception 'qa_workspace_identity_mismatch';end if;
 select id into cat from zoi.categories order by id limit 1;if cat is null then raise exception 'qa_category_missing';end if;
 foreach requested in array array['draft','published',null]::text[] loop
  foreach passes in array array[true,false] loop
   identity:=gen_random_uuid();
   insert into zoi.listings(id,entity_type,name,primary_category_id,city,country,address,website,publish_status,marketplace_status,owner_workspace_id,slug,profile)
   values(identity,'business',case when passes then 'QA private draft verification' else 'test' end,cat,'Athens','Greece','Private rollback fixture','https://example.invalid',requested,'hidden',ws,'qa-rollback-draft-privacy-'||identity::text,'{"qa_retained":true}') returning * into r;
   expected:=case when requested='draft' then 'draft' when passes then 'published' else 'pending_review' end;
   if r.publish_status is distinct from expected or r.marketplace_status is distinct from 'hidden' or (r.profile->'gate'->>'ok')::boolean is distinct from passes or (r.profile->>'qa_retained')::boolean is distinct from true or r.profile->'gate'->>'checked_at' is null or r.completeness_score is null or r.completeness_score<0 or r.completeness_score>1 then raise exception 'qa_publication_intent_or_metadata_failed';end if;
  end loop;
 end loop;
end $verify$;
rollback;
select true as rollback_draft_privacy_passed,(select count(*) from zoi.listings where owner_workspace_id='053a5656-b19b-48a4-8721-65c4674f647c' and slug like 'qa-rollback-draft-privacy-%') as persisted_test_listings;
