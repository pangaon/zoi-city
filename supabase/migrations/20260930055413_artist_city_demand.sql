begin;
set local lock_timeout='5s';
-- Self-declared interest only. No booking, residency verification, notification or artist commitment.
create table zoi.artist_city_demand (
 artist_id uuid not null references zoi.listings(id), actor_id uuid not null references zoi.user_profiles(id),
 city_key text not null,country_key text not null,city text not null,country text not null,
 active boolean not null,version integer not null check(version>0),updated_at timestamptz not null default now(),
 primary key(artist_id,actor_id,city_key,country_key)
);
create table zoi.artist_city_demand_audit (
 actor_id uuid not null references zoi.user_profiles(id),request_id uuid not null,
 artist_id uuid not null references zoi.listings(id),city_key text not null,country_key text not null,
 requested_active boolean not null,expected_version integer not null,before_state jsonb,receipt jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,request_id)
);
create index artist_city_demand_active on zoi.artist_city_demand(artist_id,country_key,city_key) where active;
create index artist_city_demand_actor on zoi.artist_city_demand(actor_id,updated_at desc);
create index artist_city_demand_audit_rate on zoi.artist_city_demand_audit(actor_id,created_at);
alter table zoi.artist_city_demand enable row level security;
alter table zoi.artist_city_demand_audit enable row level security;
revoke all on zoi.artist_city_demand,zoi.artist_city_demand_audit from public,anon,authenticated;
create function zoi.artist_demand_locality(p_text text) returns text language sql immutable set search_path='' as $$
 select btrim(regexp_replace(normalize(coalesce(p_text,''),NFKC),'[[:space:]]+',' ','g'))
$$;
create function public.artist_demand_summary(p_artist uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare cities jsonb;
begin
 if not exists(select 1 from zoi.listings where id=p_artist and entity_type='artist' and publish_status='published' and moderation_status in('clean','cleared') and coalesce(marketplace_status,'')<>'hidden') then
 return jsonb_build_object('ok',true,'artist',p_artist,'available',false,'cities','[]'::jsonb,'privacy_threshold',5,'building_interest',false);end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.count desc,t.country,t.city),'[]'::jsonb) into cities from(
 select min(city)city,min(country)country,count(*)::integer count from zoi.artist_city_demand where artist_id=p_artist and active group by city_key,country_key having count(*)>=5 order by count(*)desc,country_key,city_key limit 100)t;
 return jsonb_build_object('ok',true,'artist',p_artist,'available',true,'cities',cities,'privacy_threshold',5,'building_interest',jsonb_array_length(cities)=0);
end $$;
create function public.artist_demand_mine(p_artist uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid;rows jsonb;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;
 select id into actor from zoi.user_profiles where auth_user_id=auth.uid();
 select coalesce(jsonb_agg(jsonb_build_object('city',city,'country',country,'active',active,'version',version) order by updated_at desc),'[]'::jsonb) into rows from zoi.artist_city_demand where actor_id=actor and artist_id=p_artist;
 return jsonb_build_object('ok',true,'artist',p_artist,'requests',rows);
end $$;
create function public.artist_demand_set(p_artist uuid,p_city text,p_country text,p_active boolean,p_request uuid,p_expected_version integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;c text;k text;ck text;kk text;r zoi.artist_city_demand;a zoi.artist_city_demand_audit;outcome jsonb;available boolean;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;
 if p_request is null or p_active is null or p_expected_version is null or p_expected_version<0 or octet_length(coalesce(p_city,''))>500 or octet_length(coalesce(p_country,''))>500 then raise exception 'invalid_demand';end if;
 c:=zoi.artist_demand_locality(p_city);k:=zoi.artist_demand_locality(p_country);ck:=lower(c);kk:=lower(k);
 if length(c) not between 2 and 100 or length(k) not between 2 and 100 or c~'[[:cntrl:]<>/\\@]' or k~'[[:cntrl:]<>/\\@]' or c!~'[[:alpha:]]' or k!~'[[:alpha:]]' then raise exception 'invalid_locality';end if;
 perform pg_advisory_xact_lock(hashtextextended('artist_demand:'||auth.uid()::text,0));
 actor:=zoi.ensure_profile();if actor is null then raise exception 'profile_required';end if;
 perform 1 from zoi.user_profiles where id=actor for update;
 select * into a from zoi.artist_city_demand_audit where actor_id=actor and request_id=p_request;
 if a.request_id is not null then
 if a.artist_id is distinct from p_artist or a.city_key<>ck or a.country_key<>kk or a.requested_active is distinct from p_active or a.expected_version<>p_expected_version then raise exception 'demand_request_conflict';end if;
 return a.receipt;end if;
 select (entity_type='artist' and publish_status='published' and moderation_status in('clean','cleared') and coalesce(marketplace_status,'')<>'hidden') into available from zoi.listings where id=p_artist for share;
 select * into r from zoi.artist_city_demand where artist_id=p_artist and actor_id=actor and city_key=ck and country_key=kk for update;
 -- A private withdrawal remains possible after the artist becomes hidden.
 if available is distinct from true and (p_active or r.artist_id is null) then raise exception 'artist_unavailable';end if;
 if coalesce(r.version,0) is distinct from p_expected_version then raise exception 'demand_version_conflict';end if;
 if (select count(*)from zoi.artist_city_demand_audit where actor_id=actor and created_at>clock_timestamp()-interval '1 hour')>=20 or (select count(*)from zoi.artist_city_demand_audit where actor_id=actor and created_at>clock_timestamp()-interval '1 day')>=100 then raise exception 'demand_rate_limit';end if;
 if p_active and coalesce(r.active,false)=false and(select count(*)from zoi.artist_city_demand where actor_id=actor and active)>=20 then raise exception 'demand_active_limit';end if;
 if r.artist_id is null and not p_active then raise exception 'demand_not_found';end if;
 insert into zoi.artist_city_demand(artist_id,actor_id,city_key,country_key,city,country,active,version)values(p_artist,actor,ck,kk,c,k,p_active,1)
 on conflict(artist_id,actor_id,city_key,country_key)do update set active=excluded.active,version=zoi.artist_city_demand.version+1,updated_at=clock_timestamp();
 outcome:=jsonb_build_object('ok',true,'artist',p_artist,'request',p_request,'city',coalesce(r.city,c),'country',coalesce(r.country,k),'active',p_active,'version',p_expected_version+1);
 insert into zoi.artist_city_demand_audit(actor_id,request_id,artist_id,city_key,country_key,requested_active,expected_version,before_state,receipt)values(actor,p_request,p_artist,ck,kk,p_active,p_expected_version,case when r.artist_id is null then null else jsonb_build_object('active',r.active,'version',r.version)end,outcome);
 return outcome;
end $$;
revoke all on function zoi.artist_demand_locality(text)from public,anon,authenticated;
revoke all on function public.artist_demand_summary(uuid),public.artist_demand_mine(uuid),public.artist_demand_set(uuid,text,text,boolean,uuid,integer)from public,anon,authenticated;
grant execute on function public.artist_demand_summary(uuid)to anon,authenticated;
grant execute on function public.artist_demand_mine(uuid),public.artist_demand_set(uuid,text,text,boolean,uuid,integer)to authenticated;
commit;
