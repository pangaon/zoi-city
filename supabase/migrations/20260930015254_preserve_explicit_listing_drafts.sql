begin;
set local lock_timeout='5s';
-- Reviewed live BEFORE INSERT trigger promoted explicit drafts on passing quality.
-- Retain quality metadata for drafts, but publication requires the caller's intent.
-- Null/published inputs retain their existing quality-gated behavior. No row backfill.
create or replace function zoi.tg_apply_publish_gate()
returns trigger language plpgsql set search_path='' as $$
declare v_gate jsonb;
begin
 if new.publish_status is null or new.publish_status in ('draft','published') then
  v_gate:=zoi.publish_gate(new.name,new.entity_type,new.primary_category_id,new.city,new.country,new.phone,new.address,new.website);
  if new.publish_status is distinct from 'draft' then
   if (v_gate->>'ok')::boolean then new.publish_status:='published';
   else new.publish_status:='pending_review';end if;
  end if;
  new.profile:=coalesce(new.profile,'{}'::jsonb)||jsonb_build_object('gate',jsonb_build_object(
   'ok',v_gate->'ok','fails',v_gate->'fails','warnings',v_gate->'warnings',
   'checked_at',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')));
  new.completeness_score:=round(((v_gate->>'quality_score')::numeric/100.0),3);
 end if;
 return new;
end;
$$;
commit;
