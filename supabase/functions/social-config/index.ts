// social-config: reports which platforms/services have live credentials. Booleans only, never secrets.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, POST, OPTIONS"};
const PLATFORMS:{id:string;label:string;env:string[]}[]=[
  {id:"facebook",label:"Facebook Page",env:["META_APP_ID","META_APP_SECRET"]},
  {id:"instagram",label:"Instagram",env:["META_APP_ID","META_APP_SECRET"]},
  {id:"linkedin",label:"LinkedIn",env:["LINKEDIN_CLIENT_ID","LINKEDIN_CLIENT_SECRET"]},
  {id:"tiktok",label:"TikTok",env:["TIKTOK_CLIENT_KEY","TIKTOK_CLIENT_SECRET"]},
  {id:"x",label:"X (Twitter)",env:["X_CLIENT_ID","X_CLIENT_SECRET"]},
  {id:"youtube",label:"YouTube",env:["GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET"]},
];
async function aiAvailable(){
 if(!Deno.env.get("ANTHROPIC_API_KEY"))return false;
 try {const key=Deno.env.get("SUPABASE_ANON_KEY")||"";const response=await fetch(Deno.env.get("SUPABASE_URL")+"/rest/v1/rpc/ai_runtime_enabled",{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:"{}",signal:AbortSignal.timeout(3000)});return response.ok&&(await response.json())===true;}catch{return false;}
}
Deno.serve(async()=> new Response(JSON.stringify({
  platforms:PLATFORMS.map(p=>({id:p.id,label:p.label,available:p.env.every(k=>!!Deno.env.get(k))})),
  services:{email:!!Deno.env.get("RESEND_API_KEY")&&!!Deno.env.get("EMAIL_FROM")&&Deno.env.get("EMAIL_DELIVERY_ENABLED")==="on", ai:await aiAvailable(), stripe:!!Deno.env.get("STRIPE_SECRET_KEY"), payments:!!Deno.env.get("STRIPE_SECRET_KEY")&&Deno.env.get("DELIVERY_PAYMENTS_ENABLED")==="on"}
}),{headers:{...CORS,"Content-Type":"application/json","Cache-Control":"no-store"}}));
