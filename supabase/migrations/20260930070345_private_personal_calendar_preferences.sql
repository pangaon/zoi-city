begin;
set local lock_timeout='5s';
-- Optional, private, self-selected preferences. This creates no messaging or reminder jobs.
create table zoi.personal_calendar_preferences(
 actor_id uuid primary key references zoi.user_profiles(id),preferences jsonb not null,
 version integer not null check(version>0),updated_at timestamptz not null default now()
);
create table zoi.personal_calendar_requests(
 actor_id uuid not null references zoi.user_profiles(id),request_id uuid not null,
 expected_version integer not null,preferences jsonb not null,receipt jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,request_id)
);
create index personal_calendar_request_rate on zoi.personal_calendar_requests(actor_id,created_at);
alter table zoi.personal_calendar_preferences enable row level security;
alter table zoi.personal_calendar_requests enable row level security;
revoke all on zoi.personal_calendar_preferences,zoi.personal_calendar_requests from public,anon,authenticated;
create function zoi.personal_calendar_church(p_id uuid)returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',l.id,'name',l.name,'slug',l.slug,'entity_type',l.entity_type,
 'city',to_jsonb(l)->>'city','country',to_jsonb(l)->>'country','address',coalesce(to_jsonb(l)->>'address',l.profile->>'address'),
 'jurisdiction',l.profile->>'jurisdiction','photo',coalesce(l.profile->>'photo_url',l.profile#>>'{_enrich,photo_url}'))
 from zoi.listings l where l.id=p_id and l.entity_type='church' and l.publish_status='published'
 and l.moderation_status in('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden'
$$;
revoke all on function zoi.personal_calendar_church(uuid) from public,anon,authenticated;
create function public.personal_calendar_get()returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid;r zoi.personal_calendar_preferences;defaults jsonb:='{"enabled":false,"calendar":"new","timezone":"Europe/Athens","feasts":[],"church_id":null}';
begin
 if auth.uid() is null then raise exception 'sign_in_required';end if;
 select id into actor from zoi.user_profiles where auth_user_id=auth.uid();if actor is null then raise exception 'profile_required';end if;
 select * into r from zoi.personal_calendar_preferences where actor_id=actor;
 return jsonb_build_object('ok',true,'profile_id',actor,'version',coalesce(r.version,0),'preferences',coalesce(r.preferences,defaults),'church',zoi.personal_calendar_church((r.preferences->>'church_id')::uuid));
end$$;
create function public.personal_calendar_save(p_request uuid,p_expected_version integer,p_preferences jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;prior zoi.personal_calendar_preferences;request zoi.personal_calendar_requests;receipt jsonb;church uuid;key text;normal jsonb;
begin
 if auth.uid() is null then raise exception 'sign_in_required';end if;
 select id into actor from zoi.user_profiles where auth_user_id=auth.uid();if actor is null then raise exception 'profile_required';end if;
 if p_request is null or p_expected_version is null or p_expected_version<0 or jsonb_typeof(p_preferences) is distinct from 'object' or octet_length(p_preferences::text)>6000 then raise exception 'invalid_calendar_preferences';end if;
 perform pg_advisory_xact_lock(hashtextextended('personal_calendar:'||actor::text,0));
 select * into request from zoi.personal_calendar_requests where actor_id=actor and request_id=p_request;
 if found then
 if request.expected_version is distinct from p_expected_version or request.preferences is distinct from p_preferences then raise exception 'calendar_request_conflict';end if;
 return request.receipt;end if;
 if exists(select 1 from jsonb_object_keys(p_preferences)k where k not in('enabled','calendar','timezone','feasts','church_id')) or
 jsonb_typeof(p_preferences->'enabled') is distinct from 'boolean' or coalesce(p_preferences->>'calendar','') not in('new','old') or
 jsonb_typeof(p_preferences->'feasts') is distinct from 'array' or jsonb_array_length(p_preferences->'feasts')>30 or
 not exists(select 1 from pg_timezone_names where name=p_preferences->>'timezone') or
 not(p_preferences?'church_id') then raise exception 'invalid_calendar_preferences';end if;
 if exists(select 1 from jsonb_array_elements(p_preferences->'feasts')x where jsonb_typeof(x) is distinct from 'string') then raise exception 'invalid_calendar_feast';end if;
 for key in select jsonb_array_elements_text(p_preferences->'feasts')loop
 if key not in('pascha','st_george','annunciation','nativity','theophany','dormition','st_demetrios','st_nicholas','st_basil','presentation_hypapante','exaltation_of_the_cross','pentecost','ascension') then raise exception 'invalid_calendar_feast';end if;end loop;
 begin church:=nullif(p_preferences->>'church_id','')::uuid;exception when invalid_text_representation then raise exception 'invalid_calendar_church';end;
 if church is not null and zoi.personal_calendar_church(church) is null then raise exception 'calendar_church_unavailable';end if;
 if(select count(*) from zoi.personal_calendar_requests where actor_id=actor and created_at>clock_timestamp()-interval '1 hour')>=30 then raise exception 'calendar_rate_limit';end if;
 select * into prior from zoi.personal_calendar_preferences where actor_id=actor for update;
 if coalesce(prior.version,0)<>p_expected_version then raise exception 'calendar_version_conflict';end if;
 normal:=p_preferences||jsonb_build_object('church_id',church,'feasts',(select coalesce(jsonb_agg(x order by x),'[]')from(select distinct jsonb_array_elements_text(p_preferences->'feasts')x)s));
 insert into zoi.personal_calendar_preferences(actor_id,preferences,version)values(actor,normal,1)
 on conflict(actor_id)do update set preferences=excluded.preferences,version=zoi.personal_calendar_preferences.version+1,updated_at=clock_timestamp();
 receipt:=public.personal_calendar_get()||jsonb_build_object('request',p_request);
 insert into zoi.personal_calendar_requests(actor_id,request_id,expected_version,preferences,receipt)values(actor,p_request,p_expected_version,p_preferences,receipt);
 return receipt;
end$$;
revoke all on function public.personal_calendar_get(),public.personal_calendar_save(uuid,integer,jsonb)from public,anon;
grant execute on function public.personal_calendar_get(),public.personal_calendar_save(uuid,integer,jsonb)to authenticated;
commit;
