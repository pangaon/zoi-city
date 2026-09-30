import test from 'node:test';import assert from 'node:assert/strict';
import {profileMedia,imageIdentity,interfaceArtwork} from '../../api/_profile-media.js';
test('crawled resized derivatives collapse and interface artwork never becomes a gallery',()=>{
 const p={hero_url:'https://site.test/pandosia-logo-1920w.jpg',photo_urls:['https://site.test/menu-badge-1920w.png','https://site.test/Top-1920w.png','https://site.test/room.jpg','https://site.test/room-1024x682.jpg','https://site.test/room.jpg.webp','https://site.test/dish.jpg']};
 const media=profileMedia({profile:{_enrich:p}},p);assert.equal(media.hero,'https://site.test/room.jpg');assert.equal(media.logo,p.hero_url);assert.equal(media.gallery.length,2);
 assert.equal(imageIdentity(p.photo_urls[2]),imageIdentity(p.photo_urls[3]));
});
test('explicit owner choices and removals override crawl results',()=>{
 const p={hero_url:'https://site.test/logo.jpg',photo_urls:['https://site.test/menu-badge.png']};
 assert.equal(profileMedia({profile:p},p).hero,p.hero_url);assert.equal(profileMedia({profile:p},p).gallery.length,1);
 assert.equal(profileMedia({profile:{hero_url:null,photo_urls:[],_enrich:p}},{...p,hero_url:null,photo_urls:[]}).hero,null);
});
test('untrusted protocols rejected and ordinary photographs retained',()=>{
 for(const u of ['javascript:alert(1)','https://a:b@site.test/a.jpg','http://site.test/a.jpg'])assert.equal(profileMedia({profile:{}},{hero_url:u}).hero,null);
 for(const name of ['apple.png','google.png','food_rating.png','blue-left-1920w.png'])assert.equal(interfaceArtwork('https://site.test/'+name),true);
 assert.equal(interfaceArtwork('https://site.test/greek-dancing.jpg'),false);
});
