// email-send: sends a campaign (or test) via Resend. Gated on RESEND_API_KEY.
// Auth: caller JWT (workspace member) OR x-cron-secret (scheduler). Supports {{name}} merge tags.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-cron-secret","Access-Control-Allow-Methods":"POST, OPTIONS"};
const J=(o:unknown,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...CORS,"Content-Type":"application/json"}});
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const ANON=Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function rpc(fn:string,args:Record<string,unknown>,auth:string,svc=false){
  const key=svc?SERVICE:ANON;
  const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`,{method:"POST",headers:{apikey:key,Authorization:svc?`Bearer ${SERVICE}`:auth,"Content-Type":"application/json"},body:JSON.stringify(args)});
  const t=await r.text(); if(!r.ok) throw new Error(t.slice(0,200)); return t?JSON.parse(t):null;
}
function merge(t:string,name:string){ const first=(name||"").trim().split(/\s+/)[0]||"friend"; return t.replaceAll("{{name}}",first); }
function htmlWrap(subject:string,body:string,from:string){
  const esc=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;");
  const paras=esc(body).split(/\n{2,}/).map(p=>`<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g,"<br/>")}</p>`).join("");
  return `<div style="background:#f6f4ef;padding:32px 16px;font-family:Georgia,serif"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:36px;color:#0d1b2a"><h1 style="font-size:24px;margin:0 0 18px">${esc(subject)}</h1>${paras}<hr style="border:none;border-top:1px solid #e7e3d8;margin:26px 0 14px"/><p style="font-size:12px;color:#8a94a0;margin:0">Sent by ${esc(from||"a Greek business")} via Zoi · zoi.city</p></div></div>`;
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  try{
    const auth=req.headers.get("Authorization")||"";
    const cron=req.headers.get("x-cron-secret")||"";
    const {workspace,campaign_id,mode,test_to}=await req.json();
    if(!workspace||!campaign_id) return J({error:"workspace and campaign_id required"},400);
    let svcMode=false;
    if(cron){ const expected=await rpc("social_cron_secret_get",{},"",true); svcMode=!!expected&&cron===expected; if(!svcMode) return J({error:"bad_cron_secret"},401); }
    if(!svcMode){ try{ await rpc("ai_profile_get",{p_workspace:workspace},auth); }catch(e){ return J({error:"no_access"},403); } }
    const KEY=Deno.env.get("RESEND_API_KEY");
    if(!KEY) return J({available:false,reason:"not_configured"});
    const FROM=Deno.env.get("EMAIL_FROM")||"Zoi <onboarding@resend.dev>";
    const camps=await rpc("email_campaign_list",{p_workspace:workspace},auth,svcMode);
    const c=(camps||[]).find((x:any)=>x.id===campaign_id);
    if(!c) return J({error:"campaign_not_found"},404);
    let recipients:{email:string,name:string}[]=[];
    if(mode==="test"){
      if(!test_to) return J({error:"test_to required"},400);
      recipients=[{email:test_to,name:"there"}];
    }else{
      const contacts=await rpc("audience_list",{p_workspace:workspace,p_q:null,p_tag:c.audience_tag||null},auth,svcMode);
      recipients=(contacts||[]).filter((x:any)=>x.email).map((x:any)=>({email:x.email,name:x.name||""}));
      if(!recipients.length) return J({error:"no_recipients"},400);
    }
    let sent=0, failed=0;
    for(const rc of recipients.slice(0,500)){
      const subj=merge(c.subject||"(no subject)",rc.name);
      const html=htmlWrap(subj,merge(c.body||"",rc.name),c.from_name||"");
      const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${KEY}`,"Content-Type":"application/json"},
        body:JSON.stringify({from:FROM,to:[rc.email],subject:subj,html})});
      if(r.ok) sent++; else failed++;
    }
    if(mode!=="test" && sent>0){
      await fetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign_id}`,{method:"PATCH",headers:{apikey:SERVICE,Authorization:`Bearer ${SERVICE}`,"Content-Type":"application/json",Prefer:"return=minimal","Content-Profile":"zoi"},body:JSON.stringify({status:"sent",sent_at:new Date().toISOString(),recipients:sent})});
    }
    return J({available:true,sent,failed});
  }catch(e){ return J({error:String(e?.message??e).slice(0,200)},500); }
});
