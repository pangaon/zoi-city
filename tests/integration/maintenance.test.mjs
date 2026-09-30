import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
const container=process.env.ZOI_TEST_POSTGRES_CONTAINER;
let database='postgres';
function sql(text){return new Promise((resolve,reject)=>{const p=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-XAt','-v','ON_ERROR_STOP=1']);let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('close',code=>code?reject(new Error(err)):resolve(out.trim()));p.stdin.end(text);});}
test('bounded production maintenance contracts',{skip:!container},async t=>{
 const name='maintenance_test_'+process.pid;await sql('CREATE DATABASE '+name);database=name;t.after(async()=>{database='postgres';await sql('DROP DATABASE '+name)});
 await sql(`CREATE EXTENSION pg_trgm; CREATE SCHEMA zoi;
 CREATE TABLE zoi.listings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text DEFAULT 'Example',description text,website text,address text,phone text,primary_category_id uuid,verification_status text,source_trust_tier text,entity_type text DEFAULT 'business',profile jsonb DEFAULT '{}',last_seen_at timestamptz,publish_status text DEFAULT 'published',completeness_score numeric,trust_score numeric,freshness_score numeric,region_id uuid);
 CREATE TABLE zoi.audit_log(actor text,action text,target_type text,reason text);
 CREATE TABLE zoi.duplicate_candidates(listing_a_id uuid,listing_b_id uuid,match_signals jsonb,match_score numeric,status text);
 CREATE TABLE zoi.writes(id uuid);
 CREATE FUNCTION zoi.record_write() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN INSERT INTO zoi.writes VALUES(NEW.id); RETURN NEW;END$$;
 CREATE TRIGGER writes AFTER UPDATE ON zoi.listings FOR EACH ROW EXECUTE FUNCTION zoi.record_write();`);
 await sql(readFileSync(new URL('../../supabase/migrations/20260930000424_bounded_listing_maintenance.sql',import.meta.url),'utf8'));
 await t.test('correct scores and archive rules, invalid dates do not abort',async()=>{
  await sql(`INSERT INTO zoi.listings(name,description,website,address,phone,primary_category_id,verification_status,source_trust_tier,last_seen_at) VALUES('Complete','Long description','https://example.invalid','Address','Phone',gen_random_uuid(),'owner_verified','official',now());
  INSERT INTO zoi.listings(name,entity_type,profile) VALUES('Past','event',jsonb_build_object('end_datetime',(current_date-20)::text)),('Annual','event',jsonb_build_object('end_datetime',(current_date-20)::text,'recurring','annual')),('Invalid','event','{"end_datetime":"2026-99-99"}'); SELECT zoi.run_maintenance();`);
  assert.equal(await sql("SELECT concat_ws(',',completeness_score,trust_score,freshness_score) FROM zoi.listings WHERE name='Complete';"),'1.000,0.950,0.95');
  assert.equal(await sql("SELECT publish_status FROM zoi.listings WHERE name='Past';"),'archived');
  assert.equal(await sql("SELECT publish_status FROM zoi.listings WHERE name='Annual';"),'published');
  assert.equal(await sql("SELECT freshness_score FROM zoi.listings WHERE name='Invalid';"),'0.6');
 });
 await t.test('unchanged rows cause zero writes',async()=>{await sql('TRUNCATE zoi.writes; SELECT zoi.run_maintenance();');assert.equal(await sql('SELECT count(*) FROM zoi.writes;'),'0')});
 await t.test('one invocation changes at most1000 rows and converges',async()=>{await sql("TRUNCATE zoi.listings,zoi.writes; INSERT INTO zoi.listings(name) SELECT 'Business '||g FROM generate_series(1,1505)g; SELECT zoi.run_maintenance();");assert.equal(await sql('SELECT count(*) FROM zoi.writes;'),'1000');await sql('TRUNCATE zoi.writes; SELECT zoi.run_maintenance();');assert.equal(await sql('SELECT count(*) FROM zoi.writes;'),'505');await sql('TRUNCATE zoi.writes; SELECT zoi.run_maintenance();');assert.equal(await sql('SELECT count(*) FROM zoi.writes;'),'0')});
 await t.test('duplicate detection requires same place and runs idempotently',async()=>{await sql("TRUNCATE zoi.listings; INSERT INTO zoi.listings(name,website,region_id) VALUES('Greek Bakery','https://example.invalid','00000000-0000-0000-0000-000000000001'),('Greek Bakery','https://example.invalid','00000000-0000-0000-0000-000000000001'),('Greek Bakery','https://example.invalid','00000000-0000-0000-0000-000000000002'); SELECT zoi.run_duplicate_maintenance(); SELECT zoi.run_duplicate_maintenance();");assert.equal(await sql('SELECT count(*) FROM zoi.duplicate_candidates;'),'1')});
 await t.test('public roles cannot invoke maintenance',async()=>{assert.equal(await sql("SELECT has_function_privilege('anon','zoi.run_maintenance()','EXECUTE');"),'f');assert.equal(await sql("SELECT has_function_privilege('authenticated','zoi.run_duplicate_maintenance()','EXECUTE');"),'f')});
});
