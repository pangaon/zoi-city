-- zoi_claim_entity has never once succeeded.
--
-- Found by walking the funnel end to end with a real throwaway account. Every
-- call fails on check constraint 23514, because the function was written against
-- an earlier vocabulary than the table now enforces. Five values are wrong:
--
--   inserted                          listing_claims allows
--   claim_type  'ownership'           business_owner | professional | church_admin
--                                     | org_admin | event_organizer | vendor
--   claim_status 'pending'            claim_pending | claimed | claim_rejected
--                                     | ownership_disputed | transferred
--   verification_method 'owner_request'  email_domain | phone | website | document
--                                     | manual_admin | partner | commerce_account
--                                     | organizer_history | official_source
--
-- and two more in the branches that never got the chance to run:
--   the already-claimed guard looked for claim_status IN ('approved','verified'),
--   neither of which is a legal value, so it could never fire; and the
--   auto-approve path set claim_status='approved', which the constraint rejects.
--
-- That is why the admin dashboard reports claimed_listings: 0. Not "nobody has
-- tried" — nobody has ever been able to.
--
-- Everything else in the function was correct and is preserved verbatim,
-- including the domain-match auto-approval and its public-mailbox exclusion.

BEGIN;

CREATE OR REPLACE FUNCTION public.zoi_claim_entity(p_slug text, p_workspace uuid, p_method text DEFAULT NULL)
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
END$function$;

COMMIT;
