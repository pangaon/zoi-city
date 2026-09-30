// Canonical metadata reflects the same normalized public content as the home.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=v=>JSON.stringify(v).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const text=v=>typeof v==='string'?v.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim():'';
const https=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
export function completeHomeMetadata(html,data){
 const canonical=https(data.canonical);if(!canonical||new URL(canonical).hostname!=='www.zoi.city')throw Error('A canonical Zoi home URL is required.');
 const name=text(data.name),title=text(data.title)||name+' · Zoi',description=(text(data.description)||name+(data.location?' · '+text(data.location):'')+'. Explore contact information and published details.').slice(0,240),image=https(data.image);
 const subject={'@type':['Person','Restaurant','Church'].includes(data.type)?data.type:'Thing','@id':canonical+'#identity',name,url:canonical};
 if(image)subject.image=image;if(description)subject.description=description;
 if(subject['@type']!=='Thing'&&text(data.address))subject.address=text(data.address);
 if(subject['@type']!=='Thing'&&/^\+?[\d ()-]{6,25}$/.test(data.phone||''))subject.telephone=data.phone;
 if(subject['@type']!=='Thing'&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(data.email||''))subject.email=data.email;
 const links=[...new Set((data.sameAs||[]).map(https).filter(Boolean))];if(links.length)subject.sameAs=links;
 const schema={'@context':'https://schema.org','@type':'WebPage','@id':canonical+'#webpage',url:canonical,name:title,description,mainEntity:subject};
 const metadata=`<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:site_name" content="Zoi"><meta property="og:type" content="website"><meta property="og:url" content="${esc(canonical)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta name="twitter:card" content="${image?'summary_large_image':'summary'}"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}">${image?`<meta property="og:image" content="${esc(image)}"><meta property="og:image:alt" content="${esc(name)}"><meta name="twitter:image" content="${esc(image)}">`:''}<script type="application/ld+json">${json(schema)}</script>`;
 return html.replace(/<head>([\s\S]*?)<\/head>/i,(_,head)=>'<head>'+head.replace(/<title>[\s\S]*?<\/title>/gi,'').replace(/<meta\b[^>]*(?:name|property)=["'](?:description|og:[^"']+|twitter:[^"']+)["'][^>]*>/gi,'').replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi,'').replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,'')+metadata+'</head>');
}
