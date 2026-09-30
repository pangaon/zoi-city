import test from 'node:test';import assert from 'node:assert/strict';
import{publicMedia,extractPublicMedia}from'../../supabase/functions/zoi-enrich/_media.js';
import{profileForVertical,verticalFor,safeProfile}from'../../api/_verticals.js';
const spotify='https://open.spotify.com/artist/0123456789ABCDEFGHIJKL';
test('media URLs retain real playback identifiers and discard tracking',()=>{
 assert.equal(publicMedia('https://youtube.com/watch?v=dQw4w9WgXcQ&amp;utm_source=site').url,'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
 assert.equal(publicMedia('https://youtu.be/dQw4w9WgXcQ?t=5').url,'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
 assert.equal(publicMedia('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ').embed,true);
 assert.equal(publicMedia(spotify.replace('/artist/','/intl-el/embed/artist/')).url,spotify);
});
test('public providers support music links without inventing embed support',()=>{
 for(const u of ['https://music.apple.com/us/artist/example/123','https://band.bandcamp.com/album/new-album','https://soundcloud.com/artist/song','https://vimeo.com/12345'])assert.equal(publicMedia(u).embed,false);
 for(const u of ['javascript:alert(1)','https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ','https://user:pass@youtu.be/dQw4w9WgXcQ','https://youtu.be:8443/dQw4w9WgXcQ','https://youtube.com/watch?v=bad','https://open.spotify.com/artist/invalid','https://soundcloud.com/search','https://bandcamp.com/discover'])assert.equal(publicMedia(u),null);
});
test('only actual anchor and iframe URLs become bounded music content',()=>{
 const doc=`<a href="${spotify}?utm=x">Listen</a><iframe src="${spotify.replace('/artist/','/embed/artist/')}"></iframe><a HREF = '//youtu.be/dQw4w9WgXcQ'>Watch</a><script>"<a href='https://soundcloud.com/fake'>"</script><!-- <a href="https://fake.bandcamp.com"> -->`;
 const r=extractPublicMedia(doc);assert.deepEqual(r.embeds,[spotify,'https://www.youtube.com/watch?v=dQw4w9WgXcQ']);assert.equal(r.listen.spotify,spotify);assert.equal(r.listen.soundcloud,undefined);assert.equal(r.listen.bandcamp,undefined);assert.deepEqual(r.video_urls,['https://www.youtube.com/watch?v=dQw4w9WgXcQ']);
});
test('music home uses actual extracted links, preserves provenance and respects explicit owner clears',()=>{
 const e={entity_type:'artist',profile:{_enrich:{social:{spotify},video_urls:['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],provenance:{social:'website'}}}};const v=verticalFor(e).v;
 const p=profileForVertical(v,safeProfile(e),e);assert.equal(p.listen.spotify,spotify);assert.ok(p.embeds.includes(spotify));assert.equal(p.videos[0].url,e.profile._enrich.video_urls[0]);assert.equal(p._from.social,'website');
 for(const clear of [{spotify_url:null},{listen:null},{listen:{}}]){const q=profileForVertical(v,safeProfile({...e,profile:{...e.profile,...clear}}),e);assert.ok(!q.listen.spotify);}
 const own=profileForVertical(v,safeProfile(e),{...e,social_links:{spotify:null}});assert.ok(!own.listen.spotify);
});
