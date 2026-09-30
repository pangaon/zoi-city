begin;
set local lock_timeout='5s';
set local statement_timeout='25s';
select set_config('request.jwt.claim.sub','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd',true);
do $$declare v_actor uuid;v_version integer;v_handle text:='qa_'||replace(gen_random_uuid()::text,'-','');v_post uuid:=gen_random_uuid();v_reply jsonb;v_result jsonb;v_request uuid:=gen_random_uuid();begin
 select id into v_actor from zoi.user_profiles where auth_user_id=auth.uid();if v_actor is null then raise exception 'isolated_qa_profile_required';end if;v_handle:=left(v_handle,30);
 select coalesce(max(version),0) into v_version from zoi.community_profiles where profile_id=v_actor;
 v_result:=public.community_profile_save(v_version,jsonb_build_object('handle',v_handle,'display_name','Private rollback QA','bio','','interests',jsonb_build_array('language'),'avatar_media_id',null));if v_result#>>'{profile,handle}'<>v_handle then raise exception 'profile_receipt_failed';end if;
 insert into zoi.feed_posts(id,profile_id,body,status,media) values(v_post,v_actor,'Rollback-only community verification','visible','[]');perform zoi.community_context_set(v_actor,v_post,'{"intent":"question","topics":["language"]}');
 v_result:=public.community_like_set(v_post,true);if (v_result->>'likes')::int<>1 then raise exception 'like_count_failed';end if;perform public.community_like_set(v_post,true);
 v_reply:=public.community_comment(v_post,v_request,'Rollback-only reply');v_result:=public.community_comment(v_post,v_request,'Rollback-only reply');if v_reply#>>'{comment,id}' is distinct from v_result#>>'{comment,id}' then raise exception 'comment_idempotency_failed';end if;
 perform public.community_saved_set(v_post,true);v_result:=public.community_post_get(v_post);if (v_result#>>'{post,saved}')::boolean is distinct from true or (v_result#>>'{post,comments}')::int<>1 or (v_result#>>'{post,likes}')::int<>1 then raise exception 'post_projection_failed';end if;
 v_result:=public.feed_get(v_post);if v_result->>'author'<>'Private rollback QA' then raise exception 'legacy_projection_failed';end if;
 perform public.community_report(v_post,'other','Rollback-only report',gen_random_uuid());
 update zoi.feed_posts set status='hidden' where id=v_post;if public.community_post_get(v_post)->'post' is distinct from 'null'::jsonb or public.feed_get(v_post) is distinct from 'null'::jsonb then raise exception 'hidden_read_failed';end if;
end $$;
select jsonb_build_object('community_rollback_checks',8,'persisted_rows',0,'external_messages',0,'paid_calls',0) as result;
rollback;
