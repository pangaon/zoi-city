// ai-generate: agentic content engine. Gated on ANTHROPIC_API_KEY; enforces workspace access via the caller's JWT.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const J=(o:unknown,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...CORS,"Content-Type":"application/json"}});
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const ANON=Deno.env.get("SUPABASE_ANON_KEY")!;

async function userRpc(fn:string,args:Record<string,unknown>,auth:string){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`,{method:"POST",headers:{apikey:ANON,Authorization:auth,"Content-Type":"application/json"},body:JSON.stringify(args)});
  const t=await r.text(); if(!r.ok) throw new Error(t.slice(0,200)); return t?JSON.parse(t):null;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  try{
    const auth=req.headers.get("Authorization")||"";
    const {workspace,action,input,count}=await req.json();
    if(!workspace||!action) return J({error:"workspace and action required"},400);
    // access check with the caller's own JWT (raises if not signed in / not a member)
    let profile:any={};
    try{ profile=await userRpc("ai_profile_get",{p_workspace:workspace},auth); }
    catch(e){ return J({error:"no_access",detail:String(e).slice(0,120)},403); }
    const KEY=Deno.env.get("ANTHROPIC_API_KEY");
    if(!KEY) return J({available:false,reason:"not_configured"});

    const voice=[
      profile.business_name?`Business: ${profile.business_name}.`:"",
      profile.about?`About: ${profile.about}.`:"",
      profile.tone?`Tone: ${profile.tone}.`:"",
      `Languages: ${profile.languages||"Greek and English"}.`,
      profile.sample?`Sample of their writing: "${profile.sample}"`:"",
    ].filter(Boolean).join(" ");
    const n=Math.min(Math.max(Number(count)||7,1),14);
    const prompts:Record<string,string>={
      week:`Draft ${n} distinct social media posts for the coming week for this Greek business. Mix Greek and English naturally per their language preference. Include nameday/cultural hooks where natural. Return STRICT JSON: an array of objects {"day":"Mon","text":"..."} and nothing else.`,
      caption:`Rewrite or write one social caption based on this input: "${(input||"").slice(0,600)}". Match the business voice. Return STRICT JSON: {"text":"..."} and nothing else.`,
      reply:`Write a warm, professional public reply from the business to this customer review/comment: "${(input||"").slice(0,600)}". Return STRICT JSON: {"text":"..."} and nothing else.`,
    };
    const task=prompts[action]; if(!task) return J({error:"unknown_action"},400);
    const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":KEY,"anthropic-version":"2023-06-01","Content-Type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:2000,system:`You are the social media voice of a Greek business. ${voice} Never invent facts about the business.`,messages:[{role:"user",content:task}]})});
    const j=await r.json();
    if(!r.ok) return J({error:j.error?.message||"ai_failed"},502);
    const raw=(j.content?.[0]?.text||"").trim().replace(/^```json?|```$/g,"").trim();
    let parsed:unknown; try{ parsed=JSON.parse(raw); }catch{ parsed={text:raw}; }
    return J({available:true,result:parsed});
  }catch(e){ return J({error:String(e?.message??e).slice(0,200)},500); }
});
