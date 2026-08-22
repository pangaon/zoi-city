// social-publish: minute worker. Publishes due social posts AND due scheduled email campaigns.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
async function sbRpc(fn:string,args:Record<string,unknown>){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`,{method:"POST",headers:{apikey:SERVICE,Authorization:`Bearer ${SERVICE}`,"Content-Type":"application/json"},body:JSON.stringify(args)});
  const t=await r.text(); if(!r.ok) throw new Error(`${fn}: ${r.status} ${t.slice(0,150)}`); return t?JSON.parse(t):null;
}
const CODE2PLAT:Record<string,string>={fb:"facebook",ig:"instagram",li:"linkedin",tt:"tiktok",x:"x",yt:"youtube",facebook:"facebook",instagram:"instagram",linkedin:"linkedin",tiktok:"tiktok",youtube:"youtube"};
async function publishOne(platform:string,ch:any,body:string,media:any[]):Promise<{ok:boolean;id?:string;url?:string;error?:string}>{
  const img=(media||[]).find((m)=> (m.type||"image").startsWith("image"))?.url;
  try{
    if(platform==="facebook"){
      const r=await (await fetch(`https://graph.facebook.com/v19.0/${ch.external_id}/feed`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:body,access_token:ch.access_token})})).json();
      if(r.id) return {ok:true,id:r.id,url:`https://facebook.com/${r.id}`};
      return {ok:false,error:r.error?.message||"fb_failed"};
    }
    if(platform==="linkedin"){
      const urn=ch.meta?.urn||`urn:li:person:${ch.external_id}`;
      const payload={author:urn,lifecycleState:"PUBLISHED",specificContent:{"com.linkedin.ugc.ShareContent":{shareCommentary:{text:body},shareMediaCategory:"NONE"}},visibility:{"com.linkedin.ugc.MemberNetworkVisibility":"PUBLIC"}};
      const r=await fetch("https://api.linkedin.com/v2/ugcPosts",{method:"POST",headers:{Authorization:`Bearer ${ch.access_token}`,"Content-Type":"application/json","X-Restli-Protocol-Version":"2.0.0"},body:JSON.stringify(payload)});
      const id=r.headers.get("x-restli-id");
      if(r.ok&&id) return {ok:true,id,url:`https://www.linkedin.com/feed/update/${id}`};
      return {ok:false,error:(await r.text()).slice(0,100)||"li_failed"};
    }
    if(platform==="x"){
      const r=await (await fetch("https://api.twitter.com/2/tweets",{method:"POST",headers:{Authorization:`Bearer ${ch.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({text:body})})).json();
      if(r.data?.id) return {ok:true,id:r.data.id,url:`https://twitter.com/i/web/status/${r.data.id}`};
      return {ok:false,error:r.detail||r.title||"x_failed"};
    }
    if(platform==="instagram"){
      if(!img) return {ok:false,error:"instagram_requires_image"};
      const create=await (await fetch(`https://graph.facebook.com/v19.0/${ch.external_id}/media`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image_url:img,caption:body,access_token:ch.access_token})})).json();
      if(!create.id) return {ok:false,error:create.error?.message||"ig_container_failed"};
      const pub=await (await fetch(`https://graph.facebook.com/v19.0/${ch.external_id}/media_publish`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({creation_id:create.id,access_token:ch.access_token})})).json();
      if(pub.id) return {ok:true,id:pub.id};
      return {ok:false,error:pub.error?.message||"ig_publish_failed"};
    }
    if(platform==="tiktok"||platform==="youtube") return {ok:false,error:`${platform}_requires_video_upload`};
    return {ok:false,error:"unsupported_platform"};
  }catch(e){ return {ok:false,error:String(e?.message??e).slice(0,100)}; }
}
Deno.serve(async(req)=>{
  const auth=req.headers.get("Authorization")||"";
  const cronSecret=req.headers.get("x-cron-secret")||"";
  let okAuth=auth===`Bearer ${SERVICE}`;
  if(!okAuth&&cronSecret){ try{ const expected=await sbRpc("social_cron_secret_get",{}); okAuth=!!expected&&cronSecret===expected; }catch{ okAuth=false; } }
  if(!okAuth) return new Response("unauthorized",{status:401});

  // ── social posts ──
  const due=(await sbRpc("social_due_posts",{}))||[];
  let processed=0,published=0;
  for(const post of due){
    const codes:string[]=post.channels||[];
    const platforms=[...new Set(codes.map((c)=>CODE2PLAT[c]).filter(Boolean))];
    if(!platforms.length){ await sbRpc("social_post_finalize",{p_post:post.id,p_status:"failed"}); processed++; continue; }
    const channels=(await sbRpc("social_channels_for_publish",{p_workspace:post.workspace_id,p_platforms:platforms}))||[];
    if(!channels.length){ await sbRpc("social_post_finalize",{p_post:post.id,p_status:"failed"}); processed++; continue; }
    let anyOk=false;
    for(const ch of channels){
      const res=await publishOne(ch.platform,ch,post.body||"",post.media||[]);
      await sbRpc("social_target_record",{p_post:post.id,p_channel:ch.id,p_platform:ch.platform,p_status:res.ok?"published":"failed",p_external_id:res.id??null,p_url:res.url??null,p_error:res.error??null});
      if(res.ok) anyOk=true;
    }
    await sbRpc("social_post_finalize",{p_post:post.id,p_status:anyOk?"published":"failed"});
    if(anyOk) published++;
    processed++;
  }

  // ── scheduled email campaigns (only when email sending is configured) ──
  let emails=0;
  if(Deno.env.get("RESEND_API_KEY")){
    try{
      const dueMail=(await sbRpc("email_due_campaigns",{}))||[];
      const secret=await sbRpc("social_cron_secret_get",{});
      for(const c of dueMail){
        const marked=await sbRpc("email_mark_sending",{p_id:c.id});
        if(!marked) continue;
        const r=await fetch(`${SUPABASE_URL}/functions/v1/email-send`,{method:"POST",headers:{"Content-Type":"application/json","x-cron-secret":secret},body:JSON.stringify({workspace:c.workspace_id,campaign_id:c.id,mode:"real"})});
        if(r.ok) emails++;
      }
    }catch(e){ console.warn("email cron",e); }
  }
  return new Response(JSON.stringify({processed,published,emails}),{headers:{"Content-Type":"application/json"}});
});
