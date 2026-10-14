import {writeFile} from 'node:fs/promises';
const report=[];
for(const limit of [500,250]){
 const batch=await Promise.all([14000,15000].map(async offset=>{
 const at=performance.now();const response=await fetch('https://csebihpaychdkanjjsmz.supabase.co/rest/v1/rpc/explore_geo',{method:'POST',headers:{apikey:'sb_publishable_BM4ZQtOCUhjg7VqyFGJGRw_eFyTgI4j','content-type':'application/json'},body:JSON.stringify({p_limit:limit,p_offset:offset})});const value=await response.json();return{limit,offset,status:response.status,ms:Math.round(performance.now()-at),rows:Array.isArray(value)?value.length:null,code:value?.code||null};}));report.push(...batch);console.log(JSON.stringify(batch));
}
await writeFile(new URL('./cold-anon.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),concurrency:2,report},null,2)+'\n');
