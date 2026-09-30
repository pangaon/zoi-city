begin;
set local lock_timeout='5s';
create table zoi.inquiry_cancelled_requests(actor_id uuid not null references zoi.user_profiles(id),request_id uuid not null,created_at timestamptz not null default clock_timestamp(),primary key(actor_id,request_id));
create index inquiry_cancelled_requests_actor_created on zoi.inquiry_cancelled_requests(actor_id,created_at);
alter table zoi.inquiry_cancelled_requests enable row level security;
revoke all on zoi.inquiry_cancelled_requests from public,anon,authenticated;

-- Eligibility is a private predicate, not a grant to read listing or claim data.
create function zoi.inquiry_recipient_ready(p_listing uuid,p_workspace uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from zoi.listings l where l.id=p_listing and l.owner_workspace_id=p_workspace and l.publish_status='published' and l.moderation_status in('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden' and (
 (l.entity_type='event' and l.ingestion_source='organizer_created' and coalesce(l.claim_status,'') not in('ownership_disputed','claim_rejected','transferred'))
 or (l.claim_status='claimed' and l.verification_status='owner_verified' and exists(select 1 from zoi.listing_claims c where c.listing_id=l.id and c.workspace_id=p_workspace and c.claim_status='claimed' and c.verified_at is not null))));
$$;
revoke all on function zoi.inquiry_recipient_ready(uuid,uuid) from public,anon,authenticated;
-- Lock the current membership before staff actions so committed revocation wins.
create function zoi.inquiry_operator_role(p_workspace uuid) returns text language plpgsql security definer set search_path='' as $$
declare r text;
begin
 select m.role into r from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id=p_workspace and p.auth_user_id=auth.uid() for share of m;
 return r;
end $$;
revoke all on function zoi.inquiry_operator_role(uuid) from public,anon,authenticated;
create or replace function public.inquiry_availability(p_listing uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('ok',true,'available',coalesce(s.enabled,false) and s.workspace_id=l.owner_workspace_id and zoi.inquiry_recipient_ready(l.id,l.owner_workspace_id),'name',l.name) from zoi.listings l left join zoi.inquiry_settings s on s.listing_id=l.id where l.id=p_listing and l.publish_status='published' and l.moderation_status in('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden'),jsonb_build_object('ok',true,'available',false));
$$;

create or replace function public.inquiry_settings_save(p_workspace uuid,p_listing uuid,p_enabled boolean,p_expected_version integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare s zoi.inquiry_settings;l zoi.listings;
begin
 if auth.uid() is null or coalesce(zoi.inquiry_operator_role(p_workspace),'') not in('owner','admin') then raise exception 'inquiry_permission_denied' using errcode='42501';end if;
 select * into l from zoi.listings where id=p_listing for update;
 if l.id is null or l.owner_workspace_id is distinct from p_workspace or (l.publish_status<>'published' or coalesce(l.marketplace_status,'')='hidden') or p_enabled is null then raise exception 'inquiry_listing_unavailable';end if;
 perform 1 from zoi.listing_claims where listing_id=p_listing for share;
 if p_enabled and not zoi.inquiry_recipient_ready(p_listing,p_workspace) then raise exception 'inquiry_listing_unavailable';end if;
 select * into s from zoi.inquiry_settings where listing_id=p_listing for update;
 if s.listing_id is null then
  if p_expected_version is distinct from 0 then raise exception 'inquiry_version_conflict';end if;
  insert into zoi.inquiry_settings(listing_id,workspace_id,enabled) values(p_listing,p_workspace,p_enabled) returning * into s;
 else
  if s.version is distinct from p_expected_version then raise exception 'inquiry_version_conflict';end if;
  update zoi.inquiry_settings set workspace_id=p_workspace,enabled=p_enabled,version=version+1,updated_at=clock_timestamp() where listing_id=p_listing returning * into s;
 end if;
 return jsonb_build_object('ok',true,'settings',to_jsonb(s));
end $$;

create or replace function public.inquiry_start(p_listing uuid,p_subject text,p_body text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;t zoi.inquiry_threads;l zoi.listings;s zoi.inquiry_settings;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;
 actor:=zoi.ensure_profile();perform 1 from zoi.user_profiles where id=actor for update;
 if p_request is null or length(btrim(coalesce(p_subject,''))) not between 1 and 120 or length(btrim(coalesce(p_body,''))) not between 1 and 4000 then raise exception 'invalid_inquiry';end if;
 if exists(select 1 from zoi.inquiry_cancelled_requests where actor_id=actor and request_id=p_request) then raise exception 'inquiry_request_cancelled';end if;
 select * into t from zoi.inquiry_threads where customer_id=actor and request_id=p_request;
 if t.id is not null then
  if t.listing_id is distinct from p_listing or t.subject is distinct from btrim(p_subject) or t.initial_body is distinct from btrim(p_body) then raise exception 'inquiry_request_conflict';end if;
  return jsonb_build_object('ok',true,'thread',to_jsonb(t));
 end if;
 if exists(select 1 from zoi.inquiry_messages where author_id=actor and request_id=p_request) then raise exception 'inquiry_request_conflict';end if;
 select * into l from zoi.listings where id=p_listing for share;
 select * into s from zoi.inquiry_settings where listing_id=p_listing for share;
 perform 1 from zoi.listing_claims where listing_id=p_listing for share;
 if not zoi.inquiry_recipient_ready(p_listing,l.owner_workspace_id) or l.id is null or (l.publish_status<>'published' or coalesce(l.marketplace_status,'')='hidden') or s.enabled is distinct from true or s.workspace_id is distinct from l.owner_workspace_id then raise exception 'inquiry_unavailable';end if;
 if (select count(*) from zoi.inquiry_threads where customer_id=actor and created_at>=clock_timestamp()-interval '1 day')>=10 then raise exception 'inquiry_daily_limit';end if;
 insert into zoi.inquiry_threads(listing_id,workspace_id,customer_id,request_id,subject,initial_body) values(p_listing,s.workspace_id,actor,p_request,btrim(p_subject),btrim(p_body)) returning * into t;
 insert into zoi.inquiry_messages(thread_id,author_id,author_side,request_id,body) values(t.id,actor,'customer',p_request,btrim(p_body));
 insert into zoi.inquiry_audit(thread_id,actor_id,action,after_state) values(t.id,actor,'created',jsonb_build_object('status',t.status,'version',t.version));
 return jsonb_build_object('ok',true,'thread',to_jsonb(t));
end $$;

create or replace function public.inquiry_reply(p_thread uuid,p_body text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;t zoi.inquiry_threads;m zoi.inquiry_messages;side text;new_status text;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;
 actor:=zoi.ensure_profile();perform 1 from zoi.user_profiles where id=actor for update;
 if p_request is null or length(btrim(coalesce(p_body,''))) not between 1 and 4000 then raise exception 'invalid_inquiry_message';end if;
 if exists(select 1 from zoi.inquiry_cancelled_requests where actor_id=actor and request_id=p_request) then raise exception 'inquiry_request_cancelled';end if;
 select * into t from zoi.inquiry_threads where id=p_thread for update;
 if t.id is null then raise exception 'inquiry_unavailable';end if;
 if actor=t.customer_id then side:='customer';elsif coalesce(zoi.inquiry_operator_role(t.workspace_id),'') in('owner','admin','editor') then side:='business';else raise exception 'inquiry_permission_denied' using errcode='42501';end if;
 select * into m from zoi.inquiry_messages where author_id=actor and request_id=p_request;
 if m.id is not null then
  if m.thread_id is distinct from p_thread or m.body is distinct from btrim(p_body) then raise exception 'inquiry_request_conflict';end if;
  return jsonb_build_object('ok',true,'message',to_jsonb(m),'thread',to_jsonb(t));
 end if;
 perform 1 from zoi.listings where id=t.listing_id for share;
 perform 1 from zoi.listing_claims where listing_id=t.listing_id for share;
 if not zoi.inquiry_recipient_ready(t.listing_id,t.workspace_id) then raise exception 'inquiry_business_changed';end if;
 if not exists(select 1 from zoi.listings where id=t.listing_id and owner_workspace_id=t.workspace_id and publish_status='published' and coalesce(marketplace_status,'')<>'hidden') then raise exception 'inquiry_business_changed';end if;
 if (select count(*) from zoi.inquiry_messages where author_id=actor and created_at>=clock_timestamp()-interval '1 minute')>=10 or (select count(*) from zoi.inquiry_messages where author_id=actor and created_at>=clock_timestamp()-interval '1 day')>=100 then raise exception 'inquiry_message_limit';end if;
 insert into zoi.inquiry_messages(thread_id,author_id,author_side,request_id,body) values(t.id,actor,side,p_request,btrim(p_body)) returning * into m;
 new_status:=case when side='customer' then 'open' else 'waiting' end;
 insert into zoi.inquiry_audit(thread_id,actor_id,action,before_state,after_state) values(t.id,actor,'replied',jsonb_build_object('status',t.status,'version',t.version),jsonb_build_object('status',new_status,'version',t.version+1,'message_id',m.id));
 update zoi.inquiry_threads set status=new_status,version=version+1,updated_at=clock_timestamp() where id=t.id returning * into t;
 return jsonb_build_object('ok',true,'message',to_jsonb(m),'thread',to_jsonb(t));
end $$;

create or replace function public.inquiry_thread(p_thread uuid,p_before uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;t zoi.inquiry_threads;messages jsonb;audit jsonb;cursor zoi.inquiry_messages;operator boolean;can_reply boolean;
begin
 actor:=(select id from zoi.user_profiles where auth_user_id=auth.uid());
 select * into t from zoi.inquiry_threads where id=p_thread;
 operator:=coalesce(zoi.inquiry_operator_role(t.workspace_id),'') in('owner','admin','editor');
 if auth.uid() is null or t.id is null or (actor is distinct from t.customer_id and not operator) then raise exception 'inquiry_permission_denied' using errcode='42501';end if;
 if p_before is not null then select * into cursor from zoi.inquiry_messages where id=p_before and thread_id=t.id;if cursor.id is null then raise exception 'invalid_message_cursor';end if;end if;
 select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at,m.id),'[]') into messages from(select * from zoi.inquiry_messages where thread_id=t.id and (p_before is null or (created_at,id)<(cursor.created_at,cursor.id)) order by created_at desc,id desc limit 100)m;
 if operator then select coalesce(jsonb_agg(to_jsonb(a) order by a.id desc),'[]') into audit from(select * from zoi.inquiry_audit where thread_id=t.id order by id desc limit 100)a;else audit:='[]';end if;
 can_reply:=zoi.inquiry_recipient_ready(t.listing_id,t.workspace_id) and exists(select 1 from zoi.listings where id=t.listing_id and owner_workspace_id=t.workspace_id and publish_status='published' and coalesce(marketplace_status,'')<>'hidden');
 return jsonb_build_object('ok',true,'thread',to_jsonb(t),'messages',messages,'audit',audit,'operator',operator,'can_reply',can_reply,'older_cursor',case when jsonb_array_length(messages)=100 then messages->0->>'id' else null end);
end $$;

create or replace function public.inquiry_inbox(p_workspace uuid,p_status text default null,p_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare role text;rows jsonb;listings jsonb;members jsonb;
begin
 role:=zoi.inquiry_operator_role(p_workspace);if auth.uid() is null or coalesce(role,'') not in('owner','admin','editor') then raise exception 'inquiry_permission_denied' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_offset>10000 or (p_status is not null and p_status not in('open','waiting','resolved')) then raise exception 'invalid_inquiry_filter';end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by updated_at desc,id),'[]') into rows from(select t.*,l.name as listing_name from zoi.inquiry_threads t join zoi.listings l on l.id=t.listing_id where t.workspace_id=p_workspace and (p_status is null or t.status=p_status) order by t.updated_at desc,t.id limit 50 offset p_offset)t;
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'eligible',zoi.inquiry_recipient_ready(l.id,p_workspace),'enabled',coalesce(s.enabled,false) and s.workspace_id=p_workspace and zoi.inquiry_recipient_ready(l.id,p_workspace),'version',coalesce(s.version,0)) order by l.name),'[]') into listings from zoi.listings l left join zoi.inquiry_settings s on s.listing_id=l.id where l.owner_workspace_id=p_workspace and l.publish_status='published' and l.moderation_status in('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden';
 select coalesce(jsonb_agg(jsonb_build_object('profile_id',m.profile_id,'display_name',coalesce(p.display_name,'Team member'),'role',m.role)),'[]') into members from zoi.workspace_members m join zoi.user_profiles p on p.id=m.profile_id where m.workspace_id=p_workspace and m.role in('owner','admin','editor');
 return jsonb_build_object('ok',true,'role',role,'threads',rows,'listings',listings,'members',members,'next_offset',case when jsonb_array_length(rows)=50 then p_offset+50 else null end);
end $$;
create or replace function public.inquiry_update(p_workspace uuid,p_thread uuid,p_expected_version integer,p_status text,p_assignee uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t zoi.inquiry_threads;actor uuid;
begin
 if auth.uid() is null or coalesce(zoi.inquiry_operator_role(p_workspace),'') not in('owner','admin','editor') then raise exception 'inquiry_permission_denied' using errcode='42501';end if;
 actor:=(select id from zoi.user_profiles where auth_user_id=auth.uid());select * into t from zoi.inquiry_threads where id=p_thread and workspace_id=p_workspace for update;
 if t.id is null then raise exception 'inquiry_unavailable';end if;
 if t.version is distinct from p_expected_version then raise exception 'inquiry_version_conflict';end if;
 if p_status is null or p_status not in('open','waiting','resolved') then raise exception 'invalid_inquiry_status';end if;
 if p_assignee is not null and not exists(select 1 from zoi.workspace_members where workspace_id=p_workspace and profile_id=p_assignee and role in('owner','admin','editor')) then raise exception 'invalid_inquiry_assignee';end if;
 insert into zoi.inquiry_audit(thread_id,actor_id,action,before_state,after_state) values(t.id,actor,'updated',jsonb_build_object('status',t.status,'assignee_id',t.assignee_id,'version',t.version),jsonb_build_object('status',p_status,'assignee_id',p_assignee,'version',t.version+1));
 update zoi.inquiry_threads set status=p_status,assignee_id=p_assignee,version=version+1,updated_at=clock_timestamp() where id=t.id returning * into t;
 return jsonb_build_object('ok',true,'thread',to_jsonb(t));
end $$;

-- Historical identifiers only; fetching the conversation remains a separate current-authority check.
create function public.inquiry_receipt(p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;t zoi.inquiry_threads;m zoi.inquiry_messages;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;
 if p_request is null then raise exception 'invalid_inquiry_request';end if;
 select id into actor from zoi.user_profiles where auth_user_id=auth.uid();
 select * into t from zoi.inquiry_threads where customer_id=actor and request_id=p_request;
 if t.id is not null then
  select * into m from zoi.inquiry_messages where thread_id=t.id and author_id=actor and request_id=p_request;
  return jsonb_build_object('ok',true,'found',true,'receipt',jsonb_build_object('kind','start','request_id',p_request,'thread_id',t.id,'listing_id',t.listing_id,'message_id',m.id));
 end if;
 select * into m from zoi.inquiry_messages where author_id=actor and request_id=p_request;
 if m.id is null then return jsonb_build_object('ok',true,'found',false,'cancelled',exists(select 1 from zoi.inquiry_cancelled_requests where actor_id=actor and request_id=p_request),'request_id',p_request);end if;
 select * into t from zoi.inquiry_threads where id=m.thread_id;
 if m.author_side='business' then
  perform 1 from zoi.workspace_members where workspace_id=t.workspace_id and profile_id=actor and role in('owner','admin','editor') for share;
  if not found then raise exception 'inquiry_permission_denied' using errcode='42501';end if;
 end if;
 return jsonb_build_object('ok',true,'found',true,'receipt',jsonb_build_object('kind','reply','request_id',p_request,'thread_id',t.id,'listing_id',t.listing_id,'message_id',m.id));
end $$;
revoke all on function public.inquiry_receipt(uuid) from public,anon,authenticated;
grant execute on function public.inquiry_receipt(uuid) to authenticated;

create function public.inquiry_cancel_pending(p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;r jsonb;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;
 if p_request is null then raise exception 'invalid_inquiry_request';end if;
 actor:=zoi.ensure_profile();
 perform 1 from zoi.user_profiles where id=actor for update;
 if not found then raise exception 'sign_in_required' using errcode='42501';end if;
 r:=public.inquiry_receipt(p_request);
 if r->>'found'='true' then return r||jsonb_build_object('cancelled',false);end if;
 if exists(select 1 from zoi.inquiry_cancelled_requests where actor_id=actor and request_id=p_request) then return jsonb_build_object('ok',true,'cancelled',true,'request_id',p_request);end if;
 if (select count(*) from zoi.inquiry_cancelled_requests where actor_id=actor and created_at>clock_timestamp()-interval '1 day')>=100 then raise exception 'inquiry_cancel_limit';end if;
 insert into zoi.inquiry_cancelled_requests(actor_id,request_id)values(actor,p_request);
 return jsonb_build_object('ok',true,'cancelled',true,'request_id',p_request);
end $$;
revoke all on function public.inquiry_cancel_pending(uuid) from public,anon,authenticated;
grant execute on function public.inquiry_cancel_pending(uuid) to authenticated;
commit;
