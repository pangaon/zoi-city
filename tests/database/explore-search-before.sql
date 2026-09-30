CREATE OR REPLACE FUNCTION public.dir_counts()
 RETURNS TABLE(entity_type text, n bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select l.entity_type, count(*)::bigint as n
  from zoi.listings l
  where l.publish_status = 'published' and l.moderation_status = 'clean'
  group by l.entity_type
  order by count(*) desc;
$function$;

CREATE OR REPLACE FUNCTION public.explore_fresh(p_limit integer DEFAULT 6)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(to_jsonb(r)),'[]'::jsonb) FROM (
    SELECT l.id, l.slug, l.name, l.city, l.country, l.entity_type,
      COALESCE(l.canonical_path,'/p/'||l.slug) AS path
    FROM zoi.listings l WHERE l.publish_status='published'
    ORDER BY l.created_at DESC LIMIT LEAST(p_limit,12)
  ) r;
$function$;

CREATE OR REPLACE FUNCTION public.explore_search(p_q text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0, p_region text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from (
    select id, slug, name, description, category, entity_type, city, country,
      region, region_code, region_native, path, verification_status, rating,
      photo_url, claimable
    from (
      select l.id, l.slug, l.name,
        left(coalesce(
          nullif(l.description, ''),
          nullif(l.profile ->> 'description', ''),
          nullif(l.profile -> '_enrich' ->> 'description', ''),
          ''
        ),170) as description,
        c.label_en as category, l.entity_type, l.city,
        zoi.geo_country_canon(l.country) as country,
        l.region, l.region_code, l.region_native,
        coalesce(l.canonical_path,
          '/' || replace(l.entity_type,'travel_place','travel-place') || '/' || l.slug) as path,
        l.verification_status, l.rating,
        coalesce(
          nullif(l.photo_url, ''),
          nullif(l.profile ->> 'photo_url', ''),
          nullif(l.profile ->> 'logo_url', ''),
          nullif(l.profile -> '_enrich' ->> 'photo_url', ''),
          nullif(l.profile -> '_enrich' ->> 'logo_url', ''),
          nullif(l.profile -> '_enrich' -> 'fields' ->> 'photo_url', ''),
          nullif(l.profile -> '_enrich' -> 'fields' ->> 'logo', '')
        ) as photo_url,
        (l.owner_workspace_id is null and coalesce(l.claim_status,'unclaimed') not in ('claimed','approved')) as claimable,
        l.trust_score,
        row_number() over (
          partition by lower(trim(coalesce(l.name,''))),
                       lower(trim(coalesce(l.city,''))),
                       lower(trim(coalesce(zoi.geo_country_canon(l.country), '')))
          order by
            (l.verification_status='verified') desc,
            l.trust_score desc nulls last,
            case l.entity_type
              when 'creator' then 0
              when 'artist' then 1
              when 'business' then 2
              else 3
            end,
            l.name,
            l.id
        ) as dedupe_rank
      from zoi.listings l
      left join zoi.categories c on c.id=l.primary_category_id
      where l.publish_status='published'
        and (p_q is null or p_q='' or l.search_tsv @@ plainto_tsquery('simple',p_q)
             or l.name ilike '%'||p_q||'%' or l.region ilike '%'||p_q||'%'
             or l.region_native ilike '%'||p_q||'%')
        and (p_type is null or p_type='' or l.entity_type=p_type)
        and (p_city is null or p_city='' or l.city ilike p_city)
        and (p_country is null or p_country='' or zoi.geo_country_canon(l.country) ilike p_country)
        and (p_region is null or p_region='' or l.region ilike p_region
             or l.region_native ilike p_region or upper(l.region_code)=upper(p_region))
    ) ranked
    where dedupe_rank = 1
    order by (verification_status='verified') desc, trust_score desc nulls last, name, id
    limit least(greatest(p_limit,1),48) offset greatest(p_offset,0)
  ) r;
$function$;

