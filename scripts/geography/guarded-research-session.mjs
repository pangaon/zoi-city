import{requestPage,sourceURL,fetchRespectingRobots}from'../quality/source-fetch.mjs';
/** Three public-host requests at once; a single host remains serialized/spaced.
 * Reuses the existing DNS-pinned, streamed-byte-capped transport and robots policy. */
export function geographyResearchSession({request=requestPage,concurrency=3,spacingMs=1200,maxRequests=200,maxBytes=30000000,deadline=Date.now()+240000,now=Date.now,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const pending=new Map(),cache=new Map(),hostTails=new Map(),lastHost=new Map(),slots=[];let active=0;
 const stats={requests:0,cache_hits:0,bytes:0,max_active:0};
 const acquire=()=>new Promise(resolve=>{if(active<concurrency){active++;stats.max_active=Math.max(stats.max_active,active);resolve();}else slots.push(resolve);});
 const release=()=>{if(slots.length)slots.shift()();else active--;};
 const guarded=url=>{
  const u=sourceURL(url),key=u.href,host=u.hostname.replace(/^www\./,'');
  if(cache.has(key)){stats.cache_hits++;return Promise.resolve(cache.get(key));}
  if(pending.has(key)){stats.cache_hits++;return pending.get(key);}
  const preceding=hostTails.get(host)||Promise.resolve();
  const operation=(async()=>{await preceding.catch(()=>{});await acquire();try{
   const delay=spacingMs-(now()-(lastHost.get(host)??-Infinity));if(delay>0)await wait(Math.min(delay,Math.max(0,deadline-now())));
   if(now()>=deadline)throw Error('source_time_budget');if(stats.requests>=maxRequests)throw Error('source_request_budget');if(stats.bytes>=maxBytes)throw Error('source_byte_budget');
   lastHost.set(host,now());stats.requests++;let streamed=0;
   const response=await request(key,{maxBytes:Math.min(1500000,Math.max(1,maxBytes-stats.bytes)),timeout:Math.min(8000,Math.max(1,deadline-now())),onBytes:n=>{streamed+=n;stats.bytes+=n;if(stats.bytes>maxBytes)throw Error('source_byte_budget')}});
   if(!streamed)stats.bytes+=response.bytes||0;if(stats.bytes>maxBytes)throw Error('source_byte_budget');
   if(response.status===200||u.pathname==='/robots.txt'&&[404,410].includes(response.status))cache.set(key,response);
   return response;
  }finally{release();}})();pending.set(key,operation);hostTails.set(host,operation);operation.then(()=>pending.delete(key),()=>pending.delete(key));return operation;
 };
 return{stats,sourceFetch:url=>fetchRespectingRobots(url,{request:guarded})};
}
