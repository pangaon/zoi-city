import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProfile} from '../src/profile.ts';
const e={name:'Actual client',website:'https://stored.example/',profile:{_enrich:{source_url:'https://import.example/',blocked_reason:'source_scope_mismatch',website:'https://import.example/'} }};
test('native outward action suppresses held source defaults and imported fallback for every family',()=>{
 for(const entity_type of ['business','vendor','professional','church','school','association','artist','creator','venue','event','travel_place']){
  assert.equal(normalizeProfile({...e,entity_type}).website,'');
 }
});
test('native published website edits and null/empty clears retain web authority despite stale source holds',()=>{
 for(const website of [null,'','https://stored.example/new-parish','https://new.example/']){
  for(const change of [{owner_content:{website}},{owner_content:{profile:{website}}},{profile:{...e.profile,website}}]){
   assert.equal(normalizeProfile({...e,...change}).website,website||'');
  }
 }
 assert.equal(normalizeProfile({...e,profile:{_enrich:{blocked_reason:'robots',last_error:'source_challenge'}}}).website,'https://stored.example/');
});
