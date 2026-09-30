import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AVLI_ID,renderAvliHome,templates} from '../../assets/homes/templates/restaurant/avli.mjs';
test('actual Avli entity defaults to Concierge at its canonical business URL',()=>{
 const html=renderAvliHome({id:AVLI_ID});
 assert.equal(html,templates.concierge);
 assert.match(html,/canonical" href="https:\/\/www.zoi.city\/business\/taverna-avli-bochum"/);
 assert.match(html,/data-open-plan/);
 assert.match(html,/href="tel:\+492346404778"/);
 assert.match(html,/src="\/showcase\/avli\/concierge\/app.mjs"/);
 assert.doesNotMatch(html,/(?:href|src)="\.\//);
});
test('all four preserved templates resolve their assets at the actual home URL',()=>{
 for(const key of ['atelier','concierge','table','parea']){
  const html=renderAvliHome({id:AVLI_ID},key);
  assert.equal(html,templates[key]);
  assert.doesNotMatch(html,/(?:href|src)="\.\//);
  assert.match(html,/https:\/\/avli.de\//);
 }
 assert.equal(renderAvliHome({id:AVLI_ID},'__proto__'),templates.concierge);
});
test('name or slug resemblance cannot substitute another business identity',()=>{
 assert.equal(renderAvliHome({id:'not-avli',name:'Taverna Avli',slug:'taverna-avli-bochum'}),null);
});
