begin;
set local lock_timeout='5s';
create table zoi.booking_reschedules(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references zoi.workspaces(id),booking_id uuid not null references zoi.bookings(id),
 actor_profile_id uuid not null references zoi.user_profiles(id),request_id uuid not null,request_payload jsonb not null,
 from_slot_id uuid not null references zoi.booking_slots(id),to_slot_id uuid not null references zoi.booking_slots(id),
 before_version integer not null,after_version integer not null,old_slot jsonb not null,new_slot jsonb not null,
 receipt jsonb not null,created_at timestamptz not null default clock_timestamp(),unique(actor_profile_id,request_id)
);
create index booking_reschedules_workspace_time on zoi.booking_reschedules(workspace_id,created_at desc);
create index booking_reschedules_booking_time on zoi.booking_reschedules(booking_id,created_at desc);
alter table zoi.booking_reschedules enable row level security;
revoke all on zoi.booking_reschedules from public,anon,authenticated;

create function public.booking_reschedule_options(p_booking uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;b zoi.bookings;original zoi.booking_slots;cfg zoi.booking_settings;rows jsonb;more boolean;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;actor:=zoi.ensure_profile();if actor is null then raise exception 'sign_in_required' using errcode='42501';end if;
 select * into b from zoi.bookings where id=p_booking;
 if b.id is null or (b.profile_id<>actor and not exists(select 1 from zoi.workspace_members where workspace_id=b.workspace_id and profile_id=actor and role in ('owner','admin'))) then raise exception 'booking_not_owned' using errcode='42501';end if;
 if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_to<=p_from or p_to-p_from>interval '31 days' then raise exception 'invalid_date_range';end if;
 select * into original from zoi.booking_slots where id=b.slot_id;
 if b.status<>'confirmed' or original.starts_at<=clock_timestamp() then raise exception 'booking_not_reschedulable';end if;
 select * into cfg from zoi.booking_settings where workspace_id=b.workspace_id;
 if not exists(select 1 from zoi.listings where id=cfg.listing_id and owner_workspace_id=b.workspace_id and publish_status='published' and coalesce(marketplace_status,'')<>'hidden') or not cfg.enabled or cfg.workspace_id is null then raise exception 'booking_unavailable';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.starts_at,q.id),'[]') into rows from(
 select s.* from zoi.booking_slots s join zoi.booking_services v on v.id=s.service_id join zoi.booking_resources r on r.id=s.resource_id
 where s.workspace_id=b.workspace_id and s.service_id=original.service_id and s.id<>original.id and s.active and v.active and r.active and s.capacity>=b.party_size
 and s.starts_at>=greatest(p_from,clock_timestamp()+interval '5 minutes') and s.starts_at<p_to
 and not exists(select 1 from zoi.bookings taken where taken.slot_id=s.id and taken.status<>'cancelled')
 order by s.starts_at,s.id limit 201)q;
 more:=jsonb_array_length(rows)>200;if more then rows:=rows-200;end if;
 return jsonb_build_object('ok',true,'booking_id',b.id,'booking_version',b.version,'party_size',b.party_size,'workspace_id',b.workspace_id,'timezone',cfg.timezone,'original',to_jsonb(original),'slots',rows,'truncated',more);
end $$;

