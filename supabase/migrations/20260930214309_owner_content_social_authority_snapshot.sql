BEGIN;
-- Preserve authenticated authorization/version; expose the same public owner authority marker to the editor.
CREATE OR REPLACE FUNCTION public.home_content_get(p_workspace uuid,p_listing uuid)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l zoi.listings;p jsonb;
BEGIN PERFORM zoi.home_content_authorize(p_workspace,p_listing);SELECT * INTO l FROM zoi.listings WHERE id=p_listing;
 p:=coalesce(l.profile,'{}')-'_coverage';IF p?'_enrich' THEN p:=jsonb_set(p,'{_enrich}',(p->'_enrich')-'lease');END IF;
 RETURN jsonb_build_object('ok',true,'workspace_id',p_workspace,'listing_id',p_listing,'version',zoi.home_content_version(l),'base',public.bizpage_get(p_workspace,p_listing),'profile',p,'owner_content',coalesce(zoi.public_owner_content(l.id),'{}'::jsonb),'entity_type',l.entity_type,'category_slug',(SELECT slug FROM zoi.categories WHERE id=l.primary_category_id));
END $$;
REVOKE ALL ON FUNCTION public.home_content_get(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.home_content_get(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
