import { mountFestivalMap } from '/assets/festival/map-operator.mjs';
import { mountVendorBusiness } from '/assets/festival/map-vendor.mjs';
import { mountPublicMap } from '/assets/festival/map-view.mjs';
import { blankLayout, validateLayout, collisions } from '/assets/festival/map-model.mjs';

// Deliberately in-memory test doubles. They do not emulate Supabase authorization
// or provide evidence that SQL contracts, production auth or integrations work.
const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const event=id(1), workspace=id(2), actor=id(3), application=id(4);
const choices=[
  {workspace_id:id(5),listing_id:id(6),name:'Synthetic Rosie’s Bakery',slug:'synthetic-rosies',href:'/business/synthetic-rosies'},
  {workspace_id:id(7),listing_id:id(8),name:'Synthetic Long Name Florist & Event Studio',slug:'synthetic-florist',href:'/business/synthetic-florist'},
];
let currentActor=actor, record=null, binding=null, bindingVersion=0;
let publicFailure=false, saveFailure=false, accessLost=0, sessionRevoked=false;
const calls=[], receipts=new Map();
const copy=(v)=>structuredClone(v);
const applicationRecord=()=>({id:application,organisation:'Synthetic festival applicant',units:2,binding:copy(binding)});
async function rpc(name,args){
  calls.push({name,request:args.p_request||null,version:args.p_expected_version??null});
  await new Promise(resolve=>setTimeout(resolve,15));
  if(sessionRevoked&&name!=='festival_map_public')throw Object.assign(Error('synthetic_access_revoked'),{status:403});
  if(name==='festival_map_operator')return {ok:true,map:copy(record),applications:[applicationRecord()]};
  if(name==='festival_vendor_businesses')return {ok:true,application_id:application,version:bindingVersion,binding:copy(binding),choices:copy(choices)};
  if(name==='festival_map_public'){
    if(publicFailure){publicFailure=false;throw Error('synthetic_network_failure');}
    if(!record?.published)return {ok:true,available:false};
    const layout=copy(record.published);
    layout.booths=layout.booths.map(b=>({...b,business:b.application_id===application&&binding?.state==='accepted'?copy(binding.business):null}));
    return {ok:true,available:true,event:{name:'Synthetic Toronto Greek Festival'},layout,published_at:'2026-11-04T12:00:00Z'};
  }
  if(receipts.has(args.p_request))return copy(receipts.get(args.p_request));
  let result;
  if(name==='festival_vendor_bind'){
    if(args.p_expected_version!==bindingVersion)throw Error('mesa_version_conflict');
    const choice=choices.find(c=>c.workspace_id===args.p_vendor_workspace&&c.listing_id===args.p_listing);
    if(args.p_listing&&!choice)throw Error('mesa_permission_denied');
    bindingVersion++;binding={state:choice?'proposed':'revoked',version:bindingVersion,business:choice?copy(choice):null};
    result={ok:true,application_id:application,request_id:args.p_request,binding:copy(binding)};
  }else if(name==='festival_vendor_review'){
    if(args.p_expected_version!==bindingVersion)throw Error('mesa_version_conflict');
    if(!binding)throw Error('mesa_binding_unavailable');
    bindingVersion++;binding={...binding,state:args.p_action==='accept'?'accepted':'revoked',version:bindingVersion};
    result={ok:true,request_id:args.p_request,binding:copy(binding)};
  }else if(name==='festival_map_save'){
    if(args.p_expected_version!==(record?.version||0))throw Error('mesa_version_conflict');
    const draft=validateLayout(args.p_layout);
    record={...record,version:(record?.version||0)+1,draft};
    result={ok:true,request_id:args.p_request,map:copy(record)};
  }else if(name==='festival_map_publish'){
    if(args.p_expected_version!==record?.version)throw Error('mesa_version_conflict');
    if(collisions(record.draft).length)throw Error('mesa_booth_collision');
    if(record.draft.booths.some(b=>b.application_id&&binding?.state!=='accepted'))throw Error('mesa_business_acceptance_required');
    record={...record,published:copy(record.draft),published_version:record.version};
    result={ok:true,request_id:args.p_request,map:copy(record)};
  }else throw Error('Unknown synthetic RPC');
  receipts.set(args.p_request,copy(result));
  if(name==='festival_map_save'&&saveFailure){saveFailure=false;throw Error('synthetic_lost_response');}
  return result;
}
const C={auth:{load:()=>({user_id:currentActor})},api:{rpc:async(name,args,options)=>{
  if(options?.beforeDispatch&&!options.beforeDispatch())throw Error('mesa_permission_denied');
  return rpc(name,args);
}}};
let operator,vendor,visitor;
function mountOperator(){operator?.destroy();operator=mountFestivalMap(document.querySelector('#operator'),{rpc,workspace,actor,events:[{id:event,name:'Synthetic Toronto Greek Festival'}],initialEvent:event,isCurrent:()=>currentActor===actor,onAccessLost:()=>{accessLost++;}});}
function mountVendor(){vendor?.destroy();vendor=mountVendorBusiness(document.querySelector('#vendor'),{C,application:{id:application}});}
function mountVisitor(){visitor?.destroy();visitor=mountPublicMap(document.querySelector('#visitor'),{C,event,requested:true});}
document.documentElement.dataset.theme=new URLSearchParams(location.search).get('theme')==='dark'?'dark':'light';
mountOperator();mountVendor();mountVisitor();
// Expose only synthetic controls and selected primitives/layouts for assertions.
window.mesaQA={scope:'isolated-synthetic-frontend-only',ready:true,
 snapshot:()=>({record:copy(record),binding:copy(binding),bindingVersion,calls:copy(calls),accessLost}),
 failNextSave:()=>{saveFailure=true;},failNextPublic:()=>{publicFailure=true;},
 remountOperator:mountOperator,refreshPublic:()=>visitor.refresh(),
 switchAccount:()=>{currentActor=id(99);dispatchEvent(new Event('zoi:auth-change'));},
 revokeSession:()=>{sessionRevoked=true;},
 resetLayout:()=>{record={version:1,draft:blankLayout(),published:null,published_version:null};mountOperator();},
};
