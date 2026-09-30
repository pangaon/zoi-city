begin;
set local lock_timeout='5s';
-- Adult, account-based group enrollment. No birth dates, child records or contact export.
create table zoi.group_settings(listing_id uuid primary key references zoi.listings(id),workspace_id uuid not null references zoi.workspaces(id),enabled boolean not null default false,title text not null check(length(title) between 1 and 200),description text not null default '' check(length(description)<=5000),version integer not null default 1,updated_at timestamptz not null default clock_timestamp());
create table zoi.group_memberships(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references zoi.workspaces(id),listing_id uuid not null references zoi.listings(id),profile_id uuid not null references zoi.user_profiles(id),status text not null check(status in('pending','approved','declined','withdrawn','removed')),adult_confirmed_at timestamptz not null,version integer not null default 1,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),unique(listing_id,profile_id));
create index group_memberships_roster on zoi.group_memberships(workspace_id,listing_id,status,created_at,id);
create index group_memberships_profile on zoi.group_memberships(profile_id,listing_id);
create table zoi.group_attendance(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references zoi.workspaces(id),event_id uuid not null references zoi.org_calendar_events(id),membership_id uuid not null references zoi.group_memberships(id),status text not null check(status in('present','absent','excused')),version integer not null default 1,marked_by uuid not null references zoi.user_profiles(id),updated_at timestamptz not null default clock_timestamp(),unique(event_id,membership_id));
alter table zoi.group_settings enable row level security;
alter table zoi.group_memberships enable row level security;
alter table zoi.group_attendance enable row level security;
revoke all on zoi.group_settings,zoi.group_memberships,zoi.group_attendance from public,anon,authenticated;

