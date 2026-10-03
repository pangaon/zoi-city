// Only public media identifiers found on the business's own page. No feed, audience or ownership claims.
const decode=value=>String(value).replace(/&amp;|&#38;|&#x26;/gi,'&');
export function publicMedia(raw){
 if(typeof raw!=='string'||raw.length>2048)return null;
 let u;try{u=new URL(decode(raw).startsWith('//')?'https:'+decode(raw):decode(raw));}catch{return null;}
 if(!/^https?:$/.test(u.protocol)||u.username||u.password||u.port)return null;
 const host=u.hostname.toLowerCase(),path=u.pathname;let match,id;
 if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com','youtu.be'].includes(host)){
  id=host==='youtu.be'?path.slice(1):u.searchParams.get('v')||/^\/(?:embed|shorts)\/([^/]+)\/?$/.exec(path)?.[1];
  if(/^[A-Za-z0-9_-]{11}$/.test(id||''))return{platform:'youtube',url:'https://www.youtube.com/watch?v='+id,embed:true};
  if(['youtube.com','www.youtube.com','m.youtube.com'].includes(host)&&/^\/(?:@[^/]+|(?:channel|c|user)\/[^/]+)\/?$/.test(path))return{platform:'youtube',url:'https://www.youtube.com'+path,embed:false};
  return null;
 }
 if(host==='open.spotify.com'){
  match=/^\/(?:intl-[a-z]{2}\/)?(?:embed\/)?(artist|album|track|playlist|episode|show)\/([A-Za-z0-9]{22})\/?$/.exec(path);
  return match?{platform:'spotify',url:'https://open.spotify.com/'+match[1]+'/'+match[2],embed:true}:null;
 }
 if(host==='music.apple.com'&&/^\/[a-z]{2}\/(artist|album|song)\/[^/]+\/\d+\/?$/.test(path))return{platform:'apple',url:'https://music.apple.com'+path,embed:false};
 if(host.endsWith('.bandcamp.com')&&host.split('.').length===3&&/^\/(?:|(?:album|track)\/[^/]+\/?)$/.test(path))return{platform:'bandcamp',url:'https://'+host+path,embed:false};
 if(['soundcloud.com','www.soundcloud.com'].includes(host)&&/^\/[^/]+(?:\/[^/]+)?\/?$/.test(path)&&!/^\/(discover|search|stream|you|upload|terms|pages)(\/|$)/.test(path))return{platform:'soundcloud',url:'https://soundcloud.com'+path,embed:false};
 if(['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(host)&&(match=/^\/(?:video\/)?(\d+)\/?$/.exec(path)))return{platform:'vimeo',url:'https://vimeo.com/'+match[1],embed:false};
 return null;
}
export function extractPublicMedia(doc){
 const html=String(doc).replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 const listen={},embeds=[],videos=[];const seen=new Set();
 for(const tag of html.matchAll(/<(a|iframe)\b[^>]*>/gi)){
  const attr=tag[1].toLowerCase()==='a'?'href':'src';
  const m=tag[0].match(new RegExp('\\s'+attr+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))','i'));
  const link=publicMedia(m?.[1]??m?.[2]??m?.[3]);if(!link||seen.has(link.url))continue;seen.add(link.url);
  if(link.platform!=='vimeo'&&!listen[link.platform])listen[link.platform]=link.url;
  if(link.embed&&embeds.length<4)embeds.push(link.url);
  if(['youtube','vimeo'].includes(link.platform)&&(link.embed||link.platform==='vimeo')&&videos.length<4)videos.push(link.url);
  if(seen.size>=24)break;
 }
 return{listen,embeds,video_urls:videos};
}
