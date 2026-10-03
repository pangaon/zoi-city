#!/usr/bin/env python3
"""Isolated PostgreSQL only; exact installed writers, no live connections."""
import hashlib,json,os,pathlib,re,shutil,socket,subprocess,tempfile
ROOT=pathlib.Path(os.environ.get('FROZEN_ROOT',pathlib.Path(__file__).resolve().parents[1]))
BASE=ROOT/'docs/audits/evidence/source-takeover-fresh14-2026-10-03'
PG=pathlib.Path('/usr/lib/postgresql/16/bin')
OUT=pathlib.Path(os.environ.get('TAKEOVER_OUTPUT',str(BASE/'isolated-postgres.json')))
work=pathlib.Path(tempfile.mkdtemp(prefix='zoi-takeover-pg-'));data=work/'data';sock=work/'sock';sock.mkdir()
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
def call(args,**kwargs):return subprocess.run(args,text=True,capture_output=True,**kwargs)
def db(sql,ok=True):
 r=call([str(PG/'psql'),'-X','-qAt','-v','ON_ERROR_STOP=1','-h',str(sock),'-p',str(port),'-U','postgres','postgres'],input=sql)
 if ok and r.returncode:raise RuntimeError(r.stderr)
 return r
def lit(s):return "'"+str(s).replace("'","''")+"'"
groups=[]
def pass_group(name):groups.append({'name':name,'passed':True})
baseline=json.loads((BASE/'current-writers.json').read_text())
supplement=json.loads((BASE/'current-writer-supplement.json').read_text())
targets=json.loads((BASE/'quarantine-targets.json').read_text())['targets']
proposal=(ROOT/'ops/proposals/source-takeover-fresh14-2026-10-03.sql').read_text()
try:
 r=call([str(PG/'initdb'),'-D',str(data),'-U','postgres','-A','trust','--no-locale','-E','UTF8'])
 if r.returncode:raise RuntimeError(r.stderr)
 r=call([str(PG/'pg_ctl'),'-D',str(data),'-l',str(work/'pg.log'),'-o',f'-k {sock} -p {port} -h 127.0.0.1','-w','start'])
 if r.returncode:raise RuntimeError(r.stderr)
 columns=json.loads((BASE/'current-table-columns.json').read_text())['rows']
 records=json.loads((BASE/'current-public-records.json').read_text())['rows']
 assert all(r['public_record'].get('embedding') is None for r in records),'Non-null vector cannot be represented by this isolated adapter'
 column_sql=','.join('"'+c['name']+'" '+('text' if c['name']=='embedding' else c['type']) for c in columns)
 db('CREATE ROLE service_role; CREATE SCHEMA zoi; CREATE TABLE zoi.listings('+column_sql+',PRIMARY KEY(id),UNIQUE(slug));')
 rows=baseline['rows']+[{**r,'signature':'zoi.profile_strip(jsonb)'} for r in supplement['rows']]
 for row in sorted(rows,key=lambda r:0 if r['signature'].startswith('zoi.') else 1):
  db(row['definition'])
  signature=row.get('signature','zoi.profile_strip(jsonb)')
  if not signature.startswith('zoi.'):signature='public.'+signature
  if row['acl'] is not None:
   db('REVOKE ALL ON FUNCTION '+signature+' FROM PUBLIC;')
   if 'service_role=X/postgres' in row['acl']:db('GRANT EXECUTE ON FUNCTION '+signature+' TO service_role;')
 fixtures=[{**r['public_record'],'owner_user_id':None,'owner_workspace_id':None} for r in records]
 db('INSERT INTO zoi.listings SELECT * FROM jsonb_populate_recordset(NULL::zoi.listings,'+lit(json.dumps(fixtures))+'::jsonb);')
 before=json.loads(db("SELECT json_agg(to_jsonb(l) ORDER BY id) FROM zoi.listings l;").stdout)
 fixturehash=json.loads(db("SELECT json_agg(jsonb_build_object('id',id,'row_hash',md5(to_jsonb(l)::text),'authored_profile_hash',md5((profile-'_enrich'-'_coverage')::text))) FROM zoi.listings l;").stdout)
 for h in fixturehash:
  t=next(x for x in targets if x['id']==h['id'])
  assert h['row_hash']==t['row_hash'],('Current full public row did not reproduce production MD5',h['id'],h['row_hash'],t['row_hash'])
  assert h['authored_profile_hash']==t['authored_profile_hash']
 pass_group('all fourteen full current rows reproduce exact production row and authored profile fingerprints')
 db(proposal)
 after=json.loads(db("SELECT json_agg(to_jsonb(l) ORDER BY id) FROM zoi.listings l;").stdout)
 assert before==after
 pass_group('default ROLLBACK leaves every row byte-equivalent')
 # Isolated commit validates only existing writer metadata changes.
 db(proposal.replace('\nROLLBACK;','\nCOMMIT;'))
 after=json.loads(db("SELECT json_agg(to_jsonb(l) ORDER BY id) FROM zoi.listings l;").stdout)
 for b,a in zip(before,after):
  assert {k:v for k,v in b.items() if k not in ('profile','updated_at')}=={k:v for k,v in a.items() if k not in ('profile','updated_at')}
  assert {k:v for k,v in b['profile'].items() if k not in ('_enrich','_coverage')}=={k:v for k,v in a['profile'].items() if k not in ('_enrich','_coverage')}
  assert a['profile']['_enrich']['source_url']==b['profile']['_enrich']['source_url']
  assert a['profile']['_enrich'].get('hero_url')==b['profile']['_enrich'].get('hero_url')
  assert a['profile']['_enrich'].get('provenance')==b['profile']['_enrich'].get('provenance')
  assert a['profile']['_enrich']['blocked']=='true' and a['profile']['_enrich']['blocked_reason']=='source_scope_mismatch'
  assert 'lease' not in a['profile']['_enrich']
  assert a['profile']['_coverage']['tasks']['enrichment']['status']=='blocked'
  pass_group('existing writer preservation and blocked receipt '+a['id'])
 def restore():
  db('TRUNCATE zoi.listings;')
  db('INSERT INTO zoi.listings SELECT * FROM jsonb_populate_recordset(NULL::zoi.listings,'+lit(json.dumps(before))+'::jsonb);')
 id=targets[0]['id'];where=' WHERE id='+lit(id)
 adverse={
  'owner user assigned':"owner_user_id='00000000-0000-4000-8000-000000000001'",
  'owner workspace assigned':"owner_workspace_id='00000000-0000-4000-8000-000000000002'",
  'claimed listing':"claim_status='claimed'",
  'explicit raw website clear':"profile=profile||'{\"website\":null}'::jsonb",
  'owner website clear':"profile=profile||'{\"owner_content\":{\"website\":null}}'::jsonb",
  'operational website edit':"profile=profile||'{\"operational\":{\"website\":\"https://owner.example\"}}'::jsonb",
  'entity family changed':"entity_type='vendor'",
  'editorial source changed':"source_url='https://changed.example/editorial'",
  'source website changed':"website='https://replacement.example'",
  'imported source changed':"profile=jsonb_set(profile,'{_enrich,source_url}','\"https://changed.example\"')",
  'hidden marketplace':"marketplace_status='hidden'",
  'quarantine moderation':"moderation_status='quarantine'",
  'NULL moderation':"moderation_status=NULL",
  'unpublished':"publish_status='draft'",
  'unrelated authored edit':"description='Owner concurrent edit'",
  'active enrichment lease':"profile=jsonb_set(profile,'{_enrich,lease}',jsonb_build_object('expires_at',now()+interval '10 minutes'))"
 }
 for name,assignment in adverse.items():
  restore();db('UPDATE zoi.listings SET '+assignment+where+';')
  snapshot=db("SELECT json_agg(to_jsonb(l) ORDER BY id) FROM zoi.listings l;").stdout
  r=db(proposal,ok=False);assert r.returncode and 'takeover_record_preflight_changed' in r.stderr,(name,r.stderr)
  assert db("SELECT json_agg(to_jsonb(l) ORDER BY id) FROM zoi.listings l;").stdout==snapshot
  pass_group('atomic rejection: '+name)
 # Independent semantic gates still reject owner/visibility/source changes even
 # when a reviewer obtains a new row hash. We never rebase the live proposal.
 for name in [x for x in adverse if x not in ('unrelated authored edit','active enrichment lease')]:
  restore();db('UPDATE zoi.listings SET '+adverse[name]+where+';')
  current=db('SELECT md5(to_jsonb(l)::text) FROM zoi.listings l'+where+';').stdout.strip()
  old=next(h['row_hash'] for h in fixturehash if h['id']==id)
  r=db(proposal.replace(old,current),ok=False)
  assert r.returncode and 'takeover_record_preflight_changed' in r.stderr,(name,r.stderr)
  pass_group('independent semantic gate after local hash rebase: '+name)
 restore();db('DELETE FROM zoi.listings'+where)
 r=db(proposal,ok=False);assert r.returncode and 'takeover_target_missing' in r.stderr
 pass_group('atomic rejection: missing exact target')
 restore();db("REVOKE EXECUTE ON FUNCTION public.enrich_apply(jsonb) FROM service_role")
 r=db(proposal,ok=False);assert r.returncode and 'takeover_writer_baseline_changed' in r.stderr
 pass_group('reject changed writer ACL')
 db("GRANT EXECUTE ON FUNCTION public.enrich_apply(jsonb) TO service_role")
 db("CREATE OR REPLACE FUNCTION zoi.enrich_timestamp(p_text text) RETURNS timestamptz LANGUAGE sql STABLE SET search_path TO '' AS 'SELECT NULL::timestamptz'")
 r=db(proposal,ok=False);assert r.returncode and 'takeover_writer_baseline_changed' in r.stderr
 pass_group('reject changed writer body')
 OUT.parent.mkdir(parents=True,exist_ok=True)
 OUT.write_text(json.dumps({'isolated_postgres_only':True,'production_writes':False,'installed_writer_baseline_sha256':hashlib.sha256((BASE/'current-writers.json').read_bytes()).hexdigest(),'proposal_sha256':hashlib.sha256((ROOT/'ops/proposals/source-takeover-fresh14-2026-10-03.sql').read_bytes()).hexdigest(),'groups':groups,'passed':len(groups)},indent=2)+'\n')
 print(json.dumps({'groups':len(groups),'passed':len(groups),'isolated_postgres_only':True}))
finally:
 call([str(PG/'pg_ctl'),'-D',str(data),'-m','immediate','stop'])
 shutil.rmtree(work,ignore_errors=True)
