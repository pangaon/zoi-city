-- Preserve venue management's owner/admin policy while reusing the existing
-- current-session/workspace foundation. No booking or venue writer signature changes.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$BEGIN
 IF(SELECT md5(prosrc)FROM pg_proc WHERE oid='zoi.venue_require_member(uuid,boolean)'::regprocedure)IS DISTINCT FROM'1f5ff6ca087ccb437798f8011242b65d'OR(SELECT proowner::regrole::text FROM pg_proc WHERE oid='zoi.venue_require_member(uuid,boolean)'::regprocedure)IS DISTINCT FROM'postgres'OR(SELECT proacl::text FROM pg_proc WHERE oid='zoi.venue_require_member(uuid,boolean)'::regprocedure)IS DISTINCT FROM'{postgres=X/postgres}'THEN RAISE EXCEPTION 'venue_member_definition_or_acl_changed';END IF;
 IF(SELECT md5(prosrc)FROM pg_proc WHERE oid='public.booking_operator_list(uuid,timestamptz,timestamptz)'::regprocedure)IS DISTINCT FROM'4c4ff17fee2130740905717d06f9a012'OR(SELECT proowner::regrole::text FROM pg_proc WHERE oid='public.booking_operator_list(uuid,timestamptz,timestamptz)'::regprocedure)IS DISTINCT FROM'postgres'OR(SELECT proacl::text FROM pg_proc WHERE oid='public.booking_operator_list(uuid,timestamptz,timestamptz)'::regprocedure)IS DISTINCT FROM'{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'THEN RAISE EXCEPTION 'booking_operator_definition_or_acl_changed';END IF;
 IF to_regprocedure('zoi.workspace_locked_role(uuid)')IS NULL THEN RAISE EXCEPTION 'current_workspace_authority_not_installed';END IF;
END$$;
CREATE OR REPLACE FUNCTION zoi.venue_require_member(p_workspace uuid,p_manage boolean DEFAULT false)RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;member_role text;
BEGIN
 IF auth.uid()IS NULL THEN RAISE EXCEPTION 'sign_in_required' USING ERRCODE='42501';END IF;
 -- Foundation locks workspace, membership and active account/session first.
 PERFORM zoi.workspace_locked_role(p_workspace);
 SELECT id INTO actor FROM zoi.user_profiles WHERE auth_user_id=auth.uid()FOR SHARE;
 -- Recheck while the current profile is stable; never return an actor different
 -- from the identity whose current workspace permission was validated.
 member_role:=zoi.workspace_locked_role(p_workspace);
 IF actor IS NULL OR(p_manage AND member_role NOT IN('owner','admin'))THEN RAISE EXCEPTION 'workspace_permission_denied' USING ERRCODE='42501';END IF;
 RETURN actor;
END$$;
REVOKE ALL ON FUNCTION zoi.venue_require_member(uuid,boolean)FROM PUBLIC,anon,authenticated,service_role;
create or replace function public.booking_operator_list(p_workspace uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;role text;result jsonb;
begin
 actor:=zoi.venue_require_member(p_workspace,true);
 role:=zoi.workspace_locked_role(p_workspace);
 if role not in ('owner','admin') then raise exception 'workspace_permission_denied' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '31 days' then raise exception 'invalid_date_range';end if;
 select jsonb_build_object('ok',true,'role',role,'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]') from (select * from zoi.booking_audit where workspace_id=p_workspace order by created_at desc limit 100) a),'settings',(select to_jsonb(c) from zoi.booking_settings c where workspace_id=p_workspace),'listings',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]') from zoi.listings where owner_workspace_id=p_workspace and publish_status='published' and coalesce(marketplace_status,'')<>'hidden'),'services',(select coalesce(jsonb_agg(to_jsonb(s) order by s.name),'[]') from zoi.booking_services s where workspace_id=p_workspace),'resources',(select coalesce(jsonb_agg(to_jsonb(r) order by r.name),'[]') from zoi.booking_resources r where workspace_id=p_workspace),'slots',(select coalesce(jsonb_agg(to_jsonb(s) order by s.starts_at),'[]') from zoi.booking_slots s where workspace_id=p_workspace and starts_at>=p_from and starts_at<p_to),'bookings',(select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at desc),'[]') from zoi.bookings b join zoi.booking_slots s on s.id=b.slot_id where b.workspace_id=p_workspace and s.starts_at>=p_from and s.starts_at<p_to)) into result;
 return result;
end $$;

REVOKE ALL ON FUNCTION public.booking_operator_list(uuid,timestamptz,timestamptz)FROM PUBLIC,anon;
NOTIFY pgrst,'reload schema';
COMMIT;
