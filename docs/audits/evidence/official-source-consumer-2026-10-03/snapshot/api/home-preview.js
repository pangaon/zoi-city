import {normalizeDesign,UUID} from '../assets/homes/editor-model.mjs';
import {officialSourceEntity} from '../assets/enrichment/official-source-policy.mjs';
import {renderHospitalityHome} from './_hospitality-home.js';
import {renderAvliHome} from '../assets/homes/templates/restaurant/avli.mjs';
import {renderChurchHome} from './_church-home.js';
import {renderRestaurantHome} from './_restaurant-home.js';
import {renderCreatorCanonicalHome} from './_creator-home.js';
import {renderEventCanonicalHome} from './_event-home.js';
import {renderMusicHome} from './_music-home.js';
import {renderProfessionalHome} from './_professional-home.js';
import {renderBakeryHome} from './_bakery-home.js';
import {renderHealthHome} from './_health-home.js';
const BASE='https://csebihpaychdkanjjsmz.supabase.co',KEY='sb_publishable_BM4ZQtOCUhjg7VqyFGJGRw_eFyTgI4j';
export function inertPreview(html){
 return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/\shref=("|')([^"']*)\1/gi,(full,q,url)=>url.startsWith('/assets/')||url.startsWith('/showcase/')&&/\.css(?:\?|$)/.test(url)?full:` data-preview-href=${q}${url}${q}`)
 .replace('</head>','<style>a,button,input,select,textarea{pointer-events:none}html{scroll-behavior:auto!important}*{animation:none!important;transition:none!important}</style></head>');
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Authorization');res.setHeader('Content-Type','application/json; charset=utf-8');
 const finish=(status,error,extra={})=>{res.statusCode=status;res.end(JSON.stringify({ok:!error,...(error?{error}:{}),...extra}));};
 if(req.method!=='POST'){res.setHeader('Allow','POST');return finish(405,'method_not_allowed');}
 const authorization=req.headers?.authorization||'';if(!/^Bearer [^\s]+$/.test(authorization)||authorization.length>8192)return finish(401,'sign_in_required');
 let data;
 try{data=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!data||JSON.stringify(data).length>35000||!UUID.test(data.workspace)||!UUID.test(data.listing))throw Error();data.design=normalizeDesign(data.design);}catch{return finish(400,'invalid_home_preview');}
 try{
  const r=await fetch(BASE+'/rest/v1/rpc/home_design_preview_data',{method:'POST',headers:{apikey:KEY,Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({p_workspace:data.workspace,p_listing:data.listing,p_design:data.design}),signal:AbortSignal.timeout(8000)});
  if(!r.ok)return finish(r.status===401||r.status===403?403:409,'home_preview_unavailable');
  const reply=await r.json();if(reply?.ok!==true||reply.listing!==data.listing||reply.workspace!==data.workspace||reply.entity?.id!==data.listing)return finish(409,'home_preview_unconfirmed');
  const design=normalizeDesign(reply.design),entity=officialSourceEntity(reply.entity);
  const html=renderHospitalityHome(entity,design)||renderAvliHome(entity,design)||renderChurchHome(entity,design)||renderCreatorCanonicalHome(entity,design)||renderEventCanonicalHome(entity,design)||renderMusicHome(entity,design)||renderHealthHome(entity,design)||renderProfessionalHome(entity,design)||renderBakeryHome(entity,design)||renderRestaurantHome(entity,design);
  if(!html)return finish(409,'home_preview_not_supported');
  return finish(200,null,{listing:data.listing,html:inertPreview(html)});
 }catch{return finish(503,'home_preview_unavailable');}
}
