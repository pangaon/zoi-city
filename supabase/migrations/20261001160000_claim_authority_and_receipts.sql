BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Claims are authority-changing operations. The private epoch avoids adding a
-- column to listings (which would invalidate unrelated full-row review receipts).
CREATE TABLE zoi.listing_claim_authority (
 listing_id uuid PRIMARY KEY REFERENCES zoi.listings(id) ON DELETE CASCADE,
 revision uuid NOT NULL DEFAULT gen_random_uuid()
);
ALTER TABLE zoi.listing_claim_authority ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zoi.listing_claim_authority FROM PUBLIC,anon,authenticated;
CREATE FUNCTION zoi.claim_owner_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.owner_workspace_id IS DISTINCT FROM OLD.owner_workspace_id OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
  INSERT INTO zoi.listing_claim_authority(listing_id)VALUES(NEW.id) ON CONFLICT(listing_id) DO UPDATE SET revision=gen_random_uuid();
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION zoi.claim_owner_changed() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER listing_claim_owner_epoch AFTER UPDATE OF owner_workspace_id,owner_user_id ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.claim_owner_changed();
CREATE UNIQUE INDEX listing_claim_one_settled ON zoi.listing_claims(listing_id) WHERE claim_status='claimed';
CREATE UNIQUE INDEX listing_claim_one_pending_workspace ON zoi.listing_claims(listing_id,workspace_id) WHERE claim_status='claim_pending';

CREATE FUNCTION zoi.claim_actor_email() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE mail text;sid text:=auth.jwt()->>'session_id';
BEGIN
 IF auth.uid() IS NULL OR sid IS NULL OR sid!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'THEN RETURN NULL;END IF;
 SELECT lower(btrim(u.email))INTO mail FROM auth.users u WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND NOT coalesce(u.is_anonymous,false) AND(u.banned_until IS NULL OR u.banned_until<=clock_timestamp())FOR SHARE;
 PERFORM 1 FROM auth.sessions WHERE id=sid::uuid AND user_id=auth.uid()AND(not_after IS NULL OR not_after>clock_timestamp())FOR SHARE;
 IF NOT FOUND THEN RETURN NULL;END IF;RETURN nullif(mail,'');
