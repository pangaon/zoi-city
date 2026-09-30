-- Existing plan writer acceptance only. No inventory, business, hold or payment writes.
BEGIN;
SET LOCAL request.jwt.claim.sub='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
DO $$
DECLARE actor uuid;nonce uuid:=gen_random_uuid();data jsonb;r jsonb;r2 jsonb;id uuid;
BEGIN
 SELECT p.id INTO actor FROM zoi.user_profiles p WHERE p.auth_user_id=auth.uid();IF actor IS DISTINCT FROM '21a04e78-e3b1-448e-8517-47aad25dd5da'::uuid THEN RAISE EXCEPTION 'dedicated_qa_profile_required';END IF;
 data:=jsonb_build_object('title','Private Signature QA rollback','kind','other','timezone','America/Toronto','customer_name','Zoi QA','customer_email','qa@example.test','private_notes','QA fixture only; preferred table1; no booking or payment requested.','selections','[]'::jsonb);
 r:=public.event_plan_save(null,0,nonce,data);id:=(r#>>'{plan,id}')::uuid;
 IF r->>'ok' IS DISTINCT FROM 'true' OR id IS NULL OR r#>>'{plan,profile_id}' IS DISTINCT FROM actor::text OR r#>>'{plan,status}' IS DISTINCT FROM 'draft' OR r#>>'{plan,version}' IS DISTINCT FROM '1' OR r#>'{plan,data}' IS DISTINCT FROM data THEN RAISE EXCEPTION 'private_plan_receipt_invalid';END IF;
 r2:=public.event_plan_save(null,0,nonce,data);IF r2 IS DISTINCT FROM r THEN RAISE EXCEPTION 'private_plan_retry_invalid';END IF;
 IF public.event_plan_get(id)#>'{plan,data}' IS DISTINCT FROM data THEN RAISE EXCEPTION 'private_plan_readback_invalid';END IF;
 IF public.event_plan_get(id)->'bookings' IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION 'unexpected_booking';END IF;
END $$;
SELECT 'signature_private_plan_rollback_checks_passed' AS result;
ROLLBACK;
