// Marketing delivery uses an immutable consent-backed SQL outbox. Provider
// acceptance is reported separately from inbox delivery (webhooks not enabled).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-cron-secret","Access-Control-Allow-Methods":"POST, OPTIONS"};
const J=(o:unknown,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...CORS,"Content-Type":"application/json"}});
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const ANON=Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
async function rpc(fn:string,args:Record<string,unknown>,auth="",svc=false){
 const key=svc?SERVICE:ANON;
 const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`,{method:"POST",signal:AbortSignal.timeout(15000),headers:{apikey:key,Authorization:svc?`Bearer ${SERVICE}`:auth,"Content-Type":"application/json"},body:JSON.stringify(args)});
 if(!r.ok) throw new Error(`database_${fn}_${r.status}`);
 return await r.json();
}
function merge(text:string,name:string){return text.replace(/\{\{\s*name\s*\}\}/gi,(name||"").trim().split(/\s+/)[0]||"friend");}
function escapeHtml(text:string){return String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function htmlWrap(subject:string,body:string,from:string,unsubscribe:string){
 const paras=escapeHtml(body).split(/\n{2,}/).map(p=>`<p>${p.replace(/\n/g,"<br>")}</p>`).join("");
 return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h1>${escapeHtml(subject)}</h1>${paras}<hr><p>Sent by ${escapeHtml(from)} via Zoi.</p><p><a href="${escapeHtml(unsubscribe)}">Unsubscribe from these emails</a></p></div>`;
}
function stateOf(s:any){
 if(s.pending>0) return "processing";
 if(s.uncertain>0) return "needs_review";
 if(s.failed>0) return s.accepted>0?"partial":"failed";
 if(s.accepted>0) return "accepted";
 return "suppressed";
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
 if(req.method!=="POST") return J({error:"method_not_allowed"},405);
 try{
  const auth=req.headers.get("Authorization")||"";
  const cron=req.headers.get("x-cron-secret")||"";
  const {workspace,campaign_id,mode}=await req.json();
  if(!workspace||!campaign_id) return J({error:"workspace_and_campaign_required"},400);
  if(mode && mode!=="real") return J({error:"test_delivery_unavailable_use_editor_preview"},400);
  if(cron){
   const expected=await rpc("social_cron_secret_get",{},"",true);
   if(!expected||cron!==expected) return J({error:"bad_cron_secret"},401);
  }else{
   if(!auth.startsWith("Bearer ")) return J({error:"sign_in_required"},401);
   try{if(await rpc("email_delivery_authorize_sender",{p_workspace:workspace},auth)!==true)return J({error:"no_access"},403);}catch{return J({error:"no_access"},403);}
  }
  const KEY=Deno.env.get("RESEND_API_KEY");
  const FROM=Deno.env.get("EMAIL_FROM");
  if(!KEY||!FROM||Deno.env.get("EMAIL_DELIVERY_ENABLED")!=="on") return J({available:false,reason:"not_configured"});
  const prepared=await rpc("email_delivery_prepare",{p_workspace:workspace,p_campaign:campaign_id,p_sender:FROM},"",true);
  if(prepared?.ok!==true) return J({error:prepared?.reason||"preparation_not_confirmed",returned_to_draft:prepared?.returned_to_draft===true},422);
  const started=Date.now();
  let processed=0;
  while(Date.now()-started<55000 && processed<100){
   const rows=await rpc("email_delivery_claim",{p_campaign:campaign_id,p_limit:1},"",true);
   if(!Array.isArray(rows)||!rows.length) break;
   const row=rows[0];
   const authorised=await rpc("email_delivery_authorize",{p_id:row.id,p_lease:row.lease_token},"",true);
   if(authorised!==true){processed++;continue;}
   const unsubscribe=`${SUPABASE_URL}/functions/v1/email-unsubscribe?token=${encodeURIComponent(row.unsubscribe_token)}`;
   const subject=merge(row.subject,row.name);
   const body=merge(row.body,row.name);
   const payload=await rpc("email_delivery_payload",{p_id:row.id,p_lease:row.lease_token,p_payload:{
    from:row.sender,to:[row.email],subject,html:htmlWrap(subject,body,row.from_name,unsubscribe),
    text:`${body}\n\nUnsubscribe: ${unsubscribe}`,
    headers:{"List-Unsubscribe":`<${unsubscribe}>`,"List-Unsubscribe-Post":"List-Unsubscribe=One-Click"}
   }},"",true);
   if(!payload || !Array.isArray(payload.to)) return J({error:"payload_not_persisted"},503);
   let outcome="retry",providerId:string|null=null,error:string|null=null;
   try{
    const response=await fetch("https://api.resend.com/emails",{
     method:"POST",signal:AbortSignal.timeout(20000),
     headers:{Authorization:`Bearer ${KEY}`,"Content-Type":"application/json","Idempotency-Key":`zoi-campaign/${row.id}`},
     body:JSON.stringify(payload)
    });
    const result=await response.json();
    if(response.ok && typeof result.id==="string" && result.id){outcome="accepted";providerId=result.id;}
    else{outcome=result?.name==="invalid_idempotent_request"?"failed":response.ok||response.status===429||response.status>=500||response.status===409?"retry":"failed";error=`provider_${response.status}`;}
   }catch{error="provider_response_unknown";}
   // A failed receipt write must stop processing. The lease expires and the
   // same immutable payload/key can then be retried within the provider window.
   const recorded=await rpc("email_delivery_complete",{p_id:row.id,p_lease:row.lease_token,p_outcome:outcome,p_provider_id:providerId,p_error:error},"",true);
   if(recorded!==true) return J({error:"receipt_not_persisted",requires_retry:true},503);
   processed++;
  }
  const summary=await rpc("email_delivery_finalize",{p_campaign:campaign_id},"",true);
  if(!summary||typeof summary.total!=="number") return J({error:"delivery_status_unavailable"},503);
  return J({available:true,status:stateOf(summary),...summary,processed,delivery_confirmed:false});
 }catch{return J({error:"delivery_processing_failed",requires_retry:true},503);}
});
