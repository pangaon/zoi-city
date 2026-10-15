BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='zoi.booking_customer_authority(uuid,boolean)'::regprocedure AND md5(prosrc)='4cb672435bc1603742d596e78369ff55' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""'])THEN RAISE EXCEPTION 'event_planner_customer_authority_drift';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.event_plan_capabilities()'::regprocedure AND md5(prosrc)='63f92dcf42589bcfeefc2da544b4b1db' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""'])THEN RAISE EXCEPTION 'event_planner_definition_drift:event_plan_capabilities';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.event_plan_get(uuid)'::regprocedure AND md5(prosrc)='c85d981411e57ef619a628dee5f3ddc9' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""'])THEN RAISE EXCEPTION 'event_planner_definition_drift:event_plan_get';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.event_plan_list(integer)'::regprocedure AND md5(prosrc)='d84f9c07aa0072b8cadf2b35aa0493cd' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""'])THEN RAISE EXCEPTION 'event_planner_definition_drift:event_plan_list';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.event_plan_provider_context(uuid)'::regprocedure AND md5(prosrc)='fd7142fcc481535f4601d301642b9573' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""'])THEN RAISE EXCEPTION 'event_planner_definition_drift:event_plan_provider_context';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.event_plan_save(uuid, integer, uuid, jsonb)'::regprocedure AND md5(prosrc)='118438a49166de3dbab2a8c10988071d' AND pg_get_userbyid(proowner)='postgres' AND proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""'])THEN RAISE EXCEPTION 'event_planner_definition_drift:event_plan_save';END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public.event_plan_capabilities()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin PERFORM zoi.booking_customer_authority(NULL,false);return jsonb_build_object('ok',true,'version',1,'resource_kinds',jsonb_build_array('staff','table','venue','performer','equipment'));end $function$
;
CREATE OR REPLACE FUNCTION public.event_plan_get(p_plan uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare current_authority jsonb;actor uuid;plan zoi.event_plans;rows jsonb;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;current_authority:=zoi.booking_customer_authority(NULL,false);actor:=(current_authority->>'actor')::uuid;
 select * into plan from zoi.event_plans where id=p_plan and profile_id=actor;
 if plan.id is null then raise exception 'event_plan_not_owned' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('booking',to_jsonb(b),'slot',to_jsonb(s),'role',p.role,'shared_context',p.shared_context,'listing_id',c.listing_id,'timezone',c.timezone,'reviewed_slot',p.reviewed_slot) order by s.starts_at,b.id),'[]') into rows from zoi.event_plan_bookings p join zoi.bookings b on b.id=p.booking_id join zoi.booking_slots s on s.id=b.slot_id join zoi.booking_settings c on c.workspace_id=b.workspace_id where p.plan_id=plan.id;
 return jsonb_build_object('ok',true,'plan',to_jsonb(plan),'bookings',rows);
end $function$
;
CREATE OR REPLACE FUNCTION public.event_plan_list(p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare current_authority jsonb;actor uuid;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;current_authority:=zoi.booking_customer_authority(NULL,false);actor:=(current_authority->>'actor')::uuid;if actor is null then raise exception 'sign_in_required' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'invalid_offset';end if;
 return jsonb_build_object('ok',true,'offset',p_offset,'plans',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',data->>'title','kind',data->>'kind','status',status,'version',version,'updated_at',updated_at) order by created_at desc,id desc),'[]') from(select * from zoi.event_plans where profile_id=actor order by created_at desc,id desc limit 51 offset p_offset)p));
end $function$
;
CREATE OR REPLACE FUNCTION public.event_plan_provider_context(p_booking uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare current_authority jsonb;actor uuid;b zoi.bookings;context zoi.event_plan_bookings;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;current_authority:=zoi.booking_customer_authority(p_booking,false);actor:=(current_authority->>'actor')::uuid;
 select * into b from zoi.bookings where id=p_booking;
 if b.id is null or not coalesce((current_authority->>'operator')::boolean,false) then raise exception 'workspace_permission_denied' using errcode='42501';end if;
 select * into context from zoi.event_plan_bookings where booking_id=b.id;
 return jsonb_build_object('ok',true,'booking_id',b.id,'context',case when context.booking_id is not null then jsonb_build_object('role',context.role,'shared_context',context.shared_context) else null end);
end $function$
;
CREATE OR REPLACE FUNCTION public.event_plan_save(p_plan uuid, p_expected_version integer, p_request_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare current_authority jsonb;actor uuid;plan zoi.event_plans;prior zoi.event_plan_requests;payload jsonb;receipt jsonb;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;current_authority:=zoi.booking_customer_authority(NULL,true);actor:=(current_authority->>'actor')::uuid;if actor is null then raise exception 'sign_in_required' using errcode='42501';end if;
 if p_request_id is null then raise exception 'request_id_required';end if;
 perform 1 from zoi.user_profiles where id=actor for update;
 payload:=jsonb_build_object('plan',p_plan,'version',p_expected_version,'data',p_data);
 select * into prior from zoi.event_plan_requests where profile_id=actor and request_id=p_request_id;
 if prior.id is not null then if prior.operation<>'save' or prior.payload is distinct from payload then raise exception 'request_id_conflict';end if;return prior.receipt;end if;
 perform zoi.event_plan_validate(p_data);
 if p_plan is null then
  if p_expected_version is distinct from 0 then raise exception 'version_conflict';end if;
  insert into zoi.event_plans(profile_id,data) values(actor,p_data) returning * into plan;
 else
  select * into plan from zoi.event_plans where id=p_plan and profile_id=actor for update;
  if plan.id is null then raise exception 'event_plan_not_owned' using errcode='42501';end if;
  if plan.version is distinct from p_expected_version then raise exception 'version_conflict';end if;
  if plan.status<>'draft' then raise exception 'event_plan_already_confirmed';end if;
  update zoi.event_plans set data=p_data,version=version+1,updated_at=clock_timestamp() where id=p_plan returning * into plan;
 end if;
 receipt:=jsonb_build_object('ok',true,'plan',to_jsonb(plan));
 insert into zoi.event_plan_requests(profile_id,request_id,operation,payload,receipt) values(actor,p_request_id,'save',payload,receipt);
 return receipt;
end $function$
;
NOTIFY pgrst,'reload schema';
COMMIT;
