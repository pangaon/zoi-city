begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table zoi.saved_guest_groups(
 id uuid primary key,profile_id uuid not null references zoi.user_profiles(id) on delete cascade,
 data jsonb not null,version integer not null default 1 check(version>0),archived boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index saved_guest_groups_actor on zoi.saved_guest_groups(profile_id,archived,updated_at desc,id);
create table zoi.saved_guest_group_requests(
 profile_id uuid not null references zoi.user_profiles(id) on delete cascade,request_id uuid not null,
 payload jsonb not null,receipt jsonb not null,created_at timestamptz not null default now(),primary key(profile_id,request_id));
alter table zoi.saved_guest_groups enable row level security;
alter table zoi.saved_guest_group_requests enable row level security;
revoke all on zoi.saved_guest_groups,zoi.saved_guest_group_requests from public,anon,authenticated;
create policy own_saved_guest_groups on zoi.saved_guest_groups for select using(exists(select 1 from zoi.user_profiles p where p.id=profile_id and p.auth_user_id=auth.uid()));
create policy own_saved_guest_group_requests on zoi.saved_guest_group_requests for select using(exists(select 1 from zoi.user_profiles p where p.id=profile_id and p.auth_user_id=auth.uid()));
create function zoi.guest_group_actor() returns uuid language plpgsql stable security definer set search_path='' as $$declare actor uuid;begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;
 select id into actor from zoi.user_profiles where auth_user_id=auth.uid();if actor is null then raise exception 'profile_unavailable' using errcode='42501';end if;return actor;end$$;
revoke all on function zoi.guest_group_actor() from public,anon,authenticated;
create function zoi.guest_group_projection(g zoi.saved_guest_groups) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('id',g.id,'version',g.version,'data',g.data,'archived',g.archived,'updated_at',g.updated_at)$$;
revoke all on function zoi.guest_group_projection(zoi.saved_guest_groups) from public,anon,authenticated;
create function public.saved_guest_group_list() returns jsonb language plpgsql stable security definer set search_path='' as $$declare actor uuid:=zoi.guest_group_actor();begin
 return jsonb_build_object('ok',true,'groups',coalesce((select jsonb_agg(zoi.guest_group_projection(g) order by g.updated_at desc,g.id) from zoi.saved_guest_groups g where profile_id=actor and not archived),'[]'::jsonb));end$$;
create function public.saved_guest_group_get(p_group uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare actor uuid:=zoi.guest_group_actor();g zoi.saved_guest_groups;begin
 select * into g from zoi.saved_guest_groups where id=p_group and profile_id=actor;if g.id is null then raise exception 'group_unavailable' using errcode='42501';end if;
 return jsonb_build_object('ok',true,'group',zoi.guest_group_projection(g));end$$;
create function public.saved_guest_group_receipt(p_request uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare actor uuid:=zoi.guest_group_actor();r jsonb;begin
 select receipt into r from zoi.saved_guest_group_requests where profile_id=actor and request_id=p_request;
 return jsonb_build_object('ok',true,'found',r is not null,'receipt',r);end$$;
create function public.saved_guest_group_save(p_group uuid,p_expected_version integer,p_request uuid,p_data jsonb,p_archived boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=zoi.guest_group_actor();g zoi.saved_guest_groups;prior zoi.saved_guest_group_requests;payload jsonb;receipt jsonb;m jsonb;seen uuid[]:='{}';mid uuid;
begin
 if p_group is null or p_request is null or p_expected_version is null or p_expected_version<0 or p_archived is null then raise exception 'invalid_group_request';end if;
 perform 1 from zoi.user_profiles where id=actor for update;
 payload:=jsonb_build_object('group',p_group,'version',p_expected_version,'data',p_data,'archived',p_archived);
 select * into prior from zoi.saved_guest_group_requests where profile_id=actor and request_id=p_request;
 if prior.request_id is not null then if prior.payload is distinct from payload then raise exception 'request_conflict';end if;return prior.receipt;end if;
 if jsonb_typeof(p_data) is distinct from 'object' or length(p_data::text)>12000 or p_data-ARRAY['label','members','arrangement']<>'{}'::jsonb or jsonb_typeof(p_data->'label') is distinct from 'string' or length(btrim(p_data->>'label')) not between 1 and 80 or p_data->>'label'<>btrim(p_data->>'label') or p_data->>'arrangement' not in('together','nearby') or p_data->>'arrangement' is null or jsonb_typeof(p_data->'members') is distinct from 'array' then raise exception 'invalid_group_data';end if;
 if jsonb_array_length(p_data->'members') not between 1 and 30 then raise exception 'invalid_group_members';end if;
 for m in select value from jsonb_array_elements(p_data->'members') loop
  if jsonb_typeof(m) is distinct from 'object' or m-ARRAY['id','first_name','ticket_quantity']<>'{}'::jsonb or jsonb_typeof(m->'first_name') is distinct from 'string' or length(btrim(m->>'first_name')) not between 1 and 60 or m->>'first_name'<>btrim(m->>'first_name') or coalesce(m->>'id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'invalid_group_member';end if;
  if m ? 'ticket_quantity' then if jsonb_typeof(m->'ticket_quantity') is distinct from 'number' then raise exception 'invalid_ticket_quantity';end if;if (m->>'ticket_quantity')::numeric not between 1 and 100 or (m->>'ticket_quantity')::numeric<>trunc((m->>'ticket_quantity')::numeric) then raise exception 'invalid_ticket_quantity';end if;end if;
  mid:=(m->>'id')::uuid;if mid=any(seen) then raise exception 'duplicate_group_member';end if;seen:=array_append(seen,mid);
 end loop;
 if(select count(*) from zoi.saved_guest_group_requests where profile_id=actor and created_at>clock_timestamp()-interval '1 day')>=100 then raise exception 'group_rate_limited';end if;
 select * into g from zoi.saved_guest_groups where id=p_group and profile_id=actor for update;
 if g.id is null then
  if p_expected_version<>0 or p_archived then raise exception 'group_unavailable' using errcode='42501';end if;
  if exists(select 1 from zoi.saved_guest_groups where id=p_group) then raise exception 'group_unavailable' using errcode='42501';end if;
  if(select count(*) from zoi.saved_guest_groups where profile_id=actor)>=100 then raise exception 'group_limit';end if;
 else
  if g.version is distinct from p_expected_version then raise exception 'version_conflict';end if;
 end if;
 if not p_archived and (g.id is null or g.archived) and(select count(*) from zoi.saved_guest_groups where profile_id=actor and not archived)>=20 then raise exception 'group_limit';end if;
 if g.id is null then insert into zoi.saved_guest_groups(id,profile_id,data) values(p_group,actor,p_data) returning * into g;
 else update zoi.saved_guest_groups set data=p_data,archived=p_archived,version=version+1,updated_at=clock_timestamp() where id=p_group returning * into g;end if;
 receipt:=jsonb_build_object('ok',true,'request_id',p_request,'group',zoi.guest_group_projection(g));
 insert into zoi.saved_guest_group_requests(profile_id,request_id,payload,receipt) values(actor,p_request,payload,receipt);return receipt;
end$$;
revoke all on function public.saved_guest_group_list(),public.saved_guest_group_get(uuid),public.saved_guest_group_receipt(uuid),public.saved_guest_group_save(uuid,integer,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.saved_guest_group_list(),public.saved_guest_group_get(uuid),public.saved_guest_group_receipt(uuid),public.saved_guest_group_save(uuid,integer,uuid,jsonb,boolean) to authenticated;
commit;
