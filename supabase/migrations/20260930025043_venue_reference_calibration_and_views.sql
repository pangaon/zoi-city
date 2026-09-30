begin;
set local lock_timeout='5s';
-- Optional documentary references in version-1 layouts; existing geometry and published revisions remain unchanged.
create function zoi.venue_image_reference(p_image jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare url text:=p_image->>'url';caption text:=p_image->>'caption';host text;
begin
 if jsonb_typeof(p_image) is distinct from 'object' or jsonb_typeof(p_image->'url') is distinct from 'string' or jsonb_typeof(p_image->'caption') is distinct from 'string' or length(coalesce(url,''))>2048 or (length(caption)>240 or length(btrim(coalesce(caption,'')))<1) then raise exception 'invalid_venue_image';end if;
 if url !~ '^https://' or url !~* '^https://([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}(:443)?/[^?#]*\.(jpe?g|png|webp|avif)(\?[^#]*)?$' or url ~ '[[:space:][:cntrl:]<>"]' or strpos(url,chr(92))>0 or url ~* '%(0[0-9a-f]|1[0-9a-f]|7f)' then raise exception 'unsafe_venue_image_url';end if;
 host:=split_part(split_part(url,'/',3),':',1);if host ~* '(^|\.)(localhost|local|internal|test|invalid)$' then raise exception 'unsafe_venue_image_url';end if;
 return jsonb_build_object('url',url,'caption',btrim(caption));
end $$;
revoke all on function zoi.venue_image_reference(jsonb) from public,anon,authenticated;
create or replace function zoi.venue_validate_layout(p_layout jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare w numeric;d numeric;o jsonb;clean jsonb:='[]';x numeric;y numeric;ow numeric;od numeric;h numeric;sections jsonb:='[]';section jsonb;ref jsonb;image jsonb;cal jsonb;pw numeric;ph numeric;x1 numeric;x2 numeric;y1 numeric;y2 numeric;distance numeric;pixels numeric;result jsonb;
begin
 if octet_length(p_layout::text)>250000 or p_layout->'version' is distinct from '1'::jsonb or jsonb_typeof(p_layout->'name') is distinct from 'string' or jsonb_typeof(p_layout->'width') is distinct from 'number' or jsonb_typeof(p_layout->'depth') is distinct from 'number' or jsonb_typeof(p_layout->'objects') is distinct from 'array' then raise exception 'invalid_layout'; end if;
 w:=(p_layout->>'width')::numeric;d:=(p_layout->>'depth')::numeric;
 if w is null or d is null or w not between 4 and 100 or d not between 4 and 100 then raise exception 'invalid_room_dimensions'; end if;
 if nullif(btrim(p_layout->>'name'),'') is null or length(p_layout->>'name')>100 or jsonb_array_length(p_layout->'objects')>600 then raise exception 'invalid_layout_size'; end if;
 if p_layout?'sections' and p_layout->'sections'<>'null'::jsonb then
  if jsonb_typeof(p_layout->'sections') is distinct from 'array' or jsonb_array_length(p_layout->'sections')>60 then raise exception 'invalid_venue_sections';end if;
  for section in select value from jsonb_array_elements(p_layout->'sections') loop
   if jsonb_typeof(section) is distinct from 'object' or jsonb_typeof(section->'id') is distinct from 'string' or jsonb_typeof(section->'label') is distinct from 'string' or coalesce(section->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' or (length(section->>'label')>50 or length(btrim(coalesce(section->>'label','')))<1) then raise exception 'invalid_venue_section';end if;
   sections:=sections||jsonb_build_array(jsonb_build_object('id',section->>'id','label',btrim(section->>'label'))||case when section?'view_image' and section->'view_image'<>'null'::jsonb then jsonb_build_object('view_image',zoi.venue_image_reference(section->'view_image')) else '{}'::jsonb end);
  end loop;
  if exists(select 1 from jsonb_array_elements(sections)e group by e->>'id' having count(*)>1) or exists(select 1 from jsonb_array_elements(sections)e group by lower(e->>'label') having count(*)>1) then raise exception 'duplicate_venue_section';end if;
 end if;
 if p_layout?'reference' and p_layout->'reference'<>'null'::jsonb then
  ref:=p_layout->'reference';image:=zoi.venue_image_reference(ref);cal:=ref->'calibration';
  if jsonb_typeof(ref->'pixel_width') is distinct from 'number' or jsonb_typeof(ref->'pixel_height') is distinct from 'number' or jsonb_typeof(cal) is distinct from 'object' or exists(select 1 from unnest(array['x1','y1','x2','y2','distance_m'])k where jsonb_typeof(cal->k) is distinct from 'number') then raise exception 'invalid_reference_calibration';end if;
  pw:=(ref->>'pixel_width')::numeric;ph:=(ref->>'pixel_height')::numeric;x1:=(cal->>'x1')::numeric;y1:=(cal->>'y1')::numeric;x2:=(cal->>'x2')::numeric;y2:=(cal->>'y2')::numeric;distance:=(cal->>'distance_m')::numeric;
  if pw<>trunc(pw) or ph<>trunc(ph) or pw not between 16 and 20000 or ph not between 16 and 20000 or x1<0 or x2<0 or y1<0 or y2<0 or x1>pw or x2>pw or y1>ph or y2>ph or distance not between 0.1 and 100 then raise exception 'invalid_reference_calibration';end if;
  pixels:=sqrt(power(x2-x1,2)+power(y2-y1,2));if pixels<1 then raise exception 'invalid_reference_calibration';end if;
  if pw*distance/pixels not between 0.1 and 100 or ph*distance/pixels not between 0.1 and 100 or pw*distance/pixels>w+0.00000001 or ph*distance/pixels>d+0.00000001 then raise exception 'reference_outside_room';end if;
  ref:=image||jsonb_build_object('pixel_width',pw,'pixel_height',ph,'calibration',jsonb_build_object('x1',x1,'y1',y1,'x2',x2,'y2',y2,'distance_m',distance));
 end if;
 for o in select value from jsonb_array_elements(p_layout->'objects') loop
  if jsonb_typeof(o->'id') is distinct from 'string' or jsonb_typeof(o->'label') is distinct from 'string' or exists(select 1 from unnest(array['x','y','width','depth','height']) k where jsonb_typeof(o->k) is distinct from 'number') or (o?'accessible' and jsonb_typeof(o->'accessible')<>'boolean') or (o?'excluded' and jsonb_typeof(o->'excluded')<>'boolean') then raise exception 'invalid_object_types'; end if;
  if coalesce(o->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' or coalesce(o->>'kind','') not in ('seat','stage','table') or nullif(btrim(o->>'label'),'') is null or length(o->>'label')>50 then raise exception 'invalid_object'; end if;
  x:=(o->>'x')::numeric;y:=(o->>'y')::numeric;ow:=(o->>'width')::numeric;od:=(o->>'depth')::numeric;h:=(o->>'height')::numeric;
  if x is null or y is null or ow is null or od is null or h is null or x<0 or y<0 or ow<=0 or od<=0 or h<=0 or h>10 or x+ow>w or y+od>d then raise exception 'object_outside_room'; end if;
  if o?'section_id' and o->'section_id'<>'null'::jsonb and jsonb_typeof(o->'section_id') is distinct from 'string' then raise exception 'invalid_venue_section';end if;
  if (coalesce(o->>'section_id','')<>'' or (o?'view_image' and o->'view_image'<>'null'::jsonb)) and o->>'kind'<>'seat' then raise exception 'seat_reference_required';end if;
  if coalesce(o->>'section_id','')<>'' and not exists(select 1 from jsonb_array_elements(sections)s where s->>'id'=o->>'section_id') then raise exception 'venue_section_not_found';end if;
  clean:=clean||jsonb_build_array(jsonb_build_object('id',o->>'id','kind',o->>'kind','label',btrim(o->>'label'),'x',x,'y',y,'width',ow,'depth',od,'height',h,'accessible',coalesce(o->'accessible'='true'::jsonb,false),'excluded',coalesce(o->'excluded'='true'::jsonb,false))||case when coalesce(o->>'section_id','')<>'' then jsonb_build_object('section_id',o->>'section_id') else '{}'::jsonb end||case when o?'view_image' and o->'view_image'<>'null'::jsonb then jsonb_build_object('view_image',zoi.venue_image_reference(o->'view_image')) else '{}'::jsonb end);
 end loop;
 if exists(select 1 from jsonb_array_elements(clean) a group by a->>'id' having count(*)>1) then raise exception 'duplicate_object_id'; end if;
 if exists(select 1 from jsonb_array_elements(clean) a where a->>'kind'='seat' group by lower(a->>'label') having count(*)>1) then raise exception 'duplicate_seat_label'; end if;
 if exists(select 1 from jsonb_array_elements(clean) with ordinality a(o,n) join jsonb_array_elements(clean) with ordinality b(o,n) on a.n<b.n where
  (a.o->>'x')::numeric<(b.o->>'x')::numeric+(b.o->>'width')::numeric-0.01 and
  (a.o->>'x')::numeric+(a.o->>'width')::numeric>(b.o->>'x')::numeric+0.01 and
  (a.o->>'y')::numeric<(b.o->>'y')::numeric+(b.o->>'depth')::numeric-0.01 and
  (a.o->>'y')::numeric+(a.o->>'depth')::numeric>(b.o->>'y')::numeric+0.01) then raise exception 'objects_overlap'; end if;
 return jsonb_build_object('version',1,'name',btrim(p_layout->>'name'),'width',w,'depth',d,'objects',clean)||case when jsonb_array_length(sections)>0 then jsonb_build_object('sections',sections) else '{}'::jsonb end||case when ref is not null and ref<>'null'::jsonb then jsonb_build_object('reference',ref) else '{}'::jsonb end;
end $$;
revoke all on function zoi.venue_validate_layout(jsonb) from public,anon,authenticated;

create function public.venue_reference_capabilities(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform zoi.venue_require_member(p_workspace,false);return jsonb_build_object('ok',true,'version',1);end $$;
revoke all on function public.venue_reference_capabilities(uuid) from public,anon,authenticated;
grant execute on function public.venue_reference_capabilities(uuid) to authenticated;
commit;
