begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
-- Local candidate only. Existing RPC bodies, ACLs, CAS and immutable receipts stay intact.
-- Freeze the finite existing relation before backfill and installing the write guards.
lock table zoi.creator_campaigns,zoi.festival_applications in share row exclusive mode;
create table zoi.festival_creator_bindings(
 campaign_id uuid primary key references zoi.creator_campaigns(id),
 application_id uuid not null unique references zoi.festival_applications(id),
 inquiry_id uuid not null,workspace_id uuid not null,event_id uuid not null,
 customer_id uuid not null,terms jsonb not null,units integer not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table zoi.festival_creator_bindings enable row level security;
revoke all on zoi.festival_creator_bindings from public,anon,authenticated;
-- Reject inconsistent historical pairings rather than silently bless them.
do $$ begin
 if exists(select 1 from zoi.creator_campaigns c join zoi.festival_applications a on a.inquiry_id=c.inquiry_id join zoi.inquiry_threads i on i.id=c.inquiry_id where a.terms->>'kind'='sponsor' and
 (c.kind<>'sponsorship' or c.workspace_id<>a.workspace_id or c.customer_id<>a.profile_id or i.workspace_id<>a.workspace_id or i.customer_id<>a.profile_id or i.listing_id<>a.event_id)) then
 raise exception 'festival_creator_backfill_identity_conflict';end if;
end $$;
insert into zoi.festival_creator_bindings(campaign_id,application_id,inquiry_id,workspace_id,event_id,customer_id,terms,units)
 select c.id,a.id,a.inquiry_id,a.workspace_id,a.event_id,a.profile_id,a.terms,a.units from zoi.creator_campaigns c join zoi.festival_applications a on a.inquiry_id=c.inquiry_id where a.terms->>'kind'='sponsor';

create function zoi.festival_creator_application_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  -- Public edits only alter contact details/quantity; source identity and original offer are immutable.
  if (new.inquiry_id,new.workspace_id,new.event_id,new.profile_id,new.package_id,new.terms) is distinct from (old.inquiry_id,old.workspace_id,old.event_id,old.profile_id,old.package_id,old.terms) then raise exception 'festival_application_identity_immutable';end if;
  if new.units is distinct from old.units and exists(select 1 from zoi.festival_creator_bindings where application_id=old.id) then raise exception 'festival_bound_quantity_immutable';end if;
  -- Cancellation holds application FOR UPDATE already. Never acquire inquiry locks here:
  -- conversion locks inquiry before taking the application share lock.
  return new;
 end if;
 if new.terms->>'kind'='sponsor' then
  -- Shared with campaign INSERT even when the counterpart does not exist yet.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('festival-creator:'||new.inquiry_id::text,0));
  if exists(select 1 from zoi.creator_campaigns where inquiry_id=new.inquiry_id) then raise exception 'festival_campaign_already_exists';end if;
 end if;
 return new;
end $$;
create trigger festival_creator_application_identity before insert or update on zoi.festival_applications for each row execute function zoi.festival_creator_application_guard();

create function zoi.festival_creator_bind_campaign() returns trigger language plpgsql security definer set search_path='' as $$
declare a zoi.festival_applications;i zoi.inquiry_threads;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('festival-creator:'||new.inquiry_id::text,0));
 select * into a from zoi.festival_applications where inquiry_id=new.inquiry_id for share;
 if a.id is null or a.terms->>'kind' is distinct from 'sponsor' then return new;end if;
 select * into i from zoi.inquiry_threads where id=new.inquiry_id;
 if a.status<>'approved' then raise exception 'festival_fulfillment_not_approved' using errcode='42501';end if;
 if new.kind<>'sponsorship' or new.workspace_id<>a.workspace_id or new.customer_id<>a.profile_id or i.workspace_id<>a.workspace_id or i.customer_id<>a.profile_id or i.listing_id<>a.event_id then raise exception 'festival_fulfillment_identity_mismatch' using errcode='42501';end if;
 insert into zoi.festival_creator_bindings(campaign_id,application_id,inquiry_id,workspace_id,event_id,customer_id,terms,units) values(new.id,a.id,a.inquiry_id,a.workspace_id,a.event_id,a.profile_id,a.terms,a.units);
 return new;
end $$;
create trigger festival_creator_campaign_bind after insert on zoi.creator_campaigns for each row execute function zoi.festival_creator_bind_campaign();

