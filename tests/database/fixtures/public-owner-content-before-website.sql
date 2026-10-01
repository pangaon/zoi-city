CREATE OR REPLACE FUNCTION zoi.public_owner_content(p_listing uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT CASE WHEN l.updated_by='suite-bizpage' THEN jsonb_build_object(
 'description',l.description,'phone',l.phone,'email',l.email,
 'photo_url',l.photo_url,'social_links',coalesce(l.social_links,'{}'::jsonb))
 ELSE '{}'::jsonb END
 || CASE WHEN l.profile#>>'{_meta,updated_by}'='owner' THEN jsonb_build_object('profile',
 coalesce((SELECT jsonb_object_agg(k,v) FROM jsonb_each(l.profile) x(k,v)
 WHERE k IN ('photos','bio','spotify_url','apple_music_url','youtube_url','bandcamp_url','soundcloud_url','booking_name','booking_email','press','press_kit_url','merch','embeds','releases','tour','event_publicity','rooms','dining','venues','amenities')),'{}'::jsonb))
 ELSE '{}'::jsonb END FROM zoi.listings l WHERE l.id=p_listing;
$function$
