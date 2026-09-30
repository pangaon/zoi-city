import{test}from'node:test';import assert from'node:assert/strict';import{extractSiteImages,sourceImage,supplementaryPages}from'../../supabase/functions/zoi-enrich/_images.js';
const base='https://restaurant.example.org/';
test('JSONLD logo stays logo and real imagery becomes hero',()=>{const r=extractSiteImages('<meta property="og:image" content="/logo.jpg"><img src="/dining.jpg" width="1200">',base,{logo:'/logo.jpg'});assert.equal(r.logo.url,base+'logo.jpg');assert.equal(r.hero.url,base+'dining.jpg');assert.equal(r.photos.length,1);});
test('deduplicates responsive variants, recognizes CSS backgrounds, excludes badges and stock',()=>{const r=extractSiteImages('<img src="/dining-300x200.jpg" srcset="/dining-300x200.jpg 300w, /dining.jpg 1200w"><img src="/dining.jpg.webp"><img src="/app-store.png"><img src="/pexels-photo-123.jpg"><div style="background-image:url(/terrace.jpg)"></div>',base);assert.deepEqual(r.photos.map(x=>x.url),[base+'dining.jpg',base+'terrace.jpg']);});
test('relative image objects and alternate meta attribute order supported',()=>{const r=extractSiteImages('<meta content="/food.jpg" name="twitter:image">',base,{logo:{contentUrl:'/brand.webp'},image:[{url:'/inside.jpg'}]});assert.equal(r.logo.url,base+'brand.webp');assert.equal(r.hero.url,base+'inside.jpg');assert.equal(r.photos.length,2);});
test('rejects private addresses/credentials/data and ignores scripts',()=>{for(const u of ['http://example.org/x.jpg','https://127.0.0.1/x.jpg','https://user:pass@example.org/x','data:image/png,x','https://metadata.internal/x'])assert.equal(sourceImage(u,base),null);assert.equal(extractSiteImages('<script>"<img src=\"/fake.jpg\">"</script>',base).photos.length,0);});
test('supplements only two explicit same-origin contact/gallery pages, not forms or external links',()=>{const pages=supplementaryPages('<a href="/gallery/">Photos</a><a href="/contact/">Contact</a><a href="https://evil.example/contact">Contact</a><a href="/contact?delete=yes">Contact</a>',base);assert.deepEqual(pages,[{url:base+'gallery/',purpose:'gallery'},{url:base+'contact/',purpose:'contact'}]);});

test('small explicit header logos remain available without entering photo gallery',()=>{const r=extractSiteImages('<img src="/brand.png" class="site-logo" width="120" height="40">',base);assert.equal(r.logo.url,base+'brand.png');assert.equal(r.photos.length,0);});
test('empty or page logo values do not resolve into image URLs and logo directories are not photos',()=>{
 const result=extractSiteImages('<img src="https://cdn.example.com/logos/23131.png"><img src="/food_rating.png"><img src="/Melodia_Anzeige.jpeg"><img src="/gyro.jpeg">','https://example.com/',{logo:'',image:'https://example.com/'});
 assert.equal(result.logo.url,'https://cdn.example.com/logos/23131.png');assert.equal(result.hero.url,'https://example.com/gyro.jpeg');assert.equal(result.photos.length,1);
 assert.equal(extractSiteImages('','https://example.com/',{logo:'https://example.com/'}).logo,null);
});
test('explicit same-origin menu takes priority within the unchanged two-page budget',()=>{const html='<a href="/contact">Contact</a><a href="/gallery">Gallery</a><a href="/speisen-getraenke/">Speisen & Getränke</a><a href="https://outside.example/menu">Menu</a>';assert.deepEqual(supplementaryPages(html,'https://restaurant.example/'),[{url:'https://restaurant.example/speisen-getraenke/',purpose:'menu'},{url:'https://restaurant.example/contact',purpose:'contact'}]);});

test('video sources cannot become heroes in any family and CSS entity quotes are decoded',()=>{const r=extractSiteImages('<video><source src="/hero.mp4" type="video/mp4"></video><img src="/community.jpg"><div style="background-image: url(&quot;/inside.jpg&quot;)"></div>',base);assert.equal(r.hero.url,base+'community.jpg');assert.deepEqual(r.photos.map(x=>x.url),[base+'community.jpg',base+'inside.jpg']);for(const path of ['/movie.mp4','/sound.mp3','/menu.pdf','/%22/bad.jpg%22'])assert.equal(sourceImage(path,base),null);});
test('menu scans and decorative quotes are separated from real venue photography',()=>{const r=extractSiteImages('<img src="/uploads/123.jpg" alt="Final menu.jpg"><img src="/quotation-mark.png"><div style="background-image:url(/yamas-pattern.png)"></div><img src="/dining.jpg">',base);assert.deepEqual(r.photos.map(x=>x.url),[base+'dining.jpg']);assert.deepEqual(r.menuImages.map(x=>x.url),[base+'uploads/123.jpg']);});


test('a photographed dish inside a menu items folder remains food photography, not a menu scan',()=>{const url='https://restaurant.org/menu/items/grilled-fish.jpg';const result=extractSiteImages(`<img src="${url}" alt="Grilled fish">`,'https://restaurant.org/');assert.equal(result.hero.url,url);assert.deepEqual(result.menuImages,[])});

test('Wix transform commas remain intact and highest explicit density wins',()=>{
 const low='https://static.wixstatic.com/media/abc.jpg/v1/fill/w_427,h_654,al_c,q_80,enc_avif,quality_auto/photo.jpg';
 const high=low.replace('w_427,h_654','w_854,h_1308');
 const result=extractSiteImages(`<img src="${low}" srcset="${low} 1x, ${high} 2x" alt="Our dance company">`,base);
 assert.equal(result.hero.url,high);assert.equal(result.photos.length,1);
});
test('publisher srcset accidentally placed in src is parsed rather than stored as a malformed URL',()=>{
 const result=extractSiteImages('<img src="/dance-small.jpg 1x, /dance-large.jpg 2x">',base);
 assert.equal(result.hero.url,base+'dance-large.jpg');
});
test('invalid responsive descriptors cannot manufacture URLs from transformation tokens',()=>{
 const result=extractSiteImages('<img src="/fallback.jpg" srcset="/small.jpg 20h, /large.jpg 2x 300w">',base);
 assert.equal(result.hero.url,base+'fallback.jpg');
});