END $$;
REVOKE ALL ON FUNCTION zoi.claim_actor_email() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION zoi.claim_domain_matches(p_email text,p_website text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE host text;domain text;
BEGIN
 -- Root official websites only. No contact-email fallback, credentials, ports,
 -- query/fragment links, shared social/directory hosts, or personal mail providers.
 IF p_website IS NULL OR p_email IS NULL OR p_website!~*'^https?://(www\.)?[a-z0-9]([a-z0-9.-]*[a-z0-9])?/?$'THEN RETURN false;END IF;
 host:=lower(regexp_replace(p_website,'^https?://(www\.)?([^/]+)/?$','\2','i'));
 domain:=lower(split_part(p_email,'@',2));
 IF p_email!~*'^[^@[:space:]]+@[a-z0-9.-]+\.[a-z]{2,}$' OR host<>domain OR host!~'\.'THEN RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['gmail.com','googlemail.com','yahoo.com','yahoo.ca','hotmail.com','outlook.com','icloud.com','aol.com','proton.me','protonmail.com','live.com','msn.com','me.com','mail.com','gmx.com','gmx.net','yandex.com','zoho.com','facebook.com','instagram.com','youtube.com','tiktok.com','linkedin.com','x.com','twitter.com','wordpress.com','blogspot.com','wixsite.com','squarespace.com','weebly.com','godaddysites.com','sites.google.com','linktr.ee','bandsintown.com','eventbrite.com'])x(domain)WHERE host=x.domain OR host LIKE '%.'||x.domain)THEN RETURN false;END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION zoi.claim_domain_matches(text,text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION zoi.claim_context(p_listing uuid,p_workspace uuid,p_profile uuid,p_actor uuid)RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('owner_epoch',a.revision,'workspace_epoch',w.invitation_owner_revision,'member_epoch',m.team_revision,'actor',u.id,'email',lower(btrim(u.email)),'email_confirmed_at',u.email_confirmed_at,'source',jsonb_build_array(l.website,l.email,l.name,l.entity_type,l.slug))
 FROM zoi.listing_claim_authority a JOIN zoi.listings l ON l.id=a.listing_id JOIN zoi.workspaces w ON w.id=p_workspace JOIN zoi.workspace_members m ON m.workspace_id=w.id AND m.profile_id=p_profile JOIN auth.users u ON u.id=p_actor
 WHERE a.listing_id=p_listing;
$$;
REVOKE ALL ON FUNCTION zoi.claim_context(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.zoi_claim_entity(p_slug text,p_workspace uuid,p_method text DEFAULT NULL) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE prof uuid;role_name text;l zoi.listings%ROWTYPE;c zoi.listing_claims%ROWTYPE;mail text;context jsonb;ctype text;
BEGIN
 IF auth.uid() IS NULL THEN RETURN json_build_object('ok',false,'error','not_authenticated');END IF;
 -- Workspace lock shares the team writer's lock order; then listing, membership,
 -- current Auth row/session. Every authority check happens after waiting.
 PERFORM 1 FROM zoi.workspaces WHERE id=p_workspace FOR SHARE;
 IF NOT FOUND THEN RETURN json_build_object('ok',false,'error','not_workspace_member');END IF;
 SELECT id INTO prof FROM zoi.user_profiles WHERE auth_user_id=auth.uid();
 SELECT role INTO role_name FROM zoi.workspace_members WHERE workspace_id=p_workspace AND profile_id=prof FOR SHARE;
 IF role_name IS NULL THEN RETURN json_build_object('ok',false,'error','not_workspace_member');END IF;
 IF role_name NOT IN('owner','admin')THEN RETURN json_build_object('ok',false,'error','owner_admin_required');END IF;
 SELECT * INTO l FROM zoi.listings WHERE slug=p_slug FOR UPDATE;
 IF NOT FOUND OR l.publish_status IS DISTINCT FROM 'published' OR coalesce(l.moderation_status,'') NOT IN('clean','cleared') OR coalesce(l.marketplace_status,'')='hidden' THEN RETURN json_build_object('ok',false,'error','entity_not_found');END IF;
 mail:=zoi.claim_actor_email();IF mail IS NULL THEN RETURN json_build_object('ok',false,'error','verified_account_required');END IF;
 INSERT INTO zoi.listing_claim_authority(listing_id)VALUES(l.id)ON CONFLICT DO NOTHING;
 context:=zoi.claim_context(l.id,p_workspace,prof,auth.uid());
 SELECT * INTO c FROM zoi.listing_claims WHERE listing_id=l.id AND claim_status='claimed' FOR UPDATE;
 IF l.owner_workspace_id IS NOT NULL OR l.owner_user_id IS NOT NULL OR l.claim_status IN('claimed','ownership_disputed') OR c.id IS NOT NULL THEN
  IF c.workspace_id=p_workspace AND l.owner_workspace_id=p_workspace AND c.claimant_user_id=l.owner_user_id AND c.evidence->>'settled_epoch'=(SELECT revision::text FROM zoi.listing_claim_authority WHERE listing_id=l.id) THEN
   RETURN json_build_object('ok',true,'status','claimed','claim_id',c.id,'listing_id',l.id,'workspace_id',p_workspace,'method',c.verify_channel,'message','This workspace currently manages this listing.');
  END IF;
  RETURN json_build_object('ok',false,'error','already_claimed');
 END IF;
 SELECT * INTO c FROM zoi.listing_claims WHERE listing_id=l.id AND workspace_id=p_workspace AND claim_status='claim_pending'FOR UPDATE;
 IF c.id IS NOT NULL THEN
  IF c.claimant_user_id<>auth.uid() OR c.evidence->'authority' IS DISTINCT FROM context THEN RETURN json_build_object('ok',false,'error','claim_conflict');END IF;
  RETURN json_build_object('ok',true,'status','claim_pending','claim_id',c.id,'listing_id',l.id,'workspace_id',p_workspace,'method','admin_review','message','Claim submitted for review. Ownership has not been granted.');
 END IF;
 ctype:=CASE WHEN l.entity_type='church'THEN 'church_admin'WHEN l.entity_type IN('organization','association','school')THEN 'org_admin'WHEN l.entity_type='professional'THEN 'professional'WHEN l.entity_type='event'THEN 'event_organizer'WHEN l.entity_type='vendor'THEN 'vendor'ELSE 'business_owner'END;
 INSERT INTO zoi.listing_claims(listing_id,claimant_user_id,claimant_email,claim_type,claim_status,verification_method,workspace_id,submitted_at,evidence)
 VALUES(l.id,auth.uid(),mail,ctype,'claim_pending','manual_admin',p_workspace,now(),jsonb_build_object('authority',context,'requested_method',left(coalesce(p_method,''),100)))RETURNING * INTO c;
 IF zoi.claim_domain_matches(mail,l.website)THEN
  UPDATE zoi.listing_claims SET claim_status='claimed',verification_method='email_domain',verify_channel='email_domain_match',verified_at=now(),resolved_at=now(),resolved_by='auto:domain_match'WHERE id=c.id;
  UPDATE zoi.listings SET owner_workspace_id=p_workspace,owner_user_id=auth.uid(),claim_status='claimed',verification_status='owner_verified'WHERE id=l.id;
  UPDATE zoi.listing_claims SET evidence=evidence||jsonb_build_object('settled_epoch',(SELECT revision FROM zoi.listing_claim_authority WHERE listing_id=l.id))WHERE id=c.id;
  RETURN json_build_object('ok',true,'status','claimed','claim_id',c.id,'listing_id',l.id,'workspace_id',p_workspace,'method','email_domain_match','message','Verified using your confirmed official website email domain.');
 END IF;
 RETURN json_build_object('ok',true,'status','claim_pending','claim_id',c.id,'listing_id',l.id,'workspace_id',p_workspace,'method','admin_review','message','Claim submitted for review. Ownership has not been granted.');
END $$;

CREATE OR REPLACE FUNCTION public.zoi_resolve_claim(p_claim uuid,p_decision text,p_note text DEFAULT NULL)RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c zoi.listing_claims%ROWTYPE;l zoi.listings%ROWTYPE;ws uuid;lid uuid;prof uuid;role_name text;mail text;context jsonb;decision text;
BEGIN
 IF NOT zoi.is_admin()THEN RETURN json_build_object('ok',false,'error','not_admin');END IF;
 decision:=CASE WHEN lower(coalesce(p_decision,''))IN('approve','approved','accept')THEN 'claimed'WHEN lower(coalesce(p_decision,''))IN('reject','rejected','decline')THEN 'claim_rejected'END;
 IF decision IS NULL THEN RETURN json_build_object('ok',false,'error','invalid_decision');END IF;
 SELECT workspace_id,listing_id INTO ws,lid FROM zoi.listing_claims WHERE id=p_claim;
 IF lid IS NULL OR ws IS NULL THEN RETURN json_build_object('ok',false,'error','claim_not_found');END IF;
 PERFORM 1 FROM zoi.workspaces WHERE id=ws FOR SHARE;
 IF NOT FOUND THEN RETURN json_build_object('ok',false,'error','claim_conflict');END IF;
 SELECT * INTO l FROM zoi.listings WHERE id=lid FOR UPDATE;
 SELECT * INTO c FROM zoi.listing_claims WHERE id=p_claim FOR UPDATE;
 IF NOT FOUND OR c.workspace_id IS DISTINCT FROM ws OR c.listing_id IS DISTINCT FROM lid THEN RETURN json_build_object('ok',false,'error','claim_conflict');END IF;
 PERFORM 1 FROM zoi.app_settings WHERE key='admin_emails'FOR SHARE;
 mail:=zoi.claim_actor_email();IF mail IS NULL OR NOT zoi.is_admin()THEN RETURN json_build_object('ok',false,'error','not_admin');END IF;
 IF c.claim_status<> 'claim_pending'THEN
  IF c.claim_status=decision AND(decision='claim_rejected'OR(l.owner_workspace_id=c.workspace_id AND l.owner_user_id=c.claimant_user_id AND c.evidence->>'settled_epoch'=(SELECT revision::text FROM zoi.listing_claim_authority WHERE listing_id=l.id)))THEN RETURN json_build_object('ok',true,'status',c.claim_status,'claim_id',c.id,'listing_id',l.id,'workspace_id',ws);END IF;
  RETURN json_build_object('ok',false,'error','already_resolved','status',c.claim_status);
 END IF;
 IF decision='claimed'THEN
  IF l.owner_workspace_id IS NOT NULL OR l.owner_user_id IS NOT NULL OR l.claim_status IN('claimed','ownership_disputed') OR EXISTS(SELECT 1 FROM zoi.listing_claims WHERE listing_id=l.id AND claim_status='claimed')THEN RETURN json_build_object('ok',false,'error','already_claimed');END IF;
  IF l.publish_status IS DISTINCT FROM 'published' OR coalesce(l.moderation_status,'') NOT IN('clean','cleared') OR coalesce(l.marketplace_status,'')='hidden'THEN RETURN json_build_object('ok',false,'error','entity_not_found');END IF;
  SELECT p.id INTO prof FROM zoi.user_profiles p JOIN auth.users u ON u.id=p.auth_user_id WHERE u.id=c.claimant_user_id AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND NOT coalesce(u.is_anonymous,false)AND(u.banned_until IS NULL OR u.banned_until<=clock_timestamp())FOR SHARE OF u;
  SELECT role INTO role_name FROM zoi.workspace_members WHERE workspace_id=ws AND profile_id=prof FOR SHARE;
  context:=zoi.claim_context(l.id,ws,prof,c.claimant_user_id);
  IF role_name IS NULL OR role_name NOT IN('owner','admin')OR context IS NULL OR c.evidence->'authority'IS DISTINCT FROM context THEN RETURN json_build_object('ok',false,'error','claim_conflict');END IF;
  UPDATE zoi.listings SET owner_workspace_id=ws,owner_user_id=c.claimant_user_id,claim_status='claimed',verification_status='owner_verified'WHERE id=l.id;
 END IF;
 UPDATE zoi.listing_claims SET claim_status=decision,verify_channel='admin_review',verified_at=CASE WHEN decision='claimed'THEN now()ELSE NULL END,resolved_at=now(),resolved_by=mail,decision_note=left(p_note,4000),evidence=evidence||CASE WHEN decision='claimed'THEN jsonb_build_object('settled_epoch',(SELECT revision FROM zoi.listing_claim_authority WHERE listing_id=l.id))ELSE '{}'::jsonb END WHERE id=c.id;
 RETURN json_build_object('ok',true,'status',decision,'claim_id',c.id,'listing_id',l.id,'workspace_id',ws);
END $$;
REVOKE ALL ON FUNCTION public.zoi_claim_entity(text,uuid,text),public.zoi_resolve_claim(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zoi_claim_entity(text,uuid,text),public.zoi_resolve_claim(uuid,text,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.zoi_admin_claims(p_status text DEFAULT 'pending')RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE requested text;mail text;result json;
BEGIN
 IF NOT zoi.is_admin()THEN RETURN json_build_object('ok',false,'error','not_admin');END IF;
 PERFORM 1 FROM zoi.app_settings WHERE key='admin_emails'FOR SHARE;
 mail:=zoi.claim_actor_email();IF mail IS NULL OR NOT zoi.is_admin()THEN RETURN json_build_object('ok',false,'error','not_admin');END IF;
 requested:=CASE WHEN p_status='pending'THEN 'claim_pending'ELSE p_status END;
 IF requested IS NULL OR requested NOT IN('claim_pending','claimed','claim_rejected','ownership_disputed','transferred')THEN RETURN json_build_object('ok',false,'error','invalid_status');END IF;
 SELECT json_build_object('ok',true,'claims',coalesce(json_agg(json_build_object('claim_id',c.id,'listing_id',l.id,'workspace_id',c.workspace_id,'name',l.name,'slug',l.slug,'city',l.city,'listing_website',l.website,'listing_phone',l.phone,'claimant_email',c.claimant_email,'status',c.claim_status,'submitted_at',c.submitted_at)ORDER BY c.submitted_at DESC),'[]'::json))INTO result FROM zoi.listing_claims c JOIN zoi.listings l ON l.id=c.listing_id WHERE c.claim_status=requested;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.zoi_admin_claims(text)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zoi_admin_claims(text)TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