create function zoi.festival_creator_require_active(p_campaign uuid) returns void language plpgsql security definer set search_path='' as $$
declare b zoi.festival_creator_bindings;a zoi.festival_applications;c zoi.creator_campaigns;
begin
 select * into c from zoi.creator_campaigns where id=p_campaign;
 select * into b from zoi.festival_creator_bindings where campaign_id=p_campaign;
 if b.campaign_id is null then
  if exists(select 1 from zoi.festival_applications where inquiry_id=c.inquiry_id and terms->>'kind'='sponsor') then raise exception 'festival_fulfillment_binding_required' using errcode='42501';end if;
  return;
 end if;
 -- Held until transaction end, so cancellation cannot interleave with a fulfillment write.
 select * into a from zoi.festival_applications where id=b.application_id for share;
 if a.id is null or a.status<>'approved' then raise exception 'festival_fulfillment_not_approved' using errcode='42501';end if;
 if (a.inquiry_id,a.workspace_id,a.event_id,a.profile_id,a.terms,a.units) is distinct from (b.inquiry_id,b.workspace_id,b.event_id,b.customer_id,b.terms,b.units) or
 (c.inquiry_id,c.workspace_id,c.customer_id,c.kind) is distinct from (b.inquiry_id,b.workspace_id,b.customer_id,'sponsorship'::text) then raise exception 'festival_fulfillment_identity_mismatch' using errcode='42501';end if;
end $$;
create function zoi.festival_creator_write_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='creator_campaigns' then
  if (new.inquiry_id,new.workspace_id,new.customer_id,new.kind) is distinct from (old.inquiry_id,old.workspace_id,old.customer_id,old.kind) then raise exception 'creator_source_identity_immutable';end if;
  perform zoi.festival_creator_require_active(new.id);
 else
  if TG_OP='UPDATE' and new.campaign_id is distinct from old.campaign_id then raise exception 'creator_source_identity_immutable';end if;
  perform zoi.festival_creator_require_active(new.campaign_id);
 end if;
 return new;
end $$;
create trigger festival_creator_campaign_write before update on zoi.creator_campaigns for each row execute function zoi.festival_creator_write_guard();
create trigger festival_creator_deliverable_write before insert or update on zoi.creator_deliverables for each row execute function zoi.festival_creator_write_guard();
create trigger festival_creator_brief_write before insert or update on zoi.creator_briefs for each row execute function zoi.festival_creator_write_guard();
create trigger festival_creator_submission_write before insert or update on zoi.creator_submissions for each row execute function zoi.festival_creator_write_guard();
revoke all on function zoi.festival_creator_application_guard(),zoi.festival_creator_bind_campaign(),zoi.festival_creator_require_active(uuid),zoi.festival_creator_write_guard() from public,anon,authenticated;
-- The authenticated capability reader is installed in the same transaction as the guards.
create function public.festival_fulfillment_source(p_workspace uuid,p_application uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a zoi.festival_applications;r text;c uuid;
begin
 r:=zoi.workspace_locked_role(p_workspace);
 if r not in('owner','admin','editor') then raise exception 'festival_permission_denied' using errcode='42501';end if;
 if exists(select 1 from (values
 ('zoi.festival_applications'::regclass,'festival_creator_application_identity','zoi.festival_creator_application_guard()'::regprocedure),
 ('zoi.creator_campaigns'::regclass,'festival_creator_campaign_bind','zoi.festival_creator_bind_campaign()'::regprocedure),
 ('zoi.creator_campaigns'::regclass,'festival_creator_campaign_write','zoi.festival_creator_write_guard()'::regprocedure),
 ('zoi.creator_deliverables'::regclass,'festival_creator_deliverable_write','zoi.festival_creator_write_guard()'::regprocedure),
 ('zoi.creator_briefs'::regclass,'festival_creator_brief_write','zoi.festival_creator_write_guard()'::regprocedure),
 ('zoi.creator_submissions'::regclass,'festival_creator_submission_write','zoi.festival_creator_write_guard()'::regprocedure)
 ) expected(rel,name,fn) where not exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid=expected.rel and t.tgname=expected.name and t.tgfoid=expected.fn and t.tgenabled in('O','A') and not t.tgisinternal)) then raise exception 'festival_fulfillment_unavailable';end if;
 select * into a from zoi.festival_applications where id=p_application and workspace_id=p_workspace for share;
 if a.id is null or a.status<>'approved' or a.terms->>'kind' is distinct from 'sponsor' then raise exception 'festival_fulfillment_not_approved' using errcode='42501';end if;
 perform zoi.festival_event(a.event_id,p_workspace);
 -- Recheck session validity after any source/event lock wait. Membership locks remain held.
 r:=zoi.workspace_locked_role(p_workspace);
 select id into c from zoi.creator_campaigns where inquiry_id=a.inquiry_id;
 if c is not null then perform zoi.festival_creator_require_active(c);end if;
 return jsonb_build_object('ok',true,'capability','festival_creator_binding_v1','role',r,'workspace_id',p_workspace,'application',to_jsonb(a),'campaign_id',c);
end $$;
revoke all on function public.festival_fulfillment_source(uuid,uuid) from public,anon,authenticated;
grant execute on function public.festival_fulfillment_source(uuid,uuid) to authenticated;
commit;
