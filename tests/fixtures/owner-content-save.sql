-- Read-only live function snapshot, 2026-09-30. Test fixture only.
CREATE OR REPLACE FUNCTION public.bizpage_save(p_workspace uuid, p_listing uuid, p_description text, p_phone text, p_email text, p_website text, p_hours text, p_price_range text, p_photo_url text, p_social jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
BEGIN
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
END;$function$
;

