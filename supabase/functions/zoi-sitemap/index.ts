import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BASE="https://zoi.city";
Deno.serve(async()=>{
 const r=await fetch(`${U}/rest/v1/rpc/zoi_sitemap`,{method:"POST",headers:{apikey:K,Authorization:`Bearer ${K}`,"Content-Type":"application/json"},body:"{}"});
 const rows=r.ok?await r.json():[];
 const urls=(rows||[]).map((p:any)=>`<url><loc>${BASE}${p.path}</loc><lastmod>${p.lastmod}</lastmod></url>`).join("");
 const xml=`<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"><url><loc>${BASE}/</loc></url>${urls}</urlset>`;
 return new Response(xml,{headers:{"Content-Type":"application/xml","Cache-Control":"public, max-age=3600"}});
});
