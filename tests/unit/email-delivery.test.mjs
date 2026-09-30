import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as nodeModule from 'node:module';
import vm from 'node:vm';
const compile=path=>nodeModule.stripTypeScriptTypes?nodeModule.stripTypeScriptTypes(readFileSync(new URL(path,import.meta.url),'utf8').replace(/^import .*;$/m,'')):null;
const script=compile('../../supabase/functions/email-send/index.ts');
const unsubscribeScript=compile('../../supabase/functions/email-unsubscribe/index.ts');
async function delivery({enabled=true,provider=200,receipt=true,authorized=true,token='user'}={}){
 let handler;const calls=[];let claimed=false;
 const recipient={id:'delivery-id',lease_token:'lease-id',unsubscribe_token:'00000000-0000-0000-0000-000000000001',email:'recipient@example.test',name:'Maria',sender:'Business <sender@example.test>',subject:'Hello {{name}}',body:'Actual content',from_name:'Business'};
 vm.runInNewContext(script,{Response,AbortSignal,Date,Deno:{env:{get:key=>({SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',RESEND_API_KEY:'mock-only-key',EMAIL_FROM:recipient.sender,EMAIL_DELIVERY_ENABLED:enabled?'on':'off'})[key]},serve:fn=>handler=fn},fetch:async(url,options)=>{
  const args=JSON.parse(options.body);calls.push({url,options,args});
  if(url==='https://api.resend.com/emails')return Response.json(provider===200?{id:'provider-id'}:{error:'test_failure'},{status:provider});
  switch(url.split('/').pop()){
   case 'email_delivery_authorize_sender':return Response.json(authorized);
   case 'email_delivery_prepare':return Response.json({ok:true});
   case 'email_delivery_claim':if(claimed)return Response.json([]);claimed=true;return Response.json([recipient]);
   case 'email_delivery_authorize':return Response.json(true);
   case 'email_delivery_payload':return Response.json(args.p_payload);
   case 'email_delivery_complete':return Response.json(receipt);
   case 'email_delivery_finalize':return Response.json({total:501,accepted:provider===200?1:0,pending:provider===200?500:501,failed:0,suppressed:0,uncertain:0});
   default:throw new Error('Unexpected request '+url);
  }
 }});
 const response=await handler(new Request('https://worker.test',{method:'POST',headers:{Authorization:token?'Bearer '+token:''},body:JSON.stringify({workspace:'ws',campaign_id:'campaign',mode:'real'})}));
 return {status:response.status,result:await response.json(),calls};
}
test('provider remains disabled without explicit delivery enablement',{skip:!script},async()=>{
 const r=await delivery({enabled:false});assert.equal(r.result.available,false);assert.ok(!r.calls.some(c=>c.url.includes('api.resend.com')));
});
test('provider acceptance uses durable idempotency and unsubscribe headers',{skip:!script},async()=>{
 const r=await delivery();const provider=r.calls.find(c=>c.url.includes('api.resend.com'));
 assert.equal(provider.options.headers['Idempotency-Key'],'zoi-campaign/delivery-id');
 assert.equal(provider.args.subject,'Hello Maria');assert.match(provider.args.html,/email-unsubscribe/);
 assert.equal(provider.args.headers['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click');
 assert.equal(r.result.total,501);assert.equal(r.result.pending,500);assert.equal(r.result.status,'processing');
 assert.equal(r.result.delivery_confirmed,false);
});
test('provider success without a persisted receipt never reports success',{skip:!script},async()=>{
 const r=await delivery({receipt:false});assert.equal(r.status,503);assert.equal(r.result.error,'receipt_not_persisted');
});
test('retryable provider failure returns recipient to durable pending state',{skip:!script},async()=>{
 const r=await delivery({provider:429});const completion=r.calls.find(c=>c.url.endsWith('/email_delivery_complete'));
 assert.equal(completion.args.p_outcome,'retry');assert.equal(completion.args.p_provider_id,null);
});
test('unsubscribe GET never mutates subscription; POST requires confirmed receipt',{skip:!unsubscribeScript},async()=>{
 let handler;let calls=0;
 vm.runInNewContext(unsubscribeScript,{Response,URL,AbortSignal,Deno:{env:{get:()=> 'mock-only'},serve:fn=>handler=fn},fetch:async()=>{calls++;return Response.json({ok:true});}});
 const url='https://db.test/functions/v1/email-unsubscribe?token=00000000-0000-0000-0000-000000000001';
 const get=await handler(new Request(url));assert.equal(get.status,200);assert.equal(calls,0);
 const post=await handler(new Request(url,{method:'POST'}));assert.equal(post.status,200);assert.equal(calls,1);
});

test('viewers and missing tokens cannot prepare or send mail',{skip:!script},async()=>{
 for(const options of [{authorized:false},{token:''}]){const r=await delivery(options);assert.ok([401,403].includes(r.status));assert.ok(!r.calls.some(c=>c.url.endsWith('/email_delivery_prepare')||c.url.includes('api.resend.com')));}
});
