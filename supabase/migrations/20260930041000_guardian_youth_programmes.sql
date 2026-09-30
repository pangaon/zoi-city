begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
-- Children never receive accounts or public profiles. All identifying rows are private.
create table zoi.youth_children(id uuid primary key default gen_random_uuid(),guardian_id uuid not null references zoi.user_profiles(id),name text not null check(length(name) between 1 and 80),archived boolean not null default false,version int not null default 1,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp());
create index youth_children_guardian on zoi.youth_children(guardian_id,id);
create table zoi.youth_programs(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references zoi.workspaces(id),listing_id uuid not null references zoi.listings(id),title text not null check(length(title) between 1 and 200),description text not null default '' check(length(description)<=5000),min_age int not null check(min_age between 0 and 17),max_age int not null check(max_age between min_age and 17),capacity int not null check(capacity between 1 and 500),terms text not null check(length(terms) between 20 and 10000),status text not null check(status in('draft','published','paused','archived')),policy_version int not null default 1,version int not null default 1,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp());
create index youth_programs_workspace on zoi.youth_programs(workspace_id,id);
create index youth_programs_listing on zoi.youth_programs(listing_id,status,id);
create table zoi.youth_staff(program_id uuid not null references zoi.youth_programs(id),profile_id uuid not null references zoi.user_profiles(id),enabled boolean not null default true,primary key(program_id,profile_id));
create table zoi.youth_registrations(id uuid primary key default gen_random_uuid(),program_id uuid not null references zoi.youth_programs(id),child_id uuid not null references zoi.youth_children(id),guardian_id uuid not null references zoi.user_profiles(id),child_name text not null,program_title text not null,declared_age int not null check(declared_age between 0 and 17),guardian_name text not null check(length(guardian_name) between 1 and 120),contact_email text not null default '' check(length(contact_email)<=160),contact_phone text not null default '' check(length(contact_phone)<=120),status text not null check(status in('pending','approved','declined','withdrawn','removed')),policy_version int not null,version int not null default 1,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),unique(program_id,child_id));
create index youth_registrations_guardian on zoi.youth_registrations(guardian_id,id);
create index youth_registrations_roster on zoi.youth_registrations(program_id,status,created_at,id);
create table zoi.youth_consents(id uuid primary key default gen_random_uuid(),registration_id uuid not null references zoi.youth_registrations(id),guardian_id uuid not null references zoi.user_profiles(id),action text not null check(action in('accepted','withdrawn')),policy_version int not null,terms text not null,registration_snapshot jsonb not null,created_at timestamptz not null default clock_timestamp());
create index youth_consents_registration on zoi.youth_consents(registration_id,created_at,id);
create table zoi.youth_classes(program_id uuid not null references zoi.youth_programs(id),event_id uuid not null references zoi.org_calendar_events(id),enabled boolean not null default true,primary key(program_id,event_id));
create table zoi.youth_attendance(id uuid primary key default gen_random_uuid(),registration_id uuid not null references zoi.youth_registrations(id),event_id uuid not null references zoi.org_calendar_events(id),status text not null check(status in('present','absent','excused')),version int not null default 1,marked_by uuid not null references zoi.user_profiles(id),updated_at timestamptz not null default clock_timestamp(),unique(registration_id,event_id));
create table zoi.youth_requests(actor_id uuid not null references zoi.user_profiles(id),request_id uuid not null,payload jsonb not null,receipt jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(actor_id,request_id));
create table zoi.youth_audit(id uuid primary key default gen_random_uuid(),program_id uuid references zoi.youth_programs(id),entity_id uuid not null,actor_id uuid not null references zoi.user_profiles(id),action text not null,created_at timestamptz not null default clock_timestamp());
create index youth_audit_program on zoi.youth_audit(program_id,created_at desc,id);
do $$ declare t text;begin foreach t in array array['youth_children','youth_programs','youth_staff','youth_registrations','youth_consents','youth_classes','youth_attendance','youth_requests','youth_audit'] loop execute format('alter table zoi.%I enable row level security',t);execute format('revoke all on zoi.%I from public,anon,authenticated',t);end loop;end $$;

