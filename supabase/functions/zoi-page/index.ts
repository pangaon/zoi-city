import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BASE="https://zoi.city";
async function rpc(fn:string,body:Record<string,unknown>){const r=await fetch(`${U}/rest/v1/rpc/${fn}`,{method:"POST",headers:{apikey:K,Authorization:`Bearer ${K}`,"Content-Type":"application/json"},body:JSON.stringify(body)});if(!r.ok)return null;return await r.json();}
function e(s:unknown){return (s==null?"":String(s)).replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[c]!));}
function link(p:string,t:string){return `<a href=\"?path=${encodeURIComponent(p)}\">${e(t)}</a>`;}
function layout(o:{title:string,desc:string,path:string,body:string,jsonld?:unknown,crumb?:string}){
 return `<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">`+
 `<title>${e(o.title)}</title><meta name=\"description\" content=\"${e(o.desc)}\">`+
 `<link rel=\"canonical\" href=\"${BASE}${o.path}\">`+
 `<meta property=\"og:title\" content=\"${e(o.title)}\"><meta property=\"og:description\" content=\"${e(o.desc)}\"><meta property=\"og:type\" content=\"website\">`+
 (o.jsonld?`<script type=\"application/ld+json\">${JSON.stringify(o.jsonld)}</script>`:``)+
 `<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:900px;margin:0 auto;padding:18px;color:#10203b;line-height:1.55}a{color:#1a73e8;text-decoration:none}a:hover{text-decoration:underline}header{display:flex;align-items:center;gap:10px;border-bottom:1px solid #e6ecf4;padding-bottom:12px;margin-bottom:14px}.m{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#0a3d8f,#10a5b8);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800}h1{font-size:26px;margin:6px 0}.crumb{color:#5a6b86;font-size:13px;margin-bottom:10px}.card{border:1px solid #e6ecf4;border-radius:12px;padding:13px 15px;margin:9px 0}.card .n{font-weight:700}.muted{color:#5a6b86;font-size:14px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}.chip{display:inline-block;border:1px solid #e6ecf4;border-radius:999px;padding:6px 12px;margin:3px;font-size:13px}footer{margin-top:30px;border-top:1px solid #e6ecf4;padding-top:14px;color:#8a97ad;font-size:12px}</style></head><body>`+
 `<header><div class=\"m\">Z</div><div><div style=\"font-weight:800\">Zoi</div><div class=\"muted\" style=\"font-size:11px\">The global Greek directory · zoi.city</div></div></header>`+
 (o.crumb?`<div class=\"crumb\">${o.crumb}</div>`:``)+o.body+
 `<footer>Zoi (Ζωή) — everything Greek, in one place. Verified listings, churches, monasteries, events &amp; vendors worldwide. ${link("/","Browse all")}</footer></body></html>`;
}
Deno.serve(async (req)=>{
 const url=new URL(req.url);let path=url.searchParams.get("path")||"/";
 const H={"Content-Type":"text/html; charset=utf-8","Cache-Control":"public, max-age=600"};
 try{
  if(path.startsWith("/e/")){const slug=path.slice(3);const l=await rpc("zoi_seo_entity",{p_slug:slug});
   if(!l)return new Response(layout({title:"Not found | Zoi",desc:"",path,body:"<h1>Listing not found</h1>"+link("/","Back to Zoi")}),{status:404,headers:H});
   const addr=[l.address,l.city,l.province_state,l.country].filter(Boolean).join(", ");
   const mapq=encodeURIComponent(l.name+" "+(l.address||l.city||""));
   const body=`<div class=\"crumb\">${link("/","Zoi")} › ${e(l.country)} › ${link("/city/"+String(l.city).toLowerCase().replace(/ /g,"-"),l.city)} › ${l.category_slug?link("/c/"+l.category_slug,l.category):e(l.category)}</div>`+
    `<h1>${e(l.name)}</h1><div class=\"muted\">${e(l.category||l.et)}${l.rating?" · ★ "+l.rating:""}</div>`+
    (l.description?`<p>${e(l.description)}</p>`:``)+
    `<div class=\"card\">`+(addr?`<div>📍 ${e(addr)}</div>`:``)+(l.phone?`<div>📞 <a href=\"tel:${e(l.phone)}\">${e(l.phone)}</a></div>`:``)+(l.website?`<div>🌐 <a href=\"${e(l.website)}\" rel=\"noopener\">${e(l.website)}</a></div>`:``)+(l.hours?`<div>⏰ ${e(l.hours)}</div>`:``)+`<div><a href=\"https://www.google.com/maps/search/?api=1&query=${mapq}\" rel=\"noopener\">Get directions →</a></div></div>`+
    `<p>${l.category_slug?link("/c/"+l.category_slug,"More "+l.category):""} · ${link("/city/"+String(l.city).toLowerCase().replace(/ /g,"-"),"More in "+l.city)}</p>`;
   return new Response(layout({title:l.meta_title,desc:l.meta_description||(l.name+" — "+(l.category||"")+" in "+(l.city||"")),path:l.canonical_path,body,jsonld:l.jsonld,crumb:""}),{headers:H});
  }
  if(path.startsWith("/c/")||path.startsWith("/city/")){const kind=path.startsWith("/c/")?"category":"city";let val=path.startsWith("/c/")?path.slice(3):path.slice(6).replace(/-/g," ");
   const h=await rpc("zoi_seo_hub",{p_kind:kind,p_value:val});const items=(h&&h.items)||[];
   const label=kind==="category"?(items[0]?items[0].category:val):val;
   const title=kind==="category"?`Greek ${label} worldwide | Zoi`:`Greek ${label} — restaurants, churches &amp; businesses | Zoi`;
   const desc=kind==="category"?`Discover ${items.length} verified Greek ${label} on Zoi, the global Greek directory.`:`Everything Greek in ${label}: ${items.length} verified restaurants, churches, professionals & vendors on Zoi.`;
   const body=`<h1>${kind==="category"?"Greek "+e(label):"Greek "+e(label)}</h1><div class=\"muted\">${items.length} verified listings</div>`+
    `<div style=\"margin-top:12px\">`+items.map((x:any)=>`<div class=\"card\"><div class=\"n\">${link("/e/"+x.slug,x.name)}</div><div class=\"muted\">${e(x.category||x.et)}${x.city?" · "+e(x.city):""}${x.country?", "+e(x.country):""}${x.address?" · "+e(x.address):""}</div></div>`).join("")+`</div>`+
    `<p style=\"margin-top:14px\">${link("/","‹ All Greek cities & categories")}</p>`;
   const ld={"@context":"https://schema.org","@type":"ItemList",name:title,numberOfItems:items.length,itemListElement:items.slice(0,50).map((x:any,i:number)=>({"@type":"ListItem",position:i+1,name:x.name,url:BASE+"/e/"+x.slug}))};
   return new Response(layout({title,desc,path,body,jsonld:ld}),{headers:H});
  }
  // index
  const idx=await rpc("zoi_seo_index",{});const cats=(idx&&idx.categories)||[];const cities=(idx&&idx.cities)||[];
  const body=`<h1>Everything Greek, in one place</h1><div class=\"muted\">${idx?idx.total:0} verified Greek businesses, churches, monasteries, professionals, events &amp; vendors worldwide.</div>`+
   `<h2>Browse by category</h2><div>`+cats.map((c:any)=>`<span class=\"chip\">${link("/c/"+c.slug,c.label+" ("+c.n+")")}</span>`).join("")+`</div>`+
   `<h2>Browse by city</h2><div>`+cities.map((c:any)=>`<span class=\"chip\">${link("/city/"+String(c.city).toLowerCase().replace(/ /g,"-"),c.city+" ("+c.n+")")}</span>`).join("")+`</div>`;
  return new Response(layout({title:"Zoi — The global Greek directory & encyclopedia",desc:"Discover verified Greek restaurants, bakeries, churches, monasteries, professionals, organizations and events worldwide on Zoi.",path:"/",body}),{headers:H});
 }catch(err){return new Response("error: "+String(err),{status:500});}
});
