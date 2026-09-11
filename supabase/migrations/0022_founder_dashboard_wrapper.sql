-- Authenticated founder dashboard boundary.
-- Calls the existing service-role-only dashboard internally, after the founder check.
CREATE OR REPLACE FUNCTION public.zoi_founder_dashboard()
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = zoi, public, pg_temp
AS $$
BEGIN
  IF NOT zoi.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;
  RETURN json_build_object(
    'dashboard', public.zoi_admin_dashboard(),
    'ops', public.zoi_founder_ops()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.zoi_founder_dashboard() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.zoi_founder_dashboard() TO authenticated, service_role;
