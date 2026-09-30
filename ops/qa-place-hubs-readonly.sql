begin;
set local statement_timeout='8s';
do $$declare result jsonb;expected bigint;begin
 if not has_function_privilege('anon','public.explore_place_listings(text,text,text,text,integer,integer)','EXECUTE') then raise exception 'missing_public_grant';end if;
 select count(*) into expected from zoi.listings l join zoi.categories c on c.id=l.primary_category_id where l.publish_status='published' and l.moderation_status in('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden' and c.slug='orthodox-churches';
 result:=public.explore_place_listings(null,null,null,'orthodox-churches',60,0);
 if (result->>'total')::bigint<>expected or expected=0 or jsonb_array_length(result->'rows')<>least(expected,60) then raise exception 'public_collection_mismatch';end if;
 if exists(select 1 from jsonb_array_elements(result->'rows')r join zoi.listings l on l.id=(r->>'id')::uuid where l.publish_status<>'published' or l.moderation_status not in('clean','cleared') or l.marketplace_status='hidden') then raise exception 'nonpublic_record_exposed';end if;
 if (public.explore_place_listings(null,null,null,'zoi-qa-missing-category',60,0)->>'total')::int<>0 then raise exception 'false_category';end if;
 if not exists(select 1 from public.explore_countries()) then raise exception 'countries_empty';end if;
end $$;
select jsonb_build_object('ok',true,'persisted_fixture_rows',0,'checks',5) as place_hubs_verified;
rollback;
