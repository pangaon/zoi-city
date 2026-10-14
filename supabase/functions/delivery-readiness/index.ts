// Founder-only, read-only configuration checks. Never publish, charge or generate.
const cors={"Access-Control-Allow-Origin":"https://www.zoi.city","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const respond=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const requirements:Record<string,string[]>={facebook:["META_APP_ID","META_APP_SECRET"],instagram:["META_APP_ID","META_APP_SECRET"],linkedin:["LINKEDIN_CLIENT_ID","LINKEDIN_CLIENT_SECRET"],x:["X_CLIENT_ID","X_CLIENT_SECRET"],tiktok:["TIKTOK_CLIENT_KEY","TIKTOK_CLIENT_SECRET"],youtube:["GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET"],email:["RESEND_API_KEY","EMAIL_FROM","EMAIL_DELIVERY_ENABLED"],ai:["ANTHROPIC_API_KEY"],stripe:["STRIPE_SECRET_KEY","DELIVERY_PAYMENTS_ENABLED"],geocoding:["MAPBOX_GEOCODING_TOKEN","MAPBOX_GEOCODING_PERMANENT_ENABLED","MAPBOX_GEOCODING_MONTHLY_REQUEST_BUDGET"]};
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 if(req.method!=="POST")return respond(405,{error:"post_required"});
 const auth=req.headers.get("authorization")||"";
 if(!/^Bearer [A-Za-z0-9_.-]+$/.test(auth))return respond(401,{error:"founder_session_required"});
 const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!url||!anon||!service)return respond(503,{error:"readiness_service_unavailable"});
 try{
  if(Number(req.headers.get("content-length")||0)>2048)return respond(400,{error:"invalid_request"});
  const raw=await req.text();if(raw.length>2048)return respond(400,{error:"invalid_request"});
  let input;try{input=JSON.parse(raw);}catch{return respond(400,{error:"invalid_request"});}if(!input||typeof input!=="object")return respond(400,{error:"invalid_request"});if(!/^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(input.request_id||""))return respond(400,{error:"invalid_request"});
  const rpc=async(name:string,body:unknown,token:string,key:string)=>fetch(url+"/rest/v1/rpc/"+name,{method:"POST",headers:{Authorization:token,apikey:key,"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
  const gate=await rpc("zoi_delivery_check_context",{p_request:input.request_id},auth,anon);
  if(!gate.ok)return respond(403,{error:"founder_access_required"});
  const context=await gate.json(),id=context.action_id;
  let state="not configured",observation:Record<string,unknown>={checked_at:new Date().toISOString(),check_type:"read_only_configuration",provider_operation_verified:false};
  if(id==="native"){
   state="externally blocked";observation.note="Device installation and store signing require the release operator and actual device; this server cannot certify them.";
  }else if(requirements[id]){
   const missing=requirements[id].filter(name=>!Deno.env.get(name));
   if(id==="stripe"&&Deno.env.get("DELIVERY_PAYMENTS_ENABLED")!=="on"&&!missing.includes("DELIVERY_PAYMENTS_ENABLED"))missing.push("DELIVERY_PAYMENTS_ENABLED");
   if(id==="email"&&Deno.env.get("EMAIL_DELIVERY_ENABLED")!=="on"&&!missing.includes("EMAIL_DELIVERY_ENABLED"))missing.push("EMAIL_DELIVERY_ENABLED");
   if(id==="geocoding"){
    if(!["true","on"].includes(Deno.env.get("MAPBOX_GEOCODING_PERMANENT_ENABLED")||"")&&!missing.includes("MAPBOX_GEOCODING_PERMANENT_ENABLED"))missing.push("MAPBOX_GEOCODING_PERMANENT_ENABLED");
    if(!/^[1-9]\d*$/.test(Deno.env.get("MAPBOX_GEOCODING_MONTHLY_REQUEST_BUDGET")||"")&&!missing.includes("MAPBOX_GEOCODING_MONTHLY_REQUEST_BUDGET"))missing.push("MAPBOX_GEOCODING_MONTHLY_REQUEST_BUDGET");
   }
   observation.missing_configuration_names=missing;
   state=missing.length?"not configured":"ready for operator verification";
   if(id==="ai"&&!missing.length){
    const runtime=await rpc("ai_runtime_enabled",{},"Bearer "+anon,anon);
    if(!runtime.ok){state="degraded";observation.note="Runtime readiness could not be confirmed.";}
    else if(await runtime.json()!==true){state="not configured";observation.note="AI runtime remains disabled; an approved bounded budget is required.";}
   }
   if(["tiktok","youtube","stripe","geocoding"].includes(id))observation.note="Configuration presence does not complete the outstanding implementation, review or safe customer journey.";
  }else return respond(400,{error:"unsupported_readiness_action"});
  const saved=await rpc("zoi_delivery_progress",{p_request:crypto.randomUUID(),p_kind:"action_observed",p_payload:{title:"Owner connection readiness checked",check_request:input.request_id,state,observation}},"Bearer "+service,service);
  if(!saved.ok)return respond(503,{error:"readiness_result_unconfirmed"});
  return respond(200,{ok:true,request_id:input.request_id,state,checked_at:observation.checked_at,observation});
 }catch{return respond(503,{error:"readiness_check_unconfirmed"});}
});
