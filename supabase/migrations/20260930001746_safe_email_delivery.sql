-- Additive email consent + transactional outbox. Live columns, constraints and
-- membership/email RPC contracts reviewed read-only on 2026-09-30.
-- No legacy audience row is presumed to have marketing consent.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE zoi.email_subscriptions (
 workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id) ON DELETE CASCADE,
 email text NOT NULL CHECK(email=lower(btrim(email)) AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
 name text NOT NULL DEFAULT '', tags text[] NOT NULL DEFAULT '{}',
 status text NOT NULL CHECK(status IN ('subscribed','unsubscribed','bounced','complained')),
 consent_source text NOT NULL, consented_at timestamptz NOT NULL,
 recorded_by uuid, unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(workspace_id,email)
);
CREATE TABLE zoi.email_delivery_runs (
 campaign_id uuid PRIMARY KEY REFERENCES zoi.email_campaigns(id) ON DELETE RESTRICT,
 workspace_id uuid NOT NULL REFERENCES zoi.workspaces(id) ON DELETE CASCADE,
 sender text NOT NULL, subject text NOT NULL, body text NOT NULL, from_name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE zoi.email_delivery_recipients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id uuid NOT NULL REFERENCES zoi.email_delivery_runs(campaign_id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL,
 email text NOT NULL, name text NOT NULL, unsubscribe_token uuid NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','in_flight','accepted','failed','suppressed','uncertain')),
 provider_id text, provider_payload jsonb, attempts integer NOT NULL DEFAULT 0,
 first_attempt_at timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid, lease_until timestamptz, last_error text,
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(campaign_id,email)
);
CREATE INDEX email_delivery_recipients_pending_idx ON zoi.email_delivery_recipients(campaign_id,next_attempt_at) WHERE state IN ('pending','in_flight');
ALTER TABLE zoi.email_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.email_delivery_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoi.email_delivery_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.email_subscriptions,zoi.email_delivery_runs,zoi.email_delivery_recipients FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.email_delivery_authorize_sender(p_workspace uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM zoi.workspace_members m JOIN zoi.user_profiles p ON p.id=m.profile_id WHERE m.workspace_id=p_workspace AND p.auth_user_id=auth.uid() AND m.role IN ('owner','admin','editor')) THEN RAISE EXCEPTION 'not_authorized'; END IF;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.email_delivery_authorize_sender(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.email_delivery_authorize_sender(uuid) TO authenticated;

CREATE FUNCTION public.email_consent_record(p_workspace uuid,p_email text,p_name text,p_tags text[],p_source text,p_consented_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(zoi.is_ws_member(p_workspace),false) THEN RAISE EXCEPTION 'not_authorized'; END IF;
 IF NOT EXISTS (SELECT 1 FROM zoi.workspace_members m JOIN zoi.user_profiles p ON p.id=m.profile_id WHERE m.workspace_id=p_workspace AND p.auth_user_id=auth.uid() AND m.role IN ('owner','admin','editor')) THEN RAISE EXCEPTION 'insufficient_permission'; END IF;
 IF length(COALESCE(p_email,''))>254 OR length(COALESCE(p_name,''))>200 OR length(COALESCE(p_source,''))>2000 OR cardinality(COALESCE(p_tags,'{}'))>50 OR EXISTS(SELECT 1 FROM unnest(p_tags) tag WHERE length(tag)>100) THEN RAISE EXCEPTION 'consent_field_too_large'; END IF;
 IF length(btrim(COALESCE(p_source,''))) < 8 OR p_consented_at IS NULL OR p_consented_at > now() THEN RAISE EXCEPTION 'consent_evidence_required'; END IF;
 INSERT INTO zoi.email_subscriptions(workspace_id,email,name,tags,status,consent_source,consented_at,recorded_by)
 VALUES(p_workspace,lower(btrim(p_email)),COALESCE(p_name,''),COALESCE(p_tags,'{}'),'subscribed',btrim(p_source),p_consented_at,auth.uid())
 ON CONFLICT(workspace_id,email) DO UPDATE SET name=EXCLUDED.name,tags=EXCLUDED.tags,
   consent_source=EXCLUDED.consent_source,consented_at=EXCLUDED.consented_at,recorded_by=EXCLUDED.recorded_by,updated_at=now()
 WHERE zoi.email_subscriptions.status='subscribed';
 IF NOT FOUND THEN RAISE EXCEPTION 'suppressed_address_cannot_be_resubscribed_by_import'; END IF;
 RETURN jsonb_build_object('ok',true);
END; $$;
REVOKE ALL ON FUNCTION public.email_consent_record(uuid,text,text,text[],text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.email_consent_record(uuid,text,text,text[],text,timestamptz) TO authenticated;

CREATE FUNCTION public.email_unsubscribe_token(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE sub zoi.email_subscriptions;
BEGIN
 UPDATE zoi.email_subscriptions SET status='unsubscribed',updated_at=now()
 WHERE unsubscribe_token=p_token RETURNING * INTO sub;
 IF FOUND THEN
   UPDATE zoi.email_delivery_recipients SET state='suppressed',last_error='unsubscribed',updated_at=now()
   WHERE workspace_id=sub.workspace_id AND email=sub.email AND state='pending';
 END IF;
 -- Identical response for unknown tokens avoids exposing subscription existence.
 RETURN jsonb_build_object('ok',true);
END; $$;
REVOKE ALL ON FUNCTION public.email_unsubscribe_token(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_unsubscribe_token(uuid) TO service_role;

CREATE FUNCTION public.email_delivery_prepare(p_workspace uuid,p_campaign uuid,p_sender text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE campaign zoi.email_campaigns;
BEGIN
 SELECT * INTO campaign FROM zoi.email_campaigns WHERE id=p_campaign AND workspace_id=p_workspace FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'campaign_not_found'; END IF;
 IF EXISTS(SELECT 1 FROM zoi.email_delivery_runs WHERE campaign_id=p_campaign) THEN RETURN jsonb_build_object('ok',true,'existing',true); END IF;
 IF campaign.status='sent' THEN RAISE EXCEPTION 'legacy_sent_campaign_requires_review'; END IF;
 IF campaign.status NOT IN ('scheduled','sending') OR campaign.scheduled_at IS NULL OR campaign.scheduled_at>now() THEN RAISE EXCEPTION 'campaign_not_due'; END IF;
 IF COALESCE(btrim(campaign.subject),'')='' OR COALESCE(btrim(campaign.body),'')='' THEN RAISE EXCEPTION 'empty_campaign'; END IF;
 INSERT INTO zoi.email_delivery_runs(campaign_id,workspace_id,sender,subject,body,from_name)
 VALUES(p_campaign,p_workspace,p_sender,campaign.subject,campaign.body,COALESCE(campaign.from_name,''));
 INSERT INTO zoi.email_delivery_recipients(campaign_id,workspace_id,email,name,unsubscribe_token)
 SELECT p_campaign,p_workspace,s.email,s.name,s.unsubscribe_token FROM zoi.email_subscriptions s
 WHERE s.workspace_id=p_workspace AND s.status='subscribed'
 AND (campaign.audience_tag IS NULL OR campaign.audience_tag='' OR campaign.audience_tag='all' OR campaign.audience_tag=ANY(s.tags));
 IF NOT FOUND THEN
   DELETE FROM zoi.email_delivery_runs WHERE campaign_id=p_campaign;
   UPDATE zoi.email_campaigns SET status='draft',scheduled_at=NULL WHERE id=p_campaign;
   RETURN jsonb_build_object('ok',false,'reason','no_consented_recipients','returned_to_draft',true);
 END IF;
 UPDATE zoi.email_campaigns SET status='sending' WHERE id=p_campaign;
 RETURN jsonb_build_object('ok',true,'existing',false);
END; $$;
REVOKE ALL ON FUNCTION public.email_delivery_prepare(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_delivery_prepare(uuid,uuid,text) TO service_role;

CREATE FUNCTION public.email_delivery_claim(p_campaign uuid,p_limit integer DEFAULT 25)
RETURNS TABLE(id uuid,email text,name text,unsubscribe_token uuid,lease_token uuid,sender text,subject text,body text,from_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 -- Resend remembers idempotency keys for 24h. Stop uncertain retries before
 -- that window closes, instead of risking a duplicate after key expiry.
 UPDATE zoi.email_delivery_recipients r SET state='uncertain',last_error='provider_reconciliation_required',updated_at=now()
 WHERE r.campaign_id=p_campaign AND r.state IN ('pending','in_flight')
 AND r.first_attempt_at < now()-interval '23 hours';
 UPDATE zoi.email_delivery_recipients r SET state='suppressed',last_error='subscription_suppressed',updated_at=now()
 WHERE r.campaign_id=p_campaign AND r.state IN ('pending','in_flight')
 AND (r.state='pending' OR r.lease_until<now())
 AND NOT EXISTS(SELECT 1 FROM zoi.email_subscriptions s WHERE s.workspace_id=r.workspace_id AND s.email=r.email AND s.status='subscribed');
 RETURN QUERY
 WITH candidates AS (
  SELECT r.id FROM zoi.email_delivery_recipients r WHERE r.campaign_id=p_campaign
  AND ((r.state='pending' AND r.next_attempt_at<=now()) OR (r.state='in_flight' AND r.lease_until<now()))
  ORDER BY r.next_attempt_at,r.id LIMIT greatest(least(p_limit,100),1) FOR UPDATE SKIP LOCKED
 ), claimed AS (
  UPDATE zoi.email_delivery_recipients r SET state='in_flight',lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',
    attempts=r.attempts+1,first_attempt_at=COALESCE(r.first_attempt_at,now()),updated_at=now()
  FROM candidates c WHERE r.id=c.id RETURNING r.*
 ) SELECT c.id,c.email,c.name,c.unsubscribe_token,c.lease_token,d.sender,d.subject,d.body,d.from_name
 FROM claimed c JOIN zoi.email_delivery_runs d ON d.campaign_id=c.campaign_id;
END; $$;
REVOKE ALL ON FUNCTION public.email_delivery_claim(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_delivery_claim(uuid,integer) TO service_role;

CREATE FUNCTION public.email_delivery_authorize(p_id uuid,p_lease uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE recipient zoi.email_delivery_recipients;
BEGIN
 SELECT * INTO recipient FROM zoi.email_delivery_recipients WHERE id=p_id AND lease_token=p_lease AND state='in_flight' AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.email_subscriptions s WHERE s.workspace_id=recipient.workspace_id AND s.email=recipient.email AND s.status='subscribed') THEN
  UPDATE zoi.email_delivery_recipients SET state='suppressed',last_error='subscription_suppressed',updated_at=now() WHERE id=p_id;
  RETURN false;
 END IF;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.email_delivery_authorize(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_delivery_authorize(uuid,uuid) TO service_role;

CREATE FUNCTION public.email_delivery_payload(p_id uuid,p_lease uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE payload jsonb;
BEGIN
 IF jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'invalid_payload'; END IF;
 UPDATE zoi.email_delivery_recipients SET provider_payload=COALESCE(provider_payload,p_payload)
 WHERE id=p_id AND lease_token=p_lease AND state='in_flight' AND lease_until>now()
 RETURNING provider_payload INTO payload;
 IF NOT FOUND THEN RAISE EXCEPTION 'delivery_lease_expired'; END IF;
 RETURN payload;
END; $$;
REVOKE ALL ON FUNCTION public.email_delivery_payload(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_delivery_payload(uuid,uuid,jsonb) TO service_role;

CREATE FUNCTION public.email_delivery_complete(p_id uuid,p_lease uuid,p_outcome text,p_provider_id text DEFAULT NULL,p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF p_outcome NOT IN ('accepted','failed','retry') THEN RAISE EXCEPTION 'invalid_outcome'; END IF;
 IF p_outcome='accepted' AND COALESCE(btrim(p_provider_id),'')='' THEN RAISE EXCEPTION 'provider_receipt_required'; END IF;
 UPDATE zoi.email_delivery_recipients SET state=CASE WHEN p_outcome='retry' AND attempts>=8 THEN 'uncertain' WHEN p_outcome='retry' THEN 'pending' ELSE p_outcome END,
 provider_id=p_provider_id,last_error=left(p_error,250),lease_until=NULL,lease_token=NULL,
 next_attempt_at=now()+make_interval(secs=>least(3600,60*power(2,least(attempts-1,6)))::integer),updated_at=now()
 WHERE id=p_id AND lease_token=p_lease AND state='in_flight';
 RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.email_delivery_complete(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_delivery_complete(uuid,uuid,text,text,text) TO service_role;

CREATE FUNCTION public.email_delivery_status(p_workspace uuid,p_campaign uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE counts jsonb;
BEGIN
 -- Browser access always requires membership in the requested workspace.
 IF auth.uid() IS NULL OR NOT COALESCE(zoi.is_ws_member(p_workspace),false) THEN RAISE EXCEPTION 'not_authorized'; END IF;
 SELECT jsonb_build_object('total',count(*),'accepted',count(*) FILTER(WHERE state='accepted'),
 'pending',count(*) FILTER(WHERE state IN ('pending','in_flight')),'failed',count(*) FILTER(WHERE state='failed'),
 'suppressed',count(*) FILTER(WHERE state='suppressed'),'uncertain',count(*) FILTER(WHERE state='uncertain')) INTO counts
 FROM zoi.email_delivery_recipients WHERE workspace_id=p_workspace AND campaign_id=p_campaign;
 RETURN counts;
END; $$;
REVOKE ALL ON FUNCTION public.email_delivery_status(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.email_delivery_status(uuid,uuid) TO authenticated;

CREATE FUNCTION public.email_delivery_worker_status(p_campaign uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=''
AS $$ SELECT jsonb_build_object('total',count(*),'accepted',count(*) FILTER(WHERE state='accepted'),
 'pending',count(*) FILTER(WHERE state IN ('pending','in_flight')),'failed',count(*) FILTER(WHERE state='failed'),
 'suppressed',count(*) FILTER(WHERE state='suppressed'),'uncertain',count(*) FILTER(WHERE state='uncertain'))
 FROM zoi.email_delivery_recipients WHERE campaign_id=p_campaign; $$;
REVOKE ALL ON FUNCTION public.email_delivery_worker_status(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_delivery_worker_status(uuid) TO service_role;

CREATE FUNCTION public.email_delivery_due_campaigns(p_limit integer DEFAULT 20)
RETURNS TABLE(id uuid,workspace_id uuid) LANGUAGE sql SECURITY DEFINER SET search_path=''
AS $$ SELECT d.campaign_id,d.workspace_id FROM zoi.email_delivery_runs d
 WHERE EXISTS(SELECT 1 FROM zoi.email_delivery_recipients r WHERE r.campaign_id=d.campaign_id AND
 ((r.state='pending' AND r.next_attempt_at<=now()) OR (r.state='in_flight' AND r.lease_until<now())))
 ORDER BY d.created_at LIMIT greatest(least(p_limit,100),1); $$;
REVOKE ALL ON FUNCTION public.email_delivery_due_campaigns(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_delivery_due_campaigns(integer) TO service_role;

CREATE FUNCTION public.email_delivery_finalize(p_campaign uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE summary jsonb;
BEGIN
 SELECT public.email_delivery_worker_status(p_campaign) INTO summary;
 IF (summary->>'pending')::integer=0 AND (summary->>'failed')::integer=0
 AND (summary->>'uncertain')::integer=0 AND (summary->>'accepted')::integer>0 THEN
   UPDATE zoi.email_campaigns SET status='sent',sent_at=COALESCE(sent_at,now()),recipients=(summary->>'accepted')::integer
   WHERE id=p_campaign;
   IF NOT FOUND THEN RAISE EXCEPTION 'campaign_completion_not_persisted'; END IF;
 END IF;
 RETURN summary;
END; $$;
REVOKE ALL ON FUNCTION public.email_delivery_finalize(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_delivery_finalize(uuid) TO service_role;

CREATE FUNCTION public.email_delivery_status_list(p_workspace uuid)
RETURNS TABLE(campaign_id uuid,summary jsonb) LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(zoi.is_ws_member(p_workspace),false) THEN RAISE EXCEPTION 'not_authorized'; END IF;
 RETURN QUERY SELECT r.campaign_id,jsonb_build_object('total',count(*),'accepted',count(*) FILTER(WHERE r.state='accepted'),
 'pending',count(*) FILTER(WHERE r.state IN ('pending','in_flight')),'failed',count(*) FILTER(WHERE r.state='failed'),
 'suppressed',count(*) FILTER(WHERE r.state='suppressed'),'uncertain',count(*) FILTER(WHERE r.state='uncertain'))
 FROM zoi.email_delivery_recipients r WHERE r.workspace_id=p_workspace GROUP BY r.campaign_id;
END; $$;
REVOKE ALL ON FUNCTION public.email_delivery_status_list(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.email_delivery_status_list(uuid) TO authenticated;

COMMIT;
