BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
-- Explicit reviewed source fingerprints, not a snapshot of whatever happens to be installed.
-- A partial stack may expose Menu/Setup/Queue independently; guest/operator lifecycle requires cash too.
CREATE FUNCTION zoi.service_installed_stage(p_stage text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE manifest jsonb:='{
  "menu": {
    "functions": [
      {
        "signature": "zoi.service_menu_revision()",
        "hash": "0049176c476b68f140a4060a931a5441",
        "definer": false,
        "language": "plpgsql"
      },
      {
        "signature": "zoi.service_menu_authorize(uuid)",
        "hash": "28beb08b7e67b1f76f531729e9c62238",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "zoi.service_menu_capacity()",
        "hash": "b8cf255cecaf7aa268fdd4c1d5b5e716",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.service_menu_list(uuid)",
        "hash": "b067ebbad322407ab3fe414ab1935cee",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.menu_item_save_once(uuid,uuid,uuid,integer,jsonb)",
        "hash": "51f21527adc3504d4644315524186072",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.service_menu_request(uuid,uuid,boolean)",
        "hash": "cceefcc5aaeaf60c89818cd859474983",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.menu_item_save(uuid,uuid,text,text,integer,text,boolean)",
        "hash": "63b18168e53fa32896c64c56b0f47194",
        "definer": true,
        "language": "plpgsql"
      }
    ],
    "triggers": [
      {
        "name": "service_menu_revision",
        "table": "public.menu_items",
        "function": "zoi.service_menu_revision()",
        "type": 19,
        "deferred": false,
        "deferrable": false
      }
    ],
    "tables": [
      "zoi.service_menu_requests",
      "public.menu_items"
    ]
  },
  "setup": {
    "functions": [
      {
        "signature": "zoi.event_service_setup_authorize(uuid,uuid,uuid)",
        "hash": "d2d31fdae9ded52a8ff244242649a2c5",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.event_service_setup_context(uuid,uuid,uuid)",
        "hash": "e30d8a2df62a6cf8cd16bef2e45d8417",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.event_service_setup_get(uuid,uuid,uuid)",
        "hash": "7366c2bd9b86b4119ac42df8f68a81c7",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "zoi.event_service_setup_capacity()",
        "hash": "2313c0fa7b1b9830dd9f358d27d5a691",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.event_service_setup_save(uuid,uuid,uuid,integer,uuid,jsonb)",
        "hash": "671befeb802f1a40cb9bfc0f6a3393b4",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.event_service_setup_request(uuid,uuid,uuid,uuid,boolean)",
        "hash": "1e5f92c2b8de32b1273526d86b1acb05",
        "definer": true,
        "language": "plpgsql"
      }
    ],
    "triggers": [],
    "tables": [
      "zoi.event_service_configurations",
      "zoi.event_service_configuration_requests"
    ]
  },
  "queue": {
    "functions": [
      {
        "signature": "zoi.service_order_revision()",
        "hash": "94a3a3610190d80f9b12aade7678c48f",
        "definer": false,
        "language": "plpgsql"
      },
      {
        "signature": "zoi.service_order_item_revision()",
        "hash": "4e6563c83a16c301f799e6046bc2c621",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "zoi.service_queue_authorize(uuid,uuid)",
        "hash": "13dcabfaf107319db6e5a5cd27e87044",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "zoi.service_queue_capacity()",
        "hash": "109fb8ccbce2ee8e21ca71d1deff87e5",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.service_queue_list(uuid,text,uuid)",
        "hash": "94ddcacd26f9b6262df8d62a9e53c27c",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.kds_ticket_advance_once(uuid,uuid,integer,text,uuid)",
        "hash": "4ba7db654685f56a5e7021d63df4b83a",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.service_queue_request(uuid,uuid,uuid,boolean)",
        "hash": "17c098d245cba857bdb165863c80a151",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.kds_ticket_advance(uuid,uuid,text)",
        "hash": "9da8e7e08ed6068adc7645088be73003",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.kds_tickets_list(uuid,text)",
        "hash": "ab516de05eccc0593bf5a5d79ea0f2f5",
        "definer": true,
        "language": "sql"
      }
    ],
    "triggers": [
      {
        "name": "service_order_revision",
        "table": "public.event_orders",
        "function": "zoi.service_order_revision()",
        "type": 19,
        "deferred": false,
        "deferrable": false
      },
      {
        "name": "service_order_item_revision",
        "table": "public.event_order_items",
        "function": "zoi.service_order_item_revision()",
        "type": 29,
        "deferred": false,
        "deferrable": false
      }
    ],
    "tables": [
      "zoi.service_queue_requests",
      "public.event_orders",
      "public.event_order_items"
    ]
  },
  "lifecycle": {
    "functions": [
      {
        "signature": "zoi.event_service_receipt(text,uuid,uuid,jsonb)",
        "hash": "b902b689399ec743f7a05f70c627106d",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "zoi.event_service_record(text,uuid,uuid,jsonb,jsonb)",
        "hash": "52b086b5767bd956046745e6ca105d6e",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "zoi.event_service_scope(uuid,uuid,boolean,boolean)",
        "hash": "b5dac461bfb4d2b8f3a1c5b99ce782c6",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.event_service_start(uuid,uuid,uuid,integer,uuid)",
        "hash": "a665522395935f15cd3d8772f97bef0b",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "zoi.event_service_source_guest(uuid)",
        "hash": "b38c688fc214fefe74d48a375121fb22",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.event_service_admit(uuid,uuid,uuid,integer,boolean,uuid)",
        "hash": "5413f70ba973d0d82a5a3fb1eee544d2",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "zoi.event_service_participant(uuid,uuid)",
        "hash": "8ec5113d372b42d515b57129f1c578a4",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.event_service_order(uuid,uuid,integer,jsonb,uuid)",
        "hash": "6f28cd5515e03bfa9cfc81c5016e9203",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "zoi.event_service_item_immutable()",
        "hash": "2e0d0f6c7ca6e5a958714518ea765df3",
        "definer": false,
        "language": "plpgsql"
      },
      {
        "signature": "zoi.event_service_order_transition()",
        "hash": "92c95f794831c3fa57f63b3377a81714",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.event_service_approval(uuid,uuid,integer,boolean,boolean,uuid)",
        "hash": "0ae3df802c7658e7b3acda572682b90f",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.event_service_control(uuid,integer,text,uuid)",
        "hash": "1cbb70f09252124fd702f342e3c04729",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.event_service_revoke_admission(uuid,uuid,integer,uuid)",
        "hash": "d3b6b702ea3c2d97a0312ca0cfec1076",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.event_service_request(text,uuid,uuid,uuid,boolean)",
        "hash": "5bdbcaa5f57c939c650e442f88ff60b6",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.event_service_sessions(uuid,uuid,uuid)",
        "hash": "bd00a135f14f1beb8da86a2c2484515a",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.event_service_operator_view(uuid,uuid,text,uuid)",
        "hash": "1eb9ecb4754deb816bfa1f21aed44ba7",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.event_service_guest_view(uuid,uuid,uuid)",
        "hash": "aed3f197deb7d764a58f58a1f8154787",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.event_service_my_tables(uuid)",
        "hash": "51adb3b3bc32faebef6ddc228f1e4245",
        "definer": true,
        "language": "plpgsql"
      }
    ],
    "triggers": [
      {
        "name": "event_service_tab_guard",
        "table": "public.table_tabs",
        "function": "zoi.event_service_tab_guard()",
        "type": 19,
        "deferred": false,
        "deferrable": false
      },
      {
        "name": "event_service_item_immutable",
        "table": "public.event_order_items",
        "function": "zoi.event_service_item_immutable()",
        "type": 27,
        "deferred": false,
        "deferrable": false
      },
      {
        "name": "event_service_order_transition",
        "table": "public.event_orders",
        "function": "zoi.event_service_order_transition()",
        "type": 19,
        "deferred": false,
        "deferrable": false
      }
    ],
    "tables": [
      "zoi.event_service_sessions",
      "zoi.event_service_stock",
      "zoi.event_service_ledger",
      "zoi.event_service_requests",
      "zoi.event_service_admissions",
      "public.table_tabs",
      "public.table_members"
    ]
  },
  "cash": {
    "functions": [
      {
        "signature": "zoi.event_service_tab_guard()",
        "hash": "e5bd2275e3b9b427d39a0ce679837136",
        "definer": false,
        "language": "plpgsql"
      },
      {
        "signature": "zoi.event_service_cash_immutable()",
        "hash": "06d333b6f067026ccdf6c74ae5080dd0",
        "definer": false,
        "language": "plpgsql"
      },
      {
        "signature": "zoi.event_service_payment_guard()",
        "hash": "4587e506aba53882ea7b6962379fe79e",
        "definer": false,
        "language": "plpgsql"
      },
      {
        "signature": "zoi.event_service_tab_consistency()",
        "hash": "495c43a4f67287bcee495b754a96a57e",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "zoi.event_service_close_reconciled()",
        "hash": "2661ad1f408624963a859a60280e1a87",
        "definer": false,
        "language": "plpgsql"
      },
      {
        "signature": "zoi.event_service_cash_scope(uuid,uuid)",
        "hash": "c056615413c739ade5068b85a77e1a33",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.event_service_cash_record(uuid,uuid,integer,text,integer,uuid,text,boolean,uuid)",
        "hash": "84b64bdb67d1cbae1fa3becfbb49d69f",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.event_service_cash_request(uuid,uuid,uuid,boolean)",
        "hash": "973310a9b8fa6dc5865a12a2e85246b1",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "public.event_service_cash_view(uuid,uuid)",
        "hash": "5d1cf7e5acbbe9d59a256a3a77bdb0be",
        "definer": true,
        "language": "plpgsql"
      }
    ],
    "triggers": [
      {
        "name": "event_service_cash_immutable",
        "table": "zoi.event_service_cash_ledger",
        "function": "zoi.event_service_cash_immutable()",
        "type": 27,
        "deferred": false,
        "deferrable": false
      },
      {
        "name": "event_service_payment_guard",
        "table": "public.tab_payments",
        "function": "zoi.event_service_payment_guard()",
        "type": 31,
        "deferred": false,
        "deferrable": false
      },
      {
        "name": "event_service_tab_consistency",
        "table": "public.table_tabs",
        "function": "zoi.event_service_tab_consistency()",
        "type": 17,
        "deferred": true,
        "deferrable": true
      },
      {
        "name": "event_service_close_reconciled",
        "table": "zoi.event_service_sessions",
        "function": "zoi.event_service_close_reconciled()",
        "type": 19,
        "deferred": false,
        "deferrable": false
      }
    ],
    "tables": [
      "zoi.event_service_cash_ledger",
      "public.tab_payments"
    ]
  },
  "authority": {
    "functions": [
      {
        "signature": "zoi.suite_lock_session()",
        "hash": "ab5f8703ced5f96c0ac69257281ffe00",
        "definer": true,
        "language": "plpgsql"
      },
      {
        "signature": "zoi.workspace_locked_role(uuid)",
        "hash": "0c25b1e04d01e5866b58d009fa1f50b9",
        "definer": true,
        "language": "plpgsql"
      }
    ],
    "triggers": [],
    "tables": []
  }
}'::jsonb;spec jsonb;f jsonb;t jsonb;p pg_catalog.pg_proc;c pg_catalog.pg_class;tr pg_catalog.pg_trigger;role_name text;privilege_name text;BEGIN
 spec:=manifest->p_stage;IF spec IS NULL THEN RETURN false;END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(spec->'functions') LOOP
  SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=to_regprocedure(f->>'signature');
  IF NOT FOUND OR md5(p.prosrc) IS DISTINCT FROM f->>'hash' OR p.prosecdef IS DISTINCT FROM (f->>'definer')::boolean OR (SELECT lanname FROM pg_catalog.pg_language WHERE oid=p.prolang) IS DISTINCT FROM f->>'language' OR NOT(coalesce(p.proconfig,ARRAY[]::text[]) @> ARRAY['search_path=""']) THEN RETURN false;END IF;
  IF f->>'signature' LIKE 'public.%' THEN
   IF NOT has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE') THEN RETURN false;END IF;
  ELSE
   IF has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE') THEN RETURN false;END IF;
  END IF;
 END LOOP;
 FOR t IN SELECT value FROM jsonb_array_elements(spec->'triggers') LOOP
  SELECT * INTO tr FROM pg_catalog.pg_trigger WHERE tgrelid=to_regclass(t->>'table') AND tgname=t->>'name';
  IF NOT FOUND OR tr.tgfoid IS DISTINCT FROM to_regprocedure(t->>'function') OR tr.tgenabled NOT IN('O','A') OR tr.tgtype IS DISTINCT FROM (t->>'type')::smallint OR tr.tgdeferrable IS DISTINCT FROM (t->>'deferrable')::boolean OR tr.tginitdeferred IS DISTINCT FROM (t->>'deferred')::boolean OR tr.tgqual IS NOT NULL OR tr.tgnargs<>0 OR tr.tgattr::text<>'' THEN RETURN false;END IF;
 END LOOP;
 FOR t IN SELECT value FROM jsonb_array_elements(spec->'tables') LOOP
  SELECT * INTO c FROM pg_catalog.pg_class WHERE oid=to_regclass(t#>>'{}');IF NOT FOUND OR NOT c.relrowsecurity THEN RETURN false;END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
    IF has_table_privilege(role_name,c.oid,privilege_name) THEN RETURN false;END IF;
   END LOOP;
   FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE'] LOOP
    IF has_any_column_privilege(role_name,c.oid,privilege_name) THEN RETURN false;END IF;
   END LOOP;
  END LOOP;
 END LOOP;
 RETURN true;
END$$;
CREATE FUNCTION public.event_service_capabilities(p_workspace uuid DEFAULT NULL,p_event uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE role_name text;profile_id uuid;menu_ok boolean;setup_ok boolean;queue_ok boolean;full_ok boolean;BEGIN
 IF NOT zoi.service_installed_stage('authority') THEN RAISE EXCEPTION 'service_capability_unavailable';END IF;
 IF (p_workspace IS NULL)=(p_event IS NULL) THEN RAISE EXCEPTION 'exact_service_context_required';END IF;
 IF p_workspace IS NOT NULL THEN
  role_name:=zoi.workspace_locked_role(p_workspace);
  IF coalesce(role_name,'') NOT IN('owner','admin','editor','viewer') THEN RAISE EXCEPTION 'insufficient_permission' USING errcode='42501';END IF;
 ELSE
  PERFORM zoi.suite_lock_session();role_name:='guest';
  PERFORM 1 FROM zoi.listings WHERE id=p_event AND entity_type='event' AND publish_status='published' AND moderation_status IN('clean','cleared') AND coalesce(marketplace_status,'')<>'hidden' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event_unavailable' USING errcode='42501';END IF;
 END IF;
 PERFORM zoi.suite_lock_session();
 SELECT id INTO profile_id FROM zoi.user_profiles WHERE auth_user_id=auth.uid();
 IF profile_id IS NULL THEN RAISE EXCEPTION 'profile_unavailable' USING errcode='42501';END IF;
 menu_ok:=zoi.service_installed_stage('menu');setup_ok:=menu_ok AND zoi.service_installed_stage('setup');queue_ok:=zoi.service_installed_stage('queue');
 full_ok:=setup_ok AND queue_ok AND zoi.service_installed_stage('lifecycle') AND zoi.service_installed_stage('cash');
 RETURN jsonb_build_object('ok',true,'version',1,'auth_user_id',auth.uid(),'actor_profile_id',profile_id,'workspace_id',p_workspace,'event_id',p_event,'role',role_name,'capabilities',jsonb_build_object('menu',CASE WHEN menu_ok AND role_name IN('owner','admin','editor') THEN 1 ELSE 0 END,'setup',CASE WHEN setup_ok AND role_name IN('owner','admin') THEN 1 ELSE 0 END,'queue',CASE WHEN queue_ok AND role_name IN('owner','admin','editor') THEN 1 ELSE 0 END,'lifecycle',CASE WHEN full_ok AND role_name IN('owner','admin','guest') THEN 1 ELSE 0 END));
END$$;
REVOKE ALL ON FUNCTION zoi.service_installed_stage(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.event_service_capabilities(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.event_service_capabilities(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
