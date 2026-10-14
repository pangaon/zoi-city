import{normalizeDesign}from '../assets/homes/editor-model.mjs';
import{briefHomeDesign}from '../assets/enrichment/client-brief.mjs';
export function publishedHomeDesign(entity){
 const value=entity?.published_design;
 if(value==null)return briefHomeDesign(entity);
 if(value?.ok!==true||value.listing!==entity.id||!Number.isSafeInteger(value.version)||value.version<1)return null;
 try{return normalizeDesign(value.design);}catch{return null;}
}
