from pathlib import Path
import subprocess as S,json,hashlib,os,tempfile,re,shutil,datetime
out=Path(__file__).parent;root=Path('/workspaces/zoi-map-studio-ops-release');draft=Path('/home/codespace/.cache/zoi/wix-factual-root-20261015/requeue-exact-legacy-job-draft.sql');sql=draft.read_text();(out/'reviewed-v2.sql').write_text(sql)
base=Path(tempfile.mkdtemp(prefix='pg-',dir=out));bin=Path('/usr/lib/postgresql/16/bin');env={**os.environ,'PGHOST':str(base),'PGPORT':'15937','PGUSER':'postgres','PGDATABASE':'postgres'}
def run(n,args,**kw):return S.run([str(bin/n),*args],env=env,text=True,capture_output=True,**kw)
def q(text,fail=None):
 r=run('psql',['-X','-qAt','-v','ON_ERROR_STOP=1'],input=text)
 if fail is None:assert r.returncode==0,r.stderr
 else:assert r.returncode!=0 and fail in r.stderr,(fail,r.stderr)
 return r.stdout.strip()
def j(text):return json.loads(q(text))
results=[];started=False
try:
 r=run('initdb',['-D',str(base/'data'),'-U','postgres','-A','trust','--no-locale']);assert r.returncode==0,r.stderr
 r=run('pg_ctl',['-D',str(base/'data'),'-l',str(base/'server.log'),'-o',f"-F -k {base} -p 15937 -h ''",'-w','start']);assert r.returncode==0,r.stderr;started=True
 queue=(root/'supabase/migrations/20261014053517_geography_repair_durable_queue.sql').read_text();table=queue[queue.index('CREATE TABLE zoi.geography_repair_jobs('):queue.index('ALTER TABLE zoi.geography_repair_jobs ENABLE')]
 q('''CREATE SCHEMA zoi;CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
 CREATE TABLE zoi.listings(id uuid primary key,website text,address text,owner_user_id uuid,owner_workspace_id uuid,publish_status text,marketplace_status text,profile jsonb);
 '''+table+'''ALTER TABLE zoi.geography_repair_jobs ADD COLUMN source_generation bigint not null default0,ADD COLUMN source_authority_fingerprint text not null default'';
 CREATE TABLE zoi.geography_capture_ticket_policy(singleton boolean primary key,enabled boolean,starts_at timestamptz,expires_at timestamptz);
 CREATE TABLE zoi.test_flags(current boolean);INSERT INTO zoi.test_flags VALUES(true);
 CREATE VIEW zoi.v_public_listings AS SELECT * FROM zoi.listings WHERE publish_status='published'AND marketplace_status IS DISTINCT FROM'hidden';
 CREATE FUNCTION zoi.geography_fingerprint(l zoi.listings)RETURNS text LANGUAGE sql IMMUTABLE AS $$SELECT md5(to_jsonb(l)::text)$$;
 CREATE FUNCTION zoi.listing_quality_fingerprint(l zoi.listings)RETURNS text LANGUAGE sql IMMUTABLE AS $$SELECT md5(jsonb_build_object('website',l.website,'address',l.address)::text)$$;
 CREATE FUNCTION public.geography_reviewed_point(uuid)RETURNS jsonb LANGUAGE sql AS $$SELECT null::jsonb$$;
 CREATE FUNCTION zoi.geography_source_job_current(j zoi.geography_repair_jobs,l zoi.listings)RETURNS boolean LANGUAGE sql AS $$SELECT current AND j.input_fingerprint=zoi.listing_quality_fingerprint(l)AND l.owner_user_id IS NULL AND l.owner_workspace_id IS NULL AND l.publish_status='published' FROM zoi.test_flags$$;
 CREATE FUNCTION zoi.geography_reviewed_wix_proof(jsonb,jsonb,zoi.listings,zoi.geography_repair_jobs)RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
 CREATE FUNCTION public.geography_review_apply(uuid,uuid,text,text,jsonb)RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
 CREATE TABLE zoi.geography_publisher_host_holds(host text,blocked_until timestamptz);CREATE FUNCTION zoi.geography_publisher_host(text)RETURNS text LANGUAGE sql AS $$SELECT $1$$;
 INSERT INTO zoi.listings VALUES('02e262c3-087f-40ae-aa3c-7c5d93371fef','https://fixture.example/','22 Synthetic Road',null,null,'published',null,'{}');
 INSERT INTO zoi.geography_capture_ticket_policy VALUES(true,true,'2026-10-15T04:42:40.780975Z','2026-10-16T04:42:40.780975Z');
 INSERT INTO zoi.geography_repair_jobs(id,listing_id,strategy,input_fingerprint,database_snapshot,idempotency_key,status,original,source,reason,completed_lease_id,capture_result_hash,attempts,captured_at)
 SELECT '20fccee5-acb6-4b2e-8861-14cbb1da1153',l.id,'official_sources_v1',zoi.listing_quality_fingerprint(l),zoi.geography_fingerprint(l),'synthetic','unresolved','{"website":"https://fixture.example/"}','{"pages":[{"url":"https://fixture.example/"}]}','old unresolved','11111111-1111-4111-8111-111111111111',md5('{"reason":"old", "source":{}, "status":"unresolved"}'::jsonb::text),1,now()FROM zoi.listings l;
 CREATE TABLE zoi.fixture_job AS TABLE zoi.geography_repair_jobs;CREATE TABLE zoi.fixture_listing AS TABLE zoi.listings;
 '''.replace('default0','default 0'))
 # Exact real ordinary lease/finish bodies; all state changes remain local.
 src=(root/'supabase/migrations/20261014165259_geography_repair_continuous_source_enqueue.sql').read_text()
 defs={}
 for name in ['geography_repair_lease','geography_repair_finish']:
  defs[name]=re.search(r'CREATE OR REPLACE FUNCTION public\.'+name+r'\([\s\S]*?AS \$function\$[\s\S]*?\$function\$\s*;',src).group();q(defs[name])
 original=j("SELECT to_jsonb(j)FROM zoi.geography_repair_jobs j");listing=j("SELECT to_jsonb(l)FROM zoi.listings l")
 substitutions={'afacc98be456cde6e87e1951dab1e235':q("SELECT md5(pg_get_functiondef('public.geography_review_apply(uuid,uuid,text,text,jsonb)'::regprocedure))"),'af81ce93951005a651e9eb535fc9e7a352513a52c13ed29ecd4706b5454b6122':q("SELECT encode(extensions.digest(convert_to(to_jsonb(j)::text,'UTF8'),'sha256'),'hex')FROM zoi.geography_repair_jobs j"),'8562ff76b3092fcb058756352d0d9d1e':q("SELECT zoi.geography_fingerprint(l)FROM zoi.listings l"),'385b7c2537b493cb78e8738e30d18765':q("SELECT zoi.listing_quality_fingerprint(l)FROM zoi.listings l")}
 def adapted(s):
  for a,b in substitutions.items():s=s.replace(a,b)
  return s
 local=adapted(sql);(out/'local-adapted-v2.sql').write_text(local)
 q(local);after=j('SELECT to_jsonb(j)FROM zoi.geography_repair_jobs j');assert after['status']=='queued';assert all(after[k]==v for k,v in original.items()if k not in ['status','reason','updated_at']);assert j('SELECT to_jsonb(l)FROM zoi.listings l')==listing;results.append('original full DO, composite subquery fingerprint, receipt SELECT and COMMIT syntax pass; only3job fields change')
 replay=j("SELECT public.geography_repair_finish('20fccee5-acb6-4b2e-8861-14cbb1da1153','11111111-1111-4111-8111-111111111111','{\"reason\":\"old\",\"source\":{},\"status\":\"unresolved\"}')");assert replay['replayed']and replay['status']=='queued';assert j('SELECT to_jsonb(j)FROM zoi.geography_repair_jobs j')==after;results.append('old completed-lease exact finish replay returns queued without changing preserved history')
 leased=j("SELECT to_jsonb(j)FROM public.geography_repair_lease(1,'official_sources_v1')j");assert leased['attempts']==2 and leased['lease_id']!=original['completed_lease_id'];results.append('exact ordinary lease picks requeued row, fresh lease, attempts2, old completed lease preserved')
 q("SELECT public.geography_repair_finish('20fccee5-acb6-4b2e-8861-14cbb1da1153','11111111-1111-4111-8111-111111111111','{\"reason\":\"different\",\"status\":\"unresolved\"}')",'geography_lease_unavailable');results.append('old lease cannot submit changed result over fresh leased job')
 new=json.dumps({'reason':'fresh','source':{'private_archive':'synthetic-private','archive_format':'decoded_utf8_sha256'},'status':'unresolved'});q("SELECT public.geography_repair_finish('20fccee5-acb6-4b2e-8861-14cbb1da1153','"+leased['lease_id']+"','"+new+"'::jsonb)");finished=j('SELECT to_jsonb(j)FROM zoi.geography_repair_jobs j');assert finished['completed_lease_id']==leased['lease_id']and finished['source']['private_archive']=='synthetic-private'and finished['lease_id']is None;results.append('exact ordinary finish replaces capture only under new current lease; listing untouched')
 def reset():q('TRUNCATE zoi.geography_repair_jobs;INSERT INTO zoi.geography_repair_jobs SELECT * FROM zoi.fixture_job;UPDATE zoi.test_flags SET current=true;')
 reset();q(local.replace('COMMIT;','ROLLBACK;'));assert j('SELECT to_jsonb(j)FROM zoi.geography_repair_jobs j')==original;results.append('exact rollback rehearsal restores original entire job/listing')
 reset();q("UPDATE zoi.geography_repair_jobs SET attempts=2");q(local,'legacy_job_changed_or_not_recoverable');assert j('SELECT to_jsonb(j)FROM zoi.geography_repair_jobs j')['status']=='unresolved';results.append('full-row CAS refuses changed job before update')
 reset();q('UPDATE zoi.test_flags SET current=false');q(local,'listing_authority_changed_or_already_reviewed');results.append('current-input refusal')
 reset();q('UPDATE zoi.test_flags SET current=null');q(local,'listing_authority_changed_or_already_reviewed');assert j('SELECT to_jsonb(j)FROM zoi.geography_repair_jobs j')==original;results.append('V2 NULL current-authority predicate refuses and leaves original row')
 reset();q("UPDATE zoi.geography_capture_ticket_policy SET enabled=false");q(local,'original_finite_capture_policy_inactive_or_changed');assert j('SELECT to_jsonb(j)FROM zoi.geography_repair_jobs j')==original;q("UPDATE zoi.geography_capture_ticket_policy SET enabled=true");results.append('disabled original finite policy refuses without job mutation')
 reset();q("""CREATE FUNCTION zoi.fixture_rewrite()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.status='unresolved';RETURN NEW;END$$;CREATE TRIGGER fixture_rewrite BEFORE UPDATE ON zoi.geography_repair_jobs FOR EACH ROW EXECUTE FUNCTION zoi.fixture_rewrite();""");q(local,'recovery_approved_job_fields_not_exact');assert j('SELECT to_jsonb(j)FROM zoi.geography_repair_jobs j')==original;results.append('V2 exact after-state refuses trigger status rewrite and rolls entire update back');q('DROP TRIGGER fixture_rewrite ON zoi.geography_repair_jobs');
 reset();q("UPDATE zoi.geography_repair_jobs SET source=source||'{\"private_archive\":\"already-archived\"}'::jsonb");q(local,'legacy_job_changed_or_not_recoverable');results.append('already archived/changed job refuses')
 reset();q("UPDATE zoi.listings SET owner_user_id='22222222-2222-4222-8222-222222222222'");q(local,'listing_authority_changed_or_already_reviewed');q('TRUNCATE zoi.geography_repair_jobs;DELETE FROM zoi.listings;INSERT INTO zoi.listings SELECT * FROM zoi.fixture_listing;INSERT INTO zoi.geography_repair_jobs SELECT * FROM zoi.fixture_job');results.append('ownership/full listing change refuses')
 # A competing policy mutation holds its row. Recovery must fail bounded rather
 # than queue under a policy value that changes concurrently.
 child=S.Popen([str(bin/'psql'),'-X','-qAt','-v','ON_ERROR_STOP=1'],env=env,stdin=S.PIPE,stdout=S.PIPE,stderr=S.PIPE,text=True)
 try:
  child.stdin.write("BEGIN;UPDATE zoi.geography_capture_ticket_policy SET enabled=false;\\echo READY\n");child.stdin.flush();assert child.stdout.readline().strip()=='READY'
  q(local,'lock timeout');assert j('SELECT to_jsonb(j)FROM zoi.geography_repair_jobs j')==original;results.append('concurrent policy writer blocks FOR SHARE;1s lock timeout rolls recovery back')
 finally:
  child.stdin.write('ROLLBACK;\n');child.stdin.close();child.wait(timeout=5)
 result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'original_sha256':hashlib.sha256(sql.encode()).hexdigest(),'engine':'isolated PostgreSQL16 private socket','production_operations':0,'groups':len(results),'results':results,'controlled_substitutions':{'only_expected_writer_job_listing_quality_hashes':'recomputed for local stubs/synthetic rows; original SQL retained and independently hashed','listing_functions':'minimal local current/quality/fingerprint/public eligibility/Wix existence stubs; not installed authority proof','queue_lease_finish':'exact Git function bodies from20261014165259 with hashes below'},'actual_function_source_sha256':{k:hashlib.sha256(v.encode()).hexdigest()for k,v in defs.items()}};(out/'local-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
finally:
 if started:run('pg_ctl',['-D',str(base/'data'),'-m','immediate','-w','stop'])
 shutil.rmtree(base)
