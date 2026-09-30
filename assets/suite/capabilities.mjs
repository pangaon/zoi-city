// Feature permissions and operational provider readiness are separate facts.
export function resolveCapabilities(flags, provider) {
 const f=flags&&typeof flags==='object'?flags:{};
 const services=provider&&typeof provider.services==='object'?provider.services:{};
 return {...f,
  ai:f.ai===true&&services.ai===true,
  email:f.email===true&&services.email===true,
  payments:f.payments===true&&services.payments===true,
  providerUnavailable:!provider,
 };
}
export async function loadProviderConfig(base,key,{fetcher=fetch,timeout=5000}={}){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const r=await fetcher(base+'/functions/v1/social-config',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:'{}',signal:controller.signal});
  if(!r.ok)throw Error('provider_config_unavailable');
  const value=await r.json();
  if(!value||!Array.isArray(value.platforms)||!value.services||typeof value.services!=='object')throw Error('provider_config_invalid');
  return value;
 }finally{clearTimeout(timer)}
}
