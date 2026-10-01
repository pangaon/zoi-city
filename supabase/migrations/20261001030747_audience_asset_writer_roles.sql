begin;
-- Narrow writer guard; shared assert_ws remains unchanged for read callers.
create or replace function zoi.audience_asset_role(p_workspace uuid,p_lock boolean default false)
returns text language plpgsql security definer set search_path='' as $$
declare v_role text; v_creator uuid; v_owner uuid; v_profile uuid;
begin
 if auth.uid() is null then raise exception 'not_signed_in'; end if;
 if p_lock then
  select w.created_by_auth,w.owner_profile_id into v_creator,v_owner from zoi.workspaces w where w.id=p_workspace for update;
 else
  select w.created_by_auth,w.owner_profile_id into v_creator,v_owner from zoi.workspaces w where w.id=p_workspace;
 end if;
 if not found then raise exception 'no_access_to_workspace'; end if;
 select p.id into v_profile from zoi.user_profiles p where p.auth_user_id=auth.uid();
 if p_lock then
  select m.role into v_role from zoi.workspace_members m where m.workspace_id=p_workspace and m.profile_id=v_profile for share;
 else
  select m.role into v_role from zoi.workspace_members m where m.workspace_id=p_workspace and m.profile_id=v_profile;
 end if;
 -- Any explicit membership overrides historical owner/creator authority.
 if found then return coalesce(v_role,''); end if;
 if v_creator=auth.uid() or v_owner=v_profile then return 'owner'; end if;
 raise exception 'no_access_to_workspace';
end; $$;
create or replace function zoi.assert_audience_asset_write(p_workspace uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if zoi.audience_asset_role(p_workspace,true) not in ('owner','admin','editor') then raise exception 'insufficient_permission'; end if;
end; $$;
revoke all on function zoi.audience_asset_role(uuid,boolean),zoi.assert_audience_asset_write(uuid) from public,anon,authenticated;

-- Authoritative capability does not trust shell role or disclose contact data.
create or replace function public.audience_access(p_workspace uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text;
begin
 perform zoi.assert_ws(p_workspace);
 v_role:=zoi.audience_asset_role(p_workspace,false);
 return jsonb_build_object('ok',true,'workspace_id',p_workspace,'role',v_role,'can_write',v_role in ('owner','admin','editor'),'can_record_consent',coalesce(zoi.ops_role(p_workspace) in ('owner','admin','editor'),false));
end; $$;
revoke all on function public.audience_access(uuid) from public,anon;
grant execute on function public.audience_access(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.asset_delete(p_workspace uuid, p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
begin perform zoi.assert_audience_asset_write(p_workspace);
  delete from zoi.assets where id=p_id and workspace_id=p_workspace; return found; end;$function$;

CREATE OR REPLACE FUNCTION public.asset_save(p_workspace uuid, p_url text, p_kind text DEFAULT 'image'::text, p_alt text DEFAULT NULL::text, p_bytes integer DEFAULT NULL::integer, p_width integer DEFAULT NULL::integer, p_height integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
declare v_id uuid;
begin
  perform zoi.assert_audience_asset_write(p_workspace);
  if p_url not like 'https://csebihpaychdkanjjsmz.supabase.co/storage/v1/object/public/media/%' then
    raise exception 'invalid_asset_url'; end if;
  insert into zoi.assets(workspace_id, profile_id, url, kind, alt, bytes, width, height)
    values(p_workspace, zoi.current_profile(), p_url, coalesce(p_kind,'image'), p_alt, p_bytes, p_width, p_height)
    returning id into v_id;
  return v_id;
end;$function$;

CREATE OR REPLACE FUNCTION public.audience_delete(p_workspace uuid, p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
BEGIN
  perform zoi.assert_audience_asset_write(p_workspace);
  DELETE FROM zoi.audience_contacts WHERE id=p_id AND workspace_id=p_workspace;
  RETURN FOUND;
END;$function$;

CREATE OR REPLACE FUNCTION public.audience_import(p_workspace uuid, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
DECLARE r jsonb; added int:=0; skipped int:=0;
BEGIN
  perform zoi.assert_audience_asset_write(p_workspace);
  IF jsonb_array_length(p_rows) > 1000 THEN RAISE EXCEPTION 'max_1000_rows'; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    BEGIN
      IF COALESCE(trim(r->>'name'),'')='' THEN skipped:=skipped+1; CONTINUE; END IF;
      INSERT INTO zoi.audience_contacts(workspace_id,name,email,phone,nameday,tags)
      VALUES(p_workspace, trim(r->>'name'), NULLIF(lower(trim(r->>'email')),''), NULLIF(trim(r->>'phone'),''), NULLIF(trim(r->>'nameday'),''),
        CASE WHEN COALESCE(trim(r->>'tag'),'')='' THEN '{}'::text[] ELSE ARRAY[trim(r->>'tag')] END)
      ON CONFLICT (workspace_id, lower(email)) WHERE email IS NOT NULL DO NOTHING;
      IF FOUND THEN added:=added+1; ELSE skipped:=skipped+1; END IF;
    EXCEPTION WHEN OTHERS THEN skipped:=skipped+1;
    END;
  END LOOP;
  RETURN jsonb_build_object('added',added,'skipped',skipped);
END;$function$;

CREATE OR REPLACE FUNCTION public.audience_upsert(p_workspace uuid, p_name text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_nameday text DEFAULT NULL::text, p_tags text[] DEFAULT '{}'::text[], p_notes text DEFAULT NULL::text, p_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'zoi', 'public'
AS $function$
DECLARE v uuid;
BEGIN
  perform zoi.assert_audience_asset_write(p_workspace);
  IF p_name IS NULL OR length(trim(p_name))=0 THEN RAISE EXCEPTION 'name_required'; END IF;
  IF p_id IS NOT NULL THEN
    UPDATE zoi.audience_contacts SET name=trim(p_name), email=NULLIF(lower(trim(p_email)),''), phone=NULLIF(trim(p_phone),''),
      nameday=NULLIF(trim(p_nameday),''), tags=COALESCE(p_tags,'{}'), notes=p_notes, updated_at=now()
    WHERE id=p_id AND workspace_id=p_workspace RETURNING id INTO v;
  ELSE
    INSERT INTO zoi.audience_contacts(workspace_id,name,email,phone,nameday,tags,notes)
    VALUES(p_workspace, trim(p_name), NULLIF(lower(trim(p_email)),''), NULLIF(trim(p_phone),''), NULLIF(trim(p_nameday),''), COALESCE(p_tags,'{}'), p_notes)
    ON CONFLICT (workspace_id, lower(email)) WHERE email IS NOT NULL
    DO UPDATE SET name=EXCLUDED.name, phone=COALESCE(EXCLUDED.phone,zoi.audience_contacts.phone),
      nameday=COALESCE(EXCLUDED.nameday,zoi.audience_contacts.nameday), updated_at=now()
    RETURNING id INTO v;
  END IF;
  RETURN v;
END;$function$;


commit;
