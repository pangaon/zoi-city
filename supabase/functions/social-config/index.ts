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
Deno.serve(()=> new Response(JSON.stringify({
  platforms:PLATFORMS.map(p=>({id:p.id,label:p.label,available:p.env.every(k=>!!Deno.env.get(k))})),
  services:{email:!!Deno.env.get("RESEND_API_KEY"), ai:!!Deno.env.get("ANTHROPIC_API_KEY"), stripe:!!Deno.env.get("STRIPE_SECRET_KEY")}
}),{headers:{...CORS,"Content-Type":"application/json"}}));
