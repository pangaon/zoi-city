BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.event_plan_confirm(uuid, integer, uuid)'::regprocedure AND md5(prosrc)='f35a7cbc861a96d412d65f0362e35350' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN RAISE EXCEPTION 'customer_booking_dependency_drift:event_plan_confirm';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.booking_reschedule(uuid, integer, uuid, integer, uuid, integer, text)'::regprocedure AND md5(prosrc)='2825365b4a7c3438f6b105c0ef340023' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN RAISE EXCEPTION 'customer_booking_dependency_drift:booking_reschedule';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.booking_reschedule_options(uuid, timestamp with time zone, timestamp with time zone)'::regprocedure AND md5(prosrc)='93df1d42f8284b7dcf2171dce40fdf45' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN RAISE EXCEPTION 'customer_booking_dependency_drift:booking_reschedule_options';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.booking_create(uuid, uuid, text, text, integer, integer)'::regprocedure AND md5(prosrc)='f9832551dc041f951052f30295f5eed9' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN RAISE EXCEPTION 'customer_booking_dependency_drift:booking_create';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.booking_status_set(uuid, integer, text)'::regprocedure AND md5(prosrc)='7a6c1c6a37a827f1882b2c51a225d910' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN RAISE EXCEPTION 'customer_booking_dependency_drift:booking_status_set';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.booking_my_list(uuid)'::regprocedure AND md5(prosrc)='6279fd36182493d20b96b7d99d8ada7b' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN RAISE EXCEPTION 'customer_booking_dependency_drift:booking_my_list';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.booking_reschedule_history(uuid)'::regprocedure AND md5(prosrc)='477693cdbaf056b68d3eb9f632a390b8' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN RAISE EXCEPTION 'customer_booking_dependency_drift:booking_reschedule_history';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.venue_require_member(uuid, boolean)'::regprocedure AND md5(prosrc)='8f8f063b04975a1673c48dff85851f1a' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN RAISE EXCEPTION 'customer_booking_dependency_drift:venue_require_member';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.suite_lock_session()'::regprocedure AND md5(prosrc)='ab5f8703ced5f96c0ac69257281ffe00' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN RAISE EXCEPTION 'customer_booking_dependency_drift:suite_lock_session';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.workspace_locked_role(uuid)'::regprocedure AND md5(prosrc)='0c25b1e04d01e5866b58d009fa1f50b9' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN RAISE EXCEPTION 'customer_booking_dependency_drift:workspace_locked_role';END IF;
END $guard$;
-- This helper authenticates customers without requiring workspace membership.
-- Operator candidates take the existing foundation's workspace-first locks;
-- ordinary customers take session then current profile mapping only.
CREATE FUNCTION zoi.booking_customer_authority(p_booking uuid DEFAULT NULL,p_exclusive_profile boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $authority$
DECLARE actor uuid;linked_account uuid;ws uuid;member_role text;is_operator boolean:=false;validated_actor uuid;
BEGIN
 IF auth.uid()IS NULL THEN RAISE EXCEPTION 'sign_in_required' USING ERRCODE='42501';END IF;
 SELECT id INTO actor FROM zoi.user_profiles WHERE auth_user_id=auth.uid();
 IF p_booking IS NOT NULL AND actor IS NOT NULL THEN
  SELECT workspace_id INTO ws FROM zoi.bookings WHERE id=p_booking;
  IF EXISTS(SELECT 1 FROM zoi.workspaces WHERE id=ws AND owner_profile_id=actor) OR EXISTS(SELECT 1 FROM zoi.workspace_members WHERE workspace_id=ws AND profile_id=actor AND role IN('owner','admin'))THEN
   member_role:=zoi.workspace_locked_role(ws);
   is_operator:=member_role IN('owner','admin');
   IF is_operator THEN validated_actor:=zoi.venue_require_member(ws,true);END IF;
  END IF;
 END IF;
 PERFORM zoi.suite_lock_session();
 actor:=zoi.ensure_profile();
 IF p_exclusive_profile THEN SELECT auth_user_id INTO linked_account FROM zoi.user_profiles WHERE id=actor FOR UPDATE;
 ELSE SELECT auth_user_id INTO linked_account FROM zoi.user_profiles WHERE id=actor FOR SHARE;END IF;
 IF linked_account IS DISTINCT FROM auth.uid() OR actor IS NULL OR(is_operator AND validated_actor IS DISTINCT FROM actor) THEN RAISE EXCEPTION 'booking_actor_unavailable' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('actor',actor,'operator',coalesce(is_operator,false));
END $authority$;
ALTER FUNCTION zoi.booking_customer_authority(uuid,boolean)OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.booking_customer_authority(uuid,boolean)FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.event_plan_confirm(p_plan uuid, p_expected_version integer, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare current_authority jsonb;actor uuid;plan zoi.event_plans;prior zoi.event_plan_requests;payload jsonb;receipt jsonb;selection jsonb;slot zoi.booking_slots;cfg zoi.booking_settings;resource zoi.booking_resources;b jsonb;rows jsonb:='[]';slot_ids uuid[];
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;current_authority:=zoi.booking_customer_authority(NULL,true);actor:=(current_authority->>'actor')::uuid;if actor is null then raise exception 'sign_in_required' using errcode='42501';end if;
 if p_request_id is null then raise exception 'request_id_required';end if;
 -- Same profile -> ordered resources -> ordered slots order as booking_create/rescheduling.
 perform 1 from zoi.user_profiles where id=actor for update;
 payload:=jsonb_build_object('plan',p_plan,'version',p_expected_version);
 select * into prior from zoi.event_plan_requests where profile_id=actor and request_id=p_request_id;
 if prior.id is not null then if prior.operation<>'confirm' or prior.payload is distinct from payload then raise exception 'request_id_conflict';end if;return prior.receipt;end if;
 select * into plan from zoi.event_plans where id=p_plan and profile_id=actor for update;
 if plan.id is null then raise exception 'event_plan_not_owned' using errcode='42501';end if;
 if plan.version is distinct from p_expected_version then raise exception 'version_conflict';end if;
 if plan.status<>'draft' then raise exception 'event_plan_already_confirmed';end if;
 perform zoi.event_plan_validate(plan.data);
 if jsonb_array_length(plan.data->'selections') not between 1 and 8 then raise exception 'event_plan_selection_required';end if;
 select array_agg((x->>'slot_id')::uuid) into slot_ids from jsonb_array_elements(plan.data->'selections')x;
 perform 1 from zoi.booking_resources where id in(select resource_id from zoi.booking_slots where id=any(slot_ids)) order by id for update;
 perform 1 from zoi.booking_slots where id=any(slot_ids) order by id for update;
 -- Lock availability configuration and published ownership until all bookings are committed.
 perform 1 from zoi.booking_services where id in(select service_id from zoi.booking_slots where id=any(slot_ids)) order by id for share;
 perform 1 from zoi.booking_settings where workspace_id in(select workspace_id from zoi.booking_slots where id=any(slot_ids)) order by workspace_id for share;
 perform 1 from zoi.listings where id in(select (x->>'listing_id')::uuid from jsonb_array_elements(plan.data->'selections')x) order by id for share;
 for selection in select value from jsonb_array_elements(plan.data->'selections') loop
  select * into slot from zoi.booking_slots where id=(selection->>'slot_id')::uuid;
  if slot.id is null or slot.workspace_id is distinct from (selection->>'workspace_id')::uuid or not slot.active or slot.starts_at<=clock_timestamp()+interval '5 minutes' or slot.starts_at>clock_timestamp()+interval '8760 hours' then raise exception 'slot_unavailable';end if;
  select * into cfg from zoi.booking_settings where workspace_id=slot.workspace_id;
  select * into resource from zoi.booking_resources where id=slot.resource_id and workspace_id=slot.workspace_id;
  if cfg.listing_id is distinct from (selection->>'listing_id')::uuid or cfg.version is distinct from (selection->>'settings_version')::integer or not cfg.enabled or not exists(select 1 from zoi.listings where id=cfg.listing_id and owner_workspace_id=slot.workspace_id and publish_status='published' and coalesce(marketplace_status,'')<>'hidden') or resource.id is null or not resource.active or not exists(select 1 from zoi.booking_services where id=slot.service_id and workspace_id=slot.workspace_id and active) then raise exception 'booking_unavailable';end if;
  if slot.version is distinct from (selection->>'slot_version')::integer then raise exception 'slot_version_conflict';end if;
  if slot.price_cents is distinct from (selection->>'price_cents')::integer or slot.currency is distinct from selection->>'currency' or resource.kind is distinct from selection->>'resource_kind' then raise exception 'booking_price_changed';end if;
  if (selection->>'party_size')::integer>slot.capacity then raise exception 'party_exceeds_capacity';end if;
  if exists(select 1 from zoi.bookings where slot_id=slot.id and status<>'cancelled') then raise exception 'slot_unavailable';end if;
 end loop;
 for selection in select value from jsonb_array_elements(plan.data->'selections') loop
  select * into slot from zoi.booking_slots where id=(selection->>'slot_id')::uuid;
  b:=public.booking_create(slot.id,gen_random_uuid(),plan.data->>'customer_name',plan.data->>'customer_email',(selection->>'party_size')::integer,slot.version)->'booking';
  insert into zoi.event_plan_bookings(plan_id,booking_id,role,shared_context,reviewed_slot) values(plan.id,(b->>'id')::uuid,btrim(selection->>'role'),coalesce(selection->>'shared_context',''),to_jsonb(slot));
  rows:=rows||jsonb_build_array(jsonb_build_object('booking',b,'slot',to_jsonb(slot),'role',selection->>'role','listing_id',selection->>'listing_id'));
 end loop;
 update zoi.event_plans set status='confirmed',version=version+1,updated_at=clock_timestamp() where id=plan.id returning * into plan;
 receipt:=jsonb_build_object('ok',true,'plan_id',plan.id,'version',plan.version,'bookings',rows,'payment_collected',false);
 insert into zoi.event_plan_requests(profile_id,request_id,operation,payload,receipt) values(actor,p_request_id,'confirm',payload,receipt);
 return receipt;
end $function$
;
CREATE OR REPLACE FUNCTION public.booking_reschedule(p_booking uuid, p_expected_version integer, p_slot uuid, p_expected_slot_version integer, p_request_id uuid, p_expected_price_cents integer, p_expected_currency text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare current_authority jsonb;actor uuid;b zoi.bookings;original zoi.booking_slots;target zoi.booking_slots;prior zoi.booking_reschedules;payload jsonb;v_receipt jsonb;change_id uuid:=gen_random_uuid();before_version integer;source_id uuid;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;current_authority:=zoi.booking_customer_authority(p_booking,false);actor:=(current_authority->>'actor')::uuid;if actor is null then raise exception 'sign_in_required' using errcode='42501';end if;
 if p_request_id is null then raise exception 'request_id_required';end if;
 select * into b from zoi.bookings where id=p_booking;
 if b.id is null or (b.profile_id<>actor and not coalesce((current_authority->>'operator')::boolean,false)) then raise exception 'booking_not_owned' using errcode='42501';end if;
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
 if (select kind from zoi.booking_resources where id=target.resource_id) is distinct from (select kind from zoi.booking_resources where id=original.resource_id) then raise exception 'invalid_reschedule_target';end if;
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
end $function$
;
CREATE OR REPLACE FUNCTION public.booking_reschedule_options(p_booking uuid, p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare current_authority jsonb;actor uuid;b zoi.bookings;original zoi.booking_slots;cfg zoi.booking_settings;rows jsonb;more boolean;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;current_authority:=zoi.booking_customer_authority(p_booking,false);actor:=(current_authority->>'actor')::uuid;if actor is null then raise exception 'sign_in_required' using errcode='42501';end if;
 select * into b from zoi.bookings where id=p_booking;
 if b.id is null or (b.profile_id<>actor and not coalesce((current_authority->>'operator')::boolean,false)) then raise exception 'booking_not_owned' using errcode='42501';end if;
 if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_to<=p_from or p_to-p_from>interval '31 days' then raise exception 'invalid_date_range';end if;
 select * into original from zoi.booking_slots where id=b.slot_id;
 if b.status<>'confirmed' or original.starts_at<=clock_timestamp() then raise exception 'booking_not_reschedulable';end if;
 select * into cfg from zoi.booking_settings where workspace_id=b.workspace_id;
 if not exists(select 1 from zoi.listings where id=cfg.listing_id and owner_workspace_id=b.workspace_id and publish_status='published' and coalesce(marketplace_status,'')<>'hidden') or not cfg.enabled or cfg.workspace_id is null then raise exception 'booking_unavailable';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.starts_at,q.id),'[]') into rows from(
 select s.* from zoi.booking_slots s join zoi.booking_services v on v.id=s.service_id join zoi.booking_resources r on r.id=s.resource_id
 where s.workspace_id=b.workspace_id and s.service_id=original.service_id and s.id<>original.id and s.active and v.active and r.active and s.capacity>=b.party_size and r.kind=(select kind from zoi.booking_resources where id=original.resource_id)
 and s.starts_at>=greatest(p_from,clock_timestamp()+interval '5 minutes') and s.starts_at<p_to
 and not exists(select 1 from zoi.bookings taken where taken.slot_id=s.id and taken.status<>'cancelled')
 order by s.starts_at,s.id limit 201)q;
 more:=jsonb_array_length(rows)>200;if more then rows:=rows-200;end if;
 return jsonb_build_object('ok',true,'booking_id',b.id,'booking_version',b.version,'party_size',b.party_size,'workspace_id',b.workspace_id,'timezone',cfg.timezone,'original',to_jsonb(original),'slots',rows,'truncated',more);
end $function$
;
CREATE OR REPLACE FUNCTION public.booking_create(p_slot uuid, p_request_id uuid, p_name text, p_email text, p_party_size integer, p_expected_slot_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare current_authority jsonb;actor uuid;b zoi.bookings;slot zoi.booking_slots;rid uuid;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;current_authority:=zoi.booking_customer_authority(NULL,true);actor:=(current_authority->>'actor')::uuid;
 if p_request_id is null or length(btrim(coalesce(p_name,''))) not between 1 and 120 or length(coalesce(p_email,''))>160 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_email is null or p_party_size is null then raise exception 'invalid_booking_details';end if;
 -- Profile lock also serializes idempotency keys across different slot requests.
 perform 1 from zoi.user_profiles where id=actor for update;
 select * into b from zoi.bookings where profile_id=actor and request_id=p_request_id;
 if b.id is not null then
  if b.slot_id<>p_slot or b.party_size<>p_party_size then raise exception 'request_id_conflict';end if;
  return jsonb_build_object('ok',true,'booking',to_jsonb(b));
 end if;
 select resource_id into rid from zoi.booking_slots where id=p_slot;
 perform 1 from zoi.booking_resources where id=rid for update;
 select * into slot from zoi.booking_slots where id=p_slot for update;
 if slot.id is null or not slot.active or slot.starts_at<=clock_timestamp()+interval '5 minutes' then raise exception 'slot_unavailable';end if;
 if slot.version is distinct from p_expected_slot_version then raise exception 'slot_version_conflict';end if;
 if not exists(select 1 from zoi.booking_settings c join zoi.listings l on l.id=c.listing_id where c.workspace_id=slot.workspace_id and l.owner_workspace_id=c.workspace_id and c.enabled and l.publish_status='published' and l.moderation_status in('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden') or not exists(select 1 from zoi.booking_resources where id=slot.resource_id and active) or not exists(select 1 from zoi.booking_services where id=slot.service_id and active) then raise exception 'booking_unavailable';end if;
 if p_party_size<1 or p_party_size>slot.capacity then raise exception 'party_exceeds_capacity';end if;
 if exists(select 1 from zoi.bookings where slot_id=slot.id and status<>'cancelled') then raise exception 'slot_unavailable';end if;
 insert into zoi.bookings(workspace_id,slot_id,profile_id,request_id,customer_name,customer_email,party_size) values(slot.workspace_id,slot.id,actor,p_request_id,btrim(p_name),btrim(p_email),p_party_size) returning * into b;
 insert into zoi.booking_audit(workspace_id,booking_id,actor_profile_id,action,before_status,after_status,booking_version) values(b.workspace_id,b.id,actor,'created',null,b.status,b.version);
 return jsonb_build_object('ok',true,'booking',to_jsonb(b));
end $function$
;
CREATE OR REPLACE FUNCTION public.booking_status_set(p_booking uuid, p_expected_version integer, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare current_authority jsonb;actor uuid;b zoi.bookings;slot zoi.booking_slots;operator boolean;rid uuid;previous_status text;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;current_authority:=zoi.booking_customer_authority(p_booking,false);actor:=(current_authority->>'actor')::uuid;
 select * into b from zoi.bookings where id=p_booking;
 if b.id is null then raise exception 'booking_unavailable';end if;
 operator:=coalesce((current_authority->>'operator')::boolean,false);
 if not operator and b.profile_id<>actor then raise exception 'booking_not_owned' using errcode='42501';end if;
 select resource_id into rid from zoi.booking_slots where id=b.slot_id;
 perform 1 from zoi.booking_resources where id=rid for update;
 select * into slot from zoi.booking_slots where id=b.slot_id for update;
 select * into b from zoi.bookings where id=p_booking for update;
 if p_status not in ('cancelled','completed','no_show') or p_status is null or (not operator and p_status<>'cancelled') then raise exception 'booking_status_not_allowed';end if;
 if b.status=p_status then return jsonb_build_object('ok',true,'booking',to_jsonb(b));end if;
 if b.version is distinct from p_expected_version then raise exception 'version_conflict';end if;
 if b.status<>'confirmed' then raise exception 'booking_status_final';end if;
 if not operator and slot.starts_at<=clock_timestamp() then raise exception 'booking_already_started';end if;
 if p_status in ('completed','no_show') and slot.starts_at>clock_timestamp() then raise exception 'booking_not_started';end if;
 previous_status:=b.status;
 update zoi.bookings set status=p_status,version=version+1,updated_at=clock_timestamp() where id=b.id returning * into b;
 insert into zoi.booking_audit(workspace_id,booking_id,actor_profile_id,action,before_status,after_status,booking_version) values(b.workspace_id,b.id,actor,'status_changed',previous_status,b.status,b.version);
 return jsonb_build_object('ok',true,'booking',to_jsonb(b));
end $function$
;
CREATE OR REPLACE FUNCTION public.booking_my_list(p_listing uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare current_authority jsonb;actor uuid;rows jsonb;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;current_authority:=zoi.booking_customer_authority(NULL,false);actor:=(current_authority->>'actor')::uuid;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]') into rows from(select b.*,s.starts_at,s.ends_at,s.service_name,s.resource_name,s.price_cents,s.currency,c.timezone from zoi.bookings b join zoi.booking_slots s on s.id=b.slot_id join zoi.booking_settings c on c.workspace_id=b.workspace_id where b.profile_id=actor and c.listing_id=p_listing order by b.created_at desc limit 100)q;
 return jsonb_build_object('ok',true,'bookings',rows);
end $function$
;
CREATE OR REPLACE FUNCTION public.booking_reschedule_history(p_booking uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare current_authority jsonb;actor uuid;b zoi.bookings;rows jsonb;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;current_authority:=zoi.booking_customer_authority(p_booking,false);actor:=(current_authority->>'actor')::uuid;if actor is null then raise exception 'sign_in_required' using errcode='42501';end if;
 select * into b from zoi.bookings where id=p_booking;
 if b.id is null or (b.profile_id<>actor and not coalesce((current_authority->>'operator')::boolean,false)) then raise exception 'booking_not_owned' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]') into rows from(select id,actor_profile_id,from_slot_id,to_slot_id,before_version,after_version,old_slot,new_slot,created_at from zoi.booking_reschedules where booking_id=b.id order by created_at desc limit 100)q;
 return jsonb_build_object('ok',true,'booking_id',b.id,'changes',rows);
end $function$
;
NOTIFY pgrst,'reload schema';
COMMIT;
