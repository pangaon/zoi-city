const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const origin=process.env.PRODUCTION_ORIGIN||'https://www.zoi.city';
const out=process.env.EVIDENCE_DIR||path.resolve(__dirname,'../../../docs/audits/evidence/discovery-directory-production-independent-2026-10-02');
const report={origin,startedAt:new Date().toISOString(),anonymous:true,productionWrites:false,providerSends:false,requests:[]};
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const html=await(await fetch(origin+'/explore/',{signal:AbortSignal.timeout(20000)})).text();
 const base=/const BASE='([^']+)'/.exec(html)?.[1],key=/const PUB='([^']+)'/.exec(html)?.[1];assert.ok(base&&key,'Published public-reader configuration absent');
 const read=async(name,params)=>{const start=performance.now();const response=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(params),signal:AbortSignal.timeout(20000)});const text=await response.text();const receipt={name,params,status:response.status,elapsedMs:Number((performance.now()-start).toFixed(2)),responseSha256:digest(text)};report.requests.push(receipt);assert.equal(response.status,200,text.slice(0,300));const rows=JSON.parse(text);assert.ok(Array.isArray(rows));receipt.rows=rows.length;receipt.ids=rows.map(r=>r.id);receipt.names=rows.map(r=>r.name);receipt.nullFields=Object.fromEntries(['website','phone','logo','tagline'].map(k=>[k,rows.filter(r=>r[k]===null).length]));return rows;};
 for(let iteration=0;iteration<3;iteration++){
  const one=await read('dir_browse',{p_type:null,p_city:null,p_limit:30,p_offset:0});const two=await read('dir_browse',{p_type:null,p_city:null,p_limit:30,p_offset:30});const sixty=await read('dir_browse',{p_type:null,p_city:null,p_limit:60,p_offset:0});
  assert.equal(one.length,30);assert.equal(two.length,30);assert.equal(new Set([...one,...two].map(r=>r.id)).size,60);assert.deepEqual([...one,...two],sixty,'Adjacent pages differ from observed same first60');
  console.log('PASS actual anonymous dir_browse adjacent pages',iteration+1);
 }
 const churches=await read('dir_browse',{p_type:'church',p_city:null,p_limit:30,p_offset:0});assert.ok(churches.length);assert.ok(churches.every(r=>r.entity_type==='church'));
 for(let iteration=0;iteration<2;iteration++){const rows=await read('explore_search',{p_q:null,p_type:null,p_city:null,p_country:null,p_limit:24,p_offset:0});assert.equal(rows.length,24);console.log('PASS actual anonymous global explore_search',iteration+1);}
 const suggestions=await read('explore_search',{p_q:'SIGNAT',p_type:null,p_city:null,p_country:null,p_limit:8,p_offset:0});assert.ok(suggestions.some(r=>String(r.name).toLowerCase().includes('signature')),'Actual Signature prefix suggestion absent');
 report.completedAt=new Date().toISOString();report.pass=true;
})().catch(e=>{report.pass=false;report.error=e.message;process.exitCode=1;}).finally(async()=>{await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'public-reader-receipts.json'),JSON.stringify(report,null,2)+'\n');});
