import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=process.env.FROZEN_ROOT;
const {default:handler}=await import(pathToFileURL(root+'/api/entity.js'));
const types=['business','vendor','church','professional','school','association','creator','artist','venue','event','travel_place'];
const output=[];const saved=global.fetch;
try{
 for(const entity_type of types)for(const layer of ['owner','owner_profile','profile'])for(const clear of [null,'']){
  const row={id:'81000000-0000-4000-8000-000000000008',slug:'owner-clear-check',name:'Owner clear check',entity_type,publish_status:'published',moderation_status:'clean',website:'https://base.example/',profile:{_enrich:{website:'https://imported.example/',source_url:'https://base.example/'}}};
  if(layer==='owner')row.owner_content={website:clear};
  if(layer==='owner_profile')row.owner_content={profile:{website:clear}};
  if(layer==='profile')row.profile.website=clear;
  global.fetch=async()=>new Response(JSON.stringify(row));
  let html='';const res={setHeader(){},end(value){html=value||'';}};
  await handler({query:{slug:row.slug}},res);
  assert.equal(res.statusCode,200,entity_type);
  assert.ok(!/href=["']https:\/\/(?:base|imported)\.example/.test(html),entity_type+' unflagged owner clear link');
  const schemas=[...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m=>JSON.parse(m[1]));
  assert.ok(!/https:\/\/(?:base|imported)\.example/.test(JSON.stringify(schemas)),entity_type+' unflagged owner clear schema');
  output.push({entity_type,layer,clear,passed:true});
 }
}finally{global.fetch=saved;}
await writeFile(process.env.OWNER_CLEAR_OUTPUT,JSON.stringify({controlled:true,production_writes:false,cases:output,passed:output.length},null,2)+'\n');
console.log(JSON.stringify({passed:output.length}));