create function public.group_settings_save(p_workspace uuid,p_listing uuid,p_expected_version integer,p_enabled boolean,p_title text,p_description text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r zoi.group_settings;actor uuid:=zoi.org_actor();l zoi.listings;
begin
 if actor is null or coalesce(zoi.org_role(p_workspace),'') not in('owner','admin','editor') then raise exception 'not_authorized' using errcode='42501';end if;
 if p_enabled is null or length(btrim(coalesce(p_title,''))) not between 1 and 200 or length(coalesce(p_description,''))>5000 then raise exception 'invalid_group_details';end if;
 select * into l from zoi.listings where id=p_listing and owner_workspace_id=p_workspace for share;
 if l.id is null then raise exception 'owned_listing_required';end if;
 if p_enabled and (l.publish_status is distinct from 'published' or coalesce(l.marketplace_status,'')='hidden') then raise exception 'public_owned_listing_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('group:'||p_listing::text,0));
 select * into r from zoi.group_settings where listing_id=p_listing for update;
 if r.listing_id is not null and r.workspace_id<>p_workspace then raise exception 'previous_owner_records_require_review';end if;
 if r.version=p_expected_version+1 and r.enabled=p_enabled and r.title=btrim(p_title) and r.description=coalesce(p_description,'') then return jsonb_build_object('ok',true,'settings',to_jsonb(r));end if;
 if coalesce(r.version,0) is distinct from p_expected_version then raise exception 'version_conflict';end if;
 insert into zoi.group_settings(listing_id,workspace_id,enabled,title,description) values(p_listing,p_workspace,p_enabled,btrim(p_title),coalesce(p_description,'')) on conflict(listing_id) do update set enabled=excluded.enabled,title=excluded.title,description=excluded.description,version=zoi.group_settings.version+1,updated_at=clock_timestamp() returning * into r;
 insert into zoi.org_audit(workspace_id,entity_id,action,actor_profile_id) values(p_workspace,p_listing,'group_settings_saved',actor);
 return jsonb_build_object('ok',true,'settings',to_jsonb(r));
end $$;

create function public.group_member_state(p_listing uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg zoi.group_settings;l zoi.listings;m zoi.group_memberships;actor uuid:=zoi.org_actor();
begin
 select * into l from zoi.listings where id=p_listing and publish_status='published' and coalesce(marketplace_status,'')<>'hidden';
 select * into cfg from zoi.group_settings where listing_id=p_listing and workspace_id=l.owner_workspace_id and enabled;
 select * into m from zoi.group_memberships where listing_id=p_listing and profile_id=actor;
 return jsonb_build_object('ok',true,'listing_id',p_listing,'available',cfg.listing_id is not null,'settings',case when cfg.listing_id is not null then jsonb_build_object('title',cfg.title,'description',cfg.description,'version',cfg.version) else null end,'membership',case when m.id is not null then jsonb_build_object('id',m.id,'listing_id',m.listing_id,'status',m.status,'version',m.version,'updated_at',m.updated_at) else null end);
end $$;

create function public.group_membership_request(p_listing uuid,p_expected_version integer,p_adult_confirmed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=zoi.org_actor();cfg zoi.group_settings;l zoi.listings;m zoi.group_memberships;
begin
 if actor is null then raise exception 'sign_in_required' using errcode='42501';end if;
 if p_adult_confirmed is distinct from true then raise exception 'adult_confirmation_required';end if;
 select * into l from zoi.listings where id=p_listing for share;
 perform pg_advisory_xact_lock(hashtextextended('group:'||p_listing::text,0));
 select * into cfg from zoi.group_settings where listing_id=p_listing and workspace_id=l.owner_workspace_id;
 select * into m from zoi.group_memberships where listing_id=p_listing and profile_id=actor for update;
 if m.status='pending' and m.version=p_expected_version+1 then return jsonb_build_object('ok',true,'membership',to_jsonb(m));end if;
 if cfg.listing_id is null or not cfg.enabled or l.publish_status is distinct from 'published' or coalesce(l.marketplace_status,'')='hidden' then raise exception 'group_unavailable';end if;
 if m.id is not null and m.workspace_id<>cfg.workspace_id then raise exception 'previous_owner_records_require_review';end if;
 if coalesce(m.version,0) is distinct from p_expected_version then raise exception 'version_conflict';end if;
 if m.id is not null and m.status<>'withdrawn' then raise exception 'membership_already_reviewed';end if;
 insert into zoi.group_memberships(workspace_id,listing_id,profile_id,status,adult_confirmed_at) values(cfg.workspace_id,p_listing,actor,'pending',clock_timestamp()) on conflict(listing_id,profile_id) do update set status='pending',adult_confirmed_at=clock_timestamp(),version=zoi.group_memberships.version+1,updated_at=clock_timestamp() returning * into m;
 insert into zoi.org_audit(workspace_id,entity_id,action,actor_profile_id) values(m.workspace_id,m.id,'group_membership_requested',actor);
 return jsonb_build_object('ok',true,'membership',to_jsonb(m));
end $$;

create function public.group_membership_withdraw(p_membership uuid,p_expected_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=zoi.org_actor();m zoi.group_memberships;
begin
 if actor is null then raise exception 'sign_in_required' using errcode='42501';end if;
 select * into m from zoi.group_memberships where id=p_membership and profile_id=actor for update;
 if m.id is null then raise exception 'membership_unavailable';end if;
 if m.status='withdrawn' and m.version=p_expected_version+1 then return jsonb_build_object('ok',true,'membership',to_jsonb(m));end if;
 if m.version is distinct from p_expected_version then raise exception 'version_conflict';end if;
 if m.status not in('pending','approved') then raise exception 'membership_cannot_withdraw';end if;
 update zoi.group_memberships set status='withdrawn',version=version+1,updated_at=clock_timestamp() where id=m.id returning * into m;
 insert into zoi.org_audit(workspace_id,entity_id,action,actor_profile_id) values(m.workspace_id,m.id,'group_membership_withdrawn',actor);
 return jsonb_build_object('ok',true,'membership',to_jsonb(m));
end $$;

create function public.group_roster(p_workspace uuid,p_listing uuid,p_status text default null,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb;cfg zoi.group_settings;
begin
 if coalesce(zoi.org_role(p_workspace),'') not in('owner','admin','editor') then raise exception 'not_authorized' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_offset>100000 or (p_status is not null and p_status not in('pending','approved','declined','withdrawn','removed')) then raise exception 'invalid_roster_filter';end if;
 if not exists(select 1 from zoi.listings where id=p_listing and owner_workspace_id=p_workspace) then raise exception 'owned_listing_required';end if;
 select * into cfg from zoi.group_settings where listing_id=p_listing and workspace_id=p_workspace;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'listing_id',m.listing_id,'workspace_id',m.workspace_id,'display_name',coalesce(p.display_name,'Member'),'status',m.status,'version',m.version,'adult_confirmed_at',m.adult_confirmed_at,'created_at',m.created_at) order by m.created_at,m.id),'[]') into rows from(select * from zoi.group_memberships where workspace_id=p_workspace and listing_id=p_listing and(p_status is null or status=p_status) order by created_at,id limit 101 offset p_offset)m join zoi.user_profiles p on p.id=m.profile_id;
 return jsonb_build_object('ok',true,'listing_id',p_listing,'workspace_id',p_workspace,'settings',case when cfg.listing_id is not null then to_jsonb(cfg) else null end,'members',rows,'offset',p_offset);
end $$;

create function public.group_member_decide(p_workspace uuid,p_membership uuid,p_expected_version integer,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=zoi.org_actor();m zoi.group_memberships;l zoi.listings;
begin
 if actor is null or coalesce(zoi.org_role(p_workspace),'') not in('owner','admin','editor') then raise exception 'not_authorized' using errcode='42501';end if;
 if p_status is null or p_status not in('approved','declined','removed') then raise exception 'invalid_membership_status';end if;
 select * into m from zoi.group_memberships where id=p_membership and workspace_id=p_workspace;
 if m.id is null then raise exception 'membership_unavailable';end if;
 select * into l from zoi.listings where id=m.listing_id and owner_workspace_id=p_workspace for share;
 if l.id is null then raise exception 'owned_listing_required';end if;
 select * into m from zoi.group_memberships where id=p_membership and workspace_id=p_workspace for update;
 if m.status=p_status and m.version=p_expected_version+1 then return jsonb_build_object('ok',true,'membership',to_jsonb(m));end if;
 if m.version is distinct from p_expected_version then raise exception 'version_conflict';end if;
 if (p_status in('approved','declined') and m.status<>'pending') or(p_status='removed' and m.status<>'approved') then raise exception 'invalid_membership_transition';end if;
 update zoi.group_memberships set status=p_status,version=version+1,updated_at=clock_timestamp() where id=m.id returning * into m;
 insert into zoi.org_audit(workspace_id,entity_id,action,actor_profile_id) values(m.workspace_id,m.id,'group_membership_'||p_status,actor);
 return jsonb_build_object('ok',true,'membership',to_jsonb(m));
end $$;

create function public.group_attendance_set(p_workspace uuid,p_event uuid,p_membership uuid,p_expected_version integer,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=zoi.org_actor();e zoi.org_calendar_events;m zoi.group_memberships;r zoi.group_attendance;
begin
 if actor is null or coalesce(zoi.org_role(p_workspace),'') not in('owner','admin','editor') then raise exception 'not_authorized' using errcode='42501';end if;
 if p_status is null or p_status not in('present','absent','excused') then raise exception 'invalid_attendance_status';end if;
 -- Lock ordering matches calendar cancellation: listing, event, then membership.
 select * into e from zoi.org_calendar_events where id=p_event and workspace_id=p_workspace;
 if e.id is null then raise exception 'calendar_event_unavailable';end if;
 perform 1 from zoi.listings where id=e.listing_id and owner_workspace_id=p_workspace for share;
 if not found then raise exception 'owned_listing_required';end if;
 select * into e from zoi.org_calendar_events where id=p_event and workspace_id=p_workspace for share;
 if e.status<>'published' or e.kind not in('rehearsal','class') or e.starts_at>clock_timestamp() then raise exception 'attendance_event_not_started';end if;
 select * into m from zoi.group_memberships where id=p_membership and workspace_id=p_workspace and listing_id=e.listing_id for update;
 if m.id is null then raise exception 'membership_unavailable';end if;
 select * into r from zoi.group_attendance where event_id=p_event and membership_id=p_membership for update;
 if r.status=p_status and r.version=p_expected_version+1 then return jsonb_build_object('ok',true,'attendance',to_jsonb(r));end if;
 if coalesce(r.version,0) is distinct from p_expected_version then raise exception 'version_conflict';end if;
 if r.id is null and m.status<>'approved' then raise exception 'approved_member_required';end if;
 insert into zoi.group_attendance(workspace_id,event_id,membership_id,status,marked_by) values(p_workspace,p_event,p_membership,p_status,actor) on conflict(event_id,membership_id) do update set status=excluded.status,version=zoi.group_attendance.version+1,marked_by=actor,updated_at=clock_timestamp() returning * into r;
 insert into zoi.org_audit(workspace_id,entity_id,action,actor_profile_id) values(p_workspace,r.id,'group_attendance_'||p_status,actor);
 return jsonb_build_object('ok',true,'attendance',to_jsonb(r));
end $$;

create function public.group_attendance_list(p_workspace uuid,p_event uuid,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e zoi.org_calendar_events;rows jsonb;
begin
 if coalesce(zoi.org_role(p_workspace),'') not in('owner','admin','editor') then raise exception 'not_authorized' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'invalid_roster_filter';end if;
 select * into e from zoi.org_calendar_events where id=p_event and workspace_id=p_workspace;
 if e.id is null or e.kind not in('rehearsal','class') then raise exception 'calendar_event_unavailable';end if;
 if not exists(select 1 from zoi.listings where id=e.listing_id and owner_workspace_id=p_workspace) then raise exception 'owned_listing_required';end if;
 select coalesce(jsonb_agg(jsonb_build_object('membership_id',m.id,'display_name',coalesce(p.display_name,'Member'),'membership_status',m.status,'attendance',case when a.id is not null then to_jsonb(a) else null end) order by m.created_at,m.id),'[]') into rows from(select * from zoi.group_memberships m where m.workspace_id=p_workspace and m.listing_id=e.listing_id and(m.status='approved' or exists(select 1 from zoi.group_attendance a where a.membership_id=m.id and a.event_id=p_event)) order by m.created_at,m.id limit 101 offset p_offset)m join zoi.user_profiles p on p.id=m.profile_id left join zoi.group_attendance a on a.membership_id=m.id and a.event_id=p_event;
 return jsonb_build_object('ok',true,'workspace_id',p_workspace,'event',to_jsonb(e),'members',rows,'offset',p_offset);
end $$;
create function public.group_activity(p_workspace uuid,p_listing uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if coalesce(zoi.org_role(p_workspace),'') not in('owner','admin','editor') then raise exception 'not_authorized' using errcode='42501';end if;
 if not exists(select 1 from zoi.listings where id=p_listing and owner_workspace_id=p_workspace) then raise exception 'owned_listing_required';end if;
 return jsonb_build_object('ok',true,'workspace_id',p_workspace,'listing_id',p_listing,'changes',(select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]') from(select a.* from zoi.org_audit a where a.workspace_id=p_workspace and a.action like 'group_%' and(a.entity_id=p_listing or exists(select 1 from zoi.group_memberships m where m.id=a.entity_id and m.listing_id=p_listing and m.workspace_id=p_workspace) or exists(select 1 from zoi.group_attendance g join zoi.group_memberships m on m.id=g.membership_id where g.id=a.entity_id and m.listing_id=p_listing and g.workspace_id=p_workspace)) order by a.created_at desc,a.id desc limit 100)q));
end $$;
revoke all on function public.group_activity(uuid,uuid) from public,anon,authenticated;
grant execute on function public.group_activity(uuid,uuid) to authenticated;
revoke all on function public.group_settings_save(uuid,uuid,integer,boolean,text,text),public.group_member_state(uuid),public.group_membership_request(uuid,integer,boolean),public.group_membership_withdraw(uuid,integer),public.group_roster(uuid,uuid,text,integer),public.group_member_decide(uuid,uuid,integer,text),public.group_attendance_set(uuid,uuid,uuid,integer,text),public.group_attendance_list(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.group_settings_save(uuid,uuid,integer,boolean,text,text),public.group_membership_request(uuid,integer,boolean),public.group_membership_withdraw(uuid,integer),public.group_roster(uuid,uuid,text,integer),public.group_member_decide(uuid,uuid,integer,text),public.group_attendance_set(uuid,uuid,uuid,integer,text),public.group_attendance_list(uuid,uuid,integer) to authenticated;
grant execute on function public.group_member_state(uuid) to anon,authenticated;
commit;