create function zoi.youth_actor_lock() returns uuid language plpgsql security definer set search_path='' as $$ declare a uuid:=zoi.org_actor();begin if a is null then raise exception 'sign_in_required' using errcode='42501';end if;perform 1 from zoi.user_profiles where id=a for update;return a;end $$;
create function zoi.youth_authorized(p_program uuid,p_manage boolean default false) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from zoi.youth_programs p join zoi.listings l on l.id=p.listing_id and l.owner_workspace_id=p.workspace_id where p.id=p_program and (coalesce(zoi.org_role(p.workspace_id),'') in('owner','admin') or (not p_manage and coalesce(zoi.org_role(p.workspace_id),'')='editor' and exists(select 1 from zoi.youth_staff s where s.program_id=p.id and s.profile_id=zoi.org_actor() and s.enabled)))) $$;
create function zoi.youth_retry(p_actor uuid,p_request uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ declare r zoi.youth_requests;begin if p_request is null then raise exception 'request_id_required';end if;select * into r from zoi.youth_requests where actor_id=p_actor and request_id=p_request;if r.request_id is not null then if r.payload is distinct from p_payload then raise exception 'request_payload_conflict';end if;return r.receipt;end if;return null;end $$;
create function zoi.youth_receipt(p_actor uuid,p_request uuid,p_payload jsonb,p_receipt jsonb,p_program uuid,p_entity uuid,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$ begin insert into zoi.youth_requests(actor_id,request_id,payload,receipt) values(p_actor,p_request,p_payload,p_receipt);insert into zoi.youth_audit(program_id,entity_id,actor_id,action) values(p_program,p_entity,p_actor,p_action);return p_receipt;end $$;
revoke all on function zoi.youth_actor_lock(),zoi.youth_authorized(uuid,boolean),zoi.youth_retry(uuid,uuid,jsonb),zoi.youth_receipt(uuid,uuid,jsonb,jsonb,uuid,uuid,text) from public,anon,authenticated;

create function public.youth_child_save(p_id uuid,p_expected_version int,p_request uuid,p_name text,p_archived boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=zoi.youth_actor_lock();c zoi.youth_children;payload jsonb:=jsonb_build_object('action','child_save','id',p_id,'version',p_expected_version,'name',p_name,'archived',p_archived);retry jsonb;
begin
 if p_id is not null then select * into c from zoi.youth_children where id=p_id and guardian_id=a;if c.id is null then raise exception 'child_unavailable' using errcode='42501';end if;end if;
 retry:=zoi.youth_retry(a,p_request,payload);if retry is not null then return retry;end if;
 if p_archived is null or length(btrim(coalesce(p_name,''))) not between 1 and 80 then raise exception 'invalid_child_details';end if;
 if coalesce(c.version,0) is distinct from p_expected_version then raise exception 'version_conflict';end if;
 if p_id is null then if p_archived or (select count(*) from zoi.youth_children where guardian_id=a)>=20 then raise exception 'family_limit';end if;insert into zoi.youth_children(guardian_id,name) values(a,btrim(p_name)) returning * into c;
 else
 if p_archived and exists(select 1 from zoi.youth_registrations where child_id=c.id and status in('pending','approved')) then raise exception 'withdraw_before_archive';end if;
 update zoi.youth_children set name=btrim(p_name),archived=p_archived,version=version+1,updated_at=clock_timestamp() where id=c.id returning * into c;
 end if;
 return zoi.youth_receipt(a,p_request,payload,jsonb_build_object('ok',true,'child',to_jsonb(c)),null,c.id,'child_saved');
end $$;

create function public.youth_program_save(p_workspace uuid,p_id uuid,p_expected_version int,p_request uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=zoi.youth_actor_lock();p zoi.youth_programs;l zoi.listings;payload jsonb:=jsonb_build_object('action','program_save','workspace',p_workspace,'id',p_id,'version',p_expected_version,'data',p_data);retry jsonb;v_listing uuid;
begin
 if coalesce(zoi.org_role(p_workspace),'') not in('owner','admin') then raise exception 'not_authorized' using errcode='42501';end if;
 v_listing:=(p_data->>'listing_id')::uuid;select * into l from zoi.listings where id=v_listing and owner_workspace_id=p_workspace for share;if l.id is null then raise exception 'owned_listing_required';end if;
 if p_id is not null then select * into p from zoi.youth_programs where id=p_id and workspace_id=p_workspace and listing_id=v_listing for update;if p.id is null then raise exception 'program_unavailable';end if;end if;
 retry:=zoi.youth_retry(a,p_request,payload);if retry is not null then return retry;end if;
 if jsonb_typeof(p_data) is distinct from 'object' or length(p_data::text)>20000 or length(btrim(coalesce(p_data->>'title',''))) not between 1 and 200 or length(coalesce(p_data->>'description',''))>5000 or length(btrim(coalesce(p_data->>'terms',''))) not between 20 and 10000 or coalesce(p_data->>'status','') not in('draft','published','paused','archived') or coalesce(p_data->>'min_age','') !~ '^[0-9]{1,2}$' or coalesce(p_data->>'max_age','') !~ '^[0-9]{1,2}$' or coalesce(p_data->>'capacity','') !~ '^[0-9]{1,3}$' then raise exception 'invalid_program_details';end if;
 if (p_data->>'min_age')::int not between 0 and 17 or (p_data->>'max_age')::int not between (p_data->>'min_age')::int and 17 or (p_data->>'capacity')::int not between 1 and 500 then raise exception 'invalid_program_details';end if;
 if p_data->>'status'='published' and (l.publish_status is distinct from 'published' or coalesce(l.moderation_status,'') not in('clean','cleared') or coalesce(l.marketplace_status,'')='hidden') then raise exception 'public_owned_listing_required';end if;
 if coalesce(p.version,0) is distinct from p_expected_version then raise exception 'version_conflict';end if;
 if (select count(*) from zoi.youth_registrations where program_id=p.id and status='approved')>(p_data->>'capacity')::int then raise exception 'capacity_below_approved';end if;
 if p.id is null then
 if (select count(*) from zoi.youth_programs where workspace_id=p_workspace)>=50 then raise exception 'program_limit';end if;
 insert into zoi.youth_programs(workspace_id,listing_id,title,description,min_age,max_age,capacity,terms,status) values(p_workspace,v_listing,btrim(p_data->>'title'),coalesce(p_data->>'description',''),(p_data->>'min_age')::int,(p_data->>'max_age')::int,(p_data->>'capacity')::int,btrim(p_data->>'terms'),p_data->>'status') returning * into p;
 else
 update zoi.youth_programs set title=btrim(p_data->>'title'),description=coalesce(p_data->>'description',''),min_age=(p_data->>'min_age')::int,max_age=(p_data->>'max_age')::int,capacity=(p_data->>'capacity')::int,terms=btrim(p_data->>'terms'),status=p_data->>'status',policy_version=policy_version+case when terms is distinct from btrim(p_data->>'terms') or min_age<>(p_data->>'min_age')::int or max_age<>(p_data->>'max_age')::int then 1 else 0 end,version=version+1,updated_at=clock_timestamp() where id=p.id returning * into p;
 end if;
 return zoi.youth_receipt(a,p_request,payload,jsonb_build_object('ok',true,'program',to_jsonb(p)),p.id,p.id,'program_saved');
end $$;

create function public.youth_enrol(p_program uuid,p_child uuid,p_expected_version int,p_program_version int,p_request uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=zoi.youth_actor_lock();p zoi.youth_programs;c zoi.youth_children;r zoi.youth_registrations;l zoi.listings;payload jsonb:=jsonb_build_object('action','enrol','program',p_program,'child',p_child,'version',p_expected_version,'program_version',p_program_version,'data',p_data);retry jsonb;
begin
 select * into c from zoi.youth_children where id=p_child and guardian_id=a;if c.id is null then raise exception 'child_unavailable' using errcode='42501';end if;
 select * into p from zoi.youth_programs where id=p_program;select * into l from zoi.listings where id=p.listing_id for share;select * into p from zoi.youth_programs where id=p_program for update;
 if p.id is null or p.workspace_id is distinct from l.owner_workspace_id then raise exception 'program_unavailable';end if;
 retry:=zoi.youth_retry(a,p_request,payload);if retry is not null then return retry;end if;
 if c.archived or p.status<>'published' or l.publish_status is distinct from 'published' or coalesce(l.moderation_status,'') not in('clean','cleared') or coalesce(l.marketplace_status,'')='hidden' then raise exception 'program_unavailable';end if;
 if p.version is distinct from p_program_version then raise exception 'program_version_conflict';end if;
 if p_data->'authority_confirmed' is distinct from 'true'::jsonb or p_data->'consent_confirmed' is distinct from 'true'::jsonb then raise exception 'guardian_consent_required';end if;
 if length(p_data::text)>2000 or coalesce(p_data->>'declared_age','') !~ '^[0-9]{1,2}$' or length(btrim(coalesce(p_data->>'guardian_name',''))) not between 1 and 120 or length(coalesce(p_data->>'contact_email',''))>160 or length(coalesce(p_data->>'contact_phone',''))>120 then raise exception 'invalid_enrolment_details';end if;
 if (p_data->>'declared_age')::int not between p.min_age and p.max_age then raise exception 'age_band_mismatch';end if;
 select * into r from zoi.youth_registrations where program_id=p.id and child_id=c.id for update;
 if coalesce(r.version,0) is distinct from p_expected_version then raise exception 'version_conflict';end if;
 if r.status in('declined','removed') then raise exception 'contact_program_organizer';end if;
 if (r.id is null or r.status='withdrawn') and (select count(*) from zoi.youth_registrations where program_id=p.id and status='pending')>=1000 then raise exception 'program_request_limit';end if;
 insert into zoi.youth_registrations(program_id,child_id,guardian_id,child_name,program_title,declared_age,guardian_name,contact_email,contact_phone,status,policy_version) values(p.id,c.id,a,c.name,p.title,(p_data->>'declared_age')::int,btrim(p_data->>'guardian_name'),coalesce(p_data->>'contact_email',''),coalesce(p_data->>'contact_phone',''),'pending',p.policy_version) on conflict(program_id,child_id) do update set child_name=excluded.child_name,program_title=excluded.program_title,declared_age=excluded.declared_age,guardian_name=excluded.guardian_name,contact_email=excluded.contact_email,contact_phone=excluded.contact_phone,status=case when zoi.youth_registrations.status='approved' then 'approved' else 'pending' end,policy_version=excluded.policy_version,version=zoi.youth_registrations.version+1,updated_at=clock_timestamp() returning * into r;
 insert into zoi.youth_consents(registration_id,guardian_id,action,policy_version,terms,registration_snapshot) values(r.id,a,'accepted',p.policy_version,p.terms,to_jsonb(r));
 return zoi.youth_receipt(a,p_request,payload,jsonb_build_object('ok',true,'registration',to_jsonb(r)),p.id,r.id,'guardian_consent_accepted');
end $$;

create function public.youth_registration_decide(p_workspace uuid,p_registration uuid,p_expected_version int,p_request uuid,p_status text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=zoi.youth_actor_lock();p zoi.youth_programs;r zoi.youth_registrations;payload jsonb:=jsonb_build_object('action','decide','workspace',p_workspace,'registration',p_registration,'version',p_expected_version,'status',p_status);retry jsonb;
begin
 select * into r from zoi.youth_registrations where id=p_registration;select * into p from zoi.youth_programs where id=r.program_id and workspace_id=p_workspace;
 if p.id is null or not zoi.youth_authorized(p.id,true) then raise exception 'not_authorized' using errcode='42501';end if;
 perform 1 from zoi.listings where id=p.listing_id and owner_workspace_id=p_workspace for share;if not found then raise exception 'owned_listing_required';end if;
 select * into p from zoi.youth_programs where id=p.id for update;select * into r from zoi.youth_registrations where id=p_registration for update;
 retry:=zoi.youth_retry(a,p_request,payload);if retry is not null then return retry;end if;
 if r.version is distinct from p_expected_version then raise exception 'version_conflict';end if;
 if p_status='approved' then
 if not exists(select 1 from zoi.listings where id=p.listing_id and owner_workspace_id=p.workspace_id and publish_status='published' and moderation_status in('clean','cleared') and coalesce(marketplace_status,'')<>'hidden') then raise exception 'public_owned_listing_required';end if;
 if r.status<>'pending' or r.policy_version<>p.policy_version or p.status<>'published' then raise exception 'current_consent_required';end if;
 if (select count(*) from zoi.youth_registrations where program_id=p.id and status='approved')>=p.capacity then raise exception 'program_full';end if;
 elsif p_status='declined' then if r.status<>'pending' then raise exception 'invalid_registration_transition';end if;
 elsif p_status='removed' then if r.status<>'approved' then raise exception 'invalid_registration_transition';end if;
 else raise exception 'invalid_registration_transition';end if;
 update zoi.youth_registrations set status=p_status,version=version+1,updated_at=clock_timestamp() where id=r.id returning * into r;
 return zoi.youth_receipt(a,p_request,payload,jsonb_build_object('ok',true,'registration',to_jsonb(r)),p.id,r.id,'registration_'||p_status);
end $$;

create function public.youth_withdraw(p_registration uuid,p_expected_version int,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=zoi.youth_actor_lock();r zoi.youth_registrations;p zoi.youth_programs;payload jsonb:=jsonb_build_object('action','withdraw','registration',p_registration,'version',p_expected_version);retry jsonb;
begin
 select * into r from zoi.youth_registrations where id=p_registration and guardian_id=a;if r.id is null then raise exception 'registration_unavailable' using errcode='42501';end if;
 select * into p from zoi.youth_programs where id=r.program_id for update;select * into r from zoi.youth_registrations where id=p_registration for update;
 retry:=zoi.youth_retry(a,p_request,payload);if retry is not null then return retry;end if;
 if r.version is distinct from p_expected_version then raise exception 'version_conflict';end if;
 if r.status not in('pending','approved') then raise exception 'invalid_registration_transition';end if;
 update zoi.youth_registrations set status='withdrawn',version=version+1,updated_at=clock_timestamp() where id=r.id returning * into r;
 insert into zoi.youth_consents(registration_id,guardian_id,action,policy_version,terms,registration_snapshot) select r.id,a,'withdrawn',r.policy_version,coalesce((select terms from zoi.youth_consents where registration_id=r.id and action='accepted' order by created_at desc,id desc limit 1),''),to_jsonb(r);
 return zoi.youth_receipt(a,p_request,payload,jsonb_build_object('ok',true,'registration',to_jsonb(r)),p.id,r.id,'guardian_withdrawn');
end $$;

create function public.youth_staff_set(p_workspace uuid,p_program uuid,p_profile uuid,p_enabled boolean,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=zoi.youth_actor_lock();p zoi.youth_programs;payload jsonb:=jsonb_build_object('action','staff','workspace',p_workspace,'program',p_program,'profile',p_profile,'enabled',p_enabled);retry jsonb;
begin
 select * into p from zoi.youth_programs where id=p_program and workspace_id=p_workspace;if p.id is null or not zoi.youth_authorized(p.id,true) then raise exception 'not_authorized' using errcode='42501';end if;
 perform 1 from zoi.listings where id=p.listing_id and owner_workspace_id=p_workspace for share;if not found then raise exception 'owned_listing_required';end if;
 retry:=zoi.youth_retry(a,p_request,payload);if retry is not null then return retry;end if;
 if p_enabled is null or (p_enabled and not exists(select 1 from zoi.workspace_members where workspace_id=p_workspace and profile_id=p_profile and role in('owner','admin','editor'))) then raise exception 'current_instructor_required';end if;
 insert into zoi.youth_staff(program_id,profile_id,enabled) values(p.id,p_profile,p_enabled) on conflict(program_id,profile_id) do update set enabled=excluded.enabled;
 return zoi.youth_receipt(a,p_request,payload,jsonb_build_object('ok',true,'program_id',p.id,'profile_id',p_profile,'enabled',p_enabled),p.id,p_profile,'instructor_assignment_changed');
end $$;

create function public.youth_class_link(p_workspace uuid,p_program uuid,p_event uuid,p_enabled boolean,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=zoi.youth_actor_lock();p zoi.youth_programs;payload jsonb:=jsonb_build_object('action','class','workspace',p_workspace,'program',p_program,'event',p_event,'enabled',p_enabled);retry jsonb;
begin
 select * into p from zoi.youth_programs where id=p_program and workspace_id=p_workspace;if p.id is null or not zoi.youth_authorized(p.id,true) then raise exception 'not_authorized' using errcode='42501';end if;
 perform 1 from zoi.listings where id=p.listing_id and owner_workspace_id=p_workspace for share;if not found then raise exception 'owned_listing_required';end if;
 retry:=zoi.youth_retry(a,p_request,payload);if retry is not null then return retry;end if;
 if p_enabled is null or not exists(select 1 from zoi.org_calendar_events where id=p_event and workspace_id=p_workspace and listing_id=p.listing_id and kind in('class','rehearsal')) then raise exception 'actual_class_required';end if;
 if not p_enabled and exists(select 1 from zoi.youth_attendance a join zoi.youth_registrations r on r.id=a.registration_id where r.program_id=p.id and a.event_id=p_event) then raise exception 'attendance_history_requires_class';end if;
 insert into zoi.youth_classes(program_id,event_id,enabled) values(p.id,p_event,p_enabled) on conflict(program_id,event_id) do update set enabled=excluded.enabled;
 return zoi.youth_receipt(a,p_request,payload,jsonb_build_object('ok',true,'program_id',p.id,'event_id',p_event,'enabled',p_enabled),p.id,p_event,'class_link_changed');
end $$;

create function public.youth_attendance_set(p_workspace uuid,p_registration uuid,p_event uuid,p_expected_version int,p_request uuid,p_status text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=zoi.youth_actor_lock();p zoi.youth_programs;r zoi.youth_registrations;a zoi.youth_attendance;payload jsonb:=jsonb_build_object('action','attendance','workspace',p_workspace,'registration',p_registration,'event',p_event,'version',p_expected_version,'status',p_status);retry jsonb;
begin
 select * into r from zoi.youth_registrations where id=p_registration;select * into p from zoi.youth_programs where id=r.program_id and workspace_id=p_workspace;
 if p.id is null or not zoi.youth_authorized(p.id,false) then raise exception 'not_authorized' using errcode='42501';end if;
 perform 1 from zoi.listings where id=p.listing_id and owner_workspace_id=p_workspace for share;if not found then raise exception 'owned_listing_required';end if;
 select * into p from zoi.youth_programs where id=p.id for update;select * into r from zoi.youth_registrations where id=p_registration for update;
 retry:=zoi.youth_retry(actor,p_request,payload);if retry is not null then return retry;end if;
 if r.status<>'approved' or r.policy_version<>p.policy_version then raise exception 'current_consent_required';end if;
 if not exists(select 1 from zoi.youth_classes c join zoi.org_calendar_events e on e.id=c.event_id where c.program_id=p.id and c.event_id=p_event and c.enabled and e.status='published' and e.starts_at<=clock_timestamp() and e.kind in('class','rehearsal') and e.workspace_id=p_workspace and e.listing_id=p.listing_id) then raise exception 'started_class_required';end if;
 if p_status is null or p_status not in('present','absent','excused') then raise exception 'invalid_attendance';end if;
 select * into a from zoi.youth_attendance where registration_id=r.id and event_id=p_event for update;if coalesce(a.version,0) is distinct from p_expected_version then raise exception 'version_conflict';end if;
 insert into zoi.youth_attendance(registration_id,event_id,status,marked_by) values(r.id,p_event,p_status,actor) on conflict(registration_id,event_id) do update set status=excluded.status,marked_by=excluded.marked_by,version=zoi.youth_attendance.version+1,updated_at=clock_timestamp() returning * into a;
 return zoi.youth_receipt(actor,p_request,payload,jsonb_build_object('ok',true,'attendance',to_jsonb(a)),p.id,a.id,'attendance_'||p_status);
end $$;

create function public.youth_catalog(p_listing uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare programs jsonb;events jsonb;l zoi.listings;
begin
 select * into l from zoi.listings where id=p_listing and publish_status='published' and moderation_status in('clean','cleared') and coalesce(marketplace_status,'')<>'hidden';
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'listing_id',p.listing_id,'title',p.title,'description',p.description,'min_age',p.min_age,'max_age',p.max_age,'capacity',p.capacity,'remaining',greatest(0,p.capacity-(select count(*) from zoi.youth_registrations r where r.program_id=p.id and r.status='approved')),'terms',p.terms,'policy_version',p.policy_version,'version',p.version) order by p.title,p.id),'[]') into programs from zoi.youth_programs p where p.listing_id=l.id and p.workspace_id=l.owner_workspace_id and p.status='published';
 select coalesce(jsonb_agg(x order by x->>'starts_at',x->>'id'),'[]') into events from(select jsonb_build_object('id',e.id,'program_id',p.id,'title',e.title,'starts_at',e.starts_at,'ends_at',e.ends_at,'timezone',e.timezone,'location',e.location,'status',e.status) x from zoi.youth_programs p join zoi.youth_classes c on c.program_id=p.id and c.enabled join zoi.org_calendar_events e on e.id=c.event_id where p.listing_id=l.id and p.workspace_id=l.owner_workspace_id and p.status='published' and e.workspace_id=p.workspace_id and e.listing_id=p.listing_id and e.status='published' and e.ends_at>now() and e.starts_at<now()+interval '365 days' order by e.starts_at,e.id limit 500) q;
 return jsonb_build_object('ok',true,'listing_id',p_listing,'name',l.name,'available',jsonb_array_length(programs)>0,'programs',programs,'events',events);
end $$;

create function public.youth_family() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=zoi.org_actor();children jsonb;registrations jsonb;classes jsonb;attendance jsonb;consents jsonb;
begin
 if actor is null then raise exception 'sign_in_required' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at,c.id),'[]') into children from zoi.youth_children c where c.guardian_id=actor;
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('consent_current',r.policy_version=p.policy_version,'program',case when p.status='published' and l.owner_workspace_id=p.workspace_id and l.publish_status='published' and l.moderation_status in('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden' then jsonb_build_object('id',p.id,'listing_id',p.listing_id,'title',p.title,'terms',p.terms,'version',p.version,'policy_version',p.policy_version,'min_age',p.min_age,'max_age',p.max_age) else null end) order by r.created_at desc,r.id),'[]') into registrations from zoi.youth_registrations r join zoi.youth_programs p on p.id=r.program_id join zoi.listings l on l.id=p.listing_id where r.guardian_id=actor;
 select coalesce(jsonb_agg(x order by x->>'starts_at',x->>'id'),'[]') into classes from(select distinct jsonb_build_object('id',e.id,'program_id',p.id,'title',e.title,'starts_at',e.starts_at,'ends_at',e.ends_at,'timezone',e.timezone,'location',e.location,'status',e.status) x from zoi.youth_registrations r join zoi.youth_programs p on p.id=r.program_id join zoi.listings l on l.id=p.listing_id and l.owner_workspace_id=p.workspace_id join zoi.youth_classes c on c.program_id=p.id and c.enabled join zoi.org_calendar_events e on e.id=c.event_id where r.guardian_id=actor and r.status in('pending','approved') and l.publish_status='published' and l.moderation_status in('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden' and e.workspace_id=p.workspace_id and e.listing_id=p.listing_id and(e.status='published' or(e.status='cancelled' and e.published_at is not null)) and e.ends_at>now()-interval '90 days' and e.starts_at<now()+interval '365 days' limit 500)q;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.updated_at desc,a.id),'[]') into attendance from(select a.* from zoi.youth_attendance a join zoi.youth_registrations r on r.id=a.registration_id where r.guardian_id=actor order by a.updated_at desc,a.id limit 1000)a;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc,c.id),'[]') into consents from(select * from zoi.youth_consents where guardian_id=actor order by created_at desc,id limit 200)c;
 return jsonb_build_object('ok',true,'guardian_id',actor,'children',children,'registrations',registrations,'classes',classes,'attendance',attendance,'consents',consents);
end $$;

create function public.youth_operator(p_workspace uuid,p_program uuid default null,p_offset int default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=zoi.org_actor();role text:=zoi.org_role(p_workspace);manager boolean:=coalesce(role,'') in('owner','admin');programs jsonb;listings jsonb;staff jsonb;assigned jsonb;registrations jsonb:='[]';events jsonb:='[]';classes jsonb:='[]';attendance jsonb:='[]';audit jsonb:='[]';selected zoi.youth_programs;
begin
 if actor is null or coalesce(role,'') not in('owner','admin','editor') then raise exception 'not_authorized' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'invalid_page';end if;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.title,p.id),'[]') into programs from zoi.youth_programs p where p.workspace_id=p_workspace and zoi.youth_authorized(p.id,false);
 if manager then
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'publish_status',publish_status) order by name,id),'[]') into listings from(select id,name,publish_status from zoi.listings where owner_workspace_id=p_workspace order by name,id limit 500) l;
 select coalesce(jsonb_agg(jsonb_build_object('profile_id',m.profile_id,'display_name',p.display_name,'role',m.role) order by p.display_name,m.profile_id),'[]') into staff from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id=p_workspace and m.role in('owner','admin','editor');
 else listings:='[]';staff:='[]';end if;
 if p_program is not null then
 select * into selected from zoi.youth_programs where id=p_program and workspace_id=p_workspace;if selected.id is null or not zoi.youth_authorized(selected.id,false) then raise exception 'not_authorized' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(s)),'[]') into assigned from zoi.youth_staff s where s.program_id=p_program;
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('consent_current',r.policy_version=selected.policy_version) order by r.created_at,r.id),'[]') into registrations from(select * from zoi.youth_registrations where program_id=p_program order by created_at,id limit 101 offset p_offset)r;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'starts_at',e.starts_at,'ends_at',e.ends_at,'timezone',e.timezone,'status',e.status,'kind',e.kind,'location',e.location) order by e.starts_at,e.id),'[]') into events from(select * from zoi.org_calendar_events where workspace_id=p_workspace and listing_id=selected.listing_id and kind in('class','rehearsal') and ends_at>now()-interval '90 days' and starts_at<now()+interval '365 days' order by starts_at,id limit 500)e;
 select coalesce(jsonb_agg(to_jsonb(c)),'[]') into classes from zoi.youth_classes c where c.program_id=p_program;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.updated_at desc,a.id),'[]') into attendance from(select a.* from zoi.youth_attendance a join zoi.youth_registrations r on r.id=a.registration_id where r.program_id=p_program order by a.updated_at desc,a.id limit 1000)a;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc,a.id),'[]') into audit from(select * from zoi.youth_audit where program_id=p_program order by created_at desc,id limit 100)a;
 end if;
 return jsonb_build_object('ok',true,'workspace_id',p_workspace,'role',role,'can_manage',manager,'programs',programs,'listings',listings,'staff_candidates',staff,'selected',case when selected.id is null then null else to_jsonb(selected) end,'instructors',coalesce(assigned,'[]'),'registrations',registrations,'events',events,'classes',classes,'attendance',attendance,'audit',audit,'offset',p_offset);
