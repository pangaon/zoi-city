begin;
set local statement_timeout='10s';
set local lock_timeout='2s';
do $$declare artist uuid;actor_auth uuid;v jsonb;request uuid:=gen_random_uuid();begin
 select id into artist from zoi.listings where entity_type='artist' and publish_status='published' and moderation_status in('clean','cleared') and coalesce(marketplace_status,'')<>'hidden' order by id limit 1;
 select auth_user_id into actor_auth from zoi.user_profiles where auth_user_id='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd' limit 1;
 if artist is null or actor_auth is null then raise exception 'demand_fixture_prerequisites_missing';end if;
 perform set_config('request.jwt.claim.sub',actor_auth::text,true);
 v:=public.artist_demand_set(artist,'QA rollback '||request::text,'QA rollback country',true,request,0);
 if v->>'version'<>'1' or v->>'active'<>'true' then raise exception 'demand_fixture_create_failed';end if;
 if public.artist_demand_set(artist,'QA rollback '||request::text,'QA rollback country',true,request,0)<>v then raise exception 'demand_fixture_retry_failed';end if;
 v:=public.artist_demand_set(artist,'QA rollback '||request::text,'QA rollback country',false,gen_random_uuid(),1);
 if v->>'version'<>'2' or v->>'active'<>'false' then raise exception 'demand_fixture_withdraw_failed';end if;
 if exists(select 1 from jsonb_array_elements(public.artist_demand_summary(artist)->'cities')c where c->>'city'='QA rollback '||request::text)then raise exception 'demand_fixture_privacy_failed';end if;
end $$;
select jsonb_build_object('ok',true,'checks',4,'persisted_rows',0,'external_messages',0)as artist_demand_rollback_verified;
rollback;
