export const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const boothTemplates=[
 {name:'Market stand',code:'M',width_m:3,height_m:3},
 {name:'Food vendor',code:'F',width_m:6,height_m:3},
 {name:'Florist',code:'L',width_m:3,height_m:3},
 {name:'Photo booth',code:'P',width_m:3,height_m:3},
 {name:'Music / DJ',code:'D',width_m:6,height_m:3},
 {name:'Community stand',code:'C',width_m:3,height_m:3},
];
const clone=v=>structuredClone(v);
export const blankLayout=()=>({schema:1,width_m:60,height_m:40,booths:[]});
export function extent(b){return [90,270].includes(b.rotation)?{w:b.height_m,h:b.width_m}:{w:b.width_m,h:b.height_m};}
export function safeBusiness(b){
 if(!b||typeof b.name!=='string'||!b.name.trim()||b.name.length>500||typeof b.slug!=='string'||typeof b.href!=='string'||!/^\/(?!\/)/.test(b.href)||/[\\\u0000-\u0020]/.test(b.href))return null;
 let logo=null;try{const u=new URL(b.logo);if(u.protocol==='https:'&&!u.username&&!u.password&&!/^(localhost|127\.|0\.|\[|10\.|192\.168\.)/.test(u.hostname)&&u.href.length<=2048)logo=u.href;}catch{}
 return {name:b.name,slug:b.slug,href:b.href,logo};
}
export function validateLayout(input,{publicView=false}={}){
 if(!input||input.schema!==1||!Number.isFinite(input.width_m)||!Number.isFinite(input.height_m)||input.width_m<1||input.width_m>5000||input.height_m<1||input.height_m>5000||!Array.isArray(input.booths)||input.booths.length>200)throw Error('mesa_invalid_layout');
 const ids=new Set();
 const booths=input.booths.map(b=>{
  if(!b||!UUID.test(b.id)||ids.has(b.id.toLowerCase())||typeof b.label!=='string'||!b.label.trim()||b.label.trim().length>40||![0,90,180,270].includes(b.rotation)||!['x_m','y_m','width_m','height_m'].every(k=>Number.isFinite(b[k]))||b.width_m<.5||b.width_m>100||b.height_m<.5||b.height_m>100)throw Error('mesa_invalid_booth');
  ids.add(b.id.toLowerCase());const e=extent(b);
  if(b.x_m-e.w/2<0||b.y_m-e.h/2<0||b.x_m+e.w/2>input.width_m||b.y_m+e.h/2>input.height_m)throw Error('mesa_booth_outside_site');
  if(!publicView&&b.application_id!=null&&!UUID.test(b.application_id))throw Error('mesa_invalid_assignment');
  const n={id:b.id,label:b.label.trim(),x_m:b.x_m,y_m:b.y_m,width_m:b.width_m,height_m:b.height_m,rotation:b.rotation};
  return publicView?{...n,business:safeBusiness(b.business)}:{...n,application_id:b.application_id||null};
 });
 return {schema:1,width_m:input.width_m,height_m:input.height_m,booths};
}
export function collisions(layout){const found=[];for(let i=0;i<layout.booths.length;i++)for(let j=i+1;j<layout.booths.length;j++){const a=layout.booths[i],b=layout.booths[j],aa=extent(a),bb=extent(b);if(Math.abs(a.x_m-b.x_m)<(aa.w+bb.w)/2&&Math.abs(a.y_m-b.y_m)<(aa.h+bb.h)/2)found.push([a.id,b.id]);}return found;}
export function moveBooth(layout,id,x,y){
 const next=clone(layout),b=next.booths.find(n=>n.id===id);if(!b)throw Error('mesa_missing_booth');const e=extent(b);
 b.x_m=Math.max(e.w/2,Math.min(next.width_m-e.w/2,Math.round(x*4)/4));
 b.y_m=Math.max(e.h/2,Math.min(next.height_m-e.h/2,Math.round(y*4)/4));return validateLayout(next);
}
export function addBooth(layout,template,makeId=()=>crypto.randomUUID()){
 if(layout.booths.length>=200)throw Error('mesa_booth_limit');
 const xs=new Set([template.width_m/2,template.width_m/2+.5]),ys=new Set([template.height_m/2,template.height_m/2+.5]);
 for(const booth of layout.booths){const e=extent(booth);xs.add(booth.x_m+e.w/2+template.width_m/2+.5);ys.add(booth.y_m+e.h/2+template.height_m/2+.5);}
 for(const y of [...ys].sort((a,b)=>a-b))for(const x of [...xs].sort((a,b)=>a-b)) {
  if(x+template.width_m/2>layout.width_m||y+template.height_m/2>layout.height_m)continue;
  const next=clone(layout);next.booths.push({id:makeId(),label:template.code+String(layout.booths.length+1).padStart(2,'0'),x_m:x,y_m:y,width_m:template.width_m,height_m:template.height_m,rotation:0,application_id:null});
  if(!collisions(next).some(pair=>pair.includes(next.booths.at(-1).id)))return validateLayout(next);
 }
 throw Error('mesa_no_room');
}
export function layoutHistory(layout){return {past:[],present:clone(layout),future:[]};}
export function commitLayout(h,next){const parsed=validateLayout(next);if(JSON.stringify(parsed)===JSON.stringify(h.present))return h;return {past:[...h.past,h.present].slice(-30).map(clone),present:parsed,future:[]};}
export function undoLayout(h){if(!h.past.length)return h;return {past:h.past.slice(0,-1).map(clone),present:clone(h.past.at(-1)),future:[h.present,...h.future].slice(0,30).map(clone)};}
export function redoLayout(h){if(!h.future.length)return h;return {past:[...h.past,h.present].slice(-30).map(clone),present:clone(h.future[0]),future:h.future.slice(1).map(clone)};}
export function mapURL(event){if(!UUID.test(event))throw Error('mesa_invalid_event');return '/festival/?event='+encodeURIComponent(event)+'&view=map';}
export function mapError(error){const text=String(error?.message||'');const entries={mesa_version_conflict:'This plan changed in another window. Refresh before saving. Your unsaved layout is still here.',mesa_booth_collision:'Two stands overlap. Move or resize them before publishing.',mesa_approved_booth_required:'Assignments require a currently approved booth application for this host.',mesa_application_units_exceeded:'This application is assigned to more stands than its approved units.',mesa_business_acceptance_required:'Accept the linked business for every assigned stand before publishing.',mesa_business_unavailable:'The linked business is no longer available under that workspace. Review its ownership and publication.',mesa_booth_outside_site:'A stand extends outside the site. Adjust its size or position.',mesa_no_room:'There is no clear space for that stand. Enlarge the plan or move existing stands.',mesa_map_ownership_changed:'The host ownership changed. Reopen it under its current workspace.',mesa_request_conflict:'This request reference was used with different details. Refresh and retry the intended change.',mesa_invalid_layout:'Check the site dimensions and stand details.',mesa_invalid_booth:'Check the stand code, size and rotation.',mesa_binding_unavailable:'There is no linked business to review yet.'};
 for(const [key,message]of Object.entries(entries))if(text.includes(key))return message;
 if(/permission|not_owned|session|sign.in|event_unavailable/i.test(text))return 'Your access or the host changed. Reopen this view to check your current account and workspace.';
 return 'The result was not confirmed. Keep this view open and retry unchanged details; the same request reference will be reused.';
}

export function accessLost(error){return [401,403].includes(Number(error?.status))||/permission|session|event_unavailable|no_access_to_workspace|not_owned|unauthenticated|jwt.*expired/i.test(String(error?.message||''));}
