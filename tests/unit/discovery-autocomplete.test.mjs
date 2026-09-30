import test from'node:test';import assert from'node:assert/strict';import{searchSuggestions,suggestionHref,suggestionController}from'../../assets/discovery/autocomplete.mjs';
const row={name:'Signature Productions',slug:'signature-productions',entity_type:'business',city:'Toronto'};
test('public autocomplete preserves filters and explicitly separates cross-category fallback',async()=>{const calls=[];const out=await searchSuggestions('SIGNATURE',{type:'travel_place'},undefined,async(url,options)=>{calls.push(options);return{ok:true,json:async()=>calls.length===1?[]:[row]};});assert.equal(out.outside,true);assert.equal(out.rows[0].href,'/business/signature-productions');assert.equal(JSON.parse(calls[0].body).p_type,'travel_place');assert.equal(JSON.parse(calls[1].body).p_type,null);assert.match(calls[0].headers.Authorization,/Bearer sb_publishable_/);});
test('in-filter results avoid fallback, unsafe records and private fields never leave projection',async()=>{const out=await searchSuggestions('Sig',{},undefined,async()=>({ok:true,json:async()=>[{...row,private_email:'secret'},{...row,entity_type:'../evil'}]}));assert.equal(out.rows.length,1);assert.ok(!JSON.stringify(out).includes('secret'));assert.equal(suggestionHref({...row,entity_type:'travel_place'}),'/travel-place/signature-productions');});
test('short query makes no requests and failure does not invent results',async()=>{assert.deepEqual(await searchSuggestions('s',{},undefined,()=>{throw Error('unexpected')}),{rows:[],outside:false});await assert.rejects(searchSuggestions('sig',{},undefined,async()=>({ok:false})),/search_unavailable/);});
test('cancelled and stale responses cannot reopen or replace newer suggestions',async()=>{const states=[],pending=[];const controller=suggestionController({delay:0,onState:s=>states.push(s),search:(q,f,signal)=>new Promise(resolve=>pending.push({q,signal,resolve}))});controller.run('old');await new Promise(r=>setTimeout(r,5));controller.run('new');await new Promise(r=>setTimeout(r,5));assert.equal(pending[0].signal.aborted,true);pending[1].resolve({rows:[{name:'new'}]});await new Promise(r=>setTimeout(r,0));pending[0].resolve({rows:[{name:'old'}]});await new Promise(r=>setTimeout(r,0));assert.equal(states.at(-1).rows[0].name,'new');controller.cancel();});
test('a temporary transport failure recovers without asking the visitor to retry',async()=>{
 let calls=0;const states=[];
 const ready=new Promise(resolve=>{suggestionController({delay:0,retryDelay:0,onState:s=>{states.push(s);if(s.status==='ready')resolve(s);},search:async()=>{if(++calls===1)throw Error('network');return{rows:[row]};}}).run('SIGNAT');});
 assert.equal((await ready).rows[0].name,'Signature Productions');assert.equal(calls,2);assert.equal(states.some(s=>s.status==='error'),false);
});
test('hung transport is bounded and retried, and persistent failure stays honest',async()=>{
 let calls=0;const signals=[];
 const result=await new Promise(resolve=>{suggestionController({delay:0,retryDelay:0,timeoutMs:5,onState:s=>{if(s.status==='error')resolve(s);},search:(_q,_f,signal)=>{calls++;signals.push(signal);return new Promise(()=>{});}}).run('SIGNAT');});
 assert.equal(calls,2);assert.ok(signals.every(s=>s.aborted));assert.deepEqual(result.rows,[]);
});
test('closing suggestions cancels a scheduled automatic retry',async()=>{
 let calls=0;const states=[];let controller;
 controller=suggestionController({delay:0,retryDelay:20,onState:s=>states.push(s),search:async()=>{calls++;throw Error('network');}});
 controller.run('SIGNAT');await new Promise(r=>setTimeout(r,5));controller.cancel();await new Promise(r=>setTimeout(r,35));assert.equal(calls,1);assert.equal(states.some(s=>s.status==='error'),false);
});
