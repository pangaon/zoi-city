BEGIN;
-- Only proven owner writes override independently reviewed source snapshots.
-- No workspace, actor, private audit or ownership IDs enter this projection.
CREATE OR REPLACE FUNCTION zoi.public_owner_content(p_listing uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN l.updated_by='suite-bizpage' THEN jsonb_build_object(
 'description',l.description,'phone',l.phone,'email',l.email,
 'photo_url',l.photo_url,'social_links',coalesce(l.social_links,'{}'::jsonb))
 ELSE '{}'::jsonb END
 || CASE WHEN l.profile#>>'{_meta,updated_by}'='owner' THEN jsonb_build_object('profile',
 coalesce((SELECT jsonb_object_agg(k,v) FROM jsonb_each(l.profile) x(k,v)
 WHERE k IN ('photos','bio','spotify_url','apple_music_url','youtube_url','bandcamp_url','soundcloud_url','booking_name','booking_email','press','press_kit_url','merch','embeds','releases','tour')),'{}'::jsonb))
 ELSE '{}'::jsonb END FROM zoi.listings l WHERE l.id=p_listing;
$$;
REVOKE ALL ON FUNCTION zoi.public_owner_content(uuid) FROM PUBLIC,anon,authenticated;
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
$function$
;
CREATE OR REPLACE FUNCTION public.home_design_preview_data(p_workspace uuid, p_listing uuid, p_design jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare entity jsonb;design jsonb;begin
 perform zoi.home_design_actor(p_workspace,p_listing);
 design:=zoi.home_design_validate(p_design,zoi.home_design_items(p_workspace,p_listing));
 select jsonb_build_object('id',l.id,'name',l.name,'slug',l.slug,'canonical_slug',l.slug,'entity_type',l.entity_type,'category_slug',c.slug,'website',l.website,'address',l.address,'city',l.city,'country',l.country,'description',l.description,'phone',l.phone,'email',l.email,'photo_url',l.photo_url,'social_links',l.social_links,'owner_content',zoi.public_owner_content(l.id),'profile',coalesce(l.profile,'{}'),'publish_status','published','marketplace_status','') into entity from zoi.listings l left join zoi.categories c on c.id=l.primary_category_id where l.id=p_listing and l.owner_workspace_id=p_workspace;
 return jsonb_build_object('ok',true,'listing',p_listing,'workspace',p_workspace,'entity',entity,'design',design);
end $function$
;
COMMIT;
