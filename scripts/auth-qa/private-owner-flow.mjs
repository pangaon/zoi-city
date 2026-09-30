// Inert library: execution requires a separately reviewed runner and private fixture.
import {QA} from './session.mjs';
export const OWNER_QA=Object.freeze({listing:'48c711ee-e83b-4ce2-a7cc-4126d713048a',request:'fd78dcbc-6164-4658-8e87-1b5e38debe9c',description:'ZOI INTERNAL QA — private edited wording; not a public business.',menu:[{section:'INTERNAL QA',items:[{name:'Synthetic test entry — not offered for sale',note:'Private preview only'}]}]});
export const OWNER_DESIGN=Object.freeze({schema_version:1,template:'concierge',section_order:['intro','offerings','gallery','calendar','media','socials','contact'],hidden_sections:[],copy:{},item_order:{offerings:[]}});
const scope={p_workspace:QA.workspace,p_listing:OWNER_QA.listing};
function snapshot(r){if(r?.ok!==true||r.workspace_id!==QA.workspace||r.listing_id!==OWNER_QA.listing||!/^[a-f0-9]{32}$/.test(r.version||''))throw Error('qa_owner_snapshot_unconfirmed');return r;}
// PostgreSQL jsonb may reorder object keys. Match exact JSON shape and values,
// retaining array order and rejecting extra keys, coercion and non-JSON values.
export function sameJsonShape(a,b){
 if(a===null||b===null)return a===null&&b===null;
 if(typeof a!==typeof b)return false;
 if(typeof a==='string'||typeof a==='boolean')return a===b;
 if(typeof a==='number')return Number.isFinite(a)&&Number.isFinite(b)&&a===b;
 if(typeof a!=='object')return false;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&Object.keys(a).length===a.length&&Object.keys(b).length===b.length&&Array.from({length:a.length},(_,i)=>sameJsonShape(a[i],b[i])).every(Boolean);
 if(Object.getPrototypeOf(a)!==Object.prototype||Object.getPrototypeOf(b)!==Object.prototype)return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&sameJsonShape(a[key],b[key]));
}
export function ownerSavePayload(version){if(!/^[a-f0-9]{32}$/.test(version||''))throw Error('qa_owner_version_invalid');return{...scope,p_request:OWNER_QA.request,p_expected_version:version,p_base:{description:OWNER_QA.description,phone:null,email:null,website:null,hours:null,price_range:null,photo_url:null,social_links:{}},p_profile:{menu:OWNER_QA.menu,hero_position:'center',logo_fit:'contain'}};}
// Adapters must use the verified QA actor and return decoded responses only in memory.
// No generic mutation parameter, publish call, external URL, or automatic retry exists.
export async function privateOwnerFlow({rpc,preview}){
 const before=snapshot(await rpc('home_content_get',scope));
 const payload=ownerSavePayload(before.version);
 const receipt=await rpc('home_content_save',payload);
 if(receipt?.ok!==true||receipt.request_id!==OWNER_QA.request||receipt.workspace_id!==QA.workspace||receipt.listing_id!==OWNER_QA.listing||!/^[a-f0-9]{32}$/.test(receipt.version||'')||receipt.version===before.version)throw Error('qa_owner_save_unconfirmed');
 const after=snapshot(await rpc('home_content_get',scope));
 if(after.version!==receipt.version||after.base?.description!==OWNER_QA.description||!sameJsonShape(after.profile?.menu,OWNER_QA.menu))throw Error('qa_owner_readback_unconfirmed');
 const rendered=await preview({workspace:QA.workspace,listing:OWNER_QA.listing,design:OWNER_DESIGN});
 if(rendered?.ok!==true||rendered.listing!==OWNER_QA.listing||typeof rendered.html!=='string'||!rendered.html.includes('ZOI INTERNAL QA')||!rendered.html.includes('private edited wording')||!rendered.html.includes('Synthetic test entry'))throw Error('qa_owner_preview_unconfirmed');
 return{edit:true,version_readback:true,private_preview_html:true,public_publish:false,normal_creation:false,browser_interaction:false};
}
