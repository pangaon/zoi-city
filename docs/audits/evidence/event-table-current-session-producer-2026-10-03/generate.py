import json,pathlib,re
root=pathlib.Path(__file__).resolve().parents[4]
p=pathlib.Path(__file__).parent
rows=json.loads(p.joinpath('baseline-functions.json').read_text()); changed={};notes=[]
def canon(s):return s if s.startswith('zoi.') else 'public.'+s
def guard(a,lock=False):return ('PERFORM zoi.suite_lock_session();' if lock else '')+f"IF zoi.table_inventory_actor() IS DISTINCT FROM {a} THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';END IF;"
actors={'event_host_allocate':'v_actor','event_host_claim':'v_actor','event_host_claim_preview':'v_actor','event_host_get':'v_actor','event_host_guest_save':'v_actor','event_host_list':'v_actor','event_host_receipt':'v_actor','event_host_release':'v_actor','event_host_request_cancel':'v_actor','table_hold_create':'a','table_hold_release':'a','table_hold_status':'a','table_identity_get':'actor','table_identity_receipt':'actor','table_identity_save':'actor','table_inventory_configure':'a','table_inventory_configure_receipt':'a'}
for row in rows:
 sig=row['signature'];name=sig.split('(')[0];d=row['definition'];original=d
 if name=='zoi.table_inventory_actor':
  assert d.count("a:=zoi.ensure_profile();")==1
  d=d.replace("a:=zoi.ensure_profile();","PERFORM zoi.suite_current_session();a:=zoi.ensure_profile();")
 elif name=='zoi.table_inventory_operator':
  d=d.replace('RETURN a;',guard('a')+'RETURN a;')
 elif name=='zoi.event_host_cancelled':
  d=d.replace('return prior.receipt;',guard('p_actor',True)+'return prior.receipt;')
 elif name in actors:
  a=actors[name]
  if name=='table_identity_get':
   d=d.replace('DECLARE s zoi.', 'DECLARE actor uuid;s zoi.').replace('BEGIN PERFORM zoi.table_inventory_operator(p_workspace,p_event);','BEGIN actor:=zoi.table_inventory_operator(p_workspace,p_event);')
  # Every successful result (including nonce history and cancellation) checks and
  # locks the current auth user/session. A failure rolls back all earlier writes.
  d,n=re.subn(r'\bRETURN\s+(?!ING\b)',lambda m:guard(a,True)+m[0],d,flags=re.I)
  assert n,(sig,'no return')
  # Explicit final domain waits additionally check unchanged actor before writes.
  anchors=[]
  if name in ('event_host_claim','event_host_guest_save'):anchors+=['PERFORM 1 FROM zoi.listings WHERE id=a.event_id AND owner_workspace_id=a.workspace_id FOR SHARE;']
  if name=='event_host_guest_save':anchors+=['SELECT * INTO g FROM zoi.event_host_guests WHERE id=p_guest FOR UPDATE;']
  if name=='event_host_allocate':anchors+=['FOR SHARE OF t,v;']
  if name=='table_hold_create':anchors+=['FOR SHARE OF t,v;',"UPDATE zoi.event_table_holds SET status='expired' WHERE event_id=p_event AND status='active' AND expires_at<=clock_timestamp();"]
  if name=='table_hold_release':anchors+=['SELECT * INTO h FROM zoi.event_table_holds WHERE id=p_hold AND profile_id=a FOR UPDATE;']
  if name in ('table_inventory_configure','table_identity_save'):anchors+=['FOR SHARE OF t,v;'] if name=='table_inventory_configure' else ['SELECT * INTO existing FROM public.venue_tables_zones WHERE id=tid FOR UPDATE;','PERFORM 1 FROM zoi.event_table_settings WHERE event_id=p_event FOR UPDATE;']
  if name=='table_inventory_configure':anchors+=['SELECT * INTO c FROM zoi.event_table_settings WHERE event_id=p_event FOR UPDATE;']
  if name in ('table_identity_save','table_identity_receipt','table_inventory_configure','table_inventory_configure_receipt','table_hold_create'):
   if name.startswith('table_identity'):anchors+=["PERFORM pg_advisory_xact_lock(hashtextextended('table-identity-request:'||actor::text||':'||p_request::text,0));"]
   elif name.startswith('table_inventory'):anchors+=["PERFORM pg_advisory_xact_lock(hashtextextended('table-config-request:'||a::text||':'||p_request::text,0));"]
   else:anchors+=["PERFORM pg_advisory_xact_lock(hashtextextended('table-hold-actor:'||a::text,0));"]
  for anchor in anchors:
   assert d.count(anchor)==1,(sig,anchor,d.count(anchor))
   d=d.replace(anchor,anchor+guard(a))
 if d!=original:changed[sig]=d;notes.append({'signature':canon(sig),'changed':True})
# Exact installed source, owner, execution mode, search path and grants all gate
# this transaction. Guards include untouched payment and session dependencies.
values=[]
for row in rows:
 sig=canon(row['signature']);acl=row['acl'];values.append("('%s','%s','%s')"%(sig,row['definition_hash'],acl.replace("'","''")))
header="""-- Draft only: current-session authority for the shared table/host suite.
-- Generated from retained installed definitions; no customer rows are changed.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TEMP TABLE event_authority_expected(signature text PRIMARY KEY,definition_hash text NOT NULL,acl text NOT NULL) ON COMMIT DROP;
INSERT INTO event_authority_expected VALUES
"""+',\n'.join(values)+";\n"
header+="""DO $guard$ DECLARE x record;p pg_proc; BEGIN
 FOR x IN SELECT * FROM event_authority_expected LOOP
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(x.signature);
  IF p.oid IS NULL OR md5(pg_get_functiondef(p.oid)) IS DISTINCT FROM x.definition_hash
   OR pg_get_userbyid(p.proowner) IS DISTINCT FROM 'postgres' OR NOT p.prosecdef
   OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] OR p.proacl::text IS DISTINCT FROM x.acl
  THEN RAISE EXCEPTION 'event_authority_preflight_changed: %',x.signature;END IF;
 END LOOP;
END $guard$;
"""
body='\n\n'.join(d.rstrip()+';' for d in changed.values())
footer="""
DO $guard$ DECLARE x record;p pg_proc; BEGIN
 FOR x IN SELECT * FROM event_authority_expected LOOP
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(x.signature);
  IF pg_get_userbyid(p.proowner) IS DISTINCT FROM 'postgres' OR NOT p.prosecdef
   OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] OR p.proacl::text IS DISTINCT FROM x.acl
  THEN RAISE EXCEPTION 'event_authority_permissions_changed: %',x.signature;END IF;
 END LOOP;
END $guard$;
COMMIT;
"""
root.joinpath('supabase/migrations/20261003094500_event_table_current_session.sql').write_text(header+body+footer)
p.joinpath('change-scope.json').write_text(json.dumps({'guarded_definitions':len(rows),'replaced_definitions':len(changed),'functions':notes},indent=2)+'\n')
print(root,len(rows),len(changed))
