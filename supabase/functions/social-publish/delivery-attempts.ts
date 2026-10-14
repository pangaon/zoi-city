// Provider-independent durable delivery coordinator. Database transitions issue
// one dispatch permission; unknown transitions/results never resend a provider.
// Callers must supply the actual provider adapter and must not retry its writes.
type RPC=(name:string,args:Record<string,unknown>)=>Promise<any>;
type SendResult={ok:boolean;id?:string;url?:string;uncertain?:boolean;knownRejected?:boolean};
function confirmed(value:any){if(value?.ok!==true)throw Error('delivery_receipt_unconfirmed');return value;}
export function deliveryResult(result:SendResult){
 if(result?.ok===true&&typeof result.id==='string'&&result.id)return{outcome:'published',external_id:result.id,...(result.url?{external_url:result.url}:{})};
 if(result?.knownRejected===true&&result.ok===false&&!result.uncertain)return{outcome:'rejected',error_code:'provider_rejected'};
 return{outcome:'unknown',error_code:'provider_result_unknown_requires_reconciliation'};
}
export async function runDurableDelivery({rpc,postId,channelId,requestId,send,preflight=()=>true,now=()=>Date.now()}: {
 rpc:RPC;postId:string;channelId:number|string;requestId:string;
 send:(post:any,channel:any,checkpoint:(ref:Record<string,unknown>)=>Promise<void>,step:(name:string)=>Promise<any>)=>Promise<SendResult>;
 preflight?:(payload:any)=>boolean;now?:()=>number;
}){
 const context={p_post:postId,p_channel:channelId,p_request:requestId};let claim:any;
 try{claim=confirmed(await rpc('social_delivery_attempt_claim',context));}
 catch{
  // Read the same immutable request identity. A new nonce cannot resolve whether
  // the first reservation committed, and is never generated here.
  try{const found=confirmed(await rpc('social_delivery_attempt_get',context));if(!found.found)return{status:'preparation_uncertain',requestId};claim={...found,claimed:found.attempt?.state==='prepared'&&!!found.lease};}
  catch{return{status:'preparation_uncertain',requestId};}
 }
 if(!claim.claimed)return{status:claim.reason||claim.attempt?.state||'held',requestId,attempt:claim.attempt};
 if(!claim.attempt?.id||!claim.lease)return{status:'preparation_uncertain',requestId};
 const capability={p_attempt:claim.attempt.id,p_lease:claim.lease};
 if(!preflight(claim.payload)){
  try{const cancelled=confirmed(await rpc('social_delivery_attempt_cancel',capability));return{status:cancelled.cancelled?'not_dispatched':'held',requestId,attempt:cancelled.attempt};}
  catch{return{status:'preparation_uncertain',requestId,attempt:claim.attempt};}
 }
 let permit:any;
 try{permit=confirmed(await rpc('social_delivery_attempt_begin',capability));}
 catch{
  // A committed begin with a lost response could already have granted dispatch
  // elsewhere. Cancel only a still-prepared lease; never send without a receipt.
  try{const cancelled=confirmed(await rpc('social_delivery_attempt_cancel',capability));return{status:cancelled.cancelled?'not_dispatched':'dispatch_confirmation_uncertain',requestId,attempt:cancelled.attempt};}
  catch{return{status:'dispatch_confirmation_uncertain',requestId,attempt:claim.attempt};}
 }
 if(permit.dispatch!==true)return{status:permit.attempt?.state||'held',requestId,attempt:permit.attempt};
 if(!permit.post||!permit.channel||String(permit.channel.id)!==String(channelId)||!permit.attempt?.lease_until||Date.parse(permit.attempt.lease_until)<=now())return{status:'dispatch_confirmation_uncertain',requestId,attempt:permit.attempt};
 const checkpoint=async(ref:Record<string,unknown>)=>{
  // The adapter must await this exact receipt before a second provider operation
  // (e.g. publishing an Instagram container). No credential is stored here.
  let error:any;for(let retry=0;retry<2;retry++){try{confirmed(await rpc('social_delivery_attempt_checkpoint',{...capability,p_ref:ref}));return;}catch(e){error=e;}}
  throw error;
 };
 const step=async(name:string)=>{const receipt=confirmed(await rpc('social_delivery_attempt_step',{...capability,p_step:name}));if(receipt.dispatch!==true||!receipt.post||!receipt.channel||String(receipt.channel.id)!==String(channelId))throw Error('delivery_step_permission_unconfirmed');return receipt;};
 let result:Record<string,unknown>;
 try{result=deliveryResult(await send(permit.post,permit.channel,checkpoint,step));}
 catch{result={outcome:'unknown',error_code:'provider_result_unknown_requires_reconciliation'};}
 // Retry only an immutable database result receipt, never the provider callback.
 for(let retry=0;retry<2;retry++){
  try{const saved=confirmed(await rpc('social_delivery_attempt_record',{...capability,p_result:result}));return{status:saved.attempt?.state||result.outcome,requestId,attempt:saved.attempt};}
  catch{}
 }
 return{status:'result_confirmation_uncertain',requestId,attempt:permit.attempt,result};
}
