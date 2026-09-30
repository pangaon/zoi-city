import test from'node:test';import assert from'node:assert/strict';import{auxiliaryImage}from'../../supabase/functions/zoi-enrich/_image-context.js';import{profileMedia}from'../../api/_profile-media.js';import{extractSiteImages}from'../../supabase/functions/zoi-enrich/_images.js';
const reviewer='https://image-cdn.chowlyinc.com/75x75%2Cfit/https%3A%2F%2Flh3.googleusercontent.com%2Fa-%2FALV-UjUB4UzvuteD2mwL2j8H0ZINkFNQsiQgvVBIabV2GvSf6OyG74vk%3Ds128-c0x00000000-cc-rp-mo-ba2';const map='https://www.artionbakery.com/maps/23-18%2031st%20St%2C%20Astoria%2C%20NY%2C%2011105%2C%20US/359/418.png';const food='https://image-cdn.chowlyinc.com/650%2Cfit/https%3A%2F%2Fs3.amazonaws.com%2Ftoasttab%2Frestaurants%2Frestaurant-259385000000000000%2Fmenu%2Fitems%2F8%2Fitem-1300000001013362598_1779659781.jpg';
test('actual encoded reviewer portraits and restaurant generated maps are auxiliary; food is retained byte-for-byte',()=>{assert.equal(auxiliaryImage(reviewer),true);assert.equal(auxiliaryImage(map),true);assert.equal(auxiliaryImage(food),false);const p={hero_url:map,photo_urls:[map,reviewer,food]};assert.deepEqual(profileMedia({profile:{_enrich:p}},p),{hero:food,logo:null,gallery:[food],heroGallery:[food]});});
test('known map providers and review-avatar semantics excluded without broad host or small-image bans',()=>{for(const x of ['https://maps.googleapis.com/maps/api/staticmap?center=Athens','https://a.tile.openstreetmap.org/1/2/3.png','https://api.mapbox.com/styles/v1/acme/test/static/1,2,3/600x400','https://secure.gravatar.com/avatar/hash'])assert.equal(auxiliaryImage(x),true);for(const x of ['https://lh3.googleusercontent.com/p/real-place-photo=s75','https://images.example.org/maple-cake.jpg','https://images.example.org/75x75/food.jpg','https://images.example.org/photo.jpg?signature=keep%2Fexact','https://example.org/%broken'])assert.equal(auxiliaryImage(x),false);assert.equal(auxiliaryImage('https://cdn.example.org/123.jpg','reviewer profile photo'),true);});
test('owner-selected gallery/hero including maps or portraits remain authoritative and null clears hold',()=>{const p={hero_url:food,photo_urls:[food]};assert.equal(profileMedia({owner_content:{photo_url:map,profile:{photos:[map,reviewer]}},profile:{_enrich:p}},p).hero,map);assert.deepEqual(profileMedia({owner_content:{profile:{photos:[map,reviewer]}},profile:{_enrich:p}},p).gallery,[map,reviewer]);assert.equal(profileMedia({owner_content:{photo_url:null},profile:{_enrich:p}},p).hero,null);});
test('actual extractor excludes proxy avatars and map even when declared as metadata image',()=>{const result=extractSiteImages(`<meta property="og:image" content="${map}"><img src="${reviewer}"><img src="${food}">`,'https://www.artionbakery.com/');assert.equal(result.hero.url,food);assert.equal(result.photos.length,1);});
const venueAux=[
'https://cdn.trustindex.io/assets/platform/Google/star/f.svg',
'https://gocsa.org.au/wp-content/uploads/2025/07/GOCSA_Default-Social-Share.png',
'https://www.calgaryhellenic.ca/wp-content/uploads/2026/05/Lower_Hall_rental_rates_2026-600x776.jpg',
'https://www.calgaryhellenic.ca/wp-content/uploads/2026/05/rental_rates_2026-600x489.jpg'];
test('audited venue widget, social-share artwork and exact rate sheets are not machine photographs',()=>{
 for(const url of venueAux){assert.equal(auxiliaryImage(url),true,url);const p={photo_url:url,photo_urls:[url]};assert.deepEqual(profileMedia({profile:{_enrich:p}},p),{hero:null,logo:null,gallery:[],heroGallery:[]});assert.equal(p.photo_url,url,'source evidence retained');assert.equal(profileMedia({owner_content:{photo_url:url,profile:{photos:[url]}},profile:{_enrich:p}},p).hero,url);assert.deepEqual(profileMedia({owner_content:{profile:{photos:[url]}},profile:{_enrich:p}},p).gallery,[url]);}
 for(const url of ['https://gocsa.org.au/wp-content/uploads/2025/07/olympic-hall.jpg','https://www.calgaryhellenic.ca/wp-content/uploads/2026/05/Lower_Hall_interior.jpg','https://example.org/og-image.jpg','https://example.org/rental_rates_2026.jpg'])assert.equal(auxiliaryImage(url),false,url);
});
test('actual Olympic Hall and Calgary adapter projections show honest missing photographs',async()=>{
 const {eventHomeContent}=await import('../../api/_event-home.js');
 for(const [id,name,urls] of [['9ca606a8-bb17-43c4-bfce-84de3f442d39','Olympic Hall',[venueAux[1]]],['e02dc755-715b-4142-bce6-dfc6c0874c6f','Calgary Hellenic Banquet Hall',[venueAux[2],venueAux[3],venueAux[0]]]]){
  const entity={id,name,slug:name.toLowerCase().replaceAll(' ','-'),entity_type:'venue',publish_status:'published',profile:{_enrich:{photo_url:urls[0],photo_urls:urls}}};
  const before=JSON.stringify(entity);const rendered=eventHomeContent(entity);assert.equal(rendered.hero,'');assert.deepEqual(rendered.photos,[]);assert.equal(JSON.stringify(entity),before);
  const owner=eventHomeContent({...entity,owner_content:{photo_url:urls[0],profile:{photos:urls}}});assert.equal(owner.hero,urls[0]);assert.deepEqual(owner.photos,urls);
 }
});
test('AGFG publisher interface icons never become machine gallery photos; listing and artist imagery remains eligible',()=>{
 const icons=['https://www.agfg.com.au/images/layout/tb-facebook.png','https://www.agfg.com.au/images/layout/tb-instagram.png'];
 const venue='https://media1.agfg.com.au/images/listing/55968/hero-300.jpg?v=638253209320110211';
 const source={photo_url:icons[0],photo_urls:[...icons,venue]},before=JSON.stringify(source);
 for(const url of icons)assert.equal(auxiliaryImage(url),true);
 assert.deepEqual(profileMedia({profile:{_enrich:source}},source),{hero:venue,logo:null,gallery:[venue],heroGallery:[venue]});
 assert.equal(JSON.stringify(source),before);
 assert.deepEqual(profileMedia({profile:{_enrich:source},owner_content:{profile:{photos:icons}}},source).gallery,icons);
 assert.equal(profileMedia({profile:{_enrich:source},owner_content:{photo_url:null}},source).hero,null);
 for(const url of [venue,'https://www.agfg.com.au/images/listing/55968/tb-facebook.png','https://artist.example/images/layout/tb-facebook.png','https://i.scdn.co/image/ab6761610000e5ebartist','https://www.agfg.com.au/images/layout/chef-portrait.jpg'])assert.equal(auxiliaryImage(url),false,url);
 const extracted=extractSiteImages(`<meta property="og:image" content="${icons[0]}"><img src="${icons[1]}"><img src="${venue}">`,'https://www.agfg.com.au/restaurant/litanis-greek-mediterranean-restaurant-55968');
 assert.equal(extracted.hero.url,venue);assert.equal(extracted.photos.length,1);
});
