import test from 'node:test';
import assert from 'node:assert/strict';
import {musicHomeContent,renderMusicHome} from '../../api/_music-home.js';
const source='https://www.universalmusic.fr/artistes/30792301385';
const spotify='https://open.spotify.com/artist/6ZGwdAmu91r8mpA6SXodzd';
const youtube='https://www.youtube.com/watch?v=znfSSGadCtg';
const row={id:'b2ccabbb-bf1c-4b01-b0b3-bd6e88beadab',name:'Giorgos Sabanis',slug:'giorgos-sabanis-athens-b2ccab',entity_type:'artist',publish_status:'published',moderation_status:'clean',website:source,social_links:{spotify:'https://open.spotify.com/'},profile:{_enrich:{source_url:source,source_kind:'label_artist_profile',description:'Giorgos Sabanis is a Greek singer and songwriter.',listen:{spotify,youtube}}}};
test('inherited provider homepage cannot replace source-bound artist destination',()=>{
 const a=musicHomeContent(row);assert.equal(a.spotify,spotify);assert.equal(a.source_label,'Record label artist page');assert(!a.socials.some(s=>s.url==='https://open.spotify.com/'));assert.match(renderMusicHome(row),/6ZGwdAmu91r8mpA6SXodzd/);
});
test('malformed inherited providers fall back only to a matching reviewed source',()=>{
 for(const raw of ['https://open.spotify.com/','https://open.spotify.com/artist/no','https://elsewhere.example/artist/6ZGwdAmu91r8mpA6SXodzd','https://user:password@open.spotify.com/artist/6ZGwdAmu91r8mpA6SXodzd','javascript:alert(1)']){
  assert.equal(musicHomeContent({...row,social_links:{spotify:raw,youtube:'https://www.youtube.com/'}}).spotify,spotify);
  assert.equal(musicHomeContent({...row,social_links:{spotify:raw},profile:{}}).spotify,'');
 }
 assert.equal(musicHomeContent({...row,profile:{_enrich:{...row.profile._enrich,source_url:'https://other.example/'}}}).spotify,'');
 assert.equal(musicHomeContent({...row,social_links:{youtube:'https://www.youtube.com/'}}).youtube,youtube);
});
test('qualified inherited provider destinations retain their own identity and normalized links',()=>{
 const other='https://open.spotify.com/artist/4uyuai6Pqgz3kSx1Jme2PJ';
 assert.equal(musicHomeContent({...row,social_links:{spotify:other}}).spotify,other);
 assert.equal(musicHomeContent({...row,social_links:{spotify:spotify.replace('/artist/','/intl-fr/artist/')}}).spotify,spotify);
});
test('owner and profile explicit clears do not resurrect imported recordings',()=>{
 for(const owner_content of [{social_links:{}},{profile:{social:{}}},{profile:{spotify_url:null}},{profile:{spotify_url:''}}])assert.equal(musicHomeContent({...row,owner_content}).spotify,'');
 for(const profile of [{...row.profile,social:{}},{...row.profile,social_links:{}},{...row.profile,spotify_url:null}])assert.equal(musicHomeContent({...row,profile}).spotify,'');
 const chosen='https://open.spotify.com/artist/4uyuai6Pqgz3kSx1Jme2PJ';
 assert.equal(musicHomeContent({...row,owner_content:{social_links:{spotify:chosen}}}).spotify,chosen);
 assert.equal(musicHomeContent({...row,owner_content:{profile:{spotify_url:chosen}}}).spotify,chosen);
 assert.equal(musicHomeContent({...row,owner_content:{social_links:{youtube:''}}}).youtube,'');
});
