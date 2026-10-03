import test from 'node:test';
import assert from 'node:assert/strict';
import {searchSuggestions,SUGGESTION_CANDIDATES} from '../../assets/discovery/autocomplete.mjs';
const row=i=>({slug:'candidate-'+i,name:'Opa candidate '+i,entity_type:'business',city:'Published city',country:'Published country',owner_email:'must-not-project'});
test('a real bounded candidate beyond the former eight-row cut remains selectable without client-specific ranking',async()=>{
 const rows=Array.from({length:40},(_,i)=>row(i));let request;
 const result=await searchSuggestions('Opa',{},undefined,async(_url,options)=>{request=JSON.parse(options.body);return{ok:true,json:async()=>rows.slice(0,request.p_limit)};});
 assert.equal(request.p_limit,32);assert.equal(SUGGESTION_CANDIDATES,32);assert.equal(result.rows.length,32);assert.equal(result.rows[14].href,'/business/candidate-14');assert(!JSON.stringify(result).includes('must-not-project'));assert.equal(result.outside,false);
});
test('an overlarge response remains bounded while exact name and prefix ordering preserve stable public identities',async()=>{
 const result=await searchSuggestions('Opa',{},undefined,async()=>({ok:true,json:async()=>[{...row(0),name:'The Opa restaurant'},{...row(1),name:'Opa'},{...row(2),name:'Opa music'},...Array.from({length:100},(_,i)=>row(i+3))]}));
 assert.equal(result.rows.length,32);assert.equal(result.rows[0].slug,'candidate-1');assert.equal(result.rows[1].slug,'candidate-2');assert.equal(result.rows.at(-1).slug,'candidate-0');assert(!result.rows.some(r=>r.slug==='candidate-32'));
});
test('wider candidates retain exact city, country and categories and cannot introduce disabled categories',async()=>{
 const calls=[];const result=await searchSuggestions('Opa',{city:'Nairobi',country:'Kenya',types:['event'],strict:true},undefined,async(url,options)=>{calls.push({url,args:JSON.parse(options.body)});return{ok:true,json:async()=>[{...row(0),entity_type:'event'},row(1)]};});
 assert.equal(calls.length,1);assert(calls[0].url.endsWith('/explore_search_types'));assert.equal(calls[0].args.p_city,'Nairobi');assert.equal(calls[0].args.p_country,'Kenya');assert.deepEqual(calls[0].args.p_types,['event']);assert.deepEqual(result.rows.map(x=>x.slug),['candidate-0']);
});
