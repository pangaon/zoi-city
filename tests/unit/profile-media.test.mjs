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
test('machine logo directories and advertisements cannot become heroes; owner choices remain authoritative',()=>{
 const p={hero_url:'https://cdn.example.com/logos/23131.png',logo_url:'https://example.com/',photo_urls:['https://cdn.example.com/logos/23131.png','https://example.com/food_rating.png','https://example.com/gyro.jpeg']};
 assert.deepEqual(profileMedia({profile:{_enrich:p}},p),{hero:'https://example.com/gyro.jpeg',logo:p.hero_url,gallery:['https://example.com/gyro.jpeg'],heroGallery:['https://example.com/gyro.jpeg']});
 assert.equal(profileMedia({profile:{_enrich:p},photo_url:p.hero_url},p).hero,'https://example.com/gyro.jpeg');
 const ad='https://example.com/Melodia_Anzeige.jpeg';assert.equal(interfaceArtwork(ad),true);
 assert.equal(profileMedia({owner_content:{photo_url:ad},profile:{_enrich:p}},p).hero,ad);
 assert.equal(profileMedia({owner_content:{photo_url:null},profile:{_enrich:p}},p).hero,null);
});

test('explicit owner image endpoints and signed query-root image providers stay supported',()=>{
 for(const image of ['https://images.example.com/?url=photo','https://example.com/photo.php?id=2','https://example.com/'])assert.equal(profileMedia({owner_content:{photo_url:image},profile:{}},{}).hero,image);
 assert.equal(profileMedia({profile:{_enrich:{}}},{photo_url:'https://images.example.com/?url=photo'}).hero,'https://images.example.com/?url=photo');
});

test('exact source gallery-only roles retain photos without promoting them into a hero',()=>{
 const portrait='https://source.example/parade.jpg',wide='https://source.example/room.jpg';
 const p={photos:[portrait],photo_roles:[{url:portrait,role:'gallery_only'}]};
 const m=profileMedia({profile:{_enrich:p}},p);assert.equal(m.hero,null);assert.deepEqual(m.gallery,[portrait]);assert.deepEqual(m.heroGallery,[]);
 p.photos.push(wide);assert.equal(profileMedia({profile:{_enrich:p}},p).hero,wide);
});
test('gallery-only restrictions are exact URL bound and explicit owner hero wins',()=>{
 const url='https://source.example/parade.jpg';const p={photos:[url],photo_roles:[{url,role:'gallery_only'}]};
 assert.equal(profileMedia({profile:{_enrich:p},owner_content:{photo_url:url}},p).hero,url);
 assert.equal(profileMedia({profile:{_enrich:p},owner_content:{photo_url:null}},p).hero,null);
 const other={...p,photos:[url+'?different=1']};assert.equal(profileMedia({profile:{_enrich:other}},other).hero,url+'?different=1');
});
test('explicit owner gallery choice can override an imported gallery-only role',()=>{const url='https://source.example/parade.jpg',p={photos:[url],photo_roles:[{url,role:'gallery_only'}]};const m=profileMedia({profile:{_enrich:p},owner_content:{profile:{photos:[url]}}},p);assert.equal(m.hero,url);assert.deepEqual(m.heroGallery,[url]);});
