// @ts-ignore Reuse the public source identity, provenance and branch contract.
import {scopedSourceServices} from '../../assets/enrichment/client-brief.mjs';

export type ServiceDetail = {name:string;description:string;price:string;duration:string};
export type ServiceOffering = ServiceDetail & {options:ServiceDetail[];omittedOptions:number;optionsBounded:boolean};
export type NativeServiceOfferings = {
 items:ServiceOffering[];total:number;remaining:number;omitted:number;
 origin:'published'|'source'|'none';bounded:boolean;
};
export const SERVICE_ITEM_LIMIT=300, SERVICE_INPUT_LIMIT=1000, SERVICE_OPTION_LIMIT=50;
type Row=Record<string,unknown>;
const row=(x:unknown):Row=>x&&typeof x==='object'&&!Array.isArray(x)?x as Row:{};
const text=(x:unknown,max=2000)=>typeof x==='string'&&x.length<=max?x.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim():'';
const amount=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)&&x>=0?String(x):'';
// These are display fields, never a booking catalogue or an availability claim.
// Explicit private/draft rows are refused even if supplied to this public model.
const publicRow=(x:Row)=>(!x.visibility||x.visibility==='public')&&x.private!==true&&x.is_public!==false&&x.published!==false&&x.marketplace_hidden!==true&&x.marketplace_status!=='hidden'&&x.duplicate_status!=='confirmed_duplicate'&&(!x.publish_status||x.publish_status==='published')&&(!x.status||!['draft','archived','deleted','hidden','private'].includes(String(x.status)))&&(!x.moderation_status||['clean','cleared'].includes(String(x.moderation_status)));
function price(x:Row){
 const currency=text(x.currency,16);
 // Preserve literal units, ranges and currency symbols rather than guessing one.
 if(typeof x.price==='string'){const literal=text(x.price,200);return literal&&/^[A-Z]{3}$/.test(currency)&&!literal.includes(currency)?literal+' '+currency:literal;}
 if(currency&&/^[A-Z]{3}$/.test(currency)){
  const direct=amount(x.price);if(direct)return direct+' '+currency;
  if(typeof x.price_cents==='number'&&Number.isSafeInteger(x.price_cents)&&x.price_cents>=0)return String(Math.floor(x.price_cents/100))+'.'+String(x.price_cents%100).padStart(2,'0')+' '+currency;
 }
 return '';
}
function detail(value:unknown):ServiceDetail|null{
 if(typeof value==='string'){const name=text(value,240);return name?{name,description:'',price:'',duration:''}:null;}
 const x=row(value);if(!publicRow(x))return null;
 if([['name',240],['title',240],['description',2000],['summary',2000],['price',200],['currency',16],['duration',200]].some(([key,max])=>typeof x[key as string]==='string'&&(x[key as string] as string).length>(max as number)))return null;
 const name=text(x.name,240)||text(x.title,240);if(!name)return null;
 const duration=typeof x.duration==='string'?text(x.duration,200):typeof x.duration_minutes==='number'&&Number.isFinite(x.duration_minutes)&&x.duration_minutes>0?String(x.duration_minutes)+' minutes':'';
 return{name,description:text(x.description)||text(x.summary),price:price(x),duration};
}
/** Canonical published presence wins, including null/empty/invalid clears.
 * Raw _enrich rich fields are deliberately never read here: the shared source
 * helper admits only scoped names/descriptions and already bounds its selection.
 */
export function serviceOfferingsForProfile(entity:unknown):NativeServiceOfferings{
 const e=row(entity),owner=row(e.owner_content),profile=row(e.profile);
 const empty:NativeServiceOfferings={items:[],total:0,remaining:0,omitted:0,origin:'none',bounded:false};
 if(!publicRow(e))return empty;
 const selected=[owner,row(owner.profile),profile,e].find(layer=>Object.hasOwn(layer,'services'));
 const value=selected?selected.services:scopedSourceServices(e);
 const origin=selected?'published':'source';
 if(!Array.isArray(value)||!value.length)return{...empty,origin:selected?'published':'none'};
 // Refuse an oversized collection as a whole; do not suggest a partial prefix is
 // complete. Source selection retains its shared upstream30 limit explicitly.
 if(value.length>SERVICE_INPUT_LIMIT)return{...empty,origin,bounded:true,omitted:value.length};
 const items:ServiceOffering[]=[];let total=0,omitted=0;
 for(const input of value){
  const base=detail(input);if(!base){omitted++;continue;}total++;
  if(items.length>=SERVICE_ITEM_LIMIT)continue;
  const rawOptions=row(input).options,options:ServiceDetail[]=[];let omittedOptions=0,optionsBounded=false;
  if(Array.isArray(rawOptions)){
   if(rawOptions.length>SERVICE_INPUT_LIMIT){omittedOptions=rawOptions.length;optionsBounded=true;}
   else for(const inputOption of rawOptions){const option=detail(inputOption);if(option&&options.length<SERVICE_OPTION_LIMIT)options.push(option);else{omittedOptions++;if(option)optionsBounded=true;}}
  }
  items.push({...base,options,omittedOptions,optionsBounded});
 }
 return{items,total,remaining:total-items.length,omitted,origin,bounded:origin==='source'||total>items.length};
}
