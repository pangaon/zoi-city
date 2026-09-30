import{publicWidget}from'../../api/_public-widget.js';
import test from 'node:test';import assert from 'node:assert/strict';
import{resolveSocialLinks}from'../../assets/homes/social-links.mjs';
import{genericEventData}from'../../api/_generic-event-data.js';
import{personData}from'../../assets/homes/person-data.mjs';
import{musicHomeContent,renderMusicHome}from'../../api/_music-home.js';
import{ARTIST_SOURCES}from'../../assets/homes/templates/music/sources.mjs';
const youtube='https://www.youtube.com/@ExampleArtist',instagram='https://www.instagram.com/exampleartist/',facebook='https://www.facebook.com/exampleartist';
test('absent, populated, sparse and explicit owner sets have distinct semantics',()=>{
 assert.deepEqual(resolveSocialLinks({}, {social:{youtube}}),{youtube});
 assert.deepEqual(resolveSocialLinks({},{}),{});
 for(const value of [{},null])assert.deepEqual(resolveSocialLinks({owner_content:{social_links:value},social_links:{facebook}},{social:{youtube}}),{});
 assert.deepEqual(resolveSocialLinks({owner_content:{social_links:{instagram}},social_links:{facebook}},{social:{youtube}}),{instagram});
 assert.deepEqual(resolveSocialLinks({profile:{social:{instagram}},social_links:{facebook}},{social:{youtube}}),{instagram,facebook});
 assert.deepEqual(resolveSocialLinks({profile:{social:{}}},{social:{youtube}}),{});
});
test('generic events expose filtered extracted channels and preserve explicit removals',()=>{
 const e={id:'00000000-0000-4000-8000-000000000001',entity_type:'event',name:'Event',profile:{_enrich:{social:{youtube}}}};
 assert.equal(genericEventData(e).socials[0].url,youtube);
 assert.deepEqual(genericEventData({...e,owner_content:{social_links:{}}}).socials,[]);
});
test('professionals expose identity-bound source channels, never publisher or mismatched identity channels',()=>{
 const e={name:'Person',website:'https://example.org/',profile:{_enrich:{source_url:'https://example.org/',social:{youtube}}}};
 assert.equal(personData(e).socials[0].url,youtube);
 assert.deepEqual(personData({...e,owner_content:{social_links:{}}}).socials,[]);
 for(const patch of [{source_url:'https://another.org/'},{source_kind:'association_directory'},{organization_identity_quarantine:true}])assert.deepEqual(personData({...e,profile:{_enrich:{...e.profile._enrich,...patch}}}).socials,[]);
});
test('curated music social removal clears fallback players but keeps separately authored player',()=>{
 const [id,s]=Object.entries(ARTIST_SOURCES).find(([,v])=>v.spotify);
 const e={id,slug:s.slug,entity_type:'artist',name:s.name,website:s.website,profile:{},owner_content:{social_links:{}}};
 assert.equal(publicWidget({...e,publish_status:'published',moderation_status:'clean'},id).media,null);
 assert.equal(musicHomeContent(e).spotify,'');assert.equal(musicHomeContent(e).youtube,'');
 const chosen='https://open.spotify.com/artist/0eLU3EgFDZOFgd2Dwalfwo';
 assert.equal(musicHomeContent({...e,owner_content:{social_links:{},profile:{spotify_url:chosen}}}).spotify,chosen);
});

test('curated artist explicit playlist clear or replacement overrides reviewed playlist',()=>{
 const [id,s]=Object.entries(ARTIST_SOURCES).find(([,v])=>v.video_playlist);assert.ok(s);
 const e={id,slug:s.slug,entity_type:'artist',name:s.name,website:s.website,profile:{}};
 assert.equal(musicHomeContent(e).video_playlist,s.video_playlist);
 for(const value of [null,'',[]]){
  assert.equal(musicHomeContent({...e,profile:{video_playlist:value}}).video_playlist,'');
  assert.equal(musicHomeContent({...e,owner_content:{social_links:{},profile:{video_playlist:value}}}).video_playlist,'');
  const html=renderMusicHome({...e,owner_content:{social_links:{},profile:{video_playlist:value}}});const data=JSON.parse(html.match(/<script type="application\/json" id="music-home-content">([\s\S]*?)<\/script>/)[1]);assert.equal(data.artist.video_playlist,'');
 }
 const replacement='https://www.youtube.com/playlist?list=PL_owner_selected_playlist';
 for(const patch of [{profile:{video_playlist:replacement}},{owner_content:{social_links:{},profile:{video_playlist:replacement}}}])assert.equal(musicHomeContent({...e,...patch}).video_playlist,replacement);
 const withVideo=musicHomeContent({...e,owner_content:{social_links:{},profile:{video_playlist:replacement,youtube_url:'https://www.youtube.com/watch?v=Hf2c-asB5rw'}}});assert.equal(withVideo.video_playlist,replacement);assert.equal(withVideo.youtube,'https://www.youtube.com/watch?v=Hf2c-asB5rw');
});
