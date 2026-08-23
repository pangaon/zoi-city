-- SECURITY: thirteen privileged functions were granted to PUBLIC.
--
-- anon inherits PUBLIC, and the anon key is published in every page's source by
-- design. So anyone could call all of these with a key copied out of the HTML:
--
--   READ
--     zoi_admin_dashboard   1.28 MB, verified: 3,000 directory rows, the
--                           200-item moderation queue, the 105-source ingestion
--                           registry, 46 email addresses
--     zoi_admin_inbox       operator inbox
--     zoi_admin_claims      every claim, with the claimant's name/email/phone
--
--   WRITE — worse, because these change state
--     zoi_claim_set         set any claim to any status
--     zoi_resolve_claim     approve or reject any claim
--     zoi_claim_entity      assign ownership of any listing to any workspace
--     zoi_ingest_entity     insert arbitrary listings into the directory
--     zoi_lead_set          modify leads
--     zoi_review_hide       hide any review
--
-- Chained, that is: claim someone else's business, approve your own claim, and
-- you own their page. This is the most serious thing in the codebase.
--
-- Deliberately still public, because they are meant to be — a visitor asking for
-- something is not the same as a visitor deciding it:
--   zoi_submit_claim     requests a claim (a request, reviewed by a human)
--   zoi_submit_review    submits a review (moderated)
--   zoi_listing_reviews  reads published reviews
--
-- KNOWN BREAKAGE, accepted: /apps/command-center calls the three admin reads and
-- four of the writes with the anon key, behind a client-side passphrase gate
-- whose hash is the SHA-256 of "change me before launch". It will stop working.
-- A prototype losing its data is the correct trade against a world-readable
-- admin dashboard and a world-writable claims table.

BEGIN;

DO $$
DECLARE
  f record;
  -- read-only admin surfaces: staff only
  admin_read text[] := ARRAY['zoi_admin_dashboard','zoi_admin_inbox','zoi_admin_claims'];
  -- state changers: staff only
  admin_write text[] := ARRAY['zoi_claim_set','zoi_resolve_claim','zoi_lead_set','zoi_review_hide'];
  -- machine only: the ingestion worker uses the service role
  machine text[] := ARRAY['zoi_ingest_entity'];
  -- a signed-in owner may claim; an anonymous visitor may not
  signed_in text[] := ARRAY['zoi_claim_entity','zoi_my_claims'];
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure::text AS sig, p.proname
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = ANY (admin_read || admin_write || machine || signed_in)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f.sig);
    IF f.proname = ANY (signed_in) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    ELSE
      -- admin and machine surfaces: service role only. When staff tooling is
      -- rebuilt it should authenticate and check a role, not rely on a grant.
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
    RAISE NOTICE 'locked %', f.sig;
  END LOOP;
END $$;

COMMIT;

-- Verify: this should return no rows.
--   SELECT p.proname, g.grantee
--     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--     JOIN information_schema.role_routine_grants g
--          ON g.routine_name=p.proname AND g.routine_schema=n.nspname
--    WHERE n.nspname='public' AND g.grantee IN ('PUBLIC','anon')
--      AND p.proname IN ('zoi_admin_dashboard','zoi_admin_inbox','zoi_admin_claims',
--                        'zoi_claim_set','zoi_resolve_claim','zoi_lead_set',
--                        'zoi_review_hide','zoi_ingest_entity','zoi_claim_entity');
