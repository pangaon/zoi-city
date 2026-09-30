BEGIN;
CREATE OR REPLACE FUNCTION public.zoi_follow_place(p_profile uuid,p_slug text,p_relation text DEFAULT 'follow')
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid;listing uuid;rel text:=lower(coalesce(p_relation,'follow'));
BEGIN
 IF auth.uid() IS NULL THEN RETURN json_build_object('ok',false,'error','not_signed_in');END IF;
 actor:=zoi.ensure_profile();
 IF actor IS NULL OR actor IS DISTINCT FROM p_profile THEN RETURN json_build_object('ok',false,'error','profile_mismatch');END IF;
 IF rel NOT IN('follow','my_church','my_school','my_business','my_org','attend') THEN RETURN json_build_object('ok',false,'error','invalid_relation');END IF;
 SELECT id INTO listing FROM zoi.listings WHERE slug=p_slug AND publish_status='published' AND moderation_status IN('clean','cleared') AND coalesce(marketplace_status,'')<>'hidden' FOR SHARE;
 IF listing IS NULL THEN RETURN json_build_object('ok',false,'error','not_found');END IF;
 INSERT INTO zoi.user_places(profile_id,listing_id,relation)VALUES(actor,listing,rel) ON CONFLICT(profile_id,listing_id,relation)DO NOTHING;
 RETURN json_build_object('ok',true,'slug',p_slug,'relation',rel);
END $$;
CREATE OR REPLACE FUNCTION public.zoi_unfollow_place(p_profile uuid,p_slug text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid;
BEGIN
 IF auth.uid() IS NULL THEN RETURN json_build_object('ok',false,'error','not_signed_in');END IF;
 actor:=zoi.ensure_profile();
 IF actor IS NULL OR actor IS DISTINCT FROM p_profile THEN RETURN json_build_object('ok',false,'error','profile_mismatch');END IF;
 -- Withdrawal remains possible when a previously followed listing is no longer public.
 -- Return no hidden listing identity or existence information.
 DELETE FROM zoi.user_places u USING zoi.listings l WHERE u.profile_id=actor AND u.listing_id=l.id AND l.slug=p_slug AND u.relation='follow';
 RETURN json_build_object('ok',true);
END $$;
CREATE OR REPLACE FUNCTION public.zoi_submit_review(p_slug text,p_author text,p_rating integer,p_body text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid;uid uuid:=auth.uid();listing uuid;owner_ws uuid;owner_user uuid;author text;old zoi.reviews%ROWTYPE;body text:=btrim(coalesce(p_body,''));
BEGIN
 IF uid IS NULL THEN RETURN 'not_signed_in';END IF;
 actor:=zoi.ensure_profile();IF actor IS NULL THEN RETURN 'not_signed_in';END IF;
 IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 THEN RETURN 'bad rating';END IF;
 IF length(body) NOT BETWEEN 1 AND 2000 THEN RETURN 'invalid_body';END IF;
 SELECT id,owner_workspace_id,owner_user_id INTO listing,owner_ws,owner_user FROM zoi.listings WHERE slug=p_slug AND publish_status='published' AND moderation_status IN('clean','cleared') AND coalesce(marketplace_status,'')<>'hidden' FOR SHARE;
 IF listing IS NULL THEN RETURN 'not found';END IF;
 IF owner_user IN(uid,actor) OR EXISTS(SELECT 1 FROM zoi.workspace_members WHERE workspace_id=owner_ws AND profile_id=actor) THEN RETURN 'self_review_not_allowed';END IF;
 -- Serialize every submission by this actor, including different listings, for the daily bound.
 PERFORM pg_advisory_xact_lock(hashtextextended('listing-review:'||uid::text,0));
 SELECT * INTO old FROM zoi.reviews WHERE listing_id=listing AND author_user_id=uid ORDER BY created_at,id LIMIT 1;
 IF old.id IS NOT NULL THEN
  IF old.rating=p_rating AND old.body=body THEN RETURN CASE WHEN old.moderation_status='under_review' THEN 'pending' ELSE 'already_submitted' END;END IF;
  RETURN 'review_exists';
 END IF;
 IF (SELECT count(*) FROM zoi.reviews WHERE author_user_id=uid AND created_at>clock_timestamp()-interval '24 hours')>=10 THEN RETURN 'rate_limited';END IF;
 SELECT coalesce(nullif(btrim(display_name),''),'Zoi member') INTO author FROM zoi.user_profiles WHERE id=actor;
 -- p_author retained only for wire compatibility, never trusted as another person's identity.
 INSERT INTO zoi.reviews(listing_id,author_user_id,author_name,rating,body,moderation_status)VALUES(listing,uid,left(coalesce(author,'Zoi member'),160),p_rating,body,'under_review');
 INSERT INTO zoi.audit_log(actor,action,target_type,target_id,reason)VALUES(uid::text,'review_submitted','listing',listing::text,'pending moderation');
 -- No rating aggregate change until separately authorized moderation approval.
 RETURN 'pending';
END $$;
CREATE OR REPLACE FUNCTION public.zoi_listing_reviews(p_slug text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT coalesce((SELECT json_agg(json_build_object('author',x.author,'rating',x.rating,'body',x.body,'created_at',x.created_at,'owner_reply',x.owner_reply) ORDER BY x.sort_time DESC,x.sort_id DESC) FROM(
 SELECT r.created_at sort_time,r.id sort_id,coalesce(r.author_name,'Anonymous') author,r.rating,r.body,to_char(r.created_at,'Mon DD, YYYY') created_at,r.owner_reply
 FROM zoi.reviews r JOIN zoi.listings l ON l.id=r.listing_id WHERE l.slug=p_slug AND l.publish_status='published' AND l.moderation_status IN('clean','cleared') AND coalesce(l.marketplace_status,'')<>'hidden' AND r.moderation_status IN('clean','cleared'))x),'[]'::json);
$$;
REVOKE ALL ON FUNCTION public.zoi_follow_place(uuid,text,text),public.zoi_unfollow_place(uuid,text),public.zoi_submit_review(text,text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zoi_follow_place(uuid,text,text),public.zoi_unfollow_place(uuid,text),public.zoi_submit_review(text,text,integer,text) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.zoi_listing_reviews(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zoi_listing_reviews(text) TO anon,authenticated,service_role;
COMMIT;
