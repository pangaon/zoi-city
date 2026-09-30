// Public opaque-token endpoint. GET confirms intent; POST persists suppression.
// Deploy with verify_jwt=false: recipients do not need a Zoi account to opt out.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
function page(title:string,body:string,status=200){
 const headers={"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none'; form-action 'self'; style-src 'unsafe-inline'"};
 return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${title} · Zoi</title><style>*{box-sizing:border-box}body{margin:0;background:#081829;color:#f8fafc;font:16px/1.6 system-ui,-apple-system,sans-serif;min-height:100vh;display:grid;place-items:center;padding:28px 18px}main{width:100%;max-width:480px;background:#10243a;border:1px solid #304459;border-radius:22px;padding:clamp(24px,6vw,44px);box-shadow:0 24px 70px #0003}.brand{font-size:26px;font-weight:800;letter-spacing:.04em;color:#d6ae5a;margin-bottom:30px}.brand span{font-weight:400;font-size:13px;display:block;color:#c1cedd;letter-spacing:0}h1{font-size:clamp(27px,6vw,34px);line-height:1.2;letter-spacing:-.02em;margin:0 0 16px}p{color:#c1cedd;margin:0 0 24px}button{display:block;width:100%;min-height:48px;padding:12px 20px;border:1px solid #7db2f1;border-radius:10px;background:#1c57a2;color:white;font:700 16px system-ui;cursor:pointer}button:hover{background:#246abd}button:focus-visible,a:focus-visible{outline:3px solid #e8c16c;outline-offset:4px}footer{margin-top:28px;padding-top:22px;border-top:1px solid #304459;font-size:14px}a{color:#b7d5fa;text-underline-offset:4px}</style></head><body><main><div class="brand">ZOI<span>A home for Greeks everywhere</span></div><h1>${title}</h1>${body}<footer><a href="https://zoi.city">Return to Zoi</a></footer></main></body></html>`,{status,headers});
}
Deno.serve(async(req)=>{
 const token=new URL(req.url).searchParams.get("token")||"";
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return page("This link is incomplete","<p>Open the unsubscribe link from the original email to manage your subscription.</p>",400);
 if(req.method==="GET") return page("Unsubscribe","<p>Stop marketing emails from the business that sent you this link.</p><form method=\"post\"><button type=\"submit\">Confirm unsubscribe</button></form>");
 if(req.method!=="POST") return page("Request unavailable","<p>Open the unsubscribe link in your browser and confirm your choice.</p>",405);
 try{
  const base=Deno.env.get("SUPABASE_URL")!;const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const response=await fetch(`${base}/rest/v1/rpc/email_unsubscribe_token`,{method:"POST",signal:AbortSignal.timeout(15000),headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({p_token:token})});
  if(!response.ok) throw new Error("failed");
  const receipt=await response.json();
  if(receipt?.ok!==true) throw new Error("unconfirmed");
  return page("You’re unsubscribed","<p>Your subscription has been stopped. An email already being processed may still arrive.</p>");
 }catch{return page("Please try again","<p>We could not record your unsubscribe request. Your subscription has not been changed.</p><form method=\"post\"><button type=\"submit\">Retry unsubscribe</button></form>",503);}
});
