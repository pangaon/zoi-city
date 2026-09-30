import {readBoundedBody} from '../../../assets/documents/bounded-body.mjs';
import {sha256} from '../../../assets/documents/file-rules.mjs';
import {validateGenerationRequest,profileSnapshot,buildPrompt,validateGenerationResult,usage} from '../../../assets/ai/generation.mjs';
const BASE=Deno.env.get('SUPABASE_URL')!,ANON=Deno.env.get('SUPABASE_ANON_KEY')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const J=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json'}});
async function db(fn:string,args:unknown,token:string){
 const response=await fetch(BASE+'/rest/v1/rpc/'+fn,{method:'POST',signal:AbortSignal.timeout(10000),headers:{apikey:token===SERVICE?SERVICE:ANON,...(token===SERVICE&&token.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+token}),'Content-Type':'application/json'},body:JSON.stringify(args)});
 const result=await response.json();if(!response.ok||result?.error||result?.ok===false)throw Error(result?.message||result?.error||'generation_storage_unavailable');return result;
}
function saved(g:any){if(g.status==='succeeded')return J({available:true,generation_id:g.id,status:g.status,result:g.result,usage:{input_tokens:g.provider_input_tokens,output_tokens:g.provider_output_tokens,estimated_usd:g.estimated_micro_usd===null?null:g.estimated_micro_usd/1e6,pricing_date:g.pricing_date,cost_label:'Token-based estimate, not a provider invoice'}});return J({available:false,generation_id:g.id,status:g.status,error:g.status==='pending'?'generation_in_progress':g.error_code||'generation_unconfirmed'},409);}
async function settle(args:unknown){for(let attempt=0;attempt<2;attempt++){try{return await db('ai_generation_finish',args,SERVICE);}catch{if(attempt===1)return null;}}}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});if(req.method!=='POST')return J({error:'method_not_allowed'},405);
 try{
  const auth=req.headers.get('Authorization')||'';if(!/^Bearer [^\s]+$/.test(auth))return J({error:'sign_in_required'},401);
  const token=auth.slice(7),bytes=await readBoundedBody(req,16384,10000);let input;try{input=validateGenerationRequest(JSON.parse(new TextDecoder().decode(bytes)));}catch{return J({error:'invalid_generation_request'},400);}
  const userResponse=await fetch(BASE+'/auth/v1/user',{headers:{apikey:ANON,Authorization:auth},signal:AbortSignal.timeout(10000)});if(!userResponse.ok)return J({error:'sign_in_required'},401);const user=await userResponse.json();
  const profile=profileSnapshot(await db('ai_profile_get',{p_workspace:input.workspace},token));
  const KEY=Deno.env.get('ANTHROPIC_API_KEY');if(!KEY)return J({available:false,reason:'not_configured'});
  const prompt=buildPrompt(input,profile),hash=await sha256(new TextEncoder().encode(JSON.stringify({workspace:input.workspace,action:input.action,input:input.input,count:input.count})));
  const reservation=await db('ai_generation_begin',{p_actor_auth:user.id,p_workspace:input.workspace,p_request:input.request_id,p_hash:hash,p_action:input.action,p_input:input.input,p_count:input.count,p_profile:profile},SERVICE);
  if(reservation.available===false)return J({available:false,reason:reservation.reason});const g=reservation.generation;if(!reservation.dispatch)return saved(g);
  let provider:any;let raw='';let parsed:any=null;let status='unknown';let error='provider_request_unconfirmed';let used:{input:number|null,output:number|null}={input:null,output:null};
  try{
   const response=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal:AbortSignal.timeout(30000),headers:{'x-api-key':KEY,'anthropic-version':'2023-06-01','Content-Type':'application/json'},body:JSON.stringify({model:g.model,max_tokens:g.max_output_tokens,system:prompt.system,messages:[{role:'user',content:prompt.user}]})});
   const body=await readBoundedBody(response,32768,10000);provider=JSON.parse(new TextDecoder().decode(body));
   if(!response.ok){status='failed';error=response.status===429?'provider_rate_limited':'provider_request_failed';}
   else{
    used=usage(provider);raw=Array.isArray(provider.content)?provider.content.filter((part:any)=>part.type==='text'&&typeof part.text==='string').map((part:any)=>part.text).join(''):'';
    if(new TextEncoder().encode(raw).length>16000){raw=new TextDecoder().decode(new TextEncoder().encode(raw).slice(0,15990));throw Error('invalid_model_output');}
    if(provider.stop_reason!=='end_turn')throw Error('invalid_model_output');
    parsed=validateGenerationResult(input.action,input.count,JSON.parse(raw));status='succeeded';error='';
   }
  }catch(e){if(provider){status='failed';error='invalid_model_output';}else{status='unknown';error='provider_request_unconfirmed';}}
  const done=await settle({p_generation:g.id,p_status:status,p_result:parsed,p_raw:raw,p_error:error||null,p_input_tokens:used.input,p_output_tokens:used.output});
  return done?saved(done.generation):J({available:false,generation_id:g.id,status:'unknown',error:'generation_storage_unconfirmed'},503);
 }catch(error){const code=error instanceof Error?error.message:'';const allowed=['invalid_generation_request','generation_context_too_large','generation_request_conflict','generation_rate_limit','generation_daily_limit','generation_global_budget_limit','generation_workspace_budget_limit','generation_user_budget_limit','ai_generation_not_allowed','not_authorized'];return J({available:false,error:allowed.includes(code)?code:'generation_unavailable'},allowed.includes(code)?(code.includes('limit')?429:403):503);}
});
