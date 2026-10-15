import{completeHomeMetadata}from'./_home-metadata.js';
import{schoolContent,schoolEntity}from'../assets/homes/templates/school/model.mjs';
import{renderSchoolBody,escape}from'../assets/homes/templates/school/render.mjs';
export{schoolEntity};
const json=v=>JSON.stringify(v).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
export function renderSchoolHome(entity,publishedDesign={}){
 const design=publishedDesign&&typeof publishedDesign==='object'&&!Array.isArray(publishedDesign)?publishedDesign:{},school=schoolContent(entity,design);if(!school)return null;
 const canonical='https://www.zoi.city/school/'+encodeURIComponent(school.slug),schema={'@context':'https://schema.org','@type':school.stage==='initiative'?'Organization':'School',name:school.name,url:canonical,...(school.website?{sameAs:school.website}:{}),...(school.email?{email:school.email}:{}),...(school.phone?{telephone:school.phone}:{}),...(school.address?{address:school.address}:{})};
 return completeHomeMetadata(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#173844"><title>${escape(school.name)} · Zoi</title><link rel="canonical" href="${escape(canonical)}"><link rel="stylesheet" href="/assets/homes/templates/school/style.css?v=20261015"><script type="application/ld+json">${json(schema)}</script></head><body>${renderSchoolBody(school,design)}<script type="application/json" id="school-home-content">${json({school,design})}</script><script type="module" src="/assets/homes/templates/school/app.mjs?v=20261015"></script></body></html>`,{canonical,name:school.name,description:school.intro||school.name+' · '+school.kind,location:[school.city,school.country].filter(Boolean).join(', '),sameAs:school.website?[school.website]:[]},{preserveStructuredData:true});
}
