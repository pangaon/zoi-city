import{inquiryId}from'./inquiries.ts';
import type{PrivateRequestStore}from'./privateRequests.ts';
export type InquiryMarker={user:string;kind:'start'|'reply';request:string;target:string};
export function inquiryMarker(value:any,user:string):InquiryMarker|null{if(value===null)return null;if(!value||value.user!==user||!['start','reply'].includes(value.kind)||!inquiryId(value.request)||!inquiryId(value.target)||Object.keys(value).some(k=>!['user','kind','request','target'].includes(k)))throw Error('The saved enquiry recovery record cannot be verified. Do not send a replacement.');return value;}
export function inquiryRecoveryResult(value:any,marker:InquiryMarker){if(value?.ok!==true)throw Error('The enquiry recovery was not confirmed.');if(value.found===true){const r=value.receipt;if(r?.request_id!==marker.request||r.kind!==marker.kind||!inquiryId(r.thread_id)||(marker.kind==='start'?r.listing_id:r.thread_id)!==marker.target)throw Error('The saved enquiry receipt did not match this request.');return{thread:r.thread_id as string,cancelled:false};}if(value.cancelled===true&&value.request_id===marker.request)return{thread:null,cancelled:true};if(value.found===false&&value.cancelled===false&&value.request_id===marker.request)return null;throw Error('The enquiry recovery response could not be verified.');}
export class InquiryRecovery{
 private store:PrivateRequestStore;private user:string;
 constructor(store:PrivateRequestStore,user:string){this.store=store;this.user=user;}
 async load(){return inquiryMarker(await this.store.load(this.user),this.user);}
 async begin(marker:InquiryMarker){inquiryMarker(marker,this.user);if(await this.load())throw Error('Resolve the earlier enquiry request before sending another.');await this.store.save(this.user,marker);const stored=await this.load();if(!stored||stored.request!==marker.request||stored.kind!==marker.kind||stored.target!==marker.target)throw Error('The enquiry recovery could not be saved. Nothing was sent.');}
 async clear(){await this.store.clear(this.user);}
}
