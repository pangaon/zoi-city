import https from 'node:https';
import {resolve4} from 'node:dns/promises';
const ranges=[[0,8],[10*2**24,8],[100*2**24+64*2**16,10],[127*2**24,8],[169*2**24+254*2**16,16],[172*2**24+16*2**16,12],[192*2**24,24],[192*2**24+168*2**16,16],[192*2**24+2*256,24],[192*2**24+88*2**16+99*256,24],[198*2**24+18*2**16,15],[198*2**24+51*2**16+100*256,24],[203*2**24+113*256,24],[224*2**24,3]];
export function publicIPv4(ip){if(!/^\d+\.\d+\.\d+\.\d+$/.test(ip))return false;const a=ip.split('.').map(Number);if(a.some(x=>x>255))return false;const n=a.reduce((sum,x)=>sum*256+x,0);return !ranges.some(([base,bits])=>Math.floor(n/2**(32-bits))===Math.floor(base/2**(32-bits)))}
export function sourceURL(raw){let u;try{u=new URL(raw)}catch{throw Error('invalid_source_url')}if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||/^\d[\d.]+$/.test(u.hostname)||u.hostname.includes(':')||/(?:^|\.)(localhost|local|internal|intranet|lan|home|corp|private|test|example|invalid|onion)$/.test(u.hostname))throw Error('unsafe_source_url');return u;}
export async function requestPage(url,{maxBytes=1500000,timeout=8000,onBytes=()=>{}}={}){
 const started=Date.now();const u=sourceURL(url),addresses=await Promise.race([resolve4(u.hostname),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('source_dns_timeout')),Math.min(5000,timeout));timer.unref()})]);if(!addresses.length||addresses.some(ip=>!publicIPv4(ip)))throw Error('unsafe_source_dns');
 const remaining=timeout-(Date.now()-started);if(remaining<=0)throw Error('source_timeout');
 return new Promise((resolve,reject)=>{const req=https.request(u,{method:'GET',headers:{'user-agent':'ZoiQualityBot/1.0 (+https://www.zoi.city; source identity quality audit)','accept':'text/html,application/xhtml+xml,text/plain;q=0.8'},lookup:(host,options,callback)=>options?.all?callback(null,[{address:addresses[0],family:4}]):callback(null,addresses[0],4)},res=>{let size=0,chunks=[];res.on('data',b=>{size+=b.length;try{onBytes(b.length);}catch(error){req.destroy(error);return;}if(size>maxBytes){req.destroy(Error('source_too_large'));return}chunks.push(b)});res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:Buffer.concat(chunks).toString('utf8'),body:Buffer.concat(chunks),bytes:size,url:u.href}))});const timer=setTimeout(()=>req.destroy(Error('source_timeout')),remaining);req.on('close',()=>clearTimeout(timer));req.setTimeout(remaining,()=>req.destroy(Error('source_timeout')));req.on('error',reject);req.end()});
}
export async function fetchSource(url,{request=requestPage,maxRedirects=3}={}){let u=sourceURL(url);for(let hop=0;hop<=maxRedirects;hop++){const r=await request(u.href);if([301,302,303,307,308].includes(r.status)){if(!r.headers.location||hop===maxRedirects)throw Error('source_redirect_limit');const next=sourceURL(new URL(r.headers.location,u).href);if(next.hostname.replace(/^www\./,'')!==u.hostname.replace(/^www\./,''))throw Error('source_cross_host_redirect');u=next;continue}return{...r,url:u.href}}throw Error('source_redirect_limit')}
export function robotsAllows(text,path){let agents=[],rules=[],groups=[],seenRule=false;for(const raw of String(text).split(/\r?\n/)){const line=raw.replace(/#.*/,'').trim(),m=/^(user-agent|disallow|allow)\s*:\s*(.*)$/i.exec(line);if(!m)continue;const k=m[1].toLowerCase(),v=m[2].trim();if(k==='user-agent'){if(seenRule){groups.push({agents,rules});agents=[];rules=[];seenRule=false}agents.push(v.toLowerCase())}else if(agents.length){seenRule=true;if(v)rules.push({allow:k==='allow',path:v})}}groups.push({agents,rules});const own=groups.filter(g=>g.agents.some(a=>a!=='*'&&'zoiqualitybot'.includes(a))),chosen=own.length?own:groups.filter(g=>g.agents.includes('*'));const matches=chosen.flatMap(g=>g.rules).filter(r=>{const pattern=r.path.split('*').map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*').replace(/\\\$$/,'$');return new RegExp('^'+pattern).test(path)}).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));return !matches.length||matches[0].allow;}
export async function fetchRespectingRobots(url,options={}){
 let u=sourceURL(url);const request=options.request||requestPage;
 for(let hop=0;hop<=3;hop++){
  const robots=await fetchSource(new URL('/robots.txt',u).href,options);
  if(robots.status===200&&!robotsAllows(robots.text,u.pathname+u.search))throw Error('robots_disallow');
  if(![200,404,410].includes(robots.status))throw Error('robots_unavailable');
  const response=await request(u.href);
  if([301,302,303,307,308].includes(response.status)){
   if(!response.headers.location||hop===3)throw Error('source_redirect_limit');
   const next=sourceURL(new URL(response.headers.location,u).href);
   if(next.hostname.replace(/^www\./,'')!==u.hostname.replace(/^www\./,''))throw Error('source_cross_host_redirect');
   u=next;continue;
  }
  return{...response,url:u.href};
 }
 throw Error('source_redirect_limit');
}

// Per-run only: bounded cache and one request at a time, including redirects.
export function createSourceSession({request=requestPage,spacingMs=1000,maxEntries=80,maxRequests=100,maxBytes=Infinity,deadline=Infinity,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now}={}){
 const cache=new Map(),lastHost=new Map();let tail=Promise.resolve();const stats={requests:0,cache_hits:0,bytes:0};
 const cachedRequest=url=>{const key=sourceURL(url).href;if(cache.has(key)){stats.cache_hits++;return Promise.resolve(cache.get(key))}const run=tail.then(async()=>{if(cache.has(key)){stats.cache_hits++;return cache.get(key)}if(stats.requests>=maxRequests)throw Error('source_request_budget');if(now()>=deadline)throw Error('source_time_budget');if(stats.bytes>=maxBytes)throw Error('source_byte_budget');const host=new URL(key).hostname.replace(/^www\./,''),delay=spacingMs-(now()-(lastHost.get(host)??-Infinity));if(delay>0)await wait(Math.min(delay,Math.max(0,deadline-now())));if(now()>=deadline)throw Error('source_time_budget');lastHost.set(host,now());stats.requests++;let streamed=0;const response=await request(key,{maxBytes:Math.max(1,maxBytes-stats.bytes),timeout:Math.min(8000,Math.max(1,deadline-now())),onBytes:n=>{streamed+=n;stats.bytes+=n;if(stats.bytes>maxBytes)throw Error('source_byte_budget');}});if(!streamed)stats.bytes+=response.bytes||0;if(stats.bytes>maxBytes)throw Error('source_byte_budget');if((response.status===200||new URL(key).pathname==='/robots.txt'&&[404,410].includes(response.status))&&cache.size<maxEntries)cache.set(key,response);return response});tail=run.catch(()=>{});return run;};
 return{sourceFetch:url=>fetchRespectingRobots(url,{request:cachedRequest}),publicFetch:url=>fetchSource(url,{request:cachedRequest}),stats};
}
