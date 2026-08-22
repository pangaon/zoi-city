// tickets-confirm: verifies a Stripe Checkout Session server-side and finalizes the paid reservation (idempotent).
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
    if(!KEY) return J({available:false,staged:true});
    const {session_id}=await req.json();
    if(!session_id||!/^cs_/.test(session_id)) return J({error:"session_id required"},400);
    const r=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session_id)}`,{headers:{Authorization:`Bearer ${KEY}`}});
    const s=await r.json();
    if(!r.ok) return J({error:s?.error?.message||"stripe_error"},502);
    if(s.payment_status!=="paid") return J({ok:false,pending:true,payment_status:s.payment_status});
    const m=s.metadata||{};
    const fin=await rpc("tickets_paid_finalize",{p_session:s.id,p_event:m.event,p_type:Number(m.type),p_name:m.name||"Guest",p_email:m.email||s.customer_details?.email||"",p_qty:Number(m.qty)||1,p_amount_cents:s.amount_total||0});
    return J({...fin,currency:s.currency});
  }catch(e){ return J({error:String(e?.message??e).slice(0,200)},500); }
});
