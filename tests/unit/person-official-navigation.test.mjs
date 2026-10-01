import test from 'node:test';import assert from 'node:assert/strict';
import {renderCreatorCanonicalHome} from '../../api/_creator-home.js';
import {renderProfessionalHome} from '../../api/_professional-home.js';
import {ownerHomeContent} from '../../api/_owner-home-content.js';
import {professionalContent,SOURCE} from '../../assets/homes/templates/professional/model.mjs';
import {musicHomeContent} from '../../api/_music-home.js';
const base={id:'11111111-1111-4111-8111-111111111111',name:'Source person',slug:'source-person',website:'http://official.example/',profile:{},publish_status:'published',moderation_status:'clean'};
test('generic creator and professional expose real HTTP official navigation in each design and respect owner clears',()=>{
 for(const template of ['atelier','concierge','table','parea'])for(const [entity_type,render] of [['creator',renderCreatorCanonicalHome],['professional',renderProfessionalHome]]){assert.match(render({...base,entity_type},{template}),/href="http:\/\/official.example\/"/);for(const website of ['',null,'javascript:alert(1)','http://secret:password@official.example/'])assert.doesNotMatch(render({...base,entity_type,owner_content:{website}},{template}),/href="http:\/\/official.example\/"/);assert.match(render({...base,entity_type,owner_content:{website:'http://changed.example/'}},{template}),/href="http:\/\/changed.example\/"/);}
});
test('curated professional preserves exact identity gate and lets explicit owner website edits and clears win',()=>{
 const entity={...base,id:SOURCE.id,entity_type:'professional',website:SOURCE.website};for(const website of ['',null,'javascript:alert(1)','http://owner.example/'])assert.equal(professionalContent({...entity,owner_content:{website}}).website,website==='http://owner.example/'?website:'');assert.equal(professionalContent({...entity,website:'https://impostor.example/'}),null);
});
test('shared curated owner website override is navigation-only and does not weaken media validators',()=>{
 for(const family of ['music','creator','events'])for(const website of ['',null,'data:text/html,bad','http://new.example/']){const d=ownerHomeContent({website:'https://old.example/',portrait:'https://old.example/image.jpg'},{owner_content:{website,photo_url:'http://new.example/image.jpg'}},family);assert.equal(d.website,website==='http://new.example/'?website:'');assert.equal(d[family==='events'?'hero':'portrait'],'');}
 assert.equal(ownerHomeContent({website:'https://kept.example/'},{},'music').website,'https://kept.example/');
});
test('real curated music and creator source defaults cannot resurrect an explicit website clear',async()=>{
 const {ARTIST_SOURCES}=await import('../../assets/homes/templates/music/sources.mjs');const {CREATOR}=await import('../../assets/homes/templates/creator/data.mjs');const {creatorHomeContent}=await import('../../api/_creator-home.js');
 for(const [entity_type,records,project] of [['artist',Object.values(ARTIST_SOURCES),musicHomeContent],['creator',[CREATOR],creatorHomeContent]])for(const source of records)for(const website of ['',null,'javascript:alert(1)','http://new.example/']){const d=project({...base,id:source.id,name:source.name,website:source.website,entity_type,owner_content:{website}});assert(d,source.name);assert.equal(d.website,website==='http://new.example/'?website:'');}
});
test('actual post-save base plus owner projection changes preserve generic family without old curated assets',async()=>{
 const {ARTIST_SOURCES}=await import('../../assets/homes/templates/music/sources.mjs');const {CREATOR}=await import('../../assets/homes/templates/creator/data.mjs');const {creatorHomeContent}=await import('../../api/_creator-home.js');
 for(const [entity_type,records,project] of [['artist',Object.values(ARTIST_SOURCES),musicHomeContent],['creator',[CREATOR],creatorHomeContent],['professional',[SOURCE],professionalContent]])for(const source of records)for(const website of ['',null,'http://new.example/']){const d=project({...base,id:source.id,name:source.name,website,entity_type,owner_content:{website}});assert(d,source.name+' keeps family after saved website change');assert.equal(d.generic,true);assert.equal(d.website,website||'');assert.equal(d.portrait,'');assert.notEqual(d.image,source.image||'curated-image');if(entity_type==='artist'){assert.deepEqual(d.releases,[]);assert.deepEqual(d.shows,[]);}if(entity_type==='creator'){assert.deepEqual(d.channels,[]);assert.equal(d.character_photo,'');}}
});
