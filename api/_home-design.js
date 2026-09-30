import{normalizeDesign}from '../assets/homes/editor-model.mjs';
export function publishedHomeDesign(entity){
 const value=entity?.published_design;
 if(value?.ok!==true||value.listing!==entity.id||!Number.isSafeInteger(value.version)||value.version<1)return null;
 try{return normalizeDesign(value.design);}catch{return null;}
}
