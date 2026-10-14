-- Captured live authority definitions, 2026-10-14. Isolated test fixture only.
CREATE OR REPLACE FUNCTION zoi.bizpage_can_edit(p_workspace uuid, p_listing uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
  SELECT EXISTS(
    SELECT 1 FROM zoi.listings l WHERE l.id=p_listing AND l.owner_workspace_id=p_workspace
    UNION ALL
    SELECT 1 FROM zoi.listing_claims c WHERE c.listing_id=p_listing AND c.workspace_id=p_workspace AND c.claim_status IN ('approved','verified')
  );
$function$;

CREATE OR REPLACE FUNCTION zoi.home_content_authorize(p_workspace uuid, p_listing uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid:=zoi.org_actor();owner_ws uuid;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'not_authorized' USING errcode='42501';END IF;
 -- Verify the current account/session before any caller can return an old receipt.
 PERFORM zoi.workspace_invitation_email(false);
 PERFORM 1 FROM zoi.user_profiles WHERE id=actor FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM zoi.user_profiles WHERE id=actor AND auth_user_id=auth.uid()) THEN RAISE EXCEPTION 'not_authorized' USING errcode='42501';END IF;
 -- The guard is VOLATILE and uses fresh statements after every existing lock wait.
 PERFORM zoi.workspace_invitation_email(false);
 PERFORM 1 FROM zoi.workspace_members WHERE workspace_id=p_workspace AND profile_id=actor AND role IN('owner','admin','editor')FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized' USING errcode='42501';END IF;
 PERFORM zoi.workspace_invitation_email(false);
 SELECT owner_workspace_id INTO owner_ws FROM zoi.listings WHERE id=p_listing FOR UPDATE;
 IF NOT FOUND OR (owner_ws IS NOT NULL AND owner_ws<>p_workspace) OR NOT zoi.bizpage_can_edit(p_workspace,p_listing)THEN RAISE EXCEPTION 'no_access_to_listing' USING errcode='42501';END IF;
 PERFORM zoi.workspace_invitation_email(false);
 IF owner_ws IS NULL THEN PERFORM 1 FROM zoi.listing_claims WHERE listing_id=p_listing AND workspace_id=p_workspace AND claim_status IN('approved','verified')FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'no_access_to_listing' USING errcode='42501';END IF;
 PERFORM zoi.workspace_invitation_email(false);END IF;
 RETURN actor;
END $function$;

CREATE OR REPLACE FUNCTION zoi.org_actor()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ SELECT id FROM zoi.user_profiles WHERE auth_user_id=auth.uid() LIMIT 1 $function$;

CREATE OR REPLACE FUNCTION zoi.workspace_invitation_email(p_lock boolean DEFAULT true)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare email text;sid text:=auth.jwt()->>'session_id';begin
 if auth.uid()is null or coalesce(sid,'')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception 'invitation_unavailable' using errcode='42501';end if;
 if p_lock then
  select lower(btrim(u.email)) into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and u.deleted_at is null and coalesce(u.is_anonymous,false)=false and(u.banned_until is null or u.banned_until<=clock_timestamp())for share;
  perform 1 from auth.sessions where id=sid::uuid and user_id=auth.uid()and(not_after is null or not_after>clock_timestamp())for share;
 else
  select lower(btrim(u.email)) into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and u.deleted_at is null and coalesce(u.is_anonymous,false)=false and(u.banned_until is null or u.banned_until<=clock_timestamp());
  perform 1 from auth.sessions where id=sid::uuid and user_id=auth.uid()and(not_after is null or not_after>clock_timestamp());
 end if;
 if not found or email is null or email='' then raise exception 'invitation_unavailable' using errcode='42501';end if;return email;
end$function$;
