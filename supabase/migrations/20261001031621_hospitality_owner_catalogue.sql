BEGIN;
-- Validate the existing owner profile patch; no new writer or inventory system.
CREATE OR REPLACE FUNCTION zoi.hospitality_catalog_valid(p_key text,p_value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE item jsonb;k text;seen text[]:='{}';token text;
BEGIN
 IF p_key NOT IN('rooms','dining','venues','amenities') THEN RETURN false;END IF;
 IF p_value='null'::jsonb THEN RETURN true;END IF;
 IF jsonb_typeof(p_value) IS DISTINCT FROM 'array' THEN RETURN false;END IF;
 IF jsonb_array_length(p_value)>(CASE WHEN p_key='amenities' THEN 20 ELSE 30 END) THEN RETURN false;END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_value)LOOP
  IF p_key='amenities' THEN
   token:=item#>>'{}';
   IF jsonb_typeof(item) IS DISTINCT FROM 'string' OR length(btrim(token)) NOT BETWEEN 1 AND 120 OR token~'[<>[:cntrl:]]' OR lower(token)=ANY(seen) THEN RETURN false;END IF;
   seen:=array_append(seen,lower(token));CONTINUE;
  END IF;
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN RETURN false;END IF;
  FOR k IN SELECT jsonb_object_keys(item)LOOP IF k NOT IN('id','name','detail','image','source') THEN RETURN false;END IF;END LOOP;
  IF jsonb_typeof(item->'name') IS DISTINCT FROM 'string' OR length(btrim(item->>'name')) NOT BETWEEN 1 AND 160 OR item->>'name'~'[<>[:cntrl:]]' THEN RETURN false;END IF;
  IF item?'id' THEN
   token:=item->>'id';IF jsonb_typeof(item->'id') IS DISTINCT FROM 'string' OR token!~'^[A-Za-z0-9_-]{1,80}$' OR token=ANY(seen) THEN RETURN false;END IF;seen:=array_append(seen,token);
  END IF;
  IF item?'detail' AND (jsonb_typeof(item->'detail') IS DISTINCT FROM 'string' OR length(item->>'detail')>500 OR item->>'detail'~'[<>]' OR regexp_replace(item->>'detail',E'[\n\r\t]','','g')~'[[:cntrl:]]') THEN RETURN false;END IF;
  FOREACH k IN ARRAY ARRAY['image','source']LOOP
   IF item?k AND (jsonb_typeof(item->k) IS DISTINCT FROM 'string' OR length(item->>k)>2000 OR ((item->>k)<>'' AND (item->>k)!~'^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]<>]*)?$')) THEN RETURN false;END IF;
  END LOOP;
 END LOOP;RETURN true;
END $$;
CREATE OR REPLACE FUNCTION zoi.assert_hospitality_catalog(p_profile jsonb)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE k text;
BEGIN
 FOREACH k IN ARRAY ARRAY['rooms','dining','venues','amenities']LOOP
 IF p_profile?k AND NOT zoi.hospitality_catalog_valid(k,p_profile->k) THEN RAISE EXCEPTION 'invalid_hospitality_catalog';END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION zoi.hospitality_catalog_valid(text,jsonb),zoi.assert_hospitality_catalog(jsonb) FROM PUBLIC,anon,authenticated;
-- Modify only the catalogue contract in the current definitions, preserving all
-- authority, version, replay, publicity and media safeguards. Fail on drift.
DO $migration$
DECLARE body text;anchor text;
BEGIN
 body:=pg_get_functiondef('public.home_content_save(uuid,uuid,text,uuid,jsonb,jsonb)'::regprocedure);
 anchor:='''highlights'',''event_publicity'')';
 IF strpos(body,anchor)=0 OR strpos(body,'FOR k IN SELECT jsonb_object_keys(p_profile)LOOP')=0 THEN RAISE EXCEPTION 'home_content_catalog_contract_changed';END IF;
 body:=replace(body,anchor,'''highlights'',''event_publicity'',''rooms'',''dining'',''venues'',''amenities'')');
 body:=replace(body,'FOR k IN SELECT jsonb_object_keys(p_profile)LOOP','PERFORM zoi.assert_hospitality_catalog(p_profile);'||chr(10)||'FOR k IN SELECT jsonb_object_keys(p_profile)LOOP');EXECUTE body;
 body:=pg_get_functiondef('zoi.bizpage_save_profile(uuid,uuid,jsonb)'::regprocedure);
 anchor:='v_clean:=zoi.profile_strip(p_profile);';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'profile_catalog_contract_changed';END IF;
 body:=replace(body,anchor,'PERFORM zoi.assert_hospitality_catalog(p_profile);'||chr(10)||anchor);EXECUTE body;
 body:=pg_get_functiondef('zoi.public_owner_content(uuid)'::regprocedure);
 anchor:='''tour'',''event_publicity''))';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'public_owner_catalog_contract_changed';END IF;
 body:=replace(body,anchor,'''tour'',''event_publicity'',''rooms'',''dining'',''venues'',''amenities''))');EXECUTE body;
END $migration$;
NOTIFY pgrst,'reload schema';
COMMIT;
