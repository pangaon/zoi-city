-- Live trigger definition reviewed 2026-09-30; regression fixture only.
CREATE OR REPLACE FUNCTION zoi.tg_apply_publish_gate()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE v_gate jsonb;
BEGIN
  IF NEW.publish_status IS NULL OR NEW.publish_status IN ('draft','published') THEN
    v_gate := zoi.publish_gate(NEW.name, NEW.entity_type, NEW.primary_category_id,
                               NEW.city, NEW.country, NEW.phone, NEW.address, NEW.website);

    IF (v_gate->>'ok')::boolean THEN
      NEW.publish_status := 'published';
    ELSE
      NEW.publish_status := 'pending_review';
    END IF;

    NEW.profile := coalesce(NEW.profile,'{}'::jsonb) || jsonb_build_object(
      'gate', jsonb_build_object(
        'ok', v_gate->'ok',
        'fails', v_gate->'fails',
        'warnings', v_gate->'warnings',
        'checked_at', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')
      ));
    -- completeness_score is a 0..1 fraction in this schema
    NEW.completeness_score := round(((v_gate->>'quality_score')::numeric / 100.0), 3);
  END IF;
  RETURN NEW;
END;
$function$
