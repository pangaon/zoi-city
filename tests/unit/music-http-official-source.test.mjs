import test from 'node:test';
import assert from 'node:assert/strict';
import {musicHomeContent,renderMusicHome} from '../../api/_music-home.js';
import {personData,personURL} from '../../assets/homes/person-data.mjs';
import {officialURL} from '../../assets/homes/official-url.mjs';
import {safeHttps} from '../../assets/homes/templates/music/model.mjs';
const entity={id:'01ef14b0-6c59-4171-93d5-8bbbb8c1151e',slug:'association-moreas-paris',name:'Association MOREAS',entity_type:'artist',city:'Paris',website:'http://www.musique-grecque.com',description:'Imported short biography.',profile:{_enrich:{source_url:'http://www.musique-grecque.com/',description:'MORÉAS présente la musique grecque et les chants traditionnels.'}}};
test('matching HTTP source enriches biography and provides outbound website in all music designs without invented imagery',()=>{
 const d=musicHomeContent(entity);assert.equal(d.story,entity.profile._enrich.description);assert.equal(d.description,d.story);assert.equal(d.website,'http://www.musique-grecque.com/');assert.equal(d.portrait,'');assert.deepEqual(d.gallery,[]);
 for(const template of ['atelier','concierge','table','parea']){const html=renderMusicHome(entity,{template});assert(html.includes(d.story));assert.match(html,/href="http:\/\/www.musique-grecque.com\/"/);assert.match(html,/Artist photograph unavailable/);assert(!html.includes('Imported short biography.'));}
});
test('owner descriptions, nested edits, profile clears and press override enriched and imported text',()=>{
 for(const value of ['',null,'My authored biography'])for(const layer of ['owner','nested','profile']){const e=structuredClone(entity);if(layer==='owner')e.owner_content={description:value};if(layer==='nested')e.owner_content={profile:{description:value}};if(layer==='profile')e.profile.description=value;const d=musicHomeContent(e);assert.equal(d.story,value||'');assert.equal(d.description,value||'');assert.equal(d.owner_description,true);assert(!renderMusicHome(e).includes(entity.profile._enrich.description));}
 for(const press of ['',null,'My press biography']){const d=musicHomeContent({...entity,owner_content:{profile:{press}}});assert.equal(d.story,press||'');assert.equal(d.description,press||'');}
});
test('source identity, credential and quarantine failures retain imported biography',()=>{
 for(const source_url of ['http://other.example/','ftp://www.musique-grecque.com/','http://user:secret@www.musique-grecque.com/','http://www.musique-grecque.com:8080/'])assert.equal(musicHomeContent({...entity,profile:{_enrich:{...entity.profile._enrich,source_url}}}).story,entity.description);
 for(const flag of [{scope_review_required:true},{identity_scope:'organization'},{source_kind:'association_member'},{organization_identity_quarantine:true}])assert.equal(musicHomeContent({...entity,profile:{_enrich:{...entity.profile._enrich,...flag}}}).story,entity.description);
 assert.equal(musicHomeContent({...entity,website:'http://www.musique-grecque.com/one',profile:{_enrich:{...entity.profile._enrich,source_url:'http://www.musique-grecque.com/two'}}}).story,entity.description);
});
test('official website edits and clears are honored in shared person families while media stays HTTPS only',()=>{
 for(const entity_type of ['artist','creator','professional'])for(const value of ['',null,'http://owner.example/']){const d=personData({...entity,entity_type,owner_content:{website:value}});assert.equal(d.website,value||'');}
 for(const value of ['javascript:alert(1)','data:text/html,bad','https://user:secret@example.org','ftp://example.org'])assert.equal(officialURL(value),'');
 assert.equal(personURL('http://example.org/photo.jpg'),'');assert.equal(safeHttps('http://example.org/photo.jpg'),null);
 const cleared=musicHomeContent({...entity,owner_content:{website:null}});assert.equal(cleared.website,'');assert.doesNotMatch(renderMusicHome({...entity,owner_content:{website:null}}),/href="http:\/\/www.musique-grecque.com/);
});
test('sparse families retain valid navigation without fabricating content',()=>{
 for(const entity_type of ['artist','creator','professional']){const d=personData({...entity,entity_type,description:null,profile:{}});assert.equal(d.description,'');assert.equal(d.website,'http://www.musique-grecque.com/');assert.equal(d.portrait,'');}
 const sparse={...entity,website:null,description:null,profile:{}};for(const template of ['atelier','concierge','table','parea'])assert.match(renderMusicHome(sparse,{template}),/Artist photograph unavailable/);
});