end $$;

revoke all on function public.youth_child_save(uuid,int,uuid,text,boolean),public.youth_program_save(uuid,uuid,int,uuid,jsonb),public.youth_enrol(uuid,uuid,int,int,uuid,jsonb),public.youth_registration_decide(uuid,uuid,int,uuid,text),public.youth_withdraw(uuid,int,uuid),public.youth_staff_set(uuid,uuid,uuid,boolean,uuid),public.youth_class_link(uuid,uuid,uuid,boolean,uuid),public.youth_attendance_set(uuid,uuid,uuid,int,uuid,text),public.youth_catalog(uuid),public.youth_family(),public.youth_operator(uuid,uuid,int) from public,anon,authenticated;
grant execute on function public.youth_catalog(uuid) to anon,authenticated;
grant execute on function public.youth_child_save(uuid,int,uuid,text,boolean),public.youth_program_save(uuid,uuid,int,uuid,jsonb),public.youth_enrol(uuid,uuid,int,int,uuid,jsonb),public.youth_registration_decide(uuid,uuid,int,uuid,text),public.youth_withdraw(uuid,int,uuid),public.youth_staff_set(uuid,uuid,uuid,boolean,uuid),public.youth_class_link(uuid,uuid,uuid,boolean,uuid),public.youth_attendance_set(uuid,uuid,uuid,int,uuid,text),public.youth_family(),public.youth_operator(uuid,uuid,int) to authenticated;
CREATE OR REPLACE FUNCTION zoi.public_home_actions(p_listing uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_strip_nulls(jsonb_build_object(
 'booking_url',CASE WHEN EXISTS(SELECT 1 FROM zoi.booking_settings b WHERE b.listing_id=l.id AND b.workspace_id=l.owner_workspace_id AND b.enabled) THEN '/book/?listing='||l.id::text END,
 'offer_url',CASE WHEN EXISTS(SELECT 1 FROM zoi.festival_packages f WHERE f.event_id=l.id AND f.workspace_id=l.owner_workspace_id AND f.active AND f.closes_at>now()) THEN '/festival/?event='||l.id::text END,
 'calendar_url',CASE WHEN EXISTS(SELECT 1 FROM zoi.org_calendar_events c WHERE c.listing_id=l.id AND c.workspace_id=l.owner_workspace_id AND c.status='published' AND c.ends_at>now()) THEN '/organization-calendar/?listing='||l.id::text END,
 'group_url',CASE WHEN EXISTS(SELECT 1 FROM zoi.group_settings g WHERE g.listing_id=l.id AND g.workspace_id=l.owner_workspace_id AND g.enabled) OR EXISTS(SELECT 1 FROM zoi.youth_programs y WHERE y.listing_id=l.id AND y.workspace_id=l.owner_workspace_id AND y.status='published') THEN '/groups/?listing='||l.id::text END,
 'inquiry_url',CASE WHEN EXISTS(SELECT 1 FROM zoi.inquiry_settings s WHERE s.listing_id=l.id AND s.workspace_id=l.owner_workspace_id AND s.enabled) THEN '/inquiries/?listing='||l.id::text END,
 'volunteer_url',CASE WHEN EXISTS(SELECT 1 FROM zoi.org_programs p JOIN zoi.org_shifts s ON s.program_id=p.id AND s.workspace_id=p.workspace_id WHERE p.workspace_id=l.owner_workspace_id AND p.status='published' AND s.status='scheduled' AND s.starts_at>now()) THEN '/volunteer/?workspace='||l.owner_workspace_id::text END))
 FROM zoi.listings l WHERE l.id=p_listing AND l.publish_status='published' AND l.moderation_status IN('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden';
$$;
REVOKE ALL ON FUNCTION zoi.public_home_actions(uuid) FROM PUBLIC,anon,authenticated;

notify pgrst,'reload schema';
commit;
