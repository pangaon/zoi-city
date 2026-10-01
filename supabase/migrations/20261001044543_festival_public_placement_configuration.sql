BEGIN;
SET LOCAL lock_timeout='5s';
-- Public scope discovery carries no private allocation or workspace information.
CREATE FUNCTION public.festival_placement_configuration(p_event uuid,p_configuration text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'ok',true,'event_id',p_event,'configuration',p_configuration,
  'configuration_version',(
   SELECT s.version FROM zoi.festival_placement_scopes s
   JOIN zoi.listings l ON l.id=s.event_id AND l.owner_workspace_id=s.workspace_id
   WHERE s.event_id=p_event AND s.configuration=p_configuration
   AND p_configuration IN('front','side') AND l.entity_type='event'
   AND l.publish_status='published' AND coalesce(l.marketplace_status,'')<>'hidden'
   AND l.moderation_status IN('clean','cleared')
  ),'server_time',statement_timestamp()
 );
$$;
REVOKE ALL ON FUNCTION public.festival_placement_configuration(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.festival_placement_configuration(uuid,text) TO anon,authenticated;
COMMIT;
