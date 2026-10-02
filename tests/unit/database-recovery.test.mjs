import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../scripts/database-recovery.mjs',import.meta.url),'utf8').replace(/^#!.*\n/,'');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const healthy = JSON.stringify(['db','auth','rest'].map(name=>({name,status:'ACTIVE_HEALTHY',healthy:true})));
async function run(mode,failedRestart=false,failedRead='',bodies={}){
 const calls=[],logs=[];
 const process={argv:['node','script',mode],env:{SUPABASE_ACCESS_TOKEN:'test-token'}};
 await new AsyncFunction('process','fetch','console',source)(process,async(url,opts)=>{
  calls.push({url,opts});
  if(url.endsWith('/restart')&&failedRestart) throw new Error('ambiguous connection timeout');
  if(failedRead&&url.includes(failedRead))return {ok:false,status:500,text:async()=>JSON.stringify({code:'SERVICE_UNAVAILABLE',message:'sensitive-message'})};
  if(url.endsWith('/config/disk/util'))return {ok:true,status:200,text:async()=>bodies.disk??JSON.stringify({timestamp:new Date().toISOString(),metrics:{fs_size_bytes:100,fs_avail_bytes:40,fs_used_bytes:60}})};
  if(url.endsWith('/config/disk'))return {ok:true,status:200,text:async()=>bodies.config??JSON.stringify({attributes:{type:'gp3',iops:3000,size_gb:20}})};
  return {ok:true,status:200,text:async()=>url.includes('/health?')?(bodies.health??healthy):url.endsWith('/database/query')?'[{"diagnostics":{}}]':(bodies.metrics??'node_memory_MemAvailable_bytes 12345\n')};
 },{log:s=>logs.push(s),error:s=>logs.push(s)});
 return {calls,logs,process};
}
test('inspect and recover never mutate and request read-only SQL',async()=>{
 for(const mode of ['inspect','recover']){
  const result=await run(mode);
  assert.equal(result.calls.length,3);
  assert.ok(!result.calls.some(c=>c.url.endsWith('/restart')));
  assert.equal(JSON.parse(result.calls[2].opts.body).read_only,true);
  assert.ok(!result.logs.join('').includes('test-token'));
 }
});
test('restart records diagnostics then makes exactly one restart request',async()=>{
 const {calls}=await run('restart');
 assert.equal(calls.length,3);
 assert.ok(calls[0].url.includes('/health?'));
 assert.ok(calls[1].url.endsWith('/metrics'));
 assert.ok(calls[2].url.endsWith('/restart'));
 assert.equal(calls[2].opts.method,'POST');
});
test('ambiguous restart failure is not retried',async()=>{
 const {calls,process}=await run('restart',true);
 assert.equal(calls.filter(c=>c.url.endsWith('/restart')).length,1);
 assert.equal(process.exitCode,1);
});

test('health uses documented repeated service parameters and bounded timeout',async()=>{
 const {calls}=await run('inspect');
 const url=new URL(calls[0].url);
 assert.deepEqual(url.searchParams.getAll('services'),['db','auth','rest']);
 assert.equal(url.searchParams.get('timeout_ms'),'5000');
 assert.equal(calls[0].opts.method,'GET');
});
test('diagnostic observation and query ages use wall clock rather than transaction start',async()=>{
 const {calls}=await run('inspect');
 const {query,read_only}=JSON.parse(calls[2].opts.body);
 assert.equal(read_only,true);
 assert.match(query,/'checked_at',clock_timestamp\(\)/);
 assert.match(query,/extract\(epoch from clock_timestamp\(\)-query_start\)/);
 assert.doesNotMatch(query,/\bnow\(\)/);
});

test('mandatory diagnostic failures are nonzero and only safe error codes are logged',async()=>{
 for(const endpoint of ['/health?','/analytics/endpoints/metrics']){
  const {process,logs,calls}=await run('inspect',false,endpoint);
  assert.equal(process.exitCode,1);
  assert.match(logs.join(''),/SERVICE_UNAVAILABLE/);
  assert.doesNotMatch(logs.join(''),/sensitive-message/);
  assert.equal(calls.length,3);
 }
});
test('activity output identifies diagnostics before keyword categories without exposing SQL',async()=>{
 const {calls}=await run('inspect');
 const {query}=JSON.parse(calls[2].opts.body);
 assert.match(query,/as operation/);
 assert.match(query,/as is_diagnostic/);
 assert.ok(query.indexOf("then 'diagnostic'")<query.indexOf("then 'enrichment'"));
 assert.match(query,/pid<>pg_backend_pid\(\)/);
});

