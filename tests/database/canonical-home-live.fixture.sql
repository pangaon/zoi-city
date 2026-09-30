CREATE OR REPLACE FUNCTION zoi.seo_text(p_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO ''
AS $function$
 SELECT btrim(regexp_replace(lower(coalesce(p_value,'')), '[^[:alnum:]]+', ' ', 'g'));
$function$;

CREATE OR REPLACE FUNCTION zoi.seo_name(p_name text, p_city text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO ''
AS $function$
DECLARE n text:=zoi.seo_text(p_name); c text:=zoi.seo_text(p_city);
BEGIN
 IF c<>'' AND length(n)>length(c)+1 AND right(n,length(c)+1)=' '||c THEN
  RETURN left(n,length(n)-length(c)-1);
 END IF;
 RETURN n;
END;
$function$;

CREATE OR REPLACE FUNCTION public.seo_entity(p_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 WITH me AS (
  SELECT l.* FROM zoi.listings l WHERE l.slug=p_slug AND l.publish_status='published' AND l.moderation_status IN ('clean','cleared')
   AND coalesce(l.marketplace_status,'')<>'hidden' LIMIT 1
 ), canon AS (
  SELECT l2.slug FROM zoi.listings l2,me
  WHERE l2.publish_status='published' AND l2.moderation_status IN ('clean','cleared') AND coalesce(l2.marketplace_status,'')<>'hidden' AND nullif(btrim(l2.slug),'') IS NOT NULL
   AND l2.entity_type=me.entity_type AND zoi.seo_name(l2.name,l2.city)=zoi.seo_name(me.name,me.city)
   AND zoi.seo_text(l2.city)=zoi.seo_text(me.city) AND zoi.seo_text(l2.region)=zoi.seo_text(me.region)
   AND zoi.seo_text(l2.country)=zoi.seo_text(me.country) AND zoi.seo_text(l2.address)=zoi.seo_text(me.address)
  ORDER BY (((l2.address IS NOT NULL)::int)+((l2.phone IS NOT NULL)::int)+((l2.website IS NOT NULL)::int)+((l2.latitude IS NOT NULL)::int)+((l2.description IS NOT NULL)::int)) DESC,
   (l2.slug ~ '-[0-9a-f]{6}$')::int,coalesce(l2.updated_at,l2.created_at) DESC,l2.slug LIMIT 1
 )
 SELECT jsonb_build_object('id',me.id,'name',me.name,'entity_type',me.entity_type,'slug',me.slug,
  'canonical_slug',(SELECT slug FROM canon),'city',me.city,'country',me.country,'address',me.address,'phone',me.phone,
  'email',me.email,'photo_url',me.photo_url,'publish_status',me.publish_status,'moderation_status',me.moderation_status,'marketplace_status',me.marketplace_status,'website',me.website,'description',me.description,'latitude',me.latitude,'longitude',me.longitude,
  'rating',me.rating,'rating_count',me.rating_count,'price_range',me.price_range,'meta_title',me.meta_title,'meta_description',me.meta_description,
  'geo_precision',me.geo_precision,'social_links',me.social_links,'profile',me.profile,'category_slug',(SELECT c.slug FROM zoi.categories c WHERE c.id=me.primary_category_id),
  'place_path',CASE WHEN me.place_id IS NOT NULL THEN zoi.place_path(me.place_id) ELSE NULL END,'updated_at',coalesce(me.updated_at,me.created_at)) || zoi.public_home_actions(me.id) || jsonb_build_object('owner_content',zoi.public_owner_content(me.id)) FROM me;
$function$;
