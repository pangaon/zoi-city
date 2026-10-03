import{musicHomeContent,renderMusicHome}from'../../../api/_music-home.js';
import{creatorHomeContent,renderCreatorCanonicalHome}from'../../../api/_creator-home.js';
import{hospitalityHomeContent,renderHospitalityHome}from'../../../api/_hospitality-home.js';
import{renderMusic}from'../../../assets/homes/templates/music/render.mjs';
import{renderCreatorHome}from'../../../assets/homes/templates/creator/render.mjs';
import{renderHospitality}from'../../../assets/homes/templates/hospitality/render.mjs';
import{ARTIST_SOURCES}from'../../../assets/homes/templates/music/sources.mjs';
import{CREATOR}from'../../../assets/homes/templates/creator/data.mjs';
import{OLYMPIA}from'../../../assets/homes/templates/hospitality/sources.mjs';
const artist=Object.values(ARTIST_SOURCES)[0];
export function fixture(family,sparse=false,template='concierge'){
 const populated={music:{...artist,entity_type:'artist',profile:{}},creator:{...CREATOR,entity_type:'creator',profile:{}},hospitality:{id:OLYMPIA.id,slug:OLYMPIA.slug,name:'The Olympia',entity_type:'travel_place',category_slug:'hotels',website:OLYMPIA.source,profile:{},city:'Paddington'}}[family];
 const entity=sparse?{id:'11111111-1111-4111-8111-111111111111',name:'Independent '+family,slug:'independent-'+family,entity_type:{music:'artist',creator:'creator',hospitality:'travel_place'}[family],category_slug:family==='hospitality'?'hotels':undefined,profile:{}}:populated;
 const data={music:musicHomeContent,creator:creatorHomeContent,hospitality:hospitalityHomeContent}[family](entity);
 return{entity,data,html:{music:renderMusicHome,creator:renderCreatorCanonicalHome,hospitality:renderHospitalityHome}[family](entity,{template}),raw:family==='music'?renderMusic(data,template,{}, {preview:false}):family==='creator'?renderCreatorHome({entity:data,template}):renderHospitality(data,{template})};
}