test('complete ACTIVE_HEALTHY health and finite resource metrics pass',async()=>{
 const {process}=await run('inspect');
 assert.equal(process.exitCode,undefined);
});
test('HTTP 200 incomplete, malformed, duplicate, starting or unhealthy services fail closed',async()=>{
 const rows=JSON.parse(healthy);
 const invalid=['not json','null','{}','[]',JSON.stringify(rows.slice(0,2)),JSON.stringify([...rows,rows[0]])];
 for(const status of ['UNHEALTHY','COMING_UP','UNKNOWN',undefined])invalid.push(JSON.stringify(rows.map((r,i)=>i? r:{...r,status,healthy:true})));
 for(const health of invalid){
  const {process}=await run('inspect',false,'',{health});
  assert.equal(process.exitCode,1,health);
 }
});
test('HTTP 200 empty or malformed metrics cannot masquerade as usable resource diagnostics',async()=>{
 for(const metrics of ['', '   ', '<html>error</html>', '# HELP node_memory_usage bytes', 'node_memory_usage nope', 'node_memory_usage NaN', 'node_memory_usage 1e999']){
  const {process}=await run('inspect',false,'',{metrics});
  assert.equal(process.exitCode,1,metrics);
 }
});

test('resources uses documented comma health encoding and only four bounded GET reads',async()=>{
 const {calls,process}=await run('resources');
 assert.equal(calls.length,4);assert.equal(process.exitCode,undefined);
 assert.equal(new URL(calls[0].url).searchParams.get('services'),'db,auth,rest');
 assert.ok(calls.every(c=>c.opts.method==='GET'&&!c.opts.body));
 assert.ok(!calls.some(c=>/database\/query|restart/.test(c.url)));
});
test('resource read failures do not trigger SQL, mutation or repeat',async()=>{
 for(const endpoint of ['/health?','/analytics/endpoints/metrics','/config/disk/util','/config/disk']){
  const {calls,logs,process}=await run('resources',false,endpoint);
  assert.equal(process.exitCode,1);assert.equal(calls.length,4);
  assert.ok(calls.every(c=>c.opts.method==='GET'));
  assert.doesNotMatch(logs.join(''),/sensitive-message|test-token/);
 }
});
test('disk diagnostic output allowlists finite values and discards extra provider fields',async()=>{
 const disk=JSON.stringify({timestamp:'2026-10-02T16:00:00Z',metrics:{fs_size_bytes:100,fs_avail_bytes:20,fs_used_bytes:80,secret:'private-record'}});
 const config=JSON.stringify({attributes:{type:'gp3',iops:3000,size_gb:20,password:'private-record'},token:'private-record'});
 const {logs,process}=await run('resources',false,'',{disk,config});
 assert.equal(process.exitCode,undefined);assert.doesNotMatch(logs.join(''),/private-record|password|secret|test-token/);
 assert.match(logs.join(''),/fs_avail_bytes/);
});
test('malformed disk observations cannot masquerade as usable telemetry',async()=>{
 for(const disk of ['null','{}',JSON.stringify({timestamp:'not a date',metrics:{fs_size_bytes:100,fs_avail_bytes:20,fs_used_bytes:80}}),JSON.stringify({timestamp:'2026-10-02T16:00:00Z',metrics:{fs_size_bytes:100,fs_avail_bytes:200,fs_used_bytes:80}})]){
  const {process}=await run('resources',false,'',{disk});assert.equal(process.exitCode,1);
 }
 for(const config of ['{}',JSON.stringify({attributes:{type:'unknown',size_gb:20,iops:3000}}),JSON.stringify({attributes:{type:'gp3',size_gb:20,iops:'3000'}})]){
  const {process}=await run('resources',false,'',{config});assert.equal(process.exitCode,1);
 }
});

test('resource samples preserve finite observations without any arbitrary label values',async()=>{
 const metrics='node_memory_MemAvailable_bytes{instance="private-record",custom="customer-content"} 12345\nnode_cpu_seconds_total{cpu="0",mode="idle",extra="private-record"} 9.5\n';
 const {logs,process}=await run('resources',false,'',{metrics});
 assert.equal(process.exitCode,undefined);
 const samples=logs.map(x=>{try{return JSON.parse(x);}catch{return {};}}).find(x=>x.resource_samples)?.resource_samples;
 assert.deepEqual(samples,[{metric:'node_memory_MemAvailable_bytes',value:12345},{metric:'node_cpu_seconds_total',value:9.5}]);
 assert.doesNotMatch(logs.join(''),/private-record|customer-content|instance|custom|cpu=|mode=/);
});