create function public.booking_reschedule(p_booking uuid,p_expected_version integer,p_slot uuid,p_expected_slot_version integer,p_request_id uuid,p_expected_price_cents integer,p_expected_currency text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;b zoi.bookings;original zoi.booking_slots;target zoi.booking_slots;prior zoi.booking_reschedules;payload jsonb;v_receipt jsonb;change_id uuid:=gen_random_uuid();before_version integer;source_id uuid;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;actor:=zoi.ensure_profile();if actor is null then raise exception 'sign_in_required' using errcode='42501';end if;
 if p_request_id is null then raise exception 'request_id_required';end if;
 select * into b from zoi.bookings where id=p_booking;
 if b.id is null or (b.profile_id<>actor and not exists(select 1 from zoi.workspace_members where workspace_id=b.workspace_id and profile_id=actor and role in ('owner','admin'))) then raise exception 'booking_not_owned' using errcode='42501';end if;
 payload:=jsonb_build_object('booking',p_booking,'booking_version',p_expected_version,'slot',p_slot,'slot_version',p_expected_slot_version,'price_cents',p_expected_price_cents,'currency',p_expected_currency);
 -- Serialize identical request keys across bookings without changing the existing profile/resource lock order.
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_request_id::text,791));
 select * into prior from zoi.booking_reschedules where actor_profile_id=actor and request_id=p_request_id;
 if prior.id is not null then
  if prior.request_payload is distinct from payload then raise exception 'request_id_conflict';end if;
  return prior.receipt;
 end if;
 source_id:=b.slot_id;
 select * into original from zoi.booking_slots where id=source_id;
 select * into target from zoi.booking_slots where id=p_slot;
 if original.id is null or target.id is null or target.workspace_id<>b.workspace_id or target.service_id<>original.service_id or target.id=original.id then raise exception 'invalid_reschedule_target';end if;
 -- Every writer already takes a resource before its slots/booking. Stable order also protects opposing moves.
 perform 1 from zoi.booking_resources where id in(original.resource_id,target.resource_id) order by id for update;
 perform 1 from zoi.booking_slots where id in(original.id,target.id) order by id for update;
 select * into b from zoi.bookings where id=p_booking for update;
 if b.slot_id is distinct from source_id or b.version is distinct from p_expected_version then raise exception 'version_conflict';end if;
 select * into original from zoi.booking_slots where id=source_id;
 select * into target from zoi.booking_slots where id=p_slot;
 if b.status<>'confirmed' or original.starts_at<=clock_timestamp() then raise exception 'booking_not_reschedulable';end if;
 if target.workspace_id<>b.workspace_id or target.service_id<>original.service_id or not target.active or target.starts_at<=clock_timestamp()+interval '5 minutes' then raise exception 'slot_unavailable';end if;
 if target.version is distinct from p_expected_slot_version then raise exception 'slot_version_conflict';end if;
 if target.price_cents is distinct from p_expected_price_cents or target.currency is distinct from p_expected_currency then raise exception 'booking_price_changed';end if;
 if b.party_size>target.capacity then raise exception 'party_exceeds_capacity';end if;
 if not exists(select 1 from zoi.booking_settings c join zoi.listings l on l.id=c.listing_id where c.workspace_id=b.workspace_id and c.enabled and l.owner_workspace_id=c.workspace_id and l.publish_status='published' and coalesce(l.marketplace_status,'')<>'hidden') or not exists(select 1 from zoi.booking_services where id=target.service_id and active) or not exists(select 1 from zoi.booking_resources where id=target.resource_id and active) then raise exception 'booking_unavailable';end if;
 if exists(select 1 from zoi.bookings where slot_id=target.id and status<>'cancelled') then raise exception 'slot_unavailable';end if;
 before_version:=b.version;
 update zoi.bookings set slot_id=target.id,version=version+1,updated_at=clock_timestamp() where id=b.id returning * into b;
 v_receipt:=jsonb_build_object('ok',true,'booking',to_jsonb(b),'reschedule_id',change_id,'from_slot_id',original.id,'to_slot_id',target.id,'old_slot',to_jsonb(original),'new_slot',to_jsonb(target),'payment_collected',false);
 insert into zoi.booking_reschedules(id,workspace_id,booking_id,actor_profile_id,request_id,request_payload,from_slot_id,to_slot_id,before_version,after_version,old_slot,new_slot,receipt)
 values(change_id,b.workspace_id,b.id,actor,p_request_id,payload,original.id,target.id,before_version,b.version,to_jsonb(original),to_jsonb(target),v_receipt);
 return v_receipt;
end $$;

create function public.booking_reschedule_history(p_booking uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;b zoi.bookings;rows jsonb;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;actor:=zoi.ensure_profile();if actor is null then raise exception 'sign_in_required' using errcode='42501';end if;
 select * into b from zoi.bookings where id=p_booking;
 if b.id is null or (b.profile_id<>actor and not exists(select 1 from zoi.workspace_members where workspace_id=b.workspace_id and profile_id=actor and role in ('owner','admin'))) then raise exception 'booking_not_owned' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]') into rows from(select id,actor_profile_id,from_slot_id,to_slot_id,before_version,after_version,old_slot,new_slot,created_at from zoi.booking_reschedules where booking_id=b.id order by created_at desc limit 100)q;
 return jsonb_build_object('ok',true,'booking_id',b.id,'changes',rows);
end $$;
revoke all on function public.booking_reschedule_options(uuid,timestamptz,timestamptz),public.booking_reschedule(uuid,integer,uuid,integer,uuid,integer,text),public.booking_reschedule_history(uuid) from public,anon,authenticated;
grant execute on function public.booking_reschedule_options(uuid,timestamptz,timestamptz),public.booking_reschedule(uuid,integer,uuid,integer,uuid,integer,text),public.booking_reschedule_history(uuid) to authenticated;
commit;
