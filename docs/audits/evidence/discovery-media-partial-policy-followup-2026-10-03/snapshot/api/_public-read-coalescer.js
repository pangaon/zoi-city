// Public anonymous reads only. No settled result, negative result or failure is retained.
export function createPublicReadCoalescer({maxKeys=128}={}){
 if(!Number.isInteger(maxKeys)||maxKeys<1||maxKeys>128)throw Error('Invalid public read bound');
 const pending=new Map();
 return function coalesce(key,read){
  if(typeof key!=='string'||typeof read!=='function')throw Error('Invalid public read');
  let job=pending.get(key);
  if(!job){
   // At capacity, execute independently rather than evicting an active request or queueing indefinitely.
   if(pending.size>=maxKeys)return Promise.resolve().then(read).then(value=>structuredClone(value));
   job=Promise.resolve().then(read);pending.set(key,job);
   const clear=()=>{if(pending.get(key)===job)pending.delete(key);};
   job.then(clear,clear);
  }
  return job.then(value=>structuredClone(value));
 };
}
