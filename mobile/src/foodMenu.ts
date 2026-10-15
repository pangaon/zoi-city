// Existing public models own family selection, source holds and owner precedence.
// This adapter takes the complete published home_entity, never a flattened profile.
// @ts-ignore Pure shared web family/profile contract.
import {verticalFor,profileOf,profileForVertical} from '../../api/_verticals.js';
// @ts-ignore Pure canonical menu/source contract, shared with restaurant homes.
import {foodReadEntity,foodMenuQuestion} from '../../assets/homes/food-offering.mjs';
// @ts-ignore Existing public canonical Food models; no new reader or writer.
import {restaurantData} from '../../assets/homes/templates/restaurant/model.mjs';
// @ts-ignore Bakery uses the same canonical menu model and owner aliases.
import {bakeryData} from '../../assets/homes/templates/bakery/model.mjs';
export type FoodItem={name:string;price:string;note:string};
export type FoodSection={title:string;items:FoodItem[]};
export type NativeFood={id:string;name:string;family:'restaurant'|'bakery';menuSections:FoodSection[];menuLinks:{url:string;label:string;kind:string}[];sourceMenu:string;menuCoverage:{total:number;truncated:boolean}|null;checked:string;website:string|null;phone:string;phoneHref:string|null;emailHref:string|null};
export function foodForProfile(input:Record<string,any>):NativeFood|null {
 const {v}=verticalFor(input);if(!['restaurant','bakery'].includes(v.key))return null;
 const entity=foodReadEntity(input),profile=profileForVertical(v,profileOf(entity),entity);
 const data=(v.key==='bakery'?bakeryData:restaurantData)(entity,profile);
 return {id:data.id,name:data.name,family:v.key,menuSections:data.menuSections,menuLinks:data.menuLinks,sourceMenu:data.sourceMenu,menuCoverage:data.menuCoverage,checked:data.checked,website:data.website,phone:data.phone,phoneHref:data.phoneHref,emailHref:data.emailHref};
}
export const FOOD_PAGE_SIZE=12;
const norm=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
export function foodMenuView(sections:FoodSection[],query='',section:number|null=null,limit=FOOD_PAGE_SIZE){
 const term=norm(query),matched=sections.flatMap((group,si)=>group.items.flatMap((item,ii)=>(section===null||section===si)&&norm([group.title,item.name,item.note].join(' ')).includes(term)?[{key:si+':'+ii,section:si,item}]:[]));
 const bounded=Number.isFinite(limit)?Math.max(FOOD_PAGE_SIZE,Math.floor(limit)):Infinity,visible=matched.slice(0,bounded);
 return {total:sections.reduce((n,s)=>n+s.items.length,0),matches:matched.length,shown:visible.length,groups:sections.flatMap((s,si)=>{const items=visible.filter(row=>row.section===si);return items.length?[{title:s.title,index:si,items}]:[]}),hasMore:visible.length<matched.length,expanded:bounded>FOOD_PAGE_SIZE};
}
export function foodQuestionDraft(food:NativeFood,item:FoodItem){
 const text=foodMenuQuestion(food.name,item),subject='Question about '+item.name;
 return {text,email:food.emailHref?food.emailHref+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(text):null};
}
