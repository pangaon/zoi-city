begin;
set local statement_timeout='20s';set local lock_timeout='3s';
create temporary table qa_home_media_fixture(listing uuid) on commit drop;
do $$declare l uuid:=gen_random_uuid();ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';cat bigint;begin
 perform 1 from zoi.workspaces where id=ws for update;
 if not found or not exists(select 1 from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id=ws and m.role='owner' and p.id='21a04e78-e3b1-448e-8517-47aad25dd5da' and p.auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd') then raise exception 'qa_identity_mismatch';end if;
 if exists(select 1 from zoi.listings where slug like 'qa-rollback-home-media-%') then raise exception 'qa_existing_fixture';end if;
 select id into cat from zoi.categories order by id limit 1;
 insert into zoi.listings(id,name,entity_type,owner_workspace_id,primary_category_id,slug,publish_status,marketplace_status,moderation_status,profile)values(l,'Synthetic media QA','organization',ws,cat,'qa-rollback-home-media-'||l,'draft','hidden','clean','{"description":"Preserve this field"}');
 insert into qa_home_media_fixture values(l);
end $$;
grant select on qa_home_media_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd',true);
do $$declare l uuid;ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';req uuid:=gen_random_uuid();items jsonb:=jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'kind','video','url','https://www.youtube.com/watch?v=dQw4w9WgXcQ','label','Synthetic fixture only'));r jsonb;begin
 select listing into strict l from pg_temp.qa_home_media_fixture;
 if public.home_media_get(ws,l)#>>'{media,version}'<>'0' then raise exception 'qa_initial_media';end if;
 r:=public.home_media_save(ws,l,0,req,items);
 if r#>>'{media,version}'<>'1' or r#>'{media,items}' is distinct from items then raise exception 'qa_save_receipt';end if;
 if public.home_media_save(ws,l,0,req,items) is distinct from r then raise exception 'qa_retry_receipt';end if;
 begin perform public.home_media_save(ws,l,0,gen_random_uuid(),'[]');raise exception 'qa_stale_save_allowed';exception when raise_exception then if sqlerrm<>'version_conflict' then raise;end if;end;
 r:=public.home_media_save(ws,l,1,gen_random_uuid(),'[]');if r#>'{media,items}' is distinct from '[]'::jsonb then raise exception 'qa_clear_receipt';end if;
 begin perform 1 from zoi.home_media_requests;raise exception 'qa_ledger_readable';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin if not exists(select 1 from zoi.listings where id=(select listing from qa_home_media_fixture) and profile->>'description'='Preserve this field' and publish_status='draft' and marketplace_status='hidden') then raise exception 'qa_preservation_failed';end if;end$$;
select jsonb_build_object('ok',true,'checks',7,'rollback_follows',true) qa_home_media_result;
rollback;
select jsonb_build_object('ok',not exists(select 1 from zoi.listings where slug like 'qa-rollback-home-media-%'),'persisted_fixture_rows',(select count(*) from zoi.listings where slug like 'qa-rollback-home-media-%')) qa_home_media_cleanup;
