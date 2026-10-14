// social-publish: minute worker. Publishes due social posts AND due scheduled email campaigns.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { runDurableDelivery } from "./delivery-attempts.ts";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
async function sbRpc(fn:string,args:Record<string,unknown>){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`,{method:"POST",signal:AbortSignal.timeout(15000),headers:{apikey:SERVICE,...(SERVICE.startsWith("sb_secret_")?{}:{Authorization:`Bearer ${SERVICE}`}),"Content-Type":"application/json"},body:JSON.stringify(args)});
  const t=await r.text(); if(!r.ok) throw new Error(`${fn}: ${r.status} ${t.slice(0,150)}`); return t?JSON.parse(t):null;
}
const CODE2PLAT:Record<string,string>={fb:"facebook",ig:"instagram",li:"linkedin",tt:"tiktok",x:"twitter",twitter:"twitter",yt:"youtube",facebook:"facebook",instagram:"instagram",linkedin:"linkedin",tiktok:"tiktok",youtube:"youtube"};
async function publishOne(platform:string,ch:any,body:string,media:any[],checkpoint:(ref:Record<string,unknown>)=>Promise<void>,step:(name:string)=>Promise<any>):Promise<{ok:boolean;id?:string;url?:string;error?:string;uncertain?:boolean;knownRejected?:boolean}>{
  if(platform==="twitter")platform="x";
  if(!ch.access_token || !ch.external_id) return {ok:false,knownRejected:true,error:"channel_credentials_unavailable"};
  if((media||[]).length && ["facebook","linkedin","x"].includes(platform)) return {ok:false,knownRejected:true,error:"image_publishing_not_supported"};
  if(platform==="instagram" && (media||[]).length!==1) return {ok:false,knownRejected:true,error:"instagram_requires_one_image"};
  const img=(media||[]).find((m)=> (m.type||"image").startsWith("image"))?.url;
  try{
    if(platform==="facebook"){
      const r=await (await fetch(`https://graph.facebook.com/v19.0/${ch.external_id}/feed`,{method:"POST",signal:AbortSignal.timeout(15000),headers:{"Content-Type":"application/json"},body:JSON.stringify({message:body,access_token:ch.access_token})})).json();
      if(r.id) return {ok:true,id:r.id,url:`https://facebook.com/${r.id}`};
      return {ok:false,error:r.error?.message||"fb_failed"};
    }
    if(platform==="linkedin"){
      const urn=ch.meta?.urn||`urn:li:person:${ch.external_id}`;
      const payload={author:urn,lifecycleState:"PUBLISHED",specificContent:{"com.linkedin.ugc.ShareContent":{shareCommentary:{text:body},shareMediaCategory:"NONE"}},visibility:{"com.linkedin.ugc.MemberNetworkVisibility":"PUBLIC"}};
      const r=await fetch("https://api.linkedin.com/v2/ugcPosts",{method:"POST",signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${ch.access_token}`,"Content-Type":"application/json","X-Restli-Protocol-Version":"2.0.0"},body:JSON.stringify(payload)});
      const id=r.headers.get("x-restli-id");
      if(r.ok&&id) return {ok:true,id,url:`https://www.linkedin.com/feed/update/${id}`};
      return {ok:false,error:(await r.text()).slice(0,100)||"li_failed"};
    }
    if(platform==="x"){
      const r=await (await fetch("https://api.twitter.com/2/tweets",{method:"POST",signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${ch.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({text:body})})).json();
      if(r.data?.id) return {ok:true,id:r.data.id,url:`https://twitter.com/i/web/status/${r.data.id}`};
      return {ok:false,error:r.detail||r.title||"x_failed"};
    }
    if(platform==="instagram"){
      if(!img) return {ok:false,knownRejected:true,error:"instagram_requires_image"};
      const create=await (await fetch(`https://graph.facebook.com/v19.0/${ch.external_id}/media`,{method:"POST",signal:AbortSignal.timeout(15000),headers:{"Content-Type":"application/json"},body:JSON.stringify({image_url:img,caption:body,access_token:ch.access_token})})).json();
      if(!create.id) return {ok:false,error:create.error?.message||"ig_container_failed"};
      await checkpoint({kind:"instagram_container",id:String(create.id)});
      const fresh=await step("instagram_publish");ch=fresh.channel;
      const pub=await (await fetch(`https://graph.facebook.com/v19.0/${ch.external_id}/media_publish`,{method:"POST",signal:AbortSignal.timeout(15000),headers:{"Content-Type":"application/json"},body:JSON.stringify({creation_id:create.id,access_token:ch.access_token})})).json();
      if(pub.id) return {ok:true,id:pub.id};
      return {ok:false,error:pub.error?.message||"ig_publish_failed"};
    }
    if(platform==="tiktok"||platform==="youtube") return {ok:false,knownRejected:true,error:`${platform}_requires_video_upload`};
    return {ok:false,knownRejected:true,error:"unsupported_platform"};
  }catch(e){ return {ok:false,uncertain:true,error:"provider_result_unknown_requires_reconciliation: "+String(e instanceof Error ? e.message : e).slice(0,70)}; }
}
Deno.serve(async(req)=>{
  const auth=req.headers.get("Authorization")||"";
  const cronSecret=req.headers.get("x-cron-secret")||"";
  let okAuth=auth===`Bearer ${SERVICE}`;
  if(!okAuth&&cronSecret){ try{ const expected=await sbRpc("social_cron_secret_get",{}); okAuth=!!expected&&cronSecret===expected; }catch{ okAuth=false; } }
  if(!okAuth) return new Response("unauthorized",{status:401});

  // ── social posts ──
  await sbRpc("social_delivery_attempts_expire",{p_limit:50});
  const due=(await sbRpc("social_delivery_due_attempts",{p_limit:50}))||[];
  let processed=0,published=0,partial=0,failed=0;
  for(const candidate of due){
    // Candidates are read-only hints; each actual destination has a current
    // atomic Community gate or a durable one-time external dispatch permission.
    const post=candidate;
    const codes:string[]=post.channels||[];
    const wantsCommunity=codes.some((code)=>code==="zoi"||code==="community");
    const externalCodes=codes.filter((code)=>code!=="zoi"&&code!=="community");
    let communityOk=false;
    if(wantsCommunity){
      try{
        const receipt=await sbRpc("feed_publish_scheduled_post",{p_id:post.id});
        communityOk=receipt?.ok===true&&!!receipt.id;
      }catch{ communityOk=false; }
    }
    // The atomic community RPC finalizes community-only posts. Never turn a
    // successful feed delivery into "failed" because it has no external channel.
    if(!externalCodes.length){
      if(communityOk) published++; else failed++;
      processed++;
      continue;
    }
    // Composer selections may be channel ids or legacy platform codes. Resolve
    // ids against the workspace's publishable accounts, then filter explicitly;
    // never publish to every account just because it shares a platform.
    const platforms=externalCodes.every((code)=>!!CODE2PLAT[code])
      ? [...new Set(externalCodes.map((code)=>CODE2PLAT[code]))]
      : [...new Set(Object.values(CODE2PLAT))];
    const candidates=(await sbRpc("social_channels_for_publish",{p_workspace:post.workspace_id,p_platforms:platforms}))||[];
    const channels=candidates.filter((ch:any)=>externalCodes.some((code)=>code===String(ch.id)||CODE2PLAT[code]===ch.platform));
    let anyOk=communityOk;
    let allOk=(!wantsCommunity||communityOk)&&externalCodes.every((code)=>
      channels.some((ch:any)=>code===String(ch.id)||CODE2PLAT[code]===ch.platform));
    for(const ch of channels){
      const result=await runDurableDelivery({rpc:sbRpc,postId:post.id,channelId:ch.id,requestId:crypto.randomUUID(),
        preflight:(payload:any)=>!payload?.meta?.first_comment&&!(Array.isArray(payload?.meta?.thread)&&payload.meta.thread.length>0),
        send:async(canonical:any,current:any,checkpoint,step)=>{
          const overrides=canonical.meta?.per_network_overrides||{};
          const override=overrides[current.id]||overrides[current.platform]||(current.platform==="twitter"?overrides.x:null);
          const body=typeof override?.body==="string"?override.body:(canonical.body||"");
          return publishOne(current.platform,current,body,canonical.media||[],checkpoint,step);
        }
      });
      if(result.status==="published"||result.status==="already_delivered")anyOk=true;else allOk=false;
    }
    // Aggregate success requires a receipt from every requested destination.
    // Individual provider receipts remain available for partial-result reporting.
    try{const receipt=await sbRpc("social_delivery_attempts_finalize",{p_post:post.id,p_expected_hash:post.payload_hash,p_status:allOk?"published":"failed"});if(receipt?.ok!==true)allOk=false;}catch{allOk=false;}
    if(allOk) published++; else if(anyOk) partial++; else failed++;
    processed++;
  }

  // ── scheduled email campaigns (only when email sending is configured) ──
  let emails=0;
  if(Deno.env.get("RESEND_API_KEY") && Deno.env.get("EMAIL_DELIVERY_ENABLED")==="on"){
    try{
      const scheduledMail=(await sbRpc("email_due_campaigns",{}))||[];
      const pendingMail=(await sbRpc("email_delivery_due_campaigns",{p_limit:20}))||[];
      const dueMail=[...new Map([...scheduledMail,...pendingMail].map((c:any)=>[c.id,c])).values()];
      const secret=await sbRpc("social_cron_secret_get",{});
      for(const c of dueMail){
        const r=await fetch(`${SUPABASE_URL}/functions/v1/email-send`,{method:"POST",signal:AbortSignal.timeout(15000),headers:{"Content-Type":"application/json","x-cron-secret":secret},body:JSON.stringify({workspace:c.workspace_id,campaign_id:c.id,mode:"real"})});
        const result=await r.json();
        if(r.ok && result.available===true && result.status==="accepted") emails++;
      }
    }catch(e){ console.warn("email cron",e); }
  }
  return new Response(JSON.stringify({processed,published,partial,failed,emails}),{headers:{"Content-Type":"application/json"}});
});
