BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Scope this repair to the owner-home reader; historical creation never grants access.
CREATE OR REPLACE FUNCTION public.bizpage_status(p_workspace uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;owner_id uuid;member_role text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING errcode='42501';END IF;
 SELECT id INTO actor FROM zoi.user_profiles WHERE auth_user_id=auth.uid();
 IF actor IS NULL THEN RAISE EXCEPTION 'no_access_to_workspace' USING errcode='42501';END IF;
 -- Match workspace→membership lock ordering used by organization authority writers.
 SELECT owner_profile_id INTO owner_id FROM zoi.workspaces WHERE id=p_workspace FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'no_access_to_workspace' USING errcode='42501';END IF;
 SELECT role INTO member_role FROM zoi.workspace_members WHERE workspace_id=p_workspace AND profile_id=actor FOR SHARE;
 IF owner_id IS DISTINCT FROM actor AND (member_role IS NULL OR member_role NOT IN('owner','admin','editor','viewer')) THEN
  RAISE EXCEPTION 'no_access_to_workspace' USING errcode='42501';
 END IF;
 -- Reuse the deployed current verified Auth/session guard after all authority waits.
 BEGIN PERFORM zoi.workspace_invitation_email();
 EXCEPTION WHEN insufficient_privilege THEN RAISE EXCEPTION 'verified_account_required' USING errcode='42501';END;
 RETURN jsonb_build_object('ok',true,'workspace_id',p_workspace,
  'owned',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'slug',l.slug,'city',l.city,'path',COALESCE(l.canonical_path,'/p/'||l.slug))) FROM zoi.listings l WHERE l.owner_workspace_id=p_workspace),'[]'::jsonb),
  'claims',COALESCE((SELECT jsonb_agg(jsonb_build_object('listing_id',c.listing_id,'status',c.claim_status,'name',l.name,'slug',l.slug,'submitted_at',c.submitted_at)) FROM zoi.listing_claims c JOIN zoi.listings l ON l.id=c.listing_id WHERE c.workspace_id=p_workspace),'[]'::jsonb));
END;$$;
REVOKE ALL ON FUNCTION public.bizpage_status(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bizpage_status(uuid) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
