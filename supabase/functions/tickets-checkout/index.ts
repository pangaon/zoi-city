// tickets-checkout: creates a Stripe Checkout Session for a paid ticket type.
// SAFETY GATE: without STRIPE_SECRET_KEY this creates NOTHING and reports staged.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const J=(o:unknown,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...CORS,"Content-Type":"application/json"}});
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
async function rpc(fn:string,args:Record<string,unknown>){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`,{method:"POST",headers:{apikey:SERVICE,Authorization:`Bearer ${SERVICE}`,"Content-Type":"application/json"},body:JSON.stringify(args)});
  const t=await r.text(); if(!r.ok) throw new Error(t.slice(0,200)); return t?JSON.parse(t):null;
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  try{
    const KEY=Deno.env.get("STRIPE_SECRET_KEY");
    if(!KEY) return J({available:false,staged:true,reason:"awaiting stripe keys"});
    const {event,type,qty,name,email,return_url}=await req.json();
    if(!event||!type||!name||!email) return J({error:"event, type, name, email required"},400);
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return J({error:"invalid email"},400);
    const q=Math.min(Math.max(Number(qty)||1,1),10);
    const info=await rpc("tickets_checkout_info",{p_event:event,p_type:type});
    if(!info||info.active===false) return J({error:"ticket type unavailable"},404);
    if(!(info.price_cents>0)) return J({error:"free ticket type — use reserve"},400);
    if(info.capacity!=null && info.reserved+q>info.capacity) return J({error:"not enough tickets left"},409);
    let ret:URL;
    try{ ret=new URL(String(return_url)); }catch{ ret=new URL("https://www.zoi.city/tickets"); }
    if(ret.origin!=="https://www.zoi.city") ret=new URL("https://www.zoi.city/tickets");
    ret.searchParams.delete("paid_session"); ret.searchParams.delete("pay_cancelled");
    const ok=new URL(ret.href); ok.searchParams.set("paid_session","SESSION_PLACEHOLDER");
    const ko=new URL(ret.href); ko.searchParams.set("pay_cancelled","1");
    const success=ok.href.replace("SESSION_PLACEHOLDER","{CHECKOUT_SESSION_ID}");
    const f=new URLSearchParams();
    f.set("mode","payment");
    f.set("line_items[0][price_data][currency]",String(info.currency||"cad").toLowerCase());
    f.set("line_items[0][price_data][product_data][name]",`${info.event_name} — ${info.type_name}`);
    f.set("line_items[0][price_data][unit_amount]",String(info.price_cents));
    f.set("line_items[0][quantity]",String(q));
    f.set("customer_email",email);
    f.set("success_url",success);
    f.set("cancel_url",ko.href);
    f.set("metadata[event]",String(event)); f.set("metadata[type]",String(type));
    f.set("metadata[qty]",String(q)); f.set("metadata[name]",String(name).slice(0,120)); f.set("metadata[email]",String(email).slice(0,160));
    const r=await fetch("https://api.stripe.com/v1/checkout/sessions",{method:"POST",headers:{Authorization:`Bearer ${KEY}`,"Content-Type":"application/x-www-form-urlencoded"},body:f});
    const s=await r.json();
    if(!r.ok) return J({error:s?.error?.message||"stripe_error"},502);
    return J({available:true,url:s.url,session_id:s.id});
  }catch(e){ return J({error:String(e?.message??e).slice(0,200)},500); }
});
