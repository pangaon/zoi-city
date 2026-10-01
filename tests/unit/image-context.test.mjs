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
test('reviewed full/half rating stars are interface artwork; Star Hotel photographs remain eligible',()=>{
 const stars=['https://www.tastygreekcorner.co.uk/imgs/star.png','https://www.tastygreekcorner.co.uk/imgs/star_half.png?v=1'];
 for(const url of [...stars,'https://restaurant.test/ratings/star.png','https://restaurant.test/review-widget/star-half.svg'])assert.equal(auxiliaryImage(url),true,url);
 assert.equal(auxiliaryImage('https://restaurant.test/assets/star.png','rating star icon'),true);
 for(const url of ['https://starhotel.test/photos/star-hotel-room.jpg','https://starhotel.test/photos/star.png','https://restaurant.test/imgs/star.png','https://restaurant.test/photos/star-shaped-pastry.png','https://www.tastygreekcorner.co.uk/assets/images/star-dish.png'])assert.equal(auxiliaryImage(url),false,url);
 const food='https://www.tastygreekcorner.co.uk/assets/images/gyro.jpeg';
 const result=extractSiteImages(`<meta property="og:image" content="${stars[0]}"><img src="${stars[1]}"><img src="${food}">`,'https://www.tastygreekcorner.co.uk/');
 assert.equal(result.hero.url,food);assert.deepEqual(result.photos.map(x=>x.url),[food]);
 const p={hero_url:stars[0],photo_urls:[...stars,food]},before=JSON.stringify(p);
 assert.deepEqual(profileMedia({profile:{_enrich:p}},p),{hero:food,logo:null,gallery:[food],heroGallery:[food]});assert.equal(JSON.stringify(p),before);
 assert.deepEqual(profileMedia({owner_content:{profile:{photos:stars}},profile:{_enrich:p}},p).gallery,stars);
 assert.equal(profileMedia({owner_content:{photo_url:null,profile:{photos:[]}},profile:{_enrich:p}},p).hero,null);
});
test('restaurant public HTML and photo count exclude stored machine rating icons without mutating evidence',async()=>{
 const {restaurantHomeContent,renderRestaurantHome}=await import('../../api/_restaurant-home.js');
 const food='https://www.tastygreekcorner.co.uk/assets/images/gyro.jpeg',stars=['https://www.tastygreekcorner.co.uk/imgs/star.png','https://www.tastygreekcorner.co.uk/imgs/star_half.png'];
 const e={id:'d22b0d42-cdc8-4054-afb9-be2820c35b5a',slug:'tasty-greek-corner-coventry',name:'Tasty Greek Corner',entity_type:'business',category_slug:'greek-restaurants',website:'https://www.tastygreekcorner.co.uk/',profile:{_enrich:{source_url:'https://www.tastygreekcorner.co.uk/',hero_url:food,photo_urls:[food,...stars]}}};
 const before=JSON.stringify(e),content=restaurantHomeContent(e),html=renderRestaurantHome(e);
 assert.deepEqual(content.photos,[food]);assert.equal(JSON.stringify(e),before);
 for(const star of stars)assert.equal(html.includes(star),false);
 assert.ok(html.includes(food));
 const sparse=restaurantHomeContent({...e,profile:{_enrich:{photo_urls:stars}}});assert.deepEqual(sparse.photos,[]);assert.equal(sparse.hero,null);
});
test('all reviewed Tasty source candidates retain food and exclude decorative UI with owner precedence',async()=>{
 const base='https://www.tastygreekcorner.co.uk/',food=base+'assets/images/gyro.jpeg';
 const auxiliary=['imgs/star.png','imgs/star_half.png','imgs/divider_large.png','imgs/divider_small.png','/img/dropdownarrow.png','imgs/add-button.png','imgs/back-to-top.png'].map(p=>base+p);
 for(const url of auxiliary)assert.equal(auxiliaryImage(url),true,url);
 for(const url of ['https://other.example/imgs/divider_small.png','https://other.example/ui/back-to-top.svg','https://other.example/icons/dropdown-arrow.webp'])assert.equal(auxiliaryImage(url),true,url);
 for(const url of [food,'https://other.example/photos/divider_large.png','https://other.example/imgs/room-divider.png','https://other.example/photos/add-button.png','https://other.example/imgs/divider_large.jpg','https://other.example/imgs/star.png'])assert.equal(auxiliaryImage(url),false,url);
 const p={hero_url:auxiliary[2],photo_urls:[...auxiliary,food]},before=JSON.stringify(p);
 assert.deepEqual(profileMedia({profile:{_enrich:p}},p),{hero:food,logo:null,gallery:[food],heroGallery:[food]});assert.equal(JSON.stringify(p),before);
 assert.deepEqual(profileMedia({profile:{_enrich:p},owner_content:{photo_url:auxiliary[2],profile:{photos:auxiliary}}},p).gallery,auxiliary);
 assert.equal(profileMedia({profile:{_enrich:p},owner_content:{photo_url:auxiliary[2]}},p).hero,auxiliary[2]);
 const result=extractSiteImages([...auxiliary,food].map(url=>`<img src="${url}">`).join(''),base);assert.deepEqual(result.photos.map(x=>x.url),[food]);
 const {restaurantHomeContent,renderRestaurantHome}=await import('../../api/_restaurant-home.js');
 const e={id:'d22b0d42-cdc8-4054-afb9-be2820c35b5a',slug:'tasty-greek-corner-coventry',name:'Tasty Greek Corner',entity_type:'business',category_slug:'greek-restaurants',website:base,profile:{_enrich:{...p,source_url:base}}};
 assert.deepEqual(restaurantHomeContent(e).photos,[food]);const html=renderRestaurantHome(e);for(const url of auxiliary)assert.equal(html.includes(url),false,url);assert.ok(html.includes(food));
});

