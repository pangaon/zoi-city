// Isolated PostgreSQL16 only. Uses retained public rows and actual writer definitions;
// no Supabase connection or production writes. Production listing triggers are NOT recreated.
import{mkdtempSync,readFileSync,rmSync}from'node:fs';
import{tmpdir}from'node:os';import{join}from'node:path';
import{execFileSync,execFile}from'node:child_process';import{promisify}from'node:util';
import assert from'node:assert/strict';
const run=promisify(execFile),dir=mkdtempSync(join(tmpdir(),'zoi-artist-pg-')),bin='/usr/lib/postgresql/16/bin',port=Number(process.env.ZOI_ARTIST_PGPORT||15549),env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
const base='docs/audits/evidence/kakosaios',batch='docs/audits/evidence/artist-next-batch-2026-10-02',load=p=>JSON.parse(readFileSync(p,'utf8')),exactRows=load(batch+'/target-exact-current-rows.json').records,records=exactRows.map(r=>({row:JSON.parse(r.row_json_text),row_hash:r.row_hash})),manifest=load(batch+'/packets/manifest.json');
const defs=[...load(base+'/current-writer-definitions-refresh-2026-10-02.json').rows,...load(base+'/current-aux-definitions-refresh-2026-10-02.json').rows];
const lit=s=>"'"+String(s).replaceAll("'","''")+"'";
const q=async s=>(await run(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',s],{env})).stdout.trim().split('\n').filter(Boolean);
const rowhash=id=>q(`select md5(to_jsonb(l)::text) from zoi.listings l where id=${lit(id)}`).then(x=>x.at(-1));
let started=false,checks=0;const pass=s=>{checks++;console.log('PASS '+s);};
try{
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--no-locale','--encoding=UTF8'],{stdio:'ignore'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-k ${dir} -p ${port} -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
 const sample=records[0].row,columns=Object.keys(sample).map(k=>{
  const v=records.map(r=>r.row[k]).find(value=>value!==null),type=['id','owner_user_id','owner_workspace_id'].includes(k)?'uuid':k==='profile'||v&&typeof v==='object'?'jsonb':typeof v==='number'?'numeric':typeof v==='boolean'?'boolean':'text';
  return '"'+k+'" '+type;
 });
 await q('create schema zoi;set check_function_bodies=off;create table zoi.listings('+columns.join(',')+');'+defs.map(d=>d.definition+';').join('\n'));
 const restore=async()=>{await q('truncate zoi.listings;'+records.map(r=>`insert into zoi.listings select * from jsonb_populate_record(null::zoi.listings,${lit(exactRows.find(x=>x.id===r.row.id).row_json_text)}::jsonb);`).join('\n'));};
 await restore();
 for(const r of records)assert.equal(await rowhash(r.row.id),r.row_hash);
 pass('retained entire public rows round-trip to exact current production MD5');
 for(const m of manifest.records){
  const sql=readFileSync(m.sql,'utf8'),approve=`select set_config('zoi.publisher_review_actor','isolated-fixture-approval-only',false);select set_config('zoi.publisher_review_packet_sha256',${lit(m.packet_sha256)},false);`;
  await assert.rejects(q(sql),e=>e.stderr.includes('exact_independent_packet_review_required'));
  assert.equal(await rowhash(m.id),m.prior_row_hash);pass(m.name+' refuses absent approval and leaves row intact');
  const result=await q(approve+sql),packet=load(m.packet),body=result.find(line=>line.includes('"source_kind": "label_artist_profile"'));
  assert(body,'transaction readback must contain actual applied enrichment');assert(body.includes(packet.source_url));assert(body.includes('"publisher_source_evidence"'));assert(body.includes(m.packet_sha256));assert(body.includes('isolated-fixture-approval-only'));assert(body.includes('"status": "ok"'));assert(body.includes(packet.proposed_machine_fields.listen.spotify));if(packet.prior_source_url)assert(body.includes(packet.prior_source_url));assert(body.includes('"status": "fetched"'));assert(body.includes('"verification": {"status": "pending"}'));
  assert.equal(await rowhash(m.id),m.prior_row_hash);pass(m.name+' actual lease/apply guarded transaction succeeds and defaultROLLBACK restores exact row');
  await q(`update zoi.listings set owner_workspace_id='10000000-0000-4000-8000-000000000001' where id=${lit(m.id)};`);
  await assert.rejects(q(approve+sql),e=>e.stderr.includes('review_snapshot_changed'));pass(m.name+' stale ownership snapshot refuses source assignment');await restore();
  await q(`update zoi.listings set profile=profile||'{"description":"new owner content"}'::jsonb where id=${lit(m.id)};`);
  await assert.rejects(q(approve+sql),e=>e.stderr.includes('review_snapshot_changed'));pass(m.name+' new protected profile content refuses stale proposal');await restore();
  await assert.rejects(q(approve.replace(m.packet_sha256,'0'.repeat(64))+sql),e=>e.stderr.includes('exact_independent_packet_review_required'));pass(m.name+' wrong reviewed packet hash refuses');
 }
 await restore();
 const allHashes=()=>q("select id::text||':'||md5(to_jsonb(l)::text) from zoi.listings l order by id");
 const baseline=await allHashes();
 await q(`create function zoi.independent_corrupt_review_receipt()returns trigger language plpgsql as $$begin if NEW.profile#>>'{_enrich,publisher_source_evidence,packet_sha256}' is not null then NEW.profile:=jsonb_set(NEW.profile,'{_enrich,publisher_source_evidence,packet_sha256}',to_jsonb('forged-saved-receipt'::text));end if;return NEW;end$$;create trigger independent_corrupt before update on zoi.listings for each row execute function zoi.independent_corrupt_review_receipt();`);
 for(const m of manifest.records){
  const sql=readFileSync(m.sql,'utf8'),approve=`select set_config('zoi.publisher_review_actor','independent-adversarial-review',false);select set_config('zoi.publisher_review_packet_sha256',${lit(m.packet_sha256)},false);`;
  await assert.rejects(q(approve+sql),e=>e.stderr.includes('publisher_projection_fields_missing'));
  assert.deepEqual(await allHashes(),baseline);pass('independent '+m.name+' corrupt actual saved provenance rejects and restores entire batch');
 }
 await q('drop trigger independent_corrupt on zoi.listings;drop function zoi.independent_corrupt_review_receipt();');
 for(const m of manifest.records){
  const sql=readFileSync(m.sql,'utf8'),approve=`select set_config('zoi.publisher_review_actor','independent-adversarial-review',false);select set_config('zoi.publisher_review_packet_sha256',${lit(m.packet_sha256)},false);`;
  await q(`update zoi.listings set website='https://changed-owner-source.invalid/' where id=${lit(m.id)};`);
  await assert.rejects(q(approve+sql),e=>e.stderr.includes('review_snapshot_changed'));pass('independent '+m.name+' current source assignment drift refuses');await restore();assert.deepEqual(await allHashes(),baseline);
 }
 await q("create or replace function zoi.enrich_timestamp(p_text text)returns timestamptz language sql as $$select nullif(p_text,'')::timestamptz$$;");
 const m=manifest.records[0],sql=readFileSync(m.sql,'utf8');await assert.rejects(q(`select set_config('zoi.publisher_review_actor','isolated-fixture-only',false);select set_config('zoi.publisher_review_packet_sha256',${lit(m.packet_sha256)},false);`+sql),e=>e.stderr.includes('writer_definition_changed:zoi.enrich_timestamp'));pass('actual helper definition drift refuses before row lock/write');
 console.log(JSON.stringify({checks,production_writes:0,fixture:'retained row shape + exact function bodies, no production triggers',port}));
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}
