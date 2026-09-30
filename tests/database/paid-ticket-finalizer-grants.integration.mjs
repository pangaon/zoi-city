import{mkdtempSync,readFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{execFileSync}from'node:child_process';import assert from'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'zoi-paid-grants-')),bin='/usr/lib/postgresql/16/bin',env={...process.env,PGHOST:dir,PGPORT:'15519',PGDATABASE:'postgres'};let started=false;const q=sql=>execFileSync(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',sql],{env,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
try{execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--no-locale'],{stdio:'ignore'});execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-k ${dir} -p 15519 -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
q("create role anon;create role authenticated;create role service_role;create function public.tickets_paid_finalize(text,uuid,bigint,text,text,integer,integer) returns jsonb language sql security definer as $$select '{\"ok\":true}'::jsonb$$;");
assert.equal(q("select has_function_privilege('anon','public.tickets_paid_finalize(text,uuid,bigint,text,text,integer,integer)','execute')"),'t');
q(readFileSync(new URL('../../supabase/migrations/20260930082532_restrict_paid_ticket_finalizer.sql',import.meta.url),'utf8'));
assert.equal(q(readFileSync(new URL('../../ops/qa-paid-ticket-finalizer-grants.sql',import.meta.url),'utf8')),'t');
for(const role of ['anon','authenticated'])assert.throws(()=>q(`set role ${role};select public.tickets_paid_finalize('not-a-real-session',null,1,'QA','qa@example.org',1,0);`),/permission denied/);
assert.equal(JSON.parse(q("set role service_role;select public.tickets_paid_finalize('fixture-only',null,1,'QA','qa@example.org',1,0);" )).ok,true);
console.log('PASS public inheritance revoked, anon/auth calls denied, service-only preserved, exact metadata fixture passes (4 checks)');
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}
