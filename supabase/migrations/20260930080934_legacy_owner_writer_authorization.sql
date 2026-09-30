BEGIN;
-- Requires the additive home_content snapshot/save migration. Preserve existing signatures and grants.
CREATE OR REPLACE FUNCTION public.bizpage_save(p_workspace uuid, p_listing uuid, p_description text, p_phone text, p_email text, p_website text, p_hours text, p_price_range text, p_photo_url text, p_social jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
BEGIN
  PERFORM zoi.home_content_authorize(p_workspace,p_listing);
  PERFORM zoi.assert_ws(p_workspace);
  IF NOT zoi.bizpage_can_edit(p_workspace,p_listing) THEN RAISE EXCEPTION 'no_access_to_listing'; END IF;
  UPDATE zoi.listings SET
    description=NULLIF(btrim(p_description),''), phone=NULLIF(btrim(p_phone),''),
    email=NULLIF(lower(btrim(p_email)),''), website=NULLIF(btrim(p_website),''),
    hours=NULLIF(btrim(p_hours),''), price_range=NULLIF(btrim(p_price_range),''),
    photo_url=NULLIF(btrim(p_photo_url),''),
    social_links=COALESCE(p_social,'{}'::jsonb),
    updated_at=now(), updated_by='suite-bizpage'
  WHERE id=p_listing;
  RETURN FOUND;
END;$function$;

CREATE OR REPLACE FUNCTION zoi.bizpage_save_profile(p_workspace uuid, p_listing uuid, p_profile jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
declare v_clean jsonb;
BEGIN
  PERFORM zoi.home_content_authorize(p_workspace,p_listing);
 perform zoi.assert_ws(p_workspace);
 if not zoi.bizpage_can_edit(p_workspace,p_listing) then raise exception 'not permitted to edit this listing';end if;
 if p_profile is null or jsonb_typeof(p_profile)<>'object' then raise exception 'profile must be a JSON object';end if;
 if pg_column_size(p_profile)>262144 then raise exception 'profile too large (limit 256KB)';end if;
 if p_profile?'owner_media' then
  if coalesce(zoi.org_role(p_workspace),'') not in('owner','admin','editor') then raise exception 'not_authorized' using errcode='42501';end if;
  perform 1 from zoi.listings where id=p_listing and owner_workspace_id=p_workspace for update;if not found then raise exception 'owned_listing_required' using errcode='42501';end if;
  if jsonb_typeof(p_profile->'owner_media') is distinct from 'object' or jsonb_typeof(p_profile#>'{owner_media,version}') is distinct from 'number' or coalesce(p_profile#>>'{owner_media,version}','')!~'^[1-9][0-9]{0,7}$' or not zoi.home_media_valid(p_profile#>'{owner_media,items}') then raise exception 'invalid_media_links';end if;
 end if;
 v_clean:=zoi.profile_strip(p_profile);
 update zoi.listings l set profile=coalesce(l.profile,'{}'::jsonb)||v_clean||jsonb_strip_nulls(jsonb_build_object('_enrich',l.profile->'_enrich','_geo',l.profile->'_geo'))||jsonb_build_object('_meta',jsonb_build_object('updated_at',to_char(now(),'YYYY-MM-DD"T"HH24:MI:SSOF'),'updated_by','owner')),updated_at=now() where l.id=p_listing;
 return found;
end $function$;

NOTIFY pgrst,'reload schema';
COMMIT;
