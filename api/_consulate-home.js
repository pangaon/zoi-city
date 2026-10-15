import{consulateContent}from'../assets/homes/templates/consulate/model.mjs';
import{renderConsulateBody,escape}from'../assets/homes/templates/consulate/render.mjs';
import{completeHomeMetadata}from'./_home-metadata.js';
export{diplomaticEntity}from'../assets/homes/templates/consulate/model.mjs';
export function renderConsulateHome(entity,publishedDesign=null){
 const design=publishedDesign&&typeof publishedDesign==='object'&&!Array.isArray(publishedDesign)?publishedDesign:{},data=consulateContent(entity,design);if(!data)return null;
 const template=['atelier','concierge','table','parea'].includes(design.template)?design.template:'concierge',canonical='https://www.zoi.city/organization/'+encodeURIComponent(data.slug);
 const json=v=>JSON.stringify(v).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 return completeHomeMetadata(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(data.name)} · Zoi</title><meta name="description" content="${escape(data.intro||'Published mission contacts and consular service information.')}"><link rel="canonical" href="${escape(canonical)}"><link rel="stylesheet" href="/assets/homes/templates/consulate/style.css?v=20261015"><script type="application/ld+json">${json({'@context':'https://schema.org','@type':'GovernmentOffice',name:data.name,url:canonical,sameAs:data.website?[data.website]:[]})}</script></head><body data-template="${template}">${renderConsulateBody(data,design)}<script type="application/json" id="consulate-content">${json(data)}</script><script type="module" src="/assets/homes/templates/consulate/app.mjs?v=20261015"></script></body></html>`,{canonical,name:data.name,description:data.intro,location:[data.city,data.country].filter(Boolean).join(' · '),image:data.photo,sameAs:data.website?[data.website]:[]},{preserveStructuredData:true});
}
export default renderConsulateHome;
