-- The other half of the claim funnel was broken the same way.
--
-- zoi_resolve_claim — the admin's approve/reject — sets claim_status='approved'
-- or 'rejected'. The constraint on zoi.listing_claims allows claim_pending,
-- claimed, claim_rejected, ownership_disputed, transferred. So even a real admin
-- pressing approve would have hit check constraint 23514.
--
-- Both ends of the funnel spoke a vocabulary the table stopped accepting: submit
-- (fixed in 0017) and resolve (here). Nobody could claim a business, and nobody
-- could have approved it if they had.
--
-- Everything else is preserved: the admin gate, the ownership transfer onto the
-- listing, the decision note and the audit fields.

BEGIN;

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
END$function$;

COMMIT;
