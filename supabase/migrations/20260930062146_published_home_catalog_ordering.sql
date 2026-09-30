begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
-- Additive presentation ordering only. Availability/authorization/price snapshots stay authoritative.
create function zoi.home_published_item_order(p_listing uuid,p_workspace uuid)
returns text[] language sql stable security invoker set search_path='' as $$
 select coalesce(array_agg(i.value order by i.ordinality),'{}'::text[])
 from zoi.home_designs d join zoi.listings l on l.id=d.listing_id and l.owner_workspace_id=d.workspace_id
 cross join lateral jsonb_array_elements_text(case when jsonb_typeof(d.published#>'{item_order,offerings}')='array' then d.published#>'{item_order,offerings}' else '[]'::jsonb end) with ordinality i(value,ordinality)
 where l.id=p_listing and d.workspace_id=p_workspace and l.publish_status='published' and l.moderation_status in('clean','cleared')
 and coalesce(l.marketplace_status,'')<>'hidden' and d.published is not null
$$;
revoke all on function zoi.home_published_item_order(uuid,uuid) from public,anon,authenticated;

create or replace function public.booking_catalog(p_listing uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg zoi.booking_settings;slots jsonb;title text;item_order text[];
begin
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '31 days' then raise exception 'invalid_date_range';end if;
 select b.*,l.name into cfg.workspace_id,cfg.listing_id,cfg.timezone,cfg.currency,cfg.enabled,cfg.version,title from zoi.booking_settings b join zoi.listings l on l.id=b.listing_id where b.listing_id=p_listing and l.owner_workspace_id=b.workspace_id and b.enabled and l.publish_status='published' and l.moderation_status in('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden';
 if cfg.workspace_id is null then return jsonb_build_object('ok',true,'available',false,'slots','[]'::jsonb);end if;
 item_order:=zoi.home_published_item_order(p_listing,cfg.workspace_id);
 select coalesce(jsonb_agg(to_jsonb(q)-'sort_rank' order by q.sort_rank,q.starts_at,q.id),'[]') into slots from (select s.id,s.service_id,s.version,s.service_name,s.resource_name,s.starts_at,s.ends_at,s.capacity,s.price_cents,s.currency,r.kind as resource_kind,coalesce(array_position(item_order,'booking:'||s.service_id::text),2147483647) as sort_rank from zoi.booking_slots s join zoi.booking_services v on v.id=s.service_id join zoi.booking_resources r on r.id=s.resource_id where s.workspace_id=cfg.workspace_id and s.active and v.active and r.active and s.starts_at>=greatest(p_from,clock_timestamp()+interval '5 minutes') and s.starts_at<p_to and not exists(select 1 from zoi.bookings b where b.slot_id=s.id and b.status<>'cancelled') order by coalesce(array_position(item_order,'booking:'||s.service_id::text),2147483647),s.starts_at,s.id limit 500) q;
 return jsonb_build_object('ok',true,'available',true,'name',title,'timezone',cfg.timezone,'currency',cfg.currency,'slots',slots);
end $$;

create or replace function public.festival_catalog(p_event uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare host zoi.listings;packages jsonb;item_order text[];
begin
 select * into host from zoi.listings where id=p_event and publish_status='published' and moderation_status in('clean','cleared') and coalesce(marketplace_status,'')<>'hidden';if host.id is null then return jsonb_build_object('ok',true,'available',false,'packages','[]'::jsonb);end if;
 item_order:=zoi.home_published_item_order(p_event,host.owner_workspace_id);
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'kind',p.kind,'name',p.name,'description',p.description,'benefits',p.benefits,'price_cents',p.price_cents,'currency',p.currency,'capacity',p.capacity,'allocated',p.allocated,'remaining',greatest(0,p.capacity-p.allocated),'closes_at',p.closes_at,'timezone',p.timezone,'version',p.version,'application_required',true,'payment_collected',false,'offer_url','/festival/?event='||p.event_id||'&offer='||p.id) order by coalesce(array_position(item_order,'festival:'||p.id::text),2147483647),p.kind,p.name,p.id),'[]') into packages from(select p.*,(select coalesce(sum(units),0) from zoi.festival_applications where package_id=p.id and status='approved') as allocated from zoi.festival_packages p where p.event_id=host.id and p.workspace_id=host.owner_workspace_id and p.active and p.closes_at>clock_timestamp())p;
 return jsonb_build_object('ok',true,'available',jsonb_array_length(packages)>0,'event_name',host.name,'packages',packages);
end $$;

create or replace function public.property_catalog(p_host uuid default null,p_offer uuid default null,p_mode text default null,p_city text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$declare offers jsonb;item_order text[];begin
 if length(coalesce(p_city,''))>120 or (p_mode is not null and p_mode not in('sale','long_rent','holiday_stay')) then raise exception 'invalid_property_filter';end if;
 -- Global discovery retains recency; one owner cannot rank unrelated listings.
 if p_host is not null then select zoi.home_published_item_order(l.id,l.owner_workspace_id) into item_order from zoi.listings l where l.id=p_host;end if;
 select coalesce(jsonb_agg(to_jsonb(q)-'sort_rank' order by q.sort_rank,q.updated_at desc,q.id),'[]') into offers from(select coalesce(array_position(item_order,'property:'||p.id::text),2147483647) as sort_rank,p.id,p.host_id,p.place_id,p.version,p.data,p.status,p.updated_at,l.name agent_name,l.slug agent_slug,place.name place_name,place.slug place_slug,case when exists(select 1 from zoi.booking_settings b where b.listing_id=l.id and b.workspace_id=l.owner_workspace_id and b.enabled) then '/book/?listing='||l.id end booking_url,'/properties/?offer='||p.id offer_url from zoi.property_offers p join zoi.listings l on l.id=p.host_id left join zoi.listings place on place.id=p.place_id where l.moderation_status in('clean','cleared') and p.published and not p.source_conflict and zoi.property_current(p) and (p_host is null or p.host_id=p_host) and (p_offer is null or p.id=p_offer) and (p_mode is null or p.data->>'mode'=p_mode) and (coalesce(p_city,'')='' or position(lower(p_city) in lower(p.data->>'city'))>0) order by coalesce(array_position(item_order,'property:'||p.id::text),2147483647),p.updated_at desc,p.id limit 50)q;return jsonb_build_object('ok',true,'offers',offers);end $$;
-- Preserve the existing public read contracts; no access to private design tables is granted.
revoke all on function public.booking_catalog(uuid,timestamptz,timestamptz),public.festival_catalog(uuid),public.property_catalog(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.booking_catalog(uuid,timestamptz,timestamptz),public.festival_catalog(uuid),public.property_catalog(uuid,uuid,text,text) to anon,authenticated;
commit;
