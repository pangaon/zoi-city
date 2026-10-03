import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceReviewState} from '../../assets/suite/source-health.mjs';

const imported={website:'https://old.example/business',profile:{_enrich:{source_url:'https://old.example/business',blocked_reason:'source_scope_mismatch'}}};
for(const family of ['business','artist','event','church']){
  test(family+' imported hold is distinct from saved owner choice and clear',()=>{
    const entity={...structuredClone(imported),entity_type:family};
    const before=JSON.stringify(entity);
    const held=sourceReviewState(entity,entity.website);
    assert.equal(held.state,'import-held');assert.equal(held.published,'');assert.equal(held.sourceHost,'old.example');
    const owner=sourceReviewState({...entity,owner_content:{website:'https://old.example/new-owner-path'}},'https://old.example/new-owner-path');
    assert.equal(owner.state,'owner-url');assert.equal(owner.published,'https://old.example/new-owner-path');assert.equal(owner.held,true);assert.equal(owner.changed,false);
    for(const clear of [null,'']){const removed=sourceReviewState({...entity,owner_content:{website:clear}},'');assert.equal(removed.state,'owner-clear');assert.equal(removed.published,'');assert.equal(removed.changed,false);}
    assert.equal(JSON.stringify(entity),before);
  });
}
test('all existing receipt gates use neutral review state, not invented malicious labels',()=>{
  for(const flag of [{scope_review_required:true},{scope_review_required:'true'},{organization_identity_quarantine:true},{blocked_reason:'source_scope_mismatch'}])assert.equal(sourceReviewState({website:imported.website,profile:{_enrich:flag}}).state,'import-held');
  assert.equal(sourceReviewState({website:imported.website,profile:{_enrich:{blocked_reason:'network_error'}}}).state,'import-url');
});
test('owner presence precedence includes nested profile, and null never resurrects imported base',()=>{
  assert.equal(sourceReviewState({...imported,profile:{...imported.profile,website:'https://profile.example/'}}).published,'https://profile.example/');
  assert.equal(sourceReviewState({...imported,owner_content:{profile:{website:null}},profile:{website:'https://profile.example/'}}).published,'');
  assert.equal(sourceReviewState({...imported,owner_content:{website:null,profile:{website:'https://nested.example/'}}}).published,'');
});
test('draft validation rejects credentials, unsafe schemes and incomplete addresses without altering saved selection',()=>{
  const saved={website:'https://real.example/',owner_content:{website:'https://real.example/'}};
  for(const value of ['javascript:alert(1)','example.com','https://user:password@example.com/','https://']){const state=sourceReviewState(saved,value);assert.equal(state.validDraft,false);assert.equal(state.published,'https://real.example/');assert.equal(state.changed,true);}
  assert.equal(sourceReviewState(saved,'').validDraft,true);
  assert.equal(sourceReviewState(saved,'https://real.example/new').validDraft,true);
});
test('sparse imported source and owner selection retain separate states',()=>{
  const sparse=sourceReviewState({},'');assert.equal(sparse.state,'no-url');assert.equal(sparse.sourceHost,'');assert.equal(sparse.changed,false);
  const sourceOnly=sourceReviewState({profile:{_enrich:{source_url:'https://source.example/'}}},'');assert.equal(sourceOnly.state,'no-url');assert.equal(sourceOnly.published,'');
  assert.equal(sourceReviewState({owner_content:{website:''}}).state,'owner-clear');
});
