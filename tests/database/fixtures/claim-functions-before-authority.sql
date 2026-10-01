-- ACL {postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}
CREATE OR REPLACE FUNCTION public.zoi_claim_entity(p_slug text, p_workspace uuid, p_method text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_prof uuid; v_role text; v_listing uuid; v_email text; v_claim uuid;
        v_cdom text; v_web text; v_edom text; v_public boolean;
        v_etype text; v_ctype text; v_method text;
BEGIN
  -- Create the profile rather than refuse: the same missing row that blocked
  -- workspace creation would block this the moment the order of steps changed.
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_authenticated'); END IF;

  SELECT role INTO v_role FROM zoi.workspace_members WHERE workspace_id = p_workspace AND profile_id = v_prof;
  IF v_role IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_workspace_member'); END IF;

  SELECT id, entity_type INTO v_listing, v_etype FROM zoi.listings WHERE slug = p_slug LIMIT 1;
  IF v_listing IS NULL THEN RETURN json_build_object('ok', false, 'error', 'entity_not_found'); END IF;

  -- 'claimed' is the settled state. The old guard looked for 'approved' and
  -- 'verified', which are not legal values, so it never fired — meaning a
  -- listing could be claimed twice.
  IF EXISTS (SELECT 1 FROM zoi.listing_claims
              WHERE listing_id = v_listing AND claim_status = 'claimed') THEN
    RETURN json_build_object('ok', false, 'error', 'already_claimed');
  END IF;
  -- Nor should someone queue a second request behind their own.
  IF EXISTS (SELECT 1 FROM zoi.listing_claims
              WHERE listing_id = v_listing AND workspace_id = p_workspace
                AND claim_status = 'claim_pending') THEN
    RETURN json_build_object('ok', true, 'status', 'claim_pending',
      'message', 'You have already asked for this one. We are still reviewing it.');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  -- claim_type describes WHO is claiming, so derive it from what the listing is.
  v_ctype := CASE
    WHEN v_etype = 'church'        THEN 'church_admin'
    WHEN v_etype = 'organization'  THEN 'org_admin'
    WHEN v_etype = 'school'        THEN 'org_admin'
    WHEN v_etype = 'professional'  THEN 'professional'
    WHEN v_etype = 'event'         THEN 'event_organizer'
    WHEN v_etype = 'vendor'        THEN 'vendor'
    ELSE 'business_owner'
  END;

  -- Accept a caller-supplied method only if the constraint would accept it too;
  -- otherwise this is a request for a human to review.
  v_method := CASE
    WHEN p_method IN ('email_domain','phone','website','document','manual_admin',
                      'partner','commerce_account','organizer_history','official_source')
      THEN p_method
    ELSE 'manual_admin'
  END;

  INSERT INTO zoi.listing_claims(listing_id, claimant_user_id, claimant_email, claim_type,
                                 claim_status, verification_method, workspace_id, submitted_at)
  VALUES (v_listing, auth.uid(), v_email, v_ctype, 'claim_pending', v_method, p_workspace, now())
  RETURNING id INTO v_claim;

  -- Auto-approval on a matching domain, unchanged in intent: a free mailbox
  -- proves nothing, so those never auto-approve.
  v_cdom := lower(split_part(coalesce(v_email,''), '@', 2));
  v_public := v_cdom = ANY (ARRAY['gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com',
                                  'aol.com','proton.me','protonmail.com','live.com','msn.com','me.com']);
  SELECT lower(regexp_replace(coalesce(website,''), '^https?://(www\.)?([^/]+).*$', '\2')),
         lower(split_part(coalesce(email,''), '@', 2))
    INTO v_web, v_edom FROM zoi.listings WHERE id = v_listing;

  IF NOT v_public AND v_cdom <> '' AND (v_cdom = v_web OR v_cdom = v_edom) THEN
    UPDATE zoi.listing_claims
       SET claim_status = 'claimed', verification_method = 'email_domain',
           verify_channel = 'email_domain_match', verified_at = now(),
           resolved_at = now(), resolved_by = 'auto:domain_match'
     WHERE id = v_claim;
    UPDATE zoi.listings
       SET owner_workspace_id = p_workspace, owner_user_id = auth.uid(),
           claim_status = 'claimed', verification_status = 'owner_verified'
     WHERE id = v_listing;
    RETURN json_build_object('ok', true, 'claim_id', v_claim, 'status', 'claimed',
      'method', 'domain_match',
      'message', 'Verified automatically — your email is at this business''s domain.');
  END IF;

  RETURN json_build_object('ok', true, 'claim_id', v_claim, 'status', 'claim_pending',
    'method', 'admin_review',
    'message', 'Claim submitted for review. We verify ownership before granting access.');
END$function$

-- ACL {postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}
CREATE OR REPLACE FUNCTION public.zoi_my_claims()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT coalesce((SELECT json_agg(json_build_object('claim_id', c.id, 'name', l.name, 'slug', l.slug,
      'status', c.claim_status, 'method', c.verify_channel, 'submitted_at', c.submitted_at) ORDER BY c.submitted_at DESC)
    FROM zoi.listing_claims c JOIN zoi.listings l ON l.id = c.listing_id
    WHERE c.claimant_user_id = auth.uid()), '[]'::json);
$function$

-- ACL {postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.zoi_resolve_claim(p_claim uuid, p_decision text, p_note text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_listing uuid; v_ws uuid; v_owner uuid; v_admin text; v_status text;
BEGIN
  IF NOT zoi.is_admin() THEN RETURN json_build_object('ok', false, 'error', 'not_admin'); END IF;
  SELECT listing_id, workspace_id, claimant_user_id, claim_status
    INTO v_listing, v_ws, v_owner, v_status
    FROM zoi.listing_claims WHERE id = p_claim;
  IF v_listing IS NULL THEN RETURN json_build_object('ok', false, 'error', 'claim_not_found'); END IF;
  -- Deciding an already-decided claim would silently re-transfer ownership.
  IF v_status <> 'claim_pending' THEN
    RETURN json_build_object('ok', false, 'error', 'already_resolved', 'status', v_status);
  END IF;
  SELECT email INTO v_admin FROM auth.users WHERE id = auth.uid();

  IF lower(coalesce(p_decision,'')) IN ('approve','approved','accept') THEN
    UPDATE zoi.listing_claims
       SET claim_status = 'claimed',            -- was 'approved', which the constraint rejects
           verify_channel = 'admin_review', verified_at = now(), resolved_at = now(),
           resolved_by = v_admin, decision_note = p_note
     WHERE id = p_claim;
    UPDATE zoi.listings
       SET owner_workspace_id = v_ws, owner_user_id = v_owner,
           claim_status = 'claimed', verification_status = 'owner_verified'
     WHERE id = v_listing;
    RETURN json_build_object('ok', true, 'status', 'claimed');
  ELSE
    UPDATE zoi.listing_claims
       SET claim_status = 'claim_rejected',     -- was 'rejected'
           resolved_at = now(), resolved_by = v_admin, decision_note = p_note
     WHERE id = p_claim;
    RETURN json_build_object('ok', true, 'status', 'claim_rejected');
  END IF;
END$function$
