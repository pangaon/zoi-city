CREATE OR REPLACE FUNCTION zoi.assert_ws(p_ws uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
DECLARE ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  SELECT EXISTS(
    SELECT 1 FROM zoi.workspaces w
    LEFT JOIN zoi.user_profiles up ON up.auth_user_id = auth.uid()
    LEFT JOIN zoi.workspace_members m ON m.workspace_id = w.id AND m.profile_id = up.id
    WHERE w.id = p_ws AND (w.created_by_auth = auth.uid() OR w.owner_profile_id = up.id OR m.id IS NOT NULL)
  ) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'no_access_to_workspace'; END IF;
END;$function$;


CREATE OR REPLACE FUNCTION zoi.bizpage_can_edit(p_workspace uuid, p_listing uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
  SELECT EXISTS(
    SELECT 1 FROM zoi.listings l WHERE l.id=p_listing AND l.owner_workspace_id=p_workspace
    UNION ALL
    SELECT 1 FROM zoi.listing_claims c WHERE c.listing_id=p_listing AND c.workspace_id=p_workspace AND c.claim_status IN ('approved','verified')
  );
$function$;


CREATE OR REPLACE FUNCTION public.bizpage_get(p_workspace uuid, p_listing uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
BEGIN
  PERFORM zoi.assert_ws(p_workspace);
  IF NOT zoi.bizpage_can_edit(p_workspace,p_listing) THEN RAISE EXCEPTION 'no_access_to_listing'; END IF;
  RETURN (SELECT jsonb_build_object('id',l.id,'name',l.name,'slug',l.slug,'path',COALESCE(l.canonical_path,'/p/'||l.slug),
    'description',l.description,'phone',l.phone,'email',l.email,'website',l.website,
    'hours',l.hours,'price_range',l.price_range,'photo_url',l.photo_url,'social_links',COALESCE(l.social_links,'{}'::jsonb))
    FROM zoi.listings l WHERE l.id=p_listing);
END;$function$;


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
END;$function$;


CREATE OR REPLACE FUNCTION zoi.bizpage_save_profile(p_workspace uuid, p_listing uuid, p_profile jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
declare v_clean jsonb;
begin
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


CREATE OR REPLACE FUNCTION public.bizpage_save_profile(p_workspace uuid, p_listing uuid, p_profile jsonb)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$ SELECT zoi.bizpage_save_profile(p_workspace, p_listing, p_profile); $function$;


CREATE OR REPLACE FUNCTION zoi.home_media_valid(p_items jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare x jsonb;u text;k text;
begin
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>24 or length(p_items::text)>20000 then return false;end if;
 for x in select value from jsonb_array_elements(p_items) loop
 if jsonb_typeof(x) is distinct from 'object' or (select count(*) from jsonb_object_keys(x))<>4 or not(x?'id' and x?'kind' and x?'url' and x?'label') or coalesce(x->>'id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(x->'label') is distinct from 'string' or length(x->>'label')>100 or btrim(x->>'label')<>x->>'label' then return false;end if;
 u:=x->>'url';k:=x->>'kind';
 if not coalesce((k='video' and (u~'^https://www[.]youtube[.]com/watch[?]v=[A-Za-z0-9_-]{11}$' or u~'^https://www[.]youtube[.]com/playlist[?]list=[A-Za-z0-9_-]{10,80}$')) or (k='audio' and u~'^https://open[.]spotify[.]com/(artist|album|track|playlist|episode|show)/[A-Za-z0-9]{22}$') or (k='link' and (u~'^https://vimeo[.]com/([0-9]{1,20}|[A-Za-z][A-Za-z0-9_-]{1,100})(/[A-Za-z0-9_-]{1,100})?$' or u~'^https://soundcloud[.]com/[A-Za-z0-9_-]{1,100}(/[A-Za-z0-9_-]{1,150})?$' or u~'^https://podcasts[.]apple[.]com/[a-z]{2}/podcast/[A-Za-z0-9%_.-]{1,200}/id[0-9]{1,20}$' or u~'^https://www[.]instagram[.]com/(p|reel)/[A-Za-z0-9_-]{1,100}$' or u~'^https://www[.]tiktok[.]com/@[A-Za-z0-9_.]{1,100}/video/[0-9]{1,30}$')) or (k='channel' and (u~'^https://www[.]youtube[.]com/(@[A-Za-z0-9_.-]{1,100}|channel/[A-Za-z0-9_-]{10,100}|(c|user)/[A-Za-z0-9_.-]{1,100})$' or u~'^https://www[.]instagram[.]com/[A-Za-z0-9_.]{1,50}$' or u~'^https://www[.]facebook[.]com/[A-Za-z0-9.-]{1,100}$' or u~'^https://www[.]tiktok[.]com/@[A-Za-z0-9_.]{1,100}$' or u~'^https://www[.]linkedin[.]com/(in|company)/[A-Za-z0-9_-]{1,100}$' or u~'^https://x[.]com/[A-Za-z0-9_]{1,30}$' or u~'^https://www[.]threads[.]net/@[A-Za-z0-9_.]{1,100}$')),false) then return false;end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_items) as entries(value) group by entries.value->>'id' having count(*)>1) or exists(select 1 from jsonb_array_elements(p_items) as entries(value) group by entries.value->>'url' having count(*)>1) then return false;end if;
 return true;
end $function$;


CREATE OR REPLACE FUNCTION zoi.org_actor()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ SELECT id FROM zoi.user_profiles WHERE auth_user_id=auth.uid() LIMIT 1 $function$;


CREATE OR REPLACE FUNCTION zoi.org_role(p_workspace uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ SELECT m.role FROM zoi.workspace_members m JOIN zoi.user_profiles p ON p.id=m.profile_id WHERE m.workspace_id=p_workspace AND p.auth_user_id=auth.uid() LIMIT 1 $function$;


CREATE OR REPLACE FUNCTION zoi.profile_strip(p jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'zoi', 'public'
AS $function$
  SELECT coalesce(
    (SELECT jsonb_object_agg(k, v)
       FROM jsonb_each(coalesce(p, '{}'::jsonb)) AS t(k, v)
      WHERE k NOT IN ('rating','rating_count','review','reviews','reviewCount',
                      'aggregateRating','score','stars','ranking','provider_stats',
                      '_enrich','_geo','_coverage')
        AND k NOT LIKE 'rating%'
        AND k NOT LIKE 'review%'),
    '{}'::jsonb);
$function$;