test('stored plus-delimited and weblogo artwork cannot replace genuine machine photographs; owner choices remain authoritative',()=>{
 const photos=['https://restaurant.org/Poppis-dining.jpg','https://restaurant.org/LogoVillage-terrace.jpg'];
 for(const logo of ['https://cdn.example.org/Logo+best+quality+no+words.jpg?format=1500w','https://cdn.example.org/Poppis_weblogos-03.png?format=1500w']){
  const p={hero_url:logo,photo_urls:[logo,...photos]},entity={profile:{_enrich:p}};
  const result=profileMedia(entity,p);assert.equal(result.hero,photos[0]);assert.deepEqual(result.gallery,photos);assert.equal(result.logo,logo);
  const sparse={hero_url:logo,photo_urls:[logo]};const empty=profileMedia({profile:{_enrich:sparse}},sparse);assert.equal(empty.hero,null);assert.deepEqual(empty.gallery,[]);
  const selected=profileMedia({...entity,owner_content:{photo_url:logo,profile:{photos:[logo]}}},p);assert.equal(selected.hero,logo);assert.deepEqual(selected.gallery,[logo]);
  const cleared=profileMedia({...entity,owner_content:{photo_url:null,profile:{photos:[]}}},p);assert.equal(cleared.hero,null);assert.deepEqual(cleared.gallery,[]);
  assert.equal(p.hero_url,logo,'stored source evidence is not mutated');
 }
});
test('restaurant and hospitality projections share stored-logo filtering for populated and sparse homes',async()=>{
 const {restaurantHomeContent}=await import('../../api/_restaurant-home.js');const {hospitalityHomeContent}=await import('../../api/_hospitality-home.js');
 const logo='https://cdn.example.org/Poppis_weblogos-03.png',photo='https://restaurant.org/dining.jpg';
 const base={id:'d22b0d42-cdc8-4054-afb9-be2820c35b5a',slug:'example',name:'Example',website:'https://restaurant.org/',profile:{_enrich:{hero_url:logo,photo_urls:[logo,photo]}}};
 for(const [project,kind] of [[restaurantHomeContent,{entity_type:'business',category_slug:'greek-restaurants'}],[hospitalityHomeContent,{entity_type:'travel_place',category_slug:'hotels'}]]){
  const populated=project({...base,...kind});assert.equal(populated.hero,photo);assert.deepEqual(populated.photos,[photo]);
  const sparse=project({...base,...kind,profile:{_enrich:{hero_url:logo,photo_urls:[logo]}}});assert(!sparse.hero);assert.deepEqual(sparse.photos,[]);
 }
});
