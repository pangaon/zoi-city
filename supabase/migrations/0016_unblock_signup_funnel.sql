-- THE CONVERSION PATH WAS BLOCKED FOR EVERY NEW USER.
--
-- Walked end to end with a real throwaway account: sign up, sign in, then
-- zoi_me returns {"authenticated": true, "profile": null, "workspaces": []} and
-- zoi_create_workspace returns {"ok": false, "error": "no_profile"}.
--
-- No profile means no workspace. No workspace means no claim. No claim means the
-- business can never edit its page. Nothing in the sign-up path creates a
-- profile: there is no trigger on auth.users, and the suite never asks for one.
--
-- zoi.ensure_profile() has always existed and does exactly the right thing —
-- it just only ever got called incidentally, by feed_post(). So a person who
-- happened to post in the community feed first could then claim a business, and
-- a person who went straight to claiming could not. That is the whole funnel
-- resting on an accident.
--
-- Creating a workspace obviously implies needing a profile, so the function now
-- makes one instead of refusing. Being signed in is still required.

BEGIN;

CREATE OR REPLACE FUNCTION public.zoi_create_workspace(p_name text, p_kind text DEFAULT 'business'::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_prof uuid; v_ws uuid; v_kind text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_signed_in');
  END IF;
  -- Was: fail with 'no_profile' if none existed. Now: create it. This single
  -- line is the difference between a directory and a business.
  v_prof := zoi.ensure_profile();
  IF v_prof IS NULL THEN RETURN json_build_object('ok', false, 'error', 'no_profile'); END IF;

  v_kind := lower(coalesce(p_kind, 'business'));
  IF v_kind NOT IN ('business','creator','organization','community','personal','agency') THEN v_kind := 'business'; END IF;
  INSERT INTO zoi.workspaces(name, kind, owner_profile_id, created_by_auth)
  VALUES (p_name, v_kind, v_prof, auth.uid()) RETURNING id INTO v_ws;
  INSERT INTO zoi.workspace_members(workspace_id, profile_id, role)
  VALUES (v_ws, v_prof, 'owner');
  RETURN json_build_object('ok', true, 'workspace_id', v_ws, 'name', p_name, 'kind', v_kind);
END$function$;

-- And an explicit way for the front end to bootstrap a profile on first load, so
-- no other path can be blocked by the same missing row. Signed-in callers only;
-- it can only ever create a profile for whoever is calling.
CREATE OR REPLACE FUNCTION public.profile_ensure()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_prof uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  v_prof := zoi.ensure_profile();
  RETURN json_build_object('ok', v_prof IS NOT NULL, 'profile_id', v_prof);
END$function$;

REVOKE ALL ON FUNCTION public.profile_ensure() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profile_ensure() FROM anon;
GRANT EXECUTE ON FUNCTION public.profile_ensure() TO authenticated, service_role;

-- Tidy while we are here: bizpage_* still carried the anon EXECUTE that
-- Supabase's default privileges grant to every new function in public. Not
-- exploitable — assert_ws() returns 'not_signed_in' to an anonymous caller, which
-- I verified against production before changing anything — but a write path
-- should not be reachable by a role that can never succeed at it.
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.bizpage_status(uuid)',
    'public.bizpage_get(uuid,uuid)',
    'public.bizpage_save(uuid,uuid,text,text,text,text,text,text,text,jsonb)',
    'public.bizpage_save_profile(uuid,uuid,jsonb)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

COMMIT;
